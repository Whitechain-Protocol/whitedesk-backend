# WhiteDesk 10 Maddelik Mimari, Güvenlik ve Arayüz Revizyon Planı

Bu plan, kullanıcının `/grill-me` mülakatında kesinleştirdiği kararlar doğrultusunda WhiteDesk sisteminin 10 maddelik kapsamlı revizyon adımlarını belirler.

---

## 1. Ana Ekran 3 Buton Standardı (Mavi, Mor, Yeşil) & TheWhite Gizleme Kuralı
* **Yeni Standart:** Uzun basma kafa karışıklıklarını ve renk karmaşasını önlemek için 3 sabit fonksiyonel buton belirlenmiştir:
  1. **Mavi Buton (`#3B82F6`):** "Yeni bir bilet oluştur" (Sağında `ArrowUp` yukarı ok). Kullanıcı, Admin ve Global Admin'de bulunur; **TheWhite'ta kesinlikle gizlidir** (üst makam yoktur).
  2. **Mor Buton (`#7C3AED`):** "Bir tartışma başlat". Yöneticilerde (Admin, Global Admin, Kurucu) bulunur. Kurucu ve Global Admin'de `ArrowDown` (aşağı ok); Bölüm Adminlerinde `ArrowRight` (sağa yatay ok) + `ArrowUp` (yukarı ok) yer alır.
  3. **Yeşil Buton (`#16A34A`):** "Bir telsiz yayını başlat". Lisanslandığında herkeste bulunur; **oksuzdur** ve solunda `Radio` ikonu yer alır.
* *Detaylı şartname için bkz:* [ticket_hierarchy_and_roles.md](./ticket_hierarchy_and_roles.md)
* **Hedef Dosya:** `src/components/helpdesk/views/TicketListView.tsx`, `src/screens/HelpDeskScreen.tsx`.

---

## 2. Provizyon Konsolunda Çoklu Firma Seçici & Whitechain PTT Entegrasyonu
* **Mevcut Durum:** `ProvisioningConsoleModal.tsx` içindeki "Firma" satırı yalnızca tek bir statik kart olarak aktif kuruluşu gösteriyor.
* **Revizyon:** 
  - `isFounder` (TheWhite) oturumunda "Firma" satırı, veritabanındaki tüm kiracıların (`whitedesk_enterprises`) yatay kaydırılabilir (`ScrollView horizontal`) çipleri olarak render edilecek.
  - TheWhite buradan örneğin `whitechain` seçtiğinde aktif tenant scope'u Whitechain'e geçecek.
  - Böylece TheWhite, PTT başlattığında oda adı `whitedesk_ptt_org_whitechain_global` olacak ve Whitechain tenant'ındaki Samsung tablet ile aynı ses ağına canlı bağlanacaktır.
* **Hedef Dosya:** `src/components/ProvisioningConsoleModal.tsx`, `src/screens/HelpDeskScreen.tsx`.

---

## 3. Yetki Lisans Hash Modalı QR Kod Entegrasyonu
* **Mevcut Durum:** `ProvisioningHashModal.tsx` sadece metin ve hash kutusu içeriyor.
* **Revizyon:**
  - Projede halihazırda kurulu olan `react-native-qrcode-svg` kullanılarak hash kutusunun hemen üzerine estetik, beyaz zeminli ve köşe yuvarlatmalı bir **SVG QR Kod** kartı eklenecek.
  - Kod içeriği doğrudan lisans hash'ini barındıracak.
  - Uygulamanın sağ üstündeki kamera ikonu ile QR okutulduğunda yetki otomatik tanımlanacak; ileride geliştirilecek masaüstü (Desktop / .exe) oturum açma süreci için de tam uyumlu çalışacak.
* **Hedef Dosya:** `src/components/ProvisioningHashModal.tsx`.

---

## 4. Çoklu Ekler & Akıllı WhatsApp Tarzı Yerleşim Mimarisi
* **Mevcut Durum:** Veritabanındaki `attachment_data`, `attachment_name`, `attachment_type` sütunları tekil string tuttuğu için birden fazla dosya eklense bile yalnızca ilki kaydediliyordu.
* **Revizyon:**
  - `helpDeskService.ts` içinde çoklu ekler `attachment_data` sütununa JSON dizisi olarak (`[{ data, name, type }]`) serialize edilecek; geriye dönük tekil eklerle de %100 uyumlu çalışacak.
  - **Sohbet İçinde:** Resimler sohbet penceresinde devasa açık resim olarak yer kaplamayacak; temiz, küçük ek rozetleri/hapları olarak duracak. Tıklandığında tam ekran önizleme açılacak.
  - **Bilet Detay Ekranında:** Çoklu ekler yan yana dizilecek, ekran genişliğini aştığında alt satıra geçecek (`flexDirection: 'row', flexWrap: 'wrap'`).
  - **Ana Ekran Bilet Kartında (`TicketCard.tsx`):** Tarih satırının altında tek bir satırda yatay kaydırılabilir (`horizontal ScrollView`) olarak sıralanacak.
* **Hedef Dosyalar:** `src/services/helpDeskService.ts`, `src/components/helpdesk/views/TicketDetailView.tsx`, `src/components/helpdesk/views/TicketCard.tsx`, `src/screens/HelpDeskScreen.tsx`.

---

## 5. Gelişmiş Ayarlar Arama/PTT Kuralı & Zero-Knowledge Kapalı Bildirimi
* **Mevcut Hata:** Gelişmiş Ayarlar'da Arama ve Bas-Konuş kapalı olsa dahi admin ekranında arama ve PTT butonları görünüyordu.
* **Revizyon - Görünürlük:** Butonlar `advancedFeaturesConfig.isPttEnabled` ve `advancedFeaturesConfig.isLiveCallEnabled` bayraklarına bağlanacak; kapalıysa admin ekranında da gizlenecek.
* **Revizyon - Zero-Knowledge Aranma Tercihi:**
  - Kullanıcı kaydı Neon'da kesinlikle tutulmaz; kullanıcının 3-nokta menüsündeki arama izni tercihi cihazın yerel `SecureStore` katmanında saklanır.
  - Bir admin sesli arama veya bas-konuş başlattığında, hedef cihaz gelen sinyali aldığında yerel `SecureStore` değerini denetler.
  - Eğer kullanıcı aramayı kapalı tutuyorsa, cihaz zil dahi çalmadan anında sinyal sunucusuna `reject` ile birlikte `reason: 'call_disabled_by_user'` bayrağı döner.
  - Arayan admin tarafında *"Kullanıcının arama / bas-konuş özelliği kapalı durumda"* şeklinde kibar ve profesyonel bir uyarı gösterilip çağrı temizlenir.
* **Hedef Dosyalar:** `src/screens/HelpDeskScreen.tsx`, `src/services/voiceCallService.ts`, `src/components/helpdesk/views/TicketDetailView.tsx`.

---

## 6. Bilet Detayı İsimlendirme Standartları
* **Mevcut Durum:** Admin tarafında kullanıcının kör ID'sinin ilk 6 hanesi gösteriliyordu.
* **Revizyon:**
  - **Kullanıcı Ekranında:** Kendi mesajlarında `"Ben"`, yönetici mesajlarında ise `"Admin"` (eğer yönetici kendini tanımla kısmında isim yazmışsa o isim) yazacak.
  - **Admin Ekranında:** Kendi mesajlarında `"Ben"`, kullanıcı mesajlarında ise `"Kullanıcı"` (eğer kullanıcı kendini tanımla kısmında isim yazmışsa o isim) yazacak. Kör ID asla gösterilmeyecek.
* **Hedef Dosya:** `src/components/helpdesk/views/TicketDetailView.tsx`.

---

## 7. Kendini İmha Eden Talepler: Dinamik Süre & Kalan Süre Rozeti
* **Mevcut Durum:** Bildirim ve arayüzlerde sabit "72 saat" ifadesi geçiyor ve yeşil yaprak altında kalan süre görünmüyor.
* **Revizyon:**
  - Sabit "72 saat" ifadeleri kaldırılarak sistemdeki `retentionAfterResolvedHours` (24s / 72s / 7g) ayarına dinamik bağlanacak.
  - Kullanıcı kararı doğrultusunda: Özellik Gelişmiş Ayarlar'dan kapatılsa bile daha önce başlamış imha sayaçları tamamlanana kadar işleyecek, sadece yeni biletler imhaya girmeyecek.
  - Bilet kartında yeşil yaprağın altına kalan süreyi belirten minik yeşil bir rozet (`2 s`, `1 g`, `3 g`) eklenecek.
* **Hedef Dosyalar:** `src/services/helpDeskService.ts`, `src/components/helpdesk/views/TicketCard.tsx`, `src/screens/HelpDeskScreen.tsx`.

---

## 8. Admin Değerlendirme (CSAT) Süreci Durum Raporu
* **Çalışma Durumu:** Aktif ve çalışır durumda.
* **İşleyiş Arayüzü:** 
  - Yönetici bileti çözdüğünde (`resolved` / `closed`), kullanıcı tarafında `TicketFeedbackDialog` açılır.
  - Kullanıcı 1-5 yıldız ve opsiyonel not ile değerlendirme yapar.
  - Puanlar Neon'daki `whitedesk_ticket_ratings` tablosuna ve bilet meta verisine yazılır.
  - Yöneticiler 3-nokta menüsünden `AdminRatingsOverviewModal` konsolunu açarak ortalama CSAT puanını, çözülen bilet oranlarını ve derecelendirme dağılımını grafiksel olarak izleyebilir.

---

## 9. Tırmanan Talepler ve Değişmezlik İspatı (Proof of Integrity) Durum Raporu
* **Tırmanan Talepler (Escalation):** 
  - Adminler arası eskalasyon bilet oluştururken `supportTicketTarget` ('thewhite' veya 'global_admin') parametresiyle çalışır.
  - `HelpDeskScreen.tsx` içindeki SLA kontrol döngüsü, yanıtsız kalan biletleri otomatik olarak bir üst kademeye tırmandırır.
* **Değişmezlik İspatı (Proof of Integrity):**
  - Aktif durumda. Bilet kapatıldığında `CryptoService.generateProofOfIntegrityReceipt` fonksiyonu çağrılarak biletin tüm geçmişi, mesaj hash'leri ve zaman damgaları SHA-256 ile mühürlenir.
  - Kullanıcı ve yönetici bu mühürlü kriptografik `.json` makbuzunu cihazına indirebilir veya paylaşabilir.

---

## 10. TheWhite Kök Mimari Tasarımı (Onaylanan Model)
* TheWhite, sistemin kök egemen otoritesidir (`isFounder`).
* Sistem tamamen sıfır veritabanıyla kurulduğunda `initDatabase` ilk olarak `TheWhite Enterprises` kaydını oluşturur.
* TheWhite, bağımsız bir üst otorite olarak Provizyon konsolundan dilediği tenant'a geçiş yapabilir; geçiş yaptığı firmanın da en üst yetkilisi olarak davranır, o firmanın biletlerini ve telsiz ağını yönetebilir.
