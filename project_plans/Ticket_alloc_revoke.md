# WhiteDesk: Ticket Allocation, Revocation & SLA Escalation Specification (v2.0)

Bu doküman, WhiteDesk sıfır-bilgi (Zero-Knowledge, E2EE) mimarisine uygun olarak Cloudflare D1/R2 veri düzlemi ile Neon kontrol düzlemi arasındaki adil bilet tahsisi (fair-share allocation), SLA zaman aşımı eskalasyonu (ikiz bilet: ekle/çıkar) ve yönetici değerlendirme metriklerini belirler.

---

## 📌 1. Temel Mimari Prensipler & E2EE Kuralları

1. **Sıfır-Bilgi İzolasyonu (Zero-Knowledge):**
   - Bilet içerikleri ve mesajlar uçtan uca kullanıcının anahtarıyla şifrelenir.
   - Sunucu veya Cloudflare Worker biletin içeriğini çözemez. Bu nedenle SLA zaman aşımı gerçekleştiğinde biletin yeni bir admine devredilmesi (re-keying), **kullanıcının cihazındaki kaynak kopya** tarafından gerçekleştirilir.

2. **İkiz Bilet (Twin Ticket) Mekanizması:**
   - Bir admin belirlenen SLA süresi içinde ilk yanıtı vermezse (ve eskalasyon Global Admin tarafından aktif edilmişse) kullanıcı istemcisi 2 bağımsız operasyon fırlatır:
     - **Paket A (`status = 'open'`):** Sistemdeki sıradaki uygun Admin 2'nin açık anahtarıyla şifrelenmiş bilet (`escalation_stage = 1`).
     - **Paket B (`status = 'revoked'`):** Eski Admin 1'in kör kimliğine iliştirilmiş yetki iptal / çıkar paketi.

3. **Eski Admin Cihazında Davranış:**
   - Paket B eski admine ulaştığında bilet yerel SQLite/Keystore kasasından **silinmez**; ancak **'Eskale Edildi / Yetki Alındı'** (`status = 'revoked'`) durumuna geçirilir.
   - Bilet salt-okunur (read-only) olur, cevap yazma alanı kapatılır ve bilgilendirme uyarısı verilir.
   - Adminin adil dağıtım sayacı düşürülür: `counter = MAX(0, counter - 1), open_tickets = MAX(0, open_tickets - 1)`.

4. **Kullanıcı Bildirimi (Pill/Toast Banner):**
   - Kullanıcıya ekranın altında şık beyaz bir bildirim kartı gösterilir:
     *"Cevaplanması geciken [TKT-XXXXXX] biletiniz yeni bir temsilciye aktarılmıştır."*

5. **Eskalasyonun Açılıp Kapatılabilir Olması (Global Admin İnisiyatifi):**
   - Global Admin isterse bu işlevi **pasif (`escalation.enabled = false`)** edebilir.
   - İşlev pasif olduğunda: Bilet asla başka bir admine gitmez, ilk atanan adminde kalır, eskalasyon tetiklenmez ve D1'de buharlaşmaz.

6. **D1 Buharlaşma & Revoke Bekleme Süresi (Dinamik TTL):**
   - D1 üzerindeki Revoke paketi ve geçici eskalasyon verileri sabit 72 saat DEĞİLDİR.
   - Bekleme süresi: **Gelişmiş Özellikler -> Bilet Kapama ve Çözüm Teyidi** bölümünde belirlenen süre (`autoCloseHours` / onay penceresi) kadardır.
   - Bilet çözüme ulaşıp kapandığında veya belirlenen süre dolduğunda Revoke paketi D1 havuzundan otomatik olarak buharlaşır.

7. **Admin Bileti Çektikten Sonra Uygulamayı Hiç Açmazsa Ne Olur? (Zombi / Offline Admin):**
   - Revoke paketi D1'de **Bilet Kapama ve Çözüm Teyidi** süresince eski adminin alması için bekler.
   - Bu süre içinde eski admin uygulamayı açmazsa ve bilet yeni admin tarafından çözülüp kapatılırsa, D1'deki Revoke paketi süresi dolunca buharlaşır.
   - **Eski Admin Haftalar/Aylar Sonra Gelirse:**
     - **Yerel Kasa Koruması:** Admin uygulamayı açtığında istemcinin yerel SLA/zamanlayıcı kontrolü devreye girer. Biletin süresi ve durumu geçmiş olduğu için bilet yerelde de otomatik olarak kilitlenir (`status = 'revoked'` veya `closed`). Aktif bilet listesinden düşer, sayacı düşürülür.
     - **Kullanıcı E2EE Kalkanı:** Eski admin çevrimdışı durumdaki biletine cevap yazmaya kalkışsa dahi, kullanıcı istemcisinde biletin aktif oturumu Admin 2'ye devredilmiş (veya bilet kapanmış) olduğundan, eski adminden gelen paketler kullanıcı cihazında reddedilir.

8. **Admin Bileti Hiç Çekmeden Çevrimdışı Olursa (D1 ve R2 Eşleşme Buharlaşması):**
   - **D1 Havuzunda Antimadde Eşleşmesi (Anında Silinme):** Eğer Admin 1 bileti henüz D1'den hiç çekmemişse ve SLA süresi dolup Revoke paketi D1'e ulaşırsa; Worker bu iki paketi (`ticket_id` ve `recipient_blind_id`) anında eşleştirir. Çekilmeyen bilet ile Revoke paketi D1'den **o anda birlikte buharlaştırılır (silinir)**. Admin 1'e artık gereksiz bir revoke ulaştırmaya gerek kalmaz.
   - **Cloudflare R2 Ek Dosyası Koruması (Kesinlikle Silinmez):** D1'deki Admin 1 paketleri silinse dahi, biletin R2 üzerindeki ek dosyası (`attachment_r2_key`) **asla silinmez**. Çünkü bu dosya yeni devralan Admin 2'nin indirmesi içindir. R2'deki dosya ancak yeni admin eki indirip ACK verdiğinde veya bilet nihai olarak çözülüp kapandığında temizlenir.

---

## 🗄️ 2. Veritabanı Şemaları (Cloudflare D1 & Neon)

### A. Cloudflare D1: `admin_roster` Tablosu
Adminlerin anlık canlılık, organizasyon, çalışma kategorileri, sayaç ve aktiflik durumlarını yönetir.

```sql
CREATE TABLE IF NOT EXISTS admin_roster (
    blind_id VARCHAR(128) PRIMARY KEY,          -- Admin Node Hash / Blind ID
    enterprise_blind_id VARCHAR(128) NOT NULL,  -- Tenant / Firma ayrımı
    org_id VARCHAR(64) NOT NULL DEFAULT 'default',
    app_id VARCHAR(64) NOT NULL DEFAULT 'whitedesk',
    categories TEXT DEFAULT '["general"]',      -- JSON Array: örn: ["network", "billing"]
    name TEXT,                                  -- Görünen rumuz/unvan (yoksa blind_id)
    open_tickets INTEGER DEFAULT 0,             -- Adminin elindeki anlık aktif bilet adedi
    counter INTEGER DEFAULT 0,                  -- Kümülatif adil dağıtım sayacı (bilet çekilince +1)
    is_active INTEGER DEFAULT 1,                -- 1: Aktif, 0: Molada / İzinde
    snooze_until BIGINT DEFAULT 0,              -- Mola bitiş zaman damgası (0: süresiz)
    date_time BIGINT NOT NULL                   -- Heartbeat unixepoch zaman damgası
);

CREATE INDEX IF NOT EXISTS idx_roster_allocation 
ON admin_roster (enterprise_blind_id, org_id, app_id, is_active, counter);
```

### B. Cloudflare D1: `whitedesk_tickets` Güncellemeleri
```sql
ALTER TABLE whitedesk_tickets ADD COLUMN r2_attachment_key TEXT;
ALTER TABLE whitedesk_tickets ADD COLUMN escalation_stage INTEGER DEFAULT 0; -- 0: İlk atama, 1: 2. Admin, 2: Global Admin
ALTER TABLE whitedesk_tickets ADD COLUMN audit_trail TEXT;                    -- Geciken admin logları JSON dökümü

CREATE INDEX IF NOT EXISTS idx_tickets_assigned 
ON whitedesk_tickets (assigned_admin_blind_id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_sla_check 
ON whitedesk_tickets (status, created_at, last_admin_reply_at);
```

### C. Neon PostgreSQL: `whitedesk_system_config` (SLA Ayarı)
Kuruluş bazlı SLA süresini saklar:
- `key`: `sla_max_response_minutes`
- `value`: `15` | `30` | `60` | `120` | `240` | `1440` (Varsayılan: `30` dakika).

---

## ⚙️ 3. Tahsis (Allocation) ve Dengeleme Algoritması

1. **Çoklu Kategori & En Uygun Admin Seçimi:**
   Kullanıcı bilet açarken Cloudflare Worker `/api/tickets/allocate` endpoint'ine biletin `category`, `tenant_id`, `org_id`, `app_id` bilgilerini gönderir.
   Worker sorgusu:
   ```sql
   SELECT blind_id, name, counter, open_tickets, categories
   FROM admin_roster
   WHERE enterprise_blind_id = ?1
     AND org_id = ?2
     AND app_id = ?3
     AND is_active = 1
     AND date_time > unixepoch() - 120
     AND (categories LIKE '%"' || ?4 || '"%' OR categories LIKE '%"general"%' OR ?4 = 'general')
   ORDER BY
     (categories LIKE '%"' || ?4 || '"%') DESC,
     counter ASC,
     open_tickets ASC
   LIMIT 1;
   ```

2. **Aktif Admin Bulunamadığında Havuz Davranışı:**
   - İlgili kriterlerde aktif admin bulunamazsa bilet D1'e `assigned_admin_blind_id = 'unassigned'` olarak kaydedilir.
   - `recipient_blind_id` olarak firmanın `enterprise_blind_id` kök kimliği atanır.
   - Firmanın herhangi bir admini sisteme giriş yapıp aktifleştiğinde veya bilet listesini yenilediğinde havuzdaki bileti devralabilir.

3. **Mola/İzin Dönüşü Sayacı Tabana Çekme (%20 Dengeleme Kuralı):**
   - Admin uzun süre izinde kalıp döndüğünde, bilet sağanağına tutulmaması için sayacı o tenant/kategorideki aktif adminlerin en düşük sayacına eşitlenir.
   - Eğer seçilen kategorideki adminlerin ortalama sayacı `general` adminlerinden %20 fazlaysa, kategori sayacı genel tabana eşitlenir.

---

## ⏱️ 4. SLA Süresi ve Eskalasyon Zinciri

1. **Kuruluş ve Eskalasyon Kontrolü (Global Admin):**
   - Global Admin kuruluş ayarları / gelişmiş özellikler sayfasından eskalasyon işlevini açıp kapatabilir (`escalation.enabled = true/false`).
   - Bu işlev pasif edildiğinde bilet asla başka bir admine devredilmez, ilk atanan adminde kalır ve D1'de buharlaşmaz.
   - Aktif olduğunda, **"Admin Maksimum Cevap Süresi"** (15 dk, 30 dk, 1 sa, 2 sa, 4 sa, 24 sa veya özel) 7/24 sürekli sayaç olarak çalışır.
2. **Kullanıcı Cihazı Tetiklemesi (SLA Engine):**
   - Kullanıcı uygulamayı her açtığında, bilet listesine odaklandığında ve FCM bildirim uyandırmalarında:
     - Biletin `created_at` zamanı ile şu anki zaman farkı hesaplanır.
     - `last_admin_reply_at` boş ve süre dolmuşsa **İkiz Bilet** akışı başlatılır.
3. **Kademe 1 (Admin 2):**
   - Yeni admin seçilir, bilet Admin 2 için şifrelenir (`escalation_stage = 1`).
   - Admin 1'e `revoked` paketi fırlatılır. Paket D1 havuzunda **Bilet Kapama ve Çözüm Teyidi** süresince kalır.
4. **Kademe 2 (Global Admin):**
   - Admin 2 de süre içinde cevap vermezse bilet doğrudan firmanın Kurucu / Global Admin'ine atanır (`escalation_stage = 2`).
   - `audit_trail` alanına cevap vermeyen Admin 1 ve Admin 2'nin kimlikleri, atanma anındaki sayaçları ve açık bilet sayıları loglanır.

---

## 🎨 5. Arayüz (UI) Değişiklikleri

### A. Bilet Kartı (TicketCard) & Detay Ekranı
Tarih/saat satırının hemen altına, tarih formatı, font boyutu ve rengiyle birebir aynı stilde atama satırı eklenir:
- **İlk Atamada:**
  ```text
  Tarih: 28.10.2026 09:30
  Atandı: Ahmet Yılmaz (adm_node_7f...)
  ```
- **Zaman Aşımı / Yeniden Atamada:**
  ```text
  Tarih: 28.10.2026 09:30
  Yeniden Atandı: Mehmet Demir (adm_node_3c...)
  ```
- **Eski Adminin Ekranında:**
  - Bilet kartında `Eskale Edildi` (EN: `Escalated`) turuncu rozeti.
  - Bilet detayında yanıt alanı kilitli ve bilgilendirme kutusu:
    *"Bu bilet yanıt süresi aşıldığı için başka bir temsilciye aktarılmıştır. Yalnızca görüntüleyebilirsiniz."*

### B. Admin Durum Toggle'ı (Aktif / Molada)
- **3 Nokta Yönetici Menüsü:** Profil bölümünün içine `Durum: Aktif / Molada` toggle switch'i.
- **İsim Değiştirme Modalı (`IdentityModal`):**
  - Switch Toggle:
    - `is_active = 1`: **"Aktif (Bilet Almaya Hazır)"** (Yeşil badge).
    - `is_active = 0`: **"Molada / İzinde (Bilet Dağıtımı Durduruldu)"** (Turuncu badge).
  - Pasif seçildiğinde mola süresi seçimi: `15 dk`, `30 dk`, `1 saat`, `Ben açana kadar`.

### C. Kuruluş Ayarları (`SettingsStation`)
- **Admin Maksimum Cevap Süresi (SLA):**
  - Açılır menü / picker: `15 Dakika`, `30 Dakika`, `1 Saat`, `2 Saat`, `4 Saat`, `24 Saat`.

---

## 📊 6. Yönetici Değerlendirmeleri & Bilet Cevaplama Performansı

Yönetici Değerlendirmeleri ekranına (`AdminRatingsOverviewModal.tsx`) her admin için şu SLA metrikleri eklenir:

1. **Ortalama İlk Yanıt Süresi (Average First Response Time):**
   - Biletin oluşturulma tarihi ile adminin ilk mesajı (`last_admin_reply_at`) arasındaki ortalama süre (dakika/saat cinsinden).
2. **SLA Uyum Oranı (% SLA Compliance):**
   - Süresi içinde cevaplanan biletlerin toplam biletlere oranı.
3. **Geciken / Eskale Edilen Bilet Sayısı (Escalated Tickets):**
   - Adminin süresinde cevap vermediği için elinden alınan bilet adedi.
4. **Adil Dağıtım Sayacı (Fair-Share Counter) & Aktif Biletler:**
   - Adminin tamamladığı toplam bilet ve anlık açık bilet yükü.

Bu metrikler denetim ve kalite puanlamasında yıldız değerlendirmesiyle entegre olarak görüntülenir.

---

## 🔗 İlgili Dokümanlar
- **Master Bilet ve Rol Hiyerarşisi:** [ticket_hierarchy_and_roles.md](./ticket_hierarchy_and_roles.md)
- **Teknik Uygulama Planı:** [ticket_alloc_revoke_implementation_plan.md](./ticket_alloc_revoke_implementation_plan.md)
