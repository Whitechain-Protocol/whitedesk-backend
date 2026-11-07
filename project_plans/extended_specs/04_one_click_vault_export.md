# WhiteDesk Modülü: Tek Tıkla Bağımsız Kurumsal Kasa (One-Click Cryptographic Vault Export)

## 1. Modül Özeti ve Amacı
Geleneksel bulut masalarının müşterileri içeride tutmak için bilet verilerini dışa aktarmayı zorlaştırma (Vendor Lock-in) taktiğini yıkar.

Kuruluş yöneticisi (WhiteCosmos), dilediği an tek bir düğmeye basarak kuruluşun geçmiş tüm biletlerini, çözümlerini, müşteri puanlarını ve denetim kayıtlarını tek bir bağımsız, şifreli **SQLite / JSON Kriptografik Kasa (.vault)** dosyası olarak bilgisayarına indirir.

---

## 2. Mimari ve İşleyiş İlkeleri
- **Bağımsız Çalışabilirlik (Self-Contained):** İndirilen kasa dosyası tek başına bir SQLite veritabanıdır. İnternet kopsa veya WhiteDesk sunucuları kapansa dahi yerel bir masaüstü aracıyla açılıp aranabilir.
- **Kök Anahtar Şifrelemesi:** Dosya, yalnızca kuruluşun 12 kelimelik kurtarma ifadesinden (`Master Seed`) türetilen anahtarla açılabilir.
- **Sıfır Sunucu Bağımlılığı:** Dışa aktarma işlemi sunucunun insafına kalmaz; yöneticinin cihazındaki yerel veritabanı veya R2 hasat ambarı doğrudan tek bir arşiv haline getirilir.

---

## 3. IDE Agent Görev Promptu

```markdown
# GÖREV BİLDİRİMİ: WhiteDesk Bağımsız Kurumsal Kasa Dışa Aktarma Modülü

Sen WhiteDesk platformunun veri egemenliği ve çevrimdışı arşivleme motorunu geliştiren kıdemli sistem mimarısın.
Kuruluş yöneticilerinin tüm bilet geçmişini tek tıkla şifreli, bağımsız ve taşınabilir bir kasa dosyası olarak dışa aktarmasını sağlayacaksın.

### 1. Kasa Paketleme Servisi (`vault-exporter.ts`)
- Kuruluşun yerel veya hasat edilmiş veritabanındaki tüm tabloları (`tickets`, `messages`, `ratings`, `merkle_receipts`) sorgula.
- Verileri tek bir SQLite veritabanı şemasına (`whitedesk_vault.db`) dönüştür.
- İstemci tarafında SQLite oluşturmak için `sql.js` veya mobil/masaüstü yerel SQLite köprülerini kullan.

### 2. Kriptografik Mühürleme
- Oluşturulan SQLite dosya akışını, yöneticinin 12 kelimelik tohumundan türetilen anahtarla AES-256-GCM kullanarak şifrele.
- Dosya uzantısını `.wdvault` olarak adlandır.
- Dosya başlığına (Header) bir tuz (salt), başlatma vektörü (IV) ve format sürüm numarası ekle.

### 3. Kullanıcı Arayüzü (`Ayarlar > Veri ve Arşiv`)
- Ekran Başlığı: "Bağımsız Kurumsal Kasa Dışa Aktarma"
- Açıklama: "Tüm bilet ve operasyon geçmişinizi internetten bağımsız, şifreli tek bir dosya olarak bilgisayarınıza indirin."
- Birincil Buton: "Kurumsal Kasayı İndir (.wdvault)"
- Geri Yükleme / İnceleme: Kullanıcının daha önce indirdiği bir `.wdvault` dosyasını seçip 12 kelimesiyle çevrimdışı olarak arayabileceği bir "Kasa Görüntüleyici" sekmesi oluştur.

### 4. Dil Kuralları (Microsoft Kurumsal Türkçe)
- "Veri Egemenliği ve Arşiv Yönetimi"
- "Kasa Başarıyla İndirildi (Boyut: 42 MB, 1.250 Talep)"
- "Bu dosya yalnızca kuruluş kurtarma ifadenizle açılabilir."
```
