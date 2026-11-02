import ReactNativeBlobUtil from 'react-native-blob-util';
import * as Crypto from 'expo-crypto';
import { HelpDeskTicket, HelpDeskMessage } from '../helpDeskService';
import { keystoreTicketVault } from '../keystoreTicketVault';
import { relayClient } from '../relayClient';
import { FDHScope, FDHJob, FDHManifest, FDHAttachmentRecord, FDHIncomingPayload } from './types';

class FederalHarvestService {
  /**
   * Returns standard download directory for harvested data.
   */
  public getDefaultStoragePath(): string {
    const base = ReactNativeBlobUtil.fs.dirs.DownloadDir || ReactNativeBlobUtil.fs.dirs.DocumentDir;
    return `${base}/WhiteDesk_Harvest`;
  }

  /**
   * Sanitizes string for SQL string literals.
   */
  private escapeSql(val: any): string {
    if (val === null || val === undefined) return 'NULL';
    const s = String(val).replace(/'/g, "''");
    return `'${s}'`;
  }

  /**
   * Computes SHA-256 hash of a string/data.
   */
  private async computeHash(data: string): Promise<string> {
    try {
      return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
    } catch {
      return Math.random().toString(36).substring(2, 14);
    }
  }

  /**
   * Filters tickets based on chosen FDH scope.
   */
  public filterTicketsByScope(tickets: HelpDeskTicket[], scope: FDHScope): HelpDeskTicket[] {
    return tickets.filter(t => {
      // 1. Firma (Tenant) Filter
      if (scope.tenantBlindId && scope.tenantBlindId !== 'all') {
        const tBlind = t.enterprise_blind_id || (t as any).tenant_blind_id || '';
        if (tBlind && tBlind.toLowerCase() !== scope.tenantBlindId.toLowerCase()) {
          return false;
        }
      }

      // 2. Bölüm / Organizasyon Filter
      if (scope.organizationId && scope.organizationId !== 'all') {
        const org = (t as any).org_id || (t as any).organization_id || '';
        if (org && org !== scope.organizationId) {
          return false;
        }
      }

      // 3. Uygulama Filter
      if (scope.applicationId && scope.applicationId !== 'all') {
        const app = t.app_id || (t as any).application_id || '';
        if (app && app !== scope.applicationId) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Generates standard SQLite 3 & PostgreSQL compliant SQL schema.
   */
  public getSqliteSchema(): string {
    return `-- ====================================================================
-- WhiteDesk Sovereign Federal Data Harvesting (FDH) Database
-- Engine: SQLite 3 / PostgreSQL Multi-Platform Ingestion Schema
-- Generated: ${new Date().toISOString()}
-- ====================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS fdh_batches (
    batch_id TEXT PRIMARY KEY,
    harvested_at INTEGER,
    harvested_by TEXT,
    target_role TEXT,
    tenant_blind_id TEXT,
    tenant_name TEXT,
    organization_id TEXT,
    application_id TEXT,
    total_tickets INTEGER,
    total_messages INTEGER,
    total_attachments INTEGER
);

CREATE TABLE IF NOT EXISTS fdh_tickets (
    id TEXT PRIMARY KEY,
    ticket_number TEXT,
    tenant_blind_id TEXT,
    tenant_name TEXT,
    organization_id TEXT,
    application_id TEXT,
    title TEXT,
    status TEXT,
    priority TEXT,
    creator_type TEXT,
    creator_blind_id TEXT,
    creator_alias TEXT,
    assigned_admin_blind_id TEXT,
    assigned_admin_alias TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS fdh_messages (
    id TEXT PRIMARY KEY,
    ticket_id TEXT,
    sender_type TEXT,
    sender_blind_id TEXT,
    sender_alias TEXT,
    is_internal INTEGER,
    is_whisper INTEGER,
    content TEXT,
    created_at INTEGER,
    FOREIGN KEY (ticket_id) REFERENCES fdh_tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fdh_attachments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT,
    message_id TEXT,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    file_hash TEXT,
    storage_relative_path TEXT,
    created_at INTEGER,
    FOREIGN KEY (ticket_id) REFERENCES fdh_tickets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fdh_tkt_tenant ON fdh_tickets(tenant_blind_id);
CREATE INDEX IF NOT EXISTS idx_fdh_tkt_org ON fdh_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_fdh_tkt_app ON fdh_tickets(application_id);
CREATE INDEX IF NOT EXISTS idx_fdh_tkt_created ON fdh_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_fdh_msg_tkt ON fdh_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_fdh_att_tkt ON fdh_attachments(ticket_id);
`;
  }

  /**
   * Executes local harvest and writes full SQLite DDL/DML, manifest and attachments.
   */
  public async executeLocalHarvest(
    jobId: string,
    scope: FDHScope,
    storagePath: string,
    initiatorWhiteId: string,
    initiatorRole: string,
    onProgress?: (info: { stage: string; current: number; total: number }) => void
  ): Promise<{
    success: boolean;
    totalTickets: number;
    totalMessages: number;
    totalAttachments: number;
    totalBytes: number;
    targetDir: string;
    error?: string;
  }> {
    try {
      const cleanPath = storagePath.trim();
      const fs = ReactNativeBlobUtil.fs;

      // 1. Ensure directory hierarchy exists
      if (!(await fs.isDir(cleanPath))) {
        await fs.mkdir(cleanPath);
      }
      const attachmentsDir = `${cleanPath}/attachments`;
      if (!(await fs.isDir(attachmentsDir))) {
        await fs.mkdir(attachmentsDir);
      }

      // 2. Fetch local tickets & filter
      onProgress?.({ stage: 'Yerel biletler taranıyor...', current: 0, total: 0 });
      const allLocalTickets = await keystoreTicketVault.getTickets();
      const targetTickets = this.filterTicketsByScope(allLocalTickets, scope);

      let totalMessages = 0;
      let totalAttachments = 0;
      let totalBytes = 0;

      const sqlStatements: string[] = [];
      sqlStatements.push(this.getSqliteSchema());

      // Batch row
      sqlStatements.push(`INSERT OR REPLACE INTO fdh_batches VALUES (
  ${this.escapeSql(jobId)},
  ${Date.now()},
  ${this.escapeSql(initiatorWhiteId)},
  ${this.escapeSql(scope.targetRoles.join(','))},
  ${this.escapeSql(scope.tenantBlindId)},
  ${this.escapeSql(scope.tenantName)},
  ${this.escapeSql(scope.organizationId || 'all')},
  ${this.escapeSql(scope.applicationId || 'all')},
  ${targetTickets.length},
  0,
  0
);`);

      const manifestTickets: FDHManifest['tickets'] = [];
      const richHarvestData: any[] = [];

      // 3. Process each ticket
      for (let i = 0; i < targetTickets.length; i++) {
        const tkt = targetTickets[i];
        const tktNum = (tkt as any).ticket_number || tkt.id;
        const orgId = tkt.org_id || (tkt as any).organization_id || 'general';
        const tktTitle = tkt.subject || (tkt as any).title || 'Başlıksız Bilet';
        const tktPriority = (tkt as any).priority || 'medium';
        const userAlias = (tkt as any).user_alias || '';
        const adminAlias = tkt.transfer_target_alias || (tkt as any).assigned_admin_alias || '';

        onProgress?.({
          stage: `Bilet işleniyor (${i + 1}/${targetTickets.length}): ${tktNum}`,
          current: i + 1,
          total: targetTickets.length,
        });

        // Insert ticket SQL
        sqlStatements.push(`INSERT OR REPLACE INTO fdh_tickets VALUES (
  ${this.escapeSql(tkt.id)},
  ${this.escapeSql(tktNum)},
  ${this.escapeSql(tkt.enterprise_blind_id || scope.tenantBlindId)},
  ${this.escapeSql(scope.tenantName)},
  ${this.escapeSql(orgId)},
  ${this.escapeSql(tkt.app_id || 'whitedesk')},
  ${this.escapeSql(tktTitle)},
  ${this.escapeSql(tkt.status || 'open')},
  ${this.escapeSql(tktPriority)},
  ${this.escapeSql(tkt.user_blind_id ? 'user' : 'admin')},
  ${this.escapeSql(tkt.user_blind_id || tkt.user_white_id || '')},
  ${this.escapeSql(userAlias)},
  ${this.escapeSql(tkt.assigned_admin_blind_id || '')},
  ${this.escapeSql(adminAlias)},
  ${tkt.created_at || Date.now()},
  ${tkt.updated_at || Date.now()}
);`);

        // Fetch messages
        const msgs = await keystoreTicketVault.getMessages(tkt.id);
        let tktAttachmentCount = 0;

        // Ensure ticket attachments subfolder exists
        const tktAttDir = `${attachmentsDir}/${tkt.id}`;
        let createdTktAttDir = false;

        for (const msg of msgs) {
          totalMessages++;
          sqlStatements.push(`INSERT OR REPLACE INTO fdh_messages VALUES (
  ${this.escapeSql(msg.id)},
  ${this.escapeSql(tkt.id)},
  ${this.escapeSql(msg.sender_alias === 'Admin' || (msg as any).is_admin ? 'admin' : 'user')},
  ${this.escapeSql(msg.sender_blind_id || msg.sender_white_id || '')},
  ${this.escapeSql(msg.sender_alias || '')},
  ${msg.is_internal ? 1 : 0},
  ${(msg as any).is_whisper ? 1 : 0},
  ${this.escapeSql(msg.message || (msg as any).content || '')},
  ${msg.created_at || Date.now()}
);`);

          // Process Single Attachment
          if (msg.attachment_data && msg.attachment_name) {
            if (!createdTktAttDir) {
              if (!(await fs.isDir(tktAttDir))) await fs.mkdir(tktAttDir);
              createdTktAttDir = true;
            }

            const rawName = msg.attachment_name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const sanitizedName = rawName || `attachment_${msg.id}.dat`;
            const destPath = `${tktAttDir}/${sanitizedName}`;
            const relPath = `attachments/${tkt.id}/${sanitizedName}`;

            try {
              let b64 = msg.attachment_data;
              if (b64.startsWith('file://')) {
                const srcPath = b64.replace('file://', '');
                if (await fs.exists(srcPath)) {
                  b64 = await fs.readFile(srcPath, 'base64');
                }
              } else {
                b64 = b64.replace(/^data:[^;]+;base64,/, '');
              }

              if (b64 && b64.length > 0) {
                await fs.writeFile(destPath, b64, 'base64');
                const fileHash = await this.computeHash(b64);
                const fileSizeBytes = Math.round((b64.length * 3) / 4);
                totalBytes += fileSizeBytes;
                totalAttachments++;
                tktAttachmentCount++;

                sqlStatements.push(`INSERT OR REPLACE INTO fdh_attachments VALUES (
  ${this.escapeSql(`att_${msg.id}`)},
  ${this.escapeSql(tkt.id)},
  ${this.escapeSql(msg.id)},
  ${this.escapeSql(sanitizedName)},
  ${fileSizeBytes},
  ${this.escapeSql(msg.attachment_type || 'application/octet-stream')},
  ${this.escapeSql(fileHash)},
  ${this.escapeSql(relPath)},
  ${msg.created_at || Date.now()}
);`);
              }
            } catch (attErr) {
              console.warn('[FederalHarvest] Attachment write error:', attErr);
            }
          }

          // Process Multi Attachments
          if (msg.attachments && Array.isArray(msg.attachments)) {
            for (let aIdx = 0; aIdx < msg.attachments.length; aIdx++) {
              const a = msg.attachments[aIdx];
              if (!a.data || !a.name) continue;

              if (!createdTktAttDir) {
                if (!(await fs.isDir(tktAttDir))) await fs.mkdir(tktAttDir);
                createdTktAttDir = true;
              }

              const cleanName = a.name.replace(/[^a-zA-Z0-9._-]/g, '_') || `att_${msg.id}_${aIdx}.dat`;
              const destPath = `${tktAttDir}/${cleanName}`;
              const relPath = `attachments/${tkt.id}/${cleanName}`;

              try {
                let b64 = a.data;
                if (b64.startsWith('file://')) {
                  const srcPath = b64.replace('file://', '');
                  if (await fs.exists(srcPath)) {
                    b64 = await fs.readFile(srcPath, 'base64');
                  }
                } else {
                  b64 = b64.replace(/^data:[^;]+;base64,/, '');
                }

                if (b64 && b64.length > 0) {
                  await fs.writeFile(destPath, b64, 'base64');
                  const fileHash = await this.computeHash(b64);
                  const fileSizeBytes = Math.round((b64.length * 3) / 4);
                  totalBytes += fileSizeBytes;
                  totalAttachments++;
                  tktAttachmentCount++;

                  sqlStatements.push(`INSERT OR REPLACE INTO fdh_attachments VALUES (
  ${this.escapeSql(`att_${msg.id}_${aIdx}`)},
  ${this.escapeSql(tkt.id)},
  ${this.escapeSql(msg.id)},
  ${this.escapeSql(cleanName)},
  ${fileSizeBytes},
  ${this.escapeSql((a as any).mimeType || a.type || 'application/octet-stream')},
  ${this.escapeSql(fileHash)},
  ${this.escapeSql(relPath)},
  ${msg.created_at || Date.now()}
);`);
                }
              } catch (mErr) {
                console.warn('[FederalHarvest] Multi attachment write error:', mErr);
              }
            }
          }
        }

        manifestTickets.push({
          id: tkt.id,
          ticketNumber: tktNum,
          tenantBlindId: tkt.enterprise_blind_id || scope.tenantBlindId,
          tenantName: scope.tenantName,
          organizationId: orgId,
          applicationId: tkt.app_id || undefined,
          title: tktTitle,
          status: tkt.status || 'open',
          priority: tktPriority,
          creatorType: tkt.user_blind_id ? 'user' : 'admin',
          creatorBlindId: tkt.user_blind_id || tkt.user_white_id || '',
          creatorAlias: userAlias,
          assignedAdminBlindId: tkt.assigned_admin_blind_id || undefined,
          assignedAdminAlias: adminAlias || undefined,
          createdAt: tkt.created_at || Date.now(),
          updatedAt: tkt.updated_at || Date.now(),
          messageCount: msgs.length,
          attachmentCount: tktAttachmentCount,
        });

        richHarvestData.push({
          id: tkt.id,
          ticketNumber: tktNum,
          tenantBlindId: tkt.enterprise_blind_id || scope.tenantBlindId,
          tenantName: scope.tenantName,
          organizationId: orgId,
          applicationId: tkt.app_id || 'whitedesk',
          title: tktTitle,
          status: tkt.status || 'open',
          priority: tktPriority,
          creatorType: tkt.user_blind_id ? 'user' : 'admin',
          creatorBlindId: tkt.user_blind_id || tkt.user_white_id || '',
          creatorAlias: userAlias,
          assignedAdminBlindId: tkt.assigned_admin_blind_id || undefined,
          assignedAdminAlias: adminAlias || undefined,
          createdAt: tkt.created_at || Date.now(),
          updatedAt: tkt.updated_at || Date.now(),
          messages: msgs.map(m => ({
            id: m.id,
            ticketId: tkt.id,
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

      // 4. Update batch total counts in SQL
      sqlStatements.push(`UPDATE fdh_batches SET total_messages = ${totalMessages}, total_attachments = ${totalAttachments} WHERE batch_id = ${this.escapeSql(jobId)};`);

      // 5. Write SQL file & SQLite file to destination
      const fullSqlContent = sqlStatements.join('\n\n');
      const sqlFilePath = `${cleanPath}/whitedesk_harvest.sql`;
      const sqliteFilePath = `${cleanPath}/whitedesk_harvest.sqlite`;

      await fs.writeFile(sqlFilePath, fullSqlContent, 'utf8');
      await fs.writeFile(sqliteFilePath, fullSqlContent, 'utf8');

      // 6. Write manifest JSON file
      const manifest: FDHManifest = {
        schemaVersion: '1.0.0',
        jobId,
        harvestedAt: Date.now(),
        harvestedByWhiteId: initiatorWhiteId,
        harvestedByRole: initiatorRole,
        scope,
        storagePath: cleanPath,
        summary: {
          totalTickets: targetTickets.length,
          totalMessages,
          totalAttachments,
          totalBytes,
        },
        tickets: manifestTickets,
      };

      const manifestPath = `${cleanPath}/manifest.json`;
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

      // 7. Write complete rich harvest dataset JSON file
      const richDataPayload = {
        jobId,
        harvestedAt: Date.now(),
        harvestedByWhiteId: initiatorWhiteId,
        harvestedByRole: initiatorRole,
        scope,
        summary: manifest.summary,
        tickets: richHarvestData,
      };
      const richDataPath = `${cleanPath}/whitedesk_harvest_data.json`;
      await fs.writeFile(richDataPath, JSON.stringify(richDataPayload, null, 2), 'utf8');

      return {
        success: true,
        totalTickets: targetTickets.length,
        totalMessages,
        totalAttachments,
        totalBytes,
        targetDir: cleanPath,
      };
    } catch (err: any) {
      console.error('[FederalHarvestService] Harvest execution failed:', err);
      return {
        success: false,
        totalTickets: 0,
        totalMessages: 0,
        totalAttachments: 0,
        totalBytes: 0,
        targetDir: storagePath,
        error: err.message || String(err),
      };
    }
  }

  /**
   * Dispatches FDH directive to the fleet via Cloudflare Relay.
   */
  public async broadcastHarvestDirective(
    jobId: string,
    scope: FDHScope,
    initiatorWhiteId: string,
    initiatorRole: string
  ): Promise<{ success: boolean }> {
    try {
      const payload = {
        action: 'FDH_DIRECTIVE',
        jobId,
        scope,
        initiatorWhiteId,
        initiatorRole,
        timestamp: Date.now(),
      };

      // Dispatches directive via relayClient send
      await relayClient.sendRelayMessage({
        ticket_id: `fdh_${jobId}`,
        recipient_blind_id: 'fleet_broadcast',
        sender_blind_id: initiatorWhiteId,
        encrypted_payload: JSON.stringify(payload),
      });

      return { success: true };
    } catch (e) {
      console.warn('[FederalHarvestService] Broadcast failed:', e);
      return { success: false };
    }
  }
}

export const federalHarvestService = new FederalHarvestService();
