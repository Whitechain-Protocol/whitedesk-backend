# WhiteDesk Modülü: Bilet İçi Kör Canlı Yardım (Ephemeral Blind Co-Browsing)

## 1. Modül Özeti ve Amacı
Kullanıcının karşılaştığı bir sorunu yöneticiye göstermesi için TeamViewer, AnyDesk kurdurma veya Zoom/Meet ekran paylaşımı açtırma ihtiyacını tamamen ortadan kaldırır.

Bilet ekranı içine gömülü olarak çalışan WebRTC veri kanalı üzerinden, kullanıcının yalnızca ilgili web/mobil ekranındaki DOM ve durum (state) değişiklikleri admine canlı aktarılır. Kullanıcının masaüstü, açık diğer sekmeleri veya gelen kişisel bildirimleri kesinlikle admine yansımaz.

---

## 2. Mimari ve İşleyiş İlkeleri
- **Sıfır Video Akışı (No Video Stream):** Görüntü piksel olarak iletilmez; yalnızca uygulamanın DOM ağacı ve scroll/tıklama durumları şifreli WebRTC DataChannel üzerinden senkronize edilir (`rrweb` / DOM Mutation tarzı).
- **Kör Alanlar (Input Blackout):** Kullanıcının şifre, kart veya kişisel bilgi girdiği form elemanları yönetici tarafında tamamen siyah kutu olarak görünür; tuş vuruşları aktarılmaz.
- **Lazer İşaretçi (Virtual Laser Pointer):** Yönetici kendi ekranından bir butona tıkladığında veya fareyi gezdirdiğinde, kullanıcının ekranında kırmızı bir lazer noktası belirerek yönlendirme sağlar.

---

## 3. IDE Agent Görev Promptu

```markdown
# GÖREV BİLDİRİMİ: WhiteDesk Ephemeral Blind Co-Browsing (Canlı Eş-Gezinme)

Sen WhiteDesk platformunun gerçek zamanlı WebRTC ve eş-gezinme (co-browsing) altyapısını kuran kıdemli yazılım mimarısın.
Kullanıcı ile yönetici arasında sıfır üçüncü parti yazılım kurulumuyla çalışan, kör ve güvenli bir canlı yardım oturumu geliştireceksin.

### 1. WebRTC DataChannel Oturum Yönetimi
- Bilet içinde iki taraf arasında WebRTC doğrudan P2P bağlantısı (fallback olarak Cloudflare TURN) üzerinden bir `RTCDataChannel` aç.
- Yalnızca iki tarafın karşılıklı onayı ile oturum başlatılsın:
  - Yönetici "Canlı Yardım Teklif Et" butonu ile istek fırlatır.
  - Kullanıcı "Kabul Et" diyene kadar hiçbir veri iletilmez.

### 2. DOM Senkronizasyonu ve Maskeleme Katmanı
- İstemci tarafında ekranın DOM mutasyonlarını yakala (MutationObserver).
- Hassas alanları otomatik maskele:
  - `input[type="password"]`, `[data-private]`, kredi kartı ve isim kutuları yöneticiye iletilirken `type="masked"` olarak değiştirilsin ve içeriği `••••••` yapılsın.
- Yöneticinin ekranında iframe veya sanal DOM içinde kullanıcının o anki görünümünü oluştur.

### 3. İnteraktif İşaretçi (Virtual Laser Pointer)
- Yöneticinin fare koordinatları normalize edilerek (0-1 aralığında X/Y) veri kanalı üzerinden iletilsin.
- Kullanıcının ekranında "Destek Temsilcisinin İşaretçisi" adında yumuşak animasyonlu bir gösterge render edilsin.
- Oturum sonlandırıldığında WebRTC bağlantısı kapatılsın ve bellekteki tüm DOM geçmişi temizlensin.

### 4. Dil Kuralları (Microsoft Kurumsal Türkçe)
- Eylem butonu: "Canlı Eşlik Başlat (Co-Browsing)"
- Onay istemi: "Yönetici ekranınızda rehberlik etmek için eşlik isteği gönderdi. Onaylıyor musunuz?"
- Oturum rozeti: "🟢 Canlı Eşlik Aktif (Kişisel verileriniz maskelenmektedir)"
```
