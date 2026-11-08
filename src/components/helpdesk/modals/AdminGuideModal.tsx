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
import { useTranslation } from '../../../services/i18nService';

interface AdminGuideModalProps {
  visible: boolean;
  onClose: () => void;
  language: string;
}

export const AdminGuideModal: React.FC<AdminGuideModalProps> = ({
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
                  {t('helpdesk.admin_guide.title')}
                </Text>
                <Text style={styles.consoleSubtitleText}>
                  {t('helpdesk.admin_guide.subtitle')}
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
                  {t('helpdesk.admin_guide.card1_title')}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {t('helpdesk.admin_guide.card1_body')}
              </Text>
            </View>

            {/* 2. Kör Kimlik Mimarisi ve Sıfır Kişisel Veri */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <UserCheck size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {t('helpdesk.admin_guide.card2_title')}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {t('helpdesk.admin_guide.card2_body')}
              </Text>
            </View>

            {/* 3. Sunucuda Sıfır Veri Prensibi ve Yerel Güvenlik */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <ServerOff size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {t('helpdesk.admin_guide.card3_title')}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {t('helpdesk.admin_guide.card3_body')}
              </Text>
            </View>

            {/* 4. Bilet Havuzu ve Turuncu Bulut Simgesi */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Cloud size={14} color="#D97706" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {t('helpdesk.admin_guide.card4_title')}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {t('helpdesk.admin_guide.card4_body')}
              </Text>
            </View>

            {/* 5. Bilet Operasyonları, Devralma ve Devretme Kuralları */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <CheckSquare size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {t('helpdesk.admin_guide.card5_title')}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {t('helpdesk.admin_guide.card5_body')}
              </Text>
            </View>

            {/* 6. Çalışma Durumu ve Akıllı Bilet Dağıtımı */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Clock size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {t('helpdesk.admin_guide.card6_title')}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {t('helpdesk.admin_guide.card6_body')}
              </Text>
            </View>

            {/* 7. Bilet Cevaplama Süresi ve Otomatik Havuz İadesi */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Timer size={14} color="#EA580C" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {t('helpdesk.admin_guide.card7_title')}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {t('helpdesk.admin_guide.card7_body')}
              </Text>
            </View>

            {/* 8. Yetkilendirme Masası (4 Temel Tablo) */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Layers size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {t('helpdesk.admin_guide.card8_title')}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {t('helpdesk.admin_guide.card8_body')}
              </Text>
            </View>

            {/* 9. Çift Onaylı Güvenlik ve Talep Kuyruğu */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Lock size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {t('helpdesk.admin_guide.card9_title')}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {t('helpdesk.admin_guide.card9_body')}
              </Text>
            </View>

            {/* 10. Sistem ve Hata Tanısı İnceleme */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Activity size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {t('helpdesk.admin_guide.card10_title')}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {t('helpdesk.admin_guide.card10_body')}
              </Text>
            </View>

            {/* 11. Uzak Masaüstü ve Cihazda Otomatik Veri Maskeleme */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Monitor size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {t('helpdesk.admin_guide.card11_title')}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {t('helpdesk.admin_guide.card11_body')}
              </Text>
            </View>

            {/* 12. Bilet İçi Sesli Görüşme, Bas-Konuş ve Telsiz Yayını */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Mic size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {t('helpdesk.admin_guide.card12_title')}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {t('helpdesk.admin_guide.card12_body')}
              </Text>
            </View>

            {/* 13. Federal Veri Hasadı ve FDH Denetim Masası */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Database size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {t('helpdesk.admin_guide.card13_title')}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {t('helpdesk.admin_guide.card13_body')}
              </Text>
            </View>

            {/* 14. Lisans ve Abonelik Masası (Yalnızca Küresel Yönetici) */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <Award size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {t('helpdesk.admin_guide.card14_title')}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {t('helpdesk.admin_guide.card14_body')}
              </Text>
            </View>

            {/* 15. Afet Kurtarma ve Donanımsal Cihaz Değişimi */}
            <View style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={styles.guideNumberBadge}>
                  <RefreshCw size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.guideCardTitle}>
                  {t('helpdesk.admin_guide.card15_title')}
                </Text>
              </View>
              <Text style={styles.guideCardBody}>
                {t('helpdesk.admin_guide.card15_body')}
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
