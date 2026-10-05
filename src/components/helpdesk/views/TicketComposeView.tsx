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
} from 'react-native';
import {
  ChevronLeft,
  Camera,
  Paperclip,
  FileText,
  Send,
  X,
  Search,
  Tag,
  Package,
  HelpCircle,
} from 'lucide-react-native';
import { HelpDeskCategory, INWHITE_CATEGORIES } from '../../../services/helpDeskService';
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
  isSendActive: boolean;
  isHelpCommand?: boolean;
  sending: boolean;
  language: string;
  getLabel: (key: string, tr: string, en: string) => string;
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
}) => {
  const [activeFieldKey, setActiveFieldKey] = React.useState<string | null>(null);

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
              paddingTop: safeTop + 10,
              paddingBottom: keyboardHeight > 0 ? keyboardHeight : 20,
            }
          ]}
        >
          {/* WHITEDESK LOGO */}
          <View style={styles.scrollLogoRow}>
            <Text style={styles.logoText} numberOfLines={1} adjustsFontSizeToFit>WhiteDesk</Text>
          </View>

          {/* SAMSUNG ONE UI DIRECT ON CANVAS BACK BUTTON */}
          <TouchableOpacity
            style={styles.samsungBackRow}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <ChevronLeft size={22} color="#1E293B" strokeWidth={2.4} style={{ marginRight: 4 }} />
            <Text style={styles.samsungBackText}>
              {supportTicketTarget === 'thewhite'
                ? getLabel('helpdesk.theWhiteSupportTicket', 'TheWhite Uygulama Destek Bileti', 'TheWhite App Support Ticket')
                : supportTicketTarget === 'global_admin'
                ? getLabel('helpdesk.globalAdminSupportTicket', 'Kurum Yöneticisi Destek Bileti', 'Global Admin Support Ticket')
                : getLabel('helpdesk.newTicket', 'Yeni Destek Bileti', 'New Support Ticket')}
            </Text>
          </TouchableOpacity>

          <View style={styles.composeCardFluid}>
            {/* Category Selector (Horizontal Scroll) */}
            <View style={styles.composeFieldGroup}>
              <Text style={styles.composeFieldLabel}>
                {getLabel('helpdesk.category', 'KATEGORİ', 'CATEGORY')}
              </Text>
              {supportTicketTarget === 'thewhite' ? (
                <View style={[styles.categoryPill, styles.categoryPillActive, { alignSelf: 'flex-start', backgroundColor: '#ECFDF5', borderColor: '#10B981' }]}>
                  <Text style={[styles.categoryPillText, { color: '#047857', fontWeight: '700' }]}>
                    {language === 'tr' ? 'TheWhite Uygulama & Mimari Desteği' : 'TheWhite App & Architecture Support'}
                  </Text>
                </View>
              ) : supportTicketTarget === 'global_admin' ? (
                <View style={[styles.categoryPill, styles.categoryPillActive, { alignSelf: 'flex-start', backgroundColor: '#ECFDF5', borderColor: '#10B981' }]}>
                  <Text style={[styles.categoryPillText, { color: '#047857', fontWeight: '700' }]}>
                    {language === 'tr' ? 'Kurum Yöneticisi Desteği (Global Admin)' : 'Global Admin Internal Support'}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal={true}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScrollContainer}
                >
                  {(availableCategories.length > 0 ? availableCategories : INWHITE_CATEGORIES).map((cat) => {
                    const isSelected = composeCategory === cat.id;
                    const catLabel = language === 'tr' ? cat.labelTr : cat.labelEn;
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
              )}
            </View>

            {/* Subject Input */}
            <View style={styles.composeFieldGroup}>
              <Text style={styles.composeFieldLabel}>
                {getLabel('helpdesk.subject', 'KONU', 'SUBJECT')}
              </Text>
              <TextInput
                style={styles.composeInputField}
                placeholder={
                  supportTicketTarget === 'thewhite'
                    ? getLabel('helpdesk.theWhiteSubjectPlaceholder', 'Örn: Lisans artırımı, sunucusuz mimari veya entegrasyon desteği', 'e.g., License upgrade, serverless architecture, or integration support')
                    : supportTicketTarget === 'global_admin'
                    ? getLabel('helpdesk.globalAdminSubjectPlaceholder', 'Örn: Operasyonel yetki artırımı, donanım veya masa talebi', 'e.g., Desk permission upgrade, hardware, or access request')
                    : getLabel('helpdesk.subjectPlaceholder', 'Örn: Sesli arama bağlantı gecikmesi', 'e.g., Voice call connection latency')
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
                <View style={styles.customFieldsHeaderRow}>
                  <Tag size={13} color="#2563EB" style={{ marginRight: 6 }} />
                  <Text style={styles.customFieldsSectionTitle}>
                    {getLabel('helpdesk.customFieldsTitle', 'KAYIT / CİHAZ BİLGİLERİ', 'RECORD / DEVICE DETAILS')}
                  </Text>
                </View>

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
                            <Text style={styles.catalogSearchBadgeText}>Katalogdan Ara</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.customFieldInputWrap}>
                        <TextInput
                          style={styles.customFieldInput}
                          placeholder={
                            catalog && catalog.length > 0
                              ? `${field.label} ara veya yazın...`
                              : `${field.label} girin...`
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
                              Katalog Eşleşmeleri ({suggestions.length})
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

            {/* Message Body Input — OR /help command card when isHelpCommand */}
            <View style={styles.composeFieldGroup}>
              <Text style={styles.composeFieldLabel}>
                {getLabel('helpdesk.message', 'MESAJ', 'MESSAGE')}
              </Text>
              <TextInput
                style={styles.composeMessageField}
                placeholder={
                  supportTicketTarget === 'thewhite'
                    ? getLabel('helpdesk.theWhiteMessagePlaceholder', 'TheWhite ekibine iletmek istediğiniz sistem ve uygulama destek talebini detaylandırın...', 'Describe the platform and app support inquiry you need from TheWhite...')
                    : supportTicketTarget === 'global_admin'
                    ? getLabel('helpdesk.globalAdminMessagePlaceholder', 'Kurum yöneticinize iletmek istediğiniz talep veya operasyon konusunu detaylandırın...', 'Describe the internal request for your Global Admin...')
                    : getLabel('helpdesk.messagePlaceholder', 'Talebinizi ayrıntılı olarak yazın...', 'Describe your inquiry or issue in detail...')
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
                      {language === 'tr' ? 'Tartışma Yönlendirme Komutları' : 'Discussion Routing Commands'}
                    </Text>
                  </View>
                  {[
                    {
                      cmd: '/help',
                      desc: language === 'tr' ? 'Bu komut listesini göster' : 'Show this command list',
                    },
                    {
                      cmd: '/admin  Konu',
                      desc: language === 'tr' ? 'Tüm global admin ve operatör adminlere broadcast' : 'Broadcast to ALL global admins & operator admins',
                    },
                    {
                      cmd: '@tenantId  Konu',
                      desc: language === 'tr' ? 'Belirli bir kiracının global adminlerine yaz' : 'Write to a specific tenant\'s global admins',
                    },
                    {
                      cmd: '@tanımlananİsim  Konu',
                      desc: language === 'tr' ? 'Belirli bir admine doğrudan yaz' : 'Write directly to a specific admin by alias',
                    },
                    {
                      cmd: '(prefix yok)',
                      desc: language === 'tr' ? 'Tüm global adminlere yayın (varsayılan)' : 'Broadcast to all global admins (default)',
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

            {/* Attachment Preview if selected */}
            {attachedFile && (
              <View style={styles.attachPreviewBarFluid}>
                {attachedFile.type === 'image' ? (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${attachedFile.data}` }}
                    style={styles.attachThumb}
                  />
                ) : (
                  <View style={styles.attachDocIconBox}>
                    <FileText size={18} color="#3B82F6" />
                  </View>
                )}
                <Text style={styles.attachFileName} numberOfLines={1}>
                  {attachedFile.name}
                </Text>
                <TouchableOpacity
                  onPress={() => setAttachedFile(null)}
                  style={styles.attachRemoveBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            )}

            {/* Attachment Selection Row */}
            <View style={styles.composeAttachRowFluid}>
              <Text style={styles.composeAttachLabel}>
                {getLabel('helpdesk.attachment', 'Ek (isteğe bağlı)', 'Attachment (optional)')}
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
              </View>
            </View>

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
                    {getLabel('helpdesk.send', 'Bileti Gönder', 'Submit Ticket')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
});
