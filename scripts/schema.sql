-- ============================================================================
-- WhiteDesk Sovereign Multi-Tenant Infrastructure - Master DDL Schema
-- Sovereign Zero-Knowledge Database Architecture (PostgreSQL / Neon)
-- Disaster Recovery & Cold Start Initialization Script
-- ============================================================================

-- 1. Genesis Vault (Cryptographic license allocations before claiming)
CREATE TABLE IF NOT EXISTS whitedesk_genesis_vault (
  id SERIAL PRIMARY KEY,
  enterprise_blind_id VARCHAR(64) UNIQUE NOT NULL,
  enterprise_name VARCHAR(100) NOT NULL,
  app_name VARCHAR(50) NOT NULL,
  org_pub VARCHAR(64) NOT NULL,
  claimed BOOLEAN DEFAULT FALSE,
  claimed_by_blind_id VARCHAR(64),
  created_at BIGINT NOT NULL,
  claimed_at BIGINT
);

-- 2. Enterprises / Tenants (Top-level organizations / holdings)
CREATE TABLE IF NOT EXISTS whitedesk_enterprises (
  id SERIAL PRIMARY KEY,
  enterprise_blind_id VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  org_pub VARCHAR(64) NOT NULL,
  is_founder_tenant BOOLEAN DEFAULT FALSE,
  created_at BIGINT NOT NULL
);

-- 3. Organizations / Branches (Divisions within an enterprise)
CREATE TABLE IF NOT EXISTS whitedesk_orgs (
  org_id VARCHAR(64) PRIMARY KEY,
  enterprise_blind_id VARCHAR(64),
  name VARCHAR(100) NOT NULL,
  created_at BIGINT NOT NULL
);

-- 4. App Categories (Applications & Department Categories)
CREATE TABLE IF NOT EXISTS whitedesk_app_cat (
  app_id VARCHAR(50) PRIMARY KEY,
  enterprise_blind_id VARCHAR(64),
  categories JSONB NOT NULL DEFAULT '[]',
  updated_at BIGINT NOT NULL
);

-- 5. Administrators (Zero-Knowledge: white_id stores HMAC blind_id)
-- Role hierarchy: 'founder' (**), 'global_admin' (*), 'admin'
CREATE TABLE IF NOT EXISTS whitedesk_admins (
  white_id VARCHAR(128) PRIMARY KEY,
  enterprise_blind_id VARCHAR(64),
  alias VARCHAR(100) NOT NULL,
  role VARCHAR(32) DEFAULT 'admin',
  is_active BOOLEAN DEFAULT TRUE,
  created_at BIGINT NOT NULL
);

-- 6. Admin Scope Allocations
CREATE TABLE IF NOT EXISTS whitedesk_admin_alloc (
  id SERIAL PRIMARY KEY,
  admin_white_id VARCHAR(128) NOT NULL,
  enterprise_blind_id VARCHAR(64),
  org_id VARCHAR(64) NOT NULL DEFAULT 'default',
  app_id VARCHAR(50) NOT NULL,
  categories JSONB NOT NULL DEFAULT '["all"]',
  updated_at BIGINT NOT NULL
);

-- 7. Tickets & Discussions
CREATE TABLE IF NOT EXISTS whitedesk_tickets (
  id VARCHAR(32) PRIMARY KEY,
  enterprise_blind_id VARCHAR(64),
  org_id VARCHAR(64) DEFAULT 'default',
  app_id VARCHAR(50) NOT NULL,
  user_white_id VARCHAR(128) NOT NULL,
  user_blind_id VARCHAR(64),
  user_pubkey VARCHAR(64),
  ticket_pubkey VARCHAR(64),
  subject VARCHAR(200) NOT NULL,
  category VARCHAR(64) DEFAULT 'general',
  status VARCHAR(20) DEFAULT 'open',
  is_discussion BOOLEAN DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Column additions if table existed prior
ALTER TABLE whitedesk_tickets ADD COLUMN IF NOT EXISTS is_discussion BOOLEAN DEFAULT FALSE;
ALTER TABLE whitedesk_tickets ADD COLUMN IF NOT EXISTS enterprise_blind_id VARCHAR(64);
ALTER TABLE whitedesk_tickets ADD COLUMN IF NOT EXISTS org_id VARCHAR(64) DEFAULT 'default';
ALTER TABLE whitedesk_tickets ADD COLUMN IF NOT EXISTS category VARCHAR(64) DEFAULT 'general';

-- 8. Messages & Attachments
CREATE TABLE IF NOT EXISTS whitedesk_messages (
  id VARCHAR(32) PRIMARY KEY,
  ticket_id VARCHAR(32) NOT NULL,
  app_id VARCHAR(50) NOT NULL,
  sender_white_id VARCHAR(128) NOT NULL,
  sender_alias VARCHAR(100),
  sender_blind_id VARCHAR(64),
  is_admin BOOLEAN DEFAULT FALSE,
  message TEXT NOT NULL,
  attachment_data TEXT,
  attachment_name VARCHAR(255),
  attachment_type VARCHAR(50),
  created_at BIGINT NOT NULL
);

-- 9. Approvals Queue (Hierarchical promotion & authorization pipeline)
CREATE TABLE IF NOT EXISTS whitedesk_approvals (
  id SERIAL PRIMARY KEY,
  type VARCHAR(32) NOT NULL,
  tenant_blind_id VARCHAR(64) NOT NULL,
  tenant_name VARCHAR(100),
  candidate_white_id VARCHAR(128),
  candidate_blind_id VARCHAR(64) NOT NULL,
  candidate_alias VARCHAR(100),
  target_org_id VARCHAR(64),
  target_app_id VARCHAR(50),
  target_categories JSONB DEFAULT '["all"]',
  status VARCHAR(20) DEFAULT 'pending',
  requested_at BIGINT NOT NULL,
  reviewed_at BIGINT,
  reviewed_by VARCHAR(128)
);

-- 10. Single-Use Cryptographic Recovery & Claim Hashes
CREATE TABLE IF NOT EXISTS whitedesk_recovery_hashes (
  hash VARCHAR(128) PRIMARY KEY,
  type VARCHAR(32) NOT NULL,
  tenant_blind_id VARCHAR(64) NOT NULL,
  org_id VARCHAR(64),
  app_id VARCHAR(50),
  categories JSONB DEFAULT '["all"]',
  used BOOLEAN DEFAULT FALSE,
  used_at BIGINT,
  used_by_blind_id VARCHAR(64),
  max_uses INT DEFAULT 1,
  uses_count INT DEFAULT 0,
  expires_at BIGINT,
  created_at BIGINT NOT NULL
);

-- 11. User Tenant & Division Bindings
CREATE TABLE IF NOT EXISTS whitedesk_user_bindings (
  id SERIAL PRIMARY KEY,
  user_blind_id VARCHAR(64) UNIQUE NOT NULL,
  tenant_blind_id VARCHAR(64) NOT NULL,
  org_id VARCHAR(64),
  app_id VARCHAR(50),
  alias VARCHAR(100),
  status VARCHAR(20) DEFAULT 'approved',
  created_at BIGINT NOT NULL
);

-- 12. Dynamic System Configurations
CREATE TABLE IF NOT EXISTS whitedesk_config (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Alterations
ALTER TABLE whitedesk_enterprises ADD COLUMN IF NOT EXISTS is_founder_tenant BOOLEAN DEFAULT FALSE;
ALTER TABLE whitedesk_admins ADD COLUMN IF NOT EXISTS enterprise_blind_id VARCHAR(64);
ALTER TABLE whitedesk_admins ADD COLUMN IF NOT EXISTS role VARCHAR(32) DEFAULT 'admin';
ALTER TABLE whitedesk_orgs ADD COLUMN IF NOT EXISTS enterprise_blind_id VARCHAR(64);
ALTER TABLE whitedesk_app_cat ADD COLUMN IF NOT EXISTS enterprise_blind_id VARCHAR(64);
ALTER TABLE whitedesk_admin_alloc ADD COLUMN IF NOT EXISTS enterprise_blind_id VARCHAR(64);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON whitedesk_tickets(enterprise_blind_id);
CREATE INDEX IF NOT EXISTS idx_tickets_discussion ON whitedesk_tickets(is_discussion);
CREATE INDEX IF NOT EXISTS idx_approvals_tenant ON whitedesk_approvals(tenant_blind_id, status);
CREATE INDEX IF NOT EXISTS idx_admins_tenant ON whitedesk_admins(enterprise_blind_id);
