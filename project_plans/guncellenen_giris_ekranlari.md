# 📱 Güncellenen Giriş ve Kurulum Ekranları (PNG Önizleme)

`corrections_mnedia` dizinindeki ekran görüntülerinde görülen İngilizce çeviri anahtarı (fallback) hataları tamamen giderilmiş, tüm ekranlar doğal ve kurumsal Türkçe metinlerle derlenmiştir.

---

````carousel
![1. 12 Kelimelik Kurtarma İfadesi ile Giriş](/C:/Users/Mustafa%20ERYILMAZ/.gemini/antigravity/brain/181acf22-fff8-4c14-a6fe-10d539b69766/1_kurtarma_ifadesi_giris.png)
<!-- slide -->
![2. Kod ile Giriş Yapın](/C:/Users/Mustafa%20ERYILMAZ/.gemini/antigravity/brain/181acf22-fff8-4c14-a6fe-10d539b69766/2_kod_ile_giris.png)
<!-- slide -->
![3. Yeni Kuruluş Oluştur](/C:/Users/Mustafa%20ERYILMAZ/.gemini/antigravity/brain/181acf22-fff8-4c14-a6fe-10d539b69766/3_yeni_kurulus_olustur.png)
<!-- slide -->
![4. Kuruluş Logosu ve Özel Alanlar](/C:/Users/Mustafa%20ERYILMAZ/.gemini/antigravity/brain/181acf22-fff8-4c14-a6fe-10d539b69766/4_kurulus_ozellestirme.png)
<!-- slide -->
![5. Güvenlik Anahtarı Kurulumu (Tören)](/C:/Users/Mustafa%20ERYILMAZ/.gemini/antigravity/brain/181acf22-fff8-4c14-a6fe-10d539b69766/5_guvenlik_anahtari_toreni.png)
````

---

### 🔍 Düzeltilen Fallback Metinleri Tablosu

| Ekran | Önceki Hatalı Anahtar (Fallback) | Güncel Türkçe Metin |
|---|---|---|
| **Ekran 1** | `auth.login.title` | **12 Kelimelik Kurtarma İfadesi ile Giriş** |
| | `auth.login.subtitle` | Hesabınıza erişmek için 12 kelimelik kurtarma ifadenizi (passphrase) giriniz. |
| | `auth.login.input_placeholder` | 12 kelimelik kurtarma ifadenizi giriniz... |
| | `auth.login.action_btn` | **Doğrula ve Oturuma Gir** |
| | `auth.login.back_btn` | ← Geri Dön |
| **Ekran 2** | `auth.recovery.back_btn` | **← Giriş Ekranına Dön** |
| **Ekran 3** | `auth.genesis.step1_title` | **Yeni Kuruluş Oluştur** |
| | `auth.genesis.step1_subtitle` | Kuruluşunuz ve çalışma alanınız için temel tanımlamaları yapınız. |
| | `auth.genesis.tenant_name_label` | Kuruluş / Şirket Adı |
| | `auth.genesis.tenant_name_placeholder` | Örn: ACME Bilişim A.Ş. |
| | `auth.genesis.workspace_name_label` | Çalışma Alanı Adı |
| | `auth.genesis.workspace_name_placeholder` | Örn: Destek ve Operasyon Merkezi |
| | `auth.genesis.next_btn` | **İleri ›** |
| | `auth.genesis.back_btn` | ← Vazgeç |
| **Ekran 4** | `auth.customization.title` | **Kuruluş Logosu ve Özel Alanlar** |
| | `auth.customization.skip_header_link` | Daha Sonra Yap ➔ |
| | `auth.customization.subtitle` | Destek biletlerinizde yer alacak alanları ve logonuzu şimdi ekleyebilir veya doğrudan geçebilirsiniz... |
| | `auth.customization.logo_section.title` | Kuruluş Logosu (İsteğe Bağlı) |
| | `auth.customization.fields_section.title` | Bilet Takip Alanları (İsteğe Bağlı) |
| | `auth.customization.fields_section.description` | Müşterilerinizin destek talebi açarken doldurmasını istediğiniz ek bilgiler. |
| | `auth.customization.fields_section.placeholder_example` | Örn: Cihaz Seri No, Departman, Plaka... |
| | `auth.customization.fields_section.empty_state` | Henüz özel alan eklenmedi. |
| | `auth.customization.defer_notice` | Bilgi: Logo ve özel alan tanımlarını dilediğiniz zaman Ayarlar bölümünden ekleyebilir veya güncelleyebilirsiniz. |
| | `auth.customization.save_button` | **Kaydet ve Devam Et** |
| | `auth.customization.skip_button` | Bu Adımı Atla (Daha Sonra Ayarlardan Yap) |
| **Ekran 5** | `auth.ceremony.title` | **Güvenlik Anahtarı Kurulumu** |
| | `auth.ceremony.subtitle` | Verileriniz yalnızca bu cihazda şifrelenir. Aşağıdaki 12 kelimelik kurtarma ifadesi kuruluşunuzun tek anahtarıdır... |
| | `auth.ceremony.copy` | Panoya Kopyala |
| | `auth.ceremony.warning` | Bu 12 kelime sunucularda saklanmaz. Kaybedilirse geri getirilemez. Lütfen güvenli bir yere not ediniz. |
| | `auth.ceremony.verify_title` | **12 Kelime Doğrulama** |
| | `auth.ceremony.verify_subtitle` | Güvenlik kelimelerinizi doğru not ettiğinizi onaylamak için lütfen aşağıdaki kelimeleri giriniz: |
| | `auth.ceremony.verify_prompt` | . kelimeyi giriniz: |
| | `auth.ceremony.verify_action` | **Doğrula ve Kuruluşu Başlat** |

> [!NOTE]
> PNG dosyaları hem proje çalışma dizinindeki [`c:\whitedesk\corrections_mnedia\updated_screens`](file:///c:/whitedesk/corrections_mnedia/updated_screens) klasörüne hem de kalıcı bildirim dizinine kaydedilmiştir.

---

## 🔒 6. Yönetici Anahtarları (`wdrun` / İlk Kodla Giriş / Bilet Kutusu `admin <kod>`) ve Profil QR (`wd_prof_...`) Kurtarma Standart Süreci (KİLİTLİ KURAL)

### A. `wdrun` ile Üretilen Admin Anahtarlarının Çift Kapı Uyumu
1. **Tekil Kimlik Türetimi (Idempotent Blind ID):**
   - `wdrun` panelinde ([`wdrun.html`](file:///c:/whitedesk/wdrun.html) ve [`scripts/wd.js`](file:///c:/whitedesk/scripts/wd.js)) firma seçilerek üretilen tüm yönetici anahtarları (`ga_cosmos_...`, `adm_oper_...`, `tw_founder_...`) ve doğrudan tanımlanan yönetici kimlikleri (`blind_...`), hem uygulamanın ilk açılışındaki **"Kod ile Giriş Yap" (`Giriş Kodunuz`)** ekranından ([`claimUnifiedHash`](file:///c:/whitedesk/src/services/helpdesk/helpDeskLicenseService.ts)) hem de uygulama içindeki **bilet mesaj kutusundan `admin <kod/blind_id>`** komutuyla ([`handleAdminClaimCommand`](file:///c:/whitedesk/src/services/helpdesk/helpDeskAuthService.ts)) girildiğinde **%100 aynı deterministik sonucu** üretir.
2. **Hash Kodlarından Deterministik `blind_id` Mühürleme:**
   - `ga_cosmos_...`, `adm_oper_...` veya `tw_founder_...` formatında bir anahtar girildiğinde, her iki giriş kapısında da `CryptoVaultService.deriveVaultFromAccessKey(hash).blindId` hesaplanır, cihazın `OWN_WHITE_ID` kimliği olarak kaydedilir ve `whitedesk_admins` tablosuna bu `blind_id` ile işlenir.
3. **Doğrudan `blind_...` Kimliği ile Anında Aktivasyon:**
   - `whitedesk_admins` tablosunda önceden kayıtlı bir `blind_...` kimliği doğrudan girildiğinde (ilk giriş kutusuna `blind_...` veya bilet kutusuna `admin blind_...`), sistem bu değeri tekrar hashlemez ve onay (`pending`) kuyruğuna düşürmez; doğrudan ilgili `blind_...` değerini cihazın `OWN_WHITE_ID` kimliği olarak atayıp yönetici oturumunu anında açar.

### B. Profil QR Kodu (`wd_prof_...`) ile Cihaz Kaybı Sonrası Aynı Oturumu Açma Süreci
1. **Kişiye Özel Profil Passkey Mühürleme (`getOrCreateProfilePasskey`):**
   - Yönetici kendi cihazındaki **Profil** bölümünde yer alan QR kodunu (`wd_prof_<32hex>`) oluşturduğunda/görüntülediğinde, `whitedesk_recovery_hashes` tablosuna `tenant_blind_id`, `type` (`role`), `org_id`, `app_id` bilgileriyle birlikte yöneticinin **gerçek `blind_id` kimliği (`used_by_blind_id = myBlindId`)** kaydedilir ve sorgusu kişiye özel (`used_by_blind_id = myBlindId`) yapılır.
2. **Yeni Cihazda Orijinal Kimlik ve Oturumun Geri Yüklenmesi (`handleProfilePasskeyClaim` & `claimUnifiedHash`):**
   - Telefon kaybolduğunda, sıfırlandığında veya yeni bir cihaza geçildiğinde, saklanan bu Profil QR kodu (veya `wd_prof_...` kodu) yeni cihazda okutulduğunda ya da girildiğinde sistem yeni cihazda rastgele bir `blind_id` üretmez.
   - `whitedesk_recovery_hashes.used_by_blind_id` sütunundaki **orijinal `blind_id` kimliğini** ve `whitedesk_admins` tablosundaki **rumuz (`alias`), rol (`founder` / `global_admin` / `admin`), birim (`org_id`) ve kurumsal oturum** bilgilerini yeni cihaza (`OWN_WHITE_ID` dahil) birebir geri yükler.
   - Böylece yönetici yeni cihazında **birebir aynı `blind_id` ve oturumla** çalışmaya devam eder; kendisine atanmış biletlerin yeni yanıtları, sesli aramalar ve telsiz çağrıları kesintisiz aynı kimliğe düşer.

