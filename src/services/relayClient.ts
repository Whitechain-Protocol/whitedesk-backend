/**
 * WhiteDesk Sovereign Relay Client (Cloudflare D1 + R2 + Vaporization)
 * Zero Personal Data: All messages transient in D1/R2 until Keystore ACK vaporization.
 */

const DEFAULT_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.whitedesk.one';
const RELAY_BASE_URL =
  process.env.EXPO_PUBLIC_DO_RELAY_URL || 'https://api.whitedesk.one';

export interface MailboxMessageItem {
  id: string;
  thread_id: string;
  from_id: string;
  to_id: string;
  sender_name: string;
  subject: string;
  category: string;
  body: string;
  image_data?: string | null;
  device_info?: string | null;
  is_read: boolean;
  created_at: number;
}

export interface RelayInboxMessage {
  id: string;
  ticket_id: string;
  recipient_blind_id: string;
  sender_blind_id: string;
  encrypted_payload: string;
  attachment_r2_key?: string | null;
  created_at: number;
  expires_at: number;
}

export const relayClient = {
  /**
   * Sovereign Mailbox: Fetches inbox messages for the given whiteId (or all for admin).
   */
  async fetchMailbox(
    whiteId: string,
    adminKey?: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<{ success: boolean; isAdmin: boolean; messages: MailboxMessageItem[] }> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const query = adminKey 
        ? `adminKey=${encodeURIComponent(adminKey)}` 
        : `whiteId=${encodeURIComponent(whiteId)}`;
      const res = await fetch(`${sanitizedUrl}/api/mailbox?${query}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) return { success: false, isAdmin: false, messages: [] };
      const data = await res.json();
      return { success: true, isAdmin: !!data.isAdmin, messages: data.messages || [] };
    } catch (err) {
      console.warn('relayClient: fetchMailbox error:', err);
      return { success: false, isAdmin: false, messages: [] };
    }
  },

  /**
   * Sovereign Mailbox: Sends a new message or reply.
   */
  async sendMailboxMessage(
    payload: {
      fromId: string;
      toId?: string;
      senderName?: string;
      subject: string;
      category?: string;
      body: string;
      imageData?: string | null;
      deviceInfo?: any;
      threadId?: string;
      adminKey?: string;
    },
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<{ success: boolean; id?: string; threadId?: string; error?: string }> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const res = await fetch(`${sanitizedUrl}/api/mailbox?action=send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: errText };
      }
      const data = await res.json();
      return { success: true, id: data.id, threadId: data.threadId };
    } catch (err: any) {
      console.warn('relayClient: sendMailboxMessage error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Sovereign Mailbox: Verifies admin secret key.
   */
  async verifyAdminSecret(
    key: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const res = await fetch(`${sanitizedUrl}/api/mailbox?action=auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      if (!res.ok) return false;
      const data = await res.json();
      return !!data.valid;
    } catch (err) {
      console.warn('relayClient: verifyAdminSecret error:', err);
      return false;
    }
  },

  /**
   * Sovereign Mailbox: Marks message as read.
   */
  async markMailboxRead(
    messageId: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const res = await fetch(`${sanitizedUrl}/api/mailbox?action=read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Sovereign Relay (Cloudflare D1 + R2 + Vaporization)
   */
  async sendRelayMessage(payload: {
    ticket_id: string;
    recipient_blind_id: string;
    sender_blind_id: string;
    encrypted_payload: string;
    attachment_r2_key?: string | null;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const res = await fetch(`${RELAY_BASE_URL.replace(/\/$/, '')}/api/relay/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json = await res.json();
        return { success: true, id: json.id };
      }
      const errText = await res.text();
      return { success: false, error: errText };
    } catch (e: any) {
      console.warn('[relayClient] sendRelayMessage network error:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Fetches transient encrypted items from Cloudflare D1 relay table.
   */
  async fetchRelayInbox(params: {
    recipient_blind_id?: string;
    ticket_id?: string;
    is_founder?: boolean;
  }): Promise<RelayInboxMessage[]> {
    try {
      const q = new URLSearchParams();
      if (params.recipient_blind_id) q.set('recipient_blind_id', params.recipient_blind_id);
      if (params.ticket_id) q.set('ticket_id', params.ticket_id);
      if (params.is_founder) q.set('is_founder', 'true');

      const res = await fetch(`${RELAY_BASE_URL.replace(/\/$/, '')}/api/relay/inbox?${q.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        return json.messages || [];
      }
      return [];
    } catch (e) {
      console.warn('[relayClient] fetchRelayInbox network error:', e);
      return [];
    }
  },

  /**
   * ACK Vaporization: Immediately deletes message from D1 and attachment from R2.
   */
  async confirmRelayAck(id: string, r2_key?: string | null): Promise<boolean> {
    try {
      const res = await fetch(`${RELAY_BASE_URL.replace(/\/$/, '')}/api/relay/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, r2_key }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Uploads base64 encoded attachment directly to Cloudflare R2 bucket.
   */
  async uploadRelayAttachmentBase64(
    base64Data: string,
    contentType: string = 'application/octet-stream'
  ): Promise<{ success: boolean; r2_key?: string; error?: string }> {
    try {
      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
      const res = await fetch(`${RELAY_BASE_URL.replace(/\/$/, '')}/api/relay/upload-attachment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: cleanBase64, content_type: contentType }),
      });
      if (res.ok) {
        const json = await res.json();
        return { success: true, r2_key: json.r2_key };
      }
      return { success: false, error: await res.text() };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Downloads attachment from Cloudflare R2 bucket as base64 string.
   */
  async fetchRelayAttachment(r2Key: string): Promise<string | null> {
    try {
      const res = await fetch(
        `${RELAY_BASE_URL.replace(/\/$/, '')}/api/relay/attachment/${encodeURIComponent(r2Key)}?format=base64`,
        {
          headers: { Accept: 'application/json' },
        }
      );
      if (res.ok) {
        const json = await res.json();
        return json.base64 || null;
      }
      return null;
    } catch (e: any) {
      console.warn('[relayClient] fetchRelayAttachment error:', e);
      return null;
    }
  },

  /**
   * Sends admin active heartbeat to Cloudflare D1 roster.
   */
  async sendRosterHeartbeat(params: {
    blind_id: string;
    enterprise_blind_id: string;
    org_id?: string;
    app_id?: string;
    name?: string;
    categories?: string[] | string;
    open_tickets?: number;
    is_active?: number;
    snooze_until?: number;
  }): Promise<{ success: boolean; is_active?: number; counter?: number; snooze_until?: number; error?: string }> {
    try {
      const res = await fetch(`${RELAY_BASE_URL.replace(/\/$/, '')}/api/roster/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) return await res.json();
      return { success: false, error: await res.text() };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Requests optimal admin allocation for a new ticket via fair load-balancing.
   */
  async allocateTicketAdmin(params: {
    enterprise_blind_id: string;
    org_id?: string;
    app_id?: string;
    category?: string;
  }): Promise<{ success: boolean; assigned_admin_blind_id: string; name?: string | null; counter?: number; open_tickets?: number; sla_minutes?: number; error?: string }> {
    try {
      const res = await fetch(`${RELAY_BASE_URL.replace(/\/$/, '')}/api/tickets/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) return await res.json();
      return { success: false, assigned_admin_blind_id: 'unassigned', error: await res.text() };
    } catch (e: any) {
      return { success: false, assigned_admin_blind_id: 'unassigned', error: e.message };
    }
  },

  /**
   * Claims next waiting ticket from enterprise pool (Fair Queue / Round-Robin)
   */
  async claimNextPoolTicket(params: {
    enterprise_blind_id: string;
    admin_blind_id: string;
    admin_name?: string;
  }): Promise<{ success: boolean; claimed: boolean; ticket_id?: string; item?: any }> {
    try {
      const res = await fetch(`${RELAY_BASE_URL.replace(/\/$/, '')}/api/tickets/claim-next-pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) return await res.json();
      return { success: false, claimed: false };
    } catch (e) {
      console.warn('[relayClient] claimNextPoolTicket error:', e);
      return { success: false, claimed: false };
    }
  },

  /**
   * Dispatches twin tickets (new assigned admin ticket + revoked read-only ticket) to D1 transient pool.
   */
  async reissueTwinTickets(params: {
    twin_a: Partial<RelayInboxMessage>;
    twin_b: Partial<RelayInboxMessage>;
    old_admin_blind_id?: string;
    new_admin_blind_id?: string;
    enterprise_blind_id?: string;
  }): Promise<{ success: boolean; twin_a_id?: string; twin_b_id?: string; error?: string }> {
    try {
      const res = await fetch(`${RELAY_BASE_URL.replace(/\/$/, '')}/api/tickets/reissue-twin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) return await res.json();
      return { success: false, error: await res.text() };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  /**
   * Fetches full admin roster for an enterprise with real-time online/break statuses.
   */
  async fetchAdminRoster(enterpriseBlindId: string): Promise<any[]> {
    try {
      const res = await fetch(
        `${RELAY_BASE_URL.replace(/\/$/, '')}/api/roster/list?enterprise_blind_id=${encodeURIComponent(enterpriseBlindId)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (res.ok) {
        const json = await res.json();
        return json.roster || [];
      }
      return [];
    } catch (e) {
      console.warn('[relayClient] fetchAdminRoster error:', e);
      return [];
    }
  },
};

export default relayClient;
