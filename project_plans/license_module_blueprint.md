# 📦 Kurumsal Lisans & Abonelik Modülü Blueprint (Neon PostgreSQL + İki Aşamalı UI)

Bu döküman, **WhiteDesk** için geliştirdiğimiz; **Neon PostgreSQL** veritabanı şeması, otomatik deneme süresi (14-günlük trial) mekanizması, çoklu plan hiyerarşisi (`CORE` / `LIVE`) ve iki aşamalı sade kullanıcı arayüzünü (Screen 1 & Screen 2) içeren **anahtar teslim üretim mimarisidir**. Başka projelerde doğrudan referans veya prompt olarak kullanılabilir.

---

## 🗄️ 1. NEON POSTGRESQL VERİTABANI ŞEMASI (DDL & SEED)

```sql
-- ============================================================================
-- 1. PLAN TANIMLARI TABLOSU (whitedesk_license_plans)
-- ============================================================================
CREATE TABLE IF NOT EXISTS whitedesk_license_plans (
    id VARCHAR(32) PRIMARY KEY,                  -- 'trial', 'core', 'live'
    name VARCHAR(64) NOT NULL,                   -- '14 Günlük Deneme', 'CORE Paketi', 'LIVE Paketi'
    tier_level INT NOT NULL DEFAULT 0,          -- 0: Trial, 1: Core, 2: Live
    monthly_price NUMERIC(10, 2) NOT NULL,       -- Aylık döngüde ay başı fiyat ($)
    annual_monthly_price NUMERIC(10, 2) NOT NULL,-- Yıllık döngüde ay başı indirimli fiyat ($)
    has_remote_desktop BOOLEAN DEFAULT FALSE,   -- LIVE paketi özel yeteneği
    has_audit_logs BOOLEAN DEFAULT FALSE,       -- LIVE paketi özel yeteneği
    features JSONB NOT NULL DEFAULT '[]'::jsonb, -- Net liste maddeleri
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. KURULUŞ & LİSANS DURUM TABLOSU (whitedesk_enterprises - Birleşik)
-- ============================================================================
CREATE TABLE IF NOT EXISTS whitedesk_enterprises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    enterprise_blind_id TEXT UNIQUE NOT NULL,            -- Kuruluş kör kimliği (Tenant ID)
    name TEXT NOT NULL,
    plan_id TEXT NOT NULL DEFAULT 'trial',               -- 'trial' | 'core' | 'live'
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',       -- 'monthly' | 'annual'
    license_status TEXT NOT NULL DEFAULT 'trialing',     -- 'trialing' | 'active' | 'grace_period' | 'expired'
    trial_start_at TEXT,
    trial_end_at TEXT,
    subscription_start_at TEXT,
    subscription_end_at TEXT,
    grace_period_days INTEGER DEFAULT 3,                 -- Trial: 3, Monthly: 5, Annual: 15
    warning_intervals INTEGER DEFAULT 12,                -- Trial: 12h, Monthly: 24h, Annual: 48h
    grace_ends_at TEXT,
    license_hash TEXT,                                   -- Opsiyonel E2EE lisans anahtarı
    created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

-- Hızlı sorgular için indeksler
CREATE INDEX IF NOT EXISTS idx_enterprises_plan ON whitedesk_enterprises(plan_id);
CREATE INDEX IF NOT EXISTS idx_enterprises_status ON whitedesk_enterprises(license_status);

-- ============================================================================
-- 3. BAŞLANGIÇ PLANLARI (SEED DATA)
-- ============================================================================
INSERT INTO whitedesk_license_plans (id, name, tier_level, monthly_price, annual_monthly_price, has_remote_desktop, has_audit_logs, features)
VALUES 
(
    'trial', 
    '14 Günlük Deneme Sürümü', 
    0, 
    0.00, 
    0.00, 
    true, 
    true,
    '["Tüm CORE ve LIVE özelliklerini 14 gün sınırsız deneyin", "Masaüstü ve mobil istemciler aktif"]'::jsonb
),
(
    'core', 
    'CORE Paketi', 
    1, 
    49.00, 
    39.00, 
    false, 
    false,
    '[
      "Sınırsız operatör ve istemci cihaz",
      "WhiteDesk Masaüstü (Windows / macOS) istemcisi",
      "Uçtan uca şifreli (E2EE) biletleme akışı",
      "Kategori ve organizasyon yönetimi",
      "Dosya ve ekran görüntüsü ekleri"
    ]'::jsonb
),
(
    'live', 
    'LIVE Paketi', 
    2, 
    129.00, 
    99.00, 
    true, 
    true,
    '[
      "Tüm CORE özellikleri dahil",
      "WhiteDesk Masaüstü (Windows / macOS) istemcisi",
      "Uzak masaüstü canlı ekran ve müdahale",
      "Canlı sesli görüşme ve telsiz (PTT)",
      "Sınırsız operatör ve istemci cihaz",
      "Gelişmiş denetim kayıtları ve raporlar"
    ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    monthly_price = EXCLUDED.monthly_price,
    annual_monthly_price = EXCLUDED.annual_monthly_price,
    features = EXCLUDED.features;
```

---

## ⚡ 2. İŞ MANTIĞI & SERVİS KATMANI (STATE MACHINE)

1. **Lazy Trial Oluşturma:** Kuruluş ilk kez sorgulandığında lisans tablosunda kaydı yoksa, arka planda anında 14 günlük `trialing` kaydı oluşturulur (`ON CONFLICT DO NOTHING`).
2. **Kısıtlamasız Masaüstü İstemcisi:** Masaüstü istemcisi yetkisi yıllık abonelik şartına bağlı değildir; aktif deneme süresi olanlar, `CORE` ve `LIVE` sahipleri anında masaüstü oturumu açabilir.
3. **Upsert Lisans Güncelleme (`whitedesk_enterprises`):**
```sql
INSERT INTO whitedesk_enterprises (
    enterprise_blind_id, name, plan_id, billing_cycle, license_status, subscription_start_at, subscription_end_at, grace_period_days, warning_intervals, grace_ends_at
) VALUES (
    ?1, ?2, ?3, ?4, 'active', datetime('now'), datetime('now', '+1 year'), 15, 48, datetime('now', '+380 days')
)
ON CONFLICT (enterprise_blind_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    billing_cycle = EXCLUDED.billing_cycle,
    license_status = 'active',
    subscription_start_at = EXCLUDED.subscription_start_at,
    subscription_end_at = EXCLUDED.subscription_end_at,
    grace_period_days = EXCLUDED.grace_period_days,
    warning_intervals = EXCLUDED.warning_intervals,
    grace_ends_at = EXCLUDED.grace_ends_at;
```

---

## 🖥️ 3. İKİ AŞAMALI UI/UX MODAL MİMARİSİ

Kullanıcı arayüzünde "kutu kutu karmaşa" yerine iki safhalı Google Minimalizmi uygulanır:

* **1. Ekran (`viewMode === 'current'`):**
  * **Üst Başlık:** Lisans & Abonelik (Kapatma butonu `✕`).
  * **Plan Özeti:** `Kullanımdaki Plan: [CORE Paketi / LIVE Paketi] [Aktif]` ve `[Aylık / Yıllık Döngü • Masaüstü & Mobil İstemci Aktif]`. (Ayrı bir kutu/çerçeve içine hapsedilmez).
  * **Lisans Detayları:** Sadece o anki aktif planın net maddeleri (`✓` işaretli temiz liste).
  * **Alt Aksiyon:** Geniş ve net **`Lisans Yönetimi`** butonu. (Basınca 2. ekrana geçer).

* **2. Ekran (`viewMode === 'manage'`):**
  * **Üst Başlık:** Geri butonu (`←`), "Lisans Yönetimi" başlığı ve `✕`.
  * **Döngü Seçici:** `Aylık` vs `Yıllık (%20 İndirimli)`.
  * **Yalnızca Seçilebilir Alternatifler:** Mevcut plan listeden **filtrelenerek gizlenir** (`allPlans.filter(p => p.id !== activeLicense.planId)`). Böylece gereksiz tekrar ve pasif butonlar ortadan kalkar.
  * **Aksiyon Butonu:** **`Lisans Seviyesini Değiştir`**.
  * **Otomatik Dönüş:** Kullanıcı butona bastığında lisans güncellenir ve arayüz otomatik olarak **1. Ekrana** döner; ilk ekranda yeni planın adı, detayları ve altında yine `Lisans Yönetimi` butonu karşılar.

---

## 🤖 4. DİĞER PROJELERDE KULLANILACAK MASTER PROMPT (COPY-PASTE)

Aşağıdaki promptu herhangi bir AI ajanına veya yeni projeye verdiğinizde bu sistemi sıfır hata ile üretir:

```markdown
Bize kurumsal bir "Lisans & Abonelik Modülü" geliştir. Sistem aşağıdaki spesifikasyona birebir uymalıdır:

1. VERİTABANI (Cloudflare D1 - SQLite):
   - `whitedesk_license_plans`: id (trial, core, live), name, tier_level (0, 1, 2), monthly_price, annual_monthly_price, grace_period_days, annual_grace_period_days, warning_intervals, annual_warning_intervals, features (JSON).
   - `whitedesk_enterprises`: enterprise_blind_id (UNIQUE), name, plan_id, billing_cycle ('monthly'|'annual'), license_status ('trialing'|'active'|'grace_period'|'expired'), trial_end_at, subscription_end_at, grace_period_days, warning_intervals, grace_ends_at.
   - İlk sorguda tenant kaydı yoksa 14 günlük trial kaydı otomatik oluşturulmalıdır.

2. LİSANS POLİTİKASI:
   - Masaüstü istemci kullanımı herhangi bir yıllık lisans şartına bağlı değildir; CORE ve LIVE seviyelerinin her ikisinde de masaüstü kullanımı tam aktiftir.

3. KULLANICI ARAYÜZÜ (İki Aşamalı Temiz Akış):
   Modal açıldığında ekranda tüm paketler aynı anda gösterilerek kutu kalabalığı yaratılmamalıdır.
   - 1. Ekran (Varsayılan): Sadece "Kullanımdaki Plan: [Plan Adı] [Aktif]", döngü bilgisi, o plana ait lisans maddelerinin temiz "✓" listesi ve sayfa altında "Lisans Yönetimi" butonu olmalıdır.
   - 2. Ekran (Lisans Yönetimi): "Lisans Yönetimi" butonuna basılınca açılır. Üstte geri oku (←), Aylık / Yıllık döngü seçicisi ve YALNIZCA geçiş yapılabilecek DİĞER alternatif plan kartı yer almalıdır (Mevcut plan 2. ekranda tekrar gösterilmemelidir).
   - Kartın altındaki buton: "Lisans Seviyesini Değiştir".
   - Butona basılıp paket güncellendiğinde sistem otomatik olarak 1. Ekrana geri dönmeli ve yeni seçilen planın detaylarını listelemelidir.
```
