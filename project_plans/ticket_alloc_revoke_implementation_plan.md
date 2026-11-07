# 🚀 Ticket Allocation, Revocation & SLA Escalation Uygulama Planı

Bu plan, **[Ticket_alloc_revoke.md](file:///c:/whitedesk/Ticket_alloc_revoke.md)** üzerinde `/grill-me` mülakatında mutabık kaldığımız tüm kararları adım adım hayata geçirecek teknik yol haritasını içerir.

---

## 🏗️ Faz 1: Cloudflare D1 & Worker Backend Katmanı (`cloudflare-worker`)

- [ ] **1.1 D1 Şema Tanımları (`admin_roster` & `whitedesk_tickets`):**
  - `admin_roster` tablosunu D1 üzerinde oluşturma (`blind_id`, `enterprise_blind_id`, `org_id`, `app_id`, `categories TEXT`, `name`, `open_tickets`, `counter`, `is_active`, `snooze_until`, `date_time`).
  - `whitedesk_tickets` tablosuna `escalation_stage`, `audit_trail` ve `r2_attachment_key` kolonlarını ve sorgu indekslerini ekleme.
- [ ] **1.2 `/api/roster/heartbeat` & Durum Senkronizasyon Endpoint'i:**
  - Admin cihazından gelen düzenli heartbeat sinyallerini işleme.
  - Mola dönüşü (pasiften aktife geçişte) sayacı tabana çekme ve %20 dengeleme kuralını işletme.
- [ ] **1.3 `/api/tickets/allocate` Tahsis Algoritması:**
  - Kategori eşleşmesi (`categories LIKE ...` veya `general`), `is_active = 1`, son 120 saniyede heartbeat vermiş adminler arasından en düşük `counter` ve en düşük `open_tickets` sahibini seçme.
  - Aktif admin bulunamazsa `assigned_admin_blind_id = 'unassigned'` ve `recipient_blind_id = enterprise_blind_id` olarak havuz ataması yapma.
- [ ] **1.4 `/api/tickets/reissue-twin` İkiz Bilet Endpoint'i & D1/R2 Temizlik Mantığı:**
  - SLA aşımında Paket A (`status = 'open'`, yeni admin) ve Paket B (`status = 'revoked'`, eski admin) paketlerini işleme.
  - TTL süresini sabit 72 saat yerine Gelişmiş Özellikler -> Bilet Kapama süresi (`autoCloseHours`) kadar ayarlama.
  - **Antimadde Eşleşmesi:** Eğer Admin 1 bileti hiç çekmemişse, D1'deki bekleyen bilet ile gelen Revoke paketini eşleştirip her ikisini de D1'den anında buharlaştırma.
  - **R2 Koruma:** D1'deki eski paketler buharlaşsa dahi, biletin R2 eki Admin 2'nin indirmesi için kesinlikle silinmez, korunur.

---

## 📱 Faz 2: Kullanıcı İstemcisi SLA Motoru & İkiz Bilet Gönderimi

- [ ] **2.1 İstemci Tarafı SLA Zamanlayıcısı (`src/services/helpdesk/slaEscalationService.ts`):**
  - Uygulama açılışında ve bilet listesi odaklanmalarında biletlerin `created_at` ve `last_admin_reply_at` sürelerini kontrol etme.
  - Kuruluşun SLA sınırını (`sla_max_response_minutes`) aşan biletler için otomatik ikiz bilet oluşturma.
- [ ] **2.2 Sıfır-Bilgi Yeniden Şifreleme (Re-Keying):**
  - Kullanıcının yerel anahtarıyla bilet başlığını ve mesajlarını Admin 2'nin açık anahtarıyla yeniden şifreleme.
  - Eski Admin 1 için `revoked` zehir hapı paketi hazırlama ve D1'e iletme.
- [ ] **2.3 Kullanıcı Bilgilendirme Banner'ı:**
  - Eskalasyon tetiklendiğinde ekran altında şık beyaz toast bildirimi:
    *"Cevaplanması geciken [TKT-XXXXXX] biletiniz yeni bir temsilciye aktarılmıştır."*

---

## 🛡️ Faz 3: Admin İstemcisi Yetki Alınma (Revoke) & Mola Yönetimi

- [ ] **3.1 Bilet Senkronizasyonunda `revoked` Durum Yönetimi:**
  - Admin gelen kutusunda `status = 'revoked'` paketi tespit edildiğinde bileti yerel kasadan silmek yerine `status = 'revoked'` (Eskale Edildi) durumuna geçirme.
  - Bileti aktif "Açık Biletler" listesinden otomatik düşürme (adminin önünde kalabalık yapmaz, arşive çekilir).
  - Bilet detayında yanıt verme alanını kilitleyip salt-okunur (read-only) bilgilendirme mesajı gösterme.
  - Adminin yerel sayacını düşürme (`open_tickets = MAX(0, open_tickets - 1)`).
  - Admin uzun süre çevrimdışı kalıp D1 revoke paketi buharlaştıktan sonra açsa dahi, açılışta yerel SLA kontrolüyle bileti otomatik pasife çekme.
- [ ] **3.2 Admin Aktif / Molada Durum Toggle'ı:**
  - `IdentityModal.tsx` içine **Aktif / Molada** toggle switch'i ve pasif seçildiğinde mola süresi seçimi (`15 dk`, `30 dk`, `1 saat`, `Ben açana kadar`).
  - 3 nokta yönetici menüsünde profil bölümüne hızlı Aktif/Pasif durum kontrolü ekleme.
  - Periyodik (60 sn) `/api/roster/heartbeat` fırlatma servisi.

---

## 🎨 Faz 4: Arayüz (UI) & Kuruluş Ayarları Entegrasyonu

- [ ] **4.1 Bilet Kartı (`TicketCard.tsx`) & Bilet Detayı (`TicketDetailView.tsx`):**
  - Tarih/saat satırının hemen altına aynı CSS stiliyle:
    - İlk atamada: `Atandı: [Admin Adı veya Blind ID]`
    - Yeniden atamada: `Yeniden Atandı: [Yeni Admin Adı veya Blind ID]`
    - Eski adminde: Turuncu `Eskale Edildi` rozeti.
- [ ] **4.2 Kuruluş Ayarları (`SettingsStation`):**
  - Global Admin için **"Admin Maksimum Cevap Süresi (SLA)"** seçimi (15 dk, 30 dk, 1 sa, 2 sa, 4 sa, 24 sa).
  - Seçilen sürenin `whitedesk_system_config` tablosuna kaydedilmesi.
- [ ] **4.3 Yönetici Değerlendirmeleri Paneli (`AdminRatingsOverviewModal.tsx`):**
  - SLA başarı ve yanıt performansı metriklerinin eklenmesi:
    - Ortalama İlk Yanıt Süresi (dakika/saat).
    - SLA Uyum Oranı (% Zamanında Yanıt).
    - Geciken / Eskale Edilen Bilet Adedi.
    - Adil Dağıtım Kümülatif Sayaç değeri.

---

## 🧪 Faz 5: Derleme, Test ve İki Cihaz Üzerinde Canlı Doğrulama

- [ ] **5.1 Test:** S24 ve Galaxy Tab arasında bir kullanıcı bir admin rolündeyken SLA süresini test için kısa (örn. 1-2 dk) tutarak ikiz biletin oluştuğunu, Admin 1'in biletinin "Eskale Edildi" durumuna geçtiğini ve Admin 2'ye biletin düştüğünü canlı doğrulamak.
- [ ] **5.2 Hermes AOT Bytecode & APK Derleme:** `npm run bundle:android` ve `gradlew assembleDebug` ile APK'yı derleyip bağlı S24 ve Tab cihazlarına yüklemek.
