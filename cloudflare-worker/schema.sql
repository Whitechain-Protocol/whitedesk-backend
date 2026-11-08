-- =============================================================================
-- WHITEDESK SOVEREIGN ARCHITECTURE — %100 CLOUDFLARE D1 (SQLITE EDGE) MASTER SCHEMA
-- =============================================================================
-- Mimari: Tüm Kalıcı (Egemen) ve Geçici (Buharlaşan) Tablolar Tekil Cloudflare D1
--         Veritabanında (`whitedesk_d1_relay`) Birleştirilmiştir.
--         Neon PostgreSQL ve `admin_roster` Tablosu Tamamen Tasfiye Edilmiştir.
-- =============================================================================

-- Eski Ayrı Roster ve Lisans Tablosu / Görünümünün Tasfiyesi (whitedesk_admins ve whitedesk_enterprises ile birleştirildi)
DROP TABLE IF EXISTS admin_roster;
DROP VIEW IF EXISTS whitedesk_tenant_licenses;
DROP TABLE IF EXISTS whitedesk_tenant_licenses;

-- 1. KİRACILAR & LİSANSLAR / KURUMSAL ÇATI (whitedesk_enterprises)
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

-- 2. GENESIS KASASI (whitedesk_genesis_vault)
CREATE TABLE IF NOT EXISTS whitedesk_genesis_vault (
  enterprise_blind_id TEXT PRIMARY KEY,
  enterprise_name TEXT,
  app_name TEXT,
  org_pub TEXT,
  claimed INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

-- 3. LİSANS PLANLARI (whitedesk_license_plans)
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

-- 4. UYGULAMALAR (whitedesk_apps)
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

-- 5. ORGANİZASYONLAR / BİRİMLER (whitedesk_orgs)
CREATE TABLE IF NOT EXISTS whitedesk_orgs (
  org_id TEXT PRIMARY KEY,
  enterprise_blind_id TEXT NOT NULL,
  org_blind_id TEXT,
  name TEXT NOT NULL,
  public_key TEXT,
  created_by TEXT,
  created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

-- 6. DİNAMİK DEPARTMAN KATEGORİLERİ (whitedesk_categories)
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

-- 7. BİRLEŞİK YÖNETİCİLER / TEMSİLCİLER & ADİL DAĞITIM ROSTER TABLOSU (whitedesk_admins)
-- Not: Eski `admin_roster` tablosundaki open_tickets, counter, snooze_until ve date_time
--      alanları doğrudan bu tabloya konsolide edilmiştir.
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

-- 8. KÜRESEL YÖNETİCİ ÇİFT ONAY KUYRUĞU (whitedesk_approvals)
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

-- 9. PERSONEL VE KULLANICI BAĞLAMALARI (whitedesk_user_bindings)
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

-- 10. KULLANICI VE CİHAZ BİLDİRİM EŞLEŞMELERİ (whitedesk_user_devices)
CREATE TABLE IF NOT EXISTS whitedesk_user_devices (
  white_id TEXT PRIMARY KEY,
  blind_id TEXT,
  device_fingerprint TEXT,
  fcm_token TEXT,
  push_token TEXT,
  platform TEXT DEFAULT 'android',
  updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

-- 11. KURTARMA VE İLK SAHİPLENME HASH'LERİ (whitedesk_recovery_hashes)
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

-- 12. UYGULAMA TESCİL TALEPLERİ (whitedesk_app_requests)
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

-- 13. YÖNETİCİ DEĞERLENDİRMELERİ VE PERFORMANS PUANLARI (whitedesk_ticket_ratings)
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

-- 14. SİSTEM YAPILANDIRMASI, KULLANICI TERCİHLERİ VE SDK KÖPRÜLERİ
CREATE TABLE IF NOT EXISTS whitedesk_system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whitedesk_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS whitedesk_user_preferences (
  white_id TEXT PRIMARY KEY,
  prefs TEXT DEFAULT '{}',
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whitedesk_sdk_bridges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bridge_key TEXT UNIQUE NOT NULL,
  enterprise_blind_id TEXT NOT NULL,
  org_id TEXT DEFAULT 'default',
  app_name TEXT,
  created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  is_active INTEGER DEFAULT 1
);

DROP TABLE IF EXISTS whitedesk_desktop_sessions;
CREATE TABLE IF NOT EXISTS whitedesk_desktop_sessions (
  session_id TEXT PRIMARY KEY,
  white_id TEXT,
  admin_blind_id TEXT,
  enterprise_blind_id TEXT DEFAULT 'default',
  role TEXT DEFAULT 'admin',
  paired_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1,
  billing_cycle TEXT DEFAULT 'active',
  expires_at INTEGER,
  created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

-- =============================================================================
-- 15. BUHARLAŞMA HAVUZU VE GERÇEK ZAMANLI SİNYAL TABLOLARI (D1 EPHEMERAL)
-- =============================================================================

-- Geçici Asenkron Bilet / Mesaj Kuyruğu (ACK sonrası anında silinir)
CREATE TABLE IF NOT EXISTS transient_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  recipient_blind_id TEXT NOT NULL,
  sender_blind_id TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  attachment_r2_key TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- WebRTC Hızlı Sinyalizasyon Tablosu (Anycast D1)
CREATE TABLE IF NOT EXISTS ephemeral_signals (
  room_name TEXT PRIMARY KEY,
  offer_sdp TEXT,
  answer_sdp TEXT,
  signal_type TEXT,
  target_mode TEXT,
  caller_candidates TEXT DEFAULT '[]',
  callee_candidates TEXT DEFAULT '[]',
  updated_at INTEGER NOT NULL
);

-- Geçici RTC Sinyalleri
CREATE TABLE IF NOT EXISTS transient_rtc_signals (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_blind_id TEXT NOT NULL,
  recipient_blind_id TEXT,
  signal_type TEXT NOT NULL,
  encrypted_sdp_or_ice TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- =============================================================================
-- 17. PERFORMANS İNDEKSLERİ
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_whitedesk_approvals_status ON whitedesk_approvals(status);
CREATE INDEX IF NOT EXISTS idx_whitedesk_categories_lookup ON whitedesk_categories(enterprise_blind_id, app_id, is_active);
CREATE INDEX IF NOT EXISTS idx_whitedesk_admins_lookup ON whitedesk_admins(enterprise_blind_id, role, is_active);
CREATE INDEX IF NOT EXISTS idx_whitedesk_admins_alloc ON whitedesk_admins(enterprise_blind_id, org_id, app_id, is_active, counter);
CREATE INDEX IF NOT EXISTS idx_whitedesk_ratings_admin ON whitedesk_ticket_ratings(admin_blind_id);
CREATE INDEX IF NOT EXISTS idx_whitedesk_devices_blind ON whitedesk_user_devices(blind_id);
CREATE INDEX IF NOT EXISTS idx_transient_recipient ON transient_messages(recipient_blind_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transient_ticket ON transient_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_transient_expires ON transient_messages(expires_at);
CREATE INDEX IF NOT EXISTS idx_signals_updated ON ephemeral_signals(updated_at);
CREATE INDEX IF NOT EXISTS idx_rtc_room ON transient_rtc_signals(room_id, created_at);

-- =============================================================================
-- 17. VARSAYILAN BAŞLANGIÇ VERİLERİ (SEED DATA)
-- =============================================================================
INSERT OR IGNORE INTO whitedesk_license_plans (id, name, tier_level, monthly_price, annual_price, features, grace_period, grace_period_warning_interval, is_active)
VALUES
  ('trial', 'Ücretsiz Deneme', 0, 0.00, 0.00, '["Ücretsiz deneme süresi","Bütün temel özellikler","Cihazda yerel AES-256 şifreleme","Mobil ve masaüstü istemcileri"]', '3', '12', 1),
  ('core', 'CORE Paketi', 1, 49.00, 39.00, '["Cihazda yerel AES-256 şifreleme","Uçtan uca şifreleme","Sunucuda sıfır veri\\nVeriler yerel cihazlarda tutulur","Federal veri hasadı\\nTek tuşla verileri merkezde toplama","Cihazda otomatik veri maskeleme","Kör kimlik koruması","Sistem ve hata tanısı ekleme","Çift onaylı yetki kuyruğu","Mobil ve masaüstü istemcileri","Sınırsız operatör ve kullanıcı","Kategori ve organizasyon yönetimi","Dosya ve ekran görüntüsü ekleri","Gelişmiş denetim ve raporlama özellikleri"]', '{"monthly":5,"annual":15}', '{"monthly":24,"annual":48}', 1),
  ('live', 'LIVE Paketi', 2, 129.00, 99.00, '["Bütün temel özellikler","Uzak masaüstü","Bilet içerisinden sesli görüşme","Bilet içerisinden bas-konuş","Telsiz yayını"]', '{"monthly":5,"annual":15}', '{"monthly":24,"annual":48}', 1);
