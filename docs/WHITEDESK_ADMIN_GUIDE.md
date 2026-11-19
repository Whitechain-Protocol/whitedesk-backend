# WhiteDesk — Yönetici (Admin) Operasyon ve El Kitabı

> **Erişim Sınıfı:** Sadece Yetkili Sistem Yöneticileri (`TheWhite **`, `WhiteCosmos *`, `Admin`)  
> **Gizlilik:** Şirket İçi İdari Doküman — Normal Personel ve Son Kullanıcılara Kapalıdır  
> **Tarih:** Ekim 2026 | Versiyon: 3.0 (Multi-Tenant Sovereign & Zero-Knowledge)

---

## 1. Operasyonel Hiyerarşi (Seviye 0 – 3)

WhiteDesk, kurumsal SaaS ve egemen organizasyon yapılarında tam veri izolasyonunu 4 katmanlı kesin bir hiyerarşiyle yönetir:

```
[ SEVİYE 0: KİRACI (TENANT) ]  →  (Atlas Global Inc., TheWhite Enterprises)
              ↓
[ SEVİYE 1: YÖNETİCİ KADROSU ]  →  (TheWhite **, WhiteCosmos *, Admin, Kullanıcı)
              ↓
[ SEVİYE 2: KURUM / ŞUBE / UYGULAMA (ORG / APP) ]  →  (Merkez, Bölge, WhiteFin, WhitePay)
              ↓
[ SEVİYE 3: KATEGORİ (CATEGORY) ]  →  (Billing, Teknik Destek, Güvenlik, Operasyon)
```

---

### 🏢 Seviye 0: Kiracı (Tenant)
* **Kapsam:** Sisteme bağlanan bağımsız tüzel kişilikleri veya kurumsal müşterileri temsil eder (Örn: *Atlas Global Inc.*).
* **TheWhite Ayrıcalığı:** Seviye 0 kiracı seçici paneli **yalnızca** Genesis'te yaratılan kurucu admin **TheWhite**'ın cihazında ve onun 12 kelimesiyle açıldığında görünür.
* **Normal Admin Ekranı:** Diğer yöneticilerin ve kullanıcıların ekranında Seviye 0 seçici yer almaz; yalnızca bağlı olunan tenant'ın firma adı sabit başlık olarak görünür.
* **TheWhite Technologies:** TheWhite'ın ana holding şirketidir; tüm sistem testleri ve lisans provizyonları bu kiracı altında yürütülür.
* **Felaket Kurtarma İzolasyonu:** Her tenant için `tenants/<Tenant-Slug>/` dizini altında bağımsız `keys.json` ve tüm yapısal tabloları içeren `schema.sql` oluşturulur. Veritabanı çökmesi veya doğal afet durumunda bu tek SQL dosyası çalıştırılarak kiracı sıfırdan ayağa kaldırılır.

---

### 🛡️ Seviye 1: Yönetici & Kullanıcı Hiyerarşisi

#### A) TheWhite — Kurucu Yönetici (`TheWhite, Kurucu, **`)
* **Yetki:** Sistemin kurucusu ve en üst düzey otoritedir.
* **Genesis Üretimi:** `wdrun` ekranında Step 1 (Start Genesis) ile `TheWhite_Enterprises` kiracısı ve Ed25519 anahtarları üretilir.
* **Doğrulama & Sahiplenme:** Bilet mesaj kutusuna `admin <thewhite_whiteid>` veya `admin <tw_founder_hash>` yazıldığında **hiçbir onay gerekmeksizin** anında kurucu unvanını alır.
* **Sınırsız İdari Müdahale:** 
  - Cosmos ve Adminlere uzun basıldığında silme, yetki kapsamını değiştirme veya tenant değiştirme yetkisine sahiptir.
  - Bilet üzerindeki bir kullanıcıya uzun basıldığında onu doğrudan o tenant'ın baş ve tek **WhiteCosmos Global Admini (*)** yapabilir.
  - Cihaz kaybında yeni cihazına kurup tek kullanımlık Founder Hash (`tw_founder_...`) ile anında tekrar TheWhite olur.

#### B) WhiteCosmos — Global Admin (`WhiteCosmos, Global Admin, *`)
* **Yetki:** Her kiracıda (tenant) yalnızca **1 adet** bulunur. Firmanın tepe idari yöneticisidir.
* **Sahiplenme & Onay:**
  - `wdrun` üzerinden Step 2 veya Step 4 ile üretilen anahtar/hash ile bilet kutusuna `admin <tenant_whiteid>` veya `admin <ga_cosmos_hash>` yazar.
  - **Talep kurucu TheWhite'ın bilet onay kuyruğuna düşer.**
  - TheWhite onayladığı anda aday `WhiteCosmos *` olarak mühürlenir.
* **Yetki Alanı:** Kendi kiracısı altındaki adminlere uzun basarak uygulama, şube ve kategori yetkilerini düzenleyebilir veya yöneticileri silebilir.

#### C) Admin — Destek Yöneticileri
* **Yetki:** Gelen biletleri atanmış kategori ve uygulama kapsamına göre cevaplayan departman yöneticileridir.
* **Sahiplenme & Onay:**
  - Global Admin tarafından verilen anahtar/hash ile bilet kutusuna `admin <hash>` yazar.
  - **Talep firmanın Global Admini (WhiteCosmos *)'nin onay kuyruğuna düşer.**
  - Onaylandığında `whitedesk_admins` tablosuna kaydı işlenir.
* **Kullanıcı Yönetimi:** Bilet üzerindeki bir kullanıcıya uzun basarak kullanıcıyı yönetici yapabilir, engelleyebilir veya silebilir.

#### D) Kullanıcılar (Users)
* **Yetki:** İlgili kiracının bilet ve tartışma sistemine dahil olan departman veya şirket personelleridir.
* **Bağlantı & Onay:**
  - Bilet mesaj kutusuna `user <divisional_hash>` veya `user <org_pub>` yazar.
  - **Talep ilgili kiracının adminlerinin onay kuyruğuna düşer.**
  - Onaylandığında personel o tenant ve bölüme güvenli şekilde bağlanır ve E2EE bilet şifreleme anahtarını alır.

---

### 📦 Seviye 2: Kurum / Şube / Uygulama (`Org / App`)
Tenant içerisindeki şirket alt birimlerini, grup şirketlerini veya bağımsız uygulamaları temsil eder (Örn: `Merkez`, `whitefin`, `whitepay`). Farklı teknik destek birimleri biletleri bu kapsamda ayrıştırır.

### 🏷️ Seviye 3: Kategori (`Category`)
Biletlerin idari yönlendirme alanıdır (Örn: `Ses / Arama Hatası`, `Abonelik & Lisans`, `Güvenlik`). Gelen talebin doğru uzman admine iletilmesini sağlar.

---

## 2. wdrun — Web Tabanlı Genesis & Provizyon Paneli

`wdrun`, masaüstü tarayıcısından tek tıkla çalıştırılan, bağımsız, minimalist Swiss-Design bir idari web konsoludur.

### Başlatma:
```bash
npm run wdrun
# Tarayıcıda: http://localhost:3040/wdrun.html
```

### 5 Operasyonel Adım:
1. **Adım 1: Start Genesis:**
   - `TheWhite Enterprises` master kiracısını, Neon DDL tablolarını ve Ed25519 anahtarlarını üretir.
   - `tenants/TheWhite_Enterprises/keys.json` ve `schema.sql` oluşturulur.
   - Genesis bir kez tamamlandıktan sonra bu adım kilitlenir (flu hale gelir).
2. **Adım 2: Create Tenant (Kiracı Oluştur):**
   - Yeni kurumsal kiracı için firma adı, alt şube (Org), uygulama (App) ve kategori setleri girilir.
   - `tenants/<Tenant-Slug>/` altında anahtarlar ve felaket kurtarma `schema.sql` dosyası oluşturulur.
3. **Adım 3: Create TheWhite Founder Hash:**
   - Kurucu TheWhite'ın cihaz kaybı durumunda veritabanı saldırılarına karşı tek kullanımlık, sıfır onaylı kurtarma hash'i (`tw_founder_...`) üretir.
4. **Adım 4: Create Global Admin Hash for a Tenant:**
   - Seçilen tenant için `ga_cosmos_...` formatında tek kullanımlık hash üretir. Aday bunu girdiğinde onay TheWhite'a düşer.
5. **Adım 5: Create Divisional User Hash:**
   - Tenant ve bağlı şube/uygulama seçilerek `usr_div_...` formatında kullanıcı katılım hash'i üretir.

---

## 3. WhiteDesk Arayüzü ve İdari Özellikler

### A) Başlık ve Kimlik Tanımlama ("Kendinizi tanımlayın")
* Başlığın (`WhiteDesk` veya `WhiteDesk Admin`) hemen altında gri bir kurşun kalem (`Edit3`) simgesiyle **"Kendinizi tanımlayın"** alanı yer alır.
* Dokunulduğunda açılan pop-up üzerinden yönetici veya kullanıcı rumuzunu, adını veya unvanını belirler. Bu rumuz biletlerde ve mesajlarda kimlikleyici olarak gösterilir.

### B) "+ Tartışma Başlat" (`+ Start a Discussion`)
* Yöneticiler için normal kullanıcı bilet butonu yerine **`+ Start a Discussion`** (`+ Tartışma Başlat`) butonu görüntülenir.
* Bir yönetici tartışma başlattığında, bu tartışmayı sadece aynı kiracı ve aynı yetki sınırındaki diğer yöneticiler görebilir. Son kullanıcılar yönetici tartışmalarını göremez.

### C) Onay Bildirim Rozeti & Onay Penceresi (`ApprovalsModal`)
* Üst kontrol çubuğunda bekleyen onay sayısı kadar sarı kalkan rozeti görüntülenir.
* Dokunulduğunda açılan pencerede:
  - WhiteCosmos talepleri (TheWhite onayına)
  - Admin talepleri (WhiteCosmos onayına)
  - Kullanıcı bağlama talepleri (Admin onayına)
  tek dokunuşla **[Onayla]** veya **[Reddet]** edilebilir.

### D) Bilet Üzerinde Uzun Basma (Kullanıcı Yönetim Menüsü)
Bilet listesindeki herhangi bir bilet üzerine uzun basıldığında (`delayLongPress: 200ms`):
* **Yönetici Yetkisi Ver (Admin Yap):** Kullanıcıyı admin adayı yapar ve kategori/app seçim paneline yönlendirir.
* **Kiracı Global Admini (WhiteCosmos *) Ata:** *(Yalnızca TheWhite ekranında)* Kullanıcıyı doğrudan firmanın tek Global Admini yapar.
* **Kullanıcıyı Engelle:** Kullanıcının destek masasına erişimini bloke eder.
* **Bileti ve Kullanıcıyı Sil:** Kullanıcı bağlamasını ve destek biletini kalıcı olarak temizler.

### E) Akıcı Minimalist Tasarım ve Işık Kırılması
* Panel yan kenarlara tamamen yaklaştırılmıştır (`paddingHorizontal: 4`).
* Gri panel kontürleri (`borderWidth: 0`) kaldırılmıştır.
* Panellerin arkasında geniş yayılımlı, %4 opaklıkta yumuşak bir ışık kırılması (`shadowRadius: 28`, `shadowOpacity: 0.04`) oluşturulmuştur.
