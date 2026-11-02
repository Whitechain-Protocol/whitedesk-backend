/**
 * WhiteDesk - Federal Data Harvesting (FDH) Types
 * Sovereign, Zero-Knowledge Fleet Data Aggregation & SQLite Ingestion
 */

export interface FDHScope {
  targetRoles: ('admin' | 'user')[];
  tenantBlindId: string;
  tenantName: string;
  organizationId?: string | null; // Bölüm (Unit)
  applicationId?: string | null;  // Uygulama (App)
}

export interface FDHJob {
  jobId: string;
  initiatorWhiteId: string;
  initiatorRole: string;
  scope: FDHScope;
  storagePath: string;
  status: 'idle' | 'broadcasting' | 'harvesting' | 'completed' | 'error';
  totalTickets: number;
  totalMessages: number;
  totalAttachments: number;
  totalBytesCollected: number;
  createdAt: number;
  updatedAt: number;
  errorMessage?: string;
}

export interface FDHAttachmentRecord {
  id: string;
  ticketId: string;
  messageId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileHash: string;
  storageRelativePath: string;
  createdAt: number;
}

export interface FDHManifest {
  schemaVersion: string;
  jobId: string;
  harvestedAt: number;
  harvestedByWhiteId: string;
  harvestedByRole: string;
  scope: FDHScope;
  storagePath: string;
  summary: {
    totalTickets: number;
    totalMessages: number;
    totalAttachments: number;
    totalBytes: number;
  };
  tickets: Array<{
    id: string;
    ticketNumber: string;
    tenantBlindId: string;
    tenantName: string;
    organizationId?: string;
    applicationId?: string;
    title: string;
    status: string;
    priority: string;
    creatorType: string;
    creatorBlindId: string;
    creatorAlias: string;
    assignedAdminBlindId?: string;
    assignedAdminAlias?: string;
    createdAt: number;
    updatedAt: number;
    messageCount: number;
    attachmentCount: number;
  }>;
}

export interface FDHIncomingPayload {
  jobId: string;
  senderWhiteId: string;
  senderBlindId: string;
  senderRole: string;
  tenantBlindId: string;
  tickets: any[];
  messages: Record<string, any[]>; // ticketId -> messages
  attachments: Array<{
    ticketId: string;
    messageId: string;
    name: string;
    mimeType: string;
    size: number;
    base64Data?: string;
    r2Key?: string;
  }>;
  timestamp: number;
}
