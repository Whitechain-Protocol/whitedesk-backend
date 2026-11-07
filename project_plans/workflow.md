# 📋 WhiteDesk Geliştirme Yol Haritası & İş Akışı (workflow.md)

---

## 🎯 1. Mevcut Odak: Onboarding & Self-Service Karşılama Akışı (Aktif)
* [x] Logolar ve ikon setinin kurallara bağlanması (yalnızca splash ve sistem launcher'da kullanım).
* [x] Fiyatlandırma stratejisi, 14 gün deneme ve detaylı rakip analizi (`pricing.md`).
* [x] Neon veritabanı provizyonu (`createSelfServiceTenant`) ve otomatik silinen (auto-purge) hash döngüsü.
* [ ] **WelcomeScreen (Açılış):**
  * Sunucusuz, sıfır-bilgi ve lokal şifreleme tanıtımı.
  * İki net buton (parantezsiz): **[ Kullanıcıyım ]** ve **[ Servis sağlayıcıyım ]**.
* [ ] **UserGuideScreen:**
  * Kullanıcıya `user [hash]` bağlanma rehberi.
  * 12 kelimelik güvenlik anahtarı oluşturma yönlendirmesi.
* [ ] **TenantSetupScreen:**
  * Tek alanlı form: Sadece **Kurum Adı**.
  * 14 günlük deneme kapsamında 3 hash üretimi (Global Admin, Admin, User).
  * Kopyalanabilir 3 kutu + Tek tıkla `.txt` dosya indirme/paylaşma (`whitedesk_tenant_keys.txt`).
* [ ] **Navigasyon Bağlantısı (`App.tsx`):**
  * Yeni kullanıcılarda `WelcomeScreen` ile başlatma.

---

## 🛡️ 2. İletişim Hiyerarşisi & Özel Fısıltı Mimarisi (Kabul Edildi)
* **Seviye 1 (Müşteri Yanıtı):** Operatör ↔ Müşteri (Resmi genel bilet).
* **Seviye 2 (Masa İçi Not / Discussion):** Admin ↔ Tüm Operatörler (Müşteri asla göremez).
* **Seviye 3 (İki Admin Arası Fısıltı - `@[rumuz]`):** Admin A ↔ Admin B. Mesaj `@[rumuz]` ile başladığında **masadaki diğer tüm operatörlere de kilitlenir**; sadece hedef adminin açık anahtarıyla (`pub_key`) okunabilir.

---

## ⚡ 3. Taslaklar & Makrolar (Canned Responses) (Faz 2)
* **Metin Seçme (Highlight to Template):**
  * Admin biletteki bir metni taradığında açılan menü: `[ Kopyala ]  [ ⚡ Taslaklara Ekle ]  [ Sil ]`.
  * `Taslaklara Ekle` dendiğinde kısayol adı (shortcut) ve başlık atanır.
* **Çağırma Yöntemleri (Hibrit Model):**
  * **1. Slash Komutu (`/`):** Mesaj kutusuna `/` yazıldığında autocomplete popover.
  * **2. Hızlı Eylem Butonu (`⚡`):** Mesaj kutusu yanındaki butonla alt menüden (BottomSheet) seçim.
* **Depolama Senkronizasyonu:**
  * Lokalde: `SafeSecureStore` (milisaniyelik çevrimdışı erişim).
  * Neon DB: `whitedesk_admins.templates JSONB DEFAULT '[]'` (cihaz değişiminde anında geri yükleme).

---

## 📞 4. P2P WebRTC & Cloudflare TURN Sesli İletişim (Faz 2)
* ** ağır C++ kütüphaneleri yerine hafif, saf P2P WebRTC mimarisi kullanılacak.
* **NAT / Güvenlik Duvarı:** Cloudflare Calls / TURN servisi (dünya genelinde 300+ Anycast noktası, sıfır sunucu bakımı).
* **El Sıkışma (Signaling):** 
  * Sunucusuz Neon DB geçici tablosu (`whitedesk_signaling` - arama başlayınca `DELETE` edilen) VEYA Cloudflare Workers WebSocket geçidi üzerinden 100ms'de el sıkışma.

---

## 👤 5. Profil ve Ayarlar Masası (Profile & Settings Roadmap)
*Not: Onboarding arayüzü görsel olarak tamamlanıp onaylandıktan sonra ele alınacaktır.*
* Konum: `HelpDeskScreen` sağ üst header ikonu (User / Settings).
* Kapsam:
  * Kullanıcı görünümü: WhiteID, bağlı kurum, kurtarma durumu, dil.
  * Global Admin görünümü: Kurum adı, 14 gün deneme sayacı, aktif koltuk/kullanıcı kotaları, StoreKit abonelik paketleri ($19/$49/$149) ve tek tıkla ilave hash satın alma.

##  6. Ana ekran Tasarımı:  Ana ekrandaki bilet kartları kenar çizgisiz, kontürsüz ve gölgesiz ve arkla planları açık gri renkte (#f8fafc) olacaktır.  Bu özellik yalnızca bilet kartlarına uygulanacaktır. Diğer öğelerin ise durumları tespit edilip bir daha değiştirilmemek üzere stateleri kilitlenecektir.
