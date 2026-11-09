# WHITEDESK PROJE ÇALIŞMA ALANI KURALLARI

## 📁 Dosya ve Dizin Düzeni
1. **Ekran Görüntüleri ve Test Dökümleri:**
   - Kök dizinde (`c:\whitedesk`) kesinlikle hiçbir `.png`, `.jpg` görsel dosyası veya test amaçlı `.xml` UI döküm dosyası oluşturulamaz ve barındırılamaz.
   - Tüm ekran görüntüleri (`screencap`) ve arayüz dökümleri (`uiautomator dump`) istisnasız ve doğrudan `c:\whitedesk\screenshots\` klasörüne kaydedilmeli ve oradan yönetilmelidir.

2. **Kök Dizin Temizliği:**
   - Kök dizinde yalnızca projenin temel yapılandırma dosyaları (`package.json`, `App.tsx`, `index.js`, `app.json`, `.env.local` vb.) ile temel sistem dosyaları (`GEMINI.md`, `AGENT_MANDATES.md`) yer alır; geçici veya deneme amaçlı hiçbir dosya root dizinine bırakılamaz.

3. **Plan ve Dokümantasyon Dosyaları:**
   - Temel kurallar haricindeki tüm mimari, iş akışı, tasarım ve proje planlama `.md` dosyaları istisnasız `c:\whitedesk\project_plans\` klasörüne kaydedilmeli ve oradan yönetilmelidir.

4. **Veritabanı Şeması Denetim Protokolü (%100 Cloudflare D1 & `api.whitedesk.one`):**
   - Yapılan her veritabanı veya veri modeli güncellemesinde `whitedesk_schema.sql` ve `cloudflare-worker/schema.sql` dosyaları istisnasız güncellenmelidir.
   - Neon PostgreSQL ve ayrı `admin_roster` tablosu tamamen tasfiye edilmiştir; tüm kalıcı kurumsal tablolar (`whitedesk_enterprises`, birleşik `whitedesk_admins`, `whitedesk_orgs` vb.) ve buharlaşma havuzu tabloları (`transient_messages`, `ephemeral_signals`) tekil **Cloudflare D1 (`whitedesk_d1_relay`)** üzerinde çalışır ve **`https://api.whitedesk.one`** kapısından sunulur. Eski ve kullanılmayan tablolar şemada bırakılamaz.

5. **Bilet Kartı Oluşturan ve Temsilci Satırları Tasarım Kuralı (KİLİTLİ KURAL):**
   - **1. Satır (Başlık Satırı):** Bilet numarası (`TKT-XXXXXX` veya tartışma ise `DSC-XXXXXX`) ve sağında ` · ` ile **Birim / Departman adı (ORG: Saha, Muhasebe vb.)** yer alır; kategori adı yazılmaz.
   - **2. Satır (Konu Satırı):** Bilet konusu (`ticket.subject`).
   - **3. Satır (Oluşturan Satırı — Pill Yok, Yalın):** Atanan satırından bir önceki satırda, satırın en başında **kesinlikle pill (kutu) olmadan** yer alır. En solda **içi boş yıldız (`Star`)** ikonu, yanında oluşturanın Adı Soyadı (veya Blind ID'si), ` · ` ayracı ve sabit **oluşturma tarihi-saati (`ticket.created_at`)** yazılır.
   - **4. Satır (Temsilci / Havuz Satırı — Pill Yok, Mavi `#2563EB`):** Sol tarafta **kesinlikle pill (kutu) olmadan** mavi (`#2563EB`) kullanıcı (`User`) ikonu ve mavi temsilci adı (veya Blind ID'si; atanmamışsa `Havuzda`) yer alır. Hemen sağında ` · ` ayracı ve **o satırdaki durumun tarihi-saati (`ticket.assigned_at`: havuza giriş, ilk atama veya yeniden atama/devir saati)** yazılır. Mesajlaşma saatleri (`ticket_reply`) kart üzerindeki bu tarihleri değiştirmez; mesaj tarihleri yalnızca bilet detayındaki sohbet balonlarında yer alır.
   - **Blind ID Maskeleme Formatı:** İsim girilmediğinde hem Oluşturan hem de Temsilci alanında Blind ID `124495...77343` formatında (`blind_` sonrasındaki ilk 6 karakter, 7-8-9. karakterler yerine `...`, ve 10-14. karakterler) gösterilir.

6. **Tasarım Bütünlüğü ve İfade Disiplini Protokolü (KESİN KURAL):**
   - Ekran tasarımlarında talimat dışında hiçbir değişiklik yapılmayacaktır. Tasarım talimatında iki onay istenecektir.
   - Bir yerde bir ifade kullanıldığında başka yerlerde destekleyici renklendirmeler ya da butonlar kullanılmayacaktır.
   - Kullanılan ifadelerde anlaşılır, kısa, profesyonel metinler kullanılacaktır. Yanında parantez içi eş anlamlı ya da destekleyici ek metinler kullanılmayacaktır.

7. **Kökten Kör Kimlik (`blind_id`) Üretimi, Sıfır Açık `white_id` İletimi ve Sıfır-Polling Kuralı (KİLİTLİ GÜVENLİK KURALI):**
   - Açık `white_id` (ham P-256 açık anahtar hex değeri) güvenlik riski oluşturduğundan sistemin **hiçbir noktasında** kimlik olarak üretilemez, saklanamaz ve ağ üzerinden (Cloudflare Worker, D1, R2, FCM Push, WebRTC sinyal odaları, biletler, mesajlar) **kesinlikle hiçbir yere gönderilemez**.
   - Kimlik üretilen tüm kök noktalarda (`src/whitedesk-sdk/core/crypto.ts` -> `WhiteDeskCrypto.generateBlindId`, `cryptoService.ts` -> `deriveWhiteId`/`getWhiteId`, `crypto-vault.service.ts`, `helpDeskAuthService.ts` -> `getOwnWhiteId`, `cloudflare-worker/src/index.ts` -> `computeBlindId`) algoritma tekil ve idempotent (`blind_` veya `ent_` ile başlıyorsa tekrar hashlemez) olarak doğrudan `'blind_' + HMAC_SHA256('WhiteDesk_ZeroKnowledge_Salt_2026_Secure', cleanId).substring(0, 32)` üretir ve döndürür. Cihazda eski bir ham hex kayıtlıysa ilk okumada otomatik olarak `blind_id`'ye dönüştürülüp üzerine yazılır.
   - Tüm iletişimde (biletler, yanıtlar, sesli arama, 1-e-1 bas-konuş, genel telsiz yayını, uzak masaüstü) `whitedesk_user_bindings` tablosuna bakılmaz; **tekil referans bilet kartındaki `blind_id` değeridir**.
   - Arka planda veya ön planda sürekli çalışan, fatura ve limit tüketen periyodik sorgulama (**idle polling**) kesinlikle yasaktır; çağrı ve bildirimler %100 FCM Push tetiklemesiyle uyanır.

8. **Yönetici Anahtarları (`wdrun` / İlk Kodla Giriş / Bilet Kutusu `admin <kod>`) ve Profil QR (`wd_prof_...`) Oturum Kurtarma Kuralı (KİLİTLİ SÜREÇ KURALI):**
   - **A. `wdrun` ve Uygulama İçi Yönetici Anahtarlarının Çift Kapı Uyumu (`claimUnifiedHash` & `handleAdminClaimCommand`):**
     - `wdrun` panelinde firma seçilerek üretilen tüm yönetici anahtarları (`ga_cosmos_...`, `adm_oper_...`, `tw_founder_...`) ve doğrudan tanımlanan yönetici kimlikleri (`blind_...`), hem uygulamanın **ilk açılışındaki "Kod ile Giriş Yap" (`Giriş Kodunuz`)** ekranından hem de uygulama içindeki **bilet mesaj kutusundan `admin <kod/blind_id>`** komutuyla girildiğinde **%100 aynı deterministik sonucu** üretmek zorundadır.
     - Bir erişim/kurtarma hash kodu (`ga_cosmos_...`, `adm_oper_...`, `tw_founder_...`) girildiğinde her iki kapıda da `CryptoVaultService.deriveVaultFromAccessKey(hash).blindId` üzerinden deterministik `blind_id` üretilir, cihazın `OWN_WHITE_ID` kimliği olarak mühürlenir ve `whitedesk_admins` tablosuna bu `blind_id` ile kaydedilir.
     - Eğer `whitedesk_admins` tablosunda önceden kayıtlı bir `blind_...` kimliği doğrudan girilirse (giriş kutusuna `blind_...` veya bilet kutusuna `admin blind_...`), sistem bunu tekrar hashlemez ve onay (`pending`) kuyruğuna düşürmez; doğrudan ilgili `blind_...` değerini cihazın `OWN_WHITE_ID` kimliği olarak atayıp yönetici oturumunu anında açar.
   - **B. Profil QR Kodu (`wd_prof_...`) ile Cihaz Kaybı Sonrası Birebir Aynı Oturum ve Kimlik Kurtarma Süreci:**
     - Yönetici veya kullanıcı kendi cihazındaki **Profil** ekranında yer alan QR kodunu (`wd_prof_<32hex>`) oluşturduğunda (`getOrCreateProfilePasskey`), `whitedesk_recovery_hashes` tablosuna `tenant_blind_id`, `type` (`role`), `org_id`, `app_id` bilgileriyle birlikte kullanıcının o anki **gerçek `blind_id` kimliği (`used_by_blind_id = myBlindId`)** kişiye özel olarak mühürlenir.
     - Telefon kaybolduğunda, sıfırlandığında veya yeni bir cihaza geçildiğinde, saklanan bu Profil QR kodu (veya `wd_prof_...` metni) yeni cihazda **ilk giriş ekranından ya da uygulama içi barkod okuyucu / bilet kutusundan** okutulduğunda (`handleProfilePasskeyClaim` & `claimUnifiedHash`), sistem yeni cihazda rastgele yeni bir `blind_id` üretmez; `whitedesk_recovery_hashes.used_by_blind_id` içinde kayıtlı **orijinal `blind_id` kimliğini**, `whitedesk_admins` tablosundaki **rumuzunu (`alias`), rolünü, departmanını (`org_id`) ve kurumsal oturumunu** yeni cihaza birebir geri yükler (`OWN_WHITE_ID` olarak mühürler).
     - Bu sayede yönetici yeni cihazında **aynı `blind_id`** ile oturum açmış olur; kendisine atanmış açık biletlerin yeni yanıtları, sesli aramalar, 1-e-1 bas-konuş ve telsiz çağrıları kesintisiz olarak aynı kimliğe düşmeye devam eder.

---

## 🗂️ Hiyerarşik Mimari ve Plan Dokümantasyon Ağacı (`c:\whitedesk\project_plans\`)

* 📁 **[project_plans/README.md](file:///c:/whitedesk/project_plans/README.md)** *(Master Dokümantasyon İndeksi)*
  * ├── 🏛️ **1. Rol, Bilet Hiyerarşisi ve Kart Tasarım Standartları**
  * │   ├── [ticket_hierarchy_and_roles.md](file:///c:/whitedesk/project_plans/ticket_hierarchy_and_roles.md) *(3 Buton Standardı, `TKT-`/`DSC-`, ORG, 2 Satırlı Oluşturan/Temsilci Tarih Mimarisi, Blind ID Formatı)*
  * │   ├── [compose_header_plan.md](file:///c:/whitedesk/project_plans/compose_header_plan.md) *(Yeni Bilet / Tartışma Ekran Başlıkları ve Kategori Gizleme Kuralları)*
  * │   └── [ticket_processes_and_texts_plan.md](file:///c:/whitedesk/project_plans/ticket_processes_and_texts_plan.md) *(Bilet Süreçleri, Bildirim Metinleri ve Yaşam Döngüsü İfadeleri)*
  * ├── ⚖️ **2. Adil Bilet Dağıtımı (Load-Balance), SLA ve Yetki İptali (Revocation)**
  * │   ├── [Ticket_alloc_revoke.md](file:///c:/whitedesk/project_plans/Ticket_alloc_revoke.md) *(D1 Adil Dağıtım, İkiz Bilet SLA Devri, Antimadde Buharlaşma ve R2 Ek Koruması)*
  * │   ├── [ticket_alloc_revoke_implementation_plan.md](file:///c:/whitedesk/project_plans/ticket_alloc_revoke_implementation_plan.md) *(SLA & Dağıtım Teknik Uygulama Planı)*
  * │   └── [provisioning_long_press_actions_plan.md](file:///c:/whitedesk/project_plans/provisioning_long_press_actions_plan.md) *(Provizyon Masası Uzun Basma ve Yetki Yönetimi)*
  * ├── ☁️ **3. Bulut, Kriptografi ve İletişim Altyapısı (Cloudflare D1 / R2 / Push / PTT)**
  * │   ├── [cloudflare.md](file:///c:/whitedesk/project_plans/cloudflare.md) *(Cloudflare Worker, D1 Sıfır-Bilgi Havuzu ve R2 Mimari Şartnamesi)*
  * │   ├── [cloudflare_migration_plan.md](file:///c:/whitedesk/project_plans/cloudflare_migration_plan.md) *(D1 & R2 Geçiş ve Senkronizasyon Planı)*
  * │   ├── [communication_and_push_plan.md](file:///c:/whitedesk/project_plans/communication_and_push_plan.md) *(FCM Push, WebRTC Sinyalizasyon ve Bildirim Akışı)*
  * │   ├── [CALLSCREEN_STANDARD.md](file:///c:/whitedesk/project_plans/CALLSCREEN_STANDARD.md) *(Sesli Arama ve Telsiz PTT Ekran Standartları)*
  * │   └── [desktop.md](file:///c:/whitedesk/project_plans/desktop.md) *(Uzak Masaüstü `wdrun` Bağlantı ve Güvenlik Mimari Planı)*
  * └── 🔐 **4. Kimlik, Profil, Lisanslama ve Kurumsal Yönetişim**
      ├── [guncellenen_giris_ekranlari.md](file:///c:/whitedesk/project_plans/guncellenen_giris_ekranlari.md) *(Giriş, Provizyon ve Kurtarma Ekranları)*
      ├── [profile_modal_and_menu_plan.md](file:///c:/whitedesk/project_plans/profile_modal_and_menu_plan.md) *(Profil Modalı, İki Kelime Ad Soyad Kuralı ve Yedekleme)*
      ├── [LicensePlans.md](file:///c:/whitedesk/project_plans/LicensePlans.md) & [license_module_blueprint.md](file:///c:/whitedesk/project_plans/license_module_blueprint.md) *(Lisans Paketleri, Fiyatlandırma ve Modül Yetkileri)*
      └── [advanced_architecture_and_ui_plan.md](file:///c:/whitedesk/project_plans/advanced_architecture_and_ui_plan.md) & [advanced_features_plan.md](file:///c:/whitedesk/project_plans/advanced_features_plan.md) *(Kurumsal Ayarlar, FDH Denetim ve Gelişmiş Özellikler)*
