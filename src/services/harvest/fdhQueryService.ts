import ReactNativeBlobUtil from 'react-native-blob-util';
import * as Sharing from 'expo-sharing';
import { federalHarvestService } from './federalHarvestService';
import { keystoreTicketVault } from '../keystoreTicketVault';

export interface FDHUnifiedMessage {
  id: string;
  ticketId: string;
  senderType: 'user' | 'admin';
  senderAlias: string;
  isInternal: boolean;
  isWhisper: boolean;
  content: string;
  createdAt: number;
  attachmentName?: string | null;
  attachmentType?: string | null;
  attachments?: any[];
}

export interface FDHUnifiedTicket {
  id: string;
  ticketNumber: string;
  tenantBlindId: string;
  tenantName: string;
  organizationId: string;
  applicationId: string;
  title: string;
  status: 'open' | 'pending' | 'resolved' | 'closed' | string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | string;
  creatorType: 'user' | 'admin' | string;
  creatorBlindId: string;
  creatorAlias: string;
  assignedAdminBlindId?: string | null;
  assignedAdminAlias?: string | null;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  attachmentCount: number;
  messages: FDHUnifiedMessage[];
}

export interface FDHBatchSummary {
  jobId: string;
  harvestedAt: number;
  harvestedByRole: string;
  tenantName: string;
  totalTickets: number;
  totalMessages: number;
  totalAttachments: number;
  sourceType: 'sqlite' | 'postgres';
  storagePath?: string;
  endpointUrl?: string;
}

export interface FDHFilterCriteria {
  searchQuery?: string;
  targetRole?: 'all' | 'admin' | 'user';
  status?: 'all' | 'open' | 'pending' | 'resolved' | 'closed';
  hasAttachments?: boolean;
  tenantFilter?: string;
  orgFilter?: string;
  appFilter?: string;
}

export interface FDHPostgresConfig {
  endpointUrl: string;
  apiKey?: string;
  databaseName?: string;
  sslEnabled?: boolean;
}

class FDHQueryService {
  /**
   * Returns default local storage directory for harvests.
   */
  public getDefaultLocalPath(): string {
    return federalHarvestService.getDefaultStoragePath();
  }

  /**
   * Loads harvest dataset from local storage (whitedesk_harvest_data.json or manifest.json).
   * Falls back to keystoreTicketVault if not yet harvested.
   */
  public async loadLocalHarvest(customPath?: string): Promise<{
    batch: FDHBatchSummary;
    tickets: FDHUnifiedTicket[];
  }> {
    const fs = ReactNativeBlobUtil.fs;
    const cleanPath = (customPath || this.getDefaultLocalPath()).trim();

    const richDataPath = `${cleanPath}/whitedesk_harvest_data.json`;
    const manifestPath = `${cleanPath}/manifest.json`;

    // 1. Try reading complete rich dataset
    if (await fs.exists(richDataPath)) {
      try {
        const raw = await fs.readFile(richDataPath, 'utf8');
        const parsed = JSON.parse(raw);

        const tickets: FDHUnifiedTicket[] = (parsed.tickets || []).map((t: any) => ({
          id: t.id,
          ticketNumber: t.ticketNumber || t.id,
          tenantBlindId: t.tenantBlindId || '',
          tenantName: t.tenantName || 'Kuruluş',
          organizationId: t.organizationId || 'Genel',
          applicationId: t.applicationId || 'whitedesk',
          title: t.title || 'Başlıksız',
          status: t.status || 'open',
          priority: t.priority || 'medium',
          creatorType: t.creatorType || 'user',
          creatorBlindId: t.creatorBlindId || '',
          creatorAlias: t.creatorAlias || '',
          assignedAdminBlindId: t.assignedAdminBlindId,
          assignedAdminAlias: t.assignedAdminAlias,
          createdAt: t.createdAt || Date.now(),
          updatedAt: t.updatedAt || Date.now(),
          messageCount: t.messages?.length || 0,
          attachmentCount: t.messages?.reduce((acc: number, m: any) => {
            return acc + (m.attachmentName ? 1 : 0) + (m.attachments?.length || 0);
          }, 0) || 0,
          messages: t.messages || [],
        }));

        const batch: FDHBatchSummary = {
          jobId: parsed.jobId || 'local_batch',
          harvestedAt: parsed.harvestedAt || Date.now(),
          harvestedByRole: parsed.harvestedByRole || 'Admin',
          tenantName: parsed.scope?.tenantName || 'Yerel Arşiv',
          totalTickets: tickets.length,
          totalMessages: parsed.summary?.totalMessages || tickets.reduce((s, t) => s + t.messageCount, 0),
          totalAttachments: parsed.summary?.totalAttachments || tickets.reduce((s, t) => s + t.attachmentCount, 0),
          sourceType: 'sqlite',
          storagePath: cleanPath,
        };

        return { batch, tickets };
      } catch (err) {
        console.warn('[FDHQueryService] Error reading richDataPath:', err);
      }
    }

    // 2. Try reading manifest.json
    if (await fs.exists(manifestPath)) {
      try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        const parsed = JSON.parse(raw);

        const tickets: FDHUnifiedTicket[] = (parsed.tickets || []).map((t: any) => ({
          id: t.id,
          ticketNumber: t.ticketNumber || t.id,
          tenantBlindId: t.tenantBlindId || '',
          tenantName: t.tenantName || 'Kuruluş',
          organizationId: t.organizationId || 'Genel',
          applicationId: t.applicationId || 'whitedesk',
          title: t.title || 'Başlıksız',
          status: t.status || 'open',
          priority: t.priority || 'medium',
          creatorType: t.creatorType || 'user',
          creatorBlindId: t.creatorBlindId || '',
          creatorAlias: t.creatorAlias || '',
          assignedAdminBlindId: t.assignedAdminBlindId,
          assignedAdminAlias: t.assignedAdminAlias,
          createdAt: t.createdAt || Date.now(),
          updatedAt: t.updatedAt || Date.now(),
          messageCount: t.messageCount || 0,
          attachmentCount: t.attachmentCount || 0,
          messages: [],
        }));

        const batch: FDHBatchSummary = {
          jobId: parsed.jobId || 'manifest_batch',
          harvestedAt: parsed.harvestedAt || Date.now(),
          harvestedByRole: parsed.harvestedByRole || 'Admin',
          tenantName: parsed.scope?.tenantName || 'Yerel Arşiv',
          totalTickets: parsed.summary?.totalTickets || tickets.length,
          totalMessages: parsed.summary?.totalMessages || 0,
          totalAttachments: parsed.summary?.totalAttachments || 0,
          sourceType: 'sqlite',
          storagePath: cleanPath,
        };

        return { batch, tickets };
      } catch (mErr) {
        console.warn('[FDHQueryService] Error reading manifestPath:', mErr);
      }
    }

    // 3. Fallback: live tickets from keystoreTicketVault
    const vaultTickets = await keystoreTicketVault.getTickets();
    const tickets: FDHUnifiedTicket[] = [];

    for (const vt of vaultTickets) {
      const msgs = await keystoreTicketVault.getMessages(vt.id);
      tickets.push({
        id: vt.id,
        ticketNumber: (vt as any).ticket_number || vt.id,
        tenantBlindId: vt.enterprise_blind_id || '',
        tenantName: 'Canlı Kasa',
        organizationId: vt.org_id || 'Genel',
        applicationId: vt.app_id || 'whitedesk',
        title: vt.subject || 'Başlıksız',
        status: vt.status || 'open',
        priority: (vt as any).priority || 'medium',
        creatorType: vt.user_blind_id ? 'user' : 'admin',
        creatorBlindId: vt.user_blind_id || vt.user_white_id || '',
        creatorAlias: (vt as any).user_alias || '',
        assignedAdminBlindId: vt.assigned_admin_blind_id,
        assignedAdminAlias: vt.transfer_target_alias,
        createdAt: vt.created_at || Date.now(),
        updatedAt: vt.updated_at || Date.now(),
        messageCount: msgs.length,
        attachmentCount: msgs.reduce((acc, m) => acc + (m.attachment_name ? 1 : 0) + (m.attachments?.length || 0), 0),
        messages: msgs.map(m => ({
          id: m.id,
          ticketId: vt.id,
          senderType: m.sender_alias === 'Admin' || (m as any).is_admin ? 'admin' : 'user',
          senderAlias: m.sender_alias || '',
          isInternal: Boolean(m.is_internal),
          isWhisper: Boolean((m as any).is_whisper),
          content: m.message || (m as any).content || '',
          createdAt: m.created_at || Date.now(),
          attachmentName: m.attachment_name,
          attachmentType: m.attachment_type,
          attachments: m.attachments,
        })),
      });
    }

    const batch: FDHBatchSummary = {
      jobId: 'live_vault',
      harvestedAt: Date.now(),
      harvestedByRole: 'founder',
      tenantName: 'Yerel Güvenli Kasa (Canlı)',
      totalTickets: tickets.length,
      totalMessages: tickets.reduce((s, t) => s + t.messageCount, 0),
      totalAttachments: tickets.reduce((s, t) => s + t.attachmentCount, 0),
      sourceType: 'sqlite',
      storagePath: cleanPath,
    };

    return { batch, tickets };
  }

  /**
   * Queries remote PostgreSQL gateway / PostgREST endpoint.
   */
  public async queryPostgresHarvest(config: FDHPostgresConfig): Promise<{
    batch: FDHBatchSummary;
    tickets: FDHUnifiedTicket[];
  }> {
    const rawUrl = config.endpointUrl.trim().replace(/\/$/, '');
    if (!rawUrl) {
      throw new Error('Geçerli bir PostgreSQL ağ geçidi / REST URL giriniz.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey.trim()}`;
      headers.apikey = config.apiKey.trim();
    }

    // Attempt fetching from /fdh_tickets or /api/tickets or PostgREST
    const endpointCandidates = [
      `${rawUrl}/fdh_tickets?select=*,fdh_messages(*)&order=created_at.desc`,
      `${rawUrl}/tickets`,
      `${rawUrl}/api/fdh/query`,
      rawUrl,
    ];

    let lastError: any = null;

    for (const url of endpointCandidates) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          const rawTickets = Array.isArray(data) ? data : data.tickets || data.data || [];

          const tickets: FDHUnifiedTicket[] = rawTickets.map((t: any) => {
            const rawMsgs = t.fdh_messages || t.messages || [];
            return {
              id: String(t.id || t.ticket_id),
              ticketNumber: String(t.ticket_number || t.id),
              tenantBlindId: t.tenant_blind_id || '',
              tenantName: t.tenant_name || 'PostgreSQL Deposu',
              organizationId: t.organization_id || 'Genel',
              applicationId: t.application_id || 'whitedesk',
              title: t.title || 'Başlıksız',
              status: t.status || 'open',
              priority: t.priority || 'medium',
              creatorType: t.creator_type || 'user',
              creatorBlindId: t.creator_blind_id || '',
              creatorAlias: t.creator_alias || '',
              assignedAdminBlindId: t.assigned_admin_blind_id,
              assignedAdminAlias: t.assigned_admin_alias,
              createdAt: Number(t.created_at) || Date.now(),
              updatedAt: Number(t.updated_at) || Date.now(),
              messageCount: rawMsgs.length,
              attachmentCount: Number(t.total_attachments) || 0,
              messages: rawMsgs.map((m: any) => ({
                id: String(m.id),
                ticketId: String(t.id),
                senderType: m.sender_type || (m.is_admin ? 'admin' : 'user'),
                senderAlias: m.sender_alias || '',
                isInternal: Boolean(m.is_internal),
                isWhisper: Boolean(m.is_whisper),
                content: m.content || m.message || '',
                createdAt: Number(m.created_at) || Date.now(),
                attachmentName: m.attachment_name,
                attachmentType: m.attachment_type || m.mime_type,
                attachments: m.attachments,
              })),
            };
          });

          const batch: FDHBatchSummary = {
            jobId: `pg_${Date.now()}`,
            harvestedAt: Date.now(),
            harvestedByRole: 'enterprise_pg',
            tenantName: config.databaseName || 'PostgreSQL Kurumsal Havuz',
            totalTickets: tickets.length,
            totalMessages: tickets.reduce((s, t) => s + t.messageCount, 0),
            totalAttachments: tickets.reduce((s, t) => s + t.attachmentCount, 0),
            sourceType: 'postgres',
            endpointUrl: rawUrl,
          };

          return { batch, tickets };
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error(
      lastError?.message || 'PostgreSQL uç noktasına bağlanılamadı. Lütfen URL ve yetki anahtarını kontrol edin.'
    );
  }

  /**
   * Fast in-memory filtering and search for tickets.
   */
  public filterTickets(tickets: FDHUnifiedTicket[], criteria: FDHFilterCriteria): FDHUnifiedTicket[] {
    return tickets.filter(t => {
      // 1. Search Query
      if (criteria.searchQuery && criteria.searchQuery.trim().length > 0) {
        const q = criteria.searchQuery.trim().toLowerCase();
        const matchesNumber = t.ticketNumber.toLowerCase().includes(q);
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesUser = t.creatorAlias.toLowerCase().includes(q);
        const matchesAdmin = (t.assignedAdminAlias || '').toLowerCase().includes(q);
        const matchesOrg = t.organizationId.toLowerCase().includes(q);
        const matchesMsg = t.messages.some(m => m.content.toLowerCase().includes(q));

        if (!matchesNumber && !matchesTitle && !matchesUser && !matchesAdmin && !matchesOrg && !matchesMsg) {
          return false;
        }
      }

      // 2. Target Role (Creator filter)
      if (criteria.targetRole && criteria.targetRole !== 'all') {
        if (t.creatorType !== criteria.targetRole) {
          return false;
        }
      }

      // 3. Status filter
      if (criteria.status && criteria.status !== 'all') {
        if (t.status.toLowerCase() !== criteria.status.toLowerCase()) {
          return false;
        }
      }

      // 4. Attachments filter
      if (criteria.hasAttachments) {
        if (t.attachmentCount <= 0) {
          return false;
        }
      }

      // 5. Tenant filter
      if (criteria.tenantFilter && criteria.tenantFilter !== 'all') {
        if (t.tenantBlindId !== criteria.tenantFilter && t.tenantName !== criteria.tenantFilter) {
          return false;
        }
      }

      // 6. Organization filter
      if (criteria.orgFilter && criteria.orgFilter !== 'all') {
        if (t.organizationId !== criteria.orgFilter) {
          return false;
        }
      }

      // 7. Application filter
      if (criteria.appFilter && criteria.appFilter !== 'all') {
        if (t.applicationId !== criteria.appFilter) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Opens or shares an attachment file.
   */
  public async openOrShareAttachment(filePath: string): Promise<void> {
    const fs = ReactNativeBlobUtil.fs;
    if (await fs.exists(filePath)) {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath);
      }
    }
  }
}

export const fdhQueryService = new FDHQueryService();
