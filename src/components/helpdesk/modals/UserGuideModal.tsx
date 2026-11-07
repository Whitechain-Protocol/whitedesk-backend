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
  Radio,
  Monitor,
  WifiOff,
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
          {/* Üst Başlık */}
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
                    ? 'Sıfır-Bilgi, Veri Güvenliği ve Şifreli Destek Masası'
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

          {/* Kaydırılabilir Kılavuz Kartları */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled={true}
            overScrollMode="never"
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* 1. ŞİFRELİ KİMLİK & SIFIR KİŞİSEL BİLGİ */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <KeyRound size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '1. Şifreli Cihaz Kimliği ve Kişisel Bilgi Gizliliği' : '1. Device Identity & Privacy Shield'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'WhiteDesk telefon numarası, e-posta adresi veya gerçek kimlik bilgilerinizi asla istemez ve kaydetmez. Uygulama ilk açıldığında cihazınızın güvenli donanım alanında 12 kelimelik gizli güvenlik anahtarı üretilir. Sistemdeki kimliğiniz, yalnızca cihazınızda çözülebilen şifreli bir kör kimlik ile korunur. Sağ üstteki üç nokta menüsünden takma adınızı belirleyebilir ve dilediğiniz zaman güncelleyebilirsiniz.'
                  : 'WhiteDesk never asks for personal details. A 12-word cryptographic key is generated locally on your device. Your identity is shielded by a one-way blind identifier. You can customize your display alias anytime via the top-right menu.'}
              </Text>
            </View>

            {/* 2. KURUMA BAĞLANMA */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Building2 size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '2. Kuruma Bağlanma ve Destek Masasını Açma' : '2. Connecting to Organization'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Hizmet aldığınız kurumun size sağladığı kurumsal açık anahtar kodunu bilet mesaj kutusuna yazıp gönderin. Cihazınız anında ilgili kurumun destek masasına güvenle bağlanır; kurum logosu, yetkili birimler ve departmanlar ekranınıza yüklenir.'
                  : 'Enter the organization public key into the message box. Your device connects instantly to the organization desk, loading official branding and authorized departments.'}
              </Text>
            </View>

            {/* 3. DESTEK BİLETİ OLUŞTURMA VE SÜREÇ TAKİBİ */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Ticket size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '3. Destek Bileti Oluşturma ve Adım Adım İşlem Süreci' : '3. Ticket Creation & Lifecycle'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Yeni bir bildirimde bulunmak için ana sayfadaki "Yeni bir bilet oluştur" düğmesine dokunun:\n\n' +
                    '• İsim Girişi Kuralı: Kurum ayarlarında isim girişi açıksa adınızı yazabilirsiniz. Eğer kurum bu ayarı kapattıysa adınız gizlenir ve biletiniz anonim olarak işleme alınır.\n' +
                    '• Birim ve Kategori Seçimi: Yaşadığınız sorunun ait olduğu birimi (Donanım, Ağ, Yazılım vb.) seçin. Doğru seçim, talebinizin doğrudan ilgili uzmana yönlendirilmesini sağlar.\n' +
                    '• Konu ve Açıklama: Sorununuzu özetleyen bir başlık ve ardından ayrıntılı açıklamasını yazın.\n' +
                    '• Özel Kurumsal Alanlar: Kurumun talep ettiği cihaz seri numarası, şube kodu veya benzeri alanlar varsa doldurun.\n' +
                    '• Bilet Durumları: Biletiniz Açık (uzman incelemesinde), Yanıtlandı (uzman cevap yazdı), Çözüldü (onayınız bekleniyor) ve Kapalı (arşivlendi) aşamalarıyla takip edilir.'
                  : 'Tap "Create New Ticket" to report an inquiry:\n\n' +
                    '• Name Entry Policy: Specify your name if allowed, otherwise submit anonymously.\n' +
                    '• Department & Category: Pick the correct category for direct routing.\n' +
                    '• Subject & Description: Provide concise details of your issue.\n' +
                    '• Status Tracking: Follow states through Open, Answered, Resolved, and Closed.'}
              </Text>
            </View>

            {/* 4. ÇEVRİMDIŞI ÇALIŞMA VE OTOMATİK EŞİTLEME */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <WifiOff size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '4. Çevrimdışı Çalışma ve Otomatik İletim' : '4. Offline Queue & Sync'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'İnternet bağlantınız olmadığında bile bilet açabilir ve mesaj yazabilirsiniz. Yazdığınız tüm içerikler cihazınızın yerel güvenli hafızasında saklanır. İnternet bağlantısı sağlandığı anda arka planda otomatik olarak şifrelenir ve ilgili masaya eksiksiz ulaştırılır.'
                  : 'Create tickets and send messages even without an internet connection. Content is stored locally on-device and automatically encrypted and dispatched once connectivity resumes.'}
              </Text>
            </View>

            {/* 5. DOSYA VE EKRAN GÖRÜNTÜSÜ EKLERİ */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Lock size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '5. Dosya, Belge ve Ekran Görüntüsü Ekleri' : '5. File & Image Attachments'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Bilet içerisindeki ataş simgesini kullanarak doğrudan kamerayla fotoğraf çekebilir, galerinizden arıza görseli seçebilir veya belge ekleyebilirsiniz. Eklenen fotoğraflara dokunarak tam ekran yakınlaştırabilir, detayları inceleyebilirsiniz. Eklenen tüm belgeler cihazdan çıkmadan önce şifrelenir.'
                  : 'Use the clip icon in ticket messages to capture camera photos, attach gallery images, or share documents. Tap any photo for full-screen inspection.'}
              </Text>
            </View>

            {/* 6. HASSAS BİLGİLERİN CİHAZDA OTOMATİK SANSÜRLENMESİ */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <EyeOff size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '6. Hassas Bilgilerin Cihazda Otomatik Maskelenmesi' : '6. Client-Side Data Masking'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Mesaj kutusuna yazılan kredi kartı numaraları, kimlik numaraları, banka hesap bilgileri veya parolalar cihazınızdan çıkmadan önce yerel güvenlik filtreleri tarafından tespit edilir. Bu hassas bilgiler sunucuya asla açık metin olarak gitmez; cihazınızda otomatik olarak yıldızlanır ve gizliliğiniz korunur.'
                  : 'Credit cards, personal ID numbers, and bank details typed into chat boxes are masked on-device before transmission, protecting sensitive data.'}
              </Text>
            </View>

            {/* 7. BİLET İÇİ CANLI SESLİ GÖRÜŞME VE BAS-KONUŞ */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Phone size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '7. Bilet İçi Sesli Görüşme ve Bas-Konuş' : '7. Voice Calling & Push-to-Talk'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Destek görüşmelerinde iki farklı sesli iletişim kanalı kullanabilirsiniz:\n\n' +
                    '• Şifreli Canlı Sesli Arama: Bilet ekranının sağ üstündeki telefon simgesine dokunarak uzmanla doğrudan sesli görüşme başlatabilirsiniz. Arama karşı tarafça onaylandığında cihazlar arasında doğrudan şifreli ses hattı kurulur.\n' +
                    '• Bas-Konuş Özelliği: Üst bardaki mikrofon simgesine basılı tutarak 15 saniyeye kadar sesinizi kaydedip gönderebilirsiniz. Parmağınızı çektiğiniz anda ses şifrelenerek uzmana iletilir. Vazgeçtiğinizde parmağınızı dışarı kaydırarak iptal edebilirsiniz.\n' +
                    '• İz Bırakmayan Ses İmhası: İletilen bas-konuş sesleri hiçbir sunucuda saklanmaz. Dinleme tamamlandığında ses kaydı hem cihaz hafızasından hem de diskten kalıcı olarak parçalanarak silinir.'
                  : 'Two voice channels are available:\n\n' +
                    '• Live Encrypted Calling: Tap the phone icon to start a direct call with staff.\n' +
                    '• Push-to-Talk: Press and hold the mic icon to record and transmit instant voice messages.\n' +
                    '• Zero-Trace Audio: Played voice clips are shredded permanently upon completion.'}
              </Text>
            </View>

            {/* 8. UZAK MASAÜSTÜ DESTEĞİ */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Monitor size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '8. Uzak Masaüstü Desteği' : '8. Remote Desktop Assistance'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Teknik sorunlarda harici bir uzaktan bağlantı programına ihtiyaç duyulmaz. Karşılıklı onay verdiğinizde uzman cihazınıza canlı uzak masaüstü bağlantısı gerçekleştirerek teknik onarımı doğrudan yapabilir. Şifre ve kişisel bilgi alanları uzmanın ekranında otomatik olarak karartılarak gizlenir.'
                  : 'No third-party tools required. Upon mutual consent, support staff establishes an encrypted remote desktop session while sensitive form fields remain redacted.'}
              </Text>
            </View>

            {/* 9. SİSTEM VE HATA TANISI EKLEME */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Activity size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '9. Sistem ve Hata Tanısı Ekleme' : '9. System & Error Diagnostics'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Bilet oluştururken isteğe bağlı olarak "Sistem ve Hata Tanısı Ekle" seçeneğini açabilirsiniz. Bu seçenek işaretlendiğinde cihazınızdaki son işlemlerin teknik durum kodları şifrelenerek biletinize iliştirilir; böylece uzman sorununuzu çok daha hızlı tespit edebilir. İstemezseniz bu seçeneği kapatabilir ve hiçbir tanı verisi göndermezsiniz.'
                  : 'Optionally enable "System & Error Diagnostics" during ticket creation. Encrypted technical diagnostic codes are attached to expedite issue resolution.'}
              </Text>
            </View>

            {/* 10. DEĞİŞTİRİLEMEZ İŞLEM MAKBUZU VE KENDİNİ İMHA ETME */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <FileCheck2 size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '10. Değiştirilemez İşlem Makbuzu ve Kendini İmha Etme' : '10. Proof Receipt & Self-Destruct'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Kapatılan her destek talebi için dijital imzalı bir işlem makbuzu üretilir. Bu makbuz, talebin ve tüm yazışmaların sonradan asla değiştirilemeyeceğini kanıtlar. Ayrıca kurumun belirlediği saklama süresi dolduğunda biletin şifre anahtarları cihazdan kalıcı olarak imha edilir ve yazışmalar okunamaz hale gelir.'
                  : 'Closed tickets generate a tamper-proof digital receipt. After the retention period expires, cryptographic keys self-destruct for maximum privacy.'}
              </Text>
            </View>

            {/* 11. HIZLI ARAMA VE BİLET FİLTRELEME */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Search size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '11. Canlı Arama ve Hızlı Filtreleme' : '11. Live Search & Filters'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Ana ekrandaki arama çubuğuna bilet numarası, konu başlığı veya açıklama kelimesi yazdığınızda liste siz yazdıkça anlık olarak süzülür. Arama kutusunun sağındaki çarpı (X) düğmesiyle filtreyi sıfırlayabilir; alt kısımdaki durum düğmelerinden (Tümü, Açık, Yanıtlandı, Çözüldü, Kapalı) taleplerinizi tek dokunuşla listeleyebilirsiniz.'
                  : 'Use the search box to find tickets by ID or keywords. Filter effortlessly by status tabs: All, Open, Answered, Resolved, and Closed.'}
              </Text>
            </View>

            {/* 12. HİZMET DEĞERLENDİRMESİ VE KAREKOD OKUYUCU */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Star size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '12. Hizmet Değerlendirmesi ve Karekod Okuyucu' : '12. Service Ratings & QR Reader'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Talebiniz çözüme kavuşturulduğunda aldığınız desteğe 1 ile 5 arasında yıldız puanı verebilir ve görüşlerinizi belirtebilirsiniz. Ayrıca ana sayfadaki karekod simgesiyle cihaz, envanter veya bilet karekodlarını kameranızla saniyeler içinde tarayabilirsiniz.'
                  : 'Rate resolved tickets with 1 to 5 stars. Tap the barcode icon on the dashboard to quickly scan device or ticket QR codes.'}
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
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
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
