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
  ShieldCheck,
  X,
  Lock,
  EyeOff,
  Radio,
  FileCheck2,
  Trash2,
  CheckCircle2,
  FileText,
} from 'lucide-react-native';

interface SecurityPrivacyModalProps {
  visible: boolean;
  onClose: () => void;
  language: string;
}

export const SecurityPrivacyModal: React.FC<SecurityPrivacyModalProps> = ({
  visible,
  onClose,
  language,
}) => {
  const isTr = language === 'tr';
  const { height: windowHeight } = useWindowDimensions();
  const modalContainerHeight = Math.round(windowHeight * 0.85);

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
                <ShieldCheck size={20} color="#2563EB" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.headerTitle}>
                  {isTr ? 'Gizlilik ve Güvenlik Politikası' : 'Security & Privacy Policy'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {isTr
                    ? 'Sıfır-Bilgi Mimarisi & Kriptografik Şeffaflık'
                    : 'Zero-Knowledge Architecture & Cryptographic Transparency'}
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

          {/* Scrollable Privacy Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled={true}
            overScrollMode="never"
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* 1. Sıfır Kişisel Veri İlkesi */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <EyeOff size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '1. Sıfır Kişisel Veri (Zero Personal Data)' : '1. Zero Personal Data Principle'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'WhiteDesk hiçbir telefon numarası, gerçek ad, e-posta veya rehber erişimi talep etmez. Oturumlar, kullanıcının cihazında güvenli donanım tarafından üretilen anonim kriptografik kimliklerle (WhiteID ve Körleştirilmiş Blind ID) yürütülür. Sistem mimarisi gereği kullanıcıyı fiziksel dünyada teşhis etmek teknik olarak olanaksızdır.'
                  : 'WhiteDesk never collects phone numbers, real names, email addresses, or contact lists. Sessions operate strictly on anonymous cryptographic keys (WhiteID and Blind ID) generated on-device. By design, personal profiling or real-world identification is technically impossible.'}
              </Text>
            </View>

            {/* 2. Uçtan Uca Şifreleme (E2EE) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Lock size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '2. Uçtan Uca Şifreleme (E2EE)' : '2. End-to-End Encryption (E2EE)'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Tüm destek biletleri, mesajlar ve dosya ekleri (kamera, fotoğraf, PDF) gönderilmeden önce istemci cihazında AES-256-GCM ve Curve25519 standartlarıyla şifrelenir. Sunucular ve veri tabanı yalnızca okunamaz şifreli blokları (ciphertext) aktarır; sunucu yöneticileri dahi mesaj içeriklerini asla göremez.'
                  : 'All tickets, chat messages, and attachments (camera, photos, PDFs) are encrypted on-device prior to transmission using AES-256-GCM and Curve25519. Relays and databases only store ciphertext; neither servers nor administrators can decrypt message contents.'}
              </Text>
            </View>

            {/* 3. Sesli Arama ve Canlı Telsiz Güvenliği */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Radio size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '3. Gerçek Zamanlı Ses ve Telsiz Güvenliği' : '3. Real-Time Audio & PTT Security'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Sesli görüşmeler doğrudan WebRTC P2P tüneli üzerinden uçtan uca şifreli olarak gerçekleşir. Bas-Konuş (PTT) ses patlamaları yalnızca bilet anahtarıyla mühürlenir, karşı cihazda oynatıldıktan sonra tampon bellekten (RAM) ve depolamadan kalıcı olarak imha edilir.'
                  : 'Voice calls are conducted over peer-to-peer WebRTC encrypted tunnels. Push-to-Talk (PTT) voice bursts are encrypted per-ticket and permanently wiped from volatile memory (RAM) immediately after playback.'}
              </Text>
            </View>

            {/* 4. Kendini İmha Eden Talepler (TTL Key Shredding) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Trash2 size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '4. Kriptografik Anahtar İmhası (Self-Destruct)' : '4. Cryptographic Key Shredding'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Çözüme kavuşturulup kapatılan taleplerin simetrik oturum anahtarları, belirlenen saklama süresi (24 saat, 72 saat veya 7 gün) dolduğunda cihazların güvenli donanım deposundan kalıcı olarak sıfırlanır (CryptoKey.destroy). Süresi dolan veriler çözülemez gürültüye dönüşür.'
                  : 'Symmetric session keys of resolved tickets are cryptographically destroyed from secure device storage upon expiration (24h, 72h, or 7d). Expired ciphertexts permanently turn into undecryptable mathematical noise.'}
              </Text>
            </View>

            {/* 5. Değişmezlik İspatı (Merkle Kriptografik Makbuz) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <FileCheck2 size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '5. Değişmezlik İspatı (Cryptographic Receipts)' : '5. Mathematical Proof of Integrity'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Kapanan talepler için tüm mesaj hash’lerinin kronolojik dizilimiyle bir Merkle Kök Özeti hesaplanır. Tarafların dijital imzalarıyla mühürlenen .json formatındaki Değişmezlik Makbuzu, hizmet sağlayıcı veya kullanıcı tarafından tek taraflı değiştirilemez kanıt niteliği taşır.'
                  : 'Upon ticket closure, a Merkle Root Hash is computed across all chronological message hashes. Sealed with dual digital signatures, the downloadable .json receipt provides tamper-evident proof that neither party can alter.'}
              </Text>
            </View>

            {/* 6. İzleyici ve Reklam Yokluğu (Zero Tracking & Ads) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <CheckCircle2 size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '6. Reklam ve Üçüncü Taraf İzleyici Yoktur' : '6. No Third-Party Ads or Analytics'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'WhiteDesk uygulamasında hiçbir reklam kütüphanesi, kullanıcı davranış takipçisi (analytics SDK) veya veri simsarı entegrasyonu yer almaz. Google Play Store ve Apple App Store gizlilik gereksinimleriyle %100 uyumludur.'
                  : 'WhiteDesk contains zero commercial ad SDKs, behavioral trackers, or data broker modules. It is 100% compliant with Google Play Store and Apple App Store strict privacy frameworks.'}
              </Text>
            </View>

            {/* 7. Kullanıcı Hakları ve Veri Silme Politikası */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <FileText size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {isTr ? '7. Veri Silme ve Kullanıcı Hakları (KVKK / GDPR)' : '7. Data Deletion & User Rights (GDPR)'}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {isTr
                  ? 'Kullanıcı dilediği zaman uygulamanın verilerini temizleyerek tüm yerel anahtarlarını cihazından silebilir. Sistemde hiçbir kişisel kimlik verisi tutulmadığı için silme işlemi kriptografik olarak anında tamamlanır.'
                  : 'Users may clear app data at any time, instantly wiping cryptographic keys from the device. Since no personally identifiable information is stored server-side, privacy erasure is immediate and complete.'}
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
    maxWidth: 540,
    overflow: 'hidden',
    shadowColor: '#000',
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
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 50,
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
  },
  closeBtn: {
    padding: 6,
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
    width: 24,
    height: 24,
    borderRadius: 12,
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
    lineHeight: 18,
    textAlign: 'justify',
  },
});
