# WhiteDesk Modülü: Bilet Çözümünde Doğrudan Ekrana Işınlanma (Deep-Link State Restoration)

## 1. Modül Özeti ve Amacı
Geleneksel destek süreçlerinde bilet çözüldüğünde kullanıcıya e-posta veya bildirim gider; kullanıcı ne yapıldığını anlamak için destek paneline girip uzun metinler okumak ve adımları baştan denemek zorunda kalır. Çoğu kullanıcı bu sürtünmeyi aşamaz ve işlemi terk eder (drop-off).

Bu modül, bilet çözüldüğü anda kullanıcının cihazına kriptografik olarak imzalanmış bir **Çözüm Yaması (Fix Patch)** fırlatır. Kullanıcı telefonunu veya uygulamayı bir sonraki açışında (Next Unlock / Foreground Intent), ekranın altından şık bir "İşlem Kartı (Reverse Ghost Card)" belirir. Kullanıcı karta dokunduğu anda ne bilet okur ne de destek ekranına gider; doğrudan hatayı aldığı ekrana, **sorun giderilmiş parametreler ve onarılmış durum (state) ağacıyla** anında ışınlanır.

---

## 2. Mimari ve İşleyiş İlkeleri
- **Durum Dondurma (State Snapshot):** Kullanıcı bilet açtığı an, o anki navigasyon rotası (`routeName`), parametreler (`params`) ve hassas verilerden arındırılmış UI state parçası biletin içerisine `ResolutionContext` olarak gömülür.
- **Kriptografik Çözüm İmzası:** Yönetici bileti çözerken düzelttiği state alanlarını (`patchState`) kendi özel anahtarıyla imzalar. Bu imza, kötü niyetli aktörlerin araya girip kullanıcıyı sahte rotalara yönlendirmesini engeller.
- **Sessiz Alım ve Hayalet Kart (Reverse Ghost Card):** Çözüm paketi arka planda sessizce iner (`SecureStore / MMKV`). Uygulama ön plana geçtiğinde yerel bir bildirim kartı belirir ("Ödeme sorununuz giderildi. Kaldığınız yerden devam etmek için dokunun").
- **State Re-hydration:** Kullanıcı dokunduğunda hedef ekrana `isRestored: true` parametresiyle deep-link tetiklenir ve onarılmış state yerel Redux/Zustand deposuna güvenle enjekte edilir.

---

## 3. IDE Agent Görev Promptu

```markdown
# GÖREV BİLDİRİMİ: WhiteDesk Deep-Link State Restoration Modülü

Sen WhiteDesk platformunun reaktif mobil istemci ve durum kurtarma (State Restoration) mimarisini kuran kıdemli yazılım mimarısın.
Bilet çözüldüğünde kullanıcının sorun yaşadığı ekrana onarılmış state verisiyle doğrudan dönmesini sağlayan uçtan uca akışı kodlayacaksın.

### 1. İstemci Durum Dondurucu (`state-freezer.ts`)
- Kullanıcı bilet açarken aktif navigasyon rotasını, ekran parametrelerini ve gerekli yerel state verisini (şifre, kart vb. PII hariç) yakala.
- Bu veriyi `NavigationSnapshot` formatında paketle ve biletin şifreli üst verisine iliştir.

### 2. Admin Çözüm ve Durum Yaması Servisi (`admin-resolution.service.ts`)
- Yönetici bilet çözme ekranına "Durum Yaması (State Patch) Ekle" seçeneği sun.
- Hedef rota (`targetRoute`) ve onarılan state nesnesini (`patchState`) yöneticinin özel anahtarıyla imzala (`signResolutionPayload`).
- Paketi müşterinin açık anahtarıyla şifreleyerek Neon Relay kuyruğuna aktar.

### 3. Mobil Hayalet Kart Bileşeni (`GhostResolutionCard.tsx`)
- Uygulama ön plana çıktığında (`AppState === 'active'`) bekleyen çözüm yamasını yerel depodan kontrol et.
- Varsa ekranın altından yükselen animasyonlu bir React Native kartı render et.
- "Kaldığın Yerden Sürdür" butonuna basıldığında:
  1. Yamayı global state motoruna (Zustand/Redux) enjekte et.
  2. Kullanıcıyı ilgili ekrana parametrelerle (`isRestored: true`) yönlendir.
  3. Çözüm paketini yerel depodan temizle.

### 4. Dil Kuralları (Microsoft Kurumsal Türkçe)
- Kart Başlığı: "Destek Talebiniz Çözüldü"
- Birincil Buton: "Kaldığın Yerden Sürdür ➔"
- İkincil Buton: "Kapat"
- Başarı Bildirimi: "Önceki işleminiz onarıldı, kaldığınız adımdan devam edebilirsiniz."
```
