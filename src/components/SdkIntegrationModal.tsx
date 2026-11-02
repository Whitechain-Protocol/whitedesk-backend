import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  X,
  Building2,
  Layers,
  Key,
  Copy,
  Check,
  Code2,
  Trash2,
  AlertTriangle,
  Radio,
} from 'lucide-react-native';
import { useTranslation } from '../services/i18nService';
import { BottomConfirmationSheet } from './BottomConfirmationSheet';
import { helpDeskService } from '../services/helpDeskService';

export interface SdkIntegrationModalProps {
  visible: boolean;
  onClose: () => void;
  enterpriseName: string;
  enterpriseBlindId: string;
  orgs?: Array<{ org_id: string; name: string }>;
  bridges?: Array<{ id: number; bridge_key: string; org_id: string | null; app_name: string; created_at: number }>;
  onCreateBridge?: (orgId: string | null, appName: string) => Promise<{ success: boolean; bridgeKey: string }>;
  onRevokeBridge?: (bridgeKeyOrAppId: string) => Promise<boolean>;
}

export function SdkIntegrationModal({
  visible,
  onClose,
  enterpriseName,
  enterpriseBlindId,
  orgs,
  bridges,
  onCreateBridge,
  onRevokeBridge,
}: SdkIntegrationModalProps) {
  const { t } = useTranslation();

  const [localOrgs, setLocalOrgs] = useState<Array<{ org_id: string; name: string }>>(orgs || []);
  const [localBridges, setLocalBridges] = useState<Array<{ id: number; bridge_key: string; org_id: string | null; app_name: string; created_at: number }>>(bridges || []);

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [appNameInput, setAppNameInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Çift Onay Sayfası Durumu (Entegrasyonu Kaldır)
  const [revokeTarget, setRevokeTarget] = useState<{ key: string; appName: string } | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const loadData = async () => {
    if (!enterpriseBlindId) return;
    try {
      const [fetchedOrgs, fetchedBridges] = await Promise.all([
        helpDeskService.getOrgsList(enterpriseBlindId),
        helpDeskService.getSdkBridges(enterpriseBlindId),
      ]);
      setLocalOrgs(fetchedOrgs.map((o: any) => ({ org_id: o.org_id, name: o.name })));
      setLocalBridges(fetchedBridges);
    } catch (e) {
      console.warn('[SdkIntegrationModal] loadData error:', e);
    }
  };

  React.useEffect(() => {
    if (orgs) setLocalOrgs(orgs);
  }, [orgs]);

  React.useEffect(() => {
    if (bridges) setLocalBridges(bridges);
  }, [bridges]);

  React.useEffect(() => {
    if (visible && (!orgs || !bridges)) {
      void loadData();
    }
  }, [visible, enterpriseBlindId]);

  const handleCreate = async () => {
    setIsGenerating(true);
    try {
      let res: { success: boolean; bridgeKey: string };
      if (onCreateBridge) {
        res = await onCreateBridge(selectedOrgId, appNameInput.trim() || 'Harici Uygulama');
      } else {
        res = await helpDeskService.createSdkBridge(enterpriseBlindId, selectedOrgId, appNameInput.trim() || 'Harici Uygulama');
      }
      if (res.success && res.bridgeKey) {
        setGeneratedKey(res.bridgeKey);
        setAppNameInput('');
        void loadData();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyKey = async () => {
    if (!generatedKey) return;
    await Clipboard.setStringAsync(generatedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const codeSnippet = generatedKey
    ? `WhiteDeskSDK.init({ bridgeKey: "${generatedKey}" });`
    : `WhiteDeskSDK.init({ bridgeKey: "60_karakterlik_sdk_kopru_anahtari" });`;

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(codeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Başlık Barı */}
          <View style={styles.headerBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.headerIconBox}>
                <Code2 size={20} color="#2563EB" strokeWidth={2.2} />
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.headerTitle}>{t('integration.title')}</Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>{enterpriseName}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            {/* Açıklama Bannerı */}
            <View style={styles.explanationBanner}>
              <Code2 size={16} color="#2563EB" style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={styles.explanationBannerText}>
                Harici sistemleri (ERP, Mobil, Web) WhiteDesk altyapısına bağlayın ve 60 karakterlik SDK köprü anahtarı üreterek entegrasyon sağlayın.
              </Text>
            </View>

            {/* 1. FIRMA (SABİT) */}
            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>{t('integration.company_label')}</Text>
              <View style={styles.readOnlyBox}>
                <Building2 size={16} color="#2563EB" style={{ marginRight: 8 }} />
                <Text style={styles.readOnlyText}>{enterpriseName || 'Kuruluş'}</Text>
              </View>
            </View>

            {/* 2. ORGANİZASYON (SEÇEREK VEYA SEÇMEYEREK) */}
            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>{t('integration.org_label')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orgPickerRow}>
                {/* Seçmeyerek: Tüm Organizasyonlar / Doğrudan Firma Seviyesi */}
                <TouchableOpacity
                  style={[styles.orgChip, selectedOrgId === null && styles.orgChipActive]}
                  onPress={() => setSelectedOrgId(null)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.orgChipText, selectedOrgId === null && styles.orgChipTextActive]}>
                    {t('integration.org_all')}
                  </Text>
                  {selectedOrgId === null && <Check size={14} color="#2563EB" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>

                {/* Tanımlı Organizasyonlar */}
                {localOrgs.map(org => {
                  const isActive = selectedOrgId === org.org_id;
                  return (
                    <TouchableOpacity
                      key={`sdk_org_${org.org_id}`}
                      style={[styles.orgChip, isActive && styles.orgChipActive]}
                      onPress={() => setSelectedOrgId(org.org_id)}
                      activeOpacity={0.8}
                    >
                      <Layers size={14} color={isActive ? '#2563EB' : '#64748B'} style={{ marginRight: 6 }} />
                      <Text style={[styles.orgChipText, isActive && styles.orgChipTextActive]}>
                        {org.name}
                      </Text>
                      {isActive && <Check size={14} color="#2563EB" style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 3. UYGULAMA ADI (İSTEĞE BAĞLI) */}
            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>{t('integration.app_name_label')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={t('integration.app_name_placeholder')}
                placeholderTextColor="#94A3B8"
                value={appNameInput}
                onChangeText={setAppNameInput}
              />
            </View>

            {/* 4. ANAHTAR ÜRETİM BUTONU */}
            <TouchableOpacity
              style={[styles.primaryActionBtn, isGenerating && styles.btnDisabled]}
              onPress={handleCreate}
              disabled={isGenerating}
              activeOpacity={0.8}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Key size={18} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 8 }} />
                  <Text style={styles.primaryActionBtnText}>{t('integration.generate_key_btn')}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* 5. ÜRETİLEN ANAHTAR VE KOD ALANI */}
            {generatedKey && (
              <View style={styles.generatedKeyBox}>
                <View style={styles.keyBoxHeader}>
                  <Text style={styles.keyBoxTitle}>{t('integration.key_label')}</Text>
                  <TouchableOpacity style={styles.miniCopyBtn} onPress={handleCopyKey}>
                    {copiedKey ? <Check size={14} color="#16A34A" /> : <Copy size={14} color="#2563EB" />}
                    <Text style={[styles.miniCopyBtnText, copiedKey && { color: '#16A34A' }]}>
                      {copiedKey ? 'Kopyalandı' : t('integration.copy_btn')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 60 Karakterlik Maskelenebilir Anahtar */}
                <View style={styles.keyContainer}>
                  <Text style={styles.keyText}>{generatedKey}</Text>
                </View>

                {/* Başlatma Kodu */}
                <View style={[styles.keyBoxHeader, { marginTop: 14 }]}>
                  <Text style={styles.keyBoxTitle}>{t('integration.code_label')}</Text>
                  <TouchableOpacity style={styles.miniCopyBtn} onPress={handleCopyCode}>
                    {copiedCode ? <Check size={14} color="#16A34A" /> : <Copy size={14} color="#2563EB" />}
                    <Text style={[styles.miniCopyBtnText, copiedCode && { color: '#16A34A' }]}>
                      {copiedCode ? 'Kopyalandı' : t('integration.copy_btn')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.codeSnippetContainer}>
                  <Text style={styles.codeSnippetText}>{codeSnippet}</Text>
                </View>
              </View>
            )}

            {/* 6. MEVCUT AKTİF ENTEGRASYONLAR LİSTESİ */}
            {localBridges.length > 0 && (
              <View style={[styles.fieldSection, { marginTop: 24 }]}>
                <Text style={styles.fieldLabel}>Mevcut SDK Köprüleri ({localBridges.length})</Text>
                {localBridges.map(br => {
                  const targetOrg = localOrgs.find(o => o.org_id === br.org_id);
                  return (
                    <View key={`br_${br.id}`} style={styles.bridgeCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bridgeAppName}>{br.app_name || 'Uygulama'}</Text>
                        <Text style={styles.bridgeOrgName}>
                          {targetOrg ? targetOrg.name : t('integration.org_all')}
                        </Text>
                        <Text style={styles.bridgeKeyPreview} numberOfLines={1}>
                          {br.bridge_key}
                        </Text>
                      </View>

                      {/* Entegrasyonu Kaldır (Çift Onaylı) */}
                      <TouchableOpacity
                        style={styles.revokeBtn}
                        onPress={() => setRevokeTarget({ key: br.bridge_key, appName: br.app_name })}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={16} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* ÇİFT AŞAMALI GÜVENLİK ONAYI: ENTEGRASYONU KALDIR */}
      <BottomConfirmationSheet
        visible={!!revokeTarget}
        title={t('integration.revoke_confirm_title')}
        description={`"${revokeTarget?.appName}" uygulamasının SDK köprü anahtarı ve WhiteDesk bağlantısı kalıcı olarak iptal edilecektir. Devam etmek istiyor musunuz?`}
        actionText={t('integration.revoke_confirm_action')}
        actionColor="#DC2626"
        onAction={async () => {
          if (!revokeTarget) return;
          setIsRevoking(true);
          try {
            if (onRevokeBridge) {
              await onRevokeBridge(revokeTarget.key);
            } else {
              await helpDeskService.revokeSdkBridge(enterpriseBlindId, revokeTarget.key);
            }
            void loadData();
          } finally {
            setIsRevoking(false);
            setRevokeTarget(null);
          }
        }}
        onCancel={() => setRevokeTarget(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    height: '85%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
    overflow: 'hidden',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
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
  scrollBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  fieldSection: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  readOnlyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  explanationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  explanationBannerText: {
    fontSize: 12.5,
    color: '#1E40AF',
    lineHeight: 18,
    flex: 1,
    fontWeight: '500',
  },
  readOnlyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  orgPickerRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  orgChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orgChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  orgChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  orgChipTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  generatedKeyBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 20,
  },
  keyBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  keyBoxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E40AF',
    textTransform: 'uppercase',
  },
  miniCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  miniCopyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    marginLeft: 4,
  },
  keyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  keyText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#0F172A',
    lineHeight: 18,
  },
  codeSnippetContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
  },
  codeSnippetText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#38BDF8',
    lineHeight: 18,
  },
  bridgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  bridgeAppName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  bridgeOrgName: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  bridgeKeyPreview: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#94A3B8',
    marginTop: 4,
  },
  revokeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
});
