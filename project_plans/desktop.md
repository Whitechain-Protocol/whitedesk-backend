# 🖥️ WhiteDesk Desktop (Tauri v2) - Anahtar Teslim Mimari & Geliştirme Spesifikasyonu

> **Döküman Sürümü:** 1.0.0-PROD  
> **Tarih:** 01 Kasım 2026  
> **Teknoloji Yığını:** Tauri v2 (Rust Backend) + React 18/19 (Vite + TypeScript) + TailwindCSS  
> **Lisans & Güvenlik:** Zero-Knowledge / Uçtan Uca Şifreli (E2EE) • CORE & LIVE Çoklu Lisans Desteği  

---

## 📌 1. YÖNETİCİ ÖZETİ & MİMARİ ÇERÇEVE

WhiteDesk Desktop, kurumsal operatörler ve yöneticiler için yüksek performanslı, minimum kaynak tüketen (<20MB RAM) ve işletim sistemi düzeyinde yeteneklere sahip bir **Operatör Komuta Masası** olarak tasarlanmıştır.

* **Neden Tauri?**
  * Electron'un ağır Chromium yükü yerine işletim sisteminin yerel Webview'ını (Windows WebView2, macOS WebKit) kullanır.
  * Rust tabanlı güvenli bellek yönetimi ve kriptografik performans sağlar.
  * Canlı telsiz (PTT), global kısayollar, OS Bildirimleri ve uzaktan canlı müdahale bileşenleri için C/Rust seviyesinde native hız sunar.
* **Monorepo Stratejisi:**
  * Proje kök dizininde `desktop/` klasörü altında izole bir çalışma alanı olarak konumlandırılır.
  * Mobil istemcideki (`c:\whitedesk\src\crypto`) şifreleme fonksiyonları, `types.ts` veri modelleri ve WebSocket relay protokolleri doğrudan referans alınarak protokol uyumsuzluğu engellenir.

---

## 🔐 2. QR HANDSHAKE & LİSANS SENKRONİZASYONU

Kullanıcı adı ve şifre girme zorunluluğu tamamen ortadan kaldırılmıştır. WhatsApp Web / Telegram Desktop mantığında kriptografik eşleştirme uygulanır.

```
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│     WHITEDESK DESKTOP           │                 │       WHITEDESK MOBİL           │
│     (Tauri v2 / Windows-Mac)    │                 │       (Galaxy S24 / Tab)        │
└────────────────┬────────────────┘                 └────────────────┬────────────────┘
                 │                                                   │
     1. İlk Açılış: Dinamik QR Göster                                │
     (sessionId:blindNonce:relayUrl)                                 │
                 │                                                   │
                 │◄───────────── 2. Mobil Tarayıcı ile Oku ──────────┤
                 │               (WhiteDeskScannerScreen)            │
                 │                                                   │
                 │                                   3. Lisans ve İmzayı Doğrula
                 │                                      (CORE / LIVE Aktif mi?)
                 │                                                   │
                 │◄─── 4. E2EE Oturum Aktarımı (Relay Push) ────────┤
                 │     (SharedSecret, TenantBlindId, AdminRole)      │
                 ▼                                                   ▼
     5. Anında Masaüstü Açılır                           6. Mobilde "Eşlendi" Uyarısı
     (Operatör Masası Hazır)
```

### Lisans Yetkilerinin Masaüstüne Yansıması:
* **Mobilde Satın Alınan Lisans Geçerlidir:** Kullanıcı mobilde hangi plana (CORE veya LIVE) sahipse, masaüstü açıldığında o planın tüm yetenekleri otomatik olarak kilitsiz gelir.
* **CORE Paketi:** Masaüstü istemcisi, sınırsız operatör, E2EE biletleme konsolu, bilet transferi ve dosya/ek yönetimi.
* **LIVE Paketi:** CORE yeteneklerine ek olarak; Uzaktan masaüstü canlı izleme/müdahale konsolu, Telsiz (PTT) yayını ve canlı sesli görüşme.

---

## 🎨 3. MASAÜSTÜ OPERATÖR KONSOLU TASARIMI (3 KOLONLU ERGONOMİ)

Geniş ekran (16:9 / 21:9) masaüstü monitörleri için optimize edilmiş Google Minimalizmi renk paleti (`#F8F9FA` Slate zemin, `#FFFFFF` saf kartlar, `#1A73E8` Google Blue vurguları).

```
┌──────────────┬────────────────────────┬────────────────────────────────────────────┐
│ SOL NAVİGASYON│   BİLET LİSTESİ        │       AKTİF BİLET & ÇALIŞMA MASASI         │
│ (240px)      │   (360px)              │       (Esnek Geniş Kolon)                  │
├──────────────┼────────────────────────┼────────────────────────────────────────────┤
│ • Logo & Org │ 🔍 Bilet Ara...        │ 📌 TKT-ZDTWGB: Sistem Kesintisi Analizi    │
│              ├────────────────────────┤ [Öncelik: Kritik] [SLA: 14dk] [Atandı: @.] │
│ 💳 CORE [Aktif]│ [Kritik] TKT-ZDTWGB    │────────────────────────────────────────────│
│   (Yıllık)   │ SLA: 14dk kaldı        │ [Müşteri - 14:20] Sunucuya erişilemiyor... │
│              │ Son İşlem: 5dk önce    │ [Operatör - 14:22] E2EE oturumu açıldı.     │
│ 📁 Kategoriler│                        │                                            │
│ • Ağ / Sistem├────────────────────────┤ ────────────────────────────────────────── │
│ • Donanım    │ [Normal] TKT-YAA81B    │ 💬 Yanıt Yazın... [Dosya Ekle] [Gönder]    │
│ • Yazılım    │ SLA: Normal            │                                            │
│              │ Son İşlem: 1 saat önce ├────────────────────────────────────────────┤
│ 🏷️ Durumlar  │                        │ 🔴 CANLI ÇALIŞMA ALANI (LIVE Paketi):       │
│ • Açık (12)  │                        │ [🖥️ Canlı Ekranı Başlat] [🎙️ Telsiz PTT] │
│ • Yanıtlandı │                        │ [⚙️ Uzak Teşhis Verileri (CPU / RAM / Ağ)] │
│ • Çözüldü    │                        │                                            │
└──────────────┴────────────────────────┴────────────────────────────────────────────┘
```

---

## ⚙️ 4. TAURI V2 YEREL İŞLETİM SİSTEMİ ENTEGRASYONLARI

Masaüstü versiyonunun mobil ve web'den üstün olduğu yerel native yetenekler:

1. **Sistem Tepsisi (System Tray & Menubar):**
   * Uygulama penceresi kapatılsa dahi sağ alt tepside (Windows) veya menü çubuğunda (macOS) sessizce çalışır.
   * Yeni bir kritik bilet düştüğünde tepsi simgesi anlık mavi/kırmızı nabız atar (badge notification).
2. **Global Bas-Konuş Kısayolu (Global Push-To-Talk Hotkey):**
   * Operatör başka bir programda (ERP, Excel, Terminal vb.) çalışırken dahi global `F9` veya `Ctrl+Space` tuşuna basılı tuttuğunda WhiteDesk telsiz kanalı açılır ve ses iletilir; tuş bırakıldığında yayın kesilir.
3. **Güvenli OS Anahtarlık Saklama (OS Keyring / Credential Vault):**
   * QR eşleştirmesi ile gelen oturum anahtarları ve özel anahtarlar yerel düz metin dosyalarda değil; Windows Credential Manager ve macOS Keychain üzerinde şifreli saklanır.
4. **Yerel İşletim Sistemi Bildirimleri (OS Native Notifications):**
   * Yeni bilet, SLA aşımı ve operatör çağrılarında sistem düzeyinde sesli ve interaktif aksiyon butonlu bildirimler.

---

## 📂 5. DİZİN YAPISI (`c:\whitedesk\desktop\`)

```
c:\whitedesk\desktop\
├── src-tauri\                  # Rust Backend (Tauri v2 Motoru)
│   ├── Cargo.toml              # Rust bağımlılıkları (tauri, keyring, global-hotkey, webrtc)
│   ├── tauri.conf.json         # Pencere boyutları, tray ayarları, bundle kimlikleri
│   ├── icons\                  # Windows (.ico) ve macOS (.icns) uygulama ikonları
│   └── src\
│       ├── main.rs             # Tauri başlatıcı ve handler registration
│       ├── commands.rs         # JS -> Rust IPC komutları (Keyring, OS bildirimleri)
│       ├── tray.rs             # Sistem tepsisi menüsü ve olay yakalayıcıları
│       └── ptt.rs              # Global PTT hotkey dinleyici motoru
│
├── src\                        # React Operatör Konsolu (Frontend)
│   ├── assets\                 # Vektörel ikonlar ve ses dosyaları (PTT cırt sesi, bildirim)
│   ├── components\
│   │   ├── layout\             # 3 Kolonlu Konsol (Sidebar, TicketList, TicketDetail)
│   │   ├── auth\               # QR Eşleştirme Karşılama Ekranı (QrPairingView.tsx)
│   │   ├── tickets\            # Bilet Mesajlaşma, Yanıt, SLA Sayaçları
│   │   ├── live\               # LIVE Paketi: Uzak Masaüstü İzleyici ve Telsiz Konsolu
│   │   └── license\            # Masaüstü Lisans & Plan Modalı (Mobil ile aynı akıl)
│   ├── hooks\                  # WebSocket bilet dinleyicileri, ses yakalama hookları
│   ├── services\               # Shared Crypto (`../../src/crypto`) ve Relay servisleri
│   ├── stores\                 # Zustand / React Context durum yönetimi
│   ├── App.tsx                 # Ana yönlendirici (Eşleşmiş mi? -> Konsol : QR Eşleme)
│   └── main.tsx                # Vite React Giriş Noktası
│
├── package.json                # Vite, TailwindCSS, Lucide-React bağımlılıkları
├── tsconfig.json               # TypeScript yapılandırması
├── tailwind.config.js          # Renk paleti ve responsive grid ayarları
└── vite.config.ts              # Vite derleyici ayarları (Tauri port ve proxy ayarları)
```

---

## 🚀 6. PAZARTESİ GÜNÜ BAŞLANGIÇ ADIMLARI (SPRINT CHECKLIST)

Pazartesi günü geliştirmeye başladığımızda sırasıyla icra edilecek 5 adım:

- [ ] **Adım 1:** Kök dizinde `desktop/` çalışma alanının Tauri v2 + Vite (React + TS) şablonuyla ayağa kaldırılması.
- [ ] **Adım 2:** Mobil projedeki ortak kripto motoru (`src/crypto`) ve REST/WebSocket relay istemcisinin masaüstüne bağlanması.
- [ ] **Adım 3:** Masaüstü açılış ekranına dinamik süreli **QR Kod Üretim ve Eşleştirme (Pairing)** ekranının kodlanması.
- [ ] **Adım 4:** Galaxy S24 mobil tarayıcısıyla QR okutularak masaüstüne tek tıkla şifresiz oturum açma testinin yapılması.
- [ ] **Adım 5:** 3 kolonlu modern operatör çalışma masasının iskeletinin kurulması ve mobildeki aktif lisansın (`CORE` / `LIVE`) masaüstü rozetine basılması.

---

> *Bu belge WhiteDesk masaüstü projesinin değişmez referans mimari belgesidir.*
