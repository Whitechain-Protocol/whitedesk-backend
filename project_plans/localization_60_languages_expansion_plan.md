# WhiteDesk 60 Dil (54 Mevcut + 6 `inWhite` Dili) Genişletme ve Tam Senkronizasyon Planı

## 1. Amaç ve Kapsam
`C:\inWhite\src\locales` klasöründe yer alan ancak `c:\whitedesk\src\locales` içinde henüz bulunmayan **6 dilin** (`am`, `ha`, `ky`, `mn`, `sq`, `ta`), WhiteDesk'in mevcut **54 dil** mimarisine (`2.442` anahtar, Microsoft Terminology uyumu, sıfır yabancı kelime sızıntısı, `GEMINI.md` Kural 6 yalın ifade standardı ve tekil tembel yükleme / lazy-load yapısı) %100 uyumlu şekilde dahil edilerek toplam dil sayısının **60 dile** çıkarılması.

---

## 2. Eklenecek 6 Dil ve Mevcut Anahtar Analizi

| # | Kod | Türkçe Adı | İngilizce Adı | Yerel Adı (`nativeName`) | Alfabe / Yazı Sistemi | `inWhite`'tan Hazır Eşleşen Anahtar | WhiteDesk İçin Çevrilecek Eksik Anahtar | Toplam Hedef |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| 1 | `am` | Amharca | Amharic | አማርኛ | Ge'ez (Etiyopya) | 850 | 1.592 | **2.442** |
| 2 | `ha` | Hausaca | Hausa | Hausa | Latin | 850 | 1.592 | **2.442** |
| 3 | `ky` | Kırgızca | Kyrgyz | Кыргызча | Kiril | 850 | 1.592 | **2.442** |
| 4 | `mn` | Moğolca | Mongolian | Монгол хэл | Kiril | 850 | 1.592 | **2.442** |
| 5 | `sq` | Arnavutça | Albanian | Shqip | Latin | 850 | 1.592 | **2.442** |
| 6 | `ta` | Tamilce | Tamil | தமிழ் | Tamil | 850 | 1.592 | **2.442** |

---

## 3. Uygulama Adımları (5 Aşama)

### Aşama 1: Baz Dosyaların Aktarımı ve Şema Hizalama (`src/locales/*.json`)
1. `C:\inWhite\src\locales\` altındaki `am.json`, `ha.json`, `ky.json`, `mn.json`, `sq.json` ve `ta.json` dosyalarındaki mevcut **850 ortak anahtar** korunarak baz alınır.
2. WhiteDesk'te yer alan ancak `inWhite` şemasında bulunmayan **1.592 kurumsal/yardım masası anahtarı** (`scanner.*`, `profile.modal.*`, `identity.*`, `admin.*`, `org.*`, `provisioning.*`, `diagnostics.*`, `helpdesk.*`, `call.*`) `en.json` ve `tr.json` referans alınarak her 6 dilin kendi yerel diline ve alfabesine çevrilir.
3. Tüm 6 dosyada anahtar sırası `en.json` / `tr.json` ile birebir aynı (`2.442` anahtar) olacak şekilde hizalanır.

### Aşama 2: Kalite, Güvenlik ve `GEMINI.md` Kural 6 Denetimi
Yeni eklenen 6 dil dosyasına da diğer 54 dilde uygulanan 5 kalite standardı eksiksiz uygulanır:
1. **Yerel Ad-Soyad Örnekleri (`identity.modal.fullname_placeholder`, `profile.modal.invalid_name_desc`, `addContact.*`):**
   - `am` (Amharca): `"ምሳሌ፦ አበበ በቀለ"` (Abebe Bekele)
   - `ha` (Hausaca): `"Misali: Musa Ibrahim"`
   - `ky` (Kırgızca): `"Мис: Асан Үсөнов"` (Asan Üsönov)
   - `mn` (Moğolca): `"Жнь: Бат Болд"` (Bat Bold)
   - `sq` (Arnavutça): `"p.sh. Agim Krasniqi"`
   - `ta` (Tamilce): `"எ.கா: அருண் குமார்"` (Arun Kumar)
2. **Microsoft Terminology Uyumu:** İşletim sistemi, ağ, kriptografi ve kurumsal yardım masası terimlerinin Microsoft Language Portal standartlarına uygunluğu.
3. **Yabancı Kelime ve Alfabe Saflığı:** Kiril (`ky`, `mn`), Ge'ez (`am`), Tamil (`ta`) ve Latin (`ha`, `sq`) dosyalarında çevrilmemiş İngilizce/Türkçe cümle veya yanlış alfabe sızıntısı bulunmaması (`{placeholder}` değişkenleri korunarak).
4. **Parantez İçi İkincil İfade Yasağı (`GEMINI.md` Kural 6):** `en.json` ve `tr.json` içinde parantez bulunmayan anahtarlarda gereksiz parantez içi İngilizce/eş anlamlı açıklamaların bulunmaması.

### Aşama 3: Tembel Yükleme (Lazy-Load) ve Dil Algılama Entegrasyonu
1. **[src/locales/index.ts](file:///c:/whitedesk/src/locales/index.ts):**
   - `lazyLoaders` nesnesine `am`, `ha`, `ky`, `mn`, `sq`, `ta` için `() => require('./xx.json')` kayıtları eklenir.
   - Böylece açılışta yine **yalnızca cihazın aktif dili** belleğe yüklenir; diğer 59 dil bellekte yer kaplamaz.
2. **[src/services/i18nService.tsx](file:///c:/whitedesk/src/services/i18nService.tsx):**
   - `SUPPORTED_LANGUAGES` dizisine 6 yeni dil (`am`, `ha`, `ky`, `mn`, `sq`, `ta`) eklenir (toplam **60 dil**).
   - `matchSupportedLocale()` fonksiyonu bu 6 dilin cihaz yerel ayar kodlarını (`am-ET`, `ha-NG`, `ky-KG`, `mn-MN`, `sq-AL`, `ta-IN` / `ta-LK` / `ta-SG`) otomatik algılar; eşleşmezse yalnızca `en` fallback yapar.

### Aşama 4: `languageNames.ts` (60×60 Çapraz Dil İsimleri Matrisi) Güncellemesi
1. **[src/locales/languageNames.ts](file:///c:/whitedesk/src/locales/languageNames.ts):**
   - `C:\inWhite\src\locales\languageNames.ts` içindeki `am`, `ha`, `ky`, `mn`, `sq`, `ta` çevirileri ile WhiteDesk'e özgü 8 dilin (`ca`, `eu`, `hr`, `is`, `sl`, `zh-CN`, `zh-HK`, `zh-SG`) karşılıkları birleştirilerek **60×60** tam çapraz dil matrisi oluşturulur.

### Aşama 5: Doğrulama ve Test
1. **Şema ve Anahtar Testi:** `60 / 60` dil dosyasında `2.442` sıralı anahtar, `%100` `{placeholder}` uyumu ve `0` JSON/alfabe hatası.
2. **TypeScript Denetimi:** `npx tsc --noEmit` (`0` hata).
