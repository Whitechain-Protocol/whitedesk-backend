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
import { useTranslation } from '../../../services/i18nService';

interface UserGuideModalProps {
  visible: boolean;
  onClose: () => void;
  language: string;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  visible,
  onClose,
}) => {
  const { t } = useTranslation();
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
                  {t('helpdesk.user_guide.title')}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {t('helpdesk.user_guide.subtitle')}
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
                  {t('helpdesk.user_guide.card1_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.user_guide.card1_body')}
              </Text>
            </View>

            {/* 2. KURUMA BAĞLANMA */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Building2 size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.user_guide.card2_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.user_guide.card2_body')}
              </Text>
            </View>

            {/* 3. DESTEK BİLETİ OLUŞTURMA VE SÜREÇ TAKİBİ */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Ticket size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.user_guide.card3_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.user_guide.card3_body')}
              </Text>
            </View>

            {/* 4. ÇEVRİMDIŞI ÇALIŞMA VE OTOMATİK EŞİTLEME */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <WifiOff size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.user_guide.card4_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.user_guide.card4_body')}
              </Text>
            </View>

            {/* 5. DOSYA VE EKRAN GÖRÜNTÜSÜ EKLERİ */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Lock size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.user_guide.card5_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.user_guide.card5_body')}
              </Text>
            </View>

            {/* 6. HASSAS BİLGİLERİN CİHAZDA OTOMATİK SANSÜRLENMESİ */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <EyeOff size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.user_guide.card6_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.user_guide.card6_body')}
              </Text>
            </View>

            {/* 7. BİLET İÇİ CANLI SESLİ GÖRÜŞME VE BAS-KONUŞ */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Phone size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.user_guide.card7_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.user_guide.card7_body')}
              </Text>
            </View>

            {/* 8. UZAK MASAÜSTÜ DESTEĞİ */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Monitor size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.user_guide.card8_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.user_guide.card8_body')}
              </Text>
            </View>

            {/* 9. SİSTEM VE HATA TANISI EKLEME */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Activity size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.user_guide.card9_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.user_guide.card9_body')}
              </Text>
            </View>

            {/* 10. DEĞİŞTİRİLEMEZ İŞLEM MAKBUZU VE KENDİNİ İMHA ETME */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <FileCheck2 size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.user_guide.card10_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.user_guide.card10_body')}
              </Text>
            </View>

            {/* 11. HIZLI ARAMA VE BİLET FİLTRELEME */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Search size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.user_guide.card11_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.user_guide.card11_body')}
              </Text>
            </View>

            {/* 12. HİZMET DEĞERLENDİRMESİ VE KAREKOD OKUYUCU */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Star size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.user_guide.card12_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.user_guide.card12_body')}
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
