import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  useWindowDimensions,
} from 'react-native';
import {
  BookOpen,
  X,
  KeyRound,
  Building2,
  Ticket,
  Search,
  Lock,
  Phone,
  Mic,
  Sliders,
  FileCheck2,
  Clock,
  Star,
  QrCode,
  ShieldCheck,
  EyeOff,
  Activity,
  PlayCircle,
  MousePointer2,
  ExternalLink,
  Database,
  Filter,
} from 'lucide-react-native';

interface UserGuideModalProps {
  visible: boolean;
  onClose: () => void;
  language: string;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  visible,
  onClose,
  language,
}) => {
  const isTr = language === 'tr';
  const { height: windowHeight } = useWindowDimensions();
  const modalContainerHeight = Math.round(windowHeight * 0.88);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { height: modalContainerHeight }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.iconBox}>
                <BookOpen size={20} color="#2563EB" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.headerTitle}>
                  {isTr ? 'WhiteDesk Kullanım Kılavuzu' : 'WhiteDesk User Manual'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {isTr
                    ? 'Sıfır-Bilgi, Veri Egemenliği ve Şifreli Destek Mimarisi'
                    : 'Zero-Knowledge, Sovereign & Encrypted Helpdesk Architecture'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Guide Sections */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled={true}
            overScrollMode="never"
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* 1. KRİPTOGRAFİK KİMLİK & SIFIR KİŞİSEL VERİ */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <KeyRound size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '1. Kriptografik Kimlik & Sıfır Kişisel Veri' : '1. Cryptographic Identity & Zero PII'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'WhiteDesk hiçbir telefon numarası, e-posta veya gerçek isim toplamaz. İlk açılışta cihazınızda donanım seviyesinde 12 kelimelik kriptografik tohum (Seed Phrase) üretilir. Kimliğiniz bu anahtardan türetilen WhiteID ve tek yönlü HMAC-SHA256 kör kimlik (Blind ID) ile korunur. Sağ üstteki 3 nokta menüsünden "Kendinizi Tanımlayın" sekmesine girerek biletlerde görünecek takma adınızı (Alias) dilediğiniz zaman belirleyebilirsiniz.'
                  : 'WhiteDesk never collects phone numbers, emails, or real identities. A 12-word cryptographic seed phrase is generated locally on-device. Identity is shielded via WhiteID and one-way HMAC-SHA256 Blind ID. Set your preferred display alias anytime via 3-dots > "Identity & Alias".'}
              </Text>
            </View>

            {/* 2. KURUMA BAĞLANMA & MASAYA GİRİŞ */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Building2 size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '2. Kuruma Bağlanma & Masaya Giriş' : '2. Connecting to Organization Helpdesk'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Hizmet aldığınız kurumdan size iletilen açık anahtarı (org_pub) bilet mesaj kutusuna "user <org_pub>" formatında yazıp gönderin. Güvenli bulut katmanı sizi şirketin destek masasına bağlar; kurumun logosu, yetkilendirilmiş birimleri ve uygulamaları anında ekranınıza yüklenir.'
                  : 'Submit "user <org_pub>" in the message box using the certificate shared by your organization. You are instantly bound to the corporate helpdesk, loading official branding and department categories.'}
              </Text>
            </View>

            {/* 3. DESTEK BİLETİ OLUŞTURMA & SÜREÇ TAKİBİ */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Ticket size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '3. Destek Bileti Oluşturma & Adım Adım İşlem Süreci' : '3. Ticket Creation & Step-by-Step Lifecycle'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Talebinizi iletmek için ana ekranda yer alan mavi "Yeni bir bilet oluştur" butonuna dokunarak formu açın:\n\n' +
                    '• Ad Soyad Girişi Kuralı: Kuruluş ayarlarında ad soyad girişi açık bırakılmışsa bilette görünecek adınızı yazabilirsiniz. Eğer kuruluş bu ayarı kapattıysa adınız gizli tutulur, işlem anonim kimlikle yürütülür ve bu biletler birimler arası transfere kapalı kalır.\n' +
                    '• Birim & Kategori Seçimi: Sorununuzun ait olduğu birimi (Donanım, Ağ, Yazılım, Güvenlik vb.) seçin. Doğru birim seçimi talebinizin saniyeler içinde yetkili personele yönlendirilmesini sağlar.\n' +
                    '• Konu ve Açıklama: Yaşadığınız aksaklığı net biçimde anlatan bir konu başlığı ve ardından ayrıntılı açıklama girin.\n' +
                    '• Kurumsal Özel Alanlar: Kurumunuz tarafından tanımlanmış özel alanlar (Ör: Cihaz Seri No, Mac Adresi, Şube Kodu vb.) varsa ilgili kutuları doldurun.\n' +
                    '• Fotoğraf & Belge Ekleme: Bilet içindeki ataş (+) butonuyla kamerayla anlık çekim yapabilir, galeriden arıza görseli ekleyebilir veya PDF dokümanı yükleyebilirsiniz. Eklenen fotoğraflara dokunarak tam ekran yakınlaştırmalı önizleme yapabilirsiniz.\n' +
                    '• Çevrimdışı Kuyruk (Offline Queue): İnternet bağlantınız kopsa bile bilet oluşturabilir ve mesaj yazabilirsiniz. Sistem iletileri yerel güvenli SQLite veri tabanına kaydeder; internete bağlanıldığı anda tüm veriler otomatik olarak şifrelenip ilgili masaya teslim edilir.\n' +
                    '• Bilet Durumları: Talebiniz Açık (uzman incelemesinde), Yanıtlandı (uzman yanıt yazdı), Çözüldü (sorun giderildi, onayınız bekleniyor) ve Kapalı (arşivlendi, Merkle makbuzu üretildi) rozetleriyle anlık güncellenir.'
                  : 'Tap the blue "Create New Ticket" button on the main dashboard to report an incident:\n\n' +
                    '• Name Entry Policy: If the enterprise enables name entry, you can specify your display name. If disabled, identity remains strictly anonymous and ticket transfers between departments are blocked.\n' +
                    '• Department & Category: Select the appropriate group (Hardware, Network, Software, Security, etc.) for instant automated dispatch.\n' +
                    '• Subject & Description: Provide a concise summary followed by clear step-by-step problem details.\n' +
                    '• Custom Fields: Complete any organization-mandated fields (e.g. Serial Number, MAC address, Branch ID).\n' +
                    '• Attachments & Photos: Use the clip (+) icon to attach camera snapshots, gallery images, or PDF manuals. Tap any photo for full-screen inspection.\n' +
                    '• Offline Queue: Works seamlessly without internet. Tickets and replies persist in local SQLite and auto-sync securely once connectivity resumes.\n' +
                    '• Lifecycle Stages: Real-time badges reflect Open (pending review), Answered (staff responded), Resolved (fix confirmed, awaiting CSAT), and Closed (sealed with Merkle receipt).'}
              </Text>
            </View>

            {/* 4. AKILLI ARAMA VE HIZLI FİLTRELEME FONKSİYONLARI */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Search size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '4. Akıllı Arama & Hızlı Filtreleme Fonksiyonları' : '4. Smart Search & Quick Filter Functions'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Biletlerinizi ve geçmiş kayıtlarınızı zahmetsizce bulmak için ana ekrandaki arama ve filtreleme araçlarını kullanabilirsiniz:\n\n' +
                    '• Canlı Arama Çubuğu: Arama kutusuna bilet numarası (#ID), konu başlığı, açıklama metni veya uzman takma adından herhangi bir kelime yazın. Arama motoru siz yazdıkça biletleri anlık olarak süzer.\n' +
                    '• Tek Dokunuşla Temizleme: Arama çubuğunun sağında beliren (X) ikonuna dokunarak arama filtresini anında sıfırlayabilir ve tüm listenize geri dönebilirsiniz.\n' +
                    '• Durum Filtre Sekmeleri: Arama alanının altındaki durum düğmelerini kullanarak biletleri kategorize edin:\n' +
                    '  - Tümü: Geçmiş ve aktif tüm destek talepleri.\n' +
                    '  - Açık: Henüz çözümlenmemiş ve işlem sırasındaki biletler.\n' +
                    '  - Yanıtlandı: Uzmandan yeni mesaj gelen ve incelemenizi bekleyenler.\n' +
                    '  - Çözüldü: Onarımı tamamlanmış biletler.\n' +
                    '  - Kapalı: Arşivlenmiş ve kriptografik olarak mühürlenmiş biletler.\n' +
                    '• Birim ve Uygulama Filtreleme: Menüden belirli bir birimi seçerek sadece o departmana açılmış biletlerinizi listeleyebilirsiniz.'
                  : 'Effortlessly locate past and current tickets using real-time search and filter tools:\n\n' +
                    '• Live Search Bar: Type ticket ID, subject line, description keywords, or staff aliases. The view updates instantly as you type.\n' +
                    '• Quick Clear: Tap the (X) icon to instantly reset your query and restore the full ticket list.\n' +
                    '• Status Filter Tabs: Filter tickets with dedicated tabs:\n' +
                    '  - All: Complete ticket history.\n' +
                    '  - Open: Unresolved active inquiries.\n' +
                    '  - Answered: Inquiries with new responses from support staff.\n' +
                    '  - Resolved: Completed tickets pending user verification.\n' +
                    '  - Closed: Cryptographically sealed and archived tickets.\n' +
                    '• Department Scoping: Select specific units from the menu to scope results to a single operational team.'}
              </Text>
            </View>

            {/* 5. İSTEMCİ TARAFLI PII MASKELEME (KVKK / GDPR) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <EyeOff size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '5. İstemci Taraflı Otomatik PII Maskeleme (KVKK / GDPR)' : '5. Client-Side PII Auto-Redaction'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Mesaj kutusuna veya formlara kazara yazılan kredi kartı numaraları, T.C. Kimlik Numaraları, IBAN bilgileri ve hassas şifreler cihazınızdan çıkmadan önce yerel filtreler tarafından anında tespit edilir. Bu veriler ağa ve sunucuya asla açık metin olarak iletilmez; yerelde otomatik olarak sansürlenerek kurumun ve sizin yasal gizliliğiniz garanti altına alınır.'
                  : 'Credit card numbers, national IDs, IBANs, and passwords entered into chat boxes are intercepted client-side before transmission. Sensitive payload patterns are automatically redacted into safe tokens, ensuring full GDPR/KVKK compliance.'}
              </Text>
            </View>

            {/* 6. UÇTAN UCA ŞİFRELİ MESAJLAŞMA & EKLER */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Lock size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '6. Uçtan Uca Şifreli Mesajlaşma & Ekler' : '6. E2EE Messaging & Attachments'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Bilet içi tüm yazışmalar cihazınızda AES-256-GCM ve Curve25519 ile şifrelenir; sunucular veya aracılar mesaj içeriklerini asla göremez. Ataş (+) simgesini kullanarak kamera çekimi, galeri fotoğrafı veya PDF dokümanlarını güvenle ekleyip gönderebilirsiniz. Gönderilen fotoğraflara dokunarak tam ekran yakınlaştırmalı önizleme yapabilirsiniz.'
                  : 'All chat communications are encrypted on-device before transmission via AES-256-GCM and Curve25519. Tap the attachment clip (+) to securely send photos or PDF documents. Tap photos for full-screen inspection.'}
              </Text>
            </View>

            {/* 7. SIFIR-BİLGİ HATA KARATAHTASI (BLACKBOX) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Activity size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '7. Sıfır-Bilgi Hata Karatahtası (BlackBox Tanısı)' : '7. Zero-Knowledge Diagnostic BlackBox'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Teknik arıza bildirimlerinde "ekran görüntüsü alma" veya "hata logu kopyalama" zahmetine gerek kalmaz. Bir hata oluştuğunda son 30-60 saniyelik konsol logları, ağ durum kodları ve cihaz hata yığını (stack trace) istemcide toplanır, yetkili yöneticinin açık anahtarıyla mühürlenir ve bilet tanısına otomatik iliştirilir. Şifreyi yalnızca ilgili yönetici açabilir.'
                  : 'Eliminates the friction of asking users for screenshots or console logs. Upon errors, recent console logs, HTTP status codes, and crash traces are packaged client-side, encrypted with the admin public key, and attached to the ticket.'}
              </Text>
            </View>

            {/* 8. INSTANT REPLAY SANDBOX (EYLEM SİMÜLASYONU) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <PlayCircle size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '8. Pikselsiz Eylem Akışı (Instant Replay Sandbox)' : '8. Pixel-Free Action Replay Sandbox'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Sorun bildiriminden önceki son 30 saniyelik dokunma, tıklama ve ekran rotaları video çekilmeden, tamamen hafif ve pikselsiz bir eylem akışı olarak dondurulur. Yönetici, sorunu anlamak için bu akışı zaman çubuğu üzerinden adım adım canlandırarak arızanın kaynağını canlı bir simülasyon olarak inceleyebilir.'
                  : 'Recent user interactions and screen transitions prior to an incident are captured as lightweight, pixel-free event vectors. Support admins can replay and scrub through the timeline to pinpoint UX or system issues without video recording overhead.'}
              </Text>
            </View>

            {/* 9. KÖR EŞ-GEZİNME & LAZER İŞARETÇİ (BLIND CO-BROWSING) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <MousePointer2 size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '9. Kör Eş-Gezinme & Lazer İşaretçi (Blind Co-Browsing)' : '9. Blind Co-Browsing & Laser Guidance'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Karmaşık işlemlerde ek bir uzaktan bağlantı programı kurmaya gerek yoktur. Karşılıklı onay verildiğinde şifreli WebRTC üzerinden pikselsiz durum senkronizasyonu başlar. Yönetici ekranınızda kırmızı lazer işaretçi ile nereye tıklamanız gerektiğini canlı gösterir; şifre ve kişisel alanlar yöneticinin ekranında otomatik gizlenir.'
                  : 'Zero third-party screen sharing tools required. Upon mutual consent, peer-to-peer WebRTC DOM state sync activates. The admin guides you with an on-screen laser pointer, while private form inputs remain strictly masked from the admin view.'}
              </Text>
            </View>

            {/* 10. TERSİNE HAYALET & DURUM KURTARMA (DEEP-LINK STATE RESTORATION) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <ExternalLink size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '10. Tersine Hayalet & Durum Kurtarma (State Restoration)' : '10. Reverse Ghost & State Restoration'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Yönetici sorunu çözüp bileti kapattığında veya güncelleme yaptığında size bir "Onarılmış Ekran Kartı" iletilir. Bu karta dokunduğunuzda, uygulamanın hata yaşadığınız tam ilgili ekranına, düzeltilmiş ve kurtarılmış durum verisiyle (State) anında ışınlanırsınız; formu baştan doldurmanıza gerek kalmaz.'
                  : 'When an admin resolves an issue, a State Restoration card is dispatched. Tapping the card deep-links you directly back into the originating screen with pre-repaired parameters, eliminating repetitive manual data re-entry.'}
              </Text>
            </View>

            {/* 11. UÇTAN UCA ŞİFRELİ SESLİ ARAMA & TELSİZ (PTT) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Phone size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '11. Şifreli Sesli Arama & Canlı Telsiz (PTT Bas-Konuş)' : '11. Encrypted Voice Calling & Live PTT Radio'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Sesli iletişim için iki farklı egemen kanal sunulur:\n\n' +
                    '• Şifreli Canlı Sesli Arama: Bilet ekranının sağ üst köşesindeki telefon simgesine dokunarak uzmanla birebir görüşme talebi başlatın. Çağrı karşı tarafça kabul edildiğinde doğrudan cihazlar arası (P2P WebRTC) şifreli ses hattı kurulur. Görüşme süresince ekran altından Mikrofonu Kapat/Aç (Mute), Hoparlör Modu ve Çağrıyı Sonlandır kontrollerini yönetebilirsiniz.\n' +
                    '• Bas-Konuş Telsiz Mandalı (PTT): Bilet üst panelindeki mikrofon simgesine basılı tutun. Canlı ses dalgası animasyonu eşliğinde 15 saniyeye kadar acil telsiz sesinizi kaydedin. Parmağınızı çektiğiniz anda ses paketi cihazınızda AES-256 ile şifrelenip telsiz mandalı uyarısıyla doğrudan uzmana iletilir. Vazgeçerseniz parmağınızı mikrofon butonunun dışına kaydırarak iptal edebilirsiniz.\n' +
                    '• Sıfır-İz & Bellek İmhası (Zero-Trace Audio): Telsiz sesleri hiçbir sunucuda depolanmaz. Dinlenen telsiz ses kayıtları oynatma tamamlandığı anda cihazın hem geçici RAM belleğinden hem de yerel diskinden anında kalıcı olarak silinir ve parçalanır (Zero-Trace Disposal).'
                  : 'Two sovereign voice options are available:\n\n' +
                    '• Encrypted P2P Voice Calling: Tap the phone icon in the top right of the ticket header to initiate a direct call. Once accepted, a peer-to-peer WebRTC encrypted voice channel connects directly without intermediate recording servers. Manage Mute, Speaker mode, and End Call seamlessly.\n' +
                    '• Push-to-Talk (PTT Live Intercom): Press and hold the microphone icon in the top bar to record up to 15 seconds with live waveform feedback. Releasing the button encrypts the audio with AES-256 and transmits it like a radio burst. Slide away to cancel.\n' +
                    '• Zero-Trace Audio Shredding: Voice packets are never persisted on cloud relays. Played audio fragments are permanently shredded from both RAM and local storage upon completion.'}
              </Text>
            </View>

            {/* 12. DEĞİŞMEZLİK İSPATI (KRİPTOGRAFİK MAKBUZ) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <FileCheck2 size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '12. Değişmezlik İspatı (Kriptografik Makbuz)' : '12. Cryptographic Proof of Integrity'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Kapanan her bilet için tüm mesaj hash’lerinin kronolojik dizilimiyle bir Merkle Kök Özeti (Root Hash) hesaplanır. Tarafların dijital imzalarını taşıyan bu .json makbuz, talebin ve yazışmaların sonradan asla değiştirilemeyeceğini matematiksel olarak kanıtlar. Cihazınıza indirilip saklanabilir.'
                  : 'Upon ticket closure, a cryptographic Merkle Root Hash is computed across all chronologically ordered messages. Sealed with digital signatures, the downloadable .json receipt provides tamper-proof mathematical evidence of the entire resolution.'}
              </Text>
            </View>

            {/* 13. KENDİNİ İMHA EDEN TALEPLER (TTL KEY SHREDDING) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Clock size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '13. Kendi Kendini İmha Eden Talepler (TTL Key Shredding)' : '13. Self-Destructing Tickets (TTL)'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Çözüme kavuşturulup kapatılan talepler, kurumun belirlediği yaşam süresi (24 saat, 72 saat veya 7 gün) dolduğunda yerel cihazınızdan simetrik oturum anahtarlarını kalıcı olarak siler (CryptoKey.destroy). Süresi dolan biletlerin metinleri çözülemez matematiksel gürültüye dönüşerek mutlak gizlilik sağlar.'
                  : 'Resolved tickets undergo automatic cryptographic key destruction upon TTL expiration (24h, 72h, or 7d). Expired tickets turn into permanently undecryptable ciphertext, guaranteeing absolute forward secrecy.'}
              </Text>
            </View>

            {/* 14. MEMNUNİYET DEĞERLENDİRMESİ & QR TARAYICI */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Star size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '14. Memnuniyet Puanı & QR Tarayıcı' : '14. Satisfaction Rating & QR Scanner'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Talebiniz kapatıldığında destek personeline 1-5 arası yıldız puanı verebilir ve değerlendirme notu ekleyebilirsiniz. Ayrıca ana ekrandaki barkod simgesiyle cihaz veya bilet QR kodlarını kameranızla anında tarayabilirsiniz.'
                  : 'Submit a 1-5 star CSAT rating and feedback note upon ticket resolution. Use the top barcode scanner icon to quickly scan device or ticket QR codes.'}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 0,
    width: '100%',
    maxWidth: 560,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    padding: 6,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 50,
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  cardBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18.5,
    textAlign: 'justify',
  },
});
