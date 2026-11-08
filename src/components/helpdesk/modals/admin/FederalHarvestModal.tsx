import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Database,
  X,
  Check,
  Folder,
  Layers,
  Building,
  Briefcase,
  Users,
  HardDrive,
  Share2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import { federalHarvestService } from '../../../../services/harvest/federalHarvestService';
import { FDHScope } from '../../../../services/harvest/types';
import { useTranslation } from '../../../../services/i18nService';

export interface FederalHarvestModalProps {
  visible: boolean;
  onClose: () => void;
  isAdmin: boolean;
  isMasterAdmin: boolean;
  isFounder: boolean;
  adminRole: string;
  ownWhiteId: string;
  currentEnterpriseName: string;
  activeEnterpriseBlindId: string;
  tenantsList: any[];
  orgsList: any[];
  appsList: any[];
  language: string;
  onOpenAuditModal?: () => void;
}

export const FederalHarvestModal: React.FC<FederalHarvestModalProps> = ({
  visible,
  onClose,
  isAdmin,
  isMasterAdmin,
  isFounder,
  adminRole,
  ownWhiteId,
  currentEnterpriseName,
  activeEnterpriseBlindId,
  tenantsList,
  orgsList,
  appsList,
  language,
  onOpenAuditModal,
}) => {
  const { t } = useTranslation();
  // Storage Path
  const [storagePath, setStoragePath] = useState('');

  // Target Roles (Checkboxes)
  const [targetAdmins, setTargetAdmins] = useState(true);
  const [targetUsers, setTargetUsers] = useState(true);

  // Tenant selection (Founder can pick among existing test/root tenants)
  const [selectedTenantBlindId, setSelectedTenantBlindId] = useState(activeEnterpriseBlindId || 'all');
  const [selectedOrgId, setSelectedOrgId] = useState('all');
  const [selectedAppId, setSelectedAppId] = useState('all');

  // UI state
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [harvestResult, setHarvestResult] = useState<{
    totalTickets: number;
    totalMessages: number;
    totalAttachments: number;
    totalBytes: number;
    targetDir: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize storage path & active tenant on open
  useEffect(() => {
    if (visible) {
      setStoragePath(federalHarvestService.getDefaultStoragePath());
      setSelectedTenantBlindId(activeEnterpriseBlindId || (tenantsList[0]?.enterprise_blind_id || 'all'));
      setSelectedOrgId('all');
      setSelectedAppId('all');
      setIsHarvesting(false);
      setProgressStage('');
      setProgressPercent(0);
      setHarvestResult(null);
      setErrorMessage(null);
    }
  }, [visible, activeEnterpriseBlindId, tenantsList]);

  // Resolve active tenant name
  const effectiveTenantName = (() => {
    if (selectedTenantBlindId === 'all') return t('fdh.harvest.all_enterprises');
    const found = tenantsList.find(tenant => tenant.enterprise_blind_id === selectedTenantBlindId);
    return found?.name || currentEnterpriseName || t('fdh.harvest.default_org');
  })();

  const handleStartHarvest = async () => {
    if (!targetAdmins && !targetUsers) {
      Alert.alert(t('fdh.harvest.missing_selection_title'), t('fdh.harvest.missing_selection_desc'));
      return;
    }
    if (!storagePath.trim()) {
      Alert.alert(t('fdh.harvest.invalid_path_title'), t('fdh.harvest.invalid_path_desc'));
      return;
    }

    setIsHarvesting(true);
    setErrorMessage(null);
    setHarvestResult(null);
    setProgressStage(t('fdh.harvest.stage_starting'));
    setProgressPercent(5);

    const roles: ('admin' | 'user')[] = [];
    if (targetAdmins) roles.push('admin');
    if (targetUsers) roles.push('user');

    const scope: FDHScope = {
      targetRoles: roles,
      tenantBlindId: selectedTenantBlindId,
      tenantName: effectiveTenantName,
      organizationId: selectedOrgId === 'all' ? null : selectedOrgId,
      applicationId: selectedAppId === 'all' ? null : selectedAppId,
    };

    const jobId = `fdh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Broadcast directive to remote fleet
    void federalHarvestService.broadcastHarvestDirective(
      jobId,
      scope,
      ownWhiteId,
      adminRole || 'admin'
    );

    // Execute local harvest
    const res = await federalHarvestService.executeLocalHarvest(
      jobId,
      scope,
      storagePath.trim(),
      ownWhiteId,
      adminRole || 'admin',
      (prog) => {
        setProgressStage(prog.stage);
        if (prog.total > 0) {
          setProgressPercent(Math.min(95, Math.round((prog.current / prog.total) * 100)));
        }
      }
    );

    setIsHarvesting(false);
    if (res.success) {
      setProgressPercent(100);
      setProgressStage(t('fdh.harvest.stage_completed'));
      setHarvestResult({
        totalTickets: res.totalTickets,
        totalMessages: res.totalMessages,
        totalAttachments: res.totalAttachments,
        totalBytes: res.totalBytes,
        targetDir: res.targetDir,
      });
    } else {
      setErrorMessage(res.error || t('fdh.harvest.error_default'));
    }
  };

  const handleShareManifest = async () => {
    if (!harvestResult) return;
    try {
      const manifestFile = `${harvestResult.targetDir}/manifest.json`;
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(manifestFile, {
          mimeType: 'application/json',
          dialogTitle: t('fdh.harvest.manifest_dialog_title'),
        });
      } else {
        Alert.alert(t('common.info'), t('fdh.harvest.saved_to_dir', { dir: harvestResult.targetDir }));
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), t('fdh.harvest.share_error', { error: e.message }));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={() => {
            if (!isHarvesting) onClose();
          }}
        />

        <View style={styles.cardContainer}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.iconCircle}>
                <Database size={18} color="#2563EB" strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.headerTitle}>
                  {t('fdh.harvest.title')}
                </Text>
                <Text style={styles.headerSub}>
                  {t('fdh.harvest.subtitle')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isHarvesting}
              style={styles.closeBtn}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* 1. DEPOLAMA YOLU */}
            <View style={styles.fieldSection}>
              <View style={styles.fieldLabelRow}>
                <Folder size={14} color="#475569" style={{ marginRight: 6 }} />
                <Text style={styles.fieldLabel}>{t('fdh.harvest.storage_path_label')}</Text>
              </View>
              <TextInput
                style={styles.pathInput}
                value={storagePath}
                onChangeText={setStoragePath}
                placeholder={t('fdh.harvest.storage_path_placeholder')}
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                editable={!isHarvesting}
              />
              <Text style={styles.fieldHint}>
                {t('fdh.harvest.storage_path_hint')}
              </Text>
            </View>

            {/* 2. HASAT HEDEFİ */}
            <View style={styles.fieldSection}>
              <View style={styles.fieldLabelRow}>
                <Users size={14} color="#475569" style={{ marginRight: 6 }} />
                <Text style={styles.fieldLabel}>
                  {t('fdh.harvest.target_label')}
                </Text>
              </View>
              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  style={[styles.checkboxCard, targetAdmins && styles.checkboxCardActive]}
                  onPress={() => !isHarvesting && setTargetAdmins(!targetAdmins)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkboxIndicator, targetAdmins && styles.checkboxIndicatorActive]}>
                    {targetAdmins && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text style={[styles.checkboxText, targetAdmins && styles.checkboxTextActive]}>
                    {t('fdh.harvest.target_admins')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.checkboxCard, targetUsers && styles.checkboxCardActive]}
                  onPress={() => !isHarvesting && setTargetUsers(!targetUsers)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkboxIndicator, targetUsers && styles.checkboxIndicatorActive]}>
                    {targetUsers && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text style={[styles.checkboxText, targetUsers && styles.checkboxTextActive]}>
                    {t('fdh.harvest.target_users')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. FİRMA SEÇİMİ */}
            <View style={styles.fieldSection}>
              <View style={styles.fieldLabelRow}>
                <Building size={14} color="#475569" style={{ marginRight: 6 }} />
                <Text style={styles.fieldLabel}>{t('fdh.harvest.enterprise_label')}</Text>
              </View>
              {isFounder ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                  <TouchableOpacity
                    style={[styles.pill, selectedTenantBlindId === 'all' && styles.pillActive]}
                    onPress={() => !isHarvesting && setSelectedTenantBlindId('all')}
                  >
                    <Text style={[styles.pillText, selectedTenantBlindId === 'all' && styles.pillTextActive]}>
                      {t('fdh.harvest.all_enterprises')}
                    </Text>
                  </TouchableOpacity>
                  {tenantsList.map(tenant => {
                    const isSel = selectedTenantBlindId === tenant.enterprise_blind_id;
                    return (
                      <TouchableOpacity
                        key={tenant.enterprise_blind_id}
                        style={[styles.pill, isSel && styles.pillActive]}
                        onPress={() => !isHarvesting && setSelectedTenantBlindId(tenant.enterprise_blind_id)}
                      >
                        <Text style={[styles.pillText, isSel && styles.pillTextActive]}>{tenant.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.lockedTenantRow}>
                  <Text style={styles.lockedTenantText}>
                    {effectiveTenantName}
                  </Text>
                </View>
              )}
            </View>

            {/* 4. BİRİM SEÇİMİ */}
            <View style={styles.fieldSection}>
              <View style={styles.fieldLabelRow}>
                <Briefcase size={14} color="#475569" style={{ marginRight: 6 }} />
                <Text style={styles.fieldLabel}>{t('fdh.harvest.org_label')}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                <TouchableOpacity
                  style={[styles.pill, selectedOrgId === 'all' && styles.pillActive]}
                  onPress={() => !isHarvesting && setSelectedOrgId('all')}
                >
                  <Text style={[styles.pillText, selectedOrgId === 'all' && styles.pillTextActive]}>
                    {t('fdh.harvest.all_orgs')}
                  </Text>
                </TouchableOpacity>
                {orgsList.map((org: any) => {
                  const orgKey = org.org_id || org.id;
                  const isSel = selectedOrgId === orgKey;
                  return (
                    <TouchableOpacity
                      key={orgKey}
                      style={[styles.pill, isSel && styles.pillActive]}
                      onPress={() => !isHarvesting && setSelectedOrgId(orgKey)}
                    >
                      <Text style={[styles.pillText, isSel && styles.pillTextActive]}>{org.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 5. UYGULAMA SEÇİMİ */}
            <View style={styles.fieldSection}>
              <View style={styles.fieldLabelRow}>
                <Layers size={14} color="#475569" style={{ marginRight: 6 }} />
                <Text style={styles.fieldLabel}>{t('fdh.harvest.app_label')}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                <TouchableOpacity
                  style={[styles.pill, selectedAppId === 'all' && styles.pillActive]}
                  onPress={() => !isHarvesting && setSelectedAppId('all')}
                >
                  <Text style={[styles.pillText, selectedAppId === 'all' && styles.pillTextActive]}>
                    {t('fdh.harvest.all_apps')}
                  </Text>
                </TouchableOpacity>
                {appsList.map((app: any) => {
                  const appKey = app.app_id || app.id;
                  const isSel = selectedAppId === appKey;
                  return (
                    <TouchableOpacity
                      key={appKey}
                      style={[styles.pill, isSel && styles.pillActive]}
                      onPress={() => !isHarvesting && setSelectedAppId(appKey)}
                    >
                      <Text style={[styles.pillText, isSel && styles.pillTextActive]}>{app.name || appKey}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 6. VERİTABANI MOTORU BİLGİSİ */}
            <View style={styles.engineCard}>
              <HardDrive size={16} color="#475569" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.engineTitle}>{t('fdh.harvest.engine_title')}</Text>
                <Text style={styles.engineSub}>
                  {t('fdh.harvest.engine_subtitle')}
                </Text>
              </View>
            </View>

            {/* PROGRESS & RESULTS */}
            {isHarvesting && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="small" color="#2563EB" style={{ marginBottom: 8 }} />
                <Text style={styles.progressText}>{progressStage}</Text>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                </View>
              </View>
            )}

            {harvestResult && (
              <View style={styles.resultCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <CheckCircle2 size={18} color="#16A34A" style={{ marginRight: 6 }} />
                  <Text style={styles.resultTitle}>{t('fdh.harvest.result_success_title')}</Text>
                </View>
                <View style={styles.statGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{harvestResult.totalTickets}</Text>
                    <Text style={styles.statLbl}>{t('fdh.harvest.stat_tickets')}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{harvestResult.totalMessages}</Text>
                    <Text style={styles.statLbl}>{t('fdh.harvest.stat_messages')}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{harvestResult.totalAttachments}</Text>
                    <Text style={styles.statLbl}>{t('fdh.harvest.stat_attachments')}</Text>
                  </View>
                </View>
                <Text style={styles.resultPath} numberOfLines={2}>
                  {harvestResult.targetDir}
                </Text>
              </View>
            )}

            {errorMessage && (
              <View style={styles.errorCard}>
                <AlertCircle size={16} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}
          </ScrollView>

          {/* ACTIONS FOOTER */}
          <View style={styles.footer}>
            {harvestResult ? (
              <View style={styles.footerBtnCol}>
                {onOpenAuditModal && (
                  <TouchableOpacity
                    style={styles.inspectBtn}
                    onPress={() => {
                      onClose();
                      onOpenAuditModal();
                    }}
                    activeOpacity={0.8}
                  >
                    <Database size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.inspectBtnText}>{t('fdh.harvest.btn_open_audit')}</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.footerBtnRow}>
                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={handleShareManifest}
                    activeOpacity={0.7}
                  >
                    <Share2 size={15} color="#475569" style={{ marginRight: 6 }} />
                    <Text style={styles.shareBtnText}>{t('fdh.harvest.btn_share_manifest')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={onClose}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.confirmBtnText}>{t('common.close')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.footerBtnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={isHarvesting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, isHarvesting && { opacity: 0.6 }]}
                  onPress={handleStartHarvest}
                  disabled={isHarvesting}
                  activeOpacity={0.7}
                >
                  <Database size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.confirmBtnText}>
                    {isHarvesting ? t('fdh.harvest.btn_harvesting') : t('fdh.harvest.btn_start_harvest')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '88%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  fieldSection: {
    marginBottom: 16,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  pathInput: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    color: '#0F172A',
    fontFamily: 'monospace',
  },
  fieldHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    gap: 10,
  },
  checkboxCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  checkboxCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  checkboxIndicator: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#FFFFFF',
  },
  checkboxIndicatorActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  checkboxTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  pillsScroll: {
    flexDirection: 'row',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    marginRight: 8,
  },
  pillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  pillTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  lockedTenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  lockedTenantText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  lockedBadge: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  engineCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  engineTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },
  engineSub: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
    lineHeight: 15,
  },
  progressContainer: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 10,
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
  resultCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  statGrid: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#DCFCE7',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#166534',
  },
  statLbl: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  resultPath: {
    fontSize: 10.5,
    fontFamily: 'monospace',
    color: '#475569',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#B91C1C',
    flex: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  footerBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  footerBtnCol: {
    gap: 10,
  },
  inspectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  inspectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  confirmBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1,
  },
  shareBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
});
