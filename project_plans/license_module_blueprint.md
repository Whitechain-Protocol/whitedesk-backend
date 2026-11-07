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
-- 2. KURULUŞ / TENANT LİSANS DURUM TABLOSU (whitedesk_tenant_licenses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS whitedesk_tenant_licenses (
    enterprise_blind_id VARCHAR(128) PRIMARY KEY, -- Kuruluş kör kimliği (Tenant ID)
    plan_id VARCHAR(32) NOT NULL REFERENCES whitedesk_license_plans(id),
    billing_cycle VARCHAR(16) NOT NULL DEFAULT 'annual', -- 'monthly' | 'annual'
    status VARCHAR(32) NOT NULL DEFAULT 'active',        -- 'trialing' | 'active' | 'expired'
    trial_start_at TIMESTAMPTZ,
    trial_end_at TIMESTAMPTZ,
    subscription_start_at TIMESTAMPTZ,
    subscription_end_at TIMESTAMPTZ,
    license_hash TEXT,                                  -- Opsiyonel E2EE lisans anahtarı
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hızlı sorgular için indeksler
CREATE INDEX IF NOT EXISTS idx_tenant_licenses_plan ON whitedesk_tenant_licenses(plan_id);
CREATE INDEX IF NOT EXISTS idx_tenant_licenses_status ON whitedesk_tenant_licenses(status);

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
3. **Upsert Lisans Güncelleme:**
```sql
INSERT INTO whitedesk_tenant_licenses (
    enterprise_blind_id, plan_id, billing_cycle, status, subscription_start_at, subscription_end_at, updated_at
) VALUES (
    $1, $2, $3, 'active', NOW(), NOW() + INTERVAL '1 year', NOW()
)
ON CONFLICT (enterprise_blind_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    billing_cycle = EXCLUDED.billing_cycle,
    status = 'active',
    subscription_start_at = EXCLUDED.subscription_start_at,
    subscription_end_at = EXCLUDED.subscription_end_at,
    updated_at = NOW();
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

1. VERİTABANI (PostgreSQL / Neon):
   - `whitedesk_license_plans`: id (trial, core, live), name, tier_level (0, 1, 2), monthly_price, annual_monthly_price, features (JSONB).
   - `whitedesk_tenant_licenses`: enterprise_blind_id (PK), plan_id (FK), billing_cycle ('monthly'|'annual'), status ('trialing'|'active'), trial_end_at, subscription_end_at, updated_at.
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
