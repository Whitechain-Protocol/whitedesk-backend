# WhiteDesk i18n (60 Dil) Ölü ve Kullanılmayan Metinleri Temizleme Planı

## 1. Yönetici Özeti ve Kapsam
`c:\whitedesk` kod tabanının tamamı (`App.tsx`, `src/`, `backend/`, `cloudflare-worker/`, `scripts/`, `wdrun.html`) statik dize araması, dinamik şablon (`template literal`) analizi ve `i18nService.tsx` kısa anahtar (`helpdesk.*`) çözümleme kurallarıyla taranarak **60 dil dosyasındaki (`src/locales/*.json`) 2.442 anahtarın** kullanım durumu tek tek denetlenmiştir.

* **Mevcut Durum:** Her dil dosyasında **2.442 anahtar** (`60 × 2.442 = 146.520` toplam dize).
* **Tespit Edilen Ölü / Kullanılmayan Anahtar:** **907 anahtar** (`60 × 907 = 54.420` toplam dize — **%37,1 oranında ölü yük**).
* **Temizlik Sonrası Kalacak Saf WhiteDesk Anahtarı:** **1.535 aktif anahtar** (`60 × 1.535 = 92.100` toplam dize).

---

## 2. Silinecek Metinlerin 4 Kategorili Dökümü (Toplam 907 Anahtar)

### Kategori 1: `inWhite` Projesinden Kalan ve WhiteDesk'te Sıfır (`0`) Referansı Olan 15 Tam Bölüm (551 Anahtar)
Bu 15 kök bölüm WhiteDesk uygulamasında hiçbir bileşen veya serviste kullanılmamaktadır:

| # | Kök Bölüm (`Section`) | Anahtar Sayısı | İçerik Özeti (`inWhite` Mirası) | WhiteDesk Kullanımı |
| :--- | :--- | :---: | :--- | :---: |
| 1 | `mailbox` | 122 | E-posta / mesaj kutusu metinleri | `0` |
| 2 | `info` | 95 | `inWhite` manifesto, SSS ve rehber metinleri | `0` |
| 3 | `tunnel` | 78 | Gizli tünel, DPI bypass ve CBR ses paketleme metinleri | `0` |
| 4 | `chats` | 61 | Birebir sohbet, dosya paylaşımı ve mesaj balonları | `0` |
| 5 | `calls` | 24 | `inWhite` arama geçmişi ve çağrı listesi | `0` |
| 6 | `addContact` | 20 | Kişi ekleme ekranı (`Alice Cooper` vb.) | `0` |
| 7 | `search` | 24 | Sohbet/kişi arama ekranı | `0` |
| 8 | `register` | 24 | `inWhite` ilk kayıt ekranı | `0` |
| 9 | `callScreen` | 24 | Eski `inWhite` arama ekranı | `0` |
| 10 | `audioFeatures` | 18 | Ses efektleri ve kodek ayarları | `0` |
| 11 | `portManagement` | 17 | Port yönetimi ekranı | `0` |
| 12 | `contacts` | 16 | Kişi rehberi ekranı | `0` |
| 13 | `help` | 16 | Eski `inWhite` yardım ekranı | `0` |
| 14 | `notifications` | 8 | Eski bildirim ayarları | `0` |
| 15 | `tabs` | 4 | `inWhite` alt sekme başlıkları (`Chats`, `Calls`, `Contacts`) | `0` |
| **Toplam** | **15 Bölüm** | **551 Anahtar** | **`60 × 551 = 33.060` dize tamamen silinecek** | **`0`** |

---

### Kategori 2: Aktif Bölümlerin İçinde Unutulmuş `inWhite` / Eski Sürüm Alt Anahtarları (201 Anahtar)
Kök bölümü WhiteDesk'te kullanıldığı halde, içindeki bazı alt anahtarların `inWhite` döneminden veya eski `camelCase` şemadan kaldığı ve kodda hiç çağrılmadığı tespit edilmiştir:

| # | Bölüm | Toplam Anahtar | Korunacak (Aktif) | Silinecek (Ölü) | Silinecek Örnek Anahtarlar |
| :--- | :--- | :---: | :---: | :---: | :--- |
| 1 | `common` | 89 | 31 *(12 `common.months.*` dinamik dahil)* | **58** | `common.searchSecurePeers`, `common.searchContacts`, `common.selectedCount`, `common.edit` |
| 2 | `helpdesk` | 589 | 523 *(5 `helpdesk.cat_*` dinamik dahil)* | **66** | `helpdesk.subtitleAdmin`, `helpdesk.newTicket`, `helpdesk.createNewTicket`, `helpdesk.youAdmin`, `helpdesk.registration_info_delimiter` |
| 3 | `license` | 144 | 110 | **34** | `license.currentStatus`, `license.trialActive`, `license.daysRemaining`, `license.plansTitle` |
| 4 | `profile` | 46 | 24 *(`profile.modal.*`)* | **22** | `profile.whiteId`, `profile.secureQrKey`, `profile.wipeData`, `profile.showBanner`, `profile.playSound` |
| 5 | `menu` | 14 | 1 *(`menu.settings`)* | **13** | `menu.addContact`, `menu.tunnelSettings`, `menu.manifesto`, `menu.wipeLocalId` |
| 6 | `scanner` | 43 | 35 *(yeni `snake_case`)* | **8** | `scanner.permissionTitle`, `scanner.hudTitle`, `scanner.manualEntry`, `scanner.invalidQrTitle` |
| **Toplam** | **6 Bölüm** | **925** | **724** | **201 Anahtar** | **`60 × 201 = 12.060` dize silinecek** |

---

### Kategori 3: Kök Dizinde Çiftlenmiş (Duplicate Mirror) Anahtarlar (67 Anahtar)
Hem kök seviyede (`diagnostics.*`, `remote_desktop.*`) hem de `helpdesk.diagnostics.*` ve `helpdesk.remote_desktop.*` altında birebir aynı metinlerle iki kez yer alan, ancak kodda **yalnızca `helpdesk.diagnostics.*` ve `helpdesk.remote_desktop.*`** üzerinden çağrılan kopya anahtarlar:

* `diagnostics.*`: `88` anahtardan `42`'si doğrudan `diagnostics.*` olarak kullanılıyor; kalan **`45` kopya anahtar** (`diagnostics.badge_navigation`, `diagnostics.badge_sdk`, `diagnostics.file_picker_desc` vb. — kodda `helpdesk.diagnostics.*` olarak çağrılıyor) + **`1` ölü anahtar** (`diagnostics.status_active_foreground`) = **46 anahtar silinecek**.
* `remote_desktop.*`: `25` anahtardan `4`'ü doğrudan `remote_desktop.*` olarak kullanılıyor; kalan **`21` kopya anahtar** (`remote_desktop.connected`, `remote_desktop.request_title` vb. — kodda `helpdesk.remote_desktop.*` olarak çağrılıyor) = **21 anahtar silinecek**.

---

### Kategori 4: WhiteDesk İçinde Tasfiye Edilmiş Eski Taslak Anahtarlar (88 Anahtar)
WhiteDesk geliştirme sürecinde eski ekran taslaklarından kalan ve güncel bileşenlerde hiçbir referansı bulunmayan anahtarlar:

* `ticket.*` (**33 anahtar**): `ticket.resolution_check.*` (5), `ticket.feedback.*` (7), `ticket.admin_ratings.*` (9), `ticket.call_handshake.*` (6), `ticket.ptt.*` (3), `ticket.integrity_receipt.*` (4).
* `provisioning.*` (**22 anahtar**): Eski provizyon taslak anahtarları (`provisioning.company_row`, `provisioning.admins_row`, `provisioning.move_to_org` vb.).
* `auth.*` (**21 anahtar**): Eski 12-kelime hub/genesis/recovery taslak anahtarları (`auth.hub.*`, `auth.genesis_success.*`, `auth.recovery.*`).
* `integration.*` (**6 anahtar**): `integration.copied_toast`, `integration.revoke_title` vb.
* `settings.*` (**6 anahtar**): `settings.advanced_features.voice_call.rule_label` vb.

---

## 3. Korunacak Dinamik ve Özel Anahtarlar (Güvenlik Kilidi)
Temizlik betiği çalıştırılırken aşağıdaki dinamik/dolaylı anahtarlar **kesinlikle korunacaktır**:
1. **Dinamik Kategori Anahtarları (`helpdesk.cat_${id}`):** `helpdesk.cat_genel`, `helpdesk.cat_teknik`, `helpdesk.cat_fatura`, `helpdesk.cat_oneri`, `helpdesk.cat_kurumsal`, `helpdesk.cat_internal_admin_ticket`, `helpdesk.cat_thewhite_support`.
2. **Dinamik Ay İsimleri (`common.months.${monthKey}`):** `common.months.jan` .. `common.months.dec` (12 anahtar).
3. **`i18nService.tsx` Kısa Anahtar Çözümlemesi:** `t('key')` çağrılarının `helpdesk.key` altında çözümlendiği 6 anahtar.
4. **Backend & Push Bildirim Anahtarları (`push_notifications.*`):** `backend/api/push.ts`, `backend/api/claim.ts` ve `cloudflare-worker/src/index.ts` içinde kullanılan 25 anahtarın tamamı.

---

## 4. Uygulama ve Doğrulama Adımları
1. **Otomatik Temizlik Betiği (`prune_dead_i18n_keys.js`):** 60 dil dosyasının (`src/locales/*.json`) tamamından belirlenen **907 ölü anahtar** tek seferde silinecek, aktif **1.535 anahtar** birebir aynı sırayla korunacak.
2. **Bütünlük ve Sıra Testi:** `60 / 60` JSON dosyasında tam `1.535` anahtar, `%100` `{placeholder}` uyumu ve sıfır eksik referans (`0 missing code key`) doğrulaması yapılacak.
3. **TypeScript & Derleme Kontrolü:** `npx tsc --noEmit` çalıştırılarak hiçbir tip veya import hatası olmadığı teyit edilecek.
