import React, { useState, useEffect } from 'react';
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
  Building2,
  ShieldCheck,
  ListPlus,
  Palette,
  ChevronLeft,
  ChevronRight,
  Check,
  MessageSquare,
  Radio,
  ArrowUp,
  ArrowRight,
} from 'lucide-react-native';
import { TenantLogo } from '../../TenantLogo';
import { useTranslation } from '../../../services/i18nService';
import {
  buttonThemeService,
  BUTTON_THEME_PALETTES,
  ButtonTheme,
} from '../../../services/helpdesk/buttonThemeService';
import { helpDeskLicenseService } from '../../../services/helpdesk/helpDeskLicenseService';

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
  activeEnterpriseBlindId?: string;
  onThemeChanged?: (theme: ButtonTheme) => void;
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
  activeEnterpriseBlindId,
  onThemeChanged,
}) => {
  const { t } = useTranslation();

  const [currentThemeIndex, setCurrentThemeIndex] = useState(0);
  const [isThemeSaved, setIsThemeSaved] = useState(false);

  useEffect(() => {
    if (visible) {
      buttonThemeService.getSavedTheme().then(theme => {
        const idx = BUTTON_THEME_PALETTES.findIndex(p => p.id === theme.id);
        if (idx !== -1) {
          setCurrentThemeIndex(idx);
          setIsThemeSaved(true);
        }
      });
    }
  }, [visible]);

  const activePalette = BUTTON_THEME_PALETTES[currentThemeIndex];

  const handlePrevTheme = () => {
    setCurrentThemeIndex(prev => (prev - 1 + BUTTON_THEME_PALETTES.length) % BUTTON_THEME_PALETTES.length);
    setIsThemeSaved(false);
  };

  const handleNextTheme = () => {
    setCurrentThemeIndex(prev => (prev + 1) % BUTTON_THEME_PALETTES.length);
    setIsThemeSaved(false);
  };

  const handleSelectTheme = async () => {
    const selected = BUTTON_THEME_PALETTES[currentThemeIndex];
    await buttonThemeService.saveTheme(selected.id);
    setIsThemeSaved(true);

    if (activeEnterpriseBlindId && activeEnterpriseBlindId !== 'default') {
      try {
        const currConfig = await helpDeskLicenseService.getAdvancedFeaturesConfig(activeEnterpriseBlindId);
        await helpDeskLicenseService.updateAdvancedFeaturesConfig(activeEnterpriseBlindId, {
          ...currConfig,
          buttonThemeId: selected.id,
        });
      } catch (e) {
        console.warn('[SettingsStationModal] Sync buttonTheme to D1 warning:', e);
      }
    }

    if (onThemeChanged) {
      onThemeChanged(selected);
    }
  };

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
            contentContainerStyle={{ paddingBottom: 60, paddingTop: 14 }}
          >
            {/* GOOGLE CARD 1: FİRMA ADI DÜZENLEME */}
            <View style={styles.googleCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardIconBox}>
                  <Building2 size={16} color="#2563EB" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.cardTitleText}>{t('settings.station.company_name_title')}</Text>
                  <Text style={styles.cardSubText}>{t('settings.station.company_name_sub')}</Text>
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
                <TouchableOpacity style={styles.inlineAddButton} onPress={onSaveEnterpriseName} activeOpacity={0.8}>
                  <Text style={styles.inlineAddButtonText}>{t('settings.station.update_btn')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* GOOGLE CARD 2: GİRİŞ VE GÜVENLİK İLKELERİ */}
            <View style={styles.googleCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardIconBox}>
                  <ShieldCheck size={16} color="#2563EB" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.cardTitleText}>{t('settings.station.login_policies_title')}</Text>
                  <Text style={styles.cardSubText}>{t('settings.station.login_policies_sub')}</Text>
                </View>
              </View>

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

            {/* GOOGLE CARD 3: LOGO YÖNETİMİ */}
            <View style={styles.googleCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardIconBox}>
                  <ImageIcon size={16} color="#2563EB" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.cardTitleText}>{t('settings.station.logo_title')}</Text>
                  <Text style={styles.cardSubText}>{t('settings.station.logo_sub')}</Text>
                </View>
              </View>

              {tenantLogoUri ? (
                <View style={{ width: '100%', alignItems: 'center' }}>
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

                  <Text style={styles.logoLongPressHint}>
                    {t('settings.station.logo_long_press_hint')}
                  </Text>

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

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, width: '100%' }}>
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
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, width: '100%' }}>
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

            {/* GOOGLE CARD 4: ÖZEL ALAN GİRİŞİ */}
            <View style={styles.googleCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardIconBox}>
                  <ListPlus size={16} color="#2563EB" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.cardTitleText}>{t('settings.station.custom_fields_title')}</Text>
                  <Text style={styles.cardSubText}>{t('settings.station.custom_fields_sub')}</Text>
                </View>
              </View>

              <View style={{ marginTop: 2, marginBottom: 8 }}>
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
                <TouchableOpacity style={styles.inlineAddButton} onPress={onAddCustomField} activeOpacity={0.8}>
                  <Text style={styles.inlineAddButtonText}>{t('settings.station.add_custom_field_btn')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* GOOGLE CARD 5: BUTON TEMASI SEÇİCİ (DOĞRUDAN ÇERÇEVE İÇİ) */}
            <View style={styles.googleCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardIconBox}>
                  <Palette size={16} color="#2563EB" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.cardTitleText}>{t('settings.station.button_theme_title')}</Text>
                  <Text style={styles.cardSubText}>{t('settings.station.button_theme_sub')}</Text>
                </View>
                <View style={styles.badgeCounterBox}>
                  <Text style={styles.badgeCounterText}>
                    {String(currentThemeIndex + 1).padStart(2, '0')} / {BUTTON_THEME_PALETTES.length}
                  </Text>
                </View>
              </View>

              {/* Aktif Palet Adı (60 Dile Lokalize) */}
              <View style={styles.themeNameWrapper}>
                <Text style={styles.themeNameText}>
                  {t(`settings.station.palette_${activePalette.id}`, activePalette.name)}
                </Text>
              </View>

              {/* 3 Buton Canlı Önizleme Yığını */}
              <View style={styles.buttonsStack}>
                {/* 1. Bilet Oluştur (Mavi Palet) */}
                <View
                  style={[
                    styles.previewBtn,
                    {
                      backgroundColor: activePalette.ticket.bg,
                      borderColor: activePalette.ticket.border !== 'transparent' ? activePalette.ticket.border : 'transparent',
                      borderWidth: activePalette.ticket.border !== 'transparent' ? 1 : 0,
                    },
                  ]}
                >
                  <View style={styles.previewBtnLeft}>
                    <Plus size={16} color={activePalette.ticket.text} strokeWidth={2.5} />
                    <Text style={[styles.previewBtnText, { color: activePalette.ticket.text }]}>
                      {t('helpdesk.create_new_ticket_btn')}
                    </Text>
                  </View>
                  <ArrowUp size={15} color={activePalette.ticket.text} strokeWidth={2.5} />
                </View>

                {/* 2. Tartışma Başlat (Turuncu Palet) */}
                <View
                  style={[
                    styles.previewBtn,
                    {
                      backgroundColor: activePalette.disc.bg,
                      borderColor: activePalette.disc.border !== 'transparent' ? activePalette.disc.border : 'transparent',
                      borderWidth: activePalette.disc.border !== 'transparent' ? 1 : 0,
                    },
                  ]}
                >
                  <View style={styles.previewBtnLeft}>
                    <MessageSquare size={16} color={activePalette.disc.text} strokeWidth={2.2} />
                    <Text style={[styles.previewBtnText, { color: activePalette.disc.text }]}>
                      {t('helpdesk.start_discussion_btn')}
                    </Text>
                  </View>
                  <ArrowRight size={15} color={activePalette.disc.text} strokeWidth={2.5} />
                </View>

                {/* 3. Telsiz Yayını (Yeşil Palet) */}
                <View
                  style={[
                    styles.previewBtn,
                    {
                      backgroundColor: activePalette.radio.bg,
                      borderColor: activePalette.radio.border !== 'transparent' ? activePalette.radio.border : 'transparent',
                      borderWidth: activePalette.radio.border !== 'transparent' ? 1 : 0,
                    },
                  ]}
                >
                  <View style={styles.previewBtnLeft}>
                    <Radio size={16} color={activePalette.radio.text} strokeWidth={2.2} />
                    <Text style={[styles.previewBtnText, { color: activePalette.radio.text }]}>
                      {t('helpdesk.start_radio_broadcast_btn')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Seçilen Paletin Hex Kodları */}
              <View style={styles.hexRow}>
                <Text style={styles.hexText}>
                  {activePalette.ticket.border !== 'transparent' && activePalette.ticket.bg === '#FFFFFF'
                    ? `BD: ${activePalette.ticket.border}`
                    : activePalette.ticket.bg}
                </Text>
                <Text style={styles.hexText}>
                  {activePalette.disc.border !== 'transparent' && activePalette.disc.bg === '#FFFFFF'
                    ? `BD: ${activePalette.disc.border}`
                    : activePalette.disc.bg}
                </Text>
                <Text style={styles.hexText}>
                  {activePalette.radio.border !== 'transparent' && activePalette.radio.bg === '#FFFFFF'
                    ? `BD: ${activePalette.radio.border}`
                    : activePalette.radio.bg}
                </Text>
              </View>

              {/* Alt Kontrol: Sol Ok, Seç Butonu, Sağ Ok */}
              <View style={styles.navRow}>
                <TouchableOpacity
                  style={styles.navArrowBtn}
                  onPress={handlePrevTheme}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <ChevronLeft size={20} color="#334155" strokeWidth={2.2} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.selectThemeBtn,
                    isThemeSaved && styles.selectThemeBtnSaved,
                  ]}
                  onPress={handleSelectTheme}
                  activeOpacity={0.85}
                >
                  <Check size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                  <Text style={styles.selectThemeBtnText}>
                    {isThemeSaved ? t('settings.station.button_theme_selected_btn') : t('settings.station.button_theme_select_btn')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.navArrowBtn}
                  onPress={handleNextTheme}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <ChevronRight size={20} color="#334155" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
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
    borderBottomColor: '#E2E8F0',
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
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Google Material 3 Section Card
  googleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 0.2,
  },
  cardSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  warningNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  warningNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },
  settingsLogoPreviewWrapper: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLongPressHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
  },
  alignControlsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    width: '100%',
  },
  alignControlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 8,
    gap: 6,
  },
  alignControlBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  alignControlBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  alignControlBtnTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  snippingToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingVertical: 9,
  },
  snippingToolBtnText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  logoActionBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 9,
  },
  logoActionBtnDangerText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  logoPlaceholderBox: {
    width: '100%',
    height: 90,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  bluePillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 9,
  },
  bluePillButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  quickChipsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 6,
  },
  quickChipAdded: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  quickChipTextAdded: {
    color: '#16A34A',
  },
  adminItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  adminItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  adminItemSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  deleteIconButton: {
    padding: 6,
  },
  // Button Theme Inline Styles
  badgeCounterBox: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  badgeCounterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    fontFamily: 'monospace',
  },
  themeNameWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginBottom: 10,
  },
  themeNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  buttonsStack: {
    flexDirection: 'column',
    gap: 8,
  },
  previewBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  previewBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  hexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
  },
  hexText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  navArrowBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectThemeBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  selectThemeBtnSaved: {
    backgroundColor: '#15803D',
    shadowColor: '#15803D',
  },
  selectThemeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
