# STRICT AGENT MANDATES & USER RULES (MANDATORY EXECUTION PROTOCOL)

## 🛑 1. SIFIR İNİSİYATİF VE FAZLALIK YASAĞI (ZERO UNSOLICITED INITIATIVE)
* **KURAL:** Kullanıcı talimatı haricinde fazladan, doğaçlama veya inisiyatif kullanarak kesinlikle farklı şeyler YAPILMAYACAKTIR.
* Kullanıcı ne istediyse **yalnızca ve tam olarak o yapılacaktır**.
* Gereksiz ara modallar, talep edilmeyen opsiyonlar (örn. logo yüklemek için kamera seçeneği gibi anlamsız eklemeler) KESİNLİKLE EKLENMEYECEKTİR.

## 🖼️ 2. KURULUŞ LOGOSU PROTOKOLÜ
1. **Buton Davranışı ve İsimlendirme:**
   - Henüz logo yüklenmediyse buton adı: **"Logo Yükle"**
   - Logo yüklendikten sonra aynı buton: **"Logoyu Kaldır"** olacaktır.
   - Butona basıldığında herhangi bir özel/ara modal AÇILMAYACAKTIR.
   - Doğrudan ve yalnızca Android sistem dosya seçicisi (`DocumentPicker.getDocumentAsync`) açılacaktır. Kamera ile logo çekilmez.
   - "Logoyu Kaldır" butonuna basıldığında kuruluşa ait logo sistemden kaldırılır ve varsayılan görünüme dönülür.
2. **Logo Konumu ve Şeffaflık:**
   - Logo yüklenene kadar ekranın en üst kısmında beyaz üzerine beyaz gölgeli "WhiteDesk" yazısı görünmeye devam eder.
   - Logo yüklendiğinde: Tam olarak ekranın en üst kısmındaki "WhiteDesk" yazısının yerine müşteri logosu gelir.
   - Logo gelirken PDF'te imza ekler gibi arka planı otomatik temizlenerek şeffaf olarak eklenir; üst zemine geldiğinde kenarlarda beyazlık/hale kalmaz ve zeminle (`#F4F7FA`) kusursuz uyum sağlar.


3. ** Uygulama da yapılacak değişiklikler, eklemeler ve yeni geliştirmeler, prompt olarak talimat halinde verilmektedir.  Talimatlarda olmayan hiçbir işlem yapılamaz. Ancak yapılması gereken birşeye rastladığında öneride bulunup onay aldıktan sonra yapabilirsin.
4. ** Uygulama içerisinde hiçbir tasarım talimat verip arkasından onay istemeden ve onaylanmadan değiştirilemez. 
5. ** Verilen promptlarda açıkça ve net cümlelerle belirtilmedikçe kendi inisiyatifinde kod ya da tasarım değişikliği yapamazsın.
6. ** Menü hazırlarken bir kelimenin diğer anlamları menüye eklenmeyecek ve menülerde ifadeler mümkün olduğunca kısa tutulacaktır. Parantez içerisinde ya da / ile aynı anlama gelen diğer yazım şekilleri eklenmeyecektir.
7. ** TEST DOSYALARI VE EKRAN GÖRÜNTÜLERİ PROTOKOLÜ (KESİN KURAL): Kök dizinde (proje root dizininde) asla hiçbir `.png`, `.jpg` ekran görüntüsü veya test amaçlı `.xml` UI döküm dosyası oluşturulamaz ve bırakılamaz. Tüm test çıktıları, ekran görüntüleri ve uiautomator dökümleri istisnasız `c:\whitedesk\screenshots\` klasörüne kaydedilecek ve orada yönetilecektir.
8. ** VERİTABANI ŞEMASI GÜNCELLİK PROTOKOLÜ (%100 CLOUDFLARE D1 & `api.whitedesk.one`): Her bir veri modeli veya tablo güncellemesinde `whitedesk_schema.sql` ve `cloudflare-worker/schema.sql` dosyalarının güncellenmesi zorunludur. Neon PostgreSQL ve ayrı `admin_roster` tablosu tamamen tasfiye edilmiştir (`admin_roster` kolonları `whitedesk_admins` tablosuna birleştirilmiştir). Tüm kalıcı ve geçici tablolar tekil Cloudflare D1 (`whitedesk_d1_relay`) üzerinde yer alır ve `https://api.whitedesk.one` üzerinden hizmet verir.
9. **BİLET KARTI KİMLİK, OLUŞTURAN VE TEMSİLCİ SATIRLARI PROTOKOLÜ (KİLİTLİ KURAL):**
   - **1. Satır (Başlık Satırı):** Bilet numarası (`TKT-XXXXXX` veya tartışma ise `DSC-XXXXXX`) ve hemen sağında ` · ` ayracı ile **Birim / Departman adı (ORG: Saha, Muhasebe vb.)** yazılır. Kategori adı veya yıldız rozeti kesinlikle konmaz.
   - **2. Satır (Konu Satırı):** Bilet konusu (`ticket.subject`).
   - **3. Satır (Oluşturan Satırı — Pill Yok, Yalın):**
     - Atanan satırından bir önceki satırda, satırın en başında yer alır ve **kesinlikle pill (kutu/çerçeve) içerisine alınmaz.**
     - En solda **içi boş yıldız (`Star`)** ikonu, yanında oluşturanın Adı Soyadı (isim girilmemişse `124495...77343` formatında Blind ID), ` · ` ayracı ve **biletin oluşturulma tarihi ve saati (`ticket.created_at`)** yer alır. Bu tarih sabittir, asla değişmez.
   - **4. Satır (Temsilci / Havuz Satırı — Pill Yok, Mavi `#2563EB`):**
     - Sol tarafta **kesinlikle pill (kutu/çerçeve) olmadan** mavi (`#2563EB`) kullanıcı (`User`) ikonu ve mavi atanan temsilci adı (isim yoksa `124495...77343` Blind ID; henüz atanmamışsa `Havuzda`) yer alır.
     - Hemen sağında ` · ` ayracı ve **o satırdaki durumun tarihi ve saati (`ticket.assigned_at`)** yer alır:
       * Bilet havuzdaysa: Havuza giriş tarihi ve saati.
       * Bilet bir temsilciye atandıysa: İlk atama tarihi ve saati.
       * Bilet havuzdan devralındıysa, SLA ile yeniden atandıysa veya transfer edildiyse: Yeniden atama / devir tarihi ve saati.
       * Normal sohbet mesajları (`ticket_reply`) `assigned_at` tarihini **değiştirmez**; mesaj tarihleri yalnızca bilet detayındaki sohbet balonlarında takip edilir (arka plandaki `updated_at` sadece liste sıralaması için güncellenir).
   - **Blind ID Maskeleme Formatı (`formatDisplayBlindId`):** İsim girilmediğinde hem Oluşturan hem de Temsilci alanında Blind ID `124495...77343` formatında (`blind_` ön eki atıldıktan sonra ilk 6 karakter + `...` [7-8-9. karakterler yerine] + 10-14. karakterler) gösterilir.

10. **ANA EKRAN 3 BUTON HİYERARŞİSİ (KİLİTLİ KURAL):**
    - **1. Mavi Buton (`#3B82F6` — "Yeni bir bilet oluştur"):** Solunda `+`, sağında herkeste **Yukarı Ok (`ArrowUp`)**. Kullanıcı, Bölüm Admini ve Global Admin'de görünür; yalnızca Kurucu'da (`TheWhite`) gizlidir.
    - **2. Mor Buton (`#7C3AED` — "Bir tartışma başlat"):** Solunda mesaj ikonu; sağında **Kurucu ve Global Admin'de Aşağı Ok (`ArrowDown`)**, **Bölüm Adminlerinde Sağa Yatay Ok + Yukarı Ok (`ArrowRight` + `ArrowUp`)**. Kullanıcılarda bulunmaz.
    - **3. Yeşil Buton (`#059669` — "Bir telsiz yayını başlat"):** Solunda telsiz (`Radio`) ikonu, **sağında ok yoktur**. Lisans aktif olduğunda herkeste görünür.

11. **AD SOYAD İKİ KELİME ZORUNLULUĞU VE GİRİŞ İLKELERİ:**
    - Kuruluş ayarlarında eski "Giriş sorunlu" toggle'ı kaldırılmıştır.
    - "Ana ekranda Ad Soyad Girişi Zorunlu" (`allowNameEntry`) aktif olduğunda, hem ana ekrandaki kimlik modalında hem de Profil modalında (Tenant adının hemen altında) en az **iki kelimelik gerçek ad soyad** (nokta veya özel karakterle geçiştirilemez) girilmesi zorunludur.

12. **TASARIM BÜTÜNLÜĞÜ VE İFADE DİSİPLİNİ PROTOKOLÜ (KESİN KURAL):** Ekran tasarımlarında talimat dışında hiçbir değişiklik yapılmayacaktır. Tasarım talimatında iki onay istenecektir. Bir yerde bir ifade kullanıldığında başka yerlerde destekleyici renklendirmeler ya da butonlar kullanılmayacaktır. Kullanılan ifadelerde anlaşılır kısa profesyonel metinler kullanılacaktır. Yanında parantez içi eş anlamlı ya da destekleyici ek metinler kullanılmayacaktır.

---

## 🗂️ HİYERARŞİK MİMARİ VE PLAN DOKÜMANTASYON AĞACI (PROJECT PLANS HIERARCHY)

Kod tabanında işlem yapan her Agent, ilgili modüle dokunmadan önce aşağıdaki hiyerarşik doküman ağacını (`c:\whitedesk\project_plans\`) incelemek ve buradaki kuralları korumak zorundadır:

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





