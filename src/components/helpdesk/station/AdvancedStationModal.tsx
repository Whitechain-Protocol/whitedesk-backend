import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Sliders, X } from 'lucide-react-native';
import { AdvancedFeaturesSection } from './AdvancedFeaturesSection';
import { AdvancedFeaturesConfig } from '../types';
import { OrgEntry } from '../../../services/helpDeskService';
import { useTranslation } from '../../../services/i18nService';

export interface AdvancedStationModalProps {
  visible: boolean;
  onClose: () => void;
  adminModalHeight: number;
  currentEnterpriseName: string;
  language?: string;
  config: AdvancedFeaturesConfig;
  onSave: (cfg: AdvancedFeaturesConfig) => Promise<void>;
  saving: boolean;
  getLabel?: (key: string, tr?: string, en?: string) => string;
  availableOrgs: OrgEntry[];
}

export const AdvancedStationModal: React.FC<AdvancedStationModalProps> = ({
  visible,
  onClose,
  adminModalHeight,
  currentEnterpriseName,
  language = 'tr',
  config,
  onSave,
  saving,
  getLabel,
  availableOrgs,
}) => {
  const { t } = useTranslation();
  const displayEnterpriseName =
    currentEnterpriseName &&
    !currentEnterpriseName.toLowerCase().includes('thewhite') &&
    !currentEnterpriseName.startsWith('blind_')
      ? currentEnterpriseName
      : 'Whitechain';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.fullScreenOverlay}>
        <View style={[styles.cardContainer, { height: adminModalHeight }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.iconBox}>
                <Sliders size={20} color="#3B82F6" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.titleText}>
                  {t('settings.advanced_features.menu_title')}
                </Text>
                <Text style={styles.subtitleText} numberOfLines={1}>
                  {displayEnterpriseName} • {t('settings.advanced_features.menu_subtitle')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1, width: '100%' }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            overScrollMode="always"
            contentContainerStyle={{ paddingBottom: 240 }}
          >
            <AdvancedFeaturesSection
              config={config}
              onSave={onSave}
              saving={saving}
              language={language}
              getLabel={getLabel}
              availableOrgs={availableOrgs}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  cardContainer: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
