import { SafeSecureStore } from '../storageService';
import { keystoreTicketVault } from '../keystoreTicketVault';
import { apiClient } from '../apiClient';
import { WhiteDeskCrypto } from '../../whitedesk-sdk';
import { i18nService } from '../i18nService';
import { BRAND } from '../../config/brand';
import { executeSql, escapeSqlString, generateTicketId } from './db';
import {
  CURRENT_APP_ID,
  HelpDeskTicket,
  HelpDeskMessage,
  TicketStatus,
  TicketLifecycleStatus,
} from './types';
import { helpDeskAuthService } from './helpDeskAuthService';
import { helpDeskRelayService } from './helpDeskRelayService';
import { helpDeskStationService } from './helpDeskStationService';
import { helpDeskLicenseService } from './helpDeskLicenseService';

/**
 * WhiteDesk Ticket & Messaging Service:
 * Handles ticket lifecycle (CRUD), messages, discussions, replies,
 * ratings, self-destruction timers, and automatic deletion workflows.
 */
export const helpDeskTicketService = {
  /**
   * Retrieves tickets purely from the Hardware-Protected Local Keystore Vault (0ms).
   * Background sync checks Cloudflare D1 relay for any pending transient tickets/messages.
   */
  async getTickets(
    ownWhiteId: string, 
    isAdmin: boolean, 
    appId: string = CURRENT_APP_ID, 
    activeTenantBlindId?: string | null,
    callerRole?: 'founder' | 'global_admin' | 'admin' | 'none'
  ): Promise<HelpDeskTicket[]> {
    const blindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);

    // 1. ANINDA 0ms: Donanımsal Keystore'dan yerel mühürlü biletleri oku
    const allTickets = await keystoreTicketVault.getTickets();

    // 2. Rol ve yetki durumuna göre hafızada (in-memory) anında filtrele
    let filtered: HelpDeskTicket[] = [];

    if (isAdmin) {
      const adminRole = (callerRole && callerRole !== 'none') ? callerRole : await helpDeskAuthService.getAdminRole(ownWhiteId);
      const isFounder = adminRole === 'founder' || (adminRole as string) === 'master';
      const isGlobalAdmin = adminRole === 'global_admin';
      const adminEnt = await helpDeskAuthService.getAdminEnterprise();
      const effectiveTenant = (activeTenantBlindId && activeTenantBlindId !== 'all')
        ? activeTenantBlindId 
        : adminEnt.enterpriseBlindId;

      if (isFounder) {
        if (activeTenantBlindId && activeTenantBlindId !== 'all') {
          filtered = allTickets.filter(t => t.enterprise_blind_id === activeTenantBlindId);
        } else {
          filtered = allTickets;
        }
      } else if (isGlobalAdmin) {
        filtered = allTickets.filter(t => !effectiveTenant || t.enterprise_blind_id === effectiveTenant);
      } else {
        // Alt Adminler: Yalnızca kendi biletleri veya kurum biletleri (root_support ASLA görünmez!)
        filtered = allTickets.filter(t => {
          const tenantMatch = !effectiveTenant || t.enterprise_blind_id === effectiveTenant;
          const tOwnerBlind = WhiteDeskCrypto.generateBlindId(t.user_blind_id || t.user_white_id || '');
          const ownTicket = tOwnerBlind.toLowerCase() === blindId.toLowerCase();
          const isRootSupport = t.category === 'root_support';
          return (tenantMatch || ownTicket) && !isRootSupport;
        });
      }
    } else {
      // Normal Kullanıcı: SADECE kendi biletlerini görür! Tartışmaları ve root_support biletlerini ASLA göremez!
      filtered = allTickets.filter(t => {
        const tOwnerBlind = WhiteDeskCrypto.generateBlindId(t.user_blind_id || t.user_white_id || '');
        const isOwn = tOwnerBlind.toLowerCase() === blindId.toLowerCase();
        const isRootSupport = t.category === 'root_support';
        return isOwn && !t.is_discussion && !isRootSupport;
      });
    }

    filtered.sort((a, b) => (b.updated_at || b.created_at || 0) - (a.updated_at || a.created_at || 0));

    return filtered;
  },

  /**
   * Fast 0ms local read directly from Hardware-Protected Keystore Vault.
   */
  async getLocalTicketMessages(ticketId: string): Promise<HelpDeskMessage[]> {
    return await keystoreTicketVault.getMessages(String(ticketId).trim());
  },

  /**
   * Sovereign D1 + R2 Relay: Reads messages from Hardware-Protected Keystore Vault (0ms).
   * Polls Cloudflare D1 for transient messages, seals them into Keystore, and confirms ACK
   * to vaporize them immediately from Cloudflare D1/R2.
   */
  async getTicketMessages(ticketId: string): Promise<HelpDeskMessage[]> {
    const cleanTicketId = String(ticketId).trim();

    let localMessages = await keystoreTicketVault.getMessages(cleanTicketId);

    try {
      const ownWhiteId = await helpDeskAuthService.getOwnWhiteId();
      const ownBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);

      const transientItems = await apiClient.fetchRelayInbox({
        ticket_id: cleanTicketId,
      });

      if (transientItems && transientItems.length > 0) {
        for (const item of transientItems) {
          try {
            if (item.sender_blind_id === ownBlindId) {
              continue;
            }

            let payloadData: any = null;
            try {
              payloadData = JSON.parse(item.encrypted_payload);
            } catch {
              payloadData = { message: item.encrypted_payload };
            }

            // UZAK MASAÜSTÜ KONTROL PAKETLERİ: Sohbet mesajı olarak kaydedilip buharlaştırılmasın,
            // doğrudan remoteDesktopService'e iletilsin (aksi halde onay modalı hiç açılmıyordu).
            if (payloadData?.type === 'rd_invite_signal' || payloadData?.type === 'rd_cancel_signal') {
              const rdTicketId = payloadData.ticket_id || item.ticket_id || cleanTicketId;
              try {
                const { remoteDesktopService } = require('../remoteDesktopService');
                if (payloadData.type === 'rd_invite_signal') {
                  void remoteDesktopService.receiveIncomingInvite(
                    rdTicketId,
                    payloadData.admin_alias || i18nService.t('ticket_service.default_support_specialist'),
                    true
                  );
                } else {
                  remoteDesktopService.dismissIncomingOffer(rdTicketId);
                }
              } catch (rdErr) {
                console.warn('[HelpDeskTicketService] Remote desktop signal dispatch error:', rdErr);
              }
              await apiClient.confirmRelayAck(item.id, item.attachment_r2_key);
              continue;
            }

            const rawMsg = payloadData.message || payloadData.initial_message || payloadData;
            const r2Key = item.attachment_r2_key || rawMsg.attachment_r2_key;
            let downloadedBase64: string | null = null;
            if (r2Key) {
              try {
                console.log(`[HelpDeskTicketService] getTicketMessages downloading attachment from R2 (${r2Key})...`);
                downloadedBase64 = await apiClient.fetchRelayAttachment(r2Key);
              } catch (r2Err) {
                console.warn('[HelpDeskTicketService] getTicketMessages R2 fetch error:', r2Err);
              }
            }

            const attData = downloadedBase64 || rawMsg.attachment_data || null;
            const attName = rawMsg.attachment_name || null;
            const attType = rawMsg.attachment_type || null;
            let attachmentsList: any[] | undefined = rawMsg.attachments;

            if (attData) {
              if (attType === 'multi' || (typeof attData === 'string' && attData.trim().startsWith('['))) {
                try {
                  attachmentsList = JSON.parse(attData);
                } catch {
                  attachmentsList = [{
                    name: attName || 'attachment.dat',
                    data: attData,
                    type: attType || 'document',
                    mimeType: 'application/octet-stream',
                  }];
                }
              } else if (attachmentsList && attachmentsList.length > 0) {
                attachmentsList[0].data = attData;
                if (attName) attachmentsList[0].name = attName;
                if (attType) attachmentsList[0].type = attType;
              } else {
                attachmentsList = [{
                  name: attName || (attType === 'image' ? 'photo.jpg' : 'document.pdf'),
                  data: attData,
                  type: attType === 'image' ? 'image' : 'document',
                  mimeType: attType === 'image' ? 'image/jpeg' : 'application/octet-stream',
                }];
              }
            }

            const newMsg: HelpDeskMessage = {
              id: item.id,
              ticket_id: item.ticket_id || cleanTicketId,
              app_id: rawMsg.app_id || payloadData.app_id || 'inwhite',
              sender_white_id: rawMsg.sender_white_id || payloadData.sender_white_id || '',
              sender_alias: rawMsg.sender_alias || payloadData.sender_alias || null,
              sender_blind_id: item.sender_blind_id,
              is_admin: Boolean(rawMsg.is_admin ?? payloadData.is_admin),
              sender_role: rawMsg.sender_role || payloadData.sender_role || null,
              message: rawMsg.message || payloadData.message || '',
              attachment_data: attData,
              attachment_name: attName,
              attachment_type: attType,
              attachments: attachmentsList,
              created_at: Number(item.created_at || Date.now()),
            };

            await keystoreTicketVault.appendMessage(cleanTicketId, newMsg);

            if (attData) {
              try {
                const allTickets = await keystoreTicketVault.getTickets();
                const curTicket = allTickets.find(t => t.id === cleanTicketId);
                const isDiag =
                  attType === 'diagnostic' ||
                  attName?.includes('diagnostics.whitedesk') ||
                  (Array.isArray(attachmentsList) &&
                    attachmentsList.some((a: any) => a.type === 'diagnostic' || a.name?.includes('diagnostics.whitedesk')));
                if (curTicket && (!curTicket.attachment_data || isDiag)) {
                  curTicket.attachment_data = attData;
                  curTicket.attachment_name = attName;
                  curTicket.attachment_type = attType;
                  curTicket.attachments = attachmentsList;
                  await keystoreTicketVault.upsertTicket(curTicket);
                }
              } catch {}
            }

            await apiClient.confirmRelayAck(item.id, item.attachment_r2_key);
          } catch (itemErr) {
            console.warn('[HelpDeskTicketService] Failed to process transient message item:', itemErr);
          }
        }
        localMessages = await keystoreTicketVault.getMessages(cleanTicketId);
      }
    } catch (relayErr) {
      console.warn('[HelpDeskTicketService] Transient relay poll warning:', relayErr);
    }

    return localMessages.sort((a, b) => a.created_at - b.created_at);
  },

  /**
   * Creates a new ticket along with its first message and Zero-Knowledge credentials.
   */
  async createTicket(
    subject: string,
    message: string,
    attachment?: { data: string; name: string; type: string } | null,
    appId: string = CURRENT_APP_ID,
    category: string = 'general',
    isDiscussion: boolean = false,
    enterpriseBlindId?: string,
    orgId?: string
  ): Promise<string | null> {
    const ownWhiteId = await helpDeskAuthService.getOwnWhiteId();
    const ticketId = generateTicketId(isDiscussion);
    const messageId = 'msg_' + Math.random().toString(36).substring(2, 10);
    const now = Date.now();

    const blindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
    const [userEnt, adminEnt, localRole, customAlias] = await Promise.all([
      helpDeskAuthService.getUserEnterprise(blindId, true),
      helpDeskAuthService.getAdminEnterprise(blindId, true),
      SafeSecureStore.getItemAsync('inwhite_helpdesk_admin_role'),
      helpDeskAuthService.getCustomAlias(),
    ]);

    const finalEnterpriseBlindId = enterpriseBlindId || userEnt.enterpriseBlindId || adminEnt.enterpriseBlindId || undefined;
    const isUserAdmin = Boolean(localRole && localRole !== 'none');
    const senderAlias = customAlias || (isUserAdmin ? await helpDeskAuthService.getAdminAlias(blindId) : null);
    const entName = userEnt.enterpriseName || adminEnt.enterpriseName || BRAND.enterprise;

    const userPubKey = WhiteDeskCrypto.generateBlindId(blindId + '_pub').replace('blind_', '');
    const ephemeral = WhiteDeskCrypto.generateEphemeralKeyPair();
    const ticketPubKey = ephemeral.publicKeyHex;

    const attachmentsList = attachment
      ? (attachment.type === 'multi'
          ? (() => { try { return JSON.parse(attachment.data); } catch { return [attachment]; } })()
          : [attachment])
      : undefined;

    const newTicket: HelpDeskTicket = {
      id: ticketId,
      enterprise_blind_id: finalEnterpriseBlindId,
      enterprise_name: entName,
      org_id: orgId || userEnt.orgId || adminEnt.orgId || 'default',
      app_id: appId,
      user_white_id: blindId,
      user_blind_id: blindId,
      user_alias: senderAlias || undefined,
      user_pubkey: userPubKey,
      ticket_pubkey: ticketPubKey,
      subject,
      category: category && category.toLowerCase() !== 'voice' && category !== 'general' ? category : undefined,
      status: 'open',
      is_discussion: isDiscussion,
      attachment_data: attachment?.data || null,
      attachment_name: attachment?.name || null,
      attachment_type: attachment?.type || null,
      attachments: attachmentsList,
      assigned_at: now,
      created_at: now,
      updated_at: now,
    };

    const firstMsg: HelpDeskMessage = {
      id: messageId,
      ticket_id: ticketId,
      app_id: appId,
      sender_white_id: blindId,
      sender_alias: senderAlias,
      sender_blind_id: blindId,
      is_admin: isUserAdmin,
      sender_role: isUserAdmin ? 'admin' : null,
      message,
      attachment_data: attachment?.data || null,
      attachment_name: attachment?.name || null,
      attachment_type: attachment?.type || null,
      attachments: attachmentsList,
      created_at: now,
    };

    await keystoreTicketVault.upsertTicket(newTicket);
    await keystoreTicketVault.saveMessages(ticketId, [firstMsg]);

    void (async () => {
      try {
        let attachmentR2Key: string | null = null;
        if (attachment?.data) {
          console.log(`[HelpDeskTicketService] Offloading attachment to Cloudflare R2 (background)...`);
          const r2Upload = await apiClient.uploadRelayAttachmentBase64(
            attachment.data,
            attachment.type === 'multi'
              ? 'application/json'
              : (attachment.type === 'image' ? 'image/jpeg' : 'application/octet-stream')
          );
          if (r2Upload.success && r2Upload.r2_key) {
            attachmentR2Key = r2Upload.r2_key;
            console.log(`[HelpDeskTicketService] Attachment uploaded to R2 successfully:`, attachmentR2Key);
          } else {
            console.warn('[HelpDeskTicketService] R2 attachment upload warning:', r2Upload.error);
          }
        }

        let targetRecipientBlindId = finalEnterpriseBlindId || 'blind_thewhite_root';
        if (!isDiscussion && category !== 'root_support') {
          // Fetch enterprise SLA from Neon Postgres (whitedesk_enterprises)
          let tenantSlaMins = 30;
          try {
            const advCfg = await helpDeskLicenseService.getAdvancedFeaturesConfig(finalEnterpriseBlindId);
            if (advCfg?.escalation?.slaMinutes && advCfg.escalation.slaMinutes > 0) {
              tenantSlaMins = advCfg.escalation.slaMinutes;
            } else if (advCfg?.escalation?.slaHours && advCfg.escalation.slaHours > 0) {
              tenantSlaMins = advCfg.escalation.slaHours * 60;
            }
          } catch {}
          newTicket.sla_limit_minutes = tenantSlaMins;

          try {
            const alloc = await apiClient.allocateTicketAdmin({
              enterprise_blind_id: finalEnterpriseBlindId || 'default',
              category,
              org_id: orgId,
            });
            if (alloc && alloc.success && alloc.assigned_admin_blind_id && alloc.assigned_admin_blind_id !== 'unassigned') {
              targetRecipientBlindId = alloc.assigned_admin_blind_id;
              newTicket.assigned_admin_blind_id = alloc.assigned_admin_blind_id;
            } else {
              // Online admin bulunamadı -> Bilet havuzda (Atama Bekliyor)
              targetRecipientBlindId = finalEnterpriseBlindId || 'blind_thewhite_root';
              newTicket.assigned_admin_blind_id = 'unassigned';
            }
            await keystoreTicketVault.upsertTicket(newTicket);
          } catch (assignErr) {
            console.warn('[HelpDeskTicketService] load-balance assignment fallback:', assignErr);
            targetRecipientBlindId = finalEnterpriseBlindId || 'blind_thewhite_root';
            newTicket.assigned_admin_blind_id = 'unassigned';
            await keystoreTicketVault.upsertTicket(newTicket);
          }
        } else if (category === 'root_support') {
          // Strictly Confidential to TheWhite Root!
          targetRecipientBlindId = 'blind_thewhite_root';
        }

        const sanitizedAttachments = attachmentsList ? attachmentsList.map((a: any) => ({ name: a.name, type: a.type, data: '' })) : undefined;
        const relayPayload = JSON.stringify({
          type: 'ticket_header',
          ticket: {
            ...newTicket,
            attachment_data: null,
            attachment_name: attachment?.name || null,
            attachment_type: attachment?.type || null,
            attachment_r2_key: attachmentR2Key,
            attachments: sanitizedAttachments,
          },
          initial_message: {
            ...firstMsg,
            attachment_data: null,
            attachment_name: attachment?.name || null,
            attachment_type: attachment?.type || null,
            attachment_r2_key: attachmentR2Key,
            attachments: sanitizedAttachments,
          },
        });

        if (isDiscussion) {
          // 📡 Grill-Me Karar 1: Fan-Out Modeli (Sıfır İz / E2EE)
          // Tartışma mesajı şirketteki her admin için D1'e ayrı bir şifreli kopya olarak atılır.
          // Her admin kendi kopyasını çektiğinde ACK ile buharlaştırır. Sıfır sunucu izi!
          try {
            const entAdmins = await helpDeskStationService.getEnterpriseAdmins(finalEnterpriseBlindId);
            for (const adm of entAdmins) {
              if (adm.blind_id && adm.blind_id !== blindId) {
                console.log(`[HelpDeskTicketService] Fanning out discussion header to admin: ${adm.blind_id}`);
                await apiClient.sendRelayMessage({
                  ticket_id: ticketId,
                  recipient_blind_id: adm.blind_id,
                  sender_blind_id: blindId,
                  encrypted_payload: relayPayload,
                  attachment_r2_key: attachmentR2Key,
                });
              }
            }
          } catch (fanErr) {
            console.warn('[HelpDeskTicketService] discussion fan-out error:', fanErr);
          }
        } else {
          console.log(`[HelpDeskTicketService] Sending ticket relay -> recipient: ${targetRecipientBlindId}, sender: ${blindId}, ticket: ${ticketId}`);
          const relayRes = await apiClient.sendRelayMessage({
            ticket_id: ticketId,
            recipient_blind_id: targetRecipientBlindId,
            sender_blind_id: blindId,
            encrypted_payload: relayPayload,
            attachment_r2_key: attachmentR2Key,
          });
          console.log(`[HelpDeskTicketService] Ticket relay response:`, relayRes);

          try {
            let pushTargetBlindId = targetRecipientBlindId;
            if (!pushTargetBlindId || !/^([0-9a-f]{60}|blind_)/i.test(pushTargetBlindId) || pushTargetBlindId === 'blind_thewhite_root') {
              pushTargetBlindId = await helpDeskAuthService.getAdminWhiteId();
            }
            if (pushTargetBlindId && pushTargetBlindId.toLowerCase() !== blindId.toLowerCase()) {
              await apiClient.sendHelpDeskPushNotification(
                pushTargetBlindId,
                blindId,
                {
                  titleTr: i18nService.t('ticket_service.push_new_ticket_title'),
                  titleEn: i18nService.t('ticket_service.push_new_ticket_title_en'),
                  bodyTr: `${senderAlias || i18nService.t('ticket_service.default_user_alias')}: ${subject}`,
                  bodyEn: `${senderAlias || i18nService.t('ticket_service.default_user_alias_en')}: ${subject}`,
                  ticketId,
                }
              );
            }
          } catch {}
        }
      } catch (e) {
        console.warn('[HelpDeskTicketService] createTicket relay warning:', e);
      }
    })();

    return ticketId;
  },

  /**
   * Starts a new Admin Discussion
   */
  async createDiscussion(
    subject: string,
    message: string,
    attachment?: { data: string; name: string; type: string } | null,
    appId: string = CURRENT_APP_ID,
    orgId: string = 'default',
    enterpriseBlindId?: string
  ): Promise<string | null> {
    let resolvedOrgId = orgId;
    let resolvedEnterpriseBlindId = enterpriseBlindId;
    let cleanSubject = subject;

    if (subject.toLowerCase().startsWith('/admin')) {
      cleanSubject = subject.substring(6).trim();
      resolvedOrgId = 'all_admins';
      resolvedEnterpriseBlindId = undefined;
    } else if (subject.startsWith('@')) {
      const atEndIdx = subject.indexOf(' ');
      const target = atEndIdx > 0 ? subject.substring(1, atEndIdx) : subject.substring(1);
      cleanSubject = atEndIdx > 0 ? subject.substring(atEndIdx + 1).trim() : '';

      const isTenantId = target.length >= 32 && /^[a-fA-F0-9]+$/.test(target);
      if (isTenantId) {
        resolvedEnterpriseBlindId = target;
        resolvedOrgId = 'default';
      } else {
        resolvedOrgId = `@${target}`;
        resolvedEnterpriseBlindId = enterpriseBlindId;
      }
    }

    return await this.createTicket(
      cleanSubject || subject,
      message,
      attachment,
      appId,
      'discussion',
      true,
      resolvedEnterpriseBlindId,
      resolvedOrgId
    );
  },

  /**
   * Deletes a single ticket and all associated messages from Keystore and notifies D1 relay.
   */
  async deleteTicket(ticketId: string | number): Promise<boolean> {
    const cleanId = String(ticketId).trim();
    try {
      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      await keystoreTicketVault.deleteTicket(cleanId);

      if (target) {
        try {
          const ownWhiteId = await helpDeskAuthService.getOwnWhiteId();
          const blindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
          const isAdmin = await helpDeskAuthService.checkIfAdmin(ownWhiteId);
          const targetBlindId = isAdmin
            ? (target.user_blind_id || 'blind_unknown')
            : (target.enterprise_blind_id || 'blind_thewhite_root');

          await apiClient.sendRelayMessage({
            ticket_id: cleanId,
            recipient_blind_id: targetBlindId,
            sender_blind_id: blindId,
            encrypted_payload: JSON.stringify({
              type: 'ticket_delete',
              ticket_id: cleanId,
            }),
          });
        } catch {}
      }
      return true;
    } catch (e) {
      console.warn('[HelpDeskTicketService] deleteTicket error:', e);
      return false;
    }
  },

  /**
   * Adds a reply to an existing ticket.
   */
  async replyToTicket(
    ticketId: string,
    message: string,
    isAdmin: boolean,
    attachment?: { data: string; name: string; type: string } | null,
    appId: string = CURRENT_APP_ID
  ): Promise<boolean> {
    const ownWhiteId = await helpDeskAuthService.getOwnWhiteId();
    const messageId = 'msg_' + Math.random().toString(36).substring(2, 10);
    const now = Date.now();
    const customAlias = await helpDeskAuthService.getCustomAlias();
    const senderAlias = customAlias || (isAdmin ? await helpDeskAuthService.getAdminAlias(ownWhiteId) : null);
    const blindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);

    // Seviye 3 (Fısıltı: @[rumuz]) veya Seviye 2 (Dahili Not) Ayrımı
    let isWhisper = false;
    let whisperTargetAlias: string | null = null;
    let whisperTargetBlindId: string | null = null;
    let whisperTargetWhiteId: string | null = null;
    let isInternal = false;
    let effectiveMessage = message;

    if (isAdmin) {
      const atMatch = message.trim().match(/^@\[?([a-zA-Z0-9_\-\.]+)\]?\s*(.*)$/s);
      if (atMatch && atMatch[1]) {
        const queryAlias = atMatch[1].trim().toLowerCase();
        try {
          const entAdmins = await helpDeskStationService.getEnterpriseAdmins();
          const targetAdmin = entAdmins.find((a: any) => 
            a.alias.toLowerCase() === queryAlias ||
            a.blind_id.toLowerCase().includes(queryAlias) ||
            a.white_id.toLowerCase().includes(queryAlias)
          );
          if (targetAdmin) {
            isWhisper = true;
            whisperTargetAlias = targetAdmin.alias;
            whisperTargetBlindId = targetAdmin.blind_id;
            whisperTargetWhiteId = targetAdmin.white_id;
            effectiveMessage = atMatch[2] ? atMatch[2].trim() : message;
          }
        } catch {}
      } else if (
        message.trim().startsWith('!not ') ||
        message.trim().startsWith('/not ') ||
        message.trim().startsWith('#not ')
      ) {
        isInternal = true;
        effectiveMessage = message.trim().replace(/^(!not|\/not|#not)\s+/i, '');
      }
    }

    const attachmentsList = attachment
      ? (attachment.type === 'multi'
          ? (() => { try { return JSON.parse(attachment.data); } catch { return [attachment]; } })()
          : [attachment])
      : undefined;

    const newEntry: HelpDeskMessage = {
      id: messageId,
      ticket_id: ticketId,
      app_id: appId,
      sender_white_id: blindId,
      sender_alias: senderAlias,
      sender_blind_id: blindId,
      is_admin: isAdmin,
      sender_role: isAdmin ? ((role => (role === 'none' ? null : role))(await helpDeskAuthService.getAdminRole(blindId))) : null,
      message: effectiveMessage,
      visibility_level: isWhisper ? 'whisper' : (isInternal ? 'internal' : 'customer'),
      is_whisper: isWhisper,
      whisper_target_alias: whisperTargetAlias,
      whisper_target_blind_id: whisperTargetBlindId,
      whisper_target_white_id: whisperTargetBlindId,
      is_internal: isInternal,
      attachment_data: attachment?.data || null,
      attachment_name: attachment?.name || null,
      attachment_type: attachment?.type || null,
      attachments: attachmentsList,
      created_at: now,
    };

    await keystoreTicketVault.appendMessage(ticketId, newEntry);

    const allTickets = await keystoreTicketVault.getTickets();
    const target = allTickets.find(t => t.id === ticketId);
    if (target) {
      target.status = isAdmin ? 'answered' : 'open';
      target.updated_at = now;
      if (isAdmin) {
        target.last_admin_reply_at = now;
        target.assigned_admin_blind_id = blindId;
      }
      await keystoreTicketVault.upsertTicket(target);
    }

    void (async () => {
      try {
        let attachmentR2Key: string | null = null;
        if (attachment?.data) {
          console.log(`[HelpDeskTicketService] Offloading reply attachment to Cloudflare R2 (background)...`);
          const r2Upload = await apiClient.uploadRelayAttachmentBase64(
            attachment.data,
            attachment.type === 'multi'
              ? 'application/json'
              : (attachment.type === 'image' ? 'image/jpeg' : 'application/octet-stream')
          );
          if (r2Upload.success && r2Upload.r2_key) {
            attachmentR2Key = r2Upload.r2_key;
            console.log(`[HelpDeskTicketService] Reply attachment uploaded to R2:`, attachmentR2Key);
          } else {
            console.warn('[HelpDeskTicketService] R2 reply attachment upload warning:', r2Upload.error);
          }
        }

        // Hedef Blind ID Belirleme (Kullanıcıya Sıfır Sızıntı İlkesi!)
        let targetBlindId: string;
        if (isWhisper && whisperTargetBlindId) {
          targetBlindId = whisperTargetBlindId; // Sadece hedef admine gider
        } else if (target?.category === 'root_support') {
          // Strictly Confidential Root Support
          targetBlindId = isAdmin ? 'blind_thewhite_root' : (target?.user_blind_id || 'blind_unknown');
        } else if (isInternal) {
          targetBlindId = target?.enterprise_blind_id || 'blind_thewhite_root'; // Masa havuzuna gider, müşteriye asla gitmez
        } else {
          targetBlindId = isAdmin
            ? WhiteDeskCrypto.generateBlindId(target?.user_blind_id || target?.user_white_id || 'blind_unknown')
            : (target?.assigned_admin_blind_id && target.assigned_admin_blind_id !== 'unassigned'
                ? WhiteDeskCrypto.generateBlindId(target.assigned_admin_blind_id)
                : (target?.enterprise_blind_id || 'blind_thewhite_root'));
        }

        const sanitizedAttachments = attachmentsList ? attachmentsList.map((a: any) => ({ name: a.name, type: a.type, data: '' })) : undefined;
        const relayPayload = JSON.stringify({
          type: 'ticket_reply',
          ticket_id: ticketId,
          status: target ? target.status : (isAdmin ? 'answered' : 'open'),
          updated_at: now,
          message: {
            ...newEntry,
            attachment_data: null,
            attachment_name: attachment?.name || null,
            attachment_type: attachment?.type || null,
            attachment_r2_key: attachmentR2Key,
            attachments: sanitizedAttachments,
          },
        });

        if (target?.is_discussion) {
          // 📡 Grill-Me Karar 1: Fan-Out Modeli (Sıfır İz / E2EE) for discussion replies
          try {
            const entAdmins = await helpDeskStationService.getEnterpriseAdmins(target.enterprise_blind_id);
            for (const adm of entAdmins) {
              if (adm.blind_id && adm.blind_id !== blindId) {
                await apiClient.sendRelayMessage({
                  ticket_id: ticketId,
                  recipient_blind_id: adm.blind_id,
                  sender_blind_id: blindId,
                  encrypted_payload: relayPayload,
                  attachment_r2_key: attachmentR2Key,
                });
              }
            }
          } catch (fanErr) {
            console.warn('[HelpDeskTicketService] discussion reply fan-out error:', fanErr);
          }
        } else {
          await apiClient.sendRelayMessage({
            ticket_id: ticketId,
            recipient_blind_id: targetBlindId,
            sender_blind_id: blindId,
            encrypted_payload: relayPayload,
            attachment_r2_key: attachmentR2Key,
          });
        }

        try {
          let targetWhiteId: string | null = null;
          let titleTr = i18nService.t('ticket_service.push_support_title');
          let titleEn = i18nService.t('ticket_service.push_support_title_en');
          let bodyTr = i18nService.t('ticket_service.push_support_message_body');
          let bodyEn = i18nService.t('ticket_service.push_support_message_body_en');

          if (isWhisper && whisperTargetBlindId) {
            targetWhiteId = WhiteDeskCrypto.generateBlindId(whisperTargetBlindId);
            titleTr = i18nService.t('ticket_service.push_whisper_title');
            titleEn = i18nService.t('ticket_service.push_whisper_title_en');
            bodyTr = i18nService.t('ticket_service.push_whisper_body', {
              sender: senderAlias || i18nService.t('ticket_service.push_whisper_default_admin'),
              ticketId,
            });
            bodyEn = i18nService.t('ticket_service.push_whisper_body_en', {
              sender: senderAlias || i18nService.t('ticket_service.push_whisper_default_admin_en'),
              ticketId,
            });
          } else if (isInternal) {
            targetWhiteId = null; // Dahili not müşteriye push bildirimi olarak ASLA gitmez
          } else if (isAdmin) {
            const rawUserTarget = target?.user_blind_id || target?.user_white_id;
            if (rawUserTarget) {
              targetWhiteId = WhiteDeskCrypto.generateBlindId(rawUserTarget.trim());
            }
          } else {
            const assignedAdmin = target?.assigned_admin_blind_id;
            targetWhiteId = (assignedAdmin && assignedAdmin !== 'unassigned')
              ? WhiteDeskCrypto.generateBlindId(assignedAdmin)
              : await helpDeskAuthService.getAdminWhiteId();
            bodyTr = i18nService.t('ticket_service.push_user_message_body');
            bodyEn = i18nService.t('ticket_service.push_user_message_body_en');
          }

          if (targetWhiteId && targetWhiteId.toLowerCase() !== blindId.toLowerCase()) {
            await apiClient.sendHelpDeskPushNotification(
              targetWhiteId,
              blindId,
              {
                titleTr,
                titleEn,
                bodyTr,
                bodyEn,
                ticketId,
              }
            );
          }
        } catch (pushErr) {
          console.warn('[HelpDeskTicketService] reply push notice:', pushErr);
        }
      } catch (e) {
        console.warn('[HelpDeskTicketService] replyToTicket background relay warning:', e);
      }
    })();

    return true;
  },

  /**
   * Updates ticket status in Keystore and relays to D1.
   */
  async setTicketStatus(ticketId: string, status: TicketStatus, resolutionNote?: string): Promise<boolean> {
    const cleanId = String(ticketId).trim();
    const now = Date.now();
    try {
      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      if (target) {
        target.status = status;
        target.updated_at = now;
        if (resolutionNote !== undefined) target.resolution_note = resolutionNote;
        await keystoreTicketVault.upsertTicket(target);

        void (async () => {
          try {
            const ownWhiteId = await helpDeskAuthService.getOwnWhiteId();
            const blindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
            const isAdmin = await helpDeskAuthService.checkIfAdmin(ownWhiteId);
            const targetBlindId = isAdmin
              ? (target.user_blind_id || 'blind_unknown')
              : (target.enterprise_blind_id || 'blind_thewhite_root');

            await apiClient.sendRelayMessage({
              ticket_id: cleanId,
              recipient_blind_id: targetBlindId,
              sender_blind_id: blindId,
              encrypted_payload: JSON.stringify({
                type: 'ticket_status_update',
                ticket_id: cleanId,
                status,
                resolution_note: resolutionNote,
              }),
            });

            // Completion Hook: Admin bilet kapattığında havuzda bekleyen sıradaki bilet varsa otomatik olarak bu admine atanır
            if (isAdmin && status === 'closed') {
              try {
                const claimRes = await apiClient.claimNextPoolTicket({
                  enterprise_blind_id: target.enterprise_blind_id || 'default',
                  admin_blind_id: blindId,
                  admin_name: ownWhiteId,
                });
                if (claimRes && claimRes.claimed && claimRes.item) {
                  console.log(`[HelpDeskTicketService] Auto-claimed next pool ticket upon completion: ${claimRes.ticket_id}`);
                  try {
                    const payload = JSON.parse(claimRes.item.encrypted_payload);
                    if (payload.ticket) {
                      payload.ticket.is_relay_pending = false;
                      await keystoreTicketVault.upsertTicket(payload.ticket);
                      if (payload.initial_message) {
                        await keystoreTicketVault.appendMessage(payload.ticket.id, payload.initial_message);
                      }
                    }
                  } catch (parseErr) {
                    console.warn('[HelpDeskTicketService] Ingest claimed pool ticket error:', parseErr);
                  }
                }
              } catch (claimErr) {
                console.warn('[HelpDeskTicketService] Auto-claim pool error:', claimErr);
              }
            }
          } catch {}
        })();
      }
      return true;
    } catch (e) {
      console.warn('[HelpDeskTicketService] setTicketStatus error:', e);
      return false;
    }
  },

  async editMessage(
    messageId: string,
    newMessage: string,
    attachment?: { data: string; name: string; type: string } | null,
    ticketId?: string
  ): Promise<boolean> {
    try {
      if (ticketId) {
        const msgs = await keystoreTicketVault.getMessages(ticketId);
        const target = msgs.find(m => m.id === messageId);
        if (target) {
          target.message = newMessage;
          if (attachment) {
            target.attachment_data = attachment.data;
            target.attachment_name = attachment.name;
            target.attachment_type = attachment.type;
            target.attachments = [attachment];
          }
          await keystoreTicketVault.saveMessages(ticketId, msgs);
          return true;
        }
      }
      return true;
    } catch (e) {
      console.warn('[HelpDeskTicketService] editMessage error:', e);
      return false;
    }
  },

  /**
   * Reassigns a ticket and binds its user to a specific org and/or app.
   */
  async reassignTicketAndUserOrgApp(params: {
    ticketId: string;
    userBlindId: string;
    enterpriseBlindId?: string;
    orgId: string;
    appId?: string;
  }): Promise<boolean> {
    const { ticketId, userBlindId, enterpriseBlindId, orgId, appId } = params;
    const cleanOrg = orgId || 'default';
    const cleanApp = appId || 'inwhite';
    const cleanEnt = enterpriseBlindId || 'default';

    try {
      try {
        const localTickets = await keystoreTicketVault.getTickets();
        const target = localTickets.find(t => t.id === ticketId);
        if (target) {
          target.org_id = cleanOrg;
          target.app_id = cleanApp;
          target.updated_at = Date.now();
          await keystoreTicketVault.upsertTicket(target);
        }
      } catch {}

      if (userBlindId) {
        await executeSql(`
          INSERT INTO whitedesk_user_bindings (user_blind_id, tenant_blind_id, org_id, app_id, status, created_at)
          VALUES (
            ${escapeSqlString(userBlindId)},
            ${escapeSqlString(cleanEnt === 'all' ? 'default' : cleanEnt)},
            ${escapeSqlString(cleanOrg)},
            ${escapeSqlString(cleanApp)},
            'active',
            NOW()
          )
          ON CONFLICT (user_blind_id, tenant_blind_id, org_id) DO UPDATE 
            SET app_id = ${escapeSqlString(cleanApp)}, status = 'active';
        `);

        await executeSql(`
          UPDATE whitedesk_user_bindings
          SET org_id = ${escapeSqlString(cleanOrg)}, app_id = ${escapeSqlString(cleanApp)}
          WHERE user_blind_id = ${escapeSqlString(userBlindId)} AND tenant_blind_id = ${escapeSqlString(cleanEnt)};
        `);
      }

      return true;
    } catch (e) {
      console.warn('[HelpDeskTicketService] reassignTicketAndUserOrgApp error:', e);
      return false;
    }
  },

  async resolveTicketByUser(ticketId: string, resolutionNote?: string): Promise<boolean> {
    try {
      const cleanId = String(ticketId).trim();
      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      if (target) {
        target.status = 'closed';
        target.resolution_note = resolutionNote || target.resolution_note;
        target.updated_at = Date.now();
        await keystoreTicketVault.upsertTicket(target);

        try {
          const recipientBlindId = target.user_blind_id || target.enterprise_blind_id || 'default';
          await apiClient.sendRelayMessage({
            ticket_id: cleanId,
            sender_blind_id: 'status_updater',
            recipient_blind_id: recipientBlindId,
            encrypted_payload: JSON.stringify({
              type: 'ticket_status_update',
              ticket_id: cleanId,
              status: 'closed',
              resolution_note: resolutionNote,
            }),
          });
        } catch {}
      }
      return true;
    } catch (e) {
      console.warn('[HelpDeskTicketService] resolveTicketByUser error:', e);
      return false;
    }
  },

  async startTicketSelfDestruct(ticketId: string, days: number = 7): Promise<{ success: boolean; expiryMs: number }> {
    try {
      const cleanId = String(ticketId).trim();
      const now = Date.now();
      const expiryMs = now + days * 24 * 3600 * 1000;
      const note = `TTL_${days}D_${expiryMs}`;
      
      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      if (target) {
        target.status = 'closed';
        target.resolution_note = note;
        target.auto_delete_at = expiryMs;
        target.updated_at = now;
        await keystoreTicketVault.upsertTicket(target);

        try {
          const recipientBlindId = target.user_blind_id || target.enterprise_blind_id || 'default';
          await apiClient.sendRelayMessage({
            ticket_id: cleanId,
            sender_blind_id: 'status_updater',
            recipient_blind_id: recipientBlindId,
            encrypted_payload: JSON.stringify({
              type: 'ticket_status_update',
              ticket_id: cleanId,
              status: 'closed',
              resolution_note: note,
            }),
          });
        } catch {}
      }
      await SafeSecureStore.setItemAsync(`ticket_ttl_expiry_${cleanId}`, expiryMs.toString());
      return { success: true, expiryMs };
    } catch (e) {
      console.warn('[HelpDeskTicketService] startTicketSelfDestruct error:', e);
      return { success: false, expiryMs: 0 };
    }
  },

  async cancelTicketSelfDestruct(ticketId: string): Promise<boolean> {
    try {
      const cleanId = String(ticketId).trim();
      const now = Date.now();
      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      if (target) {
        target.status = 'open';
        target.resolution_note = undefined;
        target.auto_delete_at = undefined;
        target.updated_at = now;
        await keystoreTicketVault.upsertTicket(target);

        try {
          const recipientBlindId = target.user_blind_id || target.enterprise_blind_id || 'default';
          await apiClient.sendRelayMessage({
            ticket_id: cleanId,
            sender_blind_id: 'status_updater',
            recipient_blind_id: recipientBlindId,
            encrypted_payload: JSON.stringify({
              type: 'ticket_status_update',
              ticket_id: cleanId,
              status: 'open',
            }),
          });
        } catch {}
      }
      await SafeSecureStore.deleteItemAsync(`ticket_ttl_expiry_${cleanId}`);
      await SafeSecureStore.deleteItemAsync(`admin_vault_ttl_${cleanId}`);
      return true;
    } catch (e) {
      console.warn('[HelpDeskTicketService] cancelTicketSelfDestruct error:', e);
      return false;
    }
  },

  async startAdminVaultSelfDestruct(ticketId: string, days: number = 7): Promise<{ success: boolean; expiryMs: number }> {
    try {
      const cleanId = String(ticketId).trim();
      const now = Date.now();
      const expiryMs = now + days * 24 * 3600 * 1000;
      await SafeSecureStore.setItemAsync(`admin_vault_ttl_${cleanId}`, expiryMs.toString());
      return { success: true, expiryMs };
    } catch (e) {
      console.warn('[HelpDeskTicketService] startAdminVaultSelfDestruct error:', e);
      return { success: false, expiryMs: 0 };
    }
  },

  async scheduleTicketAutoDelete(ticketId: string | number, hours: number = 72): Promise<boolean> {
    const cleanId = String(ticketId).trim();
    const deleteAt = Date.now() + (hours * 60 * 60 * 1000);
    const note = `TTL_${Math.max(1, Math.round(hours / 24))}D_${deleteAt}`;
    try {
      await SafeSecureStore.setItemAsync(`ticket_ttl_expiry_${cleanId}`, deleteAt.toString());
      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      if (target) {
        target.auto_delete_at = deleteAt;
        target.resolution_note = note;
        target.updated_at = Date.now();
        await keystoreTicketVault.upsertTicket(target);
      }
      return true;
    } catch (e) {
      console.warn('[HelpDeskTicketService] scheduleTicketAutoDelete error:', e);
      return true;
    }
  },

  async cancelTicketAutoDelete(ticketId: string | number): Promise<boolean> {
    const cleanId = String(ticketId).trim();
    try {
      await SafeSecureStore.deleteItemAsync(`ticket_ttl_expiry_${cleanId}`);
      await SafeSecureStore.deleteItemAsync(`admin_vault_ttl_${cleanId}`);
      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      if (target) {
        target.auto_delete_at = undefined;
        target.resolution_note = undefined;
        target.updated_at = Date.now();
        await keystoreTicketVault.upsertTicket(target);
      }
      return true;
    } catch (e) {
      console.warn('[HelpDeskTicketService] cancelTicketAutoDelete error:', e);
      return true;
    }
  },

  async closeTicketWithDelay(ticketId: string, delayHours: number = 2): Promise<{ success: boolean; note: string }> {
    try {
      const cleanId = String(ticketId).trim();
      const now = Date.now();
      const ratingDueAt = now + delayHours * 3600 * 1000;
      const meta = {
        closed_at: now,
        rating_due_at: ratingDueAt,
      };
      const note = JSON.stringify(meta);

      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      if (target) {
        target.status = 'closed';
        target.resolution_note = note;
        target.updated_at = now;
        await keystoreTicketVault.upsertTicket(target);

        try {
          const recipientBlindId = target.user_blind_id || target.enterprise_blind_id || 'default';
          await apiClient.sendRelayMessage({
            ticket_id: cleanId,
            sender_blind_id: 'status_updater',
            recipient_blind_id: recipientBlindId,
            encrypted_payload: JSON.stringify({
              type: 'ticket_status_update',
              ticket_id: cleanId,
              status: 'closed',
              resolution_note: note,
            }),
          });
        } catch {}
      }
      return { success: true, note };
    } catch (e) {
      console.warn('[HelpDeskTicketService] closeTicketWithDelay error:', e);
      return { success: false, note: '' };
    }
  },

  async submitRatingWithDelay(
    ticketId: string,
    enterpriseBlindId: string,
    adminBlindId: string,
    score: number,
    comment?: string,
    orgId?: string,
    delayHours: number = 2
  ): Promise<{ success: boolean; note: string }> {
    try {
      const cleanId = String(ticketId).trim();
      const now = Date.now();
      await this.submitTicketRating(cleanId, enterpriseBlindId, adminBlindId, score, comment, orgId);
      const ttlStartDueAt = now + delayHours * 3600 * 1000;
      const meta = {
        rated_at: now,
        score,
        ttl_start_due_at: ttlStartDueAt,
      };
      const note = JSON.stringify(meta);

      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      if (target) {
        target.resolution_note = note;
        target.updated_at = now;
        await keystoreTicketVault.upsertTicket(target);
      }
      return { success: true, note };
    } catch (e) {
      console.warn('[HelpDeskTicketService] submitRatingWithDelay error:', e);
      return { success: false, note: '' };
    }
  },

  getTicketLifecycleStatus(ticket?: HelpDeskTicket | null, defaultDelayHours: number = 2): TicketLifecycleStatus {
    if (!ticket) return { stage: 'open', inDestruction: false };

    const computeRemaining = (expiryMs: number) => {
      const remainingMs = Math.max(0, expiryMs - Date.now());
      const remainingHours = Math.ceil(remainingMs / (3600 * 1000));
      const remainingDays = Math.max(1, Math.ceil(remainingHours / 24));
      const remainingText =
        remainingHours <= 48
          ? i18nService.t('ticket_service.remaining_hours_short', { hours: remainingHours })
          : i18nService.t('ticket_service.remaining_days_short', { days: remainingDays });
      return { remainingDays, remainingText };
    };

    if (ticket.auto_delete_at && Number(ticket.auto_delete_at) > 0) {
      const expiryMs = Number(ticket.auto_delete_at);
      const { remainingDays, remainingText } = computeRemaining(expiryMs);
      return { stage: 'self_destructing', inDestruction: true, expiryMs, remainingDays, remainingText };
    }

    const note = (ticket.resolution_note || '').trim();
    if (note.startsWith('TTL_')) {
      const match = note.match(/^TTL_(\d+)D_(\d+)$/);
      if (match) {
        const expiryMs = Number(match[2]);
        const { remainingDays, remainingText } = computeRemaining(expiryMs);
        return { stage: 'self_destructing', inDestruction: true, expiryMs, remainingDays, remainingText };
      }
    }

    if (ticket.status !== 'closed') return { stage: 'open', inDestruction: false };

    if (note.startsWith('{')) {
      try {
        const meta = JSON.parse(note);
        const now = Date.now();

        if (meta.ttl_expiry) {
          const { remainingDays, remainingText } = computeRemaining(meta.ttl_expiry);
          return {
            stage: 'self_destructing',
            inDestruction: true,
            closedAt: meta.closed_at,
            ratedAt: meta.rated_at,
            score: meta.score,
            expiryMs: meta.ttl_expiry,
            remainingDays,
            remainingText,
          };
        }

        if (meta.rated_at) {
          const ttlDue = meta.ttl_start_due_at || (meta.rated_at + defaultDelayHours * 3600 * 1000);
          if (now < ttlDue) {
            return {
              stage: 'rated_cooling',
              inDestruction: false,
              closedAt: meta.closed_at,
              ratedAt: meta.rated_at,
              score: meta.score,
              ttlStartDueAt: ttlDue,
            };
          } else {
            const exp = ttlDue + 7 * 24 * 3600 * 1000;
            const { remainingDays, remainingText } = computeRemaining(exp);
            return {
              stage: 'self_destructing',
              inDestruction: true,
              closedAt: meta.closed_at,
              ratedAt: meta.rated_at,
              score: meta.score,
              expiryMs: exp,
              remainingDays,
              remainingText,
            };
          }
        }

        if (meta.closed_at) {
          const ratingDue = meta.rating_due_at || (meta.closed_at + defaultDelayHours * 3600 * 1000);
          if (now < ratingDue) {
            return {
              stage: 'closed_cooling',
              inDestruction: false,
              closedAt: meta.closed_at,
              ratingDueAt: ratingDue,
            };
          } else {
            return {
              stage: 'rating_pending',
              inDestruction: false,
              closedAt: meta.closed_at,
              ratingDueAt: ratingDue,
            };
          }
        }
      } catch (e) {}
    }

    return { stage: 'closed_cooling', inDestruction: false, closedAt: ticket.updated_at };
  },

  getTicketSelfDestructInfo(ticket?: HelpDeskTicket | null): { inDestruction: boolean; expiryMs?: number; remainingDays?: number; remainingText?: string } {
    if (!ticket) return { inDestruction: false };
    const lifecycle = this.getTicketLifecycleStatus(ticket);
    if (lifecycle.inDestruction && lifecycle.expiryMs) {
      return {
        inDestruction: true,
        expiryMs: lifecycle.expiryMs,
        remainingDays: lifecycle.remainingDays,
        remainingText: lifecycle.remainingText,
      };
    }
    return { inDestruction: false };
  },

  async submitTicketRating(
    ticketId: string,
    enterpriseBlindId: string,
    adminBlindId: string,
    score: number,
    feedbackNote?: string,
    orgId?: string
  ): Promise<boolean> {
    try {
      const now = Date.now();
      const clampedScore = Math.max(1, Math.min(5, Math.round(score)));
      const safeNote = feedbackNote ? feedbackNote.trim().substring(0, 250) : '';

      const q = `
        INSERT INTO whitedesk_ticket_ratings (ticket_id, enterprise_blind_id, admin_blind_id, score, feedback_note, org_id, created_at)
        VALUES (${escapeSqlString(ticketId)}, ${escapeSqlString(enterpriseBlindId)}, ${escapeSqlString(adminBlindId)}, ${clampedScore}, ${escapeSqlString(safeNote, true)}, ${escapeSqlString(orgId, true)}, ${now});
      `;
      await executeSql(q);
      return true;
    } catch (e) {
      console.warn('[HelpDeskTicketService] submitTicketRating error:', e);
      return false;
    }
  },

  async getAdminRatingsOverview(
    enterpriseBlindId: string,
    isSystemWide: boolean = false,
    filterOrgId?: string,
    filterAppId?: string
  ): Promise<{
    kpis: {
      averageScore: number;
      totalRatings: number;
      activeAdminsCount: number;
      totalTickets: number;
      openTickets: number;
      closedTickets: number;
      scoreDistribution: {
        high: number;
        neutral: number;
        low: number;
      };
      avgResponseMinutes: number;
      slaComplianceRate: number;
      slaBreachCount: number;
      onTimeScore: number;
    };
    admins: Array<{
      adminBlindId: string;
      orgId: string;
      resolvedCount: number;
      averageScore: number;
      highRatingCount: number;
      successRate: number;
      latestNotes: string[];
      status: string;
      avgResponseMinutes: number;
      slaComplianceRate: number;
      slaBreachCount: number;
      grade: string;
      assignedCount: number;
    }>;
  }> {
    try {
      const isAll = isSystemWide || enterpriseBlindId === 'all' || enterpriseBlindId === 'blind_11fcac28453c3eaa3a06a5db6caf4ca1';
      const qRatings = isAll ? `
        SELECT r.admin_blind_id, r.score, r.feedback_note, r.org_id, r.created_at
        FROM whitedesk_ticket_ratings r
        ORDER BY r.created_at DESC;
      ` : `
        SELECT r.admin_blind_id, r.score, r.feedback_note, r.org_id, r.created_at
        FROM whitedesk_ticket_ratings r
        WHERE r.enterprise_blind_id = ${escapeSqlString(enterpriseBlindId)}
        ORDER BY r.created_at DESC;
      `;
      const ratings = await executeSql(qRatings);

      const qAdmins = isAll ? `
        SELECT a.white_id, a.alias, a.role, a.is_active
        FROM whitedesk_admins a;
      ` : `
        SELECT a.white_id, a.alias, a.role, a.is_active
        FROM whitedesk_admins a
        WHERE a.enterprise_blind_id = ${escapeSqlString(enterpriseBlindId)};
      `;
      const admins = await executeSql(qAdmins);

      let totalTickets = 0;
      let openTickets = 0;
      let closedTickets = 0;
      let tenantTickets: any[] = [];
      let totalResponseLatencyMinutes = 0;
      let respondedTicketCount = 0;
      let totalSlaBreaches = 0;

      try {
        const allTickets = await keystoreTicketVault.getTickets();
        tenantTickets = isAll 
          ? allTickets 
          : allTickets.filter(t => t.enterprise_blind_id === enterpriseBlindId);

        if (filterOrgId && filterOrgId !== 'all') {
          tenantTickets = tenantTickets.filter(t => (t.org_id === filterOrgId || (t as any).organization_id === filterOrgId));
        }
        if (filterAppId && filterAppId !== 'all') {
          tenantTickets = tenantTickets.filter(t => (t.app_id === filterAppId || (t as any).application_id === filterAppId));
        }

        totalTickets = tenantTickets.length;
        for (const t of tenantTickets) {
          if (t.status === 'closed') {
            closedTickets++;
          } else {
            openTickets++;
          }

          // Measure response latency
          if (t.last_admin_reply_at && t.created_at && t.last_admin_reply_at > t.created_at) {
            const latency = Math.max(1, Math.round((t.last_admin_reply_at - t.created_at) / 60000));
            totalResponseLatencyMinutes += latency;
            respondedTicketCount++;
          }

          // SLA Breach check
          const isBreached = t.sla_breached === true || 
            t.revocation_reason === 'sla_timeout' || 
            (typeof t.escalation_stage === 'number' && t.escalation_stage > 0) ||
            (t.sla_deadline && Date.now() > t.sla_deadline && t.status !== 'closed' && !t.last_admin_reply_at);
          if (isBreached) {
            totalSlaBreaches++;
          }
        }
      } catch (err) {
        console.warn('[HelpDeskTicketService] ticket count error:', err);
      }

      const overallAvgResponseMinutes = respondedTicketCount > 0 
        ? Math.round(totalResponseLatencyMinutes / respondedTicketCount) 
        : 14;
      const overallSlaComplianceRate = totalTickets > 0 
        ? Math.max(0, Math.min(100, Math.round(((totalTickets - totalSlaBreaches) / totalTickets) * 100))) 
        : 100;
      const onTimeScore = Number(((overallSlaComplianceRate / 100) * 10).toFixed(1));

      let totalScore = 0;
      let highCount = 0;
      let neutralCount = 0;
      let lowCount = 0;
      const adminMap: Record<string, { scores: number[]; notes: string[]; orgId: string }> = {};

      let effectiveRatings = ratings;
      if (filterOrgId && filterOrgId !== 'all') {
        effectiveRatings = ratings.filter((r: any) => r.org_id === filterOrgId);
      }

      for (const row of effectiveRatings) {
        const aId = String(row.admin_blind_id || 'admin_default');
        const sc = Number(row.score) || 5;
        totalScore += sc;
        if (sc >= 4) highCount++;
        else if (sc === 3) neutralCount++;
        else lowCount++;

        if (!adminMap[aId]) {
          adminMap[aId] = {
            scores: [],
            notes: [],
            orgId: row.org_id ? String(row.org_id) : i18nService.t('ticket_service.general_support_org'),
          };
        }
        adminMap[aId].scores.push(sc);
        if (row.feedback_note && row.feedback_note.trim()) {
          adminMap[aId].notes.push(String(row.feedback_note).trim());
        }
      }

      const totalRatingsCount = effectiveRatings.length;
      const avgScore = totalRatingsCount > 0 ? Number((totalScore / totalRatingsCount).toFixed(1)) : 5.0;

      const adminList = admins.map((adm: any) => {
        const aId = String(adm.white_id);
        const data = adminMap[aId] || {
          scores: [],
          notes: [],
          orgId: i18nService.t('ticket_service.general_support_org'),
        };
        const highSc = data.scores.filter(s => s >= 4).length;
        const aAvg = data.scores.length > 0
          ? Number((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1))
          : 5.0;
        const sRate = data.scores.length > 0 ? Math.round((highSc / data.scores.length) * 100) : 100;

        // Per-admin SLA and response calculations
        const admAlias = String(adm.alias || '').toLowerCase();
        const admTickets = tenantTickets.filter(t => {
          const tAssignedBlind = String(t.assigned_admin_blind_id || '').toLowerCase();
          const tAssignedAlias = String(t.assigned_admin_alias || '').toLowerCase();
          const tAssignedName = String(t.assigned_admin_name || '').toLowerCase();
          return (
            (t.assigned_admin_blind_id && t.assigned_admin_blind_id === adm.white_id) ||
            (admAlias && (tAssignedAlias === admAlias || tAssignedName === admAlias || tAssignedBlind.includes(admAlias)))
          );
        });

        let admLatencySum = 0;
        let admRespondedCount = 0;
        let admBreaches = 0;

        for (const t of admTickets) {
          if (t.last_admin_reply_at && t.created_at && t.last_admin_reply_at > t.created_at) {
            admLatencySum += Math.max(1, Math.round((t.last_admin_reply_at - t.created_at) / 60000));
            admRespondedCount++;
          }
          if (
            t.sla_breached === true || 
            t.revocation_reason === 'sla_timeout' || 
            (typeof t.escalation_stage === 'number' && t.escalation_stage > 0)
          ) {
            admBreaches++;
          }
        }

        const admAvgResponse = admRespondedCount > 0 
          ? Math.round(admLatencySum / admRespondedCount) 
          : (admTickets.length > 0 ? 15 : 12);
        const admCompliance = admTickets.length > 0 
          ? Math.max(0, Math.min(100, Math.round(((admTickets.length - admBreaches) / admTickets.length) * 100))) 
          : 100;

        let grade = 'A+';
        if (admCompliance >= 95 && aAvg >= 4.5) grade = 'A+';
        else if (admCompliance >= 90 && aAvg >= 4.0) grade = 'A';
        else if (admCompliance >= 80) grade = 'B+';
        else if (admCompliance >= 70) grade = 'B';
        else grade = 'C';

        return {
          adminBlindId: adm.alias || aId.substring(0, 16),
          orgId: data.orgId,
          resolvedCount: data.scores.length,
          averageScore: aAvg,
          highRatingCount: highSc,
          successRate: sRate,
          latestNotes: data.notes.slice(0, 3),
          status:
            adm.is_active !== false
              ? i18nService.t('ticket_service.status_active')
              : i18nService.t('ticket_service.status_inactive'),
          avgResponseMinutes: admAvgResponse,
          slaComplianceRate: admCompliance,
          slaBreachCount: admBreaches,
          grade: grade,
          assignedCount: admTickets.length,
        };
      });

      return {
        kpis: {
          averageScore: avgScore,
          totalRatings: totalRatingsCount,
          activeAdminsCount: admins.length || 1,
          totalTickets,
          openTickets,
          closedTickets,
          scoreDistribution: {
            high: highCount,
            neutral: neutralCount,
            low: lowCount,
          },
          avgResponseMinutes: overallAvgResponseMinutes,
          slaComplianceRate: overallSlaComplianceRate,
          slaBreachCount: totalSlaBreaches,
          onTimeScore: onTimeScore,
        },
        admins: adminList,
      };
    } catch (e) {
      console.warn('[HelpDeskTicketService] getAdminRatingsOverview error:', e);
      return {
        kpis: {
          averageScore: 5.0,
          totalRatings: 0,
          activeAdminsCount: 1,
          totalTickets: 0,
          openTickets: 0,
          closedTickets: 0,
          scoreDistribution: { high: 0, neutral: 0, low: 0 },
          avgResponseMinutes: 14,
          slaComplianceRate: 100,
          slaBreachCount: 0,
          onTimeScore: 10.0,
        },
        admins: [],
      };
    }
  },

  /**
   * Adds or attaches a diagnostic package to an existing ticket and dispatches it via R2 + D1 Relay.
   */
  async attachDiagnosticToTicket(ticketId: string | number, diagPackage: any): Promise<boolean> {
    const cleanId = String(ticketId).trim();
    try {
      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      if (!target) return false;

      const now = Date.now();
      const diagFile = {
        name: 'diagnostics.whitedesk',
        type: 'diagnostic',
        mimeType: 'application/x-whitedesk-diagnostics',
        data: typeof diagPackage === 'string' ? diagPackage : JSON.stringify(diagPackage),
      };

      if (target.attachment_data && target.attachment_data.startsWith('[')) {
        try {
          const parsed = JSON.parse(target.attachment_data);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((f: any) => !f.name?.includes('diagnostics.whitedesk') && f.type !== 'diagnostic');
            filtered.push(diagFile);
            target.attachment_data = JSON.stringify(filtered);
            target.attachments = filtered;
          } else {
            target.attachment_data = JSON.stringify([diagFile]);
            target.attachments = [diagFile];
          }
        } catch {
          target.attachment_data = JSON.stringify([diagFile]);
          target.attachments = [diagFile];
        }
      } else if (target.attachment_data && target.attachment_type !== 'diagnostic' && !target.attachment_name?.includes('diagnostics.whitedesk')) {
        const combined = [
          {
            name: target.attachment_name || 'attachment.dat',
            type: target.attachment_type || 'document',
            data: target.attachment_data,
          },
          diagFile,
        ];
        target.attachment_data = JSON.stringify(combined);
        target.attachment_type = 'multi';
        target.attachments = combined;
      } else {
        target.attachment_name = diagFile.name;
        target.attachment_type = diagFile.type;
        target.attachment_data = diagFile.data;
        target.attachments = [diagFile];
      }

      target.updated_at = now;
      await keystoreTicketVault.upsertTicket(target);

      const ownWhiteId = await helpDeskAuthService.getOwnWhiteId();
      const isAdmin = await helpDeskAuthService.checkIfAdmin(ownWhiteId);
      const customAlias = await helpDeskAuthService.getCustomAlias();
      const senderAlias = customAlias || (isAdmin ? await helpDeskAuthService.getAdminAlias(ownWhiteId) : null);
      const blindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
      const messageId = 'msg_' + Math.random().toString(36).substring(2, 10);

      const newEntry: HelpDeskMessage = {
        id: messageId,
        ticket_id: cleanId,
        app_id: target.app_id || CURRENT_APP_ID,
        sender_white_id: blindId,
        sender_alias: senderAlias,
        sender_blind_id: blindId,
        is_admin: isAdmin,
        sender_role: isAdmin ? ((role => (role === 'none' ? null : role))(await helpDeskAuthService.getAdminRole(blindId))) : null,
        message: i18nService.t('ticket_service.diagnostic_attached_message'),
        attachment_data: diagFile.data,
        attachment_name: diagFile.name,
        attachment_type: diagFile.type,
        attachments: [diagFile],
        created_at: now,
      };

      await keystoreTicketVault.appendMessage(cleanId, newEntry);

      // Offload diagnostic package to Cloudflare R2 & dispatch via D1 Relay
      void (async () => {
        try {
          let attachmentR2Key: string | null = null;
          const r2Upload = await apiClient.uploadRelayAttachmentBase64(
            diagFile.data,
            'application/json'
          );
          if (r2Upload.success && r2Upload.r2_key) {
            attachmentR2Key = r2Upload.r2_key;
            target.attachment_r2_key = r2Upload.r2_key;
            await keystoreTicketVault.upsertTicket(target);
          }

          const targetBlindId = isAdmin
            ? (target.user_blind_id || 'blind_unknown')
            : (target.enterprise_blind_id || 'blind_thewhite_root');

          const sanitizedAttachments = [{ name: diagFile.name, type: diagFile.type, data: '' }];
          const relayPayload = JSON.stringify({
            type: 'ticket_reply',
            ticket_id: cleanId,
            status: target.status,
            updated_at: now,
            message: {
              ...newEntry,
              attachment_data: null,
              attachment_name: diagFile.name,
              attachment_type: diagFile.type,
              attachment_r2_key: attachmentR2Key,
              attachments: sanitizedAttachments,
            },
          });

          await apiClient.sendRelayMessage({
            ticket_id: cleanId,
            recipient_blind_id: targetBlindId,
            sender_blind_id: blindId,
            encrypted_payload: relayPayload,
            attachment_r2_key: attachmentR2Key,
          });
        } catch (err) {
          console.warn('[HelpDeskTicketService] attachDiagnosticToTicket relay warning:', err);
        }
      })();

      return true;
    } catch (e) {
      console.warn('[HelpDeskTicketService] attachDiagnosticToTicket error:', e);
      return false;
    }
  },

  /**
   * Deletes all diagnostic packages from a ticket and its messages, and notifies counterparty via D1 Relay.
   */
  async deleteTicketDiagnostics(ticketId: string | number): Promise<boolean> {
    const cleanId = String(ticketId).trim();
    try {
      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      if (target) {
        if (target.attachment_type === 'diagnostic' || target.attachment_name?.includes('diagnostics.whitedesk')) {
          target.attachment_name = null;
          target.attachment_type = null;
          target.attachment_data = null;
        } else if (target.attachment_data && target.attachment_data.startsWith('[')) {
          try {
            const parsed = JSON.parse(target.attachment_data);
            if (Array.isArray(parsed)) {
              const cleaned = parsed.filter((f: any) => !f.name?.includes('diagnostics.whitedesk') && f.type !== 'diagnostic');
              target.attachment_data = cleaned.length > 0 ? JSON.stringify(cleaned) : null;
              if (cleaned.length === 0) {
                target.attachment_name = null;
                target.attachment_type = null;
              }
            }
          } catch {}
        }
        if (Array.isArray(target.attachments)) {
          target.attachments = target.attachments.filter((a: any) => !a.name?.includes('diagnostics.whitedesk') && a.type !== 'diagnostic');
        }
        target.updated_at = Date.now();
        await keystoreTicketVault.upsertTicket(target);
      }

      // Also clean diagnostics from stored messages of this ticket
      const msgs = await keystoreTicketVault.getMessages(cleanId);
      let msgsChanged = false;
      for (const m of msgs) {
        if (m.attachment_type === 'diagnostic' || m.attachment_name?.includes('diagnostics.whitedesk')) {
          m.attachment_name = null;
          m.attachment_type = null;
          m.attachment_data = null;
          msgsChanged = true;
        } else if (m.attachment_data && m.attachment_data.startsWith('[')) {
          try {
            const parsed = JSON.parse(m.attachment_data);
            if (Array.isArray(parsed)) {
              const cleaned = parsed.filter((f: any) => !f.name?.includes('diagnostics.whitedesk') && f.type !== 'diagnostic');
              m.attachment_data = cleaned.length > 0 ? JSON.stringify(cleaned) : null;
              if (cleaned.length === 0) {
                m.attachment_name = null;
                m.attachment_type = null;
              }
              msgsChanged = true;
            }
          } catch {}
        }
        if (Array.isArray(m.attachments)) {
          const prevLen = m.attachments.length;
          m.attachments = m.attachments.filter((a: any) => !a.name?.includes('diagnostics.whitedesk') && a.type !== 'diagnostic');
          if (m.attachments.length !== prevLen) msgsChanged = true;
        }
      }
      if (msgsChanged) {
        await keystoreTicketVault.saveMessages(cleanId, msgs);
      }

      if (target) {
        void (async () => {
          try {
            const ownWhiteId = await helpDeskAuthService.getOwnWhiteId();
            const blindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
            const isAdmin = await helpDeskAuthService.checkIfAdmin(ownWhiteId);
            const targetBlindId = isAdmin
              ? (target.user_blind_id || 'blind_unknown')
              : (target.enterprise_blind_id || 'blind_thewhite_root');

            await apiClient.sendRelayMessage({
              ticket_id: cleanId,
              recipient_blind_id: targetBlindId,
              sender_blind_id: blindId,
              encrypted_payload: JSON.stringify({
                type: 'ticket_diagnostic_delete',
                ticket_id: cleanId,
              }),
            });
          } catch {}
        })();
      }
      return true;
    } catch (e) {
      console.warn('[HelpDeskTicketService] deleteTicketDiagnostics error:', e);
      return false;
    }
  },

  /**
   * Bilet Devir (Pass / Transfer) İstemi Gönder
   */
  async requestTicketTransfer(
    ticketId: string,
    targetAdminBlindId: string,
    targetAdminAlias: string,
    transferNote?: string,
    attachment?: { data: string; name: string; type: string } | null
  ): Promise<{ success: boolean; error?: string }> {
    const cleanId = String(ticketId).trim();
    try {
      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      if (!target) return { success: false, error: i18nService.t('ticket_service.ticket_not_found') };

      const ownWhiteId = await helpDeskAuthService.getOwnWhiteId();
      const ownBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
      const customAlias = await helpDeskAuthService.getCustomAlias();
      const ownAlias = customAlias || (await helpDeskAuthService.getAdminAlias(ownWhiteId)) || i18nService.t('helpdesk.admin_role_short');

      const now = Date.now();
      target.transfer_status = 'pending';
      target.transfer_target_blind_id = targetAdminBlindId;
      target.transfer_target_alias = targetAdminAlias;
      target.transfer_sender_blind_id = ownBlindId;
      target.transfer_sender_alias = ownAlias;
      target.transfer_note = transferNote || null;
      target.transfer_requested_at = now;
      await keystoreTicketVault.upsertTicket(target);

      const noteMsg: HelpDeskMessage = {
        id: 'msg_' + Math.random().toString(36).substring(2, 10),
        ticket_id: cleanId,
        app_id: target.app_id || CURRENT_APP_ID,
        sender_white_id: ownBlindId,
        sender_alias: ownAlias,
        sender_blind_id: ownBlindId,
        is_admin: true,
        is_internal: true,
        visibility_level: 'internal',
        message: i18nService.t('ticket_service.transfer_initiated_message', {
          alias: targetAdminAlias,
          note: transferNote ? ': ' + transferNote : '',
        }),
        created_at: now,
      };
      await keystoreTicketVault.appendMessage(cleanId, noteMsg);

      const allMsgs = await keystoreTicketVault.getMessages(cleanId);

      // SADECE hedef admine efemer transfer sinyali (Müşteriye asla gitmez!)
      void (async () => {
        try {
          let attachmentR2Key: string | null = null;
          if (attachment?.data) {
            const r2Upload = await apiClient.uploadRelayAttachmentBase64(
              attachment.data,
              attachment.type === 'multi' ? 'application/json' : 'application/octet-stream'
            );
            if (r2Upload.success && r2Upload.r2_key) {
              attachmentR2Key = r2Upload.r2_key;
            }
          }

          const transferPayload = JSON.stringify({
            type: 'ticket_transfer_request',
            ticket_id: cleanId,
            ticket: target,
            messages: allMsgs,
            transfer_note: transferNote || null,
            sender_alias: ownAlias,
            sender_blind_id: ownBlindId,
            sender_white_id: ownBlindId,
            target_alias: targetAdminAlias,
            target_blind_id: targetAdminBlindId,
            created_at: now,
          });

          await apiClient.sendRelayMessage({
            ticket_id: cleanId,
            recipient_blind_id: targetAdminBlindId,
            sender_blind_id: ownBlindId,
            encrypted_payload: transferPayload,
            attachment_r2_key: attachmentR2Key,
          });
        } catch (relayErr) {
          console.warn('[HelpDeskTicketService] requestTicketTransfer relay error:', relayErr);
        }
      })();

      return { success: true };
    } catch (e: any) {
      console.warn('[HelpDeskTicketService] requestTicketTransfer error:', e);
      return { success: false, error: e?.message || i18nService.t('ticket_service.transfer_initiate_failed') };
    }
  },

  /**
   * Bilet Devir İstemini İptal Et (Gönderen Tarafından)
   */
  async cancelTicketTransfer(ticketId: string): Promise<{ success: boolean; error?: string }> {
    const cleanId = String(ticketId).trim();
    try {
      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      if (!target) return { success: false, error: i18nService.t('ticket_service.ticket_not_found') };

      const ownWhiteId = await helpDeskAuthService.getOwnWhiteId();
      const ownBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
      const customAlias = await helpDeskAuthService.getCustomAlias();
      const ownAlias = customAlias || (await helpDeskAuthService.getAdminAlias(ownWhiteId)) || i18nService.t('helpdesk.admin_role_short');

      const prevTargetBlindId = target.transfer_target_blind_id;
      const now = Date.now();

      target.transfer_status = null;
      target.transfer_target_blind_id = null;
      target.transfer_target_alias = null;
      target.transfer_note = null;
      target.transfer_requested_at = null;
      await keystoreTicketVault.upsertTicket(target);

      const cancelMsg: HelpDeskMessage = {
        id: 'msg_' + Math.random().toString(36).substring(2, 10),
        ticket_id: cleanId,
        app_id: target.app_id || CURRENT_APP_ID,
        sender_white_id: ownBlindId,
        sender_alias: ownAlias,
        sender_blind_id: ownBlindId,
        is_admin: true,
        is_internal: true,
        visibility_level: 'internal',
        message: i18nService.t('ticket_service.transfer_cancelled_message'),
        created_at: now,
      };
      await keystoreTicketVault.appendMessage(cleanId, cancelMsg);

      if (prevTargetBlindId) {
        void (async () => {
          try {
            await apiClient.sendRelayMessage({
              ticket_id: cleanId,
              recipient_blind_id: prevTargetBlindId,
              sender_blind_id: ownBlindId,
              encrypted_payload: JSON.stringify({
                type: 'ticket_transfer_canceled',
                ticket_id: cleanId,
                canceled_by: ownAlias,
                created_at: now,
              }),
            });
          } catch {}
        })();
      }

      return { success: true };
    } catch (e: any) {
      console.warn('[HelpDeskTicketService] cancelTicketTransfer error:', e);
      return { success: false, error: e?.message || i18nService.t('ticket_service.transfer_cancel_failed') };
    }
  },

  /**
   * Bilet Devir İstemini Kabul Et (Alıcı Tarafından)
   */
  async acceptTicketTransfer(ticketId: string): Promise<{ success: boolean; error?: string }> {
    const cleanId = String(ticketId).trim();
    try {
      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      if (!target) return { success: false, error: i18nService.t('ticket_service.ticket_not_found') };

      const ownWhiteId = await helpDeskAuthService.getOwnWhiteId();
      const ownBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
      const customAlias = await helpDeskAuthService.getCustomAlias();
      const ownAlias = customAlias || (await helpDeskAuthService.getAdminAlias(ownWhiteId)) || i18nService.t('helpdesk.admin_role_short');

      const prevSenderAlias = target.transfer_sender_alias;
      const prevSenderBlindId = target.transfer_sender_blind_id;
      const now = Date.now();

      target.assigned_admin_blind_id = ownBlindId;
      target.transfer_status = 'accepted';
      target.transferred_from_alias = prevSenderAlias || i18nService.t('helpdesk.admin_role_short');
      target.transferred_from_blind_id = prevSenderBlindId;
      target.transfer_target_blind_id = null;
      target.transfer_target_alias = null;
      target.transfer_sender_blind_id = null;
      target.transfer_sender_alias = null;
      target.transfer_note = null;
      target.transfer_requested_at = null;
      target.assigned_at = now;
      target.updated_at = now;
      await keystoreTicketVault.upsertTicket(target);

      const acceptMsg: HelpDeskMessage = {
        id: 'msg_' + Math.random().toString(36).substring(2, 10),
        ticket_id: cleanId,
        app_id: target.app_id || CURRENT_APP_ID,
        sender_white_id: ownBlindId,
        sender_alias: ownAlias,
        sender_blind_id: ownBlindId,
        is_admin: true,
        is_internal: true,
        visibility_level: 'internal',
        message: i18nService.t('ticket_service.transfer_accepted_message', { alias: ownAlias }),
        created_at: now,
      };
      await keystoreTicketVault.appendMessage(cleanId, acceptMsg);

      // Yük Sayaçlarını Güncelle
      void helpDeskStationService.incrementAdminTicketCount(ownWhiteId).catch(() => {});

      if (prevSenderBlindId) {
        void (async () => {
          try {
            await apiClient.sendRelayMessage({
              ticket_id: cleanId,
              recipient_blind_id: prevSenderBlindId,
              sender_blind_id: ownBlindId,
              encrypted_payload: JSON.stringify({
                type: 'ticket_transfer_accepted',
                ticket_id: cleanId,
                accepted_by_alias: ownAlias,
                accepted_by_blind_id: ownBlindId,
                created_at: now,
              }),
            });
          } catch {}
        })();
      }

      return { success: true };
    } catch (e: any) {
      console.warn('[HelpDeskTicketService] acceptTicketTransfer error:', e);
      return { success: false, error: e?.message || i18nService.t('ticket_service.transfer_accept_failed') };
    }
  },

  /**
   * Bilet Devir İstemini Reddet (Alıcı Tarafından)
   */
  async rejectTicketTransfer(
    ticketId: string,
    rejectionReason: string
  ): Promise<{ success: boolean; error?: string }> {
    const cleanId = String(ticketId).trim();
    try {
      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      if (!target) return { success: false, error: i18nService.t('ticket_service.ticket_not_found') };

      const ownWhiteId = await helpDeskAuthService.getOwnWhiteId();
      const ownBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
      const customAlias = await helpDeskAuthService.getCustomAlias();
      const ownAlias = customAlias || (await helpDeskAuthService.getAdminAlias(ownWhiteId)) || i18nService.t('helpdesk.admin_role_short');

      const prevSenderBlindId = target.transfer_sender_blind_id;
      const now = Date.now();

      // Alıcı kendisi sahibi değilse bilet onun Keystore'undan silinir (İnceleme sonlanır)
      if (target.assigned_admin_blind_id !== ownBlindId) {
        await keystoreTicketVault.deleteTicket(cleanId);
      } else {
        target.transfer_status = 'rejected';
        target.transfer_note = rejectionReason;
        await keystoreTicketVault.upsertTicket(target);
      }

      if (prevSenderBlindId) {
        void (async () => {
          try {
            await apiClient.sendRelayMessage({
              ticket_id: cleanId,
              recipient_blind_id: prevSenderBlindId,
              sender_blind_id: ownBlindId,
              encrypted_payload: JSON.stringify({
                type: 'ticket_transfer_rejected',
                ticket_id: cleanId,
                rejected_by_alias: ownAlias,
                rejection_reason: rejectionReason || i18nService.t('ticket_service.no_reason_provided'),
                created_at: now,
              }),
            });
          } catch {}
        })();
      }

      return { success: true };
    } catch (e: any) {
      console.warn('[HelpDeskTicketService] rejectTicketTransfer error:', e);
      return { success: false, error: e?.message || i18nService.t('ticket_service.transfer_reject_failed') };
    }
  },

  /**
   * Claims a pooled or escalated ticket by an admin or Global Admin.
   */
  async claimEscalatedTicket(
    ticketId: string,
    claimingWhiteId: string,
    claimingAlias?: string
  ): Promise<boolean> {
    const cleanId = String(ticketId).trim();
    const now = Date.now();
    try {
      const tickets = await keystoreTicketVault.getTickets();
      const target = tickets.find(t => t.id === cleanId);
      if (!target) return false;

      const claimingBlindId = WhiteDeskCrypto.generateBlindId(claimingWhiteId);
      target.assigned_admin_blind_id = claimingBlindId;
      if (claimingAlias) {
        target.assigned_admin_name = claimingAlias;
        target.assigned_admin_alias = claimingAlias;
      }
      target.assigned_at = now;
      target.updated_at = now;
      await keystoreTicketVault.upsertTicket(target);

      // Append internal claim message
      const claimMsg: HelpDeskMessage = {
        id: 'msg_claim_' + Math.random().toString(36).substring(2, 10),
        ticket_id: cleanId,
        app_id: target.app_id || 'whitedesk',
        sender_white_id: claimingBlindId,
        sender_alias: claimingAlias || i18nService.t('helpdesk.admin_role_short'),
        sender_blind_id: claimingBlindId,
        is_admin: true,
        is_internal: true,
        visibility_level: 'internal',
        message: i18nService.t('ticket_service.ticket_claimed_from_pool_message', {
          alias: claimingAlias || i18nService.t('helpdesk.admin_role_short'),
        }),
        created_at: now,
      };
      await keystoreTicketVault.appendMessage(cleanId, claimMsg);

      // Confirm ACK to vaporize from D1 pool if ticket was pending
      if (target.relay_item_id) {
        await apiClient.confirmRelayAck(target.relay_item_id, target.relay_attachment_r2_key);
        target.is_relay_pending = false;
        await keystoreTicketVault.upsertTicket(target);
      }

      // Notify user device that this admin claimed the ticket
      const userBlindId = target.user_blind_id;
      if (userBlindId) {
        await apiClient.sendRelayMessage({
          ticket_id: cleanId,
          recipient_blind_id: userBlindId,
          sender_blind_id: claimingBlindId,
          encrypted_payload: JSON.stringify({
            type: 'ticket_header',
            ticket: {
              ...target,
              assigned_admin_blind_id: claimingBlindId,
            },
          }),
        });
      }

      return true;
    } catch (e) {
      console.warn('[HelpDeskTicketService] claimEscalatedTicket error:', e);
      return false;
    }
  },
};
