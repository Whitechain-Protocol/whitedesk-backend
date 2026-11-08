import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
} from 'react-native';
import {
  Settings,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Crop,
  Trash2,
  Image as ImageIcon,
  UploadCloud,
  Plus,
  AlertCircle,
} from 'lucide-react-native';
import { TenantLogo } from '../../TenantLogo';
import { useTranslation } from '../../../services/i18nService';

export interface CustomFieldItem {
  key: string;
  label: string;
  required?: boolean;
}

export interface SettingsStationModalProps {
  visible: boolean;
  onClose: () => void;
  adminModalHeight: number;
  currentEnterpriseName: string;
  editTenantNameInput: string;
  onChangeTenantNameInput: (text: string) => void;
  onSaveEnterpriseName: () => void;
  tenantLogoUri: string | null;
  tenantLogoAlign: 'left' | 'center' | 'right';
  onLongPressLogoToCrop: () => void;
  onSaveLogoAlign: (align: 'left' | 'center' | 'right') => void;
  onRemoveLogo: () => void;
  onPickLogo: () => void;
  onPickDocumentForCrop: () => void;
  tenantCustomFields: CustomFieldItem[];
  onRemoveCustomField: (key: string) => void;
  newCustomFieldName: string;
  onChangeNewCustomFieldName: (text: string) => void;
  onAddCustomField: () => void;
  onAddChip?: (label: string) => void;
  language: string;
  allowNameEntry?: boolean;
  onToggleAllowNameEntry?: (val: boolean) => void;
  loginIssueEnabled?: boolean;
  onToggleLoginIssue?: (val: boolean) => void;
}

export const SettingsStationModal: React.FC<SettingsStationModalProps> = ({
  visible,
  onClose,
  adminModalHeight,
  currentEnterpriseName,
  editTenantNameInput,
  onChangeTenantNameInput,
  onSaveEnterpriseName,
  tenantLogoUri,
  tenantLogoAlign,
  onLongPressLogoToCrop,
  onSaveLogoAlign,
  onRemoveLogo,
  onPickLogo,
  onPickDocumentForCrop,
  tenantCustomFields,
  onRemoveCustomField,
  newCustomFieldName,
  onChangeNewCustomFieldName,
  onAddCustomField,
  onAddChip,
  language,
  allowNameEntry = true,
  onToggleAllowNameEntry,
  loginIssueEnabled = false,
  onToggleLoginIssue,
}) => {
  const { t } = useTranslation();

  const quickChips = [
    t('settings.station.chip_model'),
    t('settings.station.chip_serial_no'),
    t('settings.station.chip_product_name'),
    t('settings.station.chip_counter'),
    t('settings.station.chip_order_no'),
    t('settings.station.chip_color'),
    t('settings.station.chip_dimension'),
  ];

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
          <View style={styles.consoleHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={[styles.consoleIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Settings size={20} color="#2563EB" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.consoleTitleText}>{t('settings.station.title')}</Text>
                <Text style={styles.consoleSubtitleText} numberOfLines={1}>
                  {currentEnterpriseName} • {t('settings.station.subtitle')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.consoleCloseBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1, width: '100%' }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 60 }}
          >
            {/* SECTION 1: FİRMA ADI DÜZENLEME */}
            <View style={styles.adminSectionHeaderRow}>
              <View>
                <Text style={styles.adminSectionTitleText}>{t('settings.station.company_name_title')}</Text>
                <Text style={styles.adminSectionSubText}>{t('settings.station.company_name_sub')}</Text>
              </View>
            </View>
            <View style={styles.inlineInputRow}>
              <TextInput
                style={styles.inlineInputText}
                placeholder={t('settings.station.company_name_placeholder')}
                placeholderTextColor="#94A3B8"
                value={editTenantNameInput}
                onChangeText={onChangeTenantNameInput}
              />
              <TouchableOpacity style={styles.inlineAddButton} onPress={onSaveEnterpriseName}>
                <Text style={styles.inlineAddButtonText}>{t('settings.station.update_btn')}</Text>
              </TouchableOpacity>
            </View>

            {/* SECTION: GİRİŞ VE GÜVENLİK İLKELERİ */}
            <View style={[styles.adminSectionHeaderRow, { marginTop: 14 }]}>
              <View>
                <Text style={styles.adminSectionTitleText}>{t('settings.station.login_policies_title')}</Text>
                <Text style={styles.adminSectionSubText}>{t('settings.station.login_policies_sub')}</Text>
              </View>
            </View>

            <View style={styles.toggleCardContainer}>
              {/* Ana ekranda / Ad Soyad Girişi Zorunluluğu */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.toggleTitle}>{t('settings.station.require_name_title')}</Text>
                  <Text style={styles.toggleDesc}>
                    {allowNameEntry ? t('settings.station.require_name_desc_on') : t('settings.station.require_name_desc_off')}
                  </Text>
                </View>
                <Switch
                  value={allowNameEntry}
                  onValueChange={onToggleAllowNameEntry}
                  trackColor={{ false: '#CBD5E1', true: '#BFDBFE' }}
                  thumbColor={allowNameEntry ? '#2563EB' : '#94A3B8'}
                />
              </View>

              {!allowNameEntry && (
                <View style={styles.warningNoteBox}>
                  <AlertCircle size={15} color="#D97706" style={{ marginRight: 6, marginTop: 1 }} />
                  <Text style={styles.warningNoteText}>
                    {t('settings.station.require_name_warning')}
                  </Text>
                </View>
              )}
            </View>

            {/* SECTION 2: LOGO YÖNETİMİ */}
            <View style={[styles.adminSectionHeaderRow, { marginTop: 14 }]}>
              <View>
                <Text style={styles.adminSectionTitleText}>{t('settings.station.logo_title')}</Text>
                <Text style={styles.adminSectionSubText}>{t('settings.station.logo_sub')}</Text>
              </View>
            </View>

            <View style={styles.logoSettingBox}>
              {tenantLogoUri ? (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  {/* ENLARGED WHITE LOGO CANVAS WITH LIVE ALIGNMENT */}
                  <TouchableOpacity
                    style={styles.settingsLogoPreviewWrapper}
                    onLongPress={onLongPressLogoToCrop}
                    delayLongPress={350}
                    activeOpacity={0.8}
                  >
                    <TenantLogo
                      uri={tenantLogoUri}
                      height={72}
                      maxWidth={320}
                      align={tenantLogoAlign}
                    />
                  </TouchableOpacity>

                  {/* HINT TEXT FOR RE-CROPPING */}
                  <Text style={styles.logoLongPressHint}>
                    {t('settings.station.logo_long_press_hint')}
                  </Text>

                  {/* 3-SEGMENT HORIZONTAL ALIGNMENT BUTTONS */}
                  <View style={styles.alignControlsRow}>
                    <TouchableOpacity
                      style={[
                        styles.alignControlBtn,
                        tenantLogoAlign === 'left' && styles.alignControlBtnActive,
                      ]}
                      onPress={() => onSaveLogoAlign('left')}
                      activeOpacity={0.7}
                    >
                      <AlignLeft
                        size={18}
                        color={tenantLogoAlign === 'left' ? '#2563EB' : '#64748B'}
                        strokeWidth={tenantLogoAlign === 'left' ? 2.5 : 2}
                      />
                      <Text
                        style={[
                          styles.alignControlBtnText,
                          tenantLogoAlign === 'left' && styles.alignControlBtnTextActive,
                        ]}
                      >
                        {t('settings.station.align_left')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.alignControlBtn,
                        tenantLogoAlign === 'center' && styles.alignControlBtnActive,
                      ]}
                      onPress={() => onSaveLogoAlign('center')}
                      activeOpacity={0.7}
                    >
                      <AlignCenter
                        size={18}
                        color={tenantLogoAlign === 'center' ? '#2563EB' : '#64748B'}
                        strokeWidth={tenantLogoAlign === 'center' ? 2.5 : 2}
                      />
                      <Text
                        style={[
                          styles.alignControlBtnText,
                          tenantLogoAlign === 'center' && styles.alignControlBtnTextActive,
                        ]}
                      >
                        {t('settings.station.align_center')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.alignControlBtn,
                        tenantLogoAlign === 'right' && styles.alignControlBtnActive,
                      ]}
                      onPress={() => onSaveLogoAlign('right')}
                      activeOpacity={0.7}
                    >
                      <AlignRight
                        size={18}
                        color={tenantLogoAlign === 'right' ? '#2563EB' : '#64748B'}
                        strokeWidth={tenantLogoAlign === 'right' ? 2.5 : 2}
                      />
                      <Text
                        style={[
                          styles.alignControlBtnText,
                          tenantLogoAlign === 'right' && styles.alignControlBtnTextActive,
                        ]}
                      >
                        {t('settings.station.align_right')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* ACTION BUTTONS: YENİDEN KIRP & LOGOYU KALDIR */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, width: '100%' }}>
                    <TouchableOpacity
                      style={[styles.snippingToolBtn, { flex: 1 }]}
                      onPress={onLongPressLogoToCrop}
                      activeOpacity={0.7}
                    >
                      <Crop size={16} color="#2563EB" style={{ marginRight: 6 }} />
                      <Text style={styles.snippingToolBtnText}>{t('settings.station.recrop_btn')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.logoActionBtnDanger, { flex: 1 }]}
                      onPress={onRemoveLogo}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={16} color="#DC2626" style={{ marginRight: 6 }} />
                      <Text style={styles.logoActionBtnDangerText}>{t('settings.station.remove_logo_btn')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ alignItems: 'center', width: '100%' }}>
                  <View style={styles.logoPlaceholderBox}>
                    <ImageIcon size={32} color="#94A3B8" />
                    <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>{t('settings.station.no_logo_uploaded')}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, width: '100%' }}>
                    <TouchableOpacity
                      style={[styles.bluePillButton, { flex: 1, marginTop: 0 }]}
                      onPress={onPickLogo}
                      activeOpacity={0.7}
                    >
                      <UploadCloud size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.bluePillButtonText}>{t('settings.station.upload_logo_btn')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.snippingToolBtn, { flex: 1 }]}
                      onPress={onPickDocumentForCrop}
                      activeOpacity={0.7}
                    >
                      <Crop size={16} color="#2563EB" style={{ marginRight: 6 }} />
                      <Text style={styles.snippingToolBtnText}>{t('settings.station.snipping_tool_btn')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* SECTION 3: ÖZEL ALAN GİRİŞİ (CUSTOM TICKET FIELDS) */}
            <View style={[styles.adminSectionHeaderRow, { marginTop: 20 }]}>
              <View>
                <Text style={styles.adminSectionTitleText}>{t('settings.station.custom_fields_title')}</Text>
                <Text style={styles.adminSectionSubText}>{t('settings.station.custom_fields_sub')}</Text>
              </View>
            </View>

            {/* HIZLI ŞABLON ÇİPLERİ */}
            <View style={{ marginTop: 6, marginBottom: 8 }}>
              <Text style={styles.quickChipsLabel}>{t('settings.station.quick_add_label')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                {quickChips.map((chip) => {
                  const isAdded = tenantCustomFields.some(
                    f => f.label.toLowerCase() === chip.toLowerCase() || f.key.toLowerCase().includes(chip.toLowerCase().replace(/[^a-z0-9]/g, ''))
                  );
                  return (
                    <TouchableOpacity
                      key={chip}
                      style={[styles.quickChip, isAdded && styles.quickChipAdded]}
                      onPress={() => {
                        if (!isAdded && onAddChip) onAddChip(chip);
                      }}
                      activeOpacity={0.7}
                      disabled={isAdded}
                    >
                      <Plus size={12} color={isAdded ? '#16A34A' : '#2563EB'} style={{ marginRight: 4 }} />
                      <Text style={[styles.quickChipText, isAdded && styles.quickChipTextAdded]}>
                        {chip}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {tenantCustomFields.length === 0 ? (
              <Text style={{ fontSize: 12, color: '#94A3B8', marginVertical: 6, fontStyle: 'italic' }}>
                {t('settings.station.no_custom_fields')}
              </Text>
            ) : (
              tenantCustomFields.map((field) => (
                <View key={`cf_${field.key}`} style={styles.adminItemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adminItemName}>{field.label}</Text>
                    <Text style={styles.adminItemSub}>{field.required ? t('settings.station.field_required') : t('settings.station.field_optional')}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteIconButton}
                    onPress={() => onRemoveCustomField(field.key)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Trash2 size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))
            )}

            <View style={[styles.inlineInputRow, { marginTop: 10 }]}>
              <TextInput
                style={styles.inlineInputText}
                placeholder={t('settings.station.custom_field_placeholder')}
                placeholderTextColor="#94A3B8"
                value={newCustomFieldName}
                onChangeText={onChangeNewCustomFieldName}
              />
              <TouchableOpacity style={styles.inlineAddButton} onPress={onAddCustomField}>
                <Text style={styles.inlineAddButtonText}>{t('settings.station.add_custom_field_btn')}</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
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
  adminSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  adminSectionTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  adminSectionSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  inlineInputText: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#1E293B',
  },
  inlineAddButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineAddButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  logoSettingBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
  },
  settingsLogoPreviewWrapper: {
    minHeight: 110,
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  logoLongPressHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    marginBottom: 10,
    fontWeight: '500',
  },
  alignControlsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
    marginBottom: 4,
  },
  alignControlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  alignControlBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  alignControlBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 6,
  },
  alignControlBtnTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  snippingToolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  snippingToolBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  logoActionBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 10,
  },
  logoActionBtnDangerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
    textAlign: 'center',
  },
  logoPlaceholderBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  bluePillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 12,
  },
  bluePillButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  adminItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  adminItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  adminItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  deleteIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quickChipAdded: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  quickChipTextAdded: {
    color: '#16A34A',
  },
  toggleCardContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  toggleDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  toggleDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  warningNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  warningNoteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
    flex: 1,
    lineHeight: 16,
  },
});
