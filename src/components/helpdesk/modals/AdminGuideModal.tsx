import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
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
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.consoleModalOverlay}>
        <View style={styles.consoleModalContainer}>
          {/* Header */}
          <View style={styles.consoleHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.consoleIconBox}>
                <BookOpen size={20} color="#3B82F6" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.consoleTitleText}>
                  {language === 'tr' ? 'WhiteDesk Yönetici Kılavuzu' : 'WhiteDesk Admin Guide'}
                </Text>
                <Text style={styles.consoleSubtitleText}>
                  {language === 'tr' ? 'Genesis, Provizyon ve İdari Operasyonlar' : 'Genesis, Provisioning & Admin Operations'}
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
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {/* Section 1: Genesis Kurulumu */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Text style={styles.guideNumberText}>1</Text>
                </View>
                <Text style={styles.guideCardTitle}>
                  {language === 'tr' ? 'Genesis Kurulumu & İlk Sahiplenme' : 'Genesis Provisioning & First Claim'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {language === 'tr'
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
                  {language === 'tr' ? 'Bilet (Ticket) Operasyonları' : 'Ticket Management Operations'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {language === 'tr'
                  ? 'Gelen tüm biletleri listeleyin ve departman filtreleriyle inceleyin. Bilet detayına girerek yanıtlayabilir, ataş simgesiyle PDF belgesi veya fotoğraf ekleyebilirsiniz. Üst durum hapına dokunarak bilet durumunu tek tıkla Açık / Kapalı yapabilirsiniz.'
                  : 'Browse incoming tickets with department filters. Tap any ticket to view history, reply, or attach PDFs and images. Tap the status pill to toggle between Open and Closed.'}
              </Text>
            </View>

            {/* Section 3: 3 Kademeli Provizyon Konsolu */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Text style={styles.guideNumberText}>3</Text>
                </View>
                <Text style={styles.guideCardTitle}>
                  {language === 'tr' ? '3 Kademeli Provizyon Konsolu' : '3-Tier Linear Provisioning'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {language === 'tr'
                  ? 'Sağ üstteki kalkan simgesine basarak açılır. Kademe 1: Yönetici seçin veya "+ Yeni Yönetici Ekle" ile kör kimlik üzerinden operatör ekleyin (Global Admin / Admin). Kademe 2: Şube ve uygulama seçin. Kademe 3: Görebileceği kategorileri seçip yetkilendirin.'
                  : 'Access via the top-right Shield badge. Tier 1: Select or add an admin via blind-ID. Tier 2: Choose branch and application. Tier 3: Assign department categories.'}
              </Text>
            </View>

            {/* Section 4: Personel Bağlama */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Text style={styles.guideNumberText}>4</Text>
                </View>
                <Text style={styles.guideCardTitle}>
                  {language === 'tr' ? 'Personel & Kullanıcı Bağlantısı' : 'Staff & User Onboarding'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {language === 'tr'
                  ? 'Kurulumda inen "org_pub" açık anahtarını personellerinize iletin. Personeller mesaj kutusuna "user <org_pub>" yazdıklarında yetkisiz son kullanıcı olarak şirket masasına bağlanır ve departman biletleri açabilir.'
                  : 'Share the "org_pub" certificate with your staff. Employees submit "user <org_pub>" in their ticket window to connect to the organization helpdesk as regular users.'}
              </Text>
            </View>

            {/* Section 5: Afet Kurtarma & Cihaz Kaybı */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Text style={styles.guideNumberText}>5</Text>
                </View>
                <Text style={styles.guideCardTitle}>
                  {language === 'tr' ? 'Afet Kurtarma & Cihaz Değişimi' : 'Disaster Recovery & Transfer'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {language === 'tr'
                  ? 'Cihaz kaybolduğunda ve 12 kelimelik tohum yedeği olmadığında: Yeni telefondaki WhiteID lisansöre bildirilir. Lisansör terminalden "wd run admin transfer org:\"<Firma>\" to:\"<YeniWhiteID>\"" çalıştırır. Geçmiş tüm biletler, şubeler ve ayarlar 0 byte veri kaybıyla yeni cihaza aktarılır.'
                  : 'If your device and 12-word seed are lost: Share your new WhiteID with the licensor. The licensor runs "wd run admin transfer". All historical tickets and allocations are preserved with zero data loss.'}
              </Text>
            </View>

            {/* Section 6: Sıfır-Bilgi & Kör Kimlik */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Text style={styles.guideNumberText}>6</Text>
                </View>
                <Text style={styles.guideCardTitle}>
                  {language === 'tr' ? 'Sıfır-Bilgi (Zero-Knowledge) Güvencesi' : 'Zero-Knowledge Security Assurance'}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {language === 'tr'
                  ? 'Sistemde hiçbir merkezi ana şifre bulunmaz. Veritabanına hiçbir zaman açık WhiteID yazılmaz; tüm kimlikler tek yönlü HMAC-SHA256 (blind_id) ile saklanır.'
                  : 'Zero centralized master passwords. WhiteIDs are never stored in plaintext; all identities are blinded irreversibly via HMAC-SHA256.'}
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  consoleModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
  },
  consoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  consoleIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
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
    backgroundColor: '#3B82F6',
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
    lineHeight: 18,
  },
});
