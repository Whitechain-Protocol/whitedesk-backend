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
import { useTranslation } from '../../../services/i18nService';

interface SecurityPrivacyModalProps {
  visible: boolean;
  onClose: () => void;
  language: string;
}

export const SecurityPrivacyModal: React.FC<SecurityPrivacyModalProps> = ({
  visible,
  onClose,
}) => {
  const { t } = useTranslation();
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
                  {t('helpdesk.security_privacy.title')}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {t('helpdesk.security_privacy.subtitle')}
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
                  {t('helpdesk.security_privacy.card1_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.security_privacy.card1_body')}
              </Text>
            </View>

            {/* 2. Uçtan Uca Şifreleme (E2EE) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Lock size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.security_privacy.card2_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.security_privacy.card2_body')}
              </Text>
            </View>

            {/* 3. Sesli Arama ve Canlı Telsiz Güvenliği */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Radio size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.security_privacy.card3_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.security_privacy.card3_body')}
              </Text>
            </View>

            {/* 4. Kendini İmha Eden Talepler (TTL Key Shredding) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Trash2 size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.security_privacy.card4_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.security_privacy.card4_body')}
              </Text>
            </View>

            {/* 5. Değişmezlik İspatı (Merkle Kriptografik Makbuz) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <FileCheck2 size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.security_privacy.card5_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.security_privacy.card5_body')}
              </Text>
            </View>

            {/* 6. İzleyici ve Reklam Yokluğu (Zero Tracking & Ads) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <CheckCircle2 size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.security_privacy.card6_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.security_privacy.card6_body')}
              </Text>
            </View>

            {/* 7. Kullanıcı Hakları ve Veri Silme Politikası */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <FileText size={14} color="#2563EB" strokeWidth={2.2} />
                </View>
                <Text style={styles.cardTitle}>
                  {t('helpdesk.security_privacy.card7_title')}
                </Text>
              </View>
              <Text style={styles.cardBody}>
                {t('helpdesk.security_privacy.card7_body')}
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
