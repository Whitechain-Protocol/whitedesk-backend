import { keystoreTicketVault } from '../keystoreTicketVault';
import { apiClient } from '../apiClient';
import { WhiteDeskCrypto } from '../../whitedesk-sdk';
import { helpDeskAuthService } from './helpDeskAuthService';
import { helpDeskLicenseService } from './helpDeskLicenseService';
import { HelpDeskTicket, HelpDeskMessage } from './types';

type SlaListener = (ticketId: string, subject: string) => void;

class SlaEscalationService {
  private listeners: Set<SlaListener> = new Set();
  private timer: any = null;
  private isChecking = false;

  /**
   * Subscribes to SLA escalation notifications (e.g., UI banner/toast).
   */
  onSlaEscalated(listener: SlaListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(ticketId: string, subject: string) {
    this.listeners.forEach(cb => {
      try {
        cb(ticketId, subject);
      } catch (err) {
        console.warn('[SlaEscalationService] listener error:', err);
      }
    });
  }

  /**
   * Starts periodic SLA evaluation loop (runs every intervalMs, default 20s).
   */
  startSlaEngineTimer(intervalMs: number = 20000): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      void this.checkAndEscalateTickets();
    }, intervalMs);
  }

  /**
   * Stops the periodic SLA evaluation loop.
   */
  stopSlaEngineTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Scans user tickets for SLA violations and performs zero-knowledge twin re-keying.
   */
  async checkAndEscalateTickets(params?: {
    ownWhiteId?: string;
    forceSlaMinutes?: number;
  }): Promise<{ escalatedCount: number; ticketIds: string[] }> {
    if (this.isChecking) return { escalatedCount: 0, ticketIds: [] };
    this.isChecking = true;

    const escalatedTicketIds: string[] = [];

    try {
      const ownWhiteId = params?.ownWhiteId || (await helpDeskAuthService.getOwnWhiteId());
      if (!ownWhiteId || ownWhiteId === 'anonymous') {
        this.isChecking = false;
        return { escalatedCount: 0, ticketIds: [] };
      }

      const ownBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
      const allTickets = await keystoreTicketVault.getTickets();

      // Filter open tickets subject to SLA: user's ticket or assigned admin's ticket
      const userOpenTickets = allTickets.filter(t => {
        const isOwner = (t.user_white_id && t.user_white_id.toLowerCase() === ownWhiteId.toLowerCase()) ||
                        (t.user_blind_id && t.user_blind_id.toLowerCase() === ownBlindId.toLowerCase());
        const isAssigned = (t.assigned_admin_blind_id && t.assigned_admin_blind_id.toLowerCase() === ownBlindId.toLowerCase());
        const isOpen = t.status === 'open';
        const notDiscussion = !t.is_discussion;
        const hasAssignedAdmin = !!t.assigned_admin_blind_id && t.assigned_admin_blind_id !== 'unassigned';
        const notMaxStage = (t.escalation_stage || 0) < 3; // Max 2 escalations
        return (isOwner || isAssigned) && isOpen && notDiscussion && hasAssignedAdmin && notMaxStage;
      });

      if (userOpenTickets.length === 0) {
        this.isChecking = false;
        return { escalatedCount: 0, ticketIds: [] };
      }

      const now = Date.now();

      for (const ticket of userOpenTickets) {
        try {
          // Check if any admin has already replied
          const localMsgs = await keystoreTicketVault.getMessages(ticket.id);
          const hasAdminReply = localMsgs.some(
            m => m.is_admin && m.visibility_level !== 'internal' && m.visibility_level !== 'whisper'
          );

          if (hasAdminReply) {
            // Already replied by an admin, not subject to initial response SLA breach
            continue;
          }

          // Fetch enterprise SLA configuration
          const advConfig = await helpDeskLicenseService.getAdvancedFeaturesConfig(ticket.enterprise_blind_id);
          
          let slaLimitMs = 30 * 60 * 1000; // Varsayılan 30 dk
          if (ticket.sla_limit_minutes && ticket.sla_limit_minutes > 0) {
            slaLimitMs = ticket.sla_limit_minutes * 60 * 1000;
          } else if (params?.forceSlaMinutes && params.forceSlaMinutes > 0) {
            slaLimitMs = params.forceSlaMinutes * 60 * 1000;
          } else if (advConfig?.escalation?.enabled) {
            if (advConfig.escalation.slaMinutes && advConfig.escalation.slaMinutes > 0) {
              slaLimitMs = advConfig.escalation.slaMinutes * 60 * 1000;
            } else if (advConfig.escalation.slaHours && advConfig.escalation.slaHours > 0) {
              slaLimitMs = advConfig.escalation.slaHours * 3600 * 1000;
            }
          }

          const ticketCreatedAt = Number(ticket.created_at || now);
          const elapsed = now - ticketCreatedAt;

          if (elapsed < slaLimitMs) {
            // Within SLA window
            continue;
          }

          // 🚨 SLA VIOLATION DETECTED! Perform Twin Ticket Re-Keying & Reissue
          const oldAdminBlindId = ticket.assigned_admin_blind_id!;
          const nextStage = (ticket.escalation_stage || 0) + 1;

          console.log(`[SlaEscalationService] SLA breach on ticket ${ticket.id} (${Math.round(elapsed / 60000)}m > ${Math.round(slaLimitMs / 60000)}m). Escalating to Stage ${nextStage}...`);

          // 1. Request new admin allocation from Cloudflare D1
          let newAdminBlindId: string = 'unassigned';
          let targetRecipientBlindId = ticket.enterprise_blind_id
            ? `ent_${ticket.enterprise_blind_id}_global_admins_pool`
            : 'blind_thewhite_root';

          try {
            const alloc = await apiClient.allocateTicketAdmin({
              enterprise_blind_id: ticket.enterprise_blind_id || 'default',
              category: ticket.category,
              org_id: ticket.org_id,
            });

            if (
              alloc &&
              alloc.success &&
              alloc.assigned_admin_blind_id &&
              alloc.assigned_admin_blind_id !== 'unassigned' &&
              alloc.assigned_admin_blind_id !== oldAdminBlindId
            ) {
              newAdminBlindId = alloc.assigned_admin_blind_id;
              targetRecipientBlindId = newAdminBlindId;
            } else {
              // Grill-Me Karar 3: Alt Admin -> Global Admin Eskalasyonu (Havuz & Ilk Alan)
              newAdminBlindId = 'unassigned';
              targetRecipientBlindId = ticket.enterprise_blind_id
                ? `ent_${ticket.enterprise_blind_id}_global_admins_pool`
                : 'blind_thewhite_root';
            }
          } catch (allocErr) {
            console.warn('[SlaEscalationService] Allocation query error, falling back to global admin pool:', allocErr);
          }

          // 2. Prepare Audit Trail
          const auditLine = `[${new Date(now).toISOString()}] SLA timeout: transferred from ${oldAdminBlindId} to ${newAdminBlindId} (Stage ${nextStage})`;
          const updatedAudit = ticket.audit_trail ? `${ticket.audit_trail}\n${auditLine}` : auditLine;

          // 3. Prepare Twin A (New Admin / Pool: status = 'open')
          const twinATicket: HelpDeskTicket = {
            ...ticket,
            status: 'open',
            assigned_admin_blind_id: newAdminBlindId !== 'unassigned' ? newAdminBlindId : undefined,
            reassigned_from: oldAdminBlindId,
            escalation_stage: nextStage,
            audit_trail: updatedAudit,
            assigned_at: now,
            updated_at: now,
          };

          const firstMsg = localMsgs[0] || null;
          const twinAPayload = JSON.stringify({
            type: 'ticket_header',
            ticket: {
              ...twinATicket,
              attachment_data: null,
            },
            initial_message: firstMsg
              ? {
                  ...firstMsg,
                  attachment_data: null,
                }
              : null,
          });

          // 4. Prepare Twin B (Old Admin: status = 'revoked')
          const twinBTicket: HelpDeskTicket = {
            ...ticket,
            status: 'revoked',
            assigned_admin_blind_id: oldAdminBlindId,
            reassigned_to: newAdminBlindId,
            revocation_reason: 'sla_timeout',
            escalation_stage: nextStage,
            audit_trail: updatedAudit,
            assigned_at: now,
            updated_at: now,
          };

          const twinBPayload = JSON.stringify({
            type: 'ticket_header',
            ticket: {
              ...twinBTicket,
              attachment_data: null,
            },
          });

          // 5. Send Twin Tickets to Cloudflare Worker atomically
          const reissueRes = await apiClient.reissueTwinTickets({
            twin_a: {
              ticket_id: ticket.id,
              recipient_blind_id: targetRecipientBlindId,
              sender_blind_id: ownBlindId,
              encrypted_payload: twinAPayload,
              attachment_r2_key: ticket.attachment_r2_key || null,
            },
            twin_b: {
              ticket_id: ticket.id,
              recipient_blind_id: oldAdminBlindId,
              sender_blind_id: ownBlindId,
              encrypted_payload: twinBPayload,
              attachment_r2_key: ticket.attachment_r2_key || null,
            },
            old_admin_blind_id: oldAdminBlindId,
            new_admin_blind_id: newAdminBlindId !== 'unassigned' ? newAdminBlindId : undefined,
            enterprise_blind_id: ticket.enterprise_blind_id,
          });

          console.log(`[SlaEscalationService] Reissue response for ${ticket.id}:`, reissueRes);

          // 6. Update User's Local Keystore Vault
          await keystoreTicketVault.upsertTicket(twinATicket);

          const escalationNoticeMsg: HelpDeskMessage = {
            id: 'msg_sla_' + Math.random().toString(36).substring(2, 10),
            ticket_id: ticket.id,
            app_id: ticket.app_id || 'whitedesk',
            sender_white_id: 'system',
            sender_alias: 'Sistem',
            sender_blind_id: 'blind_system',
            is_admin: true,
            is_internal: false,
            visibility_level: 'customer',
            message: `⏱️ [SLA Eskalasyonu] Yanıt süresi aşıldığı için biletiniz yeni bir temsilciye aktarıldı. (Aşama ${nextStage})`,
            created_at: now,
          };
          await keystoreTicketVault.appendMessage(ticket.id, escalationNoticeMsg);

          escalatedTicketIds.push(ticket.id);

          // 7. Notify UI banner
          this.notify(ticket.id, ticket.subject);
        } catch (ticketErr) {
          console.warn(`[SlaEscalationService] Error processing ticket ${ticket.id}:`, ticketErr);
        }
      }
    } catch (e) {
      console.warn('[SlaEscalationService] checkAndEscalateTickets error:', e);
    } finally {
      this.isChecking = false;
    }

    return { escalatedCount: escalatedTicketIds.length, ticketIds: escalatedTicketIds };
  }
}

export const slaEscalationService = new SlaEscalationService();
