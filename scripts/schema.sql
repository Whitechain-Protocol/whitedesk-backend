-- =============================================================================
-- WHITEDESK SOVEREIGN ARCHITECTURE — %100 CLOUDFLARE D1 (SQLITE EDGE) MASTER SCHEMA
-- =============================================================================
DROP TABLE IF EXISTS admin_roster;

CREATE TABLE IF NOT EXISTS whitedesk_enterprises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enterprise_blind_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  org_pub TEXT,
  is_founder_tenant INTEGER DEFAULT 0,
  custom_fields TEXT DEFAULT '[]',
  catalog TEXT DEFAULT '[]',
  advanced_features_config TEXT DEFAULT '{}',
  logo_uri TEXT,
  logo_align TEXT DEFAULT 'left',
  plan_id TEXT DEFAULT 'trial',
  billing_cycle TEXT DEFAULT 'monthly',
  subscription_start_at TEXT DEFAULT (datetime('now')),
  subscription_end_at TEXT DEFAULT (datetime('now', '+14 days')),
  created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

CREATE TABLE IF NOT EXISTS whitedesk_genesis_vault (
  enterprise_blind_id TEXT PRIMARY KEY,
  enterprise_name TEXT,
  app_name TEXT,
  org_pub TEXT,
  claimed INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

CREATE TABLE IF NOT EXISTS whitedesk_license_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier_level INTEGER NOT NULL DEFAULT 0,
  monthly_price REAL DEFAULT 0,
  annual_price REAL DEFAULT 0,
  features TEXT DEFAULT '[]',
  grace_period TEXT DEFAULT '3',
  grace_period_warning_interval TEXT DEFAULT '12',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whitedesk_apps (
  app_id TEXT PRIMARY KEY,
  enterprise_blind_id TEXT NOT NULL DEFAULT 'default',
  org_id TEXT DEFAULT 'default',
  app_blind_id TEXT,
  org_blind_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'HelpCircle',
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

CREATE TABLE IF NOT EXISTS whitedesk_orgs (
  org_id TEXT PRIMARY KEY,
  enterprise_blind_id TEXT NOT NULL,
  org_blind_id TEXT,
  name TEXT NOT NULL,
  public_key TEXT,
  created_by TEXT,
  created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

CREATE TABLE IF NOT EXISTS whitedesk_categories (
  category_id TEXT PRIMARY KEY,
  enterprise_blind_id TEXT NOT NULL DEFAULT 'default',
  org_id TEXT NOT NULL DEFAULT 'default',
  app_id TEXT NOT NULL DEFAULT 'all',
  scope_type TEXT NOT NULL DEFAULT 'app',
  name_tr TEXT,
  name_en TEXT,
  categories TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whitedesk_admins (
  white_id TEXT PRIMARY KEY,
  blind_id TEXT,
  enterprise_blind_id TEXT NOT NULL DEFAULT 'default',
  alias TEXT,
  is_custom_alias INTEGER DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'admin',
  pub_key TEXT,
  granted_by TEXT,
  org_id TEXT DEFAULT 'default',
  app_id TEXT DEFAULT 'all',
  categories TEXT DEFAULT '["general"]',
  is_active INTEGER DEFAULT 1,
  duty_status TEXT DEFAULT 'online',
  last_duty_update TEXT DEFAULT (datetime('now')),
  open_tickets INTEGER DEFAULT 0,
  counter INTEGER DEFAULT 0,
  snooze_until INTEGER DEFAULT 0,
  date_time INTEGER DEFAULT 0,
  assigned_tickets_count INTEGER DEFAULT 0,
  last_assigned_at INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whitedesk_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  tenant_blind_id TEXT NOT NULL,
  tenant_name TEXT,
  candidate_white_id TEXT,
  candidate_blind_id TEXT NOT NULL,
  candidate_alias TEXT,
  target_org_id TEXT DEFAULT 'default',
  target_app_id TEXT DEFAULT 'whitedesk',
  target_categories TEXT DEFAULT '[]',
  payload TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  reviewed_at INTEGER,
  reviewed_by TEXT
);

CREATE TABLE IF NOT EXISTS whitedesk_user_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_blind_id TEXT UNIQUE NOT NULL,
  tenant_blind_id TEXT NOT NULL,
  org_id TEXT NOT NULL DEFAULT 'default',
  app_id TEXT NOT NULL DEFAULT 'whitedesk',
  alias TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

CREATE TABLE IF NOT EXISTS whitedesk_user_devices (
  white_id TEXT PRIMARY KEY,
  blind_id TEXT,
  device_fingerprint TEXT,
  fcm_token TEXT,
  push_token TEXT,
  platform TEXT DEFAULT 'android',
  updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

CREATE TABLE IF NOT EXISTS whitedesk_recovery_hashes (
  hash TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  tenant_blind_id TEXT NOT NULL,
  org_id TEXT DEFAULT 'default',
  org_blind_id TEXT,
  app_id TEXT DEFAULT 'whitedesk',
  categories TEXT DEFAULT '["general"]',
  used INTEGER DEFAULT 0,
  used_at INTEGER,
  used_by_blind_id TEXT,
  max_uses INTEGER DEFAULT 1,
  uses_count INTEGER DEFAULT 0,
  expires_at INTEGER,
  created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

CREATE TABLE IF NOT EXISTS whitedesk_app_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  app_name TEXT NOT NULL,
  description TEXT,
  requestor_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  reviewed_at INTEGER,
  reviewed_by TEXT
);

CREATE TABLE IF NOT EXISTS whitedesk_ticket_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT UNIQUE NOT NULL,
  enterprise_blind_id TEXT NOT NULL,
  admin_blind_id TEXT NOT NULL,
  admin_white_id TEXT,
  org_id TEXT DEFAULT 'default',
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  feedback_note TEXT,
  created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);
