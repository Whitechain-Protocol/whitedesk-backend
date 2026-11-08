# inWhite iOS WireGuard — Integration Guide

Bu klasör, **Android tarafında tamamlanmış olan WireGuard köprüsünün iOS eşleniğidir.**
Kod, resmi `wireguard-apple` mimarisini takip eder; ancak **bu Windows ortamında derlenmedi** (Xcode/macOS yok).

## iOS build için gerekenler (macOS'ta)

1. **iOS klasörünü üret:**
   `npx expo prebuild --platform ios`

2. **wireguard-apple paketini ekle (SPM):**
   Xcode'da `File > Add Package Dependencies` →
   `https://github.com/WireGuard/wireguard-apple`
   Şu hedeflere ekle: `WireGuardKit`, `WireGuardKitGo`, `WireGuardKitC` (hem ana uygulama hem NetworkExtension hedefi).

3. **NetworkExtension hedefi oluştur:**
   - Yeni bir "Packet Tunnel Provider" target ekle.
   - Bundle ID: `com.mceryilmaz.inwhite.wireguard-tunnel`
     (ya da `InWhiteWireguardManager.swift` içindeki `providerBundleIdentifier`'ı kendi ID'nle değiştir).
   - `PacketTunnelProvider.swift` + `TunnelConfiguration+WgQuickConfig.swift` dosyalarını bu hedefe ekle.

4. **Entitlements (capabilities):**
   - Personal VPN
   - Network Extensions (ana uygulama target'ında)

5. **`index.ts`'i iOS'a bağla:**
   Şu an `modules/inwhite-ringtone/index.ts` native modülü sadece Android'de yüklüyor
   (`Platform.OS === 'android'`). iOS'ta da yüklemek için bu koşulu iki platforma aç.

## Doğrulama noktaları (derleme öncesi kontrol)

- `TunnelConfiguration+WgQuickConfig.swift` içindeki `TunnelConfiguration`,
  `InterfaceConfiguration`, `PeerConfiguration`, `PrivateKey`, `PublicKey`,
  `IPAddressRange`, `DNSServer`, `Endpoint` initializer imzalarını, entegre ettiğin
  WireGuardKit sürümüyle birebir doğrula (yorumda `TODO(ios-build)` işaretli).
- `vpnService.ts` iOS'ta da `setWireguardConfig()` ile config'i SecureStore'a yazıp
  `connect()` ile çağırır; config akışı Android ile aynıdır.

## Config formatı (Android ile aynı, wg-quick INI)

```
[Interface]
PrivateKey = <client private key>
Address = <client IP>

[Peer]
PublicKey = <server public key>
Endpoint = <host:port>
AllowedIPs = 0.0.0.0/0, ::/0
```
