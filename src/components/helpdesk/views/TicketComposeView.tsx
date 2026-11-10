import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Camera,
  Paperclip,
  FileText,
  Send,
  X,
  Search,
  Tag,
  Package,
  HelpCircle,
    ShieldCheck,
  Activity,
  MoreVertical,
  Cpu,
  Image as ImageIcon,
  Check,
} from 'lucide-react-native';
import { piiSanitizer } from '../../../services/piiSanitizer';
import { useTranslation } from '../../../services/i18nService';
import { HeadphoneChatIcon } from '../icons/HeadphoneChatIcon';
import { HelpDeskCategory } from '../../../services/helpDeskService';
import { AttachedFile, CustomFieldDef, CatalogItem } from '../types';

interface TicketComposeViewProps {
  safeTop: number;
  keyboardHeight: number;
  composeScrollRef: React.RefObject<ScrollView | null>;
  composeSubject: string;
  setComposeSubject: (s: string) => void;
  composeMessage: string;
  setComposeMessage: (m: string) => void;
  composeCategory: string;
  setComposeCategory: (c: string) => void;
  availableCategories: HelpDeskCategory[];
  attachedFile: AttachedFile | null;
  setAttachedFile: (f: AttachedFile | null) => void;
  attachedFiles?: AttachedFile[];
  onRemoveAttachedFile?: (index: number) => void;
  isSendActive: boolean;
  isHelpCommand?: boolean;
  sending: boolean;
  language: string;
  getLabel: (key: string, trOrParams?: string | Record<string, string | number>, en?: string, maybeParams?: Record<string, string | number>) => string;
  onBack: () => void;
  onPickCamera: () => void;
  onPickGallery: () => void;
  onPickDocument: () => void;
  onCreateTicket: () => void;
  customFields?: CustomFieldDef[];
  customFieldValues?: Record<string, string>;
  setCustomFieldValues?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  catalog?: CatalogItem[];
  supportTicketTarget?: 'none' | 'thewhite' | 'global_admin';
  isAdmin?: boolean;
  isFounder?: boolean;
  enterpriseName?: string | null;
  isCreatingDiscussion?: boolean;
  attachDiagnostics?: boolean;
  setAttachDiagnostics?: (v: boolean) => void;
}

export const TicketComposeView: React.FC<TicketComposeViewProps> = ({
  safeTop,
  keyboardHeight,
  composeScrollRef,
  composeSubject,
  setComposeSubject,
  composeMessage,
  setComposeMessage,
  composeCategory,
  setComposeCategory,
  availableCategories,
  attachedFile,
  setAttachedFile,
  attachedFiles = [],
  onRemoveAttachedFile,
  isSendActive,
  isHelpCommand = false,
  sending,
  language,
  getLabel,
  onBack,
  onPickCamera,
  onPickGallery,
  onPickDocument,
  onCreateTicket,
  customFields = [],
  customFieldValues = {},
  setCustomFieldValues,
  catalog = [],
  supportTicketTarget = 'none',
  isAdmin = false,
  isFounder = false,
  enterpriseName = null,
  isCreatingDiscussion = false,
  attachDiagnostics = false,
  setAttachDiagnostics,
}) => {
  const { t } = useTranslation();
  const [activeFieldKey, setActiveFieldKey] = React.useState<string | null>(null);
  const [isCustomFieldsExpanded, setIsCustomFieldsExpanded] = React.useState<boolean>(false);
  const [isMenuModalVisible, setIsMenuModalVisible] = React.useState<boolean>(false);
  const [isDiagConsentModalVisible, setIsDiagConsentModalVisible] = React.useState<boolean>(false);
  const hasPiiDetected = React.useMemo(() => {
    return piiSanitizer.hasPii(composeSubject) || piiSanitizer.hasPii(composeMessage);
  }, [composeSubject, composeMessage]);

  // Normalizes keys to match catalog keys case-insensitively
  const getCatalogValue = (item: CatalogItem, field: CustomFieldDef): string | undefined => {
    if (item[field.key] !== undefined) return String(item[field.key]);
    if (item[field.label] !== undefined) return String(item[field.label]);
    const normKey = field.key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normLabel = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [k, v] of Object.entries(item)) {
      const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normK === normKey || normK === normLabel) return String(v);
    }
    return undefined;
  };

  const getItemSubtitle = (item: CatalogItem, currentFieldKey: string): string => {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(item)) {
      if (k.toLowerCase() === currentFieldKey.toLowerCase()) continue;
      if (v && String(v).trim()) {
        parts.push(`${k}: ${v}`);
      }
    }
    return parts.slice(0, 3).join(' • ');
  };

  const getCatalogSuggestions = (field: CustomFieldDef, query: string): CatalogItem[] => {
    if (!catalog || catalog.length === 0 || !query || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    return catalog.filter(item => {
      const val = getCatalogValue(item, field);
      if (val && val.toLowerCase().includes(q)) return true;
      for (const v of Object.values(item)) {
        if (typeof v === 'string' && v.toLowerCase().includes(q)) return true;
      }
      return false;
    }).slice(0, 5);
  };

  const handleSelectCatalogItem = (selectedItem: CatalogItem, currentField: CustomFieldDef) => {
    if (!setCustomFieldValues) return;
    setCustomFieldValues(prev => {
      const updated = { ...(prev || {}) };
      const currentVal = getCatalogValue(selectedItem, currentField);
      if (currentVal) {
        updated[currentField.key] = currentVal;
      }
      customFields.forEach(f => {
        const matchVal = getCatalogValue(selectedItem, f);
        if (matchVal) {
          updated[f.key] = matchVal;
        }
      });
      return updated;
    });
    setActiveFieldKey(null);
  };
  return (
    <View style={styles.screenContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

      {/* 50% SEMI-TRANSPARENT STATUS BAR OVERLAY */}
      <View 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: safeTop,
          backgroundColor: 'rgba(244, 247, 250, 0.5)',
          zIndex: 50,
        }}
        pointerEvents="none"
      />

      {/* FLUID INPUT CARD */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={safeTop}
        style={styles.fluidFlexWrapper}
      >
        <ScrollView
          ref={composeScrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.fluidScrollContent,
            {
              paddingTop: safeTop + 6,
              paddingBottom: keyboardHeight > 0 ? keyboardHeight : 20,
            }
          ]}
        >
          {/* TOP HEADER ROW */}
          <TouchableOpacity
            style={styles.samsungBackRow}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <ChevronLeft size={22} color="#1E293B" strokeWidth={2.4} style={{ marginRight: 4 }} />
            <Text style={styles.samsungBackText}>
              {isCreatingDiscussion
                ? getLabel('helpdesk.start_new_discussion_header')
                : getLabel('helpdesk.create_new_ticket_btn')}
            </Text>
          </TouchableOpacity>

          <View style={styles.composeCardFluid}>
            {/* PANEL HEADER ROW WITH HEADPHONES ICON (SAME AS ENTRANCE SCREEN) */}
            <View style={styles.panelHeaderRow}>
              <View style={styles.sectionTitleContainer}>
                <View style={styles.titleIconBox}>
                  <HeadphoneChatIcon size={28} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.sectionTitleText} numberOfLines={1}>
                    {isAdmin ? t('helpdesk.titleAdmin') : t('helpdesk.titleUser')}
                  </Text>
                  <Text style={styles.sectionSubtitleText} numberOfLines={1}>
                    {isAdmin 
                      ? (isFounder ? getLabel('helpdesk.founder_root_subtitle') : (enterpriseName || getLabel('helpdesk.enterprise_support_desk')))
                      : (enterpriseName || getLabel('helpdesk.support_and_ops_center'))}
                  </Text>
                </View>
              </View>

              {/* BİLET KARTININ SAĞ ÜST KÖŞESİ: 3 NOKTA MENÜSÜ */}
              <TouchableOpacity
                style={styles.composeMoreBtn}
                onPress={() => setIsMenuModalVisible(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MoreVertical size={18} color="#64748B" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
            {/* Category Selector (Horizontal Scroll) */}
            <View style={styles.composeFieldGroup}>
              <Text style={styles.composeFieldLabel}>
                {getLabel('helpdesk.category')}
              </Text>
              <ScrollView
                horizontal={true}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScrollContainer}
              >
                {availableCategories.map((cat) => {
                    const isSelected = composeCategory === cat.id;
                    const i18nCat = t(`helpdesk.cat_${cat.id}`);
                    const catLabel = i18nCat !== `helpdesk.cat_${cat.id}` ? i18nCat : (language === 'tr' ? cat.labelTr : (cat.labelEn || cat.labelTr));
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryPill,
                          isSelected && styles.categoryPillActive,
                        ]}
                        onPress={() => setComposeCategory(cat.id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.categoryPillText,
                            isSelected && styles.categoryPillTextActive,
                          ]}
                        >
                          {catLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
            </View>

            {/* Subject Input */}
            <View style={styles.composeFieldGroup}>
              <Text style={styles.composeFieldLabel}>
                {getLabel('helpdesk.subject')}
              </Text>
              <TextInput
                style={styles.composeInputField}
                placeholder={
                  supportTicketTarget === 'thewhite'
                    ? getLabel('helpdesk.theWhiteSubjectPlaceholder')
                    : supportTicketTarget === 'global_admin'
                    ? getLabel('helpdesk.globalAdminSubjectPlaceholder')
                    : getLabel('helpdesk.subjectPlaceholder')
                }
                placeholderTextColor="#94a3b8"
                value={composeSubject}
                onChangeText={setComposeSubject}
                onFocus={() => {
                  setTimeout(() => {
                    composeScrollRef.current?.scrollTo({ y: 0, animated: true });
                  }, 50);
                }}
              />
            </View>



            {/* Custom Enterprise Fields Section (if configured by tenant) */}
            {customFields && customFields.length > 0 && (
              <View style={styles.customFieldsSection}>
                <TouchableOpacity
                  style={[
                    styles.customFieldsHeaderRow,
                    { justifyContent: 'space-between', marginBottom: isCustomFieldsExpanded ? 10 : 0 }
                  ]}
                  onPress={() => setIsCustomFieldsExpanded(prev => !prev)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Tag size={13} color="#2563EB" style={{ marginRight: 6 }} />
                    <Text style={styles.customFieldsSectionTitle}>
                      {getLabel('helpdesk.customFieldsTitle')}
                    </Text>
                  </View>
                  {isCustomFieldsExpanded ? (
                    <ChevronUp size={16} color="#64748B" strokeWidth={2.4} />
                  ) : (
                    <ChevronDown size={16} color="#64748B" strokeWidth={2.4} />
                  )}
                </TouchableOpacity>

                {isCustomFieldsExpanded && (
                  <View style={{ marginTop: 4 }}>
                    {customFields.map((field) => {
                  const currentValue = customFieldValues?.[field.key] || '';
                  const suggestions = activeFieldKey === field.key ? getCatalogSuggestions(field, currentValue) : [];
                  const hasSuggestions = suggestions.length > 0;

                  return (
                    <View key={field.key} style={styles.customFieldItem}>
                      <View style={styles.customFieldLabelRow}>
                        <Text style={styles.customFieldLabelText}>
                          {field.label}
                          {field.required && <Text style={{ color: '#EF4444' }}> *</Text>}
                        </Text>
                        {catalog && catalog.length > 0 && (
                          <View style={styles.catalogSearchBadge}>
                            <Search size={10} color="#2563EB" style={{ marginRight: 3 }} />
                            <Text style={styles.catalogSearchBadgeText}>{getLabel('helpdesk.search_from_catalog')}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.customFieldInputWrap}>
                        <TextInput
                          style={styles.customFieldInput}
                          placeholder={
                            catalog && catalog.length > 0
                              ? getLabel('helpdesk.search_or_type_field', { label: field.label })
                              : getLabel('helpdesk.enter_field', { label: field.label })
                          }
                          placeholderTextColor="#94a3b8"
                          value={currentValue}
                          onChangeText={(text) => {
                            setCustomFieldValues?.((prev) => ({
                              ...(prev || {}),
                              [field.key]: text,
                            }));
                            setActiveFieldKey(field.key);
                          }}
                          onFocus={() => setActiveFieldKey(field.key)}
                        />
                        {currentValue.length > 0 && (
                          <TouchableOpacity
                            style={styles.customFieldClearBtn}
                            onPress={() => {
                              setCustomFieldValues?.((prev) => ({
                                ...(prev || {}),
                                [field.key]: '',
                              }));
                              setActiveFieldKey(null);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <X size={14} color="#94A3B8" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Autocomplete Suggestions Dropdown */}
                      {hasSuggestions && (
                        <View style={styles.suggestionsDropdown}>
                          <View style={styles.suggestionsHeader}>
                            <Text style={styles.suggestionsHeaderText}>
                              {getLabel('helpdesk.catalog_matches_count', { count: suggestions.length })}
                            </Text>
                            <TouchableOpacity onPress={() => setActiveFieldKey(null)}>
                              <X size={13} color="#94A3B8" />
                            </TouchableOpacity>
                          </View>
                          {suggestions.map((item, idx) => {
                            const mainVal = getCatalogValue(item, field) || Object.values(item)[0] || '';
                            const subText = getItemSubtitle(item, field.key);
                            return (
                              <TouchableOpacity
                                key={`sug_${idx}`}
                                style={styles.suggestionRow}
                                onPress={() => handleSelectCatalogItem(item, field)}
                                activeOpacity={0.7}
                              >
                                <Package size={14} color="#2563EB" style={{ marginRight: 8, marginTop: 2 }} />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.suggestionMainText}>{mainVal}</Text>
                                  {subText ? (
                                    <Text style={styles.suggestionSubText} numberOfLines={1}>
                                      {subText}
                                    </Text>
                                  ) : null}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
                  </View>
                )}
              </View>
            )}

            {/* Message Body Input — OR /help command card when isHelpCommand */}
            <View style={styles.composeFieldGroup}>
              <Text style={styles.composeFieldLabel}>
                {getLabel('helpdesk.message')}
              </Text>
              <TextInput
                style={styles.composeMessageField}
                placeholder={
                  supportTicketTarget === 'thewhite'
                    ? getLabel('helpdesk.theWhiteMessagePlaceholder')
                    : supportTicketTarget === 'global_admin'
                    ? getLabel('helpdesk.globalAdminMessagePlaceholder')
                    : getLabel('helpdesk.messagePlaceholder')
                }
                placeholderTextColor="#94a3b8"
                value={composeMessage}
                onChangeText={setComposeMessage}
                multiline={true}
                scrollEnabled={true}
                textAlignVertical="top"
                onFocus={() => {
                  setTimeout(() => {
                    composeScrollRef.current?.scrollTo({ y: 155, animated: true });
                  }, 120);
                }}
              />
              {/* /help INLINE COMMAND REFERENCE — appears inside message area when user types /help */}
              {isHelpCommand && (
                <View style={styles.helpCommandCard}>
                  <View style={styles.helpCommandCardHeader}>
                    <HelpCircle size={13} color="#3B82F6" strokeWidth={2.2} style={{ marginRight: 5 }} />
                    <Text style={styles.helpCommandCardTitle}>
                      {getLabel('helpdesk.discussion_routing_commands_title')}
                    </Text>
                  </View>
                  {[
                    {
                      cmd: '/help',
                      desc: getLabel('helpdesk.cmd_help_desc'),
                    },
                    {
                      cmd: getLabel('helpdesk.cmd_admin_syntax'),
                      desc: getLabel('helpdesk.cmd_admin_desc'),
                    },
                    {
                      cmd: getLabel('helpdesk.cmd_tenant_syntax'),
                      desc: getLabel('helpdesk.cmd_tenant_desc'),
                    },
                    {
                      cmd: getLabel('helpdesk.cmd_alias_syntax'),
                      desc: getLabel('helpdesk.cmd_alias_desc'),
                    },
                    {
                      cmd: getLabel('helpdesk.cmd_default_syntax'),
                      desc: getLabel('helpdesk.cmd_default_desc'),
                    },
                  ].map((item, idx) => (
                    <View key={idx} style={styles.helpCommandRow}>
                      <Text style={styles.helpCommandCode}>{item.cmd}</Text>
                      <Text style={styles.helpCommandDesc}>{item.desc}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Attachment Preview if selected (Multiple Support) */}
            {(() => {
              const effectiveAttachedFiles = attachedFiles.length > 0 ? attachedFiles : (attachedFile ? [attachedFile] : []);
              if (effectiveAttachedFiles.length === 0) return null;
              return (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingBottom: 6 }}
                >
                  {effectiveAttachedFiles.map((file, fIdx) => (
                    <View key={`compose_att_${fIdx}`} style={styles.attachPreviewBarFluid}>
                      {file.type === 'image' && file.data ? (
                        <Image
                          source={{ uri: file.data.startsWith('data:') ? file.data : `data:image/jpeg;base64,${file.data}` }}
                          style={styles.attachThumb}
                        />
                      ) : (
                        <View style={styles.attachDocIconBox}>
                          <FileText size={18} color="#3B82F6" />
                        </View>
                      )}
                      <Text style={styles.attachFileName} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          if (onRemoveAttachedFile) {
                            onRemoveAttachedFile(fIdx);
                          } else {
                            setAttachedFile(null);
                          }
                        }}
                        style={styles.attachRemoveBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X size={16} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              );
            })()}

            {/* Attachment Selection Row */}
            <View style={styles.composeAttachRowFluid}>
              <Text style={styles.composeAttachLabel}>
                {getLabel('helpdesk.attachment')}
              </Text>
              <View style={styles.composeAttachBtnsRow}>
                <TouchableOpacity
                  style={styles.attachMiniBtn}
                  onPress={onPickCamera}
                  activeOpacity={0.7}
                >
                  <Camera size={16} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.attachMiniBtn}
                  onPress={onPickGallery}
                  activeOpacity={0.7}
                >
                  <Paperclip size={16} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.attachMiniBtn}
                  onPress={onPickDocument}
                  activeOpacity={0.7}
                >
                  <FileText size={16} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.attachMiniBtn,
                    attachDiagnostics && styles.attachMiniBtnActiveDiag,
                  ]}
                  onPress={() => setIsDiagConsentModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Cpu
                    size={16}
                    color={attachDiagnostics ? '#15803D' : '#64748B'}
                  />
                  {attachDiagnostics && <View style={styles.attachActiveDot} />}
                </TouchableOpacity>
              </View>
            </View>

            {attachDiagnostics && (
              <View style={styles.diagNoticeBox}>
                <Activity size={13} color="#15803D" style={{ marginRight: 6 }} />
                <Text style={styles.diagNoticeText}>
                  {getLabel('helpdesk.diag_encrypted_notice')}
                </Text>
              </View>
            )}

            {/* PII Redaction Live Protection Badge */}
            {hasPiiDetected && (
              <View style={styles.piiShieldBadge}>
                <ShieldCheck size={14} color="#059669" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={styles.piiShieldText}>
                  {getLabel('helpdesk.pii_protected_notice')}
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.fluidSubmitBtn,
                isSendActive && !sending && styles.fluidSubmitBtnActive,
              ]}
              onPress={onCreateTicket}
              disabled={!isSendActive || sending}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Send size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.fluidSubmitBtnText}>
                    {getLabel('helpdesk.send')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {/* 3 NOKTA MENÜSÜ DROPDOWN MODALI */}
      <Modal
        visible={isMenuModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setIsMenuModalVisible(false)}
      >
        <View style={styles.dropdownOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setIsMenuModalVisible(false)}
          />
          <View style={[styles.dropdownPopupContainer, { top: safeTop + 54 }]}>
            {/* 1. Sistem Tanısı Ekle / Kaldır */}
            <TouchableOpacity
              style={styles.dropdownMenuItem}
              onPress={() => {
                setIsMenuModalVisible(false);
                if (setAttachDiagnostics) {
                  setAttachDiagnostics(!attachDiagnostics);
                }
              }}
              activeOpacity={0.65}
            >
              <Cpu size={16} color={attachDiagnostics ? '#15803D' : '#4A5568'} strokeWidth={2} style={styles.dropdownMenuIcon} />
              <Text style={[styles.dropdownMenuText, attachDiagnostics && { color: '#15803D', fontWeight: '600' }]}>
                {attachDiagnostics
                  ? getLabel('helpdesk.remove_system_diag')
                  : getLabel('helpdesk.add_system_diag')}
              </Text>
              {attachDiagnostics && <Check size={15} color="#15803D" strokeWidth={2.5} style={{ marginLeft: 'auto' }} />}
            </TouchableOpacity>

            <View style={styles.dropdownDivider} />

            {/* 2. Resim Ekle */}
            <TouchableOpacity
              style={styles.dropdownMenuItem}
              onPress={() => {
                setIsMenuModalVisible(false);
                onPickGallery();
              }}
              activeOpacity={0.65}
            >
              <ImageIcon size={16} color="#4A5568" strokeWidth={2} style={styles.dropdownMenuIcon} />
              <Text style={styles.dropdownMenuText}>
                {getLabel('helpdesk.add_image')}
              </Text>
            </TouchableOpacity>

            {/* 3. Belge Ekle */}
            <TouchableOpacity
              style={styles.dropdownMenuItem}
              onPress={() => {
                setIsMenuModalVisible(false);
                onPickDocument();
              }}
              activeOpacity={0.65}
            >
              <FileText size={16} color="#4A5568" strokeWidth={2} style={styles.dropdownMenuIcon} />
              <Text style={styles.dropdownMenuText}>
                {getLabel('helpdesk.add_document')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ÇARK İKONUNA BASILINCA AÇILAN SİSTEM TANISI BİLGİLENDİRME VE ONAY MODALI */}
      <Modal
        visible={isDiagConsentModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setIsDiagConsentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsDiagConsentModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.modalOptionIconBox, { backgroundColor: 'rgba(37, 99, 235, 0.1)', marginRight: 10 }]}>
                  <Cpu size={20} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>
                    {getLabel('helpdesk.system_diag_title')}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {getLabel('helpdesk.system_diag_subtitle')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsDiagConsentModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Bilgilendirme Kutusu */}
            <View style={styles.diagConsentInfoBox}>
              <Text style={styles.diagConsentText}>
                {getLabel('helpdesk.system_diag_info_text')}
              </Text>
              <View style={{ marginTop: 8, gap: 4 }}>
                <Text style={styles.diagConsentBullet}>
                  {getLabel('helpdesk.system_diag_bullet_zero_pii')}
                </Text>
                <Text style={styles.diagConsentBullet}>
                  {getLabel('helpdesk.system_diag_bullet_e2ee')}
                </Text>
              </View>
            </View>

            {/* Durum Göstergesi */}
            <View style={[styles.diagStatusBanner, attachDiagnostics ? styles.diagStatusBannerActive : styles.diagStatusBannerInactive]}>
              <Text style={[styles.diagStatusBannerText, attachDiagnostics ? styles.diagStatusBannerTextActive : styles.diagStatusBannerTextInactive]}>
                {attachDiagnostics
                  ? getLabel('helpdesk.system_diag_status_attached')
                  : getLabel('helpdesk.system_diag_status_not_attached')}
              </Text>
            </View>

            {/* Onay Butonları */}
            <TouchableOpacity
              style={[styles.modalPrimaryBtn, attachDiagnostics && { backgroundColor: '#DC2626' }]}
              onPress={() => {
                if (setAttachDiagnostics) {
                  setAttachDiagnostics(!attachDiagnostics);
                }
                setIsDiagConsentModalVisible(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalPrimaryBtnText}>
                {attachDiagnostics
                  ? getLabel('helpdesk.remove_system_diag')
                  : getLabel('helpdesk.confirm_and_add')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setIsDiagConsentModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelBtnText}>
                {getLabel('helpdesk.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F4F7FA',
  },
  fluidFlexWrapper: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  fluidScrollContent: {
    paddingHorizontal: 4,
    width: '100%',
    alignSelf: 'stretch',
  },
  scrollLogoRow: {
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  logoText: {
    fontSize: 58,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1.8,
    fontFamily: 'Arial Black',
    includeFontPadding: false,
    textAlignVertical: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.18)',
    textShadowOffset: { width: 0, height: 2.5 },
    textShadowRadius: 4.5,
  },
  samsungBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  samsungBackText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  composeCardFluid: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 3,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  panelHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  titleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitleText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sectionSubtitleText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  composeFieldGroup: {
    marginBottom: 16,
  },
  composeFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  categoryScrollContainer: {
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryPillTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  composeInputField: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  composeMessageField: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 120,
  },
  attachPreviewBarFluid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    marginBottom: 14,
  },
  attachThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 8,
  },
  attachDocIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  attachFileName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
  },
  attachRemoveBtn: {
    padding: 6,
  },
  composeAttachRowFluid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  composeAttachLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  composeAttachBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachMiniBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  composeDiagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  composeMoreBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  composeDiagBtnActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  composeDiagBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  composeDiagBtnTextActive: {
    color: '#15803D',
    fontWeight: '700',
  },
  diagNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  diagNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803D',
    flex: 1,
  },
  piiShieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  piiShieldText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    flex: 1,
    lineHeight: 16,
  },
  fluidSubmitBtn: {
    backgroundColor: '#94A3B8',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fluidSubmitBtnActive: {
    backgroundColor: '#3B82F6',
  },
  fluidSubmitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customFieldsSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customFieldsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  customFieldsSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.5,
  },
  customFieldItem: {
    marginBottom: 12,
  },
  customFieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  customFieldLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  catalogSearchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: '#BFDBFE',
  },
  catalogSearchBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  customFieldInputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  customFieldInput: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 32,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  customFieldClearBtn: {
    position: 'absolute',
    right: 10,
    padding: 4,
  },
  suggestionsDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginTop: 6,
    paddingVertical: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionsHeaderText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  suggestionMainText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  suggestionSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  // /help inline command reference card
  helpCommandCard: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  helpCommandCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  helpCommandCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  helpCommandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 7,
    gap: 10,
  },
  helpCommandCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 100,
  },
  helpCommandDesc: {
    fontSize: 11.5,
    color: '#334155',
    flex: 1,
    flexWrap: 'wrap',
    lineHeight: 17,
    paddingTop: 2,
  },
  composeTopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  attachMiniBtnActiveDiag: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  attachActiveDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#15803D',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  dropdownPopupContainer: {
    position: 'absolute',
    right: 16,
    width: 240,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10.5,
    paddingHorizontal: 14,
    marginHorizontal: 4,
    marginVertical: 1.5,
    borderRadius: 14,
  },
  dropdownMenuIcon: {
    marginRight: 14,
  },
  dropdownMenuText: {
    fontSize: 14.5,
    color: '#1E293B',
    fontWeight: '400',
    letterSpacing: -0.1,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 12,
    marginVertical: 4,
  },
  modalOptionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  diagConsentInfoBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  diagConsentText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    fontWeight: '500',
  },
  diagConsentBullet: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  diagStatusBanner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 14,
    alignItems: 'center',
  },
  diagStatusBannerActive: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  diagStatusBannerInactive: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  diagStatusBannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  diagStatusBannerTextActive: {
    color: '#15803D',
  },
  diagStatusBannerTextInactive: {
    color: '#64748B',
  },
  modalPrimaryBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalCancelBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});
