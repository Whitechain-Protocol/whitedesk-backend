# WhiteDesk SDK & Client Integration Guide

## 📌 Genel Bakış
`whitedesk-sdk` (`src/whitedesk-sdk/`), sıfır-bilgi (Zero-Knowledge, E2EE) biletleme, mesajlaşma ve kriptografik yetkilendirme motorunu barındıran **Headless (görselsiz)** çekirdek kütüphanedir.

---

## 🔑 Kimlik & Passkey Mimarisi (12 Sözcük - BIP-39)

SDK, kimlik üretim ve kurtarma işlemlerini saf matematiksel ve kriptografik fonksiyonlarla yürütür. Kullanıcı arayüzü katmanında (`src/screens/auth/UnifiedAuthScreen.tsx`) bu süreç şu adımlarla çalışır:

### 1. Yeni Kuruluş & 12-Sözcüklü Kayıt Töreni (`genesis_ceremony`)
- Yeni bir kurum (Tenant) veya yönetici alanı kurulurken, `CryptoVaultService.generateRootVault()` çalıştırılarak **12 sözcüklü İngilizce BIP-39 Mnemonic** oluşturulur.
- Ekranda 12 sözcük 3'lü gruplar halinde kullanıcıya gösterilir ve güvenli bir yere not alması istenir.
- **Tören Sınaması (Ceremony Challenge):** Rastgele seçilen 2 kelime (örn: 3. ve 8. kelimeler) kullanıcıdan doğrulatılır. Başarılı olursa P-256 / Ed25519 anahtar çiftleri donanımsal SecureStore/Keystore alanına mühürlenir.

### 2. 12 Sözcük ile Oturum Kurtarma (`mnemonic_login`)
- Cihaz değişikliğinde veya yeniden kurulumda, kullanıcı 12 kelimelik kurtarma dizisini girer.
- SDK, aynı seed üzerinden deterministik olarak:
  - `blind_id` kimliğini (`blind_...`)
  - Kriptografik açık/özel anahtarları
  - Kurumsal oturum yetkilerini (`whitedesk_admins`)
  yeni cihaza anında geri yükler.

### 3. QR / Hash ile Hızlı Kurtarma (`wd_prof_...` / `claimUnifiedHash`)
- 12 söze ek olarak profil ekranındaki QR kod (`wd_prof_<hash>`) üzerinden de cihazlar arası anında oturum aktarımı yapılabilir.

---

## 🚀 SDK Başlatma & Entegrasyon

```typescript
import { WhiteDeskClient } from '@whitedesk/sdk';

// SDK Başlatma
const client = new WhiteDeskClient({
  endpoint: 'https://api.whitedesk.one',
  theWhitePublicKey: '...',
  neonEndpoint: '...',
  neonConnectionString: '...'
});

// Yeni Bilet Açma (E2EE)
await client.createTicket({
  subject: 'Bağlantı Sorunu',
  category: 'general',
  orgId: 'saha'
});
```
