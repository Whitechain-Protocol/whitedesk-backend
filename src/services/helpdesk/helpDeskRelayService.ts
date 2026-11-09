import { apiClient } from '../apiClient';
import { keystoreTicketVault } from '../keystoreTicketVault';
import { keystoreConfigVault } from '../keystoreConfigVault';
import { remoteDesktopService } from '../remoteDesktopService';
import { WhiteDeskCrypto } from '../../whitedesk-sdk';
import { HelpDeskMessage, HelpDeskTicket } from './types';
import { helpDeskAuthService } from './helpDeskAuthService';
import { i18nService } from '../i18nService';

export interface RelayAuthDelegate {
  getAdminRole: (ownWhiteId: string) => Promise<'founder' | 'global_admin' | 'admin' | 'none'>;
  getAdminEnterprise: (ownWhiteId?: string) => Promise<{ enterpriseBlindId: string | null; orgPub: string | null; enterpriseName: string | null }>;
}

export const helpDeskRelayService = {
  /**
   * Sovereign D1 Relay Synchronization:
   * Polls Cloudflare D1 for incoming transient tickets and messages, seals them
   * into hardware Keystore, and confirms ACK to vaporize them immediately from D1/R2.
   */
  async syncRelayInbox(
    ownWhiteId: string,
    activeTenantBlindId?: string | null,
    callerRole?: 'founder' | 'global_admin' | 'admin' | 'none',
    authDelegate?: RelayAuthDelegate
  ): Promise<boolean> {
    if (!ownWhiteId || ownWhiteId === 'anonymous') return false;
    let hasChanges = false;
    try {
      const ownBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
      const recipientIdsToCheck = new Set<string>();
      recipientIdsToCheck.add(ownBlindId);

      // Cihazdaki mevcut biletlerin oluşturan / atanan kimliklerini de alıcı listesine ekle (geçiş öncesi bilet yanıtlarını kaçırmamak için)
      try {
        const localTickets = await keystoreTicketVault.getTickets();
        for (const t of localTickets) {
          if (t.user_blind_id && !t.is_discussion) {
            const uBlind = WhiteDeskCrypto.generateBlindId(t.user_blind_id);
            if (uBlind === ownBlindId) {
              recipientIdsToCheck.add(t.user_blind_id);
              if (t.user_white_id) recipientIdsToCheck.add(t.user_white_id);
            }
          }
        }
      } catch {}

      let isFounder = false;
      let isAdmin = false;
      let isPrivilegedMonitor = false;
      const delegate = authDelegate || helpDeskAuthService;

      // YALNIZCA Admin veya Kurucu ise kurum gelen kutularını denetle
      try {
        let adminRole: 'founder' | 'global_admin' | 'admin' | 'none' | undefined = callerRole;
        if (adminRole === undefined && delegate) {
          adminRole = await delegate.getAdminRole(ownBlindId);
        }
        isFounder = adminRole === 'founder' || (adminRole as string) === 'master';
        isAdmin = adminRole !== undefined && adminRole !== 'none';
        isPrivilegedMonitor = isFounder || adminRole === 'global_admin' || callerRole === 'global_admin' || callerRole === 'founder';

        if (isAdmin && delegate) {
          const adminEnt = await delegate.getAdminEnterprise(ownBlindId);
          if (adminEnt.enterpriseBlindId && adminEnt.enterpriseBlindId !== 'default') {
            recipientIdsToCheck.add(adminEnt.enterpriseBlindId);
          }
          if (activeTenantBlindId && activeTenantBlindId !== 'all') {
            recipientIdsToCheck.add(activeTenantBlindId);
          }
          if (isFounder) {
            recipientIdsToCheck.add('blind_thewhite_root');
            recipientIdsToCheck.add('blind_11fcac28453c3eaa3a06a5db6caf4ca1');
            recipientIdsToCheck.add('default');
            try {
              const tenants = await keystoreConfigVault.getAllTenants();
              for (const t of tenants) {
                if (t.enterprise_blind_id) recipientIdsToCheck.add(t.enterprise_blind_id);
              }
            } catch {}
          }
        }
      } catch {}

      const allTransientItems: any[] = [];
      const seenItemIds = new Set<string>();

      // Kurucu ise tek çağrıda tüm D1 havuzunu çeker
      if (isFounder) {
        try {
          const founderItems = await apiClient.fetchRelayInbox({ is_founder: true });
          if (founderItems && founderItems.length > 0) {
            for (const it of founderItems) {
              if (!seenItemIds.has(it.id)) {
                seenItemIds.add(it.id);
                allTransientItems.push(it);
              }
            }
          }
        } catch (e) {
          console.warn('[helpDeskRelayService] syncRelayInbox founder fetch error:', e);
        }
      } else {
        // Kullanıcı veya normal admin: Alıcı ID'lerini tek sorguda virgülle birleştirip çeker
        try {
          const recList = Array.from(recipientIdsToCheck).filter(Boolean).join(',');
          if (recList) {
            const transientItems = await apiClient.fetchRelayInbox({ recipient_blind_id: recList });
            if (transientItems && transientItems.length > 0) {
              for (const it of transientItems) {
                if (!seenItemIds.has(it.id)) {
                  seenItemIds.add(it.id);
                  allTransientItems.push(it);
                }
              }
            }
          }
        } catch (e) {
          console.warn('[helpDeskRelayService] syncRelayInbox fetch error:', e);
        }
      }

      if (allTransientItems.length > 0) {
        console.log(`[helpDeskRelayService] syncRelayInbox found ${allTransientItems.length} items to ingest`);
        for (const item of allTransientItems) {
          try {
            // Cihazın kendi gönderdiği mesajı kendisinin tüketip silmesini (vaporization) engelle!
            if (WhiteDeskCrypto.generateBlindId(item.sender_blind_id || '') === ownBlindId) {
              continue;
            }
            let payloadData: any = null;
            try {
              payloadData = JSON.parse(item.encrypted_payload);
            } catch {
              payloadData = { message: item.encrypted_payload };
            }

            // A) BİLET BAŞLIĞI VE İLK MESAJI
            if (payloadData.type === 'ticket_header' && payloadData.ticket) {
              const r2Key = item.attachment_r2_key || payloadData.ticket?.attachment_r2_key || payloadData.initial_message?.attachment_r2_key;
              let downloadedBase64: string | null = null;
              if (r2Key) {
                try {
                  console.log(`[helpDeskRelayService] Downloading ticket attachment from R2 (${r2Key})...`);
                  downloadedBase64 = await apiClient.fetchRelayAttachment(r2Key);
                } catch (r2Err) {
                  console.warn('[helpDeskRelayService] Failed to download R2 attachment:', r2Err);
                }
              }

              const attData = downloadedBase64 || payloadData.initial_message?.attachment_data || payloadData.ticket?.attachment_data || null;
              const attName = payloadData.initial_message?.attachment_name || payloadData.ticket?.attachment_name || null;
              const attType = payloadData.initial_message?.attachment_type || payloadData.ticket?.attachment_type || null;
              let attachmentsList: any[] | undefined = payloadData.initial_message?.attachments || payloadData.ticket?.attachments;

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

              payloadData.ticket.attachment_data = attData;
              payloadData.ticket.attachment_name = attName;
              payloadData.ticket.attachment_type = attType;
              payloadData.ticket.attachments = attachmentsList;

              if (payloadData.initial_message) {
                payloadData.initial_message.attachment_data = attData;
                payloadData.initial_message.attachment_name = attName;
                payloadData.initial_message.attachment_type = attType;
                payloadData.initial_message.attachments = attachmentsList;
              }

              const assignedAdminBlind = WhiteDeskCrypto.generateBlindId(payloadData.ticket?.assigned_admin_blind_id || '');
              const isAssignedToMe = Boolean(assignedAdminBlind && assignedAdminBlind === ownBlindId);
              if (isPrivilegedMonitor && !isAssignedToMe) {
                payloadData.ticket.is_relay_pending = true;
                payloadData.ticket.relay_item_id = item.id;
                payloadData.ticket.relay_attachment_r2_key = item.attachment_r2_key || payloadData.ticket?.attachment_r2_key || null;
              } else {
                payloadData.ticket.is_relay_pending = false;
              }

              await keystoreTicketVault.upsertTicket(payloadData.ticket);
              if (payloadData.initial_message) {
                await keystoreTicketVault.appendMessage(payloadData.ticket.id, payloadData.initial_message);
              }
              hasChanges = true;
            }
            // B) BİLET YANITI
            else if (payloadData.type === 'ticket_reply') {
              const ticketId = payloadData.ticket_id || item.ticket_id;
              const r2Key = item.attachment_r2_key || payloadData.message?.attachment_r2_key;
              let downloadedBase64: string | null = null;
              if (r2Key && payloadData.message) {
                try {
                  console.log(`[helpDeskRelayService] Downloading reply attachment from R2 (${r2Key})...`);
                  downloadedBase64 = await apiClient.fetchRelayAttachment(r2Key);
                } catch (r2Err) {
                  console.warn('[helpDeskRelayService] Failed to download reply R2 attachment:', r2Err);
                }
              }

              if (payloadData.message) {
                const attData = downloadedBase64 || payloadData.message.attachment_data || null;
                const attName = payloadData.message.attachment_name || null;
                const attType = payloadData.message.attachment_type || null;
                let attachmentsList: any[] | undefined = payloadData.message.attachments;

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

                payloadData.message.attachment_data = attData;
                payloadData.message.attachment_name = attName;
                payloadData.message.attachment_type = attType;
                payloadData.message.attachments = attachmentsList;
              }

              const tickets = await keystoreTicketVault.getTickets();
              const target = tickets.find(t => t.id === ticketId);
              if (target) {
                target.status = payloadData.status || target.status;
                target.updated_at = payloadData.updated_at || Date.now();
                if (payloadData.message?.is_admin) {
                  target.last_admin_reply_at = payloadData.updated_at || Date.now();
                }
                if (payloadData.message) {
                  const mAttType = payloadData.message.attachment_type;
                  const mAttName = payloadData.message.attachment_name;
                  const mAttData = payloadData.message.attachment_data;
                  const mAttList = payloadData.message.attachments;
                  const hasDiag =
                    mAttType === 'diagnostic' ||
                    mAttName?.includes('diagnostics.whitedesk') ||
                    (Array.isArray(mAttList) &&
                      mAttList.some((a: any) => a.type === 'diagnostic' || a.name?.includes('diagnostics.whitedesk')));
                  if (hasDiag && mAttData) {
                    target.attachment_data = mAttData;
                    target.attachment_name = mAttName || 'diagnostics.whitedesk';
                    target.attachment_type = mAttType || 'diagnostic';
                    target.attachments = mAttList;
                  }
                }
                await keystoreTicketVault.upsertTicket(target);
              }
              if (payloadData.message) {
                await keystoreTicketVault.appendMessage(ticketId, payloadData.message);
              }
              hasChanges = true;
            }
            // B2) SİSTEM TANISI SİLME
            else if (payloadData.type === 'ticket_diagnostic_delete') {
              const ticketId = payloadData.ticket_id || item.ticket_id;
              const tickets = await keystoreTicketVault.getTickets();
              const target = tickets.find(t => t.id === ticketId);
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
              const msgs = await keystoreTicketVault.getMessages(ticketId);
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
                await keystoreTicketVault.saveMessages(ticketId, msgs);
              }
              hasChanges = true;
            }
            // C) DURUM GÜNCELLEMESİ (Çözüldü / Kapatıldı)
            else if (payloadData.type === 'ticket_status_update') {
              const ticketId = payloadData.ticket_id || item.ticket_id;
              const tickets = await keystoreTicketVault.getTickets();
              const target = tickets.find(t => t.id === ticketId);
              if (target) {
                target.status = payloadData.status || target.status;
                target.updated_at = Date.now();
                if (payloadData.resolution_note) target.resolution_note = payloadData.resolution_note;
                await keystoreTicketVault.upsertTicket(target);
                hasChanges = true;
              }
            }
            // D) BİLET SİLME
            else if (payloadData.type === 'ticket_delete') {
              const ticketId = payloadData.ticket_id || item.ticket_id;
              await keystoreTicketVault.deleteTicket(ticketId);
              hasChanges = true;
            }
            // D2) UZAK MASAÜSTÜ DAVET SİNYALİ (0-Polling anlık tetikleyici)
            else if (payloadData.type === 'rd_invite_signal') {
              const ticketId = payloadData.ticket_id || item.ticket_id;
              if (ticketId) {
                void remoteDesktopService.receiveIncomingInvite(
                  ticketId,
                  payloadData.admin_alias || i18nService.t('relay_service.default_support_specialist'),
                  true
                );
              }
            }
            // D3) UZAK MASAÜSTÜ İPTAL SİNYALİ (Admin vazgeçtiğinde kullanıcı onay modalını kapatır)
            else if (payloadData.type === 'rd_cancel_signal') {
              const ticketId = payloadData.ticket_id || item.ticket_id;
              if (ticketId) {
                remoteDesktopService.dismissIncomingOffer(ticketId);
              }
            }
            // D4) BİLET DEVİR (TRANSFER) İSTEMİ ALINDI (Hedef Admin)
            else if (payloadData.type === 'ticket_transfer_request' && payloadData.ticket) {
              const ticketId = payloadData.ticket_id || item.ticket_id;
              const incomingTicket = payloadData.ticket;
              incomingTicket.transfer_status = 'pending';
              incomingTicket.transfer_sender_blind_id = payloadData.sender_blind_id;
              incomingTicket.transfer_sender_alias = payloadData.sender_alias || i18nService.t('helpdesk.admin_role_short');
              incomingTicket.transfer_target_blind_id = ownBlindId;
              incomingTicket.transfer_note = payloadData.transfer_note || null;
              await keystoreTicketVault.upsertTicket(incomingTicket);
              if (Array.isArray(payloadData.messages) && payloadData.messages.length > 0) {
                await keystoreTicketVault.saveMessages(ticketId, payloadData.messages);
              }
              hasChanges = true;
            }
            // D5) BİLET DEVİR İPTAL EDİLDİ (Hedef Admin)
            else if (payloadData.type === 'ticket_transfer_canceled') {
              const ticketId = payloadData.ticket_id || item.ticket_id;
              if (ticketId) {
                const tickets = await keystoreTicketVault.getTickets();
                const target = tickets.find(t => t.id === ticketId);
                if (target && target.assigned_admin_blind_id !== ownBlindId) {
                  await keystoreTicketVault.deleteTicket(ticketId);
                } else if (target) {
                  target.transfer_status = null;
                  target.transfer_note = null;
                  await keystoreTicketVault.upsertTicket(target);
                }
                hasChanges = true;
              }
            }
            // D6) BİLET DEVİR KABUL EDİLDİ (Gönderen Admin)
            else if (payloadData.type === 'ticket_transfer_accepted') {
              const ticketId = payloadData.ticket_id || item.ticket_id;
              if (ticketId) {
                const tickets = await keystoreTicketVault.getTickets();
                const target = tickets.find(t => t.id === ticketId);
                if (target) {
                  target.transfer_status = 'accepted';
                  target.assigned_admin_blind_id = payloadData.accepted_by_blind_id;
                  target.assigned_at = Number(payloadData.created_at || Date.now());
                  await keystoreTicketVault.upsertTicket(target);
                  const acceptNote: HelpDeskMessage = {
                    id: 'msg_' + Math.random().toString(36).substring(2, 10),
                    ticket_id: ticketId,
                    app_id: target.app_id || 'inwhite',
                    sender_white_id: payloadData.accepted_by_blind_id || '',
                    sender_alias: payloadData.accepted_by_alias || i18nService.t('helpdesk.admin_role_short'),
                    sender_blind_id: payloadData.accepted_by_blind_id,
                    is_admin: true,
                    is_internal: true,
                    visibility_level: 'internal',
                    message: i18nService.t('relay_service.transfer_completed_note', {
                      alias: payloadData.accepted_by_alias || i18nService.t('helpdesk.admin_role_short'),
                    }),
                    created_at: Number(payloadData.created_at || Date.now()),
                  };
                  await keystoreTicketVault.appendMessage(ticketId, acceptNote);
                  hasChanges = true;
                }
              }
            }
            // D7) BİLET DEVİR REDDEDİLDİ (Gönderen Admin)
            else if (payloadData.type === 'ticket_transfer_rejected') {
              const ticketId = payloadData.ticket_id || item.ticket_id;
              if (ticketId) {
                const tickets = await keystoreTicketVault.getTickets();
                const target = tickets.find(t => t.id === ticketId);
                if (target) {
                  target.transfer_status = 'rejected';
                  target.transfer_note = payloadData.rejection_reason || null;
                  await keystoreTicketVault.upsertTicket(target);
                  const rejectNote: HelpDeskMessage = {
                    id: 'msg_' + Math.random().toString(36).substring(2, 10),
                    ticket_id: ticketId,
                    app_id: target.app_id || 'inwhite',
                    sender_white_id: item.sender_blind_id || '',
                    sender_alias: payloadData.rejected_by_alias || i18nService.t('helpdesk.admin_role_short'),
                    sender_blind_id: item.sender_blind_id,
                    is_admin: true,
                    is_internal: true,
                    visibility_level: 'internal',
                    message: i18nService.t('relay_service.transfer_rejected_note', {
                      alias: payloadData.rejected_by_alias || i18nService.t('helpdesk.admin_role_short'),
                      reason: payloadData.rejection_reason || i18nService.t('relay_service.no_reason_provided'),
                    }),
                    created_at: Number(payloadData.created_at || Date.now()),
                  };
                  await keystoreTicketVault.appendMessage(ticketId, rejectNote);
                  hasChanges = true;
                }
              }
            }
            // E) STANDART MESAJ RELAY (Eski uyumluluk)
            else {
              const ticketId = item.ticket_id;
              const newMsg: HelpDeskMessage = {
                id: item.id,
                ticket_id: ticketId,
                app_id: payloadData.app_id || 'inwhite',
                sender_white_id: payloadData.sender_white_id || '',
                sender_alias: payloadData.sender_alias || null,
                sender_blind_id: item.sender_blind_id,
                is_admin: Boolean(payloadData.is_admin),
                sender_role: payloadData.sender_role || null,
                message: payloadData.message || '',
                attachment_data: payloadData.attachment_data || null,
                attachment_name: payloadData.attachment_name || null,
                attachment_type: payloadData.attachment_type || null,
                attachments: payloadData.attachments || undefined,
                created_at: Number(item.created_at || Date.now()),
              };
              await keystoreTicketVault.appendMessage(ticketId, newMsg);
              hasChanges = true;
            }

            // ⚡ INSTANT VAPORIZATION: D1 ve R2'den anında sil (Sunucuda 0 iz!)
            // Global adminler ve kurucu başka admine atanmış bileti izlerken sunucuda kalır; doğrudan kendisine atanmışsa veya normal admin çektiğinde buharlaşır
            const shouldKeepInRelayForSubAdmin = isPrivilegedMonitor && payloadData?.type === 'ticket_header' && payloadData?.ticket?.is_relay_pending === true;
            if (!shouldKeepInRelayForSubAdmin) {
              await apiClient.confirmRelayAck(item.id, item.attachment_r2_key);
            }
          } catch (itemErr) {
            console.warn('[helpDeskRelayService] syncRelayInbox item error:', itemErr);
          }
        }
      }
    } catch (err) {
      console.warn('[helpDeskRelayService] syncRelayInbox error:', err);
    }
    return hasChanges;
  },
};
