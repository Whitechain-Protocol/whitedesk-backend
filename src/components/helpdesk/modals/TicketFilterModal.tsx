import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import {
  X,
  RotateCcw,
  Building2,
  Users,
  Smartphone,
  Tag,
  Check,
} from 'lucide-react-native';
import { TenantEntry, OrgEntry, AppCatEntry, HelpDeskCategory } from '../../../services/helpDeskService';
import { FilterSlidersIcon } from '../icons/FilterSlidersIcon';
import { useTranslation } from '../../../services/i18nService';

export interface TicketFilterModalProps {
  visible: boolean;
  onClose: () => void;
  isFounder: boolean;
  isGlobalAdmin: boolean;
  isAdmin: boolean;
  // Seçili Filtreler
  selectedTenantBlindId: string;
  onSelectTenant: (id: string) => void;
  tenantsList: TenantEntry[];
  selectedOrgId: string;
  onSelectOrg: (id: string) => void;
  orgsList: OrgEntry[];
  selectedAppId: string;
  onSelectApp: (id: string) => void;
  appsList: AppCatEntry[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  categoriesList: HelpDeskCategory[];
  // Eylemler & İstatistikler
  onResetAll: () => void;
  filteredCount: number;
  totalCount: number;
  language?: string;
  getLabel?: (key: string, tr?: string, en?: string) => string;
}

export const TicketFilterModal: React.FC<TicketFilterModalProps> = ({
  visible,
  onClose,
  isFounder,
  isGlobalAdmin,
  isAdmin,
  selectedTenantBlindId,
  onSelectTenant,
  tenantsList,
  selectedOrgId,
  onSelectOrg,
  orgsList,
  selectedAppId,
  onSelectApp,
  appsList,
  selectedCategoryId,
  onSelectCategory,
  categoriesList,
  onResetAll,
  filteredCount,
  totalCount,
}) => {
  const { t } = useTranslation();
  const hasActiveFilters =
    (isFounder && selectedTenantBlindId !== 'all') ||
    selectedOrgId !== 'all' ||
    selectedAppId !== 'all' ||
    selectedCategoryId !== 'all';

  // Role göre başlık altı bilgilendirme
  const roleSubtitle = isFounder
    ? t('helpdesk.ticket_filter.subtitle_founder')
    : isGlobalAdmin
    ? t('helpdesk.ticket_filter.subtitle_global_admin')
    : isAdmin
    ? t('helpdesk.ticket_filter.subtitle_admin')
    : t('helpdesk.ticket_filter.subtitle_user');

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalCard}>
          {/* HEADER */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.iconBox}>
                <FilterSlidersIcon size={18} color="#15803D" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.title}>{t('helpdesk.ticket_filter.title')}</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {roleSubtitle}
                </Text>
              </View>
            </View>

            {hasActiveFilters && (
              <TouchableOpacity
                style={styles.resetHeaderBtn}
                onPress={onResetAll}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <RotateCcw size={12} color="#DC2626" style={{ marginRight: 4 }} />
                <Text style={styles.resetHeaderBtnText}>{t('helpdesk.ticket_filter.reset_btn')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginLeft: 8 }}
            >
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* SCROLLABLE FILTER SECTIONS */}
          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. BÖLÜM: FİRMA / TENANT (SADECE KURUCU İÇİN) */}
            {isFounder && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionTitleRow}>
                  <Building2 size={14} color="#0D9488" style={{ marginRight: 6 }} />
                  <Text style={styles.sectionTitle}>{t('helpdesk.ticket_filter.section_tenant')}</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillScrollContainer}
                >
                  <TouchableOpacity
                    style={[
                      styles.filterPill,
                      selectedTenantBlindId === 'all' && styles.filterPillActive,
                    ]}
                    onPress={() => onSelectTenant('all')}
                    activeOpacity={0.7}
                  >
                    {selectedTenantBlindId === 'all' && (
                      <Check size={13} color="#166534" style={{ marginRight: 4 }} />
                    )}
                    <Text
                      style={[
                        styles.filterPillText,
                        selectedTenantBlindId === 'all' && styles.filterPillTextActive,
                      ]}
                    >
                      {t('helpdesk.ticket_filter.all_tenants')}
                    </Text>
                  </TouchableOpacity>

                  {tenantsList.map((tenant) => {
                    const isSelected = selectedTenantBlindId === tenant.enterprise_blind_id;
                    return (
                      <TouchableOpacity
                        key={tenant.enterprise_blind_id}
                        style={[styles.filterPill, isSelected && styles.filterPillActive]}
                        onPress={() => onSelectTenant(tenant.enterprise_blind_id)}
                        activeOpacity={0.7}
                      >
                        {isSelected && (
                          <Check size={13} color="#166534" style={{ marginRight: 4 }} />
                        )}
                        <Text
                          style={[
                            styles.filterPillText,
                            isSelected && styles.filterPillTextActive,
                          ]}
                        >
                          {tenant.name || tenant.enterprise_blind_id.slice(0, 10)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* 2. BÖLÜM: ORGANİZASYON / ORG (FOUNDER, GLOBAL ADMIN, TENANT ADMIN) */}
            {(isFounder || isGlobalAdmin || isAdmin) && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionTitleRow}>
                  <Users size={14} color="#059669" style={{ marginRight: 6 }} />
                  <Text style={styles.sectionTitle}>{t('helpdesk.ticket_filter.section_org')}</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillScrollContainer}
                >
                  <TouchableOpacity
                    style={[
                      styles.filterPill,
                      selectedOrgId === 'all' && styles.filterPillActive,
                    ]}
                    onPress={() => onSelectOrg('all')}
                    activeOpacity={0.7}
                  >
                    {selectedOrgId === 'all' && (
                      <Check size={13} color="#166534" style={{ marginRight: 4 }} />
                    )}
                    <Text
                      style={[
                        styles.filterPillText,
                        selectedOrgId === 'all' && styles.filterPillTextActive,
                      ]}
                    >
                      {t('helpdesk.ticket_filter.all_orgs')}
                    </Text>
                  </TouchableOpacity>

                  {Array.from(new Set(['merkez', ...orgsList.map((o) => o.org_id)])).map((orgId) => {
                    const isSelected = selectedOrgId.toLowerCase() === orgId.toLowerCase();
                    const matchedOrg = orgsList.find((o) => o.org_id.toLowerCase() === orgId.toLowerCase());
                    const label = matchedOrg?.name || orgId;
                    return (
                      <TouchableOpacity
                        key={orgId}
                        style={[styles.filterPill, isSelected && styles.filterPillActive]}
                        onPress={() => onSelectOrg(orgId)}
                        activeOpacity={0.7}
                      >
                        {isSelected && (
                          <Check size={13} color="#166534" style={{ marginRight: 4 }} />
                        )}
                        <Text
                          style={[
                            styles.filterPillText,
                            isSelected && styles.filterPillTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* 3. BÖLÜM: UYGULAMA (APP) */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionTitleRow}>
                <Smartphone size={14} color="#0D9488" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>{t('helpdesk.ticket_filter.section_app')}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillScrollContainer}
              >
                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    selectedAppId === 'all' && styles.filterPillActive,
                  ]}
                  onPress={() => onSelectApp('all')}
                  activeOpacity={0.7}
                >
                  {selectedAppId === 'all' && (
                    <Check size={13} color="#166534" style={{ marginRight: 4 }} />
                  )}
                  <Text
                    style={[
                      styles.filterPillText,
                      selectedAppId === 'all' && styles.filterPillTextActive,
                    ]}
                  >
                    {t('helpdesk.ticket_filter.all_apps')}
                  </Text>
                </TouchableOpacity>

                {Array.from(new Set(['inwhite', 'whitedesk', ...appsList.map((a) => a.app_id.toLowerCase())])).map(
                  (appId) => {
                    const isSelected = selectedAppId.toLowerCase() === appId.toLowerCase();
                    const matchedApp = appsList.find((a) => a.app_id.toLowerCase() === appId);
                    const label =
                      matchedApp?.name ||
                      (appId === 'inwhite' ? 'inWhite' : appId === 'whitedesk' ? 'WhiteDesk' : appId);
                    return (
                      <TouchableOpacity
                        key={appId}
                        style={[styles.filterPill, isSelected && styles.filterPillActive]}
                        onPress={() => onSelectApp(appId)}
                        activeOpacity={0.7}
                      >
                        {isSelected && (
                          <Check size={13} color="#166534" style={{ marginRight: 4 }} />
                        )}
                        <Text
                          style={[
                            styles.filterPillText,
                            isSelected && styles.filterPillTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </ScrollView>
            </View>

            {/* 4. BÖLÜM: KATEGORİ */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionTitleRow}>
                <Tag size={14} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>{t('helpdesk.ticket_filter.section_category')}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillScrollContainer}
              >
                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    selectedCategoryId === 'all' && styles.filterPillActive,
                  ]}
                  onPress={() => onSelectCategory('all')}
                  activeOpacity={0.7}
                >
                  {selectedCategoryId === 'all' && (
                    <Check size={13} color="#166534" style={{ marginRight: 4 }} />
                  )}
                  <Text
                    style={[
                      styles.filterPillText,
                      selectedCategoryId === 'all' && styles.filterPillTextActive,
                    ]}
                  >
                    {t('helpdesk.ticket_filter.all_categories')}
                  </Text>
                </TouchableOpacity>

                {categoriesList.map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  const label = cat.labelTr || cat.key || cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.filterPill, isSelected && styles.filterPillActive]}
                      onPress={() => onSelectCategory(cat.id)}
                      activeOpacity={0.7}
                    >
                      {isSelected && (
                        <Check size={13} color="#166534" style={{ marginRight: 4 }} />
                      )}
                      <Text
                        style={[
                          styles.filterPillText,
                          isSelected && styles.filterPillTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>

          {/* FOOTER ACTION (SAMSUNG ONE UI PASTEL GREEN ESTETİĞİ) */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.applyBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.applyBtnText}>
                {t('helpdesk.ticket_filter.apply_btn', {
                  filtered: filteredCount,
                  total: totalCount,
                })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.60)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '86%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  resetHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginRight: 6,
  },
  resetHeaderBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  scrollBody: {
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingVertical: 14,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  pillScrollContainer: {
    flexDirection: 'row',
    paddingVertical: 3,
    alignItems: 'center',
  },

  // SAMSUNG ONE UI PASTEL YEŞİL SEÇİM PİLLERİ
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#DCFCE7', // Pastel yumuşak yeşil
    borderColor: '#86EFAC',     // Pastel yeşil çerçeve
    borderWidth: 1.5,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#166534', // Koyu ve okunaklı pastel zümrüt
    fontWeight: '700',
  },

  // FOOTER & BUTON (SAMSUNG ONE UI MİMARİSİ)
  footerRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFAFA',
  },
  applyBtn: {
    backgroundColor: '#16A34A', // Samsung One UI pastel yeşil ana buton
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
