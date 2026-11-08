import React, { useState, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { HelpDeskModalsContainerProps } from '../modals/HelpDeskModalsContainer';
import { SafeSecureStore } from '../../../services/storageService';
import { helpDeskService, TenantLicenseData } from '../../../services/helpDeskService';
import { i18nService } from '../../../services/i18nService';
import { AdvancedFeaturesConfig, UserAdvancedPreferences } from '../types';

export interface UseHelpDeskModalsPropsOptions {
  language: 'tr' | 'en';
  getLabel: (key: string, tr?: string | Record<string, string | number>, en?: string) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
  safeTop: number;
  adminModalHeight: number;
  navigation: any;
  setConfirmSheet: (sheet: any) => void;
  confirmSheet: any;

  // Identity & Admin
  isAdmin: boolean;
  isMasterAdmin: boolean;
  isFounder: boolean;
  adminRole: 'founder' | 'global_admin' | 'admin' | 'none';
  ownWhiteId: string;
  customAlias: string | null;
  setCustomAlias: (alias: string | null) => void;
  activeEnterpriseBlindId: string;
  currentEnterpriseName: string;
  formatWhiteId: (id: string | null | undefined) => string;
  formatAppId: (id?: string | null) => string;

  // Guides & Navigation Menu
  adminGuideVisible: boolean;
  setAdminGuideVisible: (val: boolean) => void;
  userGuideVisible: boolean;
  setUserGuideVisible: (val: boolean) => void;
  securityPrivacyVisible: boolean;
  setSecurityPrivacyVisible: (val: boolean) => void;
  adminMenuVisible: boolean;
  setAdminMenuVisible: (val: boolean) => void;

  // Screen Type & Console
  adminScreenType: 'provisioning' | 'license' | 'settings' | 'advanced' | null;
  setAdminScreenType: (type: 'provisioning' | 'license' | 'settings' | 'advanced' | null) => void;
  consoleVisible: boolean;
  setConsoleVisible: (val: boolean) => void;

  // Station Hook Returns
  station: any;

  // Governance Hook Returns
  governance: any;

  // Voice Hook Returns
  voice: any;

  // Attachments Hook Returns
  attachments: any;

  // Ticket State Hook Returns
  ticketState: any;

  // Additional Dialogs & Configs
  advancedFeaturesConfig: AdvancedFeaturesConfig;
  setAdvancedFeaturesConfig: (c: AdvancedFeaturesConfig) => void;
  savingAdvancedConfig: boolean;
  setSavingAdvancedConfig: (val: boolean) => void;
  userAdvancedPrefs: UserAdvancedPreferences;
  setUserAdvancedPrefs: (p: UserAdvancedPreferences) => void;
  userPrefsModalVisible: boolean;
  setUserPrefsModalVisible: (val: boolean) => void;
  approvalsModalVisible: boolean;
  setApprovalsModalVisible: (val: boolean) => void;
  pendingApprovals: any[];
  setPendingApprovals: (a: any[]) => void;
  tenantsList: any[];
  identityModalVisible: boolean;
  setIdentityModalVisible: (val: boolean) => void;
  identityInput: string;
  setIdentityInput: (val: string) => void;
  filterModalVisible: boolean;
  setFilterModalVisible: (val: boolean) => void;
  sdkIntegrationVisible: boolean;
  setSdkIntegrationVisible: (val: boolean) => void;
  harvestModalVisible?: boolean;
  setHarvestModalVisible?: (val: boolean) => void;
  auditModalVisible?: boolean;
  setAuditModalVisible?: (val: boolean) => void;
  adminRatingsVisible: boolean;
  setAdminRatingsVisible: (val: boolean) => void;
  expandedGeminiSection: any;
  setExpandedGeminiSection: (s: any) => void;
  copiedConsoleHash: string | null;
  setCopiedConsoleHash: (h: string | null) => void;
  setGeneratedOperatorHash: (h: string | null) => void;
  setGeneratedUserHash: (h: string | null) => void;
  licensePlans: any[];
  tenantStats: any;
  adminsList?: any[];
  orgsList?: any[];
  appsList?: any[];
  selectedTenantBlindId?: string;
  onSelectTenant?: (blindId: string) => void;
}

export function useHelpDeskModalsProps(options: UseHelpDeskModalsPropsOptions): HelpDeskModalsContainerProps {
  const {
    language,
    getLabel,
    t,
    safeTop,
    adminModalHeight,
    navigation,
    setConfirmSheet,
    confirmSheet,

    isAdmin,
    isMasterAdmin,
    isFounder,
    adminRole,
    ownWhiteId,
    customAlias,
    setCustomAlias,
    activeEnterpriseBlindId,
    currentEnterpriseName,
    formatWhiteId,
    formatAppId,

    adminGuideVisible,
    setAdminGuideVisible,
    userGuideVisible,
    setUserGuideVisible,
    securityPrivacyVisible,
    setSecurityPrivacyVisible,
    adminMenuVisible,
    setAdminMenuVisible,
    harvestModalVisible = false,
    setHarvestModalVisible = () => {},
    auditModalVisible = false,
    setAuditModalVisible = () => {},

    adminScreenType,
    setAdminScreenType,
    consoleVisible,
    setConsoleVisible,

    station,
    governance,
    voice,
    attachments,
    ticketState,

    advancedFeaturesConfig,
    setAdvancedFeaturesConfig,
    savingAdvancedConfig,
    setSavingAdvancedConfig,
    userAdvancedPrefs,
    setUserAdvancedPrefs,
    userPrefsModalVisible,
    setUserPrefsModalVisible,
    approvalsModalVisible,
    setApprovalsModalVisible,
    pendingApprovals,
    setPendingApprovals,
    tenantsList,
    identityModalVisible,
    setIdentityModalVisible,
    identityInput,
    setIdentityInput,
    filterModalVisible,
    setFilterModalVisible,
    sdkIntegrationVisible,
    setSdkIntegrationVisible,
    adminRatingsVisible,
    setAdminRatingsVisible,
    expandedGeminiSection,
    setExpandedGeminiSection,
    copiedConsoleHash,
    setCopiedConsoleHash,
    setGeneratedOperatorHash,
    setGeneratedUserHash,
    licensePlans,
    tenantStats,
  } = options;

  const handleSignOut = useCallback(() => {
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.sign_out_title'),
      description: getLabel('helpdesk.sign_out_desc'),
      actionText: getLabel('helpdesk.sign_out_btn'),
      actionColor: '#EF4444',
      onAction: async () => {
        await SafeSecureStore.deleteItemAsync('inwhite_is_registered');
        await SafeSecureStore.deleteItemAsync('inwhite_id');
        await SafeSecureStore.deleteItemAsync('inwhite_mnemonic');
        await SafeSecureStore.deleteItemAsync('inwhite_private_key');
        await SafeSecureStore.deleteItemAsync('inwhite_public_key');
        await SafeSecureStore.deleteItemAsync('inwhite_helpdesk_admin_role');
        await SafeSecureStore.deleteItemAsync('inwhite_helpdesk_admin_enterprise_name');
        await SafeSecureStore.deleteItemAsync('inwhite_helpdesk_admin_enterprise_blind_id');
        await SafeSecureStore.deleteItemAsync('inwhite_helpdesk_user_enterprise_name');
        await SafeSecureStore.deleteItemAsync('inwhite_helpdesk_user_org_blind_id');
        await SafeSecureStore.deleteItemAsync('inwhite_helpdesk_custom_alias');
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        navigation.replace('Register');
      },
      onCancel: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
    });
  }, [getLabel, navigation, setConfirmSheet]);

  const handleIdentitySave = useCallback(async () => {
    const trimmed = identityInput.trim();
    await helpDeskService.setCustomAlias(ownWhiteId, trimmed, isAdmin);
    setCustomAlias(trimmed || null);
    setIdentityModalVisible(false);
  }, [identityInput, ownWhiteId, isAdmin, setCustomAlias, setIdentityModalVisible]);

  const handleSaveCustomAlias = useCallback(async (alias: string) => {
    const trimmed = alias.trim();
    await helpDeskService.setCustomAlias(ownWhiteId, trimmed, isAdmin);
    setCustomAlias(trimmed || null);
  }, [ownWhiteId, isAdmin, setCustomAlias]);

  const handleReviewApproval = useCallback(async (approvalId: number, status: 'approved' | 'rejected') => {
    try {
      ticketState.setLoading(true);
      await helpDeskService.reviewApproval(approvalId, status === 'approved', ownWhiteId);
      const remaining = await helpDeskService.getPendingApprovals(
        adminRole,
        ticketState.selectedTenantBlindId !== 'all' ? ticketState.selectedTenantBlindId : undefined
      );
      setPendingApprovals(remaining);
      if (remaining.length === 0) {
        setApprovalsModalVisible(false);
      }
      await ticketState.loadData();
    } catch (err: any) {
      console.warn('Failed to review approval:', err);
    } finally {
      ticketState.setLoading(false);
    }
  }, [adminRole, ticketState, ownWhiteId, setPendingApprovals, setApprovalsModalVisible]);

  const handleApproveWithConfirm = useCallback((appr: any) => {
    const isDeleteReq = appr.type === 'delete_app' || appr.type === 'delete_org';
    if (isDeleteReq) {
      const targetName = appr.type === 'delete_app' ? formatAppId(appr.target_app_id || '') : (appr.target_org_id || '');
      setConfirmSheet({
        visible: true,
        title: getLabel('helpdesk.confirmDeleteApprovalTitle'),
        description: `"${targetName}" ${getLabel('helpdesk.confirmDeleteApprovalDesc')}`,
        actionText: getLabel('common.delete'),
        actionColor: '#EF4444',
        cancelText: getLabel('common.cancel'),
        onCancel: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
        onAction: async () => {
          setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
          await handleReviewApproval(appr.id, 'approved');
        },
      });
    } else {
      handleReviewApproval(appr.id, 'approved');
    }
  }, [formatAppId, getLabel, handleReviewApproval, setConfirmSheet]);

  const handleSaveAdvancedConfig = useCallback(async (newConfig: AdvancedFeaturesConfig) => {
    setSavingAdvancedConfig(true);
    try {
      const targetId = activeEnterpriseBlindId || 'default';
      const ok = await helpDeskService.updateAdvancedFeaturesConfig(targetId, newConfig);
      if (ok) {
        setAdvancedFeaturesConfig(newConfig);
      }
    } finally {
      setSavingAdvancedConfig(false);
    }
  }, [activeEnterpriseBlindId, setAdvancedFeaturesConfig, setSavingAdvancedConfig]);

  const handleSaveUserAdvancedPrefs = useCallback(async (newPrefs: UserAdvancedPreferences) => {
    const myId = ownWhiteId || 'default';
    const ok = await helpDeskService.updateUserAdvancedPreferences(myId, newPrefs);
    if (ok) {
      setUserAdvancedPrefs(newPrefs);
    }
  }, [ownWhiteId, setUserAdvancedPrefs]);

  const getRank = useCallback((r: 'founder' | 'global_admin' | 'admin' | 'none') => {
    if (r === 'founder') return 3;
    if (r === 'global_admin') return 2;
    if (r === 'admin') return 1;
    return 0;
  }, []);

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [workStatusModalVisible, setWorkStatusModalVisible] = useState(false);
  const [licenseModalVisible, setLicenseModalVisible] = useState(false);

  const presentGraceOrExpiredSheet = useCallback(async (lic: TenantLicenseData | null) => {
    if (!lic || licenseModalVisible) return;

    // 2. Aşama: Ek Süre Tamamen Dolduğunda (now >= graceEndsAt)
    if (lic.isGraceExpired) {
      setConfirmSheet({
        visible: true,
        title: i18nService.t('license.grace_expired_title'),
        description: i18nService.t('license.grace_expired_desc'),
        actionText: i18nService.t('license.grace_upgrade_btn'),
        actionColor: '#2563EB',
        onCancel: undefined,
        onAction: () => {
          setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
          setLicenseModalVisible(true);
        },
      });
      return;
    }

    // 1. Aşama: Ek Süre (Grace Period) Devam Ederken
    if (lic.isInGracePeriod) {
      const shouldShow = await helpDeskService.shouldShowGracePeriodWarning(lic);
      if (!shouldShow) return;

      const days = lic.gracePeriodDays || (lic.planId === 'trial' ? 3 : lic.billingCycle === 'annual' ? 15 : 5);
      setConfirmSheet({
        visible: true,
        title: i18nService.t('license.grace_active_title'),
        description: i18nService.t('license.grace_active_desc', { days }),
        cancelText: i18nService.t('license.grace_acknowledge_btn'),
        actionText: i18nService.t('license.grace_upgrade_btn'),
        actionColor: '#2563EB',
        onCancel: async () => {
          await helpDeskService.acknowledgeGraceWarning();
          setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        },
        onAction: () => {
          setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
          setLicenseModalVisible(true);
        },
      });
    }
  }, [licenseModalVisible, setConfirmSheet]);

  const checkTenantLicenseGraceStatus = useCallback(async () => {
    const entId = (activeEnterpriseBlindId || '').trim();
    if (!entId || entId === 'all' || entId === 'blind_thewhite_root' || entId === 'thewhite') return;

    try {
      // 1) 0ms Instant Device Vault Check
      const localLic = await helpDeskService.getTenantActiveLicense(entId, false);
      if (localLic?.isGraceExpired || localLic?.isInGracePeriod) {
        await presentGraceOrExpiredSheet(localLic);
        return;
      }

      // 2) Background D1 Sync Check
      const remoteLic = await helpDeskService.fetchAndCacheTenantLicenseFromD1(entId);
      if (remoteLic?.isGraceExpired || remoteLic?.isInGracePeriod) {
        await presentGraceOrExpiredSheet(remoteLic);
      }
    } catch (e) {
      console.warn('[useHelpDeskModalsProps] checkTenantLicenseGraceStatus error:', e);
    }
  }, [activeEnterpriseBlindId, presentGraceOrExpiredSheet]);

  useEffect(() => {
    void checkTenantLicenseGraceStatus();
  }, [checkTenantLicenseGraceStatus]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void checkTenantLicenseGraceStatus();
      }
    });
    return () => sub.remove();
  }, [checkTenantLicenseGraceStatus]);

  return {
    language,
    getLabel: (a: string, b?: any, c?: string) => {
      return getLabel(a, b, c);
    },
    t,
    safeTop,
    adminModalHeight,
    isAdmin,
    isMasterAdmin,
    isFounder,
    adminRole,
    ownWhiteId,
    customAlias,
    activeEnterpriseBlindId,
    currentEnterpriseName,
    formatWhiteId: (id: string) => formatWhiteId(id),
    formatAppId: (id?: string) => formatAppId(id),

    adminGuideVisible,
    setAdminGuideVisible,
    userGuideVisible,
    setUserGuideVisible,
    securityPrivacyVisible,
    setSecurityPrivacyVisible,

    profileModalVisible,
    setProfileModalVisible,
    onSaveCustomAlias: handleSaveCustomAlias,

    workStatusModalVisible,
    setWorkStatusModalVisible,

    licenseModalVisible,
    setLicenseModalVisible,

    adminMenuVisible,
    setAdminMenuVisible,
    harvestModalVisible: options.harvestModalVisible ?? harvestModalVisible,
    setHarvestModalVisible: options.setHarvestModalVisible ?? setHarvestModalVisible,
    auditModalVisible: options.auditModalVisible ?? auditModalVisible,
    setAuditModalVisible: options.setAuditModalVisible ?? setAuditModalVisible,
    onSignOut: handleSignOut,

    adminScreenType,
    setAdminScreenType,
    consoleVisible,
    setConsoleVisible,

    adminsList: options.adminsList || station.adminsList || [],
    orgsList: options.orgsList || station.orgsList || [],
    appsList: options.appsList || station.appsList || [],
    selectedTenantBlindId: options.selectedTenantBlindId || 'all',
    onSelectTenant: options.onSelectTenant || (() => {}),
    availableCategories: ticketState.availableCategories || [],
    onGenerateOperatorInviteHash: station.handleGenerateOperatorInviteHash,
    onRemoveAdmin: station.handleRemoveAdmin,
    onRemoveOrg: station.handleDeleteOrg,
    newOrgInput: station.newOrgInput,
    setNewOrgInput: station.setNewOrgInput,
    onCreateOrg: station.handleCreateOrg,
    onRemoveApp: station.handleDeleteApp,
    newAppInput: station.newAppInput,
    setNewAppInput: station.setNewAppInput,
    onCreateApp: station.handleCreateApp,
    onDeleteCategory: station.handleDeleteCategory,
    newCatNameInput: station.newCatNameInput,
    setNewCatNameInput: station.setNewCatNameInput,
    onCreateCategory: station.handleCreateCategory,

    tenantStats,
    licensePlans,
    licenseUpgradeHashInput: station.licenseUpgradeHashInput,
    setLicenseUpgradeHashInput: station.setLicenseUpgradeHashInput,
    onGenerateOperatorAddonFile: station.handleGenerateOperatorAddonFile,
    onGenerateCustomerAddonFile: station.handleGenerateCustomerAddonFile,
    onUpgradeLicenseWithHash: station.handleUpgradeLicenseWithHash,

    editTenantNameInput: station.editTenantNameInput,
    setEditTenantNameInput: station.setEditTenantNameInput,
    onSaveEnterpriseName: station.handleSaveEnterpriseName,
    allowNameEntry: station.allowNameEntry,
    onToggleAllowNameEntry: station.handleToggleAllowNameEntry,
    loginIssueEnabled: station.loginIssueEnabled,
    onToggleLoginIssue: station.handleToggleLoginIssue,
    tenantLogoUri: station.tenantLogoUri,
    tenantLogoAlign: station.tenantLogoAlign,
    onLongPressLogoToCrop: station.handleLongPressLogoToCrop,
    onSaveLogoAlign: station.handleSaveLogoAlign,
    onRemoveLogo: station.handleRemoveLogo,
    onPickLogo: station.handlePickLogo,
    onPickDocumentForCrop: station.handlePickDocumentForCrop,
    tenantCustomFields: station.tenantCustomFields || [],
    onRemoveCustomField: station.handleRemoveCustomField,
    newCustomFieldName: station.newCustomFieldName,
    setNewCustomFieldName: station.setNewCustomFieldName,
    onAddCustomField: station.handleAddCustomField,
    onAddChip: station.handleAddChip,

    advancedFeaturesConfig,
    onSaveAdvancedConfig: handleSaveAdvancedConfig,
    savingAdvancedConfig,

    selectedAdminId: station.selectedAdminId,
    setSelectedAdminId: (id: string | null) => station.setSelectedAdminId(id || ''),
    selectedCatIds: station.selectedCatIds,
    onToggleCategory: station.handleToggleCategory,
    currentAppCategories: station.modalAppCategories || [],
    onSaveAllocationSubmit: station.handleSaveAllocationSubmit,
    expandedGeminiSection,
    setExpandedGeminiSection,
    copiedConsoleHash,
    setCopiedConsoleHash,
    setGeneratedOperatorHash,
    setGeneratedUserHash,

    addOrgModalVisible: station.addOrgModalVisible,
    setAddOrgModalVisible: station.setAddOrgModalVisible,
    newOrgIdInput: station.newOrgIdInput,
    setNewOrgIdInput: station.setNewOrgIdInput,
    newOrgNameInput: station.newOrgNameInput,
    setNewOrgNameInput: station.setNewOrgNameInput,
    onAddCustomOrgSubmit: station.handleAddCustomOrgSubmit,

    appRegModalVisible: station.appRegModalVisible,
    setAppRegModalVisible: station.setAppRegModalVisible,
    appRegStatus: station.appRegStatus,
    appRegNameInput: station.appRegNameInput,
    setAppRegNameInput: station.setAppRegNameInput,
    appRegDescInput: station.appRegDescInput,
    setAppRegDescInput: station.setAppRegDescInput,
    onSubmitAppRegistration: station.handleSubmitAppRegistration,

    addAdminModalVisible: station.addAdminModalVisible,
    setAddAdminModalVisible: station.setAddAdminModalVisible,
    assigningTicket: governance.assigningTicket,
    setAssigningTicket: governance.setAssigningTicket,
    assignAppId: station.assignAppId,
    setAssignAppId: station.setAssignAppId,
    assignCatId: station.assignCatId,
    setAssignCatId: station.setAssignCatId,
    modalAppCategories: station.modalAppCategories || [],
    newAdminIdInput: station.newAdminIdInput,
    setNewAdminIdInput: station.setNewAdminIdInput,
    newAdminAliasInput: station.newAdminAliasInput,
    setNewAdminAliasInput: station.setNewAdminAliasInput,
    onSuggestNextCount: station.handleSuggestNextCount,
    onSuggestCyclePrefix: station.handleSuggestCyclePrefix,
    onAddCustomAdminSubmit: station.handleAddCustomAdminSubmit,

    addAppModalVisible: station.addAppModalVisible,
    setAddAppModalVisible: station.setAddAppModalVisible,
    onAddCustomAppSubmit: station.handleAddCustomAppSubmit,

    addCatModalVisible: station.addCatModalVisible,
    setAddCatModalVisible: station.setAddCatModalVisible,
    selectedAppId: station.selectedAppId,
    newCatIdInput: station.newCatIdInput,
    setNewCatIdInput: station.setNewCatIdInput,
    newCatTrInput: station.newCatTrInput,
    setNewCatTrInput: station.setNewCatTrInput,
    newCatEnInput: station.newCatEnInput,
    setNewCatEnInput: station.setNewCatEnInput,
    onAddCustomCategorySubmit: station.handleAddCustomCategorySubmit,

    identityModalVisible,
    setIdentityModalVisible,
    identityInput,
    setIdentityInput,
    onIdentitySave: handleIdentitySave,

    filterModalVisible,
    setFilterModalVisible,
    filterTenantBlindId: ticketState.filterTenantBlindId,
    setFilterTenantBlindId: ticketState.setFilterTenantBlindId,
    filterOrgId: ticketState.filterOrgId,
    setFilterOrgId: ticketState.setFilterOrgId,
    filterAppId: ticketState.filterAppId,
    setFilterAppId: ticketState.setFilterAppId,
    filterCategoryId: ticketState.filterCategoryId,
    setFilterCategoryId: ticketState.setFilterCategoryId,
    onResetHierarchyFilters: ticketState.handleResetHierarchyFilters,
    filteredTicketsCount: (ticketState.filteredTickets || []).length,
    totalTicketsCount: (ticketState.tickets || []).length,
    tenantsList,

    userPrefsModalVisible,
    setUserPrefsModalVisible,
    userAdvancedPrefs,
    onSaveUserAdvancedPrefs: handleSaveUserAdvancedPrefs,

    approvalsModalVisible,
    setApprovalsModalVisible,
    pendingApprovals,
    onReviewApproval: handleReviewApproval,
    onApproveWithConfirm: handleApproveWithConfirm,

    ticketActionModalVisible: governance.ticketActionModalVisible,
    setTicketActionModalVisible: governance.setTicketActionModalVisible,
    targetActionTicket: governance.targetActionTicket,
    targetActionMessages: governance.targetActionMessages,
    targetActionRole: (governance.targetActionRole as any) || 'none',
    ticketMenuAnchorY: governance.ticketMenuAnchorY,
    getRank,
    onDeleteSingleTicket: governance.handleDeleteSingleTicket,
    onRevokeUserAdmin: governance.handleRevokeUserAdmin,
    onPromoteTicketUserToAdmin: governance.handlePromoteTicketUserToAdmin,
    onPromoteTicketUserToCosmos: governance.handlePromoteTicketUserToCosmos,
    onBlockTicketUser: governance.handleBlockTicketUser,
    onDeleteTicketAndUser: governance.handleDeleteTicketAndUser,
    onStartSelfDestruct: (ticket?: any) => {
      const t = ticket || governance.targetActionTicket || ticketState.selectedTicket;
      if (t) governance.handleStartSelfDestruct(t);
    },
    onCancelSelfDestruct: (ticket?: any) => {
      const t = ticket || governance.targetActionTicket || ticketState.selectedTicket;
      if (t) governance.handleCancelSelfDestruct(t);
    },
    onOpenRating: () => {
      ticketState.handleOpenRating(governance.targetActionTicket || ticketState.selectedTicket);
    },
    onOpenOrgAssign: governance.handleOpenTicketOrgAssign,
    onStartTransfer: ticketState.handleStartTransfer,
    onCancelTransfer: ticketState.handleCancelTransfer,
    onTakeOverTicket: ticketState.handleTakeOverTicket,

    ticketOrgAssignModalVisible: governance.ticketOrgAssignModalVisible,
    setTicketOrgAssignModalVisible: governance.setTicketOrgAssignModalVisible,
    selectedTicket: ticketState.selectedTicket,
    onSaveTicketOrgAssign: governance.handleSaveTicketOrgAssign,

    cropModalVisible: station.cropModalVisible,
    setCropModalVisible: station.setCropModalVisible,
    cropSourceImageUri: station.cropSourceImageUri,
    setCropSourceImageUri: station.setCropSourceImageUri,
    onConfirmCrop: station.handleConfirmCrop,

    attachMenuVisible: attachments.attachMenuVisible,
    setAttachMenuVisible: attachments.setAttachMenuVisible,
    onPickCamera: attachments.handlePickCamera,
    onPickGallery: attachments.handlePickGallery,
    onPickDocument: attachments.handlePickDocument,

    previewImageUri: attachments.previewImageUri,
    setPreviewImageUri: attachments.setPreviewImageUri,
    previewFileName: attachments.previewFileName,
    setPreviewFileName: attachments.setPreviewFileName,

    confirmSheet: {
      ...confirmSheet,
      actionColor: confirmSheet.actionColor || '#3B82F6',
    },
    setConfirmSheet,

    sdkIntegrationVisible,
    setSdkIntegrationVisible,
    adminRatingsVisible,
    setAdminRatingsVisible,
    onReloadConsoleData: async () => {
      await ticketState.loadData({
        overrideTenantId: activeEnterpriseBlindId || undefined,
        overrideTenantName: currentEnterpriseName || undefined,
      });
    },

    feedbackDialogVisible: ticketState.feedbackDialogVisible,
    onFeedbackClose: ticketState.handleFeedbackClose,
    onFeedbackSubmit: ticketState.handleFeedbackSubmit,

    diagnosticModalVisible: ticketState.diagnosticModalVisible,
    setDiagnosticModalVisible: ticketState.setDiagnosticModalVisible,
    diagnosticData: ticketState.selectedDiagnosticData,
    targetDiagnosticTicket: ticketState.targetDiagnosticTicket,
    onInspectDiagnostics: ticketState.handleInspectDiagnostics,
    onAttachDiagnostics: ticketState.handleAttachDiagnostics,
    onDeleteDiagnostics: ticketState.handleDeleteDiagnostics,

    callSession: voice.callSession,
    myAdminOrgId: voice.myAdminOrgId || null,
    currentChannelMemberCount: voice.currentChannelMemberCount,
    pttTenantId: voice.pttTenantId || null,
    pttTenantName: voice.pttTenantName || null,
    availableOrgChannels: voice.availableOrgChannels || [],
    activeOrgChannelId: voice.activeOrgChannelId,
    onChangePttTenant: (tenant: any) => voice.handleChangePttTenant(tenant.id, tenant.name),
    onChangeOrgChannel: voice.handleChangeOrgChannel,
    onBroadcastChannelInvite: () => {
      void voice.handleBroadcastChannelInvite(voice.activeOrgChannelId);
    },
  };
}
