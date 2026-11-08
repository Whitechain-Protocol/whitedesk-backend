import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import {
  ShieldCheck,
  X,
  Building2,
  ChevronUp,
  ChevronDown,
  Copy,
  Sparkles,
  Users,
  UserPlus,
  Check,
  CheckCircle2,
} from 'lucide-react-native';
import { useTranslation } from '../../../services/i18nService';

export interface AdminItem {
  white_id: string;
  alias?: string;
  role?: string;
}

export interface CategoryItem {
  id: string;
  labelTr?: string;
}

export type GeminiSection = 'tenant' | 'license' | 'operators';

export interface ManagementConsoleModalProps {
  visible: boolean;
  onClose: () => void;
  adminModalHeight: number;
  currentEnterpriseName: string;
  activeEnterpriseBlindId: string | null;
  language: string;
  tenantStats: { adminCount?: number; userCount?: number };
  adminsList: AdminItem[];
  selectedAdminId: string | null;
  onSelectAdminId: (id: string) => void;
  onRemoveAdmin: (id: string) => void;
  selectedCatIds: string[];
  onToggleCategory: (catId: string) => void;
  currentAppCategories: CategoryItem[];
  onSaveAllocationSubmit: () => void;
  t: (key: string) => string;
  expandedGeminiSection: GeminiSection | null;
  onToggleSection: (section: GeminiSection) => void;
  copiedConsoleHash: string | null;
  onCopyBlindId: () => void;
  onGenerateAdminHash: () => void;
  onGenerateUserHash: () => void;
}

export const ManagementConsoleModal: React.FC<ManagementConsoleModalProps> = ({
  visible,
  onClose,
  adminModalHeight,
  currentEnterpriseName,
  activeEnterpriseBlindId,
  language,
  tenantStats,
  adminsList,
  selectedAdminId,
  onSelectAdminId,
  onRemoveAdmin,
  selectedCatIds,
  onToggleCategory,
  currentAppCategories,
  onSaveAllocationSubmit,
  t,
  expandedGeminiSection,
  onToggleSection,
  copiedConsoleHash,
  onCopyBlindId,
  onGenerateAdminHash,
  onGenerateUserHash,
}) => {
  const { t: i18nT } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.consoleModalOverlay}>
        <View style={[styles.consoleModalContainer, { height: adminModalHeight }]}>
          {/* Header */}
          <View style={styles.consoleHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={[styles.consoleIconBox, { backgroundColor: '#EFF6FF' }]}>
                <ShieldCheck size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.consoleTitleText}>
                  {i18nT('provisioning.tenant_station.title')}
                </Text>
                <Text style={styles.consoleSubtitleText} numberOfLines={1}>
                  {currentEnterpriseName} • {i18nT('provisioning.tenant_station.header_subtitle_cosmos')}
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
            {/* --- BÖLÜM 1: KIRACI BİLGİLERİ (GEMINI ACCORDION) --- */}
            <View style={styles.geminiCard}>
              <TouchableOpacity
                style={styles.geminiCardHeader}
                onPress={() => onToggleSection('tenant')}
                activeOpacity={0.7}
              >
                <View style={[styles.geminiIconCircle, { backgroundColor: '#EFF6FF' }]}>
                  <Building2 size={20} color="#2563EB" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.geminiCardTitle}>{i18nT('provisioning.tenant_station.profile_title')}</Text>
                  <Text style={styles.geminiCardSubtitle}>{i18nT('provisioning.tenant_station.profile_subtitle')}</Text>
                </View>
                <View style={styles.geminiStatusPill}>
                  <Text style={styles.geminiStatusPillText}>{i18nT('provisioning.tenant_station.status_sealed')}</Text>
                </View>
                {expandedGeminiSection === 'tenant' ? (
                  <ChevronUp size={20} color="#64748B" style={{ marginLeft: 6 }} />
                ) : (
                  <ChevronDown size={20} color="#64748B" style={{ marginLeft: 6 }} />
                )}
              </TouchableOpacity>

              {expandedGeminiSection === 'tenant' && (
                <View style={styles.geminiCardBody}>
                  <View style={styles.infoRowItem}>
                    <Text style={styles.infoRowLabel}>{i18nT('provisioning.tenant_station.enterprise_name_label')}</Text>
                    <Text style={styles.infoRowValue}>{currentEnterpriseName}</Text>
                  </View>

                  <View style={styles.infoRowItem}>
                    <Text style={styles.infoRowLabel}>{i18nT('provisioning.tenant_station.blind_id_label')}</Text>
                    <TouchableOpacity
                      style={styles.copyChipRow}
                      onPress={onCopyBlindId}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.copyChipText} numberOfLines={1} ellipsizeMode="middle">
                        {activeEnterpriseBlindId || i18nT('helpdesk.default')}
                      </Text>
                      <Copy size={13} color="#2563EB" style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.infoRowItem}>
                    <Text style={styles.infoRowLabel}>{i18nT('provisioning.tenant_station.admin_authority_label')}</Text>
                    <Text style={[styles.infoRowValue, { color: '#2563EB', fontWeight: '800' }]}>
                      {i18nT('provisioning.tenant_station.global_admin_authority_value')}
                    </Text>
                  </View>

                  <View style={styles.infoRowItem}>
                    <Text style={styles.infoRowLabel}>{i18nT('provisioning.tenant_station.protocol_label')}</Text>
                    <Text style={styles.infoRowValue}>{i18nT('provisioning.tenant_station.protocol_value')}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* --- BÖLÜM 2: LİSANS & ABONELİK (GEMINI ACCORDION) --- */}
            <View style={styles.geminiCard}>
              <TouchableOpacity
                style={styles.geminiCardHeader}
                onPress={() => onToggleSection('license')}
                activeOpacity={0.7}
              >
                <View style={[styles.geminiIconCircle, { backgroundColor: '#ECFDF5' }]}>
                  <Sparkles size={20} color="#059669" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.geminiCardTitle}>{i18nT('provisioning.tenant_station.license_title')}</Text>
                  <Text style={styles.geminiCardSubtitle}>{i18nT('provisioning.tenant_station.license_subtitle')}</Text>
                </View>
                <View style={[styles.geminiStatusPill, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.geminiStatusPillText, { color: '#15803D' }]}>{i18nT('provisioning.tenant_station.trial_14_days_pill')}</Text>
                </View>
                {expandedGeminiSection === 'license' ? (
                  <ChevronUp size={20} color="#64748B" style={{ marginLeft: 6 }} />
                ) : (
                  <ChevronDown size={20} color="#64748B" style={{ marginLeft: 6 }} />
                )}
              </TouchableOpacity>

              {expandedGeminiSection === 'license' && (
                <View style={styles.geminiCardBody}>
                  {/* CANLI KOTA SAYAÇLARI */}
                  <View style={styles.quotaCountersRow}>
                    <View style={styles.quotaBox}>
                      <Text style={styles.quotaBoxNumber}>{tenantStats.adminCount || 1} / 3</Text>
                      <Text style={styles.quotaBoxLabel}>{i18nT('provisioning.tenant_station.operator_seat_label')}</Text>
                    </View>
                    <View style={styles.quotaBox}>
                      <Text style={styles.quotaBoxNumber}>{tenantStats.userCount || 1} / 10</Text>
                      <Text style={styles.quotaBoxLabel}>{i18nT('provisioning.tenant_station.customer_quota_label')}</Text>
                    </View>
                  </View>

                  {/* HIZLI İLAVE HASH ÜRETİMİ (ADD-ON) */}
                  <Text style={styles.subSectionHeader}>{i18nT('provisioning.console.quick_addon_header')}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                    <TouchableOpacity
                      style={styles.addonActionBtn}
                      onPress={onGenerateAdminHash}
                      activeOpacity={0.7}
                    >
                      <UserPlus size={14} color="#2563EB" style={{ marginRight: 4 }} />
                      <Text style={styles.addonActionBtnText}>{i18nT('provisioning.tenant_station.addon_operator_btn')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.addonActionBtn}
                      onPress={onGenerateUserHash}
                      activeOpacity={0.7}
                    >
                      <Users size={14} color="#2563EB" style={{ marginRight: 4 }} />
                      <Text style={styles.addonActionBtnText}>{i18nT('provisioning.tenant_station.addon_customer_btn')}</Text>
                    </TouchableOpacity>
                  </View>

                  {copiedConsoleHash && (
                    <View style={styles.copiedBanner}>
                      <Check size={14} color="#16A34A" style={{ marginRight: 6 }} />
                      <Text style={styles.copiedBannerText} numberOfLines={1}>
                        {i18nT('provisioning.console.new_hash_copied', { hash: copiedConsoleHash })}
                      </Text>
                    </View>
                  )}

                  {/* ABONELİK PLANLARI BİLGİ KARTLARI */}
                  <Text style={[styles.subSectionHeader, { marginTop: 12 }]}>{i18nT('provisioning.console.subscription_plans_header')}</Text>
                  <View style={styles.tierPlanBox}>
                    <Text style={styles.tierPlanName}>{i18nT('provisioning.console.starter_title')}</Text>
                    <Text style={styles.tierPlanPrice}>{i18nT('provisioning.console.starter_price')}</Text>
                    <Text style={styles.tierPlanDesc}>{i18nT('provisioning.console.starter_desc')}</Text>
                  </View>

                  <View style={[styles.tierPlanBox, styles.tierPlanBoxPro]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.tierPlanName}>{i18nT('provisioning.console.pro_title')}</Text>
                      <Text style={styles.popularBadge}>{i18nT('provisioning.tenant_station.recommended_badge')}</Text>
                    </View>
                    <Text style={styles.tierPlanPrice}>{i18nT('provisioning.console.pro_price')}</Text>
                    <Text style={styles.tierPlanDesc}>{i18nT('provisioning.console.pro_desc')}</Text>
                  </View>

                  <View style={styles.tierPlanBox}>
                    <Text style={styles.tierPlanName}>{i18nT('provisioning.console.enterprise_title')}</Text>
                    <Text style={styles.tierPlanPrice}>{i18nT('provisioning.console.enterprise_price')}</Text>
                    <Text style={styles.tierPlanDesc}>{i18nT('provisioning.console.enterprise_desc')}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* --- BÖLÜM 3: YETKİLENDİRME & OPERATÖRLER (GEMINI ACCORDION) --- */}
            <View style={styles.geminiCard}>
              <TouchableOpacity
                style={styles.geminiCardHeader}
                onPress={() => onToggleSection('operators')}
                activeOpacity={0.7}
              >
                <View style={[styles.geminiIconCircle, { backgroundColor: '#EEF2FF' }]}>
                  <Users size={20} color="#4F46E5" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.geminiCardTitle}>{i18nT('provisioning.tenant_station.staff_title')}</Text>
                  <Text style={styles.geminiCardSubtitle}>{i18nT('provisioning.tenant_station.staff_subtitle')}</Text>
                </View>
                <View style={[styles.geminiStatusPill, { backgroundColor: '#E0E7FF' }]}>
                  <Text style={[styles.geminiStatusPillText, { color: '#4338CA' }]}>
                    {i18nT('provisioning.tenant_station.staff_count_pill', { count: adminsList.length })}
                  </Text>
                </View>
                {expandedGeminiSection === 'operators' ? (
                  <ChevronUp size={20} color="#64748B" style={{ marginLeft: 6 }} />
                ) : (
                  <ChevronDown size={20} color="#64748B" style={{ marginLeft: 6 }} />
                )}
              </TouchableOpacity>

              {expandedGeminiSection === 'operators' && (
                <View style={styles.geminiCardBody}>
                  <Text style={styles.subSectionHeader}>{i18nT('provisioning.tenant_station.active_admins_header')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {adminsList.map((adm) => {
                      const isSelected = selectedAdminId === adm.white_id;
                      return (
                        <TouchableOpacity
                          key={adm.white_id}
                          style={[styles.adminPill, isSelected && styles.adminPillSelected]}
                          onPress={() => onSelectAdminId(adm.white_id)}
                          onLongPress={() => onRemoveAdmin(adm.white_id)}
                          delayLongPress={500}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.adminPillAlias, isSelected && styles.adminPillAliasSelected]}>
                            {adm.alias || i18nT('helpdesk.admin_role_short')}
                          </Text>
                          <Text style={[styles.adminPillId, isSelected && styles.adminPillIdSelected]}>
                            {adm.role === 'global_admin' ? i18nT('provisioning.role_global_admin') : i18nT('helpdesk.admin_role_short')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <TouchableOpacity
                    style={styles.addOpBtn}
                    onPress={onGenerateAdminHash}
                    activeOpacity={0.8}
                  >
                    <UserPlus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.addOpBtnText}>{i18nT('provisioning.tenant_station.generate_operator_invite_btn')}</Text>
                  </TouchableOpacity>

                  {/* Departman Yetki Matrisi */}
                  <Text style={[styles.subSectionHeader, { marginTop: 14 }]}>{i18nT('provisioning.tenant_station.department_matrix_header')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <TouchableOpacity
                      style={[styles.catPill, selectedCatIds.includes('all') && styles.catPillSelected]}
                      onPress={() => onToggleCategory('all')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.catPillText, selectedCatIds.includes('all') && styles.catPillTextSelected]}>
                        {i18nT('common.all')}
                      </Text>
                    </TouchableOpacity>
                    {currentAppCategories.map((cat) => {
                      const isSelected = selectedCatIds.includes(cat.id);
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[styles.catPill, isSelected && styles.catPillSelected]}
                          onPress={() => onToggleCategory(cat.id)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.catPillText, isSelected && styles.catPillTextSelected]}>
                            {i18nT(`helpdesk.cat_${cat.id}`) !== `helpdesk.cat_${cat.id}` ? i18nT(`helpdesk.cat_${cat.id}`) : (language === 'tr' ? cat.labelTr : (cat as any).labelEn || cat.labelTr || cat.id)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <TouchableOpacity
                    style={[styles.fluidSubmitBtn, styles.fluidSubmitBtnActive, { paddingVertical: 12 }]}
                    onPress={onSaveAllocationSubmit}
                    activeOpacity={0.8}
                  >
                    <CheckCircle2 size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={[styles.fluidSubmitBtnText, { fontSize: 13 }]}>{i18nT('provisioning.tenant_station.save_authority_btn')}</Text>
                  </TouchableOpacity>
                </View>
              )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 25,
  },
  consoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  consoleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consoleTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  consoleSubtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  consoleCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  geminiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  geminiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  geminiIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  geminiCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  geminiCardSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
  },
  geminiStatusPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 4,
  },
  geminiStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  geminiCardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFAFC',
  },
  infoRowItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoRowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  infoRowValue: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  copyChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  copyChipText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    maxWidth: 260,
  },
  quotaCountersRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 10,
  },
  quotaBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quotaBoxNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 2,
  },
  quotaBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  subSectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
  },
  addonActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  addonActionBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E40AF',
  },
  copiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  copiedBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    flex: 1,
  },
  tierPlanBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tierPlanBoxPro: {
    borderColor: '#93C5FD',
    backgroundColor: '#F0F9FF',
  },
  tierPlanName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  popularBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tierPlanPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    marginVertical: 2,
  },
  tierPlanDesc: {
    fontSize: 11,
    color: '#64748B',
  },
  adminPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    minWidth: 110,
  },
  adminPillSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  adminPillAlias: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  adminPillAliasSelected: {
    color: '#1D4ED8',
  },
  adminPillId: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  adminPillIdSelected: {
    color: '#3B82F6',
  },
  addOpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 11,
    marginBottom: 10,
  },
  addOpBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  catPill: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 6,
  },
  catPillSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  catPillTextSelected: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  fluidSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#94A3B8',
    borderRadius: 14,
  },
  fluidSubmitBtnActive: {
    backgroundColor: '#2563EB',
  },
  fluidSubmitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
