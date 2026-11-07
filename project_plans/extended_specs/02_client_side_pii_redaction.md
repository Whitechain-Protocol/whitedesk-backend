# WhiteDesk Modülü: Cihazda Otomatik Hassas Veri Maskeleme (Client-Side Zero-Click PII Redaction)

## 1. Modül Özeti ve Amacı
Kullanıcıların destek taleplerine panikle eklediği kredi kartı numaraları, T.C. kimlik numaraları, API gizli anahtarları, şifreler veya kimlik fotokopisi gibi kişisel verilerin (PII) sunucuya veya veri tabanına açık şekilde gitmesini engeller.

İşlem sunucuya veya harici bir yapay zekâ servisine gitmeden önce **tamamen istemcinin kendi cihazında (tarayıcı/mobil Wasm)** yerel regex kuralları ve hafif OCR ile tespit edilir; metinler `****` şeklinde maskelenir, görsellerde ise ilgili alanlar pikselleştirilir/bulanıklaştırılır.

---

## 2. Mimari ve İşleyiş İlkeleri
- **Sıfır Tıklama (Zero-Click):** Kullanıcının ekstra bir butona basması gerekmez; metin yazılırken veya dosya seçildiği anda otomatik çalışır.
- **Yerel İnceleme (On-Device Wasm):** Metin için yerel regex motoru, görseller için tarayıcı içi çalışan hafif Wasm tabanlı OCR ve desen tanıyıcı kullanılır.
- **Kullanıcı Bilgilendirmesi:** Maskelenen alanlar arayüzde açıkça gösterilir ve kullanıcının güven hissi pekiştirilir ("Hassas bilgileriniz cihazınızda koruma altına alındı").

---

## 3. IDE Agent Görev Promptu

```markdown
# GÖREV BİLDİRİMİ: WhiteDesk Cihazda Otomatik Hassas Veri Maskeleme (PII Redaction)

Sen WhiteDesk platformunun istemci güvenliği ve KVKK/GDPR uyum katmanını kuran kıdemli güvenlik mühendisisin.
Kullanıcıların bilet yazarken veya dosya yüklerken istemci cihazından dışarı hiçbir hassas veri çıkarmamasını garanti eden PII maskeleme motorunu kodlayacaksın.

### 1. İstemci Metin Maskeleme Servisi (`pii-sanitizer.ts`)
- Regex kurallarıyla metin içi desen taraması yap:
  - Kredi Kartı / Banka Kartı (Luhn algoritması kontrolüyle 16 haneli kartlar -> `**** **** **** 1234`)
  - T.C. Kimlik Numarası (11 haneli matematiksel algoritma kontrolü -> `***********`)
  - IBAN Numaraları (`TR** **** **** **** **** **** **`)
  - E-posta ve Telefon Numaraları (isteğe bağlı kural)
  - Gizli Anahtarlar (JWT token, AWS/Stripe secret key regex desenleri)
- Kullanıcı formu gönder butonuna bastığında veya metin değiştiğinde tespit edilen desenleri doğrudan istemcide maskele.

### 2. Görsel Ön İşleme ve Maskeleme (Image Blur/Redact)
- Kullanıcı ekran görüntüsü veya görsel yüklediğinde Canvas API / OffscreenCanvas kullanarak görseli yerel belleğe al.
- Görsel üzerindeki kredi kartı veya kimlik kutuları tespit edildiğinde ilgili koordinatları siyah dikdörtgen veya Gauss bulanıklığı ile kapat.
- Dışarıya yalnızca maskelenmiş görsel blob'unun çıkmasını sağla.

### 3. Kullanıcı Arayüzü Bildirimi
- Maskeleme yapıldığında formun altında bilgilendirme rozeti göster:
  - Rozet Metni: "🛡️ Hassas bilgileriniz (kart/kimlik) cihazınızda otomatik olarak koruma altına alındı."
- Arayüz dili Microsoft Türkçe Bilişim Standartları ile uyumlu olmalıdır.
```
