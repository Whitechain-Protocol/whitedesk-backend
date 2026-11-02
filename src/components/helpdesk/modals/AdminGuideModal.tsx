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
import { BookOpen, X } from 'lucide-react-native';

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
          {/* Header */}
          <View style={styles.consoleHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.consoleIconBox}>
                <BookOpen size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.consoleTitleText}>
                  {isTr ? 'WhiteDesk Yönetici Kılavuzu' : 'WhiteDesk Admin Guide'}
                </Text>
                <Text style={styles.consoleSubtitleText}>
                  {isTr
                    ? 'Provizyon, Federal Hasat ve Teşhis Konsolu'
                    : 'Provisioning, Federal Harvesting & Diagnostics Console'}
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

          {/* Scrollable Guide Cards */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled={true}
            overScrollMode="never"
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* Section 1: Genesis Kurulumu */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Text style={styles.guideNumberText}>1</Text>
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr ? 'Genesis Kurulumu & İlk Sahiplenme' : 'Genesis Provisioning & First Claim'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? 'Lisansörün terminalden ürettiği "enterprise_white_id" anahtarını destek bilet mesaj kutusuna "admin <enterprise_white_id>" yazarak gönderin. Neon PostgreSQL tabloları anında açılır, cihazınız Global Yönetici olarak tescil edilir ve şirket açık anahtarınız (org_pub) otomatik indirilir.'
                  : 'Submit "admin <enterprise_white_id>" in the ticket message box. Neon PostgreSQL tables are provisioned immediately, your device is elevated to Global Admin, and the organization public key (org_pub) is automatically downloaded.'}
              </Text>
            </View>

            {/* Section 2: Bilet & Talep Yönetimi */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Text style={styles.guideNumberText}>2</Text>
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr ? 'Bilet Operasyonları & Gizli Fısıltı' : 'Ticket Operations & Whisper Notes'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? 'Gelen tüm biletleri departman ve rol filtreleriyle listeleyin. Bilet detayında kullanıcılara şifreli yanıt dönebilir, PDF ve fotoğraf ekleyebilirsiniz. Ayrıca "Fısıltı" sekmesiyle kullanıcıların göremeyeceği, yalnızca yöneticilere özel iç teknik notlar ekleyebilirsiniz.'
                  : 'Browse incoming tickets with department and role filters. Reply with encrypted messages and attachments. Use the "Whisper" feature to post internal operational notes visible only to fellow administrators.'}
              </Text>
            </View>

            {/* Section 3: 3 Kademeli Provizyon Konsolu */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Text style={styles.guideNumberText}>3</Text>
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr ? '3 Kademeli Provizyon Konsolu' : '3-Tier Linear Provisioning'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? 'Sağ üstteki 3 nokta menüsünden "Provizyon Masası"nı açın. Kademe 1: Yönetici seçin veya kör kimlik üzerinden operatör ekleyin (Global Admin / Admin). Kademe 2: Şube ve uygulama seçin. Kademe 3: Operatörün görebileceği departman kategorilerini atayarak yetkilendirin.'
                  : 'Access via 3-dots > "Provisioning Console". Tier 1: Select or add an admin via blind ID. Tier 2: Assign branch and application. Tier 3: Designate viewable department categories.'}
              </Text>
            </View>

            {/* Section 4: Personel Bağlama */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Text style={styles.guideNumberText}>4</Text>
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr ? 'Personel & Kullanıcı Masası Bağlantısı' : 'Staff & User Onboarding'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? 'Kurulumda inen "org_pub" açık anahtarını personellerinize iletin. Personeller bilet mesaj kutusuna "user <org_pub>" yazdıklarında yetkisiz son kullanıcı olarak şirket masasına bağlanır ve kendilerine atanmış birimlerden talep açabilir.'
                  : 'Share the "org_pub" certificate with your staff. Employees submit "user <org_pub>" in their ticket window to connect to the organization helpdesk as regular users.'}
              </Text>
            </View>

            {/* Section 5: Federal Veri Hasadı & FDH Sorgulama */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Text style={styles.guideNumberText}>5</Text>
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr ? 'Federal Veri Hasadı & FDH Sorgulama' : 'Federal Data Harvesting & FDH Audit'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? 'Şirket verilerini üçüncü parti bulutlara bağımlı kalmadan iç bünyede tutmak için 3 nokta menüsünden "Federal Veri Hasadı"nı başlatın. Seçilen admin veya kullanıcı kapsamındaki tüm bilet, fısıltı ve ekler yerel SQLite (.sqlite) dosyasına veya şirket içi PostgreSQL sunucusuna yazılır. "FDH Sorgulama" ekranından çevrimdışı taranabilir.'
                  : 'Maintain sovereign in-house control by running "Federal Data Harvesting" via 3-dots. Extracted tickets, whispers, and attachments are saved to local SQLite or on-premise PostgreSQL. Review and filter records offline via the "FDH Query" tool.'}
              </Text>
            </View>

            {/* Section 6: Sıfır-Bilgi BlackBox Teşhisi */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Text style={styles.guideNumberText}>6</Text>
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr ? 'BlackBox Hata Tanısı & Log İnceleme' : 'BlackBox Diagnostics & Trace Inspection'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? 'Kullanıcı bilet açtığında cihazında toplanan son 30 saniyelik konsol logları, ağ yanıt kodları ve hata yığını (stack trace) açık anahtarınızla mühürlenmiş olarak gelir. Bilet detayındaki "Sistem ve Hata Tanısı" panelini kendi anahtarınızla açarak kullanıcıya sormadan sorunun kök nedenini saniyeler içinde teşhis edebilirsiniz.'
                  : 'Client crash dumps, console errors, and HTTP network traces are packaged on-device and encrypted with your admin public key. Expand the BlackBox panel on the ticket view to inspect the root cause without asking the user for logs.'}
              </Text>
            </View>

            {/* Section 7: Canlı Lazer Eş-Gezinme (Blind Co-Browsing) */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Text style={styles.guideNumberText}>7</Text>
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr ? 'Lazerli Eş-Gezinme (Blind Co-Browsing)' : 'Laser Co-Browsing (Blind Co-Browsing)'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? 'Kullanıcıyla karşılıklı onaylı P2P WebRTC oturumu açarak kullanıcının ekranını pikselsiz DOM/durum senkronizasyonuyla izleyin. Kırmızı lazer işaretçi ile kullanıcının dokunması gereken butonu işaret edin. Kullanıcının girdiği şifreler veya kart numaraları yöneticinin ekranında otomatik maskelenir.'
                  : 'Launch a peer-to-peer WebRTC session with mutual consent. Guide the user in real time using an on-screen laser pointer. Sensitive form inputs (passwords, cards) are redacted client-side, remaining completely invisible to the admin.'}
              </Text>
            </View>

            {/* Section 8: Instant Replay & Tersine Hayalet (State Restoration) */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Text style={styles.guideNumberText}>8</Text>
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr ? 'Instant Replay & Durum Kurtarma' : 'Instant Replay & State Restoration'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? 'Hata öncesindeki 30 saniyelik kullanıcı dokunma rotasını pikselsiz simülatör çubuğunda ileri-geri sararak hatayı birebir canlandırın. Sorunu çözdüğünüzde "Onarılmış Durum Kartı" göndererek kullanıcıyı doğrudan hatayı yaşadığı ekrana düzeltilmiş parametrelerle ışınlayın.'
                  : 'Replay the user’s pre-incident actions and navigation stream on a timeline scrubber. Once fixed, dispatch a State Restoration deep-link card to transport the user directly into the resolved view with pre-repaired state.'}
              </Text>
            </View>

            {/* Section 9: Yönetici Değerlendirmeleri & Performans */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Text style={styles.guideNumberText}>9</Text>
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr ? 'Yönetici Değerlendirmeleri & KPI Matrisi' : 'Admin Ratings & CSAT Performance'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? '3 nokta menüsünden "Yönetici Değerlendirmeleri" konsolunu açarak kullanıcıların verdiği 1-5★ memnuniyet puanlarını, başarı oranlarını ve yazılı notları inceleyin. Kurucu yetkisiyle Firma, Birim ve Uygulama bazında filtreleme yaparak organizasyonel verimliliği ölçün.'
                  : 'Open "Admin Ratings" via 3-dots to analyze 1-5 star CSAT feedback, resolution ratios, and qualitative reviews. Utilize dynamic Tenant, Org, and App filters to benchmark operational performance.'}
              </Text>
            </View>

            {/* Section 10: Afet Kurtarma & Cihaz Kaybı */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Text style={styles.guideNumberText}>10</Text>
                </View>
                <Text style={styles.guideCardTitle}>
                  {isTr ? 'Afet Kurtarma & Cihaz Değişimi' : 'Disaster Recovery & Transfer'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {isTr
                  ? 'Cihaz kaybolduğunda ve 12 kelimelik tohum yedeği olmadığında: Yeni telefondaki WhiteID lisansöre bildirilir. Lisansör terminalden "wd run admin transfer org:\"<Firma>\" to:\"<YeniWhiteID>\"" çalıştırır. Geçmiş tüm biletler, şubeler ve ayarlar 0 bayt veri kaybıyla yeni cihaza aktarılır.'
                  : 'If a device is lost without a 12-word seed backup: Report the new WhiteID to the licensor. The licensor executes "wd run admin transfer". All past tickets, departments, and configurations are migrated with zero data loss.'}
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
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  guideNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
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
