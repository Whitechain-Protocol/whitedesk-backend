# WhiteDesk Modülü: Görsel İçermeyen Durum Simülatörü (One-Click Instant Replay Sandbox)

## 1. Modül Özeti ve Amacı
Kullanıcıların yaşadığı arayüz ve akış hatalarını teşhis etmek için ekran görüntüsü veya ağır video kaydı isteme ihtiyacını ortadan kaldırır. 

Bilet açıldığı anda son 30 saniyelik durum değişikliklerini (UI State Delta / Action Stream) ve eylem zincirini istemci tarafında şifreli olarak toplar. Yönetici panelinde kişisel verilerden (PII) arındırılmış bu durum geçmişi, interaktif bir zaman çubuğu (Timeline Slider) ile adım adım ileri/geri sarılarak sanal bir simülatör ekranında canlandırılır.

---

## 2. Mimari ve İşleyiş İlkeleri
- **Sıfır Video / Sıfır Piksel (Piksel Bağımsız Takip):** Ekran video akışı olarak kaydedilmez; yalnızca Redux/Zustand durum eylemleri ve durum farkları (diffs) saklanır.
- **Kişisel Veri (PII) Arındırma:** Şifreler, kredi kartları, kimlik numaraları ve gizli tokenlar istemci belleğindeki döngüsel tampona (circular buffer) girmeden önce otomatik maskelenir.
- **Kriptografik Mühür:** Toplanan durum paketi (`StateReplayBundle`), biletin yetkili yöneticisinin açık anahtarı (`Recipient_PublicKey`) ile istemcide şifrelenir.
- **Çevrimdışı Simülasyon (Embedded Virtual Sandbox):** Yönetici bilet ekranında çevrimdışı durum ağacını inceler, hataya neden olan eylemi ve API yanıtını zaman çizelgesinde anında tespit eder.

---

## 3. IDE Agent Görev Promptu

```markdown
# GÖREV BİLDİRİMİ: WhiteDesk Görsel İçermeyen Durum Simülatörü (One-Click Instant Replay Sandbox)

Sen WhiteDesk platformunun reaktif durum izleme, istemci SDK motoru ve hata canlandırma (Sandbox Replay) mimarisini kuran kıdemli yazılım mimarısın. 
Aşağıdaki şartnameye göre son 30 saniyelik kullanıcı eylem akışını ve durum farklarını yakalayıp yönetici panelinde interaktif zaman çizelgesiyle canlandıran modülü geliştireceksin.

### 1. İstemci Durum Takip Servisi (`replay-recorder.ts`)
- Uygulama durum yönetim motoruna (Redux/Zustand) kanca (middleware/subscriber) bağla.
- Son 30 eylemi döngüsel bellek tamponunda (circular buffer) tut.
- Hassas anahtarları (`password`, `cardNumber`, `cvv`, `token`, `secret`, `identityNo`) otomatik maskele.
- Bilet oluşturulduğunda bu paketi yöneticinin açık anahtarıyla şifrele.

### 2. Yönetici Paneli Canlandırma Bileşeni (`ReplaySandboxViewer.tsx`)
- Bilet detayında "Hata Canlandırma Simülatörü" sekmesi sun.
- Zaman çizelgesi kaydırıcısı (`Timeline Slider`), Oynat/Duraklat ve Adım İleri/Geri kontrolleri ekle.
- Hatanın patladığı ana tek tıkla odaklanan "Hata Anına Git" kestirmesi sağla.
- Sanal arayüz önizlemesi üzerinde aktif rotayı ve değişen durum parametrelerini göster.

### 3. Dil Kuralları (Microsoft Kurumsal Türkçe)
- Başlık: "Hata Canlandırma Simülatörü"
- Zaman Çizelgesi: "Zaman Çizelgesi"
- Oynat / Duraklat: "Oynat" / "Duraklat"
- Hata Kestirmesi: "Hata Anına Git"
```
