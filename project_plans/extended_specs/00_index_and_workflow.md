# WhiteDesk Yıkıcı Özellikler Paketi (Master Index & Workflow)

Bu dizin, WhiteDesk'in geleneksel yardım masalarını (Zendesk, Kayako, Freshdesk, Jira) teknik ve operasyonel olarak geride bırakmasını sağlayan 6 temel yıkıcı modülün mimari ve geliştirme şartnamelerini içerir.

---

## Modül Dizini

| Dosya Adı | Modül | Odak Alanı | Temel Avantaj |
| :--- | :--- | :--- | :--- |
| `01_zero_knowledge_blackbox.md` | **Zero-Knowledge BlackBox** | Hata Teşhisi | Sıfır yazışmayla istemcide anında mühürlü hata kaydı ve stack trace. |
| `02_client_side_pii_redaction.md` | **Client-Side PII Redaction** | KVKK/GDPR Uyumu | Kart, kimlik ve şifreleri sunucuya ulaşmadan istemcide otomatik maskeleme. |
| `03_ephemeral_blind_co_browsing.md` | **Blind Co-Browsing** | Canlı Destek | Kurulumsuz, videosuz, şifreli WebRTC DOM senkronizasyonu ve lazer işaretçi. |
| `04_one_click_vault_export.md` | **Cryptographic Vault Export** | Veri Egemenliği | Tek tıkla tüm arşivi taşınabilir, şifreli SQLite kasası olarak indirme. |
| `05_deep_link_state_restoration.md` | **Deep-Link State Restoration** | Tersine Hayalet Çağrı | Bilet çözüldüğünde kullanıcıyı sorun yaşanan ekrana onarılmış state ile ışınlama. |
| `06_instant_replay_sandbox.md` | **Instant Replay Sandbox** | Durum Simülasyonu | Son 30 saniyenin pikselsiz eylem akışını zaman çubuğuyla adım adım canlandırma. |

---

## Geliştirme ve Uygulama Sırası (Roadmap Workflow)

1. **Aşama 1 - Temel Güvenlik ve İstemci Zırhı:**
   - `02_client_side_pii_redaction.md`: İstemci metin kutusuna girilen ve yüklenen her şey önce yerelde taranır ve maskelenir.
2. **Aşama 2 - Hata Teşhis ve Durum Yakalama:**
   - `01_zero_knowledge_blackbox.md`: Konsol ve ağ hataları mühürlenip pakete iliştirilir.
   - `06_instant_replay_sandbox.md`: Son 30 saniyelik eylem akışı (action stream) dondurulur ve yönetici paneline simülatör olarak bağlanır.
3. **Aşama 3 - Canlı Etkileşim:**
   - `03_ephemeral_blind_co_browsing.md`: WebRTC altyapısına bağlanır. İki taraf bilet üzerinden doğrudan canlı eş-gezinmeye geçer.
4. **Aşama 4 - Reaktif Çözüm ve Durum Kurtarma:**
   - `05_deep_link_state_restoration.md`: Bilet kapandığında kullanıcıyı doğrudan kaldığı adıma taşıyan Reverse Ghost Card ve State Restoration döngüsü kurulur.
5. **Aşama 5 - Arşiv ve Kasa Egemenliği:**
   - `04_one_click_vault_export.md`: Masaüstü yönetim konsoluna eklenir. Şirket tüm kurumsal hafızasını tek tıkla taşınabilir kasaya çeker.
