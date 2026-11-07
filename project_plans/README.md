# 📚 WhiteDesk Master Uygulama Planları & Mimari Dokümantasyon İndeksi

Bu klasör, WhiteDesk mimarisinin tüm çekirdek süreçlerini, sıfır-bilgi (Zero-Knowledge) güvenlik standartlarını, Cloudflare D1/R2 veri düzlemini, Neon kontrol düzlemini ve arayüz uygulama planlarını tek bir çatı altında toplar.

---

## 📑 1. Bilet Tahsisi, Roller ve Yetki Geri Alma (Hierarchy, Allocation & Revocation)

- **[ticket_hierarchy_and_roles.md](./ticket_hierarchy_and_roles.md):**
  - **Master Bilet ve Rol Hiyerarşisi Şartnamesi.**
  - Kullanıcılar, Bölüm Adminleri, Global Adminler ve Kurucu (TheWhite) arasındaki bilet türleri (Mavi Standart, Mavi Discussion, Yeşil Destek/Eskalasyon), UI tetikleyicileri, fan-out dağıtım modelleri ve tam yönlendirme matrisi.
- **[Ticket_alloc_revoke.md](./Ticket_alloc_revoke.md):** 
  - Master mimari şartname (v2.0). 
  - Sıfır-bilgi ikiz bilet mekanizması (Paket A / Paket B), D1 `admin_roster` tablosu, adil dağıtım sayacı (%20 dengeleme), mola/izin dönüşü tabana çekme ve eskalasyon zinciri.
- **[ticket_alloc_revoke_implementation_plan.md](./ticket_alloc_revoke_implementation_plan.md):** 
  - Adım adım teknik geliştirme ve uygulama kontrol listesi (Faz 1 - Faz 5).
- **[ticket_processes_and_texts_plan.md](./ticket_processes_and_texts_plan.md):** 
  - Bilet durum geçişleri, metin standartları, "Bileti Devret" ve "Transfer Et" terminolojisi.

---

## 🔐 2. Sıfır-Bilgi Güvenlik & Genişletilmiş Özellikler (`extended_features/`)

- **[00_index_and_workflow.md](./extended_features/00_index_and_workflow.md):** Sıfır-bilgi ekosistemi ana iş akışı ve modül haritası.
- **[01_zero_knowledge_blackbox.md](./extended_features/01_zero_knowledge_blackbox.md):** Kara kutu (Blackbox) şifreleme ve istemci tarafı anahtar yönetimi.
- **[02_client_side_pii_redaction.md](./extended_features/02_client_side_pii_redaction.md):** İstemci tarafı kişisel veri (PII) maskeleme ve sansürleme.
- **[03_ephemeral_blind_co_browsing.md](./extended_features/03_ephemeral_blind_co_browsing.md):** Uçucu kör ortak ekran/oturum izleme mimarisi.
- **[04_one_click_vault_export.md](./extended_features/04_one_click_vault_export.md):** Tek tıkla yerel Keystore kasası dışa aktarma ve yedekleme.
- **[05_deep_link_state_restoration.md](./extended_features/05_deep_link_state_restoration.md):** Kriptografik derin link ile durum kurtarma.
- **[06_instant_replay_sandbox.md](./extended_features/06_instant_replay_sandbox.md):** Hata anı yeniden oynatma ve korumalı kum havuzu (Sandbox).

---

## ☁️ 3. Bulut Altyapısı, Ağ ve İletişim

- **[cloudflare.md](./cloudflare.md):** Cloudflare Workers, Durable Objects, D1 Database ve R2 Object Storage entegrasyon kuralları.
- **[communication_and_push_plan.md](./communication_and_push_plan.md):** Google FCM Push bildirimleri, VoIP PushKit, WebRTC sinyalleşmesi ve Telsiz (PTT) firma izolasyonu mimarisi.
- **[CALLSCREEN_STANDARD.md](./CALLSCREEN_STANDARD.md):** Canlı sesli arama ve Bas-Konuş telsiz ekran standartları.

---

## 🎨 4. Arayüz, Modallar ve Provizyon Planları

- **[guncellenen_giris_ekranlari.md](./guncellenen_giris_ekranlari.md):** Giriş ve kurulum (Genesis) ekranlarının düzeltilen Türkçe metinleri ve PNG önizlemeleri.
- **[profile_modal_and_menu_plan.md](./profile_modal_and_menu_plan.md):** 3 nokta yönetici menüsü, `IdentityModal` ve Aktif/Molada durum yönetimi.
- **[provisioning_long_press_actions_plan.md](./provisioning_long_press_actions_plan.md):** Provizyon konsolu, uzun basma aksiyonları ve operatör yetkilendirme akışları.
- **[advanced_architecture_and_ui_plan.md](./advanced_architecture_and_ui_plan.md):** Gelişmiş istasyon mimarisi ve bileşen hiyerarşisi.
- **[advanced_features_plan.md](./advanced_features_plan.md):** İleri düzey kurumsal tercihler ve yapılandırma planı.
- **[compose_header_plan.md](./compose_header_plan.md):** Bilet yazma ve mesajlaşma başlık bileşeni planı.

---

## 💼 5. Lisanslama, İş Akışları ve Ajan İlkeleri

- **[pricing.md](./pricing.md):** WhiteDesk lisans planları, operatör/müşteri eklenti paketleri ve kriptografik yükseltme karmaları.
- **[workflow.md](./workflow.md):** Genel sistem iş akışları ve operasyonel döngüler.
- **[AGENT_MANDATES.md](./AGENT_MANDATES.md):** Kod tabanı geliştirme prensipleri, sıfır-bilgi kırmızı çizgileri ve mimari kurallar.
- **[prompt.md](./prompt.md):** Çekirdek sistem master tanımları.
