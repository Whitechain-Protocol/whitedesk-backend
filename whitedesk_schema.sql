-- ============================================================================
-- WHITEDESK SIFIR-BİLGİ (ZERO-KNOWLEDGE) MERKEZİ VERİTABANI ŞEMASI
-- İdempotent: Tablolar yoksa sıfırdan kurar, varsa hiçbir veriyi bozmadan devam eder.
-- Tek bir SQL komutu olarak Neon PostgreSQL SQL Editor veya psql'de çalıştırılabilir.
-- ============================================================================

-- 1. KİRACILAR / KURUMSAL ÇATI (whitedesk_enterprises)
CREATE TABLE IF NOT EXISTS whitedesk_enterprises (
    enterprise_blind_id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    org_pub TEXT,
    is_founder_tenant BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. UYGULAMALAR (whitedesk_apps)
CREATE TABLE IF NOT EXISTS whitedesk_apps (
    app_id VARCHAR(64) PRIMARY KEY,
    enterprise_blind_id VARCHAR(128) DEFAULT 'default',
    name VARCHAR(128) NOT NULL,
    description TEXT,
    icon VARCHAR(64) DEFAULT 'Layers',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ORGANİZASYONLAR / ŞİRKETLER (whitedesk_orgs)
CREATE TABLE IF NOT EXISTS whitedesk_orgs (
    org_id VARCHAR(64) PRIMARY KEY,
    enterprise_blind_id VARCHAR(128) DEFAULT 'default',
    name VARCHAR(128) NOT NULL,
    public_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DİNAMİK DEPARTMAN KATEGORİLERİ (whitedesk_categories)
CREATE TABLE IF NOT EXISTS whitedesk_categories (
    category_id VARCHAR(64) PRIMARY KEY,
    enterprise_blind_id VARCHAR(128) DEFAULT 'default',
    org_id VARCHAR(64) NOT NULL DEFAULT 'default',
    app_id VARCHAR(64) NOT NULL DEFAULT 'all',
    name_tr VARCHAR(128) NOT NULL,
    name_en VARCHAR(128) NOT NULL,
    icon VARCHAR(64) DEFAULT 'HelpCircle',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DESTEK BİLETLERİ (whitedesk_tickets)
CREATE TABLE IF NOT EXISTS whitedesk_tickets (
    id VARCHAR(32) PRIMARY KEY, -- 'TKT-XXXXXX'
    enterprise_blind_id VARCHAR(128),
    org_id VARCHAR(64) NOT NULL DEFAULT 'default',
    app_id VARCHAR(64) NOT NULL DEFAULT 'inwhite',
    user_white_id VARCHAR(128),
    user_blind_id VARCHAR(128) NOT NULL,
    user_pubkey TEXT,
    ticket_pubkey TEXT,
    subject TEXT NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'general',
    payload TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'answered', 'closed'
    is_discussion BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- 6. BİLET MESAJLARI VE EKLERİ (whitedesk_ticket_messages)
CREATE TABLE IF NOT EXISTS whitedesk_ticket_messages (
    id VARCHAR(64) PRIMARY KEY,
    ticket_id VARCHAR(32) NOT NULL REFERENCES whitedesk_tickets(id) ON DELETE CASCADE,
    app_id VARCHAR(64) NOT NULL DEFAULT 'inwhite',
    sender_white_id VARCHAR(128) NOT NULL,
    sender_alias VARCHAR(64),
    sender_blind_id VARCHAR(128),
    is_admin BOOLEAN DEFAULT FALSE,
    message TEXT NOT NULL,
    attachment_data TEXT, -- Base64 JPEG veya PDF
    attachment_name VARCHAR(255),
    attachment_type VARCHAR(32),
    created_at BIGINT NOT NULL
);

-- 7. YÖNETİCİLER / OPERATÖRLER (whitedesk_admins)
CREATE TABLE IF NOT EXISTS whitedesk_admins (
    id SERIAL PRIMARY KEY,
    white_id VARCHAR(128) UNIQUE NOT NULL,
    enterprise_blind_id VARCHAR(128) DEFAULT 'default',
    alias VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'admin', -- 'founder', 'global_admin', 'admin'
    pub_key TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    granted_by VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. RPG II 3-KADEMELİ YETKİ MATRİSİ (whitedesk_admin_alloc)
CREATE TABLE IF NOT EXISTS whitedesk_admin_alloc (
    id SERIAL PRIMARY KEY,
    admin_white_id VARCHAR(128) NOT NULL,
    enterprise_blind_id VARCHAR(128) DEFAULT 'default',
    org_id VARCHAR(64) NOT NULL DEFAULT 'default',
    app_id VARCHAR(64) NOT NULL DEFAULT 'all',
    category_id VARCHAR(64) NOT NULL DEFAULT 'all',
    categories TEXT, -- JSON dizi veya virgülle ayrılmış kategoriler
    ed25519_sig TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_admin_alloc UNIQUE (admin_white_id, enterprise_blind_id, org_id, app_id, category_id)
);

-- 9. GLOBAL ADMIN SİLME VE YETKİ ONAY KUYRUĞU (whitedesk_approvals)
CREATE TABLE IF NOT EXISTS whitedesk_approvals (
    id SERIAL PRIMARY KEY,
    type VARCHAR(64) NOT NULL, -- 'global_admin', 'admin', 'user', 'delete_app', 'delete_org'
    tenant_blind_id VARCHAR(128) NOT NULL DEFAULT 'default',
    candidate_white_id VARCHAR(128),
    candidate_blind_id VARCHAR(128),
    candidate_alias VARCHAR(64),
    target_org_id VARCHAR(64),
    target_app_id VARCHAR(64),
    target_categories TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(128)
);

-- 10. PERSONEL VE KULLANICI BAĞLAMALARI (whitedesk_user_bindings)
CREATE TABLE IF NOT EXISTS whitedesk_user_bindings (
    id SERIAL PRIMARY KEY,
    user_blind_id VARCHAR(128) NOT NULL,
    tenant_blind_id VARCHAR(128) NOT NULL DEFAULT 'default',
    org_id VARCHAR(64) NOT NULL DEFAULT 'default',
    app_id VARCHAR(64) NOT NULL DEFAULT 'all',
    alias VARCHAR(64),
    status VARCHAR(32) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_binding UNIQUE (user_blind_id, tenant_blind_id, org_id)
);

-- 11. GENESIS VAULT (whitedesk_genesis_vault)
CREATE TABLE IF NOT EXISTS whitedesk_genesis_vault (
    enterprise_blind_id VARCHAR(128) PRIMARY KEY,
    claimed_by_blind_id VARCHAR(128),
    claimed_by_white_id VARCHAR(128),
    vault_payload TEXT,
    is_claimed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. KURTARMA VE İLK SAHİPLENME HASH'LERİ (whitedesk_recovery_hashes)
CREATE TABLE IF NOT EXISTS whitedesk_recovery_hashes (
    hash VARCHAR(128) PRIMARY KEY,
    type VARCHAR(32) NOT NULL, -- 'founder', 'global_admin', 'user'
    enterprise_blind_id VARCHAR(128),
    is_claimed BOOLEAN DEFAULT FALSE,
    claimed_by VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. UYGULAMA TESCİL TALEPLERİ (whitedesk_app_requests)
CREATE TABLE IF NOT EXISTS whitedesk_app_requests (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(64) NOT NULL,
    app_name VARCHAR(128) NOT NULL,
    description TEXT,
    requestor_id VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(128)
);

-- 14. ÇOK KİRACILI UYGULAMA VE KATEGORİ HARİTASI (whitedesk_app_cat)
CREATE TABLE IF NOT EXISTS whitedesk_app_cat (
    app_id VARCHAR(64) PRIMARY KEY,
    enterprise_blind_id VARCHAR(128),
    categories JSONB NOT NULL DEFAULT '[]',
    updated_at BIGINT NOT NULL
);

-- ============================================================================
-- PERFORMANS İNDEKSLERİ (IF NOT EXISTS)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_whitedesk_tickets_user ON whitedesk_tickets(user_blind_id);
CREATE INDEX IF NOT EXISTS idx_whitedesk_tickets_app_org ON whitedesk_tickets(app_id, org_id);
CREATE INDEX IF NOT EXISTS idx_whitedesk_tickets_status ON whitedesk_tickets(status);
CREATE INDEX IF NOT EXISTS idx_whitedesk_tickets_updated ON whitedesk_tickets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_whitedesk_msgs_ticket ON whitedesk_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_whitedesk_admin_alloc ON whitedesk_admin_alloc(admin_white_id);
CREATE INDEX IF NOT EXISTS idx_whitedesk_approvals_status ON whitedesk_approvals(status);

-- ============================================================================
-- BAŞLANGIÇ TOHUM VERİLERİ (SEED DATA - ON CONFLICT DO NOTHING)
-- ============================================================================

-- Varsayılan Kiracı (Default Enterprise)
INSERT INTO whitedesk_enterprises (enterprise_blind_id, name, is_founder_tenant)
VALUES ('default', 'Whitechain Foundation', TRUE)
ON CONFLICT (enterprise_blind_id) DO NOTHING;

-- Temel Uygulamalar
INSERT INTO whitedesk_apps (app_id, enterprise_blind_id, name, description, icon)
VALUES 
    ('inwhite', 'default', 'inWhite Voice & Core', 'P2P ve Cloud TLS gizli iletişim protokolü', 'Phone'),
    ('whitedesk', 'default', 'WhiteDesk Operations', 'Merkezi Yönetim ve Yetkilendirme Masası', 'Headphones')
ON CONFLICT (app_id) DO NOTHING;

-- Temel Organizasyonlar
INSERT INTO whitedesk_orgs (org_id, enterprise_blind_id, name)
VALUES 
    ('default', 'default', 'Genel Merkez / Genel Kurum'),
    ('*', 'default', 'Tüm Organizasyonlar (Kozmik Kapsam)')
ON CONFLICT (org_id) DO NOTHING;

-- Temel Kategoriler
INSERT INTO whitedesk_categories (category_id, enterprise_blind_id, org_id, app_id, name_tr, name_en, icon, sort_order)
VALUES 
    ('voice', 'default', 'default', 'all', 'Ses & Görüşme', 'Audio & Calls', 'Phone', 1),
    ('security', 'default', 'default', 'all', 'Ağ & Güvenlik', 'Network & Security', 'Shield', 2),
    ('account', 'default', 'default', 'all', 'Hesap & whiteID', 'Account & whiteID', 'User', 3),
    ('general', 'default', 'default', 'all', 'Genel Destek', 'General Support', 'HelpCircle', 4)
ON CONFLICT (category_id) DO NOTHING;
