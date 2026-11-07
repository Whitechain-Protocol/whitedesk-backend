# WHITEDESK STANDALONE & SDK - AI AGENT BAŞLATMA VE TAMAMLAMA PROMPTU

> Bu döküman, **WhiteDesk** projesini başka bir çalışma dizininde / reposunda hem **bağımsız (standalone) bir mobil uygulama** hem de üçüncü parti kurumsal sistemlere tak-çalıştır entegre edilebilen **bağımsız WhiteDesk SDK** olarak ayağa kaldıracak herhangi bir AI Kodlama Asistanına (Agent) veya kıdemli geliştiriciye doğrudan iletilmek üzere hazırlanmıştır.

---

```markdown
# GÖREV: SIFIR-BİLGİ (ZERO-KNOWLEDGE) BAĞIMSIZ "WHITEDESK" UYGULAMASI VE SDK PROJESİ KURULUMU

Sen, kurumsal mobil mimari, sıfır-bilgi (zero-knowledge) kriptografi ve React Native / Expo alanında 15+ yıl deneyimli kıdemli bir yazılım mimarısın.

Bu projenin nihai amacı:
1. Merkezi inWhite ekosisteminde geliştirilmiş ve son halini almış olan **WhiteDesk** sistemini; hiçbir özellik eksiltmesi veya sahte taklit (mock) veri olmadan, **bağımsız (standalone) bir mobil uygulama** olarak ayağa kaldırmak.
2. Sistemin çekirdeğini (`src/whitedesk-sdk/`) diğer tüm kurumsal uygulamalara bağımsız npm paketi veya modül olarak entegre edilebilecek **tam yetenekli bir WhiteDesk SDK** olarak paketlemek.
3. Projeyi eksiksiz derleyip, TypeScript 0 hata ile GitHub'a taşımaya hazır hale getirmektir.

---

## 🛑 KESİN TASARIM, KODLAMA VE MİMARİ KURALLARI (MANDATES)

### 1. Arayüz Dokunulmazlığı (Piksel Birebirlik & Swiss Minimalist Dil)
* inWhite içerisindeki `HelpDeskScreen.tsx` ekranının görsel tasarımı, eleman yerleşimi, CSS değerleri ve One UI tarzı akışı **birebir korunacaktır**.
* Kafana göre margin, padding, yazı tipi boyutu veya buton yapısı DEĞİŞTİRİLEMEZ.
* Sayfa zemini açık gri-mavi tuval (`#F4F7FA`), beyaz kart konteynerleri (`#FFFFFF`), ayırıcı çizgiler (`#F1F5F9` / `#E2E8F0`) olarak kalacaktır.
* Durum çubuğu altında doğal olarak kayan minimalist `inWhite` logosu ve doğrudan zemin üzerine çizilen geri butonu (`ChevronLeft`) yapısı aynen korunacaktır.

### 2. Renk Paleti (Opsiyon 3 - Canlı Açık Mavi `#3B82F6` Standardı)
Sistemde kullanılan ağır ve koyu lacivert tonları yerine onaylanmış olan **Canlı & Ferah Açık Mavi (`#3B82F6`)** dili uygulanacaktır:
* **Ana Aksiyon Butonları:** "Yeni Tartışma Başlat" (Admin), "Yeni Destek Bileti" (Kullanıcı), "Talep Gönder", "Onayla", "Ekle" butonları `backgroundColor: '#3B82F6'` ve `shadowColor: '#3B82F6'` (shadowOpacity: 0.16) kullanacaktır.
* **Filtre ve Kategori Hapları:** Aktif seçim durumundaki tüm hapların arka planı ve kenarlığı `backgroundColor: '#3B82F6'`, `borderColor: '#3B82F6'` olacaktır.
* **Cevap Gönderme Paneli:** Alt yapışkan paneldeki gönder butonu (`replyPanelSendBtnActive`) `#3B82F6` zemin ve gölge ile parlayacaktır.
* **Aktif Vurgular ve Rozetler:** Açık bilet durum hapı (`pillOpenText`), kılavuz adım numaraları, kalkan (ShieldCheck) güvenlik ikonları ve kullanıcının kendi mesajındaki gönderici adı `#3B82F6` renginde olacaktır.

### 3. Standart `Alert.alert` KESİNLİKLE YASAKTIR
* Projede React Native'in standart `Alert.alert` fonksiyonunu kullanmak KESİNLİKLE YASAKTIR.
* Tüm onaylama, silme, yetki verme ve bilgilendirme pencereleri için `/src/components/BottomConfirmationSheet.tsx` bileşeni kullanılacaktır.
* Bu bileşenin tasarımı (ekranın altından açılan floating bar, sola yaslı başlık/açıklama, ayırıcı çizgiyle ayrılmış butonlar) projenin tüm ekranlarında tutarlı uygulanacaktır.

### 4. Mock Veri ve Taklit Servis Yasağı (Anti-Mocking Mandate)
* Sistemde hiçbir şekilde geçici sahte (mock) veri veya yerel dizi taklitleri kullanılmayacaktır.
* Tüm biletler, mesajlar, kategoriler, onaylar ve provizyon atamaları doğrudan canlı Neon PostgreSQL HTTP Gateway üzerinden gerçek SQL sorgularıyla çalıştırılacaktır.

---

## 🌍 ÇOK DİLLİ DESTEK MANDASI (32 DİL KESİN ZORUNLULUK)

Uygulama, HelpDesk için hazırlanmış olan 32 dili eksiksiz olarak destekleyecektir:

1. **32 Dilli Sözlük (`helpdeskLang.json`):**
   * `src/locales/helpdeskLang.json` dosyası 32 dilin tamamını içermektedir:
     `en`, `tr`, `it`, `de`, `fr`, `es`, `pt`, `nl`, `sv`, `no`, `fi`, `pl`, `cs`, `hu`, `ro`, `et`, `lv`, `lt`, `uk`, `ru`, `ar`, `fa`, `he`, `hi`, `ur`, `id`, `ja`, `ko`, `my`, `th`, `vi`, `zh`
   * Her bir dilde bilet açma, arama, filtreler, mesajlaşma, ataşmanlar ve durum bildirimlerini kapsayan **116 adet anahtar (key)** mevcuttur.
2. **Dil Yöneticisi (`i18nService.tsx`):**
   * Uygulama cihazın sistem dilini otomatik algılamalı (`Platform / NativeModules` veya `expo-localization`), sistem dili 32 dilden biriyse doğrudan o dille açılmalı, aksi halde `en` (İngilizce) fallback yapmalıdır.
   * `SUPPORTED_LANGUAGES` listesi üzerinden kullanıcının istediği zaman 32 dil arasında anında geçiş yapabilmesini sağlayan bir modal / menü bulunmalıdır.
3. **RTL (Sağdan Sola) Diller:**
   * 32 dil içerisindeki 4 RTL dil için: **Arapça (`ar`), Farsça (`fa`), İbranice (`he`), Urduca (`ur`)** metin ve arayüz yönü düzgün şekilde işlenmelidir.
4. **Kategoriler:**
   * Dinamik kategoriler Türkçe için `label_tr`, diğer tüm 31 dil için `label_en` üzerinden servis edilir.

---

## 🔐 SIFIR-BİLGİ (ZERO-KNOWLEDGE) VE VERİTABANI ALTYAPISI

### 1. Kör Kimlik (Blind ID) ve Kriptografi
* **Sıfır Kişisel Veri:** E-posta, telefon numarası veya isim toplanmaz ve saklanmaz.
* **Körleme:** Kullanıcıların açık Ed25519 anahtarları (WhiteID) veritabanına asla düz metin yazılmaz; tek yönlü `HMAC-SHA256(WhiteID, SystemSalt)` formülüyle `blind_id` olarak kaydedilir.
* **İtimat Zinciri:** Merkezi şifre yoktur. Yetkilendirmeler `TheWhite` (Genesis Root) veya `global_admin` tarafından Ed25519 dijital imzasıyla (`ed25519_sig`) doğrulanır.

### 2. Neon Serverless PostgreSQL (Port 443 HTTP SQL Gateway)
Mobil cihazların kurumsal güvenlik duvarlarına (firewall/DPI) takılmaması için TCP 5432 yerine **HTTPS Port 443 üzerinden Neon SQL HTTP Gateway (`/sql`)** kullanılır.

* **SQL HTTP Endpoint:**
  `EXPO_PUBLIC_NEON_ENDPOINT` → `.env.local` (gitignored, asla commit edilmez)
* **Connection String:**
  `EXPO_PUBLIC_NEON_CONNECTION_STRING` → `.env.local` (gitignored, asla commit edilmez)

### 3. DDL Şeması ve Tek Komutla Veritabanı Kurulumu (Idempotent: Yoksa Oluştur, Varsa Devam Et)

Aşağıdaki SQL betiği, Neon PostgreSQL SQL Editor veya psql üzerinden **TEK BİR SEFERDE ÇALIŞTIRILDIĞINDA** tüm sistemi sıfırdan kurar.
Tablolar ve tohum verileri IF NOT EXISTS ve ON CONFLICT DO NOTHING kurallarıyla korunduğundan, **veritabanı yoksa oluşturur, varsa mevcut verilere dokunmadan devam eder**:

`sql
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

`

---

## 🎛️ 4. RPG II 3-KADEMELİ PROVİZYON VE HİYERARŞİ KURALLARI

1. **Kademe 0 (Kiracı / Tenant - Kurucuya Özel):** Çoklu kiracı ortamında tüm kiracılar (`all`) veya belirli bir kiracı filtrelenir.
2. **Kademe 1 (Yönetici):** Kör kimlikle yeni yönetici eklenebilir veya bilet listesinde bilete uzun basılarak bilet sahibi anında operatör/yönetici yapılabilir.
3. **Kademe 2 (Uygulama & Kurum):** Yöneticinin yetkilendirileceği uygulama (`all`, `inwhite`, `support` vb.) ve şirket (`default`, `*`, `elektroser` vb.) seçilir.
4. **Kademe 3 (Kategori):** Yöneticinin biletlerini görebileceği departmanlar seçilir.
5. **Silme Hiyerarşisi:**
   - Normal adminler sadece kategori silebilir.
   - Normal admin uygulama (`app`) veya kurum (`org`) silmek istediğinde bu işlem doğrudan silinmez; Global Admin onayına sunulmak üzere `whitedesk_approvals` tablosuna düşer.
   - Global Admin / Kurucu bilet listesinden onay rozetine basarak bu talepleri tek tıkla Onayla / Reddet yapabilir.
   - Kimse kendi yöneticilik yetkisini veya üstündeki bir yöneticinin yetkisini iptal edemez (Hiyerarşi Koruması).

---

## 📦 5. KURULACAK PAKETLER (DEPENDENCIES)

Projenin `package.json` dosyasına eklenecek ve `npx expo install` ile kurulacak paketler:

```bash
npx expo install lucide-react-native expo-image-picker expo-document-picker expo-sharing react-native-safe-area-context @react-navigation/native @react-navigation/native-stack expo-camera
npm install react-native-blob-util
```

---

## 📁 6. HEDEF PROJE DİZİN YAPISI

Proje şu mimari hiyerarşide organize edilecektir:

```
whitedesk/
├── package.json
├── tsconfig.json
├── App.tsx                             <-- SafeArea & Navigation Provider
├── src/
│   ├── components/
│   │   └── BottomConfirmationSheet.tsx <-- Standart onay ve uyarı alt modalı
│   ├── locales/
│   │   ├── helpdeskLang.json           <-- 32 DİLİN TAMAMINI İÇEREN SÖZLÜK (~200KB)
│   │   └── languageNames.ts            <-- Dil kodları ve orijinal isimleri
│   ├── screens/
│   │   ├── RegisterScreen.tsx          <-- İlk Açılış 12-Word Passkey / Kurtarma Ekranı
│   │   ├── HelpDeskScreen.tsx          <-- 1:1 Birebir HelpDesk Ekranı (#3B82F6 açık mavi butonlar)
│   │   └── WhiteDeskScannerScreen.tsx  <-- QR Tarayıcı Ekranı
│   ├── services/
│   │   ├── helpDeskService.ts          <-- SQL Gateway, Blind ID, CRUD, Yetkilendirme
│   │   ├── i18nService.tsx             <-- 32 Dil Yöneticisi & Context
│   │   └── storageService.ts           <-- Donanım destekli anahtar saklama
│   └── whitedesk-sdk/                  <-- BAĞIMSIZ SDK KATMANI
│       ├── index.ts                    <-- SDK Giriş Kapısı
│       ├── core/
│       │   ├── authority.ts            <-- Yetki ve imza mühürleme
│       │   ├── client.ts               <-- WhiteDeskClient (otomatik tescil, bilet gönderme)
│       │   ├── crypto.ts               <-- HMAC-SHA256 blind_id ve Ed25519 motoru
│       │   ├── database.ts             <-- HTTP SQL Gateway sürücüsü
│       │   └── types.ts                <-- TypeScript interface ve tip tanımları
│       └── locales/
│           └── helpdeskLang.json       <-- SDK Gömülü 32 Dil Paketi
```

---

## ⚡ 7. İCRA ADIMLARI

1. Proje dizin yapısını ve bağımlılıklarını kur.
2. `helpdeskLang.json` (32 dil) ve `i18nService.tsx` dosyalarını eksiksiz aktar.
3. `helpDeskService.ts` dosyasını Neon PostgreSQL endpoint ve kimlik motoruyla hazırla.
4. `BottomConfirmationSheet.tsx` bileşenini yerleştir (`Alert.alert` yasağına uy).
5. `HelpDeskScreen.tsx` ekranını `#3B82F6` açık mavi butonlar, filtre hapları ve alt yapışkan cevap paneliyle 1:1 piksel hassasiyetinde kur.
6. `src/whitedesk-sdk/` katmanını bağımsız projelerde `import { WhiteDeskClient } from '@whitedesk/sdk'` şeklinde kullanılabilecek biçimde bağla.
7. `npx tsc --noEmit` çalıştırarak **0 hata** olduğunu doğrula.
8. Canlı Neon veritabanı bağlantısını test ederek bilet akışının ve 32 dil desteğinin çalıştığını raporla.
```
