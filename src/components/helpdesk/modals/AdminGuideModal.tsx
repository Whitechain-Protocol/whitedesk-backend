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
  ShieldCheck,
  UserCheck,
  ServerOff,
  Cloud,
  CheckSquare,
  Clock,
  Timer,
  Layers,
  Lock,
  Activity,
  Monitor,
  Mic,
  Database,
  Award,
  RefreshCw,
} from 'lucide-react-native';

interface AdminGuideModalProps {
  visible: boolean;
  onClose: () => void;
  language: string;
}

export const AdminGuideModal: React.FC<AdminGuideModalProps> = ({
  visible,
  onClose,
  language,
}) => {
  const { height: windowHeight } = useWindowDimensions();
  const modalContainerHeight = Math.round(windowHeight * 0.88);
  const isTr = language === 'tr';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.consoleModalOverlay}>
        <View style={[styles.consoleModalContainer, { height: modalContainerHeight }]}>
          {/* Üst Başlık Bölümü */}
          <View style={styles.consoleHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.consoleIconBox}>
                <BookOpen size={20} color="#2563EB" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.consoleTitleText}>
                  {isTr ? 'WhiteDesk Yönetici Kılavuzu' : 'WhiteDesk Admin Guide'}
                </Text>
                <Text style={styles.consoleSubtitleText}>
                  {isTr
                    ? 'Yönetim Masası, Özellikler ve Parametre El Kitabı'
                    : 'Administration, Features & Parameters Handbook'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.consoleCloseBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Kaydırılabilir Rehber Kartları */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled={true}
            overScrollMode="never"
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* 1. Sahiplik Kurulumu ve Küresel Yönetici Girişi */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <ShieldCheck size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr
                    ? '1. Sahiplik Kurulumu ve Küresel Yönetici Tescili'
                    : '1. Ownership Setup & Global Admin Provisioning'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '• Nerede Tanımlanır: İlk kurulumda bilet mesaj kutusuna "admin <kurumsal_anahtar>" yazılarak tetiklenir.\n' +
                    '• Parametreler: Lisansör tarafından sağlanan kurumsal açık anahtar kodu.\n' +
                    '• Nasıl Çalışır: Kod girildiği anda kurumsal veri tabanı tabloları otomatik devreye girer, cihazınızın açık anahtarı Küresel Yönetici olarak tescillenir ve kurumun açık anahtar sertifikası cihazınıza yüklenir.'
                  : '• Where to Define: Triggered via ticket message box: "admin <enterprise_key>".\n' +
                    '• Parameters: Organization public key supplied by licensor.\n' +
                    '• How it Works: Database tables activate immediately, your public key is registered as Global Admin, and the organization certificate is saved locally.'}
              </Text>
            </View>

            {/* 2. Kör Kimlik Mimarisi ve Sıfır Kişisel Veri */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <UserCheck size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr
                    ? '2. Kör Kimlik Mimarisi ve Sıfır Kişisel Veri'
                    : '2. Blind Identifier & Zero Personal Data'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '• Nerede Tanımlanır: 3 nokta menüsü > Profil Masası.\n' +
                    '• Parametreler: 12 kelimelik donanımsal güvenlik anahtarından türetilen tek yönlü kör kimlik kodu.\n' +
                    '• Nasıl Çalışır: Sistem ne kullanıcılardan ne de yöneticilerden telefon, e-posta veya gerçek ad soyad talep eder. Tüm işlemler kör kimlik üzerinden yürütülür; yasal ve kişisel veri saklama riskleri tamamen ortadan kalkar.'
                  : '• Where to Define: 3-dots menu > Profile Console.\n' +
                    '• Parameters: One-way blind ID derived from the device security seed.\n' +
                    '• How it Works: Zero phone numbers, emails, or real identities are required. All actions occur via blind IDs, eliminating privacy liabilities.'}
              </Text>
            </View>

            {/* 3. Sunucuda Sıfır Veri Prensibi ve Yerel Güvenlik */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <ServerOff size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr
                    ? '3. Sunucuda Sıfır Veri Prensibi'
                    : '3. Zero Data on Server Principle'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '• Nerede Tanımlanır: Sistem mimarisi ve bilet transfer katmanı.\n' +
                    '• Parametreler: Geçici iletim havuzu ve cihazda yerel saklama kuralları.\n' +
                    '• Nasıl Çalışır: İletişim sırasında bilet mesajları ve ekler aracı bulut üzerinde yalnızca geçici olarak şifreli bekletilir. Alıcı cihaza ulaştığında veya bilet kapatıldığında bulut üzerindeki geçici kayıtlar anında tamamen silinir; veriler yalnızca tarafların yerel cihazlarında saklanır.'
                  : '• Where to Define: System architecture and transit layer.\n' +
                    '• Parameters: Ephemeral transit pool and local device storage.\n' +
                    '• How it Works: Messages remain transiently encrypted on relay servers only until delivered. Once closed or delivered, cloud records are destroyed.'}
              </Text>
            </View>

            {/* 4. Bilet Havuzu ve Turuncu Bulut Simgesi */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Cloud size={14} color="#D97706" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr
                    ? '4. Bilet Havuzu ve Turuncu Bulut Simgesi'
                    : '4. Ticket Pool & Cloud Status Indicator'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '• Nerede Tanımlanır: Ana destek bilet listesi.\n' +
                    '• Parametreler: Atanmış yönetici kimliği boş olan biletler.\n' +
                    '• Nasıl Çalışır: Kullanıcıların yeni açtığı ve henüz hiçbir uzmanın üzerine almadığı sahipsiz talepler bilet kartı üzerinde turuncu bulut simgesiyle gösterilir. Bir yönetici bileti devraldığında bulut simgesi kalkar ve bilet doğrudan o uzmanın zimmetine geçer.'
                  : '• Where to Define: Main ticket list.\n' +
                    '• Parameters: Tickets with null assigned admin blind ID.\n' +
                    '• How it Works: Unclaimed tickets display an orange cloud icon. Once an admin claims the ticket, the cloud indicator disappears.'}
              </Text>
            </View>

            {/* 5. Bilet Operasyonları, Devralma ve Devretme Kuralları */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <CheckSquare size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr
                    ? '5. Bilet Operasyonları, Devralma ve Devretme Kuralları'
                    : '5. Ticket Ownership, Claim & Transfer Protocol'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '• Nerede Tanımlanır: Bilet detayında sağ üstteki 3 nokta menüsü ve Fısıltı sekmesi.\n' +
                    '• Parametreler: "Bileti Devral", "Birim Değiştir", "Bileti Devret", "Bileti Kapat/Sil".\n' +
                    '• Kurallar:\n' +
                    '  1. Ortak havuzda veya başka bir yöneticide duran biletlerde yalnızca "Bileti Devral" ve "Birim Değiştir" çıkar; devralınmamış bilette asla "Bileti Devret" seçeneği bulunmaz.\n' +
                    '  2. Bir yönetici yalnızca bizzat kendi üzerinde olan biletleri devredebilir veya silebilir.\n' +
                    '  3. "Fısıltı" sekmesi üzerinden son kullanıcının göremeyeceği iç yönetici notları şifreli paylaşılır.'
                  : '• Where to Define: Ticket detail 3-dots menu & Whisper tab.\n' +
                    '• Parameters: "Claim Ticket", "Change Unit", "Reassign Ticket", "Close/Delete".\n' +
                    '• Rules: Pool tickets only show Claim and Unit change. Reassignment is reserved for assigned owners. Whisper notes stay hidden from end-users.'}
              </Text>
            </View>

            {/* 6. Çalışma Durumu ve Akıllı Bilet Dağıtımı */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Clock size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr
                    ? '6. Çalışma Durumu ve Akıllı Bilet Dağıtımı'
                    : '6. Duty Status & Smart Routing'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '• Nerede Tanımlanır: 3 nokta menüsü > "Çalışma Durumu".\n' +
                    '• Parametreler: "Açık", "Mesai Bitti", "İzinli".\n' +
                    '• Nasıl Çalışır: Durumu "Mesai Bitti" veya "İzinli" olan yöneticilere sistem otomatik bilet ataması yapmaz. Bu biletler ortak havuzda turuncu bulut ile bekletilir veya nöbetçi yöneticilere dağıtılır.'
                  : '• Where to Define: 3-dots menu > "Working Status".\n' +
                    '• Parameters: "Active", "Off Duty", "On Leave".\n' +
                    '• How it Works: Off-duty operators are bypassed in automated ticket routing to ensure uninterrupted response times.'}
              </Text>
            </View>

            {/* 7. Bilet Cevaplama Süresi ve Otomatik Havuz İadesi */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Timer size={14} color="#EA580C" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr
                    ? '7. Bilet Cevaplama Süresi ve Zaman Aşımı Politikası'
                    : '7. Response Deadlines & Pool Return Policy'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '• Nerede Tanımlanır: 3 nokta menüsü > "Kuruluş Ayarları" masası.\n' +
                    '• Parametreler: İlk yanıt süresi limiti ve bilet çözüm süresi limiti (saat/dakika).\n' +
                    '• Nasıl Çalışır: Bilet kartında geri sayım saati başlar. Süre aşıldığında sistem yöneticiyi uyarır; biletin cevapsız kalmasını önlemek amacıyla talep otomatik olarak ortak bilet havuzuna iade edilir ve diğer uzmanların devralmasına açılır.'
                  : '• Where to Define: 3-dots menu > "Organization Settings".\n' +
                    '• Parameters: Response deadline and resolution threshold in hours/minutes.\n' +
                    '• How it Works: Live countdown timers monitor tickets. Overdue items trigger warnings and are automatically returned to the pool.'}
              </Text>
            </View>

            {/* 8. Yetkilendirme Masası (4 Temel Tablo) */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Layers size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr
                    ? '8. Birim, Uygulama ve Kategori Yetkilendirme Masası'
                    : '8. Role, Department & Category Management'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '• Nerede Tanımlanır: 3 nokta menüsü > "Yetkilendirme Masası".\n' +
                    '• Parametreler: Yöneticiler, Birimler, Uygulamalar ve Kategoriler (4 temel yapı).\n' +
                    '• Aşamalar:\n' +
                    '  1. Kademe: Kör kimlik girilerek yeni operatör eklenir veya yetkisi düzenlenir.\n' +
                    '  2. Kademe: Operatörün bağlı olacağı şube, birim ve uygulamalar belirlenir.\n' +
                    '  3. Kademe: Operatörün yalnızca uzman olduğu sorun kategorilerini görebilmesi için ilgili kategori yetkileri atanır.'
                  : '• Where to Define: 3-dots menu > "Provisioning Console".\n' +
                    '• Parameters: Admins, Units, Applications, Categories.\n' +
                    '• Execution: Step 1 assigns admin blind ID; Step 2 sets branches and apps; Step 3 defines allowed ticket categories.'}
              </Text>
            </View>

            {/* 9. Çift Onaylı Güvenlik ve Talep Kuyruğu */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Lock size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr
                    ? '9. Çift Onaylı Güvenlik ve Talep Kuyruğu'
                    : '9. Dual-Approval Security Queue'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '• Nerede Tanımlanır: 3 nokta menüsü > "Onay İstekleri Masası".\n' +
                    '• Parametreler: Operatör terfi istekleri, yönetici silme, birim ve uygulama kaldırma talepleri.\n' +
                    '• Nasıl Çalışır: Kritik operasyonlar doğrudan sisteme yansımaz; güvenlik kuyruğuna alınır. Küresel Yönetici tarafından ikinci bir onay verilmedikçe hiçbir kritik yetkilendirme veya silme işlemi yürürlüğe girmez.'
                  : '• Where to Define: 3-dots menu > "Approval Requests".\n' +
                    '• Parameters: Role promotions, admin removals, category/branch deletions.\n' +
                    '• How it Works: High-risk administrative actions are staged in a queue until validated and approved by the Global Admin.'}
              </Text>
            </View>

            {/* 10. Sistem ve Hata Tanısı İnceleme */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Activity size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr
                    ? '10. Sistem ve Hata Tanısı İnceleme'
                    : '10. System & Error Diagnostics Review'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '• Nerede Tanımlanır: Kullanıcı bilet açarken "Sistem ve Hata Tanısı Ekle" anahtarı; yönetici tarafında ise bilet içi "Sistem Tanısı" sekmesi.\n' +
                    '• Parametreler: Cihaz model bilgisi, ağ yanıt durum kodları, son işlem konsol kayıtları ve hata yığını.\n' +
                    '• Nasıl Çalışır: Kullanıcı izin verip eklediğinde bu veriler yöneticinin açık anahtarıyla mühürlenir. Yönetici, kullanıcıyı soru yağmuruna tutmadan hatanın kök nedenini tek ekranda inceler.'
                  : '• Where to Define: User enables "Add System Diagnostics"; admin inspects via "Diagnostics" tab.\n' +
                    '• Parameters: Device metrics, network status codes, console stack traces.\n' +
                    '• How it Works: User-approved diagnostic snapshots are decrypted on the admin device, expediting root-cause isolation.'}
              </Text>
            </View>

            {/* 11. Uzak Masaüstü ve Cihazda Otomatik Veri Maskeleme */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Monitor size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr
                    ? '11. Uzak Masaüstü Desteği ve Otomatik Veri Maskeleme'
                    : '11. Remote Desktop & On-Device Data Masking'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '• Nerede Tanımlanır: Bilet detay ekranı > "Uzak Masaüstü" butonu.\n' +
                    '• Parametreler: Karşılıklı şifreli eşler arası oturum onayı ve yerel maskeleme filtresi.\n' +
                    '• Nasıl Çalışır: Harici yazılım gerekmeden doğrudan uzak masaüstü bağlantısı kurulur. Kullanıcının ekranındaki şifre giriş alanları ve kişisel form verileri kullanıcının telefonunda otomatik karartılır; yönetici ekranına ham veri aktarılmaz. Yönetici canlı teknik desteği güvenle sağlar.'
                  : '• Where to Define: Ticket detail screen > "Remote Desktop" action.\n' +
                    '• Parameters: Mutual consent handshake and client-side redaction filter.\n' +
                    '• How it Works: Secure peer session connects without third-party tools. Passwords and sensitive inputs are masked locally before screen transmission.'}
              </Text>
            </View>

            {/* 12. Bilet İçi Sesli Görüşme, Bas-Konuş ve Telsiz Yayını */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Mic size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr
                    ? '12. Bilet İçi Sesli Görüşme, Bas-Konuş ve Telsiz Yayını'
                    : '12. Encrypted Voice, Push-to-Talk & Radio Dispatch'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '• Nerede Tanımlanır: Bilet üst bardaki Telefon ve Mikrofon simgeleri ile ana sayfadaki "Bir telsiz yayını başlat" düğmesi.\n' +
                    '• Parametreler: Doğrudan cihazdan cihaza ses kanalı, 15 saniyelik kendini imha eden bas-konuş süresi, ortak acil durum telsiz frekansı.\n' +
                    '• Nasıl Çalışır: Yazışmanın yetersiz olduğu anlarda doğrudan şifreli sesli arama yapılır. Bas-konuş mesajları dinlendikten sonra diskten kalıcı olarak parçalanarak silinir. Telsiz yayını ile tüm saha ekiplerine tek tuşla anons geçilir.'
                  : '• Where to Define: Ticket header phone/mic buttons & Home screen "Start Radio Broadcast".\n' +
                    '• Parameters: Peer-to-peer voice channel, 15-second self-shredding audio clips, shared dispatch frequency.\n' +
                    '• How it Works: Direct encrypted voice calls, zero-trace voice notes, and organization-wide push-to-talk radio alerts.'}
              </Text>
            </View>

            {/* 13. Federal Veri Hasadı ve FDH Denetim Masası */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Database size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr
                    ? '13. Federal Veri Hasadı ve FDH Denetim Masası'
                    : '13. Federal Data Harvesting & FDH Audit Console'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '• Nerede Tanımlanır: 3 nokta menüsü > "Federal Veri Hasadı" ve "FDH Sorgulama".\n' +
                    '• Parametreler: Hedef yönetici seçimi, kullanıcı kapsamı, yerel bağımsız veri tabanı çıktısı.\n' +
                    '• Nasıl Çalışır: Kurum verilerini üçüncü parti sunucularda tutmadan bağımsız kılmak için tek tuşla tüm biletler, gizli fısıltılar ve dosya ekleri yerel veri tabanına hasat edilir. İnternet bağlantısı olmasa dahi FDH Sorgulama ekranından tüm arşiv filtrelenip raporlanabilir.'
                  : '• Where to Define: 3-dots menu > "Federal Data Harvesting" & "FDH Query".\n' +
                    '• Parameters: Target administrator filter, user scope, local standalone database export.\n' +
                    '• How it Works: Collects tickets, whispers, and attachments into a local sovereign database with one touch, enabling offline search and audits.'}
              </Text>
            </View>

            {/* 14. Lisans ve Abonelik Masası (Yalnızca Küresel Yönetici) */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Award size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr
                    ? '14. Lisans ve Abonelik Masası'
                    : '14. License & Subscription Management'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '• Nerede Tanımlanır: Yalnızca Küresel Yönetici için 3 nokta menüsü > "Lisans & Abonelik" (Diğer kullanıcılara tamamen kapalıdır).\n' +
                    '• Parametreler:\n' +
                    '  - Temel Paket: Cihazda yerel AES-256 şifreleme, uçtan uca şifreleme, sunucuda sıfır veri, federal veri hasadı, cihazda otomatik veri maskeleme, kör kimlik koruması, sistem ve hata tanısı ekleme, çift onaylı yetki kuyruğu, mobil ve masaüstü istemcileri, sınırsız operatör ve kullanıcı, kategori ve organizasyon yönetimi, dosya ve ekran görüntüsü ekleri, gelişmiş denetim ve raporlama.\n' +
                    '  - Canlı Paket: Bütün temel özellikler, uzak masaüstü, bilet içi sesli arama, bilet içi bas-konuş ve telsiz yayını.\n' +
                    '  - Döngü Parametresi: Aylık veya Yıllık (%20 indirimli) faturalandırma seçeneği.'
                  : '• Where to Define: Exclusively for Global Admin via 3-dots > "License & Subscription".\n' +
                    '• Parameters: Core Plan (zero-knowledge, sovereign features) vs Live Plan (adds remote desktop, voice, radio); billing cycles (Monthly / Annual).'}
              </Text>
            </View>

            {/* 15. Afet Kurtarma ve Donanımsal Cihaz Değişimi */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <RefreshCw size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr
                    ? '15. Afet Kurtarma ve Donanımsal Cihaz Değişimi'
                    : '15. Disaster Recovery & Hardware Migration'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '• Nerede Tanımlanır: Lisansör yönetim konsolu üzerinden "wd run admin transfer" komutu ile.\n' +
                    '• Parametreler: Eski kurum adı ve yeni cihazın açık anahtar kimliği.\n' +
                    '• Nasıl Çalışır: Cihaz kaybolduğunda, bozulduğunda veya yeni telefona geçildiğinde yeni cihazdaki açık anahtar lisansöre iletilir. Yapılan aktarımla geçmiş tüm biletler, departmanlar, ayarlar ve yöneticilik yetkileri sıfır veri kaybıyla yeni cihaza bağlanır.'
                  : '• Where to Define: Licensor CLI console via "wd run admin transfer".\n' +
                    '• Parameters: Organization name and new hardware public key.\n' +
                    '• How it Works: If a device is lost or upgraded, ownership is migrated to the new hardware public key with zero data loss.'}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  consoleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  consoleModalContainer: {
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
    elevation: 16,
  },
  consoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
  consoleIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  consoleTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  consoleSubtitleText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  consoleCloseBtn: {
    padding: 6,
  },
  guideCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  guideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  guideNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  guideCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  guideCardBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18.5,
    textAlign: 'justify',
  },
});
