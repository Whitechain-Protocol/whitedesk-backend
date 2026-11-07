# Bilet Oluşturma Ekranı (Compose View) Güncellenmiş Uygulama Planı

## 📌 Kesinleşen Tasarım & Mimari Adımları

1. **Gri Alandaki Başlık & Logonun Kaldırılması:**
   - `TicketComposeView.tsx` içerisindeki `<View style={styles.scrollLogoRow}>...<Text>WhiteDesk</Text></View>` bloğu kaldırılıyor.
   - Gri alanda **yalnızca** Samsung geri ok (`<`) ve yanındaki başlık yer alacak.
   - Ekran yukarıdan (`paddingTop: safeTop + 6`) başlatılacak.

2. **Yeşil Buton Başlık Metni:**
   - Yeşil butona basıldığında (`supportTicketTarget === 'thewhite'`), gri alandaki Samsung geri butonunun yanında `"TheWhite Uygulama Destek Bileti"` yerine yalnızca **`"Destek Bileti"`** (İngilizce: `'Support Ticket'`) yazacak.

3. **Yuvarlatılmış Beyaz Panel İçi Başlık (Ana Giriş Ekranı ile Birebir):**
   - Yuvarlatılmış beyaz kartın (`composeCardFluid`) en üstüne:
     - Kulaklık ikonu (`Headphones`)
     - Kullanıcı ise **WhiteDesk**, Admin ise **WhiteDesk Admin** başlığı
     - Altında ilgili organizasyon / tenant alt başlığı eklenecek.
   - Hemen altında Kategori seçimi ve form alanları devam edecek.

4. **Ana Liste Ekranı Dokunulmazlığı:**
   - Ana ekran (`HelpDeskScreen.tsx`) listesi, üst tenant logosu ve beyaz paneli aynen korunacak.
