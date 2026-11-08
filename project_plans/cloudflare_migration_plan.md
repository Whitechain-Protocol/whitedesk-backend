# WhiteDesk — %100 Cloudflare D1 Tam Konsolidasyon ve Neon PostgreSQL Tasfiye Planı

Bu doküman, WhiteDesk mimarisinde halihazırda **Neon PostgreSQL** üzerinde tutulan tüm kalıcı/egemen (statik) tabloların **Cloudflare D1 (SQLite Edge)** veritabanına (`whitedesk_d1_relay` — ID: `3604a42f-2803-4c40-9cde-aad220a20b50`) taşınması, istemci/CLI ve Worker sorgu katmanlarının D1'e bağlanması ve **Neon PostgreSQL projesinin tamamen silinmesi** için hazırlanmış uçtan uca teknik uygulama planıdır.

---

## 🎯 1. Mimari Hedef ve Kazanımlar

| Kriter | Mevcut Durum (Hibrit: Neon + D1) | Hedef Mimari (%100 Cloudflare D1 + R2) |
| :--- | :--- | :--- |
| **Veritabanı Motoru** | Neon PostgreSQL (13 Tablo + 1 View) + Cloudflare D1 (4 Tablo) | **Tekil Cloudflare D1** (16 Tablo + 1 View, SQLite Edge — `admin_roster` kaldırılıp `whitedesk_admins` ile birleştirildi) |
| **Bağlantı & Gecikme** | Mobil/CLI -> Neon HTTP Proxy + Worker -> `@neondatabase/serverless` (Cold-start riski) | **Sıfır Cold-Start**, doğrudan Worker `env.DB` yerel (binding) erişimi |
| **Veri Gizliliği & Sınır** | İstemcide `EXPO_PUBLIC_NEON_ENDPOINT` ve Connection String barındırma | İstemcide **sıfır veritabanı kimlik bilgisi**; tüm sorgular sadece `https://api.whitedesk.one` Worker kapısından geçer |
| **Kurumsal Edge Domain** | `whitedesk-auth-relay.cemalettin-eryilmaz.workers.dev` | **`https://api.whitedesk.one`** (`wss://api.whitedesk.one`) — Özel Cloudflare Edge Alan Adı |
| **Maliyet & Bakım** | İki ayrı bulut platformu (Neon + Cloudflare), iki ayrı şema yönetimi | **Tek platform (Cloudflare)**, sıfır harici veritabanı bağımlılığı |

---

## 📊 2. Taşınacak Tabloların Tam Envanteri ve `admin_roster` Konsolidasyonu

Eski hibrit mimaride `whitedesk_admins` Neon üzerinde, canlı yük dengeleme tablosu `admin_roster` ise D1 üzerinde tutulduğu için iki ayrı tablo bulunuyordu. **Tüm tablolar D1'de birleştiği için `admin_roster` tablosu tamamen kaldırılarak (`DROP TABLE IF EXISTS admin_roster`) kolonları doğrudan `whitedesk_admins` tablosuna entegre edilecektir.**

Böylece D1 üzerinde **3 geçici (buharlaşan) tablo** (`transient_messages`, `ephemeral_signals`, `transient_rtc_signals`) ile **13 kalıcı egemen tablo ve 1 görünüm (View)** yer alacaktır:

| # | Tablo / View Adı | Görevi ve İçeriği | PostgreSQL -> D1 (SQLite) & Konsolidasyon Notu |
| :--- | :--- | :--- | :--- |
| **1** | `whitedesk_enterprises` | Kurum (Tenant) kimlikleri, lisans paketleri, `advanced_features_config` JSON | `SERIAL` -> `INTEGER PRIMARY KEY AUTOINCREMENT`, `JSONB` -> `TEXT`, `TIMESTAMPTZ` -> `TEXT DEFAULT (datetime('now'))` |
| **2** | `whitedesk_license_plans` | `trial`, `core`, `live` paket tanımları, fiyatlar ve özellik JSON'ları | `NUMERIC(10,2)` -> `REAL`, `BOOLEAN` -> `INTEGER DEFAULT 1`, `JSONB` -> `TEXT` |
| **3** | `whitedesk_apps` | Kurum içi uygulama kayıtları (`app_id`, `enterprise_blind_id`, `name`) | `SERIAL` -> `INTEGER PRIMARY KEY AUTOINCREMENT`, `BOOLEAN` -> `INTEGER` |
| **4** | `whitedesk_orgs` | Departman / Birim tanımları (`org_id`, `enterprise_blind_id`, `name`, `public_key`) | `UNIQUE (enterprise_blind_id, org_id)` korunur |
| **5** | `whitedesk_categories` | Bilet kategorileri (`category_id`, `org_id`, `app_id`, `categories` JSON) | `JSONB` -> `TEXT DEFAULT '[]'`, `UNIQUE(enterprise_blind_id, org_id, app_id)` korunur |
| **6** | **`whitedesk_admins`** *(Birleşik)* | Temsilci/Yönetici kimliği + **Adil Bilet Dağıtımı (Load-Balancing) & Mesai Sayacı** | `admin_roster` silinir; `open_tickets INTEGER DEFAULT 0`, `counter INTEGER DEFAULT 0`, `snooze_until INTEGER DEFAULT 0`, `date_time INTEGER DEFAULT 0` kolonları doğrudan `whitedesk_admins` tablosuna eklenir |
| **7** | `whitedesk_approvals` | Çift onay (Dual-Approval) bekleyen yetki ve silme işlemleri | `SERIAL` -> `INTEGER PRIMARY KEY AUTOINCREMENT`, `payload JSONB` -> `TEXT` |
| **8** | `whitedesk_user_bindings` | Son kullanıcıların kurum, birim (`org_id`) ve uygulama (`app_id`) bağları | `UNIQUE (user_blind_id, enterprise_blind_id, org_id, app_id)` korunur |
| **9** | `whitedesk_user_devices` | FCM Push bildirim token'ları (`white_id`, `blind_id`, `fcm_token`, `push_token`, `platform`) | Worker `/api/push` tarafından doğrudan `env.DB` ile okunup yazılacak |
| **10** | `whitedesk_recovery_hashes` | Kurucu, Global Admin, Temsilci ve Kullanıcı kurtarma/provizyon hash'leri | `claimed_by_blind_id`, `is_active INTEGER DEFAULT 1` |
| **11** | `whitedesk_app_requests` | Yeni uygulama/organizasyon talepleri | `SERIAL` -> `INTEGER PRIMARY KEY AUTOINCREMENT` |
| **12** | `whitedesk_ticket_ratings` | Temsilci memnuniyet puanları (`1-5` yıldız) | `CHECK (rating >= 1 AND rating <= 5)` SQLite'ta birebir desteklenir |
| **13** | `whitedesk_system_config` | Küresel sistem yapılandırma anahtar-değer tablosu | `config_value TEXT`, `updated_at TEXT` |

---

## 🛠️ 3. Aşamalı Uygulama Planı (5 Faz)

### Faz 1: Birleşik D1 Şemasının Oluşturulması (`whitedesk_schema.sql` & `cloudflare-worker/schema.sql`)
1. `c:\whitedesk\whitedesk_schema.sql` ve `c:\whitedesk\cloudflare-worker\schema.sql` dosyaları **%100 Cloudflare D1 (SQLite)** sözdizimine dönüştürülecek.
2. Tüm tablolarda PostgreSQL'e özgü veri tipleri kaldırılacak:
   - `SERIAL PRIMARY KEY` $\rightarrow$ `INTEGER PRIMARY KEY AUTOINCREMENT`
   - `JSONB` / `VARCHAR(...)` $\rightarrow$ `TEXT`
   - `TIMESTAMPTZ DEFAULT NOW()` $\rightarrow$ `TEXT DEFAULT (datetime('now'))`
   - `BOOLEAN DEFAULT TRUE` / `FALSE` $\rightarrow$ `INTEGER DEFAULT 1` / `0`
3. `cloudflare-worker/src/index.ts` içindeki `ensureD1Schema(db: D1Database)` fonksiyonu güncellenerek hem geçici (buharlaşan) tabloların hem de kalıcı egemen tabloların (`whitedesk_enterprises`, `whitedesk_admins`, `whitedesk_orgs`, `whitedesk_user_devices`, `whitedesk_recovery_hashes` vb.) otomatik öz-iyileştirme (self-healing) ile varlığı garanti altına alınacak.

---

### Faz 2: Cloudflare Worker (`cloudflare-worker/src/index.ts`) D1 Dönüşümü, `/api/d1/query` Köprüsü ve `api.whitedesk.one` Alan Adı
1. **`api.whitedesk.one` Özel Alan Adının (Custom Domain) Bağlanması:**
   - `cloudflare-worker/wrangler.jsonc` dosyasına `"routes": [{ "pattern": "api.whitedesk.one", "custom_domain": true }]` tanımı eklenecek. Böylece Cloudflare üzerindeki `whitedesk.one` bölgesi (Zone) üzerinden `https://api.whitedesk.one` ve `wss://api.whitedesk.one` doğrudan Worker'a yönlenecek (mevcut HTTP 522 hatası kalkıp Edge Worker yanıt verecek).
2. **Neon Bağımlılığının Sökülmesi:**
   - `cloudflare-worker/src/index.ts` içerisindeki `import { neon } from '@neondatabase/serverless'`, `getNeon(env)` fonksiyonu ve `DATABASE_URL` ortam değişkeni tamamen kaldırılacak.
   - `cloudflare-worker/package.json` dosyasından `@neondatabase/serverless` paketi silinecek.
3. **Mevcut Worker Uçlarının `env.DB`'ye Çevrilmesi:**
   - **`POST /api/claim`:** `whitedesk_admins` ve `whitedesk_enterprises` sorguları `env.DB.prepare(...).bind(...).first()` yapısına çevrilecek.
   - **`POST /api/push` & `/api/register-push`:** `whitedesk_user_devices` ve `whitedesk_admins` üzerindeki tüm `sql` sorguları (`= ANY(...)` ifadeleri `IN (?, ...)` yer tutucularına dönüştürülerek) doğrudan `env.DB` üzerinden çalıştırılacak.
   - **Adil Dağıtım ve Mesai Uçları (`/api/roster/heartbeat`, `/api/roster/list`, `/api/tickets/allocate`, `/api/tickets/reissue-twin`, `/api/tickets/claim-next-pool`):** Eskiden `admin_roster` tablosuna bakan tüm bu uç noktalar artık doğrudan **`whitedesk_admins`** tablosu (`white_id`, `alias`, `open_tickets`, `counter`, `snooze_until`, `date_time`, `is_active`, `duty_status`) üzerinde çalışacak ve `admin_roster` tablosu şemadan tamamen silinecek (`DROP TABLE IF EXISTS admin_roster`).
4. **Birleşik D1 Sorgu Geçidi (`POST /api/d1/query`):**
   - Mobil istemcideki [`src/services/helpdesk/db.ts`](file:///c:/whitedesk/src/services/helpdesk/db.ts) ve yönetim aracındaki [`scripts/wd.js`](file:///c:/whitedesk/scripts/wd.js) içindeki `executeSql(query)` çağrılarının **100+ servis noktasında mimariyi kırmadan** çalışmaya devam etmesi için Worker üzerinde güvenli `/api/d1/query` uç noktası açılacak.
   - Bu uç nokta gelen SQL sorgularında çalışma zamanı (runtime) **PostgreSQL $\rightarrow$ SQLite lehçe adaptörünü (Dialect Normalizer)** çalıştıracak:
     - `::jsonb` ve `::text` tip dönüşümlerini otomatik temizleyecek,
     - `NOW()` ifadelerini `datetime('now')` ile eşleştirecek,
     - `ILIKE` operatörlerini `LIKE` olarak normalize edecek,
     - SQLite'ın `INTEGER` olarak döndürdüğü boolean sütunları (`is_active`, `is_verified`, `is_custom_alias` vb.) istemci kodunun (`=== true` / `=== false`) beklediği `boolean` (`true`/`false`) tipine otomatik map'leyecek.

---

### Faz 3: İstemci (`db.ts`), Servisler, CLI (`wd.js`) ve `https://api.whitedesk.one` Entegrasyonu
1. **Tüm Uç Noktaların `https://api.whitedesk.one` Adresine Geçirilmesi:**
   - [`.env.local`](file:///c:/whitedesk/.env.local), [`src/services/apiClient.ts`](file:///c:/whitedesk/src/services/apiClient.ts), [`src/services/relayClient.ts`](file:///c:/whitedesk/src/services/relayClient.ts), [`src/services/pushClient.ts`](file:///c:/whitedesk/src/services/pushClient.ts), [`src/services/ephemeralAuthService.ts`](file:///c:/whitedesk/src/services/ephemeralAuthService.ts), [`src/services/helpdesk/db.ts`](file:///c:/whitedesk/src/services/helpdesk/db.ts) ve [`scripts/wd.js`](file:///c:/whitedesk/scripts/wd.js) dosyalarında `whitedesk-auth-relay.cemalettin-eryilmaz.workers.dev` yerine varsayılan ana adres olarak **`https://api.whitedesk.one`** tanımlanacak.
2. **[`src/services/helpdesk/db.ts`](file:///c:/whitedesk/src/services/helpdesk/db.ts):**
   - `WHITEDESK_NEON_ENDPOINT` ve `WHITEDESK_NEON_CONN_STR` tamamen kaldırılacak.
   - `executeSql(query)` fonksiyonu doğrudan `https://api.whitedesk.one/api/d1/query` adresine istek atacak.
   - `checkDbHealth()` fonksiyonu doğrudan Cloudflare D1 sağlık kontrolü yapacak.
2. **Servis Sorgu Uyumluluk Kontrolleri:**
   - [`src/services/helpdesk/helpDeskStationService.ts`](file:///c:/whitedesk/src/services/helpdesk/helpDeskStationService.ts) (42 sorgu)
   - [`src/services/helpdesk/helpDeskAuthService.ts`](file:///c:/whitedesk/src/services/helpdesk/helpDeskAuthService.ts) (27 sorgu)
   - [`src/services/helpdesk/helpDeskLicenseService.ts`](file:///c:/whitedesk/src/services/helpdesk/helpDeskLicenseService.ts) (8 sorgu)
   - [`src/services/helpdesk/helpDeskTicketService.ts`](file:///c:/whitedesk/src/services/helpdesk/helpDeskTicketService.ts) (3 sorgu)
   - [`src/whitedesk-sdk/core/StationService.ts`](file:///c:/whitedesk/src/whitedesk-sdk/core/StationService.ts) & [`AuthService.ts`](file:///c:/whitedesk/src/whitedesk-sdk/core/AuthService.ts)
   - Yukarıdaki dosyalardaki `::jsonb`, `NOW()`, `ILIKE`, `SERIAL` ifadeleri temizlenip doğrudan D1/SQLite uyumlu hale getirilecek.
3. **[`scripts/wd.js`](file:///c:/whitedesk/scripts/wd.js) (WhiteDesk CLI):**
   - `NEON_ENDPOINT` ve `CONN_STR` kaldırılarak CLI aracının da tüm provizyon, sıfırlama (`reset`) ve durum (`status`) komutlarını doğrudan Cloudflare Worker D1 üzerinden çalıştırması sağlanacak.

---

### Faz 4: Mevcut Verilerin Aktarımı / Genesis Seed ve Uzak D1 Kurulumu
1. `cloudflare-worker` dizininde `npx wrangler d1 execute whitedesk_d1_relay --remote --file=schema.sql` komutu ile 17 tablo + 1 view uzak Cloudflare D1 veritabanına işlenecek.
2. Mevcut Neon veritabanındaki aktif kurum (`whitedesk_enterprises`), birim (`whitedesk_orgs`), kategori (`whitedesk_categories`), yönetici/temsilci (`whitedesk_admins`), kurtarma hash'leri (`whitedesk_recovery_hashes`) ve cihaz token'ları (`whitedesk_user_devices`) tek seferlik aktarım betiği ile okunup **hiçbir provizyon veya oturum kaybı yaşanmadan** D1'e aktarılacak.
3. Güncellenen Worker (`npx wrangler deploy`) buluta yayınlanacak.

---

### Faz 5: Ortam Değişkenlerinin Temizlenmesi ve Neon Projesinin Silinmesi
1. `.env.local` ve proje yapılandırmalarından `EXPO_PUBLIC_NEON_ENDPOINT` ile `EXPO_PUBLIC_NEON_CONNECTION_STRING` tamamen kaldırılacak.
2. Cloudflare Worker Secret'larından `DATABASE_URL` (`npx wrangler secret delete DATABASE_URL`) silinecek.
3. Hem S24+ hem de Tablet üzerinde provizyon, bilet oluşturma, birim/temsilci listeleme ve push bildirim akışları uçtan uca D1 üzerinde doğrulandıktan sonra **Neon konsolundan proje tamamen silinecek**.
