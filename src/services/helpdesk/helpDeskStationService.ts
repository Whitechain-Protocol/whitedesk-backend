import { executeSql, escapeSqlString, generateCosmoAlias, clearCategoryCache, _categoryCache } from './db';
import { keystoreConfigVault } from '../keystoreConfigVault';
import { keystoreTicketVault } from '../keystoreTicketVault';
import { WhiteDeskCrypto } from '../../whitedesk-sdk';
import {
  CURRENT_APP_ID,
  HelpDeskCategory,
  AppEntry,
  AppCatEntry,
  AppRegStatus,
  AppRequestEntry,
  AdminEntry,
  OrgEntry,
  ApprovalEntry,
  AdminAllocEntry,
} from './types';

/**
 * WhiteDesk Station Service:
 * Handles schema initialization, multi-tenant organizations, applications,
 * category trees, admin allocations, approval queues, and SDK bridge keys.
 */
export const helpDeskStationService = {
  /**
   * Ensures the database schema has the required tables and initial seed data.
   * Idempotent: Checks if tables exist. If present, continues smoothly.
   */
  async ensureSchema(): Promise<void> {
    try {
      const checkRows = await executeSql("SELECT to_regclass('public.whitedesk_tickets') as tbl;");
      if (checkRows.length > 0 && checkRows[0]?.tbl) {
        return;
      }

      const statements = [
        `CREATE TABLE IF NOT EXISTS whitedesk_enterprises (
            enterprise_blind_id VARCHAR(128) PRIMARY KEY,
            name VARCHAR(128) NOT NULL,
            org_pub TEXT,
            is_founder_tenant BOOLEAN DEFAULT FALSE,
            logo_uri TEXT,
            logo_align VARCHAR(16) DEFAULT 'center',
            advanced_features_config JSONB DEFAULT '{"voiceCall":{"enabled":true,"policy":"mutual_consent"},"escalation":{"enabled":true,"slaHours":4},"pushToTalk":{"enabled":true,"allowedOrgs":[],"maxBurstSeconds":15},"selfDestruct":{"enabled":true,"retentionAfterResolvedHours":72,"escalationSlaHours":4},"proofOfIntegrity":{"enabled":true,"autoDownloadReceipt":true}}'::jsonb,
            custom_fields JSONB DEFAULT '[]'::jsonb,
            catalog JSONB DEFAULT '[]'::jsonb,
            plan_id VARCHAR(32) DEFAULT 'trial',
            billing_cycle VARCHAR(16) DEFAULT 'monthly',
            license_status VARCHAR(32) DEFAULT 'trial_active',
            trial_start_at TEXT,
            trial_end_at TEXT,
            subscription_start_at TEXT,
            subscription_end_at TEXT,
            grace_period_days INTEGER DEFAULT 3,
            warning_intervals INTEGER DEFAULT 12,
            grace_ends_at TEXT,
            license_hash TEXT,
            created_at BIGINT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS whitedesk_apps (
            app_id VARCHAR(64) PRIMARY KEY,
            enterprise_blind_id VARCHAR(128) DEFAULT 'default',
            org_id VARCHAR(64) DEFAULT 'default',
            name VARCHAR(128) NOT NULL,
            description TEXT,
            icon VARCHAR(64) DEFAULT 'Layers',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS whitedesk_orgs (
            org_id VARCHAR(64) PRIMARY KEY,
            enterprise_blind_id VARCHAR(128) DEFAULT 'default',
            name VARCHAR(128) NOT NULL,
            public_key TEXT,
            created_by VARCHAR(128),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS whitedesk_categories (
            category_id VARCHAR(64) PRIMARY KEY,
            enterprise_blind_id VARCHAR(128) NOT NULL DEFAULT 'default',
            org_id VARCHAR(64) DEFAULT 'all',
            app_id VARCHAR(64) DEFAULT 'all',
            scope_type VARCHAR(32) NOT NULL DEFAULT 'app',
            categories JSONB NOT NULL DEFAULT '[]'::jsonb,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS whitedesk_tickets (
            id VARCHAR(32) PRIMARY KEY,
            enterprise_blind_id VARCHAR(128),
            org_id VARCHAR(64) NOT NULL DEFAULT 'default',
            app_id VARCHAR(64) NOT NULL DEFAULT 'whitedesk',
            user_white_id VARCHAR(128),
            user_blind_id VARCHAR(128) NOT NULL,
            user_pubkey TEXT,
            ticket_pubkey TEXT,
            subject TEXT NOT NULL,
            category VARCHAR(64) NOT NULL DEFAULT 'general',
            payload TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'open',
            is_discussion BOOLEAN DEFAULT FALSE,
            last_admin_reply_at BIGINT,
            assigned_admin_blind_id VARCHAR(128),
            resolution_note TEXT,
            auto_delete_at BIGINT,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS whitedesk_ticket_messages (
            id VARCHAR(64) PRIMARY KEY,
            ticket_id VARCHAR(32) NOT NULL,
            app_id VARCHAR(64) NOT NULL DEFAULT 'whitedesk',
            sender_white_id VARCHAR(128) NOT NULL,
            sender_alias VARCHAR(64),
            sender_blind_id VARCHAR(128),
            is_admin BOOLEAN DEFAULT FALSE,
            message TEXT NOT NULL,
            attachment_data TEXT,
            attachment_name VARCHAR(255),
            attachment_type VARCHAR(32),
            created_at BIGINT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS whitedesk_admins (
            id SERIAL PRIMARY KEY,
            white_id VARCHAR(128) UNIQUE NOT NULL,
            enterprise_blind_id VARCHAR(128) DEFAULT 'default',
            alias VARCHAR(64) NOT NULL,
            role VARCHAR(32) NOT NULL DEFAULT 'admin',
            pub_key TEXT,
            org_id VARCHAR(64) DEFAULT 'all',
            app_id VARCHAR(64) DEFAULT 'all',
            is_active BOOLEAN DEFAULT TRUE,
            granted_by VARCHAR(128),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS whitedesk_approvals (
            id SERIAL PRIMARY KEY,
            type VARCHAR(64) NOT NULL,
            tenant_blind_id VARCHAR(128) NOT NULL DEFAULT 'default',
            candidate_white_id VARCHAR(128),
            candidate_blind_id VARCHAR(128),
            candidate_alias VARCHAR(64),
            target_org_id VARCHAR(64),
            target_app_id VARCHAR(64),
            target_categories TEXT,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            requested_at TIMESTAMPTZ DEFAULT NOW(),
            reviewed_at TIMESTAMPTZ,
            reviewed_by VARCHAR(128)
        );`,
        `CREATE TABLE IF NOT EXISTS whitedesk_user_bindings (
            id SERIAL PRIMARY KEY,
            user_blind_id VARCHAR(128) NOT NULL,
            tenant_blind_id VARCHAR(128) NOT NULL DEFAULT 'default',
            org_id VARCHAR(64) NOT NULL DEFAULT 'default',
            app_id VARCHAR(64) NOT NULL DEFAULT 'all',
            alias VARCHAR(64),
            status VARCHAR(32) DEFAULT 'active',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_user_binding UNIQUE (user_blind_id, tenant_blind_id, org_id)
        );`,
        `CREATE TABLE IF NOT EXISTS whitedesk_recovery_hashes (
            hash VARCHAR(128) PRIMARY KEY,
            type VARCHAR(32) NOT NULL,
            enterprise_blind_id VARCHAR(128),
            is_claimed BOOLEAN DEFAULT FALSE,
            claimed_by VARCHAR(128),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE TABLE IF NOT EXISTS whitedesk_app_requests (
            id SERIAL PRIMARY KEY,
            app_id VARCHAR(64) NOT NULL,
            app_name VARCHAR(128) NOT NULL,
            description TEXT,
            requestor_id VARCHAR(128),
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE INDEX IF NOT EXISTS idx_whitedesk_tickets_user ON whitedesk_tickets(user_blind_id);`,
        `CREATE INDEX IF NOT EXISTS idx_whitedesk_tickets_app_org ON whitedesk_tickets(app_id, org_id);`,
        `CREATE INDEX IF NOT EXISTS idx_whitedesk_tickets_status ON whitedesk_tickets(status);`,
        `CREATE INDEX IF NOT EXISTS idx_whitedesk_tickets_updated ON whitedesk_tickets(updated_at DESC);`,
        `CREATE INDEX IF NOT EXISTS idx_whitedesk_msgs_ticket ON whitedesk_ticket_messages(ticket_id);`,
        `CREATE INDEX IF NOT EXISTS idx_whitedesk_approvals_status ON whitedesk_approvals(status);`,
        `ALTER TABLE whitedesk_tickets ADD COLUMN IF NOT EXISTS auto_delete_at BIGINT;`,
        `ALTER TABLE whitedesk_ticket_messages ADD COLUMN IF NOT EXISTS attachment_data TEXT;`,
        `ALTER TABLE whitedesk_ticket_messages ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);`,
        `ALTER TABLE whitedesk_ticket_messages ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(32);`,
        `ALTER TABLE whitedesk_admins ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]';`,
        `ALTER TABLE whitedesk_admins DROP COLUMN IF EXISTS org_blind_id;`,
        `ALTER TABLE whitedesk_admins ADD COLUMN IF NOT EXISTS assigned_tickets_count INTEGER DEFAULT 0;`,
        `ALTER TABLE whitedesk_admins ADD COLUMN IF NOT EXISTS last_assigned_at BIGINT DEFAULT 0;`,
        `INSERT INTO whitedesk_enterprises (enterprise_blind_id, name, is_founder_tenant, created_at)
         VALUES ('default', 'WhiteChain Foundation', TRUE, ${Date.now()})
         ON CONFLICT (enterprise_blind_id) DO NOTHING;`
      ];

      for (const st of statements) {
        await executeSql(st);
      }
    } catch (err) {
      console.warn('[HelpDeskStationService] ensureSchema error:', err);
    }
  },

  /**
   * Pending Approvals Queue Engine
   */
  async getPendingApprovals(role: string, enterpriseBlindId?: string): Promise<ApprovalEntry[]> {
    try {
      let sql = '';
      if (role === 'founder') {
        sql = `SELECT * FROM whitedesk_approvals WHERE status = 'pending' ORDER BY requested_at DESC;`;
      } else if (role === 'global_admin') {
        const filter = enterpriseBlindId ? `AND (tenant_blind_id = ${escapeSqlString(enterpriseBlindId)} OR tenant_blind_id IS NULL)` : '';
        sql = `SELECT * FROM whitedesk_approvals WHERE type IN ('admin', 'delete_app', 'delete_org') ${filter} AND status = 'pending' ORDER BY requested_at DESC;`;
      } else {
        const filter = enterpriseBlindId ? `AND tenant_blind_id = ${escapeSqlString(enterpriseBlindId)}` : '';
        sql = `SELECT * FROM whitedesk_approvals WHERE type = 'user' ${filter} AND status = 'pending' ORDER BY requested_at DESC;`;
      }

      const rows = await executeSql(sql);
      return rows.map((r) => ({
        id: Number(r.id),
        type: String(r.type) as 'global_admin' | 'admin' | 'user' | 'delete_app' | 'delete_org',
        tenant_blind_id: String(r.tenant_blind_id),
        tenant_name: r.tenant_name ? String(r.tenant_name) : undefined,
        candidate_white_id: r.candidate_white_id ? String(r.candidate_white_id) : undefined,
        candidate_blind_id: String(r.candidate_blind_id),
        candidate_alias: r.candidate_alias ? String(r.candidate_alias) : undefined,
        target_org_id: r.target_org_id ? String(r.target_org_id) : undefined,
        target_app_id: r.target_app_id ? String(r.target_app_id) : undefined,
        status: String(r.status) as 'pending' | 'approved' | 'rejected',
        requested_at: Number(r.requested_at),
        reviewed_at: r.reviewed_at ? Number(r.reviewed_at) : undefined,
        reviewed_by: r.reviewed_by ? String(r.reviewed_by) : undefined,
      }));
    } catch (e) {
      console.warn('[HelpDeskStationService] getPendingApprovals error:', e);
      return [];
    }
  },

  /**
   * Submits an approval request to Global Admin for deleting an App or Org
   */
  async requestDeletionApproval(
    type: 'delete_app' | 'delete_org',
    targetId: string,
    candidateWhiteId: string,
    tenantBlindId?: string,
    candidateAlias?: string
  ): Promise<boolean> {
    const now = Date.now();
    const cleanTarget = targetId.trim().toLowerCase();
    const entBlind = tenantBlindId && tenantBlindId !== 'all' ? escapeSqlString(tenantBlindId) : 'NULL';
    const candidateBlind = WhiteDeskCrypto.generateBlindId(candidateWhiteId.trim());
    const aliasVal = candidateAlias ? escapeSqlString(candidateAlias) : 'NULL';
    
    let targetApp = 'NULL';
    let targetOrg = 'NULL';
    if (type === 'delete_app') {
      targetApp = escapeSqlString(cleanTarget);
    } else {
      targetOrg = escapeSqlString(cleanTarget);
    }

    try {
      await executeSql(`
        INSERT INTO whitedesk_approvals (
          type, tenant_blind_id, candidate_white_id, candidate_blind_id, candidate_alias, 
          target_app_id, target_org_id, status, requested_at
        ) VALUES (
          '${type}', ${entBlind}, ${escapeSqlString(candidateBlind)}, ${escapeSqlString(candidateBlind)}, 
          ${aliasVal}, ${targetApp}, ${targetOrg}, 'pending', ${now}
        );
      `);
      return true;
    } catch (e) {
      console.warn('[HelpDeskStationService] requestDeletionApproval error:', e);
      return false;
    }
  },

  /**
   * Reviews an approval request: Approve or Reject
   */
  async reviewApproval(approvalId: number, approve: boolean, reviewerWhiteId: string): Promise<boolean> {
    const now = Date.now();
    try {
      const rows = await executeSql(`SELECT * FROM whitedesk_approvals WHERE id = ${approvalId} LIMIT 1;`);
      if (rows.length === 0) return false;

      const app = rows[0];
      const newStatus = approve ? 'approved' : 'rejected';

      const reviewerBlind = WhiteDeskCrypto.generateBlindId(reviewerWhiteId.trim());
      await executeSql(`
        UPDATE whitedesk_approvals 
        SET status = '${newStatus}', reviewed_at = ${now}, reviewed_by = ${escapeSqlString(reviewerBlind)}
        WHERE id = ${approvalId};
      `);

      if (approve) {
        const candidateBlind = WhiteDeskCrypto.generateBlindId(String(app.candidate_blind_id || app.candidate_white_id || ''));
        const tenantBlind = String(app.tenant_blind_id);

        if (app.type === 'global_admin') {
          const defaultOrgId = 'merkez_' + tenantBlind.slice(-6);
          await executeSql(`
            INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, org_id, app_id, is_active, created_at)
            VALUES (${escapeSqlString(candidateBlind)}, ${escapeSqlString(candidateBlind)}, ${escapeSqlString(tenantBlind)}, 'WhiteCosmos', 'global_admin', ${escapeSqlString(defaultOrgId)}, 'all', TRUE, ${now})
            ON CONFLICT (white_id) DO UPDATE SET 
              blind_id = EXCLUDED.blind_id,
              enterprise_blind_id = EXCLUDED.enterprise_blind_id,
              role = 'global_admin',
              alias = 'WhiteCosmos',
              org_id = EXCLUDED.org_id,
              app_id = EXCLUDED.app_id,
              is_active = TRUE;
          `);
        } else if (app.type === 'admin') {
          const alias = app.candidate_alias || (await generateCosmoAlias('admin'));
          const targetOrg = app.target_org_id || 'default';
          const targetApp = app.target_app_id || 'inwhite';
          await executeSql(`
            INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, org_id, app_id, is_active, created_at)
            VALUES (${escapeSqlString(candidateBlind)}, ${escapeSqlString(candidateBlind)}, ${escapeSqlString(tenantBlind)}, ${escapeSqlString(alias)}, 'admin', ${escapeSqlString(targetOrg)}, ${escapeSqlString(targetApp)}, TRUE, ${now})
            ON CONFLICT (white_id) DO UPDATE SET 
              blind_id = EXCLUDED.blind_id,
              enterprise_blind_id = EXCLUDED.enterprise_blind_id,
              role = 'admin',
              alias = EXCLUDED.alias,
              org_id = EXCLUDED.org_id,
              app_id = EXCLUDED.app_id,
              is_active = TRUE;
          `);
        } else if (app.type === 'user') {
          await executeSql(`
            INSERT INTO whitedesk_user_bindings (user_blind_id, tenant_blind_id, org_id, app_id, alias, status, created_at)
            VALUES (${escapeSqlString(candidateBlind)}, ${escapeSqlString(tenantBlind)}, ${escapeSqlString(app.target_org_id || 'default')}, ${escapeSqlString(app.target_app_id || CURRENT_APP_ID)}, ${escapeSqlString(app.candidate_alias || 'User')}, 'approved', ${now})
            ON CONFLICT (user_blind_id) DO UPDATE SET status = 'approved';
          `);
        } else if (app.type === 'delete_app') {
          if (app.target_app_id) {
            await this.removeApp(String(app.target_app_id));
          }
        } else if (app.type === 'delete_org') {
          if (app.target_org_id) {
            await this.removeOrganization(String(app.target_org_id));
          }
        }
      }

      return true;
    } catch (e) {
      console.warn('[HelpDeskStationService] reviewApproval error:', e);
      return false;
    }
  },

  /**
   * Checks the registration status of an app_id in Neon.
   */
  async checkAppRegistration(appId: string): Promise<AppRegStatus> {
    const cleanApp = appId.trim().toLowerCase();
    try {
      const catRows = await executeSql(
        `SELECT app_id FROM whitedesk_apps WHERE app_id = ${escapeSqlString(cleanApp)} LIMIT 1;`
      );
      if (catRows.length > 0) return 'registered';

      const reqRows = await executeSql(
        `SELECT status FROM whitedesk_app_requests WHERE app_id = ${escapeSqlString(cleanApp)} LIMIT 1;`
      );
      if (reqRows.length > 0) {
        const s = String(reqRows[0].status || 'pending');
        if (s === 'pending') return 'pending';
        if (s === 'rejected') return 'rejected';
        if (s === 'approved') return 'registered';
      }
    } catch (e) {
      console.warn('[HelpDeskStationService] checkAppRegistration error:', e);
    }
    return 'unregistered';
  },

  /**
   * Submits a new app registration request.
   */
  async requestAppRegistration(
    appId: string,
    appName: string,
    requestorWhiteId: string,
    description: string = ''
  ): Promise<boolean> {
    const cleanApp = appId.trim().toLowerCase();
    const now = Date.now();
    try {
      await executeSql(`
        INSERT INTO whitedesk_app_requests (app_id, app_name, description, requestor_id, status, created_at)
        VALUES (
          ${escapeSqlString(cleanApp)},
          ${escapeSqlString(appName.trim())},
          ${escapeSqlString(description.trim())},
          ${escapeSqlString(requestorWhiteId.trim())},
          'pending',
          ${now}
        )
        ON CONFLICT (app_id) DO UPDATE
          SET app_name = EXCLUDED.app_name,
              description = EXCLUDED.description,
              status = 'pending',
              created_at = EXCLUDED.created_at;
      `);
      return true;
    } catch (e) {
      console.warn('[HelpDeskStationService] requestAppRegistration error:', e);
      return false;
    }
  },

  /**
   * Fetches all pending app registration requests. (Master-only)
   */
  async getPendingAppRequests(): Promise<AppRequestEntry[]> {
    try {
      const rows = await executeSql(
        `SELECT id, app_id, app_name, description, requestor_id, status, created_at, reviewed_at, reviewed_by
         FROM whitedesk_app_requests
         WHERE status = 'pending'
         ORDER BY created_at ASC;`
      );
      return rows.map(r => ({
        id: Number(r.id),
        app_id: String(r.app_id),
        app_name: String(r.app_name || r.app_id),
        description: String(r.description || ''),
        requestor_id: String(r.requestor_id),
        status: String(r.status || 'pending') as 'pending' | 'approved' | 'rejected',
        created_at: Number(r.created_at),
        reviewed_at: r.reviewed_at ? Number(r.reviewed_at) : undefined,
        reviewed_by: r.reviewed_by ? String(r.reviewed_by) : undefined,
      }));
    } catch (e) {
      console.warn('[HelpDeskStationService] getPendingAppRequests error:', e);
      return [];
    }
  },

  /**
   * Approves an app registration request. (Master-only)
   */
  async approveAppRequest(appId: string, reviewerWhiteId: string): Promise<boolean> {
    const cleanApp = appId.trim().toLowerCase();
    const now = Date.now();
    try {
      await executeSql(`
        UPDATE whitedesk_app_requests
        SET status = 'approved', reviewed_at = ${now}, reviewed_by = ${escapeSqlString(reviewerWhiteId)}
        WHERE app_id = ${escapeSqlString(cleanApp)};
      `);
      await executeSql(`
        INSERT INTO whitedesk_apps (app_id, name, is_active, created_at)
        VALUES (${escapeSqlString(cleanApp)}, ${escapeSqlString(cleanApp)}, TRUE, ${now})
        ON CONFLICT (app_id) DO UPDATE SET is_active = TRUE;
      `);
      return true;
    } catch (e) {
      console.warn('[HelpDeskStationService] approveAppRequest error:', e);
      return false;
    }
  },

  /**
   * Rejects an app registration request. (Master-only)
   */
  async rejectAppRequest(appId: string, reviewerWhiteId: string): Promise<boolean> {
    const cleanApp = appId.trim().toLowerCase();
    const now = Date.now();
    try {
      await executeSql(`
        UPDATE whitedesk_app_requests
        SET status = 'rejected', reviewed_at = ${now}, reviewed_by = ${escapeSqlString(reviewerWhiteId)}
        WHERE app_id = ${escapeSqlString(cleanApp)};
      `);
      return true;
    } catch (e) {
      console.warn('[HelpDeskStationService] rejectAppRequest error:', e);
      return false;
    }
  },

  /**
   * Fetches registered apps and their categories from whitedesk_apps and whitedesk_categories
   */
  async getAppCatList(tenantBlindId?: string): Promise<AppCatEntry[]> {
    try {
      let query = `SELECT app_id, enterprise_blind_id, org_id, name, icon, is_active, created_at FROM whitedesk_apps`;
      if (tenantBlindId && tenantBlindId !== 'all') {
        query += ` WHERE enterprise_blind_id = ${escapeSqlString(tenantBlindId)}`;
      }
      query += ` ORDER BY app_id ASC;`;
      const rows = await executeSql(query);
      if (rows.length > 0) {
        let catQuery = `SELECT category_id, enterprise_blind_id, org_id, app_id, scope_type, categories FROM whitedesk_categories WHERE is_active = true`;
        if (tenantBlindId && tenantBlindId !== 'all') {
          catQuery += ` AND (enterprise_blind_id = ${escapeSqlString(tenantBlindId)} OR enterprise_blind_id = 'default')`;
        }
        const catRows = await executeSql(catQuery);
        const catsByApp: Record<string, HelpDeskCategory[]> = {};
        for (const row of catRows) {
          const appKey = (row.app_id || '').toLowerCase();
          const parsed = typeof row.categories === 'string' ? JSON.parse(row.categories) : (row.categories || []);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const mapped: HelpDeskCategory[] = parsed.map((c: any) => ({
              id: String(c.id || c.key),
              key: String(c.key || c.id),
              labelTr: String(c.labelTr || c.name_tr || c.id),
              labelEn: String(c.labelEn || c.name_en || c.id),
              icon: String(c.icon || 'HelpCircle'),
              org_id: row.org_id ? String(row.org_id) : undefined,
              app_id: row.app_id ? String(row.app_id) : undefined,
              enterprise_blind_id: row.enterprise_blind_id ? String(row.enterprise_blind_id) : undefined,
            }));
            if (appKey && appKey !== 'all') {
              catsByApp[appKey] = mapped;
            } else {
              catsByApp['all'] = mapped;
            }
          }
        }
        return rows.map(r => ({
          app_id: String(r.app_id),
          name: String(r.name || r.app_id),
          enterprise_blind_id: r.enterprise_blind_id ? String(r.enterprise_blind_id) : undefined,
          org_id: r.org_id ? String(r.org_id) : undefined,
          categories: catsByApp[String(r.app_id).toLowerCase()] || catsByApp['all'] || [],
          updated_at: Number(r.created_at || Date.now()),
        }));
      }
      return [];
    } catch (e) {
      console.warn('[HelpDeskStationService] getAppCatList error:', e);
      return [];
    }
  },

  /**
   * Gets categories for a specific app_id, org_id, and tenant
   */
  async getAppCategories(appId: string = CURRENT_APP_ID, tenantBlindId?: string, orgId?: string): Promise<HelpDeskCategory[]> {
    const cleanApp = (appId || CURRENT_APP_ID).trim().toLowerCase();
    const cleanOrg = orgId ? orgId.trim().toLowerCase() : 'all';
    const cacheKey = `${cleanApp}_${cleanOrg}_${tenantBlindId || 'all'}`;
    const cleanTenant = tenantBlindId || 'all';

    if (_categoryCache[cacheKey] && _categoryCache[cacheKey].length > 0) {
      return _categoryCache[cacheKey];
    }

    try {
      const cached = await keystoreConfigVault.getCategories(cleanTenant);
      if (cached && cached.length > 0) {
        _categoryCache[cacheKey] = cached;
        void (async () => {
          try {
            let query = `
              SELECT category_id, enterprise_blind_id, org_id, app_id, scope_type, categories 
              FROM whitedesk_categories 
              WHERE is_active = true
            `;
            if (tenantBlindId && tenantBlindId !== 'all') {
              if (tenantBlindId === 'blind_11fcac28453c3eaa3a06a5db6caf4ca1' || tenantBlindId === 'blind_thewhite_root') {
                query += ` AND enterprise_blind_id IN ('blind_11fcac28453c3eaa3a06a5db6caf4ca1', 'blind_thewhite_root')`;
              } else {
                query += ` AND enterprise_blind_id = ${escapeSqlString(tenantBlindId)}`;
              }
            }
            query += ` ORDER BY created_at ASC;`;
            const rows = await executeSql(query);
            if (rows && rows.length > 0) {
              const seenIds = new Set<string>();
              const collected: HelpDeskCategory[] = [];
              for (const r of rows) {
                let parsed: any[] = [];
                try {
                  parsed = typeof r.categories === 'string' ? JSON.parse(r.categories) : (r.categories || []);
                } catch { parsed = []; }
                if (Array.isArray(parsed)) {
                  for (const c of parsed) {
                    const catId = String(c.id || c.key || r.category_id);
                    if (!catId || seenIds.has(catId)) continue;
                    seenIds.add(catId);
                    collected.push({
                      id: catId,
                      key: String(c.key || catId),
                      labelTr: String(c.labelTr || c.name_tr || catId),
                      labelEn: String(c.labelEn || c.name_en || c.labelTr || catId),
                      icon: String(c.icon || 'Tag'),
                      org_id: r.org_id ? String(r.org_id) : (c.org_id ? String(c.org_id) : undefined),
                      app_id: r.app_id ? String(r.app_id) : (c.app_id ? String(c.app_id) : undefined),
                      enterprise_blind_id: r.enterprise_blind_id ? String(r.enterprise_blind_id) : undefined,
                    });
                  }
                }
              }
              if (collected.length > 0) {
                await keystoreConfigVault.setCategories(cleanTenant, collected);
              }
            }
          } catch {}
        })();
        return cached;
      }
    } catch {}

    try {
      let query = `
        SELECT category_id, enterprise_blind_id, org_id, app_id, scope_type, categories 
        FROM whitedesk_categories 
        WHERE is_active = true
      `;
      if (tenantBlindId && tenantBlindId !== 'all') {
        if (tenantBlindId === 'blind_11fcac28453c3eaa3a06a5db6caf4ca1' || tenantBlindId === 'blind_thewhite_root') {
          query += ` AND enterprise_blind_id IN ('blind_11fcac28453c3eaa3a06a5db6caf4ca1', 'blind_thewhite_root')`;
        } else {
          query += ` AND enterprise_blind_id = ${escapeSqlString(tenantBlindId)}`;
        }
      }
      query += ` ORDER BY created_at ASC;`;
      const rows = await executeSql(query);

      const seenIds = new Set<string>();
      const collected: HelpDeskCategory[] = [];

      for (const r of rows) {
        const rowOrg = (r.org_id || 'all').toLowerCase();
        const rowApp = (r.app_id || 'all').toLowerCase();

        if (orgId && cleanOrg !== 'all' && cleanOrg !== 'default') {
          if (rowOrg !== 'all' && rowOrg !== 'default' && rowOrg !== cleanOrg) {
            continue;
          }
        }
        if (appId && cleanApp !== 'all' && cleanApp !== 'default' && cleanApp !== CURRENT_APP_ID.toLowerCase()) {
          if (rowApp !== 'all' && rowApp !== 'default' && rowApp !== cleanApp) {
            continue;
          }
        }

        let parsed: any[] = [];
        try {
          parsed = typeof r.categories === 'string' ? JSON.parse(r.categories) : (r.categories || []);
        } catch {
          parsed = [];
        }

        if (Array.isArray(parsed)) {
          for (const c of parsed) {
            const catId = String(c.id || c.key || r.category_id);
            if (!catId || seenIds.has(catId)) continue;
            seenIds.add(catId);
            collected.push({
              id: catId,
              key: String(c.key || catId),
              labelTr: String(c.labelTr || c.name_tr || catId),
              labelEn: String(c.labelEn || c.name_en || c.labelTr || catId),
              icon: String(c.icon || 'Tag'),
              org_id: r.org_id ? String(r.org_id) : (c.org_id ? String(c.org_id) : undefined),
              app_id: r.app_id ? String(r.app_id) : (c.app_id ? String(c.app_id) : undefined),
              enterprise_blind_id: r.enterprise_blind_id ? String(r.enterprise_blind_id) : undefined,
            });
          }
        }
      }

      _categoryCache[cacheKey] = collected;
      await keystoreConfigVault.setCategories(cleanTenant, collected);
      return collected;
    } catch (e) {
      console.warn('[HelpDeskStationService] getAppCategories error:', e);
      return [];
    }
  },

  /**
   * Multi-dimensional category resolver
   */
  async getCategories(options?: { enterpriseBlindId?: string; orgId?: string | null; appId?: string | null }): Promise<HelpDeskCategory[]> {
    return this.getAppCategories(options?.appId || 'all', options?.enterpriseBlindId, options?.orgId || undefined);
  },

  /**
   * Adds or registers a new app in whitedesk_apps
   */
  async addApp(appId: string, name?: string, enterpriseBlindId?: string, orgId?: string): Promise<boolean> {
    const cleanAppId = appId.trim().toLowerCase();
    if (!cleanAppId) return false;
    const cleanName = (name || cleanAppId).trim();
    const entBlind = enterpriseBlindId ? escapeSqlString(enterpriseBlindId) : 'NULL';
    const orgVal = orgId ? escapeSqlString(orgId.trim()) : "'default'";
    const now = Date.now();
    await executeSql(`
      INSERT INTO whitedesk_apps (app_id, enterprise_blind_id, org_id, name, icon, is_active, created_at)
      VALUES (${escapeSqlString(cleanAppId)}, ${entBlind}, ${orgVal}, ${escapeSqlString(cleanName)}, 'AppWindow', TRUE, ${now})
      ON CONFLICT (app_id) DO UPDATE SET is_active = TRUE, name = EXCLUDED.name, org_id = EXCLUDED.org_id;
    `);
    return true;
  },

  /**
   * Adds a category under an enterprise (and optionally specific org/app)
   */
  async addCategory(name: string, enterpriseBlindId: string, orgId: string = 'all', appId: string = 'all'): Promise<boolean> {
    const cleanName = name.trim();
    const cleanEnt = (enterpriseBlindId || 'default').trim();
    if (!cleanName) return false;
    const catId = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cat: HelpDeskCategory = {
      id: catId,
      key: catId,
      labelTr: cleanName,
      labelEn: cleanName,
      icon: 'Tag'
    };
    return this.addCategoryToApp(appId, cat, orgId, cleanEnt);
  },

  /**
   * Adds a category row to whitedesk_categories
   */
  async addCategoryToApp(appId: string, category: HelpDeskCategory, orgId: string = 'all', enterpriseBlindId: string = 'default'): Promise<boolean> {
    const cleanApp = (appId || 'all').trim().toLowerCase();
    const cleanOrg = orgId ? orgId.trim().toLowerCase() : 'all';
    const cleanEnt = (enterpriseBlindId || 'default').trim();
    const catId = String(category.id || category.key || `cat_${Date.now()}`);

    const catPayload = [
      {
        id: catId,
        key: category.key || catId,
        labelTr: category.labelTr,
        labelEn: category.labelEn || category.labelTr,
        icon: category.icon || 'Tag',
        org_id: cleanOrg,
        app_id: cleanApp,
        sort: 1,
      },
    ];

    await executeSql(`
      INSERT INTO whitedesk_categories (category_id, enterprise_blind_id, org_id, app_id, scope_type, categories, is_active, created_at, updated_at)
      VALUES (
        ${escapeSqlString(catId)}, 
        ${escapeSqlString(cleanEnt)}, 
        ${escapeSqlString(cleanOrg)}, 
        ${escapeSqlString(cleanApp)}, 
        'app', 
        ${escapeSqlString(JSON.stringify(catPayload))}::jsonb, 
        TRUE, 
        NOW(),
        NOW()
      )
      ON CONFLICT (category_id) DO UPDATE SET 
        categories = EXCLUDED.categories, 
        org_id = EXCLUDED.org_id,
        app_id = EXCLUDED.app_id,
        updated_at = NOW(),
        is_active = TRUE;
    `);

    clearCategoryCache();

    // Local-first: Sync to keystoreConfigVault for instant local persistence
    try {
      const existing = await keystoreConfigVault.getCategories(cleanEnt);
      const filtered = existing.filter(c => c.id !== catId && c.key !== catId);
      await keystoreConfigVault.setCategories(cleanEnt, [...filtered, {
        id: catId,
        key: category.key || catId,
        labelTr: category.labelTr,
        labelEn: category.labelEn || category.labelTr,
        icon: category.icon || 'Tag',
        org_id: cleanOrg,
        app_id: cleanApp,
      }]);
    } catch (e) {
      console.warn('[HelpDeskStationService] addCategoryToApp keystoreConfigVault error:', e);
    }

    return true;
  },

  /**
   * Removes a category from whitedesk_categories
   */
  async removeCategoryFromApp(appId: string, categoryId: string, orgId: string = 'all', enterpriseBlindId: string = 'default'): Promise<boolean> {
    return this.deleteCategory(categoryId, appId, orgId, enterpriseBlindId);
  },

  /**
   * Deletes a category from whitedesk_categories
   */
  async deleteCategory(categoryId: string, appId?: string, orgId?: string, enterpriseBlindId?: string): Promise<boolean> {
    const cleanCat = categoryId.trim();
    if (!cleanCat) return false;

    await executeSql(`DELETE FROM whitedesk_categories WHERE category_id = ${escapeSqlString(cleanCat)};`);

    try {
      const rows = await executeSql(`SELECT category_id, categories FROM whitedesk_categories WHERE is_active = true;`);
      for (const r of rows) {
        const parsed = typeof r.categories === 'string' ? JSON.parse(r.categories) : (r.categories || []);
        if (Array.isArray(parsed) && parsed.some((c: any) => c.id === cleanCat || c.key === cleanCat)) {
          const updated = parsed.filter((c: any) => c.id !== cleanCat && c.key !== cleanCat);
          if (updated.length === 0) {
            await executeSql(`DELETE FROM whitedesk_categories WHERE category_id = ${escapeSqlString(String(r.category_id))};`);
          } else {
            await executeSql(`
              UPDATE whitedesk_categories 
              SET categories = ${escapeSqlString(JSON.stringify(updated))}::jsonb, updated_at = NOW()
              WHERE category_id = ${escapeSqlString(String(r.category_id))};
            `);
          }
        }
      }
    } catch (e) {
      console.warn('[HelpDeskStationService] deleteCategory legacy cleanup warning:', e);
    }

    // Local-first: Clean up keystoreConfigVault across all tenants
    try {
      const config = await keystoreConfigVault.getConfig();
      if (config.categories) {
        for (const k of Object.keys(config.categories)) {
          config.categories[k] = (config.categories[k] || []).filter(
            (c: any) => c.id !== cleanCat && c.key !== cleanCat
          );
        }
        await keystoreConfigVault.saveConfig(config);
      }
    } catch (ve) {
      console.warn('[HelpDeskStationService] deleteCategory vault cleanup warning:', ve);
    }

    clearCategoryCache();

    return true;
  },

  /**
   * Fetches registered admins
   */
  async getAdminsList(tenantBlindId?: string): Promise<AdminEntry[]> {
    try {
      let query = `
        SELECT COALESCE(a.blind_id, a.white_id) AS white_id, a.enterprise_blind_id, a.org_id, a.app_id, a.alias, a.role, a.pub_key, a.is_active, a.granted_by, a.created_at, e.name as enterprise_name
        FROM whitedesk_admins a
        LEFT JOIN whitedesk_enterprises e ON a.enterprise_blind_id = e.enterprise_blind_id
      `;
      if (tenantBlindId && tenantBlindId !== 'all') {
        query += ` WHERE a.enterprise_blind_id = ${escapeSqlString(tenantBlindId)}`;
      }
      query += ` ORDER BY 
        CASE 
          WHEN a.role IN ('founder', 'master') OR LOWER(a.alias) = 'thewhite' THEN 0 
          WHEN a.role = 'global_admin' OR LOWER(a.alias) LIKE '%whitecosmos%' OR LOWER(a.alias) LIKE '%global admin%' THEN 1 
          ELSE 2 
        END, a.created_at ASC;`;
      const rows = await executeSql(query);
      return rows.map(r => ({
        white_id: WhiteDeskCrypto.generateBlindId(String(r.white_id || '')),
        enterprise_blind_id: r.enterprise_blind_id ? String(r.enterprise_blind_id) : undefined,
        org_id: r.org_id ? String(r.org_id) : 'all',
        app_id: r.app_id ? String(r.app_id) : 'all',
        enterprise_name: r.enterprise_name ? String(r.enterprise_name) : undefined,
        alias: String(r.alias || 'Admin'),
        role: String(r.role || 'operator'),
        pub_key: r.pub_key ? String(r.pub_key) : undefined,
        is_active: Boolean(r.is_active),
        granted_by: r.granted_by ? String(r.granted_by) : undefined,
        created_at: Number(r.created_at || Date.now()),
      }));
    } catch (e) {
      console.warn('[HelpDeskStationService] getAdminsList error:', e);
      return [];
    }
  },

  /**
   * Adds or registers an admin in whitedesk_admins
   */
  async addAdmin(
    whiteId: string, 
    alias: string = '', 
    role: string = 'operator', 
    enterpriseBlindId?: string,
    orgId: string = 'all',
    appId: string = 'all',
    grantedBy?: string
  ): Promise<boolean> {
    const cleanId = WhiteDeskCrypto.generateBlindId(whiteId.trim());
    if (!cleanId) return false;

    const genericAliases = ['', 'admin', 'Admin', 'master admin', 'Master Admin', 'bu cihaz (master)', 'this device (master)'];
    let resolvedAlias = alias.trim();
    if (!resolvedAlias || genericAliases.includes(resolvedAlias.toLowerCase())) {
      resolvedAlias = await generateCosmoAlias(role);
    }

    const entVal = enterpriseBlindId ? escapeSqlString(enterpriseBlindId) : 'NULL';
    const cleanOrg = orgId ? escapeSqlString(orgId.trim()) : "'all'";
    const cleanApp = appId ? escapeSqlString(appId.trim().toLowerCase()) : "'all'";
    const cleanGrant = grantedBy ? escapeSqlString(WhiteDeskCrypto.generateBlindId(grantedBy.trim())) : 'NULL';

    await executeSql(`
      INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, org_id, app_id, alias, role, is_active, granted_by, created_at)
      VALUES (${escapeSqlString(cleanId)}, ${escapeSqlString(cleanId)}, ${entVal}, ${cleanOrg}, ${cleanApp}, ${escapeSqlString(resolvedAlias)}, ${escapeSqlString(role)}, true, ${cleanGrant}, NOW())
      ON CONFLICT (white_id) DO UPDATE SET 
        blind_id = EXCLUDED.blind_id,
        enterprise_blind_id = COALESCE(EXCLUDED.enterprise_blind_id, whitedesk_admins.enterprise_blind_id),
        alias = EXCLUDED.alias, 
        org_id = EXCLUDED.org_id,
        app_id = EXCLUDED.app_id,
        is_active = true;
    `);
    return true;
  },

  /**
   * Toggles an admin's is_active status
   */
  async toggleAdminActiveStatus(whiteId: string): Promise<boolean> {
    const cleanId = WhiteDeskCrypto.generateBlindId(whiteId.trim());
    await executeSql(`
      UPDATE whitedesk_admins
      SET is_active = NOT COALESCE(is_active, true)
      WHERE white_id = ${escapeSqlString(cleanId)} OR blind_id = ${escapeSqlString(cleanId)} OR white_id = ${escapeSqlString(whiteId.trim())};
    `);
    return true;
  },

  /**
   * Removes an admin from whitedesk_admins and demotes them to a normal user
   */
  async removeAdmin(whiteId: string): Promise<boolean> {
    const cleanId = WhiteDeskCrypto.generateBlindId(whiteId.trim());
    const rawId = whiteId.trim();
    try {
      const rows = await executeSql(`SELECT * FROM whitedesk_admins WHERE white_id = ${escapeSqlString(cleanId)} OR blind_id = ${escapeSqlString(cleanId)} OR white_id = ${escapeSqlString(rawId)} LIMIT 1;`);
      if (rows && rows.length > 0) {
        const adm = rows[0];
        const tenantBlind = adm.enterprise_blind_id || 'default';
        const orgId = adm.org_id || 'default';
        const appId = adm.app_id || 'inwhite';
        const alias = adm.alias || 'Kullanıcı';
        await executeSql(`
          INSERT INTO whitedesk_user_bindings (user_blind_id, tenant_blind_id, org_id, app_id, alias, status, created_at)
          VALUES (
            ${escapeSqlString(cleanId)},
            ${escapeSqlString(tenantBlind === 'all' ? 'default' : tenantBlind)},
            ${escapeSqlString(orgId === 'all' ? 'default' : orgId)},
            ${escapeSqlString(appId === 'all' ? 'inwhite' : appId)},
            ${escapeSqlString(alias)},
            'active',
            NOW()
          )
          ON CONFLICT (user_blind_id, tenant_blind_id, org_id) DO UPDATE SET status = 'active', alias = EXCLUDED.alias;
        `);
      }
    } catch (e) {
      console.warn('[HelpDeskStationService] removeAdmin demote user warning:', e);
    }
    await executeSql(`DELETE FROM whitedesk_admins WHERE white_id = ${escapeSqlString(cleanId)} OR blind_id = ${escapeSqlString(cleanId)} OR white_id = ${escapeSqlString(rawId)};`);
    return true;
  },

  /**
   * Fetches registered organizations
   */
  async getOrgsList(tenantBlindId?: string): Promise<OrgEntry[]> {
    const cleanTenant = tenantBlindId || 'all';
    try {
      const cached = await keystoreConfigVault.getOrgs(cleanTenant);
      if (cached && cached.length > 0) {
        void (async () => {
          try {
            let query = `SELECT org_id, enterprise_blind_id, name, created_at FROM whitedesk_orgs`;
            if (tenantBlindId && tenantBlindId !== 'all') {
              if (tenantBlindId === 'blind_11fcac28453c3eaa3a06a5db6caf4ca1' || tenantBlindId === 'blind_thewhite_root') {
                query += ` WHERE enterprise_blind_id IN ('blind_11fcac28453c3eaa3a06a5db6caf4ca1', 'blind_thewhite_root')`;
              } else {
                query += ` WHERE enterprise_blind_id = ${escapeSqlString(tenantBlindId)}`;
              }
            }
            query += ` ORDER BY created_at ASC, org_id ASC;`;
            const rows = await executeSql(query);
            if (rows.length > 0) {
              const mapped = rows.map(r => ({
                org_id: String(r.org_id),
                enterprise_blind_id: r.enterprise_blind_id ? String(r.enterprise_blind_id) : undefined,
                name: String(r.name),
                created_at: Number(r.created_at || Date.now()),
              }));
              await keystoreConfigVault.setOrgs(cleanTenant, mapped);
            }
          } catch {}
        })();
        return cached;
      }

      let query = `SELECT org_id, enterprise_blind_id, name, created_at FROM whitedesk_orgs`;
      if (tenantBlindId && tenantBlindId !== 'all') {
        if (tenantBlindId === 'blind_11fcac28453c3eaa3a06a5db6caf4ca1' || tenantBlindId === 'blind_thewhite_root') {
          query += ` WHERE enterprise_blind_id IN ('blind_11fcac28453c3eaa3a06a5db6caf4ca1', 'blind_thewhite_root')`;
        } else {
          query += ` WHERE enterprise_blind_id = ${escapeSqlString(tenantBlindId)}`;
        }
      }
      query += ` ORDER BY created_at ASC, org_id ASC;`;
      const rows = await executeSql(query);
      if (rows.length > 0) {
        const mapped = rows.map(r => ({
          org_id: String(r.org_id),
          enterprise_blind_id: r.enterprise_blind_id ? String(r.enterprise_blind_id) : undefined,
          name: String(r.name),
          created_at: Number(r.created_at || Date.now()),
        }));
        await keystoreConfigVault.setOrgs(cleanTenant, mapped);
        return mapped;
      }
      return [];
    } catch (e) {
      console.warn('[HelpDeskStationService] getOrgsList error:', e);
      return [];
    }
  },

  /**
   * Fetches all registered member white_ids and blind_ids for a tenant
   * KESİN VE KIRILAMAZ İZOLASYON:
   * 1. Yalnızca belirtilen tenantBlindId'ye ait üyeler döner; başka firma sızamaz.
   * 2. orgId belirtilmişse sadece o birime (ve 'all' yetkili adminlere) atanmış üyeler döner; belirtilmemişse tüm şirket döner.
   */
  async getTenantMembers(tenantBlindId: string, orgId?: string): Promise<string[]> {
    try {
      if (!tenantBlindId) return [];
      const cleanTenant = tenantBlindId.trim();
      const isSpecificOrg = orgId && orgId !== 'all' && orgId !== '*' && orgId !== 'global';
      const cleanOrg = isSpecificOrg ? orgId.trim() : 'all';
      const memberSet = new Set<string>();

      const isDefaultTenant = cleanTenant === 'default';

      // 1. Check whitedesk_user_bindings (Strict tenant & group isolation)
      let bQuery = `SELECT user_blind_id, org_id FROM whitedesk_user_bindings WHERE `;
      if (isDefaultTenant) {
        bQuery += `tenant_blind_id = 'default'`;
      } else {
        bQuery += `tenant_blind_id = ${escapeSqlString(cleanTenant)}`;
      }
      bQuery += ` AND status IN ('approved', 'active')`;
      if (isSpecificOrg) {
        bQuery += ` AND org_id = ${escapeSqlString(cleanOrg)}`;
      }
      const bRows = await executeSql(bQuery);
      for (const r of bRows) {
        if (r.user_blind_id) memberSet.add(String(r.user_blind_id).toLowerCase());
      }

      // 2. Check whitedesk_approvals (Strict tenant & group isolation)
      let aQuery = `SELECT candidate_white_id, candidate_blind_id FROM whitedesk_approvals WHERE `;
      if (isDefaultTenant) {
        aQuery += `tenant_blind_id = 'default'`;
      } else {
        aQuery += `tenant_blind_id = ${escapeSqlString(cleanTenant)}`;
      }
      aQuery += ` AND status = 'approved'`;
      if (isSpecificOrg) {
        aQuery += ` AND target_org_id = ${escapeSqlString(cleanOrg)}`;
      }
      const aRows = await executeSql(aQuery);
      for (const r of aRows) {
        if (r.candidate_blind_id) memberSet.add(WhiteDeskCrypto.generateBlindId(String(r.candidate_blind_id)).toLowerCase());
        else if (r.candidate_white_id) memberSet.add(WhiteDeskCrypto.generateBlindId(String(r.candidate_white_id)).toLowerCase());
      }

      // 3. Check whitedesk_admins (Strict company & group isolation)
      let admQuery = `SELECT COALESCE(blind_id, white_id) AS white_id, org_id, role FROM whitedesk_admins WHERE is_active = true`;
      if (isDefaultTenant) {
        admQuery += ` AND enterprise_blind_id = 'default'`;
      } else {
        admQuery += ` AND enterprise_blind_id = ${escapeSqlString(cleanTenant)}`;
      }
      if (isSpecificOrg) {
        admQuery += ` AND org_id = ${escapeSqlString(cleanOrg)}`;
      }
      const admRows = await executeSql(admQuery);
      for (const r of admRows) {
        if (r.white_id) {
          memberSet.add(WhiteDeskCrypto.generateBlindId(String(r.white_id)).toLowerCase());
        }
      }

      return Array.from(memberSet);
    } catch (e) {
      console.warn('[HelpDeskStationService] getTenantMembers error:', e);
      return [];
    }
  },

  /**
   * Adds a new organization
   */
  async addOrganization(orgId: string, name: string, enterpriseBlindId?: string): Promise<boolean> {
    const cleanName = (name || orgId).trim();
    if (!cleanName) return false;
    const entClean = (enterpriseBlindId || 'default').trim();
    const baseSlug = cleanName
      .toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || `org_${Date.now()}`;
    const entSuffix = entClean.replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase() || 'def';
    const cleanId = (orgId && orgId !== name && orgId.includes('_'))
      ? orgId.trim().toLowerCase()
      : `${baseSlug}_${entSuffix}`;
    const now = Date.now();
    await executeSql(`
      INSERT INTO whitedesk_orgs (org_id, org_blind_id, enterprise_blind_id, name, created_at)
      VALUES (${escapeSqlString(cleanId)}, ${escapeSqlString(cleanId)}, ${escapeSqlString(entClean)}, ${escapeSqlString(cleanName)}, ${now})
      ON CONFLICT (org_id) DO UPDATE SET name = EXCLUDED.name, enterprise_blind_id = EXCLUDED.enterprise_blind_id;
    `);

    // Local-first: Sync to keystoreConfigVault for instant local persistence
    try {
      const config = await keystoreConfigVault.getConfig();
      if (!config.orgs) config.orgs = {};
      const currentOrgs = config.orgs[entClean] || [];
      const filtered = currentOrgs.filter((o: any) => o.org_id !== cleanId);
      config.orgs[entClean] = [...filtered, { org_id: cleanId, enterprise_blind_id: entClean, name: cleanName, created_at: now }];
      await keystoreConfigVault.saveConfig(config);
    } catch (e) {
      console.warn('[HelpDeskStationService] addOrganization keystoreConfigVault error:', e);
    }

    return true;
  },

  /**
   * Removes an organization and reassigns all linked admins, apps, and categories
   */
  async removeOrganizationWithReassign(orgId: string, targetOrgId?: string): Promise<boolean> {
    const cleanSource = orgId.trim().toLowerCase();
    const cleanTarget = targetOrgId ? targetOrgId.trim().toLowerCase() : 'default';

    await executeSql(`UPDATE whitedesk_admins SET org_id = ${escapeSqlString(cleanTarget)} WHERE org_id = ${escapeSqlString(cleanSource)};`);
    await executeSql(`UPDATE whitedesk_apps SET org_id = ${escapeSqlString(cleanTarget)} WHERE org_id = ${escapeSqlString(cleanSource)};`);
    await executeSql(`UPDATE whitedesk_categories SET org_id = ${escapeSqlString(cleanTarget)} WHERE org_id = ${escapeSqlString(cleanSource)};`);
    await executeSql(`DELETE FROM whitedesk_orgs WHERE org_id = ${escapeSqlString(cleanSource)};`);

    // Local-first: Clean up keystoreConfigVault across all tenants
    try {
      const config = await keystoreConfigVault.getConfig();
      if (config.orgs) {
        for (const k of Object.keys(config.orgs)) {
          config.orgs[k] = (config.orgs[k] || []).filter(
            (o: any) => o.org_id?.toLowerCase() !== cleanSource
          );
        }
        await keystoreConfigVault.saveConfig(config);
      }
    } catch (ve) {
      console.warn('[HelpDeskStationService] removeOrganization vault cleanup warning:', ve);
    }

    return true;
  },

  /**
   * Removes an organization
   */
  async removeOrganization(orgId: string): Promise<boolean> {
    return this.removeOrganizationWithReassign(orgId, 'default');
  },

  /**
   * Removes an application from whitedesk_apps and whitedesk_categories
   */
  async removeApp(appId: string): Promise<boolean> {
    const cleanId = appId.trim().toLowerCase();
    if (cleanId === 'inwhite') return false;
    await executeSql(`DELETE FROM whitedesk_apps WHERE app_id = ${escapeSqlString(cleanId)};`);
    await executeSql(`DELETE FROM whitedesk_categories WHERE app_id = ${escapeSqlString(cleanId)};`);
    await executeSql(`UPDATE whitedesk_admins SET app_id = 'all' WHERE app_id = ${escapeSqlString(cleanId)};`);
    delete _categoryCache[cleanId];

    // Local-first: Clean up keystoreConfigVault across all tenants
    try {
      const config = await keystoreConfigVault.getConfig();
      if (config.apps) {
        for (const k of Object.keys(config.apps)) {
          config.apps[k] = (config.apps[k] || []).filter(
            (a: any) => a.app_id?.toLowerCase() !== cleanId
          );
        }
        await keystoreConfigVault.saveConfig(config);
      }
    } catch (ve) {
      console.warn('[HelpDeskStationService] removeApp vault cleanup warning:', ve);
    }

    return true;
  },

  /**
   * Saves allocation for an admin
   */
  async saveAdminAlloc(
    adminWhiteId: string, 
    orgId: string = 'all', 
    appId: string = 'all', 
    categories: string[] = ['all'],
    enterpriseBlindId?: string,
    categoryId: string = 'all'
  ): Promise<boolean> {
    const cleanId = WhiteDeskCrypto.generateBlindId(adminWhiteId.trim());
    const cleanOrg = orgId.trim().toLowerCase() || 'all';
    const cleanApp = appId.trim().toLowerCase() || 'all';
    let sql = `UPDATE whitedesk_admins SET org_id = ${escapeSqlString(cleanOrg)}, app_id = ${escapeSqlString(cleanApp)}`;
    if (enterpriseBlindId) {
      sql += `, enterprise_blind_id = ${escapeSqlString(enterpriseBlindId)}`;
    }
    sql += ` WHERE white_id = ${escapeSqlString(cleanId)} OR blind_id = ${escapeSqlString(cleanId)} OR white_id = ${escapeSqlString(adminWhiteId.trim())};`;
    await executeSql(sql);
    return true;
  },

  /**
   * Deletes / Resets an allocation for an admin
   */
  async deleteAdminAlloc(adminWhiteId: string, appId: string = 'all', orgId: string = 'all'): Promise<boolean> {
    const cleanId = WhiteDeskCrypto.generateBlindId(adminWhiteId.trim());
    await executeSql(`UPDATE whitedesk_admins SET org_id = 'all', app_id = 'all' WHERE white_id = ${escapeSqlString(cleanId)} OR blind_id = ${escapeSqlString(cleanId)} OR white_id = ${escapeSqlString(adminWhiteId.trim())};`);
    return true;
  },

  /**
   * Gets allocations for an admin derived directly from whitedesk_admins
   */
  async getAdminAllocations(adminWhiteId?: string): Promise<AdminAllocEntry[]> {
    try {
      let sql = `SELECT COALESCE(blind_id, white_id) as admin_white_id, enterprise_blind_id, org_id, app_id, EXTRACT(EPOCH FROM created_at)*1000 as updated_at FROM whitedesk_admins`;
      if (adminWhiteId) {
        const cleanId = WhiteDeskCrypto.generateBlindId(adminWhiteId.trim());
        sql += ` WHERE white_id = ${escapeSqlString(cleanId)} OR blind_id = ${escapeSqlString(cleanId)} OR white_id = ${escapeSqlString(adminWhiteId.trim())}`;
      }
      sql += ` ORDER BY created_at DESC;`;
      const rows = await executeSql(sql);
      return rows.map((r, idx) => ({
        id: idx + 1,
        admin_white_id: WhiteDeskCrypto.generateBlindId(String(r.admin_white_id || '')),
        enterprise_blind_id: r.enterprise_blind_id ? String(r.enterprise_blind_id) : undefined,
        org_id: String(r.org_id || 'all'),
        app_id: String(r.app_id || 'all'),
        category_id: 'all',
        categories: ['all'],
        updated_at: Number(r.updated_at || Date.now()),
      }));
    } catch (e) {
      console.warn('[HelpDeskStationService] getAdminAllocations error:', e);
      return [];
    }
  },

  /**
   * SDK ENTEGRASYONLARI & KÖPRÜ ANAHTARLARI
   */
  async createSdkBridge(
    enterpriseBlindId: string,
    orgId?: string | null,
    appName?: string
  ): Promise<{ success: boolean; bridgeKey: string; message?: string }> {
    try {
      if (!enterpriseBlindId) throw new Error('Geçersiz kuruluş belirteci.');
      
      let randHex = '';
      const chars = '0123456789abcdef';
      for (let i = 0; i < 53; i++) {
        randHex += chars[Math.floor(Math.random() * chars.length)];
      }
      const bridgeKey = `wd_sdk_${randHex}`;
      const now = Date.now();
      const safeAppName = appName?.trim() || 'Harici Uygulama';

      const q = `
        INSERT INTO whitedesk_sdk_bridges (bridge_key, enterprise_blind_id, org_id, app_name, created_at, is_active)
        VALUES (${escapeSqlString(bridgeKey)}, ${escapeSqlString(enterpriseBlindId)}, ${escapeSqlString(orgId, true)}, ${escapeSqlString(safeAppName)}, ${now}, TRUE);
      `;
      await executeSql(q);

      const appId = `app_${bridgeKey.substring(7, 19)}`;
      const qApp = `
        INSERT INTO whitedesk_apps (app_id, enterprise_blind_id, name, is_active, created_at)
        VALUES (${escapeSqlString(appId)}, ${escapeSqlString(enterpriseBlindId)}, ${escapeSqlString(safeAppName)}, TRUE, ${now})
        ON CONFLICT (app_id) DO NOTHING;
      `;
      await executeSql(qApp);

      return { success: true, bridgeKey };
    } catch (e: any) {
      console.warn('[HelpDeskStationService] createSdkBridge error:', e);
      return { success: false, bridgeKey: '', message: e?.message || 'SDK köprü anahtarı üretilemedi.' };
    }
  },

  async revokeSdkBridge(
    enterpriseBlindId: string,
    bridgeKeyOrAppId: string
  ): Promise<boolean> {
    try {
      const q1 = `
        DELETE FROM whitedesk_sdk_bridges 
        WHERE enterprise_blind_id = ${escapeSqlString(enterpriseBlindId)} 
        AND (bridge_key = ${escapeSqlString(bridgeKeyOrAppId)} OR bridge_key LIKE '%${bridgeKeyOrAppId}%');
      `;
      await executeSql(q1);

      const q2 = `
        DELETE FROM whitedesk_apps 
        WHERE enterprise_blind_id = ${escapeSqlString(enterpriseBlindId)} 
        AND (app_id = ${escapeSqlString(bridgeKeyOrAppId)} OR name = ${escapeSqlString(bridgeKeyOrAppId)});
      `;
      await executeSql(q2);

      return true;
    } catch (e) {
      console.warn('[HelpDeskStationService] revokeSdkBridge error:', e);
      return false;
    }
  },

  async getSdkBridges(enterpriseBlindId: string): Promise<Array<{ id: number; bridge_key: string; org_id: string | null; app_name: string; created_at: number }>> {
    try {
      const q = `
        SELECT id, bridge_key, org_id, app_name, created_at
        FROM whitedesk_sdk_bridges
        WHERE enterprise_blind_id = ${escapeSqlString(enterpriseBlindId)} AND is_active = TRUE
        ORDER BY created_at DESC;
      `;
      const rows = await executeSql(q);
      return rows.map((r: any) => ({
        id: Number(r.id),
        bridge_key: String(r.bridge_key),
        org_id: r.org_id ? String(r.org_id) : null,
        app_name: String(r.app_name || ''),
        created_at: Number(r.created_at || Date.now()),
      }));
    } catch {
      return [];
    }
  },

  /**
   * PROVİZYON KONSOLU TAŞIMA & İLİŞKİLENDİRME
   */
  async moveAdminToTarget(adminWhiteId: string, targetOrgId?: string, targetAppId?: string): Promise<boolean> {
    try {
      const cleanId = WhiteDeskCrypto.generateBlindId(adminWhiteId.trim());
      const cleanOrg = (!targetOrgId || targetOrgId === 'all' || targetOrgId === 'default') ? 'default' : targetOrgId.trim();
      const cleanApp = (!targetAppId || targetAppId === 'all' || targetAppId === 'default') ? 'all' : targetAppId.trim();
      const q = `
        UPDATE whitedesk_admins
        SET org_id = ${escapeSqlString(cleanOrg)},
            app_id = ${escapeSqlString(cleanApp)}
        WHERE white_id = ${escapeSqlString(cleanId)} OR blind_id = ${escapeSqlString(cleanId)} OR white_id = ${escapeSqlString(adminWhiteId.trim())};
      `;
      await executeSql(q);
      return true;
    } catch {
      return false;
    }
  },

  async moveAppToTarget(appId: string, targetOrgId?: string): Promise<boolean> {
    try {
      const cleanOrg = (!targetOrgId || targetOrgId === 'all' || targetOrgId === 'default') ? 'default' : targetOrgId.trim();
      const q = `
        UPDATE whitedesk_apps
        SET org_id = ${escapeSqlString(cleanOrg)}
        WHERE app_id = ${escapeSqlString(appId)};
      `;
      await executeSql(q);
      return true;
    } catch {
      return false;
    }
  },

  async assignCategoryToTarget(categoryKey: string, targetOrgId?: string, targetAppId?: string): Promise<boolean> {
    try {
      const cleanOrg = targetOrgId ? targetOrgId.trim().toLowerCase() : 'all';
      const cleanApp = targetAppId ? targetAppId.trim().toLowerCase() : 'all';
      const q = `
        UPDATE whitedesk_categories
        SET org_id = ${escapeSqlString(cleanOrg)},
            app_id = ${escapeSqlString(cleanApp)},
            updated_at = NOW()
        WHERE category_id = ${escapeSqlString(categoryKey)};
      `;
      await executeSql(q);
      clearCategoryCache();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Smart Load Balancing & Routing with 20% Category Threshold
   */
  async findBestAdminForTicket(
    enterpriseBlindId?: string,
    categoryId?: string
  ): Promise<{ whiteId: string; blindId: string; alias: string } | null> {
    try {
      const ent = (!enterpriseBlindId || enterpriseBlindId === 'all') ? 'default' : enterpriseBlindId.trim();
      const q = `
        SELECT white_id, alias, role, categories, 
               COALESCE(assigned_tickets_count, 0) as assigned_tickets_count,
               COALESCE(last_assigned_at, 0) as last_assigned_at
        FROM whitedesk_admins
        WHERE is_active = TRUE
          AND (enterprise_blind_id = ${escapeSqlString(ent)} OR enterprise_blind_id = 'default')
        ORDER BY assigned_tickets_count ASC, last_assigned_at ASC;
      `;
      const rows = await executeSql(q);
      if (!rows || rows.length === 0) return null;

      const admins = rows.map((r: any) => {
        let cats: string[] = [];
        try {
          cats = typeof r.categories === 'string' ? JSON.parse(r.categories) : (r.categories || []);
        } catch {
          cats = [];
        }
        const wId = String(r.white_id);
        const bId = wId.startsWith('blind_') ? wId : WhiteDeskCrypto.generateBlindId(wId);
        return {
          whiteId: wId,
          blindId: bId,
          alias: String(r.alias || bId.substring(0, 10)),
          role: String(r.role || 'admin'),
          categories: cats,
          assignedCount: Number(r.assigned_tickets_count || 0),
          lastAssignedAt: Number(r.last_assigned_at || 0),
        };
      });

      const minOverallLoad = Math.min(...admins.map(a => a.assignedCount));
      let selectedAdmin = admins[0];

      if (categoryId && categoryId.trim()) {
        const cleanCat = categoryId.trim().toLowerCase();
        const catAdmins = admins.filter(a =>
          a.categories.includes('all') ||
          a.categories.some((c: string) => c.toLowerCase() === cleanCat)
        );

        if (catAdmins.length > 0) {
          const bestCatAdmin = catAdmins[0];
          const isWithin20Pct = minOverallLoad === 0
            ? bestCatAdmin.assignedCount <= 1
            : bestCatAdmin.assignedCount <= minOverallLoad * 1.20;

          if (isWithin20Pct) {
            selectedAdmin = bestCatAdmin;
          } else {
            selectedAdmin = admins[0];
          }
        }
      }

      const now = Date.now();
      void executeSql(`
        UPDATE whitedesk_admins
        SET assigned_tickets_count = COALESCE(assigned_tickets_count, 0) + 1,
            last_assigned_at = ${now}
        WHERE white_id = ${escapeSqlString(selectedAdmin.whiteId)};
      `).catch(() => {});

      return {
        whiteId: selectedAdmin.whiteId,
        blindId: selectedAdmin.blindId,
        alias: selectedAdmin.alias,
      };
    } catch (e) {
      console.warn('[HelpDeskStationService] findBestAdminForTicket error:', e);
      return null;
    }
  },

  async incrementAdminTicketCount(adminWhiteId: string): Promise<boolean> {
    try {
      const cleanId = adminWhiteId.trim();
      const now = Date.now();
      await executeSql(`
        UPDATE whitedesk_admins
        SET assigned_tickets_count = COALESCE(assigned_tickets_count, 0) + 1,
            last_assigned_at = ${now}
        WHERE white_id = ${escapeSqlString(cleanId)};
      `);
      return true;
    } catch {
      return false;
    }
  },

  async decrementAdminTicketCount(adminWhiteId: string): Promise<boolean> {
    try {
      const cleanId = adminWhiteId.trim();
      await executeSql(`
        UPDATE whitedesk_admins
        SET assigned_tickets_count = GREATEST(0, COALESCE(assigned_tickets_count, 0) - 1)
        WHERE white_id = ${escapeSqlString(cleanId)};
      `);
      return true;
    } catch {
      return false;
    }
  },

  async getEnterpriseAdmins(
    enterpriseBlindId?: string
  ): Promise<Array<{ white_id: string; blind_id: string; alias: string; role: string; assigned_tickets_count: number }>> {
    try {
      const ent = (!enterpriseBlindId || enterpriseBlindId === 'all') ? 'default' : enterpriseBlindId.trim();
      const q = `
        SELECT white_id, alias, role, COALESCE(assigned_tickets_count, 0) as assigned_tickets_count
        FROM whitedesk_admins
        WHERE is_active = TRUE
          AND (enterprise_blind_id = ${escapeSqlString(ent)} OR enterprise_blind_id = 'default')
        ORDER BY assigned_tickets_count ASC, alias ASC;
      `;
      const rows = await executeSql(q);
      return rows.map((r: any) => {
        const wId = String(r.white_id);
        const bId = wId.startsWith('blind_') ? wId : WhiteDeskCrypto.generateBlindId(wId);
        return {
          white_id: wId,
          blind_id: bId,
          alias: String(r.alias || bId.substring(0, 10)),
          role: String(r.role || 'admin'),
          assigned_tickets_count: Number(r.assigned_tickets_count || 0),
        };
      });
    } catch (e) {
      console.warn('[HelpDeskStationService] getEnterpriseAdmins error:', e);
      return [];
    }
  },
};
