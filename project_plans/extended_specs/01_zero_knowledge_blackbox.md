# WhiteDesk Modülü: Sıfır-Bilgi Hata Karatahtası (Zero-Knowledge BlackBox)

## 1. Modül Özeti ve Amacı
Destek süreçlerinde kullanıcıların yaşadığı teknik aksaklıkları bildirmesi sırasında yaşanan "ekran görüntüsü isteme", "konsol logu sorma", "cihaz/tarayıcı bilgisi toplama" gibi zaman alıcı ve sürtünmeli adımları tamamen ortadan kaldırır. 

Uygulama çöktüğünde veya kullanıcı bilet açtığında; son 30-60 saniyelik konsol logları, ağ durum kodları (hassas yükler hariç), cihaz bellek/CPU metrikleri ve hata yığını (stack trace) doğrudan istemci cihazında toplanır, yetkili yöneticinin açık anahtarı (`Admin_PublicKey`) ile asimetrik olarak mühürlenir ve bilete iliştirilir.

---

## 2. Mimari ve İşleyiş İlkeleri
- **İstemci Tarafı Döngüsel Arabellek (Circular Buffer):** SDK, bellek üzerinde sabit boyutlu (örn. son 50 log satırı veya 100 KB) bir döngüsel tamponda logları tutar.
- **Sıfır-Bilgi Mühürleme:** Loglar sunucuya açık metin olarak gitmez. Yalnızca ilgili biletin hedef yöneticisinin açık anahtarı ile şifrelenir (X25519 / AES-256-GCM).
- **Hassas Veri Filtreleme:** Ağ isteklerinin başlıkları (Authorization, Cookie vb.) ve gövdeleri (Body/Payload) arabelleğe girmeden önce istemcide filtrelenir; yalnızca URL, method, status code ve response time saklanır.

---

## 3. IDE Agent Görev Promptu

```markdown
# GÖREV BİLDİRİMİ: WhiteDesk Zero-Knowledge BlackBox Modülü

Sen WhiteDesk platformunun istemci SDK ve hata teşhis altyapısını geliştiren kıdemli yazılım mimarısın.
Aşağıdaki şartnameye göre WhiteDesk istemci kütüphanesine (SDK) gömülü çalışan ve yöneticiye sıfır-bilgi prensibiyle hata teşhisi sağlayan BlackBox modülünü geliştireceksin.

### 1. SDK İstemci Katmanı (BlackBox Collector)
- `BlackBoxRecorder` adında bir sınıf/servis oluştur.
- Tarayıcı ve mobil ortamlarda `console.error`, `console.warn`, yakalanmamış hatalar (`window.onerror` / `unhandledrejection`) ve `fetch`/`XMLHttpRequest` durumlarını izleyen bir dinleyici kur.
- Son 30 saniyelik veya en fazla 50 kaydı saklayan döngüsel bellek tamponu (in-memory circular buffer) işlet.
- Hassas ağ başlıklarını (`Authorization`, `Cookie`, `Set-Cookie`) ve istek/yanıt gövdelerini (body) kesinlikle filtreleyerek dışarıda bırak; yalnızca HTTP Metodu, URL Yolu, Durum Kodu ve Süre (ms) sakla.

### 2. Kriptografik Paketleme
- Bilet oluşturma anında `blackbox.export()` çağrılır.
- Toplanan tanı verileri JSON formatında bir araya getirilir.
- Paket, biletin atanacağı kuruluş/yönetici biriminin açık anahtarı (`Recipient_PublicKey`) ile cihazda şifrelenir (`encrypted_diagnostics`).

### 3. Yönetici Paneli Görüntüleyici Bileşeni
- Yönetici bilet detayını açtığında, şifreli tanı paketini kendi özel anahtarıyla çözer.
- Bilet ekranında "Sistem ve Hata Tanısı (BlackBox)" adında daraltılabilir bir panel sun.
- Hata yığını (stack trace), cihaz bilgisi ve ağ akışını zaman çizelgesi (timeline) formatında net ve anlaşılır göster.

### 4. Dil Kuralları (Microsoft Kurumsal Türkçe)
- Bileşen başlığı: "Sistem ve Hata Tanısı"
- Alt başlık: "İstemci tarafında şifrelenmiş otomatik hata kaydı"
- Buton: "Tanı Kayıtlarını İncele"
```
