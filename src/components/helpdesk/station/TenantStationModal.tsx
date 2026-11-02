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
import { ShieldCheck, X } from 'lucide-react-native';
import { GeminiSectionKey } from '../types';
import { TenantProfileSection } from './TenantProfileSection';
import { TenantLicenseSection } from './TenantLicenseSection';
import { TenantStaffSection } from './TenantStaffSection';
import { AdminEntry, HelpDeskCategory } from '../../../services/helpDeskService';

interface TenantStationModalProps {
  visible: boolean;
  onClose: () => void;
  language: string;
  currentEnterpriseName: string;
  activeEnterpriseBlindId: string;
  expandedSection: GeminiSectionKey;
  setExpandedSection: React.Dispatch<React.SetStateAction<GeminiSectionKey>>;
  onCopyBlindId: (id: string) => void;
  tenantStats: { adminCount: number; userCount: number };
  onGenerateOperatorAddon: () => void;
  onGenerateUserAddon: () => void;
  copiedConsoleHash: string | null;
  adminsList: AdminEntry[];
  selectedAdminId: string;
  onSelectAdmin: (id: string) => void;
  onRemoveAdmin: (id: string) => void;
  onGenerateOperatorInvite: () => void;
  selectedCatIds: string[];
  currentAppCategories: HelpDeskCategory[];
  onToggleCategory: (catId: string) => void;
  onSaveAllocation: () => void;
  tAllLabel: string;
}

export const TenantStationModal: React.FC<TenantStationModalProps> = ({
  visible,
  onClose,
  language,
  currentEnterpriseName,
  activeEnterpriseBlindId,
  expandedSection,
  setExpandedSection,
  onCopyBlindId,
  tenantStats,
  onGenerateOperatorAddon,
  onGenerateUserAddon,
  copiedConsoleHash,
  adminsList,
  selectedAdminId,
  onSelectAdmin,
  onRemoveAdmin,
  onGenerateOperatorInvite,
  selectedCatIds,
  currentAppCategories,
  onToggleCategory,
  onSaveAllocation,
  tAllLabel,
}) => {
  const { height: windowHeight } = useWindowDimensions();
  const modalContainerHeight = Math.round(windowHeight * 0.86);

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
              <View style={[styles.consoleIconBox, { backgroundColor: '#EFF6FF' }]}>
                <ShieldCheck size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.consoleTitleText}>
                  {language === 'tr' ? 'Yönetim & Kiracı Masası' : 'Tenant & Admin Station'}
                </Text>
                <Text style={styles.consoleSubtitleText} numberOfLines={1}>
                  {currentEnterpriseName} • WhiteCosmos (*)
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

          {/* Scrollable Gemini Accordion Sections */}
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {/* Bölüm 1: Kiracı Bilgileri */}
            <TenantProfileSection
              isExpanded={expandedSection === 'tenant'}
              onToggle={() => setExpandedSection(prev => prev === 'tenant' ? null : 'tenant')}
              currentEnterpriseName={currentEnterpriseName}
              activeEnterpriseBlindId={activeEnterpriseBlindId}
              onCopyBlindId={onCopyBlindId}
            />

            {/* Bölüm 2: Lisans & Abonelik */}
            <TenantLicenseSection
              isExpanded={expandedSection === 'license'}
              onToggle={() => setExpandedSection(prev => prev === 'license' ? null : 'license')}
              tenantStats={tenantStats}
              onGenerateOperatorAddon={onGenerateOperatorAddon}
              onGenerateUserAddon={onGenerateUserAddon}
              copiedConsoleHash={copiedConsoleHash}
            />

            {/* Bölüm 3: Yetkilendirme & Operatörler */}
            <TenantStaffSection
              isExpanded={expandedSection === 'operators'}
              onToggle={() => setExpandedSection(prev => prev === 'operators' ? null : 'operators')}
              adminsList={adminsList}
              selectedAdminId={selectedAdminId}
              onSelectAdmin={onSelectAdmin}
              onRemoveAdmin={onRemoveAdmin}
              onGenerateOperatorInvite={onGenerateOperatorInvite}
              selectedCatIds={selectedCatIds}
              currentAppCategories={currentAppCategories}
              onToggleCategory={onToggleCategory}
              onSaveAllocation={onSaveAllocation}
              tAllLabel={tAllLabel}
            />
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
    maxWidth: 540,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  consoleTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  consoleSubtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  consoleCloseBtn: {
    padding: 6,
  },
});
