/**
 * WhiteDesk SDK — Database Layer
 * Neon PostgreSQL Serverless Integration & DDL Schema Manager
 */

// SECURITY: Credentials are NEVER committed. Loaded from gitignored .env.local at bundle time.
// TEMPORARY — will be removed entirely once whitedesk-api (Vercel) backend is live.
export const DEFAULT_NEON_ENDPOINT = `${(process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.whitedesk.one').replace(/\/$/, '')}/api/d1/query`;

export const DEFAULT_CONNECTION_STRING = '';

export function escapeSql(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  const str = String(val);
  return `'${str.replace(/'/g, "''")}'`;
}

export class WhiteDeskDatabase {
  private endpoint: string;
  private connectionString: string;
  private isSchemaEnsured = false;

  constructor(endpoint?: string, connectionString?: string) {
    this.endpoint = endpoint || DEFAULT_NEON_ENDPOINT;
    this.connectionString = connectionString || DEFAULT_CONNECTION_STRING;
  }

  /**
   * Execute raw SQL via Neon serverless HTTP endpoint
   */
  async executeSql<T = any>(query: string): Promise<T[]> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Neon-Connection-String': this.connectionString,
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`[WhiteDeskDatabase] HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return (data.rows || []) as T[];
    } catch (error) {
      console.warn('[WhiteDeskDatabase] executeSql error:', error);
      throw error;
    }
  }

  /**
   * Zero-Knowledge Sovereign Schema Provisioner
   */
  async ensureSchema(): Promise<void> {
    if (this.isSchemaEnsured) return;

    const queries = [
      `CREATE TABLE IF NOT EXISTS whitedesk_genesis_vault (
        id SERIAL PRIMARY KEY,
        enterprise_blind_id VARCHAR(64) UNIQUE NOT NULL,
        enterprise_name VARCHAR(100) NOT NULL,
        app_name VARCHAR(50) NOT NULL,
        org_pub VARCHAR(64) NOT NULL,
        claimed BOOLEAN DEFAULT FALSE,
        claimed_by_blind_id VARCHAR(64),
        created_at BIGINT NOT NULL,
        claimed_at BIGINT
      );`,

      `CREATE TABLE IF NOT EXISTS whitedesk_enterprises (
        id SERIAL PRIMARY KEY,
        enterprise_blind_id VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        org_pub VARCHAR(64) NOT NULL,
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

      `CREATE TABLE IF NOT EXISTS whitedesk_orgs (
        org_id VARCHAR(64) PRIMARY KEY,
        enterprise_blind_id VARCHAR(64),
        name VARCHAR(100) NOT NULL,
        created_at BIGINT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS whitedesk_admins (
        white_id VARCHAR(128) PRIMARY KEY,
        enterprise_blind_id VARCHAR(64),
        alias VARCHAR(100) NOT NULL,
        role VARCHAR(32) DEFAULT 'operator',
        is_active BOOLEAN DEFAULT TRUE,
        created_at BIGINT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS admin_allocations (
        id SERIAL PRIMARY KEY,
        admin_blind_id VARCHAR(64) NOT NULL,
        admin_pubkey VARCHAR(64) NOT NULL,
        org_id VARCHAR(64) NOT NULL DEFAULT 'default',
        app_id VARCHAR(64) NOT NULL,
        category_id VARCHAR(64) NOT NULL,
        role VARCHAR(32) NOT NULL,
        alias VARCHAR(64) NOT NULL,
        granted_by_blind VARCHAR(64) NOT NULL,
        nonce VARCHAR(64) NOT NULL,
        signature TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        CONSTRAINT uq_admin_app_cat UNIQUE (admin_blind_id, app_id, category_id)
      );`,

      `CREATE TABLE IF NOT EXISTS whitedesk_app_cat (
        id SERIAL PRIMARY KEY,
        app_id VARCHAR(64) NOT NULL,
        category_id VARCHAR(64) NOT NULL,
        label_tr VARCHAR(255),
        label_en VARCHAR(255),
        icon VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_app_category UNIQUE (app_id, category_id)
      );`,

      `CREATE TABLE IF NOT EXISTS whitedesk_tickets (
        ticket_no VARCHAR(32) PRIMARY KEY,
        app_id VARCHAR(64) NOT NULL,
        category_id VARCHAR(64) NOT NULL,
        ticket_pubkey VARCHAR(64) NOT NULL,
        user_blind_id VARCHAR(64) NOT NULL,
        user_pubkey VARCHAR(64),
        assigned_admin_blind VARCHAR(64),
        subject VARCHAR(512) NOT NULL,
        payload TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,

      `CREATE TABLE IF NOT EXISTS whitedesk_ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_no VARCHAR(32) NOT NULL REFERENCES whitedesk_tickets(ticket_no) ON DELETE CASCADE,
        sender_blind_id VARCHAR(64) NOT NULL,
        sender_role VARCHAR(20) NOT NULL,
        sender_alias VARCHAR(64),
        message TEXT NOT NULL,
        attachment_data TEXT,
        attachment_type VARCHAR(32),
        attachment_name VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`
    ];

    try {
      for (const q of queries) {
        await this.executeSql(q);
      }
      this.isSchemaEnsured = true;
    } catch (e) {
      console.warn('[WhiteDeskDatabase] ensureSchema error:', e);
    }
  }
}
