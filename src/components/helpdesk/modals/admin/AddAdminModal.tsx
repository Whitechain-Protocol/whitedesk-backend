import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { Sparkles, ShieldCheck } from 'lucide-react-native';
import { i18nService, useTranslation } from '../../../../services/i18nService';

export interface AdminAppOption {
  app_id: string;
  [key: string]: any;
}

export interface AdminCategoryOption {
  id: string;
  labelTr: string;
  labelEn: string;
  [key: string]: any;
}

export interface AddAdminModalProps {
  visible: boolean;
  onClose: () => void;
  assigningTicket: any | null;
  assignAppId: string;
  onChangeAssignAppId: (appId: string) => void;
  assignCatId: string;
  onChangeAssignCatId: (catId: string) => void;
  appsList: AdminAppOption[];
  modalAppCategories: AdminCategoryOption[];
  newAdminIdInput: string;
  onChangeNewAdminId: (text: string) => void;
  newAdminAliasInput: string;
  onChangeNewAdminAlias: (text: string) => void;
  onSuggestNextCount: () => void;
  onSuggestCyclePrefix: () => void;
  onSubmit: () => void;
  language?: string;
  formatAppId?: (id: string) => string;
  getLabel: (key: string, tr: string, en: string) => string;
}

export const AddAdminModal: React.FC<AddAdminModalProps> = ({
  visible,
  onClose,
  assigningTicket,
  assignAppId,
  onChangeAssignAppId,
  assignCatId,
  onChangeAssignCatId,
  appsList,
  modalAppCategories,
  newAdminIdInput,
  onChangeNewAdminId,
  newAdminAliasInput,
  onChangeNewAdminAlias,
  onSuggestNextCount,
  onSuggestCyclePrefix,
  onSubmit,
  language = 'tr',
  formatAppId = (id: string) => id,
  getLabel,
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop Dismiss */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
          style={{ width: '100%', alignItems: 'center', zIndex: 10 }}
        >
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ShieldCheck size={18} color="#3B82F6" style={{ marginRight: 6 }} />
                <Text style={styles.title}>
                  {assigningTicket
                    ? t('admin.add_admin.auth_title')
                    : t('helpdesk.newAdminModalTitle')}
                </Text>
              </View>
              {assigningTicket && (
                <View style={styles.ticketBadgeBox}>
                  <Text style={styles.ticketBadgeText}>#{assigningTicket.id}</Text>
                </View>
              )}
            </View>

            {assigningTicket ? (
              <>
                {/* App Selector */}
                <View style={styles.sectionBox}>
                  <Text style={styles.fieldLabel}>
                    {t('admin.add_admin.app_label')}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsScroll}
                  >
                    <TouchableOpacity
                      style={[
                        styles.chipPill,
                        assignAppId === '*' && styles.chipPillActive,
                      ]}
                      onPress={() => onChangeAssignAppId('*')}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipPillText,
                          assignAppId === '*' && styles.chipPillTextActive,
                        ]}
                      >
                        🌐 {t('admin.add_admin.all_wildcard')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.chipPill,
                        assignAppId === 'inwhite' && styles.chipPillActive,
                      ]}
                      onPress={() => onChangeAssignAppId('inwhite')}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipPillText,
                          assignAppId === 'inwhite' && styles.chipPillTextActive,
                        ]}
                      >
                        inWhite
                      </Text>
                    </TouchableOpacity>

                    {appsList
                      .filter((a) => a.app_id.toLowerCase() !== 'inwhite')
                      .map((app) => (
                        <TouchableOpacity
                          key={app.app_id}
                          style={[
                            styles.chipPill,
                            assignAppId === app.app_id && styles.chipPillActive,
                          ]}
                          onPress={() => onChangeAssignAppId(app.app_id)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.chipPillText,
                              assignAppId === app.app_id && styles.chipPillTextActive,
                            ]}
                          >
                            {formatAppId(app.app_id)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>

                {/* Category Selector */}
                <View style={styles.sectionBox}>
                  <Text style={styles.fieldLabel}>
                    {t('admin.add_admin.category_label')}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsScroll}
                  >
                    <TouchableOpacity
                      style={[
                        styles.chipPill,
                        assignCatId === '*' && styles.chipPillActive,
                      ]}
                      onPress={() => onChangeAssignCatId('*')}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipPillText,
                          assignCatId === '*' && styles.chipPillTextActive,
                        ]}
                      >
                        🌐 {t('admin.add_admin.all_wildcard')}
                      </Text>
                    </TouchableOpacity>

                    {modalAppCategories.map((cat) => {
                      const isSelected = assignCatId === cat.id;
                      const i18nCat = i18nService.t(`helpdesk.cat_${cat.id}`);
                      const label = i18nCat !== `helpdesk.cat_${cat.id}` ? i18nCat : (language === 'tr' ? cat.labelTr : (cat.labelEn || cat.labelTr));
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.chipPill,
                            isSelected && styles.chipPillActive,
                          ]}
                          onPress={() => onChangeAssignCatId(cat.id)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.chipPillText,
                              isSelected && styles.chipPillTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </>
            ) : (
              /* Non-ticket manual admin WhiteID */
              <TextInput
                style={[styles.input, { marginBottom: 12 }]}
                placeholder={t('helpdesk.newAdminIdPlaceholder')}
                placeholderTextColor="#94a3b8"
                value={newAdminIdInput}
                onChangeText={onChangeNewAdminId}
                autoFocus={true}
                autoCapitalize="none"
              />
            )}

            {/* Name / Alias Input with Suggestion */}
            <View style={[styles.sectionBox, { marginBottom: 16 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.fieldLabel}>
                  {t('admin.add_admin.name_alias_label')}
                </Text>
                <TouchableOpacity
                  onPress={onSuggestNextCount}
                  onLongPress={onSuggestCyclePrefix}
                  delayLongPress={300}
                  activeOpacity={0.7}
                  style={styles.suggestBtn}
                >
                  <Sparkles size={12} color="#3B82F6" style={{ marginRight: 4 }} />
                  <Text style={styles.suggestBtnText}>{t('admin.add_admin.suggest_btn')}</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, { borderColor: newAdminAliasInput ? '#BFDBFE' : '#E2E8F0' }]}
                placeholder={t('helpdesk.newAdminAliasPlaceholder')}
                placeholderTextColor="#94a3b8"
                value={newAdminAliasInput}
                onChangeText={onChangeNewAdminAlias}
              />
              <Text style={styles.suggestHint}>
                {t('admin.add_admin.suggest_hint')}
              </Text>
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (newAdminIdInput.trim().length > 0 || assigningTicket) && styles.submitBtnActive,
                ]}
                onPress={onSubmit}
                disabled={!newAdminIdInput.trim() && !assigningTicket}
                activeOpacity={0.7}
              >
                <Text style={styles.submitBtnText}>
                  {assigningTicket
                    ? t('helpdesk.assignAdminBtn')
                    : t('helpdesk.addBtn')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  ticketBadgeBox: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  ticketBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  sectionBox: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chipPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  chipPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  chipPillTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  suggestBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  suggestHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  submitBtn: {
    flex: 1.2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnActive: {
    backgroundColor: '#3B82F6',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
