# 🏛️ WHITEDESK PROVİZYON MASASI & GÜVENLİK REFACTORİNG PLANI

Bu doküman, Provizyon Masasının Samsung sadeliğinde profesyonel bir görünüme kavuşturulması, kullanıcı deneyimindeki tutarsızlıkların giderilmesi, kategori seçim mimarisinin sadeleştirilmesi ve sıfır-bilgi (Zero-Knowledge) güvenlik protokolünün pekiştirilmesi amacıyla hazırlanmıştır.

---

## 🎯 Temel Hedefler ve Mimari Prensipler

1. **Samsung Tasarım Sadeliği (OneUI / Clean Tech):**
   - Karışık, tutarsız ve dağınık başlıklar tek bir standarda oturtulacaktır.
   - Modal açılışlarında dev firma adı ortadan kaldırılacak; her modalın üstünde standart **"Yeni [Başlık] Ekle"**, altında ise yalın gri **Firma Adı** ve **Kısa Açıklama** yer alacaktır.
   - "Her uygulama için benzersiz..." kutucuğunun sol üst kenarına **"SDK Entegrasyonu"** etiketi yerleştirilecektir.

2. **Kesin Kural: Sıfır Dropdown (Doğrudan Yerleşim & Dikey Kaydırma):**
   - Kategori eklenen/seçilen hiçbir yerde açılır kutu (Dropdown/Select) kullanılmayacaktır.
   - Kategoriler doğrudan yan yana çip/hap (`chip`) olarak yerleşecek, eklendikçe/çoğaldıkça 2-3 satıra genişleyecek veya dikey kaydırılabilir (`maxHeight: 120`, `flexWrap: wrap`) olacaktır.
   - Seçilen kategori hapının sağında çarpı (`X`) ikonu yer alacak, tıklandığında onay modalı ile çıkarılacaktır.

3. **Yönetici ve Kullanıcı Sürecinin Ayrılması:**
   - Provizyon Masası ana ekranında ve yetki üretiminde Yönetici ve Kullanıcı birbirine karıştırılmayacaktır.
   - Ana masadaki satır sırası: **Yöneticiler**, **Organizasyonlar**, **Uygulamalar**, **Kategoriler**, **Kullanıcılar** şeklinde standartlaştırılacaktır.
   - Kullanıcılar satırı tıpkı yöneticiler gibi bağımsız bir çip bandına ve kendi `+` butonuna sahip olacaktır.

4. **Veritabanı (`whitedesk_admins`) Kategori Eşlemesi:**
   - `whitedesk_admins` tablosundaki `categories` sütunu (JSON dizi formatında: `["cat_1", "cat_2"]`) yöneticiye atanan kategorileri saklar.
   - Yönetici oluşturulurken/düzenlenirken seçilen kategori dizisi doğrudan bu alana yazılacak; bilet adil dağıtım motoru (`slaAllocator`) biletin kategorisi ile yöneticinin kategorilerini eşleştirerek yönlendirme yapacaktır.

5. **Veri Tabanı Temizliği (Çift Kurucu Tasfiyesi):**
   - `whitedesk_admins` tablosunda ve ilgili tablolarda kalan mükerrer, eski veya yetkisiz kurucu kayıtları temizlenecek; sistemde yalnızca tekil ve meşru Founder kalacaktır.

6. **Kökten Kör Kimlik (`blind_id`) ve `white_id` Tasfiyesi:**
   - Projenin 7. kuralı uyarınca açık `white_id` (P-256 ham hex açık anahtarı) güvenlik riski oluşturmaktadır.
   - Veritabanındaki `white_id` referansları temizlenecek, anahtar ve kimlik alanı olarak yalnızca deterministik `blind_id` esas alınacaktır.

---

## 🛠️ Uygulama Adımları

### Adım 1: Başlıklar ve Metin Standardizasyonu (Samsung Sade Tipografi)
- **Ana Masa Başlıkları:**
  - `Yöneticiler` (Admins)
  - `Organizasyonlar` (Organizations)
  - `Uygulamalar` (Applications)
  - `Kategoriler` (Categories)
  - `Kullanıcılar` (Users)
- **Yeni Kayıt Modalları:**
  - `Yeni Yönetici Ekle`
  - `Yeni Organizasyon Ekle`
  - `Yeni Uygulama Ekle`
  - `Yeni Kategori Ekle`
  - `Yeni Kullanıcı Ekle`
  - Her birinin altında:
    - Gri küçük fontla Firma Adı (`{displayTenantName}`)
    - Altında 1 satır gri açıklama metni.

### Adım 2: SDK Entegrasyonu Çerçevesi
- `ProvisioningStationModal.tsx` içindeki Uygulamalar alanında veya SDK bilgi kartında sol üst köşeye yerleşen `SDK Entegrasyonu` badge/etiketi eklenecektir.

### Adım 3: Yönetici & Kullanıcı Modalı Ayrımı ve Çip Tabanlı Kategori Seçimi
- `ProvisioningHashModal.tsx` içerisinde:
  - Yönetici veya Kullanıcı üretilirken, Kategori seçimi için Dropdown yerine doğrudan `availableCategories` haritası sergilenecektir.
  - Tıklanan kategoriler seçili hale gelecek (`isSelected`), seçilenler üstte aktif hap olarak listelenecek, üzerinde `X` butonu ile çıkarma yapılabilecektir.
  - Seçim alanı `maxHeight: 120`, `flexDirection: 'row'`, `flexWrap: 'wrap'` ve `ScrollView` ile dikey kaydırılabilir olacaktır.

### Adım 4: Cloudflare D1 ve Worker API Entegrasyonu
- `whitedesk_admins` tablosundaki `categories` sütununun güncellemesi:
  - Admin yetki anahtarı üretildiğinde veya atandığında seçilen `categories: string[]` dizi olarak Worker'a iletilir ve D1'e `JSON.stringify(categories)` olarak kaydedilir.
  - Bilet dağıtımında adminin kategorisi ile bilet kategorisi eşleşmesi kontrol edilir.

### Adım 5: DB Temizliği ve Çift Kurucunun Silinmesi
- D1 üzerinde tekil Founder kalması için SQL migration ve temizleme scripti hazırlanacak.
- `whitedesk_admins` tablosundaki sahte/fazlalık kurucular ve test amaçlı açılmış eski `white_id` kalıntıları temizlenecektir.

### Adım 6: Güvenlik Taraması ve `white_id` Temizliği
- Kod tabanında `white_id` kullanımı taranacak, D1 şeması ve Worker kodlarında `blind_id`'nin tekil güvenli kimlik olarak mühürlenmesi sağlanacaktır.

---

## ❓ Soruların Net Yanıtları:

1. **Uygulamaya Kategori Eklemek Gerekli mi?**
   - **Kesinlikle gereksizdir.** Tespitiniz %100 isabetlidir. Uygulama sadece bir istemcidir (web/mobil/SDK). Destek kategorisi işin mantığıyla (Birim/Organizasyon ve Konuyla) ilgilidir. Uygulamaya kategori bağlamak yapay bir karmaşa üretmektedir, bunu tamamen tasfiye ediyoruz.

2. **Tenant'a Bağlı Admine Genel Kategori Nasıl Eklenir?**
   - Kategori oluşturulurken **Birim: Tüm Birimler (`org_id: 'default'` ya da `'all'`)** olarak seçilirse bu kategori firmanın tüm birimlerine hitap eden genel bir kategori olur.
   - Yönetici oluşturulurken de Birim "Tüm Birimler" seçildiğinde ya da kategori çiplerinden bu genel kategori seçilip mühürlendiğinde, o kategoriye açılan tüm biletler doğrudan ilgili admine atanır/havuzuna düşer.

3. **DB'de `white_id` ve `blind_id` Neden Birlikte Var? `white_id` Güvenliği Bozuyor mu?**
   - **Evet, kesinlikle güvenliği sıfırlıyor.** Ham P-256 açık anahtarını (`white_id`) açık metin olarak veritabanında tutmak sıfır-bilgi (Zero-Knowledge) felsefesine aykırıdır. Zaten projenin 7. kuralı açıkça `white_id`'nin hiçbir yerde üretilemeyeceğini ve ağa gönderilemeyeceğini emreder. DB şemasında ve sorgularda kalan bu eski kalıntıları tekil `blind_id` standardına çekip tasfiye edeceğiz.
