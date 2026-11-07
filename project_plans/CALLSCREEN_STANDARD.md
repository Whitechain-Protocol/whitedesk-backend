# WhiteDesk CallScreen Standart Tasarım ve Mimari Spesifikasyonu (Tescilli)

Bu doküman, WhiteDesk sisteminde sesli görüşme (P2P/WebRTC) modülünün **resmi ve tescilli CallScreen standardıdır**. Gelecek tüm geliştirmelerde bu UI/UX ve güvenlik kurallarına harfiyen bağlı kalınacaktır.

---

## 1. Genel Tasarım Dili & Yerleşim (Samsung One UI Frosted Glass)
* **Ekran Kapsamı:** Ekranın alt **%48 - 50**'sini kaplayan yarı saydam alttan açılan (bottom sheet) cam container (`CallScreenModal.tsx`).
* **Zemin Dokusu:** 
  - `BlurView` buzlu cam efekti (`intensity: 70`, `tint: 'dark'`).
  - WhiteDesk kurumsal laciverti (`rgba(2, 34, 73, 0.45)`).
  - Üstte 1.5px yarı saydam cam refleks çizgisi (`rgba(255, 255, 255, 0.40)`).
  - Üst köşeler: `borderTopLeftRadius: 36`, `borderTopRightRadius: 36`.

---

## 2. Zero Personal Data & Mahremiyet Hiyerarşisi
1. **Tepe Rozeti (Crypto Badge):**
   - `[ 🔒 Uçtan uca şifreli - P2P ]` (veya röle devredeyse `TURN Röle`).
   - `#6EE7B7` zümrüt yeşili ikon ve transparan zümrüt zemin.
2. **Başlık Alanı:**
   - Asla avatar/profil resmi kullanılmaz.
   - "Bilet" kelimesi yazılmaz.
   - **Kullanıcı Ekranında Karşı Taraf:** Daima `Admin`.
   - **Admin Ekranında Karşı Taraf:** Kullanıcı eğer kendisini özel bir rumuzla tanıtmışsa o rumuz; aksi halde ilk 5 ve son 5 hanesi açık kör ID (örn: `33543...454535`).
3. **Durum Metni:**
   - Yalnızca `Gelen arama`, `Giden arama` veya görüşme bağlandığında süre (`00:42`) + 5 barlı canlı minimal dalga görselleştirici (`#38BDF8`).

---

## 3. Doğrudan Zeminde 4 Düz Kontrol İkonu (`flatUtilityRow`)
Durum metni ile alt arama butonları arasına yerleştirilmiş, **çerçevesiz, arka plansız ve kutusuz** düz zemin ikonları:
1. **Mikrofon (`Mic` / `MicOff`):** Sesi kapatıp açar.
2. **Hoparlör (`Volume2` / `VolumeX`):** Ahize ve harici hoparlör geçişi.
3. **Dosya Ekleme (`Paperclip`):** Doğrudan ilgili biletin içine dosya/ek seçiciyi (`handlePickDocument`) açar.
4. **Chat (`MessageSquare`):** Çağrıyı arka planda kesintisiz sürdürerek üst kompakt çubuğa küçültür ve kullanıcının bilet içine mesaj yazabilmesini sağlar.

---

## 4. Samsung Düz Ahize Butonları & Leverage Gölge
* **Tasarım:** 68dp solid tam yuvarlak daireler, sıfır yazı, ortasında beyaz kalın ahize vektör ikonu.
* **Kırmızı Buton (`declineBtn`):** `#EB5757`, 135° açılı kapatma/reddetme ahizesi.
* **Yeşil Buton (`answerBtn`):** `#27AE60`, dik yanıtlama ahizesi.
* **Leverage Gölge:**
  - `elevation: 6`, `shadowOffset: { width: 0, height: 4 }`, `shadowOpacity: 0.35`, `shadowRadius: 8`.
  - Butonların kendi renklerinde hafif yayılımlı soft glow leverage efekti (`shadowColor: '#EB5757'` / `'#27AE60'`).

---

## 5. In-Call Minimizasyon (Bilet İçi Yazışma Çubuğu)
* Kullanıcı Chat ikonuna dokunduğunda veya modal tutamağından yukarı kaydırdığında:
  - Çağrı asla kesilmez (arka planda WebRTC P2P ses akışı devam eder).
  - Ekranın tepesine 48dp yüksekliğinde kompakt `minimizedContainer` hap (pill) çubuğu yerleşir (`[ 🟢 Kör ID • 00:42 ⌃ ] [ 🔴 Kapat ]`).
  - Çubuğa dokunulduğunda modal tekrar yarım ekran olarak açılır.
