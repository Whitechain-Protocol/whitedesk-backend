import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Radio, X } from 'lucide-react-native';

// Modals
import {
  AdminGuideModal,
  UserGuideModal,
  SecurityPrivacyModal,
  AdminNavigationMenuModal,
  AddOrgModal,
  AppRegistrationModal,
  AddAdminModal,
  AddAppModal,
  AddCategoryModal,
  IdentityModal,
  ProfileModal,
  WorkStatusModal,
  LicenseModal,
  TicketFilterModal,
  UserPreferencesModal,
  TicketOrgAssignModal,
  AttachMenuModal,
  ApprovalsModal,
  ImagePreviewModal,
} from './';

import { TicketActionModal } from './TicketActionModal';
import { DiagnosticViewerModal } from './DiagnosticViewerModal';
import { RemoteDesktopModal } from './RemoteDesktopModal';
import { remoteDesktopService, RemoteDesktopSession } from '../../../services/remoteDesktopService';
import { FederalHarvestModal } from './admin/FederalHarvestModal';
import { FDHAuditModal } from './admin/FDHAuditModal';

// Stations
import {
  ProvisioningStationModal,
  LicenseStationModal,
  SettingsStationModal,
  AdvancedStationModal,
  ManagementConsoleModal,
} from '../station';

// Specialized Root Modals
import { BottomConfirmationSheet } from '../../BottomConfirmationSheet';
import { ImageCropModal } from '../../ImageCropModal';
import { SdkIntegrationModal } from '../../SdkIntegrationModal';
import { AdminRatingsOverviewModal } from '../../AdminRatingsOverviewModal';
import { TicketFeedbackDialog } from '../../TicketFeedbackDialog';
import { CallScreenModal, PttScreenModal } from '../call';

// Types & Services
import {
  HelpDeskTicket,
  HelpDeskCategory,
  AdminEntry,
  OrgEntry,
  AppCatEntry,
  TenantEntry,
  ApprovalEntry,
  CURRENT_APP_ID,
  helpDeskService,
} from '../../../services/helpDeskService';
import {
  CustomFieldDef,
  AdvancedFeaturesConfig,
  UserAdvancedPreferences,
} from '../types';
import { GeminiSection } from '../station/ManagementConsoleModal';
import { VoiceCallSession, voiceCallService } from '../../../services/voiceCallService';

export interface HelpDeskModalsContainerProps {
  language: 'tr' | 'en';
  getLabel: (a: string, b?: string, c?: string) => string;
  t: (key: string) => string;
  safeTop: number;
  adminModalHeight: number;
  isAdmin: boolean;
  isMasterAdmin: boolean;
  isFounder: boolean;
  adminRole: 'founder' | 'global_admin' | 'admin' | 'none';
  ownWhiteId: string;
  customAlias: string | null;
  activeEnterpriseBlindId: string;
  currentEnterpriseName: string;
  formatWhiteId: (id: string) => string;
  formatAppId: (id?: string) => string;

  // Guides & Privacy
  adminGuideVisible: boolean;
  setAdminGuideVisible: (val: boolean) => void;
  userGuideVisible: boolean;
  setUserGuideVisible: (val: boolean) => void;
  securityPrivacyVisible: boolean;
  setSecurityPrivacyVisible: (val: boolean) => void;

  // Profile Modal
  profileModalVisible: boolean;
  setProfileModalVisible: (val: boolean) => void;
  onSaveCustomAlias?: (alias: string) => void | Promise<void>;

  // Work Status Modal
  workStatusModalVisible?: boolean;
  setWorkStatusModalVisible?: (val: boolean) => void;

  // License Modal
  licenseModalVisible?: boolean;
  setLicenseModalVisible?: (val: boolean) => void;

  // Admin Navigation Menu
  adminMenuVisible: boolean;
  setAdminMenuVisible: (val: boolean) => void;
  harvestModalVisible?: boolean;
  setHarvestModalVisible?: (val: boolean) => void;
  auditModalVisible?: boolean;
  setAuditModalVisible?: (val: boolean) => void;
  onSignOut: () => void;

  // Station Modals
  adminScreenType: 'provisioning' | 'license' | 'settings' | 'advanced' | null;
  setAdminScreenType: (type: 'provisioning' | 'license' | 'settings' | 'advanced' | null) => void;
  consoleVisible: boolean;
  setConsoleVisible: (val: boolean) => void;

  // Provisioning Station props
  adminsList: AdminEntry[];
  orgsList: OrgEntry[];
  appsList: AppCatEntry[];
  availableCategories: { id: string; labelTr: string; labelEn: string; icon?: string }[];
  onGenerateOperatorInviteHash: () => void;
  onRemoveAdmin: (adminId: string) => void;
  onRemoveOrg: (orgId: string) => void;
  newOrgInput: string;
  setNewOrgInput: (val: string) => void;
  onCreateOrg: () => void;
  onRemoveApp: (appId: string) => void;
  newAppInput: string;
  setNewAppInput: (val: string) => void;
  onCreateApp: () => void;
  onDeleteCategory: (catId: string) => void;
  newCatNameInput: string;
  setNewCatNameInput: (val: string) => void;
  onCreateCategory: () => void;
  selectedTenantBlindId?: string;
  onSelectTenant?: (blindId: string) => void;

  // Licensing Station props
  tenantStats: any;
  licensePlans: any[];
  licenseUpgradeHashInput: string;
  setLicenseUpgradeHashInput: (val: string) => void;
  onGenerateOperatorAddonFile: () => void;
  onGenerateCustomerAddonFile: () => void;
  onUpgradeLicenseWithHash: () => void;

  // Settings Station props
  allowNameEntry?: boolean;
  onToggleAllowNameEntry?: (val: boolean) => void;
  loginIssueEnabled?: boolean;
  onToggleLoginIssue?: (val: boolean) => void;
  editTenantNameInput: string;
  setEditTenantNameInput: (val: string) => void;
  onSaveEnterpriseName: () => void;
  tenantLogoUri: string | null;
  tenantLogoAlign: 'left' | 'center' | 'right';
  onLongPressLogoToCrop: () => void;
  onSaveLogoAlign: (align: 'left' | 'center' | 'right') => void;
  onRemoveLogo: () => void;
  onPickLogo: () => void;
  onPickDocumentForCrop: () => void;
  tenantCustomFields: CustomFieldDef[];
  onRemoveCustomField: (fieldKey: string) => void;
  newCustomFieldName: string;
  setNewCustomFieldName: (val: string) => void;
  onAddCustomField: () => void;
  onAddChip: (chip: string) => void;

  // Advanced Station props
  advancedFeaturesConfig: AdvancedFeaturesConfig;
  onSaveAdvancedConfig: (config: AdvancedFeaturesConfig) => Promise<void>;
  savingAdvancedConfig: boolean;

  // Management Console props
  selectedAdminId: string | null;
  setSelectedAdminId: (id: string | null) => void;
  selectedCatIds: string[];
  onToggleCategory: (catId: string) => void;
  currentAppCategories: any[];
  onSaveAllocationSubmit: () => void;
  expandedGeminiSection: GeminiSection | null;
  setExpandedGeminiSection: React.Dispatch<React.SetStateAction<GeminiSection | null>>;
  copiedConsoleHash: string | null;
  setCopiedConsoleHash: (hash: string | null) => void;
  setGeneratedOperatorHash: (hash: string | null) => void;
  setGeneratedUserHash: (hash: string | null) => void;

  // Sub-Modals
  addOrgModalVisible: boolean;
  setAddOrgModalVisible: (val: boolean) => void;
  newOrgIdInput: string;
  setNewOrgIdInput: (val: string) => void;
  newOrgNameInput: string;
  setNewOrgNameInput: (val: string) => void;
  onAddCustomOrgSubmit: () => void;

  appRegModalVisible: boolean;
  setAppRegModalVisible: (val: boolean) => void;
  appRegStatus: any;
  appRegNameInput: string;
  setAppRegNameInput: (val: string) => void;
  appRegDescInput: string;
  setAppRegDescInput: (val: string) => void;
  onSubmitAppRegistration: () => void;

  addAdminModalVisible: boolean;
  setAddAdminModalVisible: (val: boolean) => void;
  assigningTicket: HelpDeskTicket | null;
  setAssigningTicket: (t: HelpDeskTicket | null) => void;
  assignAppId: string;
  setAssignAppId: (val: string) => void;
  assignCatId: string;
  setAssignCatId: (val: string) => void;
  modalAppCategories: any[];
  newAdminIdInput: string;
  setNewAdminIdInput: (val: string) => void;
  newAdminAliasInput: string;
  setNewAdminAliasInput: (val: string) => void;
  onSuggestNextCount: () => void;
  onSuggestCyclePrefix: () => void;
  onAddCustomAdminSubmit: () => void;

  addAppModalVisible: boolean;
  setAddAppModalVisible: (val: boolean) => void;
  onAddCustomAppSubmit: () => void;

  addCatModalVisible: boolean;
  setAddCatModalVisible: (val: boolean) => void;
  selectedAppId: string;
  newCatIdInput: string;
  setNewCatIdInput: (val: string) => void;
  newCatTrInput: string;
  setNewCatTrInput: (val: string) => void;
  newCatEnInput: string;
  setNewCatEnInput: (val: string) => void;
  onAddCustomCategorySubmit: () => void;

  identityModalVisible: boolean;
  setIdentityModalVisible: (val: boolean) => void;
  identityInput: string;
  setIdentityInput: (val: string) => void;
  onIdentitySave: () => void;

  // Tickets & Filter Modals
  filterModalVisible: boolean;
  setFilterModalVisible: (val: boolean) => void;
  filterTenantBlindId: string;
  setFilterTenantBlindId: (id: string) => void;
  filterOrgId: string;
  setFilterOrgId: (id: string) => void;
  filterAppId: string;
  setFilterAppId: (id: string) => void;
  filterCategoryId: string;
  setFilterCategoryId: (id: string) => void;
  onResetHierarchyFilters: () => void;
  filteredTicketsCount: number;
  totalTicketsCount: number;
  tenantsList: TenantEntry[];

  userPrefsModalVisible: boolean;
  setUserPrefsModalVisible: (val: boolean) => void;
  userAdvancedPrefs: UserAdvancedPreferences;
  onSaveUserAdvancedPrefs: (prefs: UserAdvancedPreferences) => Promise<void>;

  approvalsModalVisible: boolean;
  setApprovalsModalVisible: (val: boolean) => void;
  pendingApprovals: ApprovalEntry[];
  onReviewApproval: (id: number, decision: 'approved' | 'rejected') => void;
  onApproveWithConfirm: (item: ApprovalEntry) => void;

  ticketActionModalVisible: boolean;
  setTicketActionModalVisible: (val: boolean) => void;
  targetActionTicket: HelpDeskTicket | null;
  targetActionMessages?: any[] | null;
  targetActionRole: 'founder' | 'global_admin' | 'admin' | 'none';
  ticketMenuAnchorY?: number | null;
  getRank: (role: any) => number;
  onDeleteSingleTicket: () => void;
  onRevokeUserAdmin: () => void;
  onPromoteTicketUserToAdmin: () => void;
  onPromoteTicketUserToCosmos: () => void;
  onBlockTicketUser: () => void;
  onDeleteTicketAndUser: () => void;
  onStartSelfDestruct: (ticket?: any) => void;
  onCancelSelfDestruct: (ticket?: any) => void;
  onOpenRating: () => void;
  onOpenOrgAssign: (ticket?: any) => void;
  onStartTransfer?: (ticket?: any) => void;
  onCancelTransfer?: (ticket?: any) => void;
  onTakeOverTicket?: (ticket: HelpDeskTicket) => void;

  ticketOrgAssignModalVisible: boolean;
  setTicketOrgAssignModalVisible: (val: boolean) => void;
  selectedTicket: HelpDeskTicket | null;
  onSaveTicketOrgAssign: (orgId: string, appId: string) => Promise<void>;
  diagnosticModalVisible?: boolean;
  setDiagnosticModalVisible?: (val: boolean) => void;
  diagnosticData?: any;
  targetDiagnosticTicket?: HelpDeskTicket | null;
  onInspectDiagnostics?: (ticket?: any) => void;
  onAttachDiagnostics?: (ticket?: any) => void;
  onDeleteDiagnostics?: (ticket?: any) => void;

  // Image Crop & Media
  cropModalVisible: boolean;
  setCropModalVisible: (val: boolean) => void;
  cropSourceImageUri: string | null;
  setCropSourceImageUri: (uri: string | null) => void;
  onConfirmCrop: (cropInfo: { x: number; y: number; width: number; height: number }) => void;

  attachMenuVisible: boolean;
  setAttachMenuVisible: (val: boolean) => void;
  onPickCamera: () => void;
  onPickGallery: () => void;
  onPickDocument: () => void;

  previewImageUri: string | null;
  setPreviewImageUri: (uri: string | null) => void;
  previewFileName: string | null;
  setPreviewFileName: (name: string | null) => void;

  // Confirm Sheet
  confirmSheet: {
    visible: boolean;
    title: string;
    description: string;
    actionText: string;
    actionColor: string;
    cancelText?: string;
    onAction: () => void;
    onCancel?: () => void;
  };
  setConfirmSheet: React.Dispatch<React.SetStateAction<any>>;

  // SDK & Ratings
  sdkIntegrationVisible: boolean;
  setSdkIntegrationVisible: (val: boolean) => void;
  adminRatingsVisible: boolean;
  setAdminRatingsVisible: (val: boolean) => void;
  onReloadConsoleData: () => Promise<void>;

  // CSAT Feedback Dialog
  feedbackDialogVisible: boolean;
  onFeedbackClose: () => void;
  onFeedbackSubmit: (score: number, comment: string) => Promise<void>;

  // Calling & PTT
  callSession: VoiceCallSession | null;
  myAdminOrgId: string | null;
  currentChannelMemberCount: number;
  pttTenantId: string | null;
  pttTenantName: string | null;
  availableOrgChannels: Array<{ id: string; name: string }>;
  activeOrgChannelId: string;
  onChangePttTenant: (tenant: any) => void;
  onChangeOrgChannel: (channelId: string) => void;
  onBroadcastChannelInvite: () => void;
}

export function HelpDeskModalsContainer(props: HelpDeskModalsContainerProps) {
  const {
    language,
    getLabel,
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
    formatWhiteId,
    formatAppId,

    adminGuideVisible,
    setAdminGuideVisible,
    userGuideVisible,
    setUserGuideVisible,
    securityPrivacyVisible,
    setSecurityPrivacyVisible,

    profileModalVisible,
    setProfileModalVisible,
    onSaveCustomAlias,

    workStatusModalVisible = false,
    setWorkStatusModalVisible = () => {},

    licenseModalVisible = false,
    setLicenseModalVisible = () => {},

    adminMenuVisible,
    setAdminMenuVisible,
    harvestModalVisible = false,
    setHarvestModalVisible = () => {},
    auditModalVisible = false,
    setAuditModalVisible = () => {},
    onSignOut,

    adminScreenType,
    setAdminScreenType,
    consoleVisible,
    setConsoleVisible,

    adminsList,
    orgsList,
    appsList,
    availableCategories,
    onGenerateOperatorInviteHash,
    onRemoveAdmin,
    onRemoveOrg,
    newOrgInput,
    setNewOrgInput,
    onCreateOrg,
    onRemoveApp,
    newAppInput,
    setNewAppInput,
    onCreateApp,
    onDeleteCategory,
    newCatNameInput,
    setNewCatNameInput,
    onCreateCategory,
    selectedTenantBlindId,
    onSelectTenant,

    tenantStats,
    licensePlans,
    licenseUpgradeHashInput,
    setLicenseUpgradeHashInput,
    onGenerateOperatorAddonFile,
    onGenerateCustomerAddonFile,
    onUpgradeLicenseWithHash,

    editTenantNameInput,
    setEditTenantNameInput,
    onSaveEnterpriseName,
    allowNameEntry,
    onToggleAllowNameEntry,
    loginIssueEnabled,
    onToggleLoginIssue,
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
    setNewCustomFieldName,
    onAddCustomField,
    onAddChip,

    advancedFeaturesConfig,
    onSaveAdvancedConfig,
    savingAdvancedConfig,

    selectedAdminId,
    setSelectedAdminId,
    selectedCatIds,
    onToggleCategory,
    currentAppCategories,
    onSaveAllocationSubmit,
    expandedGeminiSection,
    setExpandedGeminiSection,
    copiedConsoleHash,
    setCopiedConsoleHash,
    setGeneratedOperatorHash,
    setGeneratedUserHash,

    addOrgModalVisible,
    setAddOrgModalVisible,
    newOrgIdInput,
    setNewOrgIdInput,
    newOrgNameInput,
    setNewOrgNameInput,
    onAddCustomOrgSubmit,

    appRegModalVisible,
    setAppRegModalVisible,
    appRegStatus,
    appRegNameInput,
    setAppRegNameInput,
    appRegDescInput,
    setAppRegDescInput,
    onSubmitAppRegistration,

    addAdminModalVisible,
    setAddAdminModalVisible,
    assigningTicket,
    setAssigningTicket,
    assignAppId,
    setAssignAppId,
    assignCatId,
    setAssignCatId,
    modalAppCategories,
    newAdminIdInput,
    setNewAdminIdInput,
    newAdminAliasInput,
    setNewAdminAliasInput,
    onSuggestNextCount,
    onSuggestCyclePrefix,
    onAddCustomAdminSubmit,

    addAppModalVisible,
    setAddAppModalVisible,
    onAddCustomAppSubmit,

    addCatModalVisible,
    setAddCatModalVisible,
    selectedAppId,
    newCatIdInput,
    setNewCatIdInput,
    newCatTrInput,
    setNewCatTrInput,
    newCatEnInput,
    setNewCatEnInput,
    onAddCustomCategorySubmit,

    identityModalVisible,
    setIdentityModalVisible,
    identityInput,
    setIdentityInput,
    onIdentitySave,

    filterModalVisible,
    setFilterModalVisible,
    filterTenantBlindId,
    setFilterTenantBlindId,
    filterOrgId,
    setFilterOrgId,
    filterAppId,
    setFilterAppId,
    filterCategoryId,
    setFilterCategoryId,
    onResetHierarchyFilters,
    filteredTicketsCount,
    totalTicketsCount,
    tenantsList,

    userPrefsModalVisible,
    setUserPrefsModalVisible,
    userAdvancedPrefs,
    onSaveUserAdvancedPrefs,

    approvalsModalVisible,
    setApprovalsModalVisible,
    pendingApprovals,
    onReviewApproval,
    onApproveWithConfirm,

    ticketActionModalVisible,
    setTicketActionModalVisible,
    targetActionTicket,
    targetActionMessages = null,
    targetActionRole,
    ticketMenuAnchorY = null,
    getRank,
    onDeleteSingleTicket,
    onRevokeUserAdmin,
    onPromoteTicketUserToAdmin,
    onPromoteTicketUserToCosmos,
    onBlockTicketUser,
    onDeleteTicketAndUser,
    onStartSelfDestruct,
    onCancelSelfDestruct,
    onOpenRating,
    onOpenOrgAssign,
    onStartTransfer,
    onCancelTransfer,
    onTakeOverTicket,

    ticketOrgAssignModalVisible,
    setTicketOrgAssignModalVisible,
    selectedTicket,
    onSaveTicketOrgAssign,
    diagnosticModalVisible = false,
    setDiagnosticModalVisible,
    diagnosticData = null,
    targetDiagnosticTicket = null,
    onInspectDiagnostics,
    onAttachDiagnostics,
    onDeleteDiagnostics,

    cropModalVisible,
    setCropModalVisible,
    cropSourceImageUri,
    setCropSourceImageUri,
    onConfirmCrop,

    attachMenuVisible,
    setAttachMenuVisible,
    onPickCamera,
    onPickGallery,
    onPickDocument,

    previewImageUri,
    setPreviewImageUri,
    previewFileName,
    setPreviewFileName,

    confirmSheet,
    setConfirmSheet,

    sdkIntegrationVisible,
    setSdkIntegrationVisible,
    adminRatingsVisible,
    setAdminRatingsVisible,
    onReloadConsoleData,

    feedbackDialogVisible,
    onFeedbackClose,
    onFeedbackSubmit,

    callSession,
    myAdminOrgId,
    currentChannelMemberCount,
    pttTenantId,
    pttTenantName,
    availableOrgChannels,
    activeOrgChannelId,
    onChangePttTenant,
    onChangeOrgChannel,
    onBroadcastChannelInvite,
  } = props;

  // Format categories list for TicketFilterModal
  const filterCategoriesList: HelpDeskCategory[] = availableCategories.map(cat => ({
    key: cat.id,
    id: cat.id,
    labelTr: cat.labelTr,
    labelEn: cat.labelEn,
    icon: cat.icon,
  }));

  const [rdSession, setRdSession] = React.useState<RemoteDesktopSession | null>(
    remoteDesktopService.getSession()
  );

  React.useEffect(() => {
    const unsub = remoteDesktopService.subscribe(setRdSession);
    return () => unsub();
  }, []);

  return (
    <>
      {/* 1. DEDICATED WHITEDESK ADMIN OPERATIONAL MANUAL MODAL */}
      {adminGuideVisible && (
        <AdminGuideModal
          visible={adminGuideVisible}
          onClose={() => setAdminGuideVisible(false)}
          language={language}
        />
      )}

      {/* 2. DEDICATED WHITEDESK USER GUIDE MODAL */}
      {userGuideVisible && (
        <UserGuideModal
          visible={userGuideVisible}
          onClose={() => setUserGuideVisible(false)}
          language={language}
        />
      )}

      {/* 3. PRIVACY & SECURITY POLICY MODAL */}
      {securityPrivacyVisible && (
        <SecurityPrivacyModal
          visible={securityPrivacyVisible}
          onClose={() => setSecurityPrivacyVisible(false)}
          language={language}
        />
      )}

      {/* 4. ADMIN NAVIGATION 3-DOTS MENU */}
      {adminMenuVisible && (
        <AdminNavigationMenuModal
          visible={adminMenuVisible}
          onClose={() => setAdminMenuVisible(false)}
          safeTop={safeTop}
          isAdmin={isAdmin}
          isMasterAdmin={isMasterAdmin}
          isFounder={isFounder}
          adminRole={adminRole}
          language={language}
          onOpenProfile={() => setProfileModalVisible(true)}
          onOpenWorkStatus={() => setWorkStatusModalVisible(true)}
          onOpenLicense={
            (isMasterAdmin || isFounder || adminRole === 'global_admin' || adminRole === 'founder')
              ? () => setLicenseModalVisible(true)
              : undefined
          }
          onOpenProvisioning={() => setAdminScreenType('provisioning')}
          onOpenSettings={() => setAdminScreenType('settings')}
          onOpenAdvancedFeatures={() => setAdminScreenType('advanced')}
          onOpenSdkIntegration={() => setSdkIntegrationVisible(true)}
          onOpenHarvestModal={() => setHarvestModalVisible(true)}
          onOpenAuditModal={() => setAuditModalVisible(true)}
          onOpenAdminRatings={() => setAdminRatingsVisible(true)}
          onOpenSecurityPrivacy={() => setSecurityPrivacyVisible(true)}
          onOpenAdminGuide={() => setAdminGuideVisible(true)}
          onOpenUserGuide={() => setUserGuideVisible(true)}
          onOpenUserPrefs={() => setUserPrefsModalVisible(true)}
          onOpenIdentityModal={() => {
            setIdentityInput(customAlias || '');
            setIdentityModalVisible(true);
          }}
          onSignOut={onSignOut}
        />
      )}

      {/* 4.1 FEDERAL DATA HARVESTING MODAL */}
      <FederalHarvestModal
        visible={harvestModalVisible}
        onClose={() => setHarvestModalVisible(false)}
        isAdmin={isAdmin}
        isMasterAdmin={isMasterAdmin}
        isFounder={isFounder}
        adminRole={adminRole}
        ownWhiteId={ownWhiteId}
        currentEnterpriseName={currentEnterpriseName}
        activeEnterpriseBlindId={activeEnterpriseBlindId}
        tenantsList={tenantsList}
        orgsList={orgsList}
        appsList={appsList}
        language={language}
        onOpenAuditModal={() => setAuditModalVisible(true)}
      />

      {/* 4.2 FDH AUDIT & EXPLORER MODAL */}
      <FDHAuditModal
        visible={auditModalVisible}
        onClose={() => setAuditModalVisible(false)}
        language={language}
      />

      {/* 4B. PROFILE MODAL */}
      {profileModalVisible && (
        <ProfileModal
          visible={profileModalVisible}
          onClose={() => setProfileModalVisible(false)}
          ownWhiteId={ownWhiteId}
          customAlias={customAlias}
          isAdmin={isAdmin}
          adminRole={adminRole}
          isMasterAdmin={isMasterAdmin}
          isFounder={isFounder}
          tenantStats={tenantStats}
          currentEnterpriseName={currentEnterpriseName}
          language={language as any}
          onSaveCustomAlias={onSaveCustomAlias}
        />
      )}

      {/* 4C. WORK STATUS MODAL */}
      {workStatusModalVisible && (
        <WorkStatusModal
          visible={workStatusModalVisible}
          onClose={() => setWorkStatusModalVisible(false)}
          language={language as any}
        />
      )}

      {/* 4D. LICENSE & SUBSCRIPTION MODAL */}
      {licenseModalVisible && (
        <LicenseModal
          visible={licenseModalVisible}
          onClose={() => setLicenseModalVisible(false)}
          enterpriseBlindId={activeEnterpriseBlindId || 'default'}
          tenantStats={tenantStats}
          language={language as any}
        />
      )}

      {/* 5. PROVISIONING STATION MODAL */}
      {adminScreenType === 'provisioning' && (
        <ProvisioningStationModal
          visible={adminScreenType === 'provisioning'}
          onClose={() => setAdminScreenType(null)}
          adminModalHeight={adminModalHeight}
          currentEnterpriseName={currentEnterpriseName}
          activeEnterpriseBlindId={activeEnterpriseBlindId}
          isFounder={isFounder}
          tenantsList={tenantsList}
          selectedTenantBlindId={selectedTenantBlindId}
          onSelectTenant={onSelectTenant}
          adminsList={adminsList}
          ownWhiteId={ownWhiteId}
          formatWhiteId={formatWhiteId}
          onGenerateOperatorInviteHash={onGenerateOperatorInviteHash}
          onRemoveAdmin={onRemoveAdmin}
          orgsList={orgsList}
          onRemoveOrg={onRemoveOrg}
          newOrgInput={newOrgInput}
          onChangeNewOrgInput={setNewOrgInput}
          onCreateOrg={onCreateOrg}
          appsList={appsList}
          onRemoveApp={onRemoveApp}
          newAppInput={newAppInput}
          onChangeNewAppInput={setNewAppInput}
          onCreateApp={onCreateApp}
          availableCategories={availableCategories}
          onDeleteCategory={onDeleteCategory}
          newCatNameInput={newCatNameInput}
          onChangeNewCatNameInput={setNewCatNameInput}
          onCreateCategory={onCreateCategory}
          onOpenSdkIntegration={() => setSdkIntegrationVisible(true)}
        />
      )}

      {/* 6. LICENSING STATION MODAL */}
      {adminScreenType === 'license' && (
        <LicenseStationModal
          visible={adminScreenType === 'license'}
          onClose={() => setAdminScreenType(null)}
          adminModalHeight={adminModalHeight}
          currentEnterpriseName={currentEnterpriseName}
          activeEnterpriseBlindId={activeEnterpriseBlindId || 'default'}
          adminsList={adminsList}
          tenantStats={tenantStats}
          licensePlans={licensePlans}
          licenseUpgradeHashInput={licenseUpgradeHashInput}
          onChangeLicenseUpgradeHash={setLicenseUpgradeHashInput}
          onGenerateOperatorAddonFile={onGenerateOperatorAddonFile}
          onGenerateCustomerAddonFile={onGenerateCustomerAddonFile}
          onUpgradeLicenseWithHash={onUpgradeLicenseWithHash}
        />
      )}

      {/* 7. SETTINGS STATION MODAL */}
      {adminScreenType === 'settings' && (
        <SettingsStationModal
          visible={adminScreenType === 'settings'}
          onClose={() => setAdminScreenType(null)}
          adminModalHeight={adminModalHeight}
          currentEnterpriseName={currentEnterpriseName}
          allowNameEntry={allowNameEntry}
          onToggleAllowNameEntry={onToggleAllowNameEntry}
          loginIssueEnabled={loginIssueEnabled}
          onToggleLoginIssue={onToggleLoginIssue}
          editTenantNameInput={editTenantNameInput}
          onChangeTenantNameInput={setEditTenantNameInput}
          onSaveEnterpriseName={onSaveEnterpriseName}
          tenantLogoUri={tenantLogoUri}
          tenantLogoAlign={tenantLogoAlign}
          onLongPressLogoToCrop={onLongPressLogoToCrop}
          onSaveLogoAlign={onSaveLogoAlign}
          onRemoveLogo={onRemoveLogo}
          onPickLogo={onPickLogo}
          onPickDocumentForCrop={onPickDocumentForCrop}
          tenantCustomFields={tenantCustomFields}
          onRemoveCustomField={onRemoveCustomField}
          newCustomFieldName={newCustomFieldName}
          onChangeNewCustomFieldName={setNewCustomFieldName}
          onAddCustomField={onAddCustomField}
          onAddChip={onAddChip}
          language={language}
        />
      )}

      {/* 8. ADVANCED FEATURES MODAL */}
      {adminScreenType === 'advanced' && (
        <AdvancedStationModal
          visible={adminScreenType === 'advanced'}
          onClose={() => setAdminScreenType(null)}
          adminModalHeight={adminModalHeight}
          currentEnterpriseName={currentEnterpriseName}
          language={language}
          config={advancedFeaturesConfig}
          onSave={onSaveAdvancedConfig}
          saving={savingAdvancedConfig}
          getLabel={getLabel}
          availableOrgs={orgsList}
        />
      )}

      {/* 9. MANAGEMENT CONSOLE MODAL */}
      {consoleVisible && (
        <ManagementConsoleModal
          visible={consoleVisible}
          onClose={() => setConsoleVisible(false)}
          adminModalHeight={adminModalHeight}
          currentEnterpriseName={currentEnterpriseName}
          activeEnterpriseBlindId={activeEnterpriseBlindId}
          language={language}
          tenantStats={tenantStats}
          adminsList={adminsList}
          selectedAdminId={selectedAdminId}
          onSelectAdminId={setSelectedAdminId}
          onRemoveAdmin={onRemoveAdmin}
          selectedCatIds={selectedCatIds}
          onToggleCategory={onToggleCategory}
          currentAppCategories={currentAppCategories}
          onSaveAllocationSubmit={onSaveAllocationSubmit}
          t={t}
          expandedGeminiSection={expandedGeminiSection}
          onToggleSection={(sec: GeminiSection) => setExpandedGeminiSection(prev => (prev === sec ? null : sec))}
          copiedConsoleHash={copiedConsoleHash}
          onCopyBlindId={async () => {
            const id = activeEnterpriseBlindId || 'default';
            setCopiedConsoleHash(id);
            setTimeout(() => setCopiedConsoleHash(null), 2000);
          }}
          onGenerateAdminHash={async () => {
            const res = await helpDeskService.generateNewAdminHash(activeEnterpriseBlindId || 'default', 1);
            if (res.success && res.hash) {
              setGeneratedOperatorHash(res.hash);
              setCopiedConsoleHash(res.hash);
              setTimeout(() => setCopiedConsoleHash(null), 3500);
            }
          }}
          onGenerateUserHash={async () => {
            const res = await helpDeskService.generateNewUserHash(activeEnterpriseBlindId || 'default', 25);
            if (res.success && res.hash) {
              setGeneratedUserHash(res.hash);
              setCopiedConsoleHash(res.hash);
              setTimeout(() => setCopiedConsoleHash(null), 3500);
            }
          }}
        />
      )}

      {/* 10. SUB-MODALS */}
      {addOrgModalVisible && (
        <AddOrgModal
          visible={addOrgModalVisible}
          onClose={() => {
            setAddOrgModalVisible(false);
            setNewOrgIdInput('');
            setNewOrgNameInput('');
          }}
          orgIdInput={newOrgIdInput}
          onChangeOrgId={setNewOrgIdInput}
          orgNameInput={newOrgNameInput}
          onChangeOrgName={setNewOrgNameInput}
          onSubmit={onAddCustomOrgSubmit}
          language={language}
          getLabel={getLabel}
        />
      )}

      {appRegModalVisible && (
        <AppRegistrationModal
          visible={appRegModalVisible}
          onClose={() => setAppRegModalVisible(false)}
          appRegStatus={appRegStatus}
          currentAppId={CURRENT_APP_ID}
          appRegNameInput={appRegNameInput}
          onChangeAppRegName={setAppRegNameInput}
          appRegDescInput={appRegDescInput}
          onChangeAppRegDesc={setAppRegDescInput}
          onSubmit={onSubmitAppRegistration}
          language={language}
          t={t}
        />
      )}

      {addAdminModalVisible && (
        <AddAdminModal
          visible={addAdminModalVisible}
          onClose={() => {
            setAddAdminModalVisible(false);
            setAssigningTicket(null);
            setNewAdminIdInput('');
            setNewAdminAliasInput('');
          }}
          assigningTicket={assigningTicket}
          assignAppId={assignAppId}
          onChangeAssignAppId={setAssignAppId}
          assignCatId={assignCatId}
          onChangeAssignCatId={setAssignCatId}
          appsList={appsList}
          modalAppCategories={modalAppCategories}
          newAdminIdInput={newAdminIdInput}
          onChangeNewAdminId={setNewAdminIdInput}
          newAdminAliasInput={newAdminAliasInput}
          onChangeNewAdminAlias={setNewAdminAliasInput}
          onSuggestNextCount={onSuggestNextCount}
          onSuggestCyclePrefix={onSuggestCyclePrefix}
          onSubmit={onAddCustomAdminSubmit}
          language={language}
          formatAppId={formatAppId}
          getLabel={getLabel}
        />
      )}

      {addAppModalVisible && (
        <AddAppModal
          visible={addAppModalVisible}
          onClose={() => {
            setAddAppModalVisible(false);
            setNewAppInput('');
          }}
          appIdInput={newAppInput}
          onChangeAppId={setNewAppInput}
          onSubmit={onAddCustomAppSubmit}
          language={language}
          getLabel={getLabel}
        />
      )}

      {addCatModalVisible && (
        <AddCategoryModal
          visible={addCatModalVisible}
          onClose={() => {
            setAddCatModalVisible(false);
            setNewCatIdInput('');
            setNewCatTrInput('');
            setNewCatEnInput('');
          }}
          selectedAppId={selectedAppId}
          catIdInput={newCatIdInput}
          onChangeCatId={setNewCatIdInput}
          catLabelInput={newCatTrInput}
          onChangeCatLabel={setNewCatTrInput}
          onSubmit={onAddCustomCategorySubmit}
          language={language}
          formatAppId={formatAppId}
          getLabel={getLabel}
        />
      )}

      {identityModalVisible && (
        <IdentityModal
          visible={identityModalVisible}
          onClose={() => setIdentityModalVisible(false)}
          identityInput={identityInput}
          onChangeIdentityInput={setIdentityInput}
          onSave={onIdentitySave}
          isAdmin={isAdmin}
          onSignOut={onSignOut}
          language={language}
          getLabel={getLabel}
          allowNameEntry={allowNameEntry}
        />
      )}

      {/* 11. TICKET FILTER & PREFERENCES */}
      {filterModalVisible && (
        <TicketFilterModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          isFounder={isFounder}
          isGlobalAdmin={adminRole === 'global_admin'}
          isAdmin={isAdmin}
          selectedTenantBlindId={filterTenantBlindId}
          onSelectTenant={setFilterTenantBlindId}
          tenantsList={tenantsList}
          selectedOrgId={filterOrgId}
          onSelectOrg={setFilterOrgId}
          orgsList={orgsList}
          selectedAppId={filterAppId}
          onSelectApp={setFilterAppId}
          appsList={appsList}
          selectedCategoryId={filterCategoryId}
          onSelectCategory={setFilterCategoryId}
          categoriesList={filterCategoriesList}
          onResetAll={onResetHierarchyFilters}
          filteredCount={filteredTicketsCount}
          totalCount={totalTicketsCount}
          language={language}
          getLabel={getLabel}
        />
      )}

      {userPrefsModalVisible && (
        <UserPreferencesModal
          visible={userPrefsModalVisible}
          onClose={() => setUserPrefsModalVisible(false)}
          preferences={userAdvancedPrefs}
          onSave={onSaveUserAdvancedPrefs}
          language={language}
          getLabel={getLabel}
        />
      )}

      {approvalsModalVisible && (
        <ApprovalsModal
          visible={approvalsModalVisible}
          onClose={() => setApprovalsModalVisible(false)}
          pendingApprovals={pendingApprovals}
          language={language}
          getLabel={getLabel}
          formatWhiteId={formatWhiteId}
          formatAppId={formatAppId}
          onReviewApproval={onReviewApproval}
          onApproveWithConfirm={onApproveWithConfirm}
        />
      )}

      {ticketActionModalVisible && (
        <TicketActionModal
          visible={ticketActionModalVisible}
          onClose={() => setTicketActionModalVisible(false)}
          ticket={targetActionTicket}
          ownWhiteId={ownWhiteId}
          adminRole={adminRole}
          isAdmin={isAdmin}
          isMasterAdmin={isMasterAdmin}
          isFounder={isFounder}
          targetActionRole={targetActionRole}
          getRank={getRank}
          language={language}
          getLabel={getLabel}
          formatWhiteId={formatWhiteId}
          onDeleteSingleTicket={onDeleteSingleTicket}
          onRevokeUserAdmin={onRevokeUserAdmin}
          onPromoteTicketUserToAdmin={onPromoteTicketUserToAdmin}
          onPromoteTicketUserToCosmos={onPromoteTicketUserToCosmos}
          onBlockTicketUser={onBlockTicketUser}
          onDeleteTicketAndUser={onDeleteTicketAndUser}
          onStartSelfDestruct={onStartSelfDestruct}
          onCancelSelfDestruct={onCancelSelfDestruct}
          onOpenRating={onOpenRating}
          onOpenOrgAssign={() => targetActionTicket && onOpenOrgAssign(targetActionTicket)}
          onStartTransfer={() => targetActionTicket && onStartTransfer && onStartTransfer(targetActionTicket)}
          onCancelTransfer={() => targetActionTicket && onCancelTransfer && onCancelTransfer(targetActionTicket)}
          onTakeOverTicket={onTakeOverTicket}
          onInspectDiagnostics={() => targetActionTicket && onInspectDiagnostics && onInspectDiagnostics(targetActionTicket)}
          onAttachDiagnostics={() => targetActionTicket && onAttachDiagnostics && onAttachDiagnostics(targetActionTicket)}
          onDeleteDiagnostics={() => targetActionTicket && onDeleteDiagnostics && onDeleteDiagnostics(targetActionTicket)}
          messages={targetActionMessages || null}
          safeTop={safeTop}
          anchorY={ticketMenuAnchorY}
        />
      )}

      {ticketOrgAssignModalVisible && (
        <TicketOrgAssignModal
          visible={ticketOrgAssignModalVisible}
          onClose={() => setTicketOrgAssignModalVisible(false)}
          ticket={targetActionTicket || selectedTicket}
          orgs={orgsList.map(o => ({ org_id: o.org_id, name: o.name }))}
          apps={appsList.map(a => ({ app_id: a.app_id, name: a.name || a.app_id, org_id: a.org_id }))}
          onSave={onSaveTicketOrgAssign}
        />
      )}

      {/* 12. MEDIA & CROP */}
      {cropModalVisible && (
        <ImageCropModal
          visible={cropModalVisible}
          imageUri={cropSourceImageUri}
          onClose={() => {
            setCropModalVisible(false);
            setCropSourceImageUri(null);
          }}
          onConfirm={onConfirmCrop}
        />
      )}

      {attachMenuVisible && (
        <AttachMenuModal
          visible={attachMenuVisible}
          onClose={() => setAttachMenuVisible(false)}
          onPickCamera={onPickCamera}
          onPickGallery={onPickGallery}
          onPickDocument={onPickDocument}
          getLabel={getLabel}
        />
      )}

      {previewImageUri !== null && (
        <ImagePreviewModal
          visible={previewImageUri !== null}
          imageUri={previewImageUri}
          fileName={previewFileName}
          onClose={() => {
            setPreviewImageUri(null);
            setPreviewFileName(null);
          }}
        />
      )}

      {/* 13. SDK & CSAT */}

      {sdkIntegrationVisible && (
        <SdkIntegrationModal
          visible={sdkIntegrationVisible}
          onClose={() => setSdkIntegrationVisible(false)}
          enterpriseName={currentEnterpriseName || 'Sovereign Node'}
          enterpriseBlindId={activeEnterpriseBlindId || ''}
        />
      )}

      {adminRatingsVisible && (
        <AdminRatingsOverviewModal
          visible={adminRatingsVisible}
          onClose={() => setAdminRatingsVisible(false)}
          enterpriseBlindId={activeEnterpriseBlindId || ''}
          enterpriseName={currentEnterpriseName}
          isSystemWide={
            isFounder ||
            activeEnterpriseBlindId === 'blind_11fcac28453c3eaa3a06a5db6caf4ca1' ||
            Boolean(
              currentEnterpriseName &&
                (currentEnterpriseName.toLowerCase().includes('thewhite') ||
                  currentEnterpriseName.toLowerCase().includes('the white'))
            )
          }
          isFounder={isFounder}
          adminRole={adminRole}
          tenantsList={tenantsList}
          orgsList={orgsList}
          appsList={appsList}
        />
      )}

      {feedbackDialogVisible && (
        <TicketFeedbackDialog
          visible={feedbackDialogVisible}
          onClose={onFeedbackClose}
          onSubmit={onFeedbackSubmit}
        />
      )}

      {/* 14. BOTTOM CONFIRMATION SHEET */}
      {confirmSheet.visible && (
        <BottomConfirmationSheet
          visible={confirmSheet.visible}
          title={confirmSheet.title}
          description={confirmSheet.description}
          actionText={confirmSheet.actionText}
          actionColor={confirmSheet.actionColor}
          cancelText={confirmSheet.cancelText}
          onCancel={confirmSheet.onCancel || (() => setConfirmSheet((prev: any) => ({ ...prev, visible: false })))}
          onAction={confirmSheet.onAction}
        />
      )}

      {/* 15. VOICE CALL MODAL */}
      {Boolean(callSession && callSession.state !== 'idle' && callSession.state !== 'ended' && callSession.callType !== 'ptt') && (
        <CallScreenModal
          session={callSession!}
          isAdmin={isAdmin}
          onAnswer={() => {
            void voiceCallService.answerCall();
          }}
          onReject={() => {
            void voiceCallService.rejectCall();
          }}
          onEndCall={() => {
            void voiceCallService.endCall();
          }}
          onToggleMute={() => voiceCallService.toggleMute()}
          onToggleSpeaker={() => voiceCallService.toggleSpeaker()}
          onAttachFile={onPickDocument}
          visible={true}
        />
      )}

      {/* 16. PTT RADIO MODAL */}
      {Boolean(callSession && callSession.state !== 'idle' && callSession.state !== 'ended' && callSession.callType === 'ptt') && (
        <PttScreenModal
          session={callSession!}
          isAdmin={isAdmin}
          isFounder={isFounder}
          adminRole={adminRole}
          currentAdminOrgId={myAdminOrgId || undefined}
          channelMemberCount={currentChannelMemberCount}
          language={language}
          tenants={tenantsList}
          currentTenantId={pttTenantId || activeEnterpriseBlindId || 'default'}
          currentTenantName={pttTenantName || currentEnterpriseName || 'Whitechain'}
          onChangeTenant={onChangePttTenant}
          onAnswer={() => {
            void voiceCallService.answerCall();
          }}
          onReject={() => {
            void voiceCallService.rejectCall();
          }}
          onEndCall={() => {
            void voiceCallService.endCall();
          }}
          onLeaveChannel={() => {
            voiceCallService.leaveOrgChannel();
          }}
          onToggleTalking={(talking) => {
            voiceCallService.setMute(!talking);
          }}
          orgChannels={availableOrgChannels}
          currentOrgChannelId={activeOrgChannelId}
          onChangeOrgChannel={onChangeOrgChannel}
          onBroadcastChannelInvite={onBroadcastChannelInvite}
          visible={true}
        />
      )}

      {/* 17. ORG BROADCAST TOP BANNER */}
      {callSession &&
        callSession.scope === 'org_group' &&
        callSession.state === 'incoming_ringing' && (
          <View style={bannerStyles.orgPttTopBanner}>
            <TouchableOpacity
              style={bannerStyles.orgPttTopBannerLeft}
              onPress={() => {
                void voiceCallService.answerCall();
              }}
              activeOpacity={0.85}
            >
              <View style={bannerStyles.orgPttIconCircle}>
                <Radio size={16} color="#0F766E" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={bannerStyles.orgPttTopBannerTitle} numberOfLines={1}>
                  {callSession.targetOrgName || callSession.calleeAlias || currentEnterpriseName || ''}
                </Text>
                <Text style={bannerStyles.orgPttTopBannerSubtitle} numberOfLines={1}>
                  {callSession.callerAlias || 'Admin'} canlı anons yapıyor...
                </Text>
              </View>
            </TouchableOpacity>

            <View style={bannerStyles.orgPttTopBannerActions}>
              <TouchableOpacity
                style={bannerStyles.orgPttJoinBtn}
                onPress={() => {
                  void voiceCallService.answerCall();
                }}
                activeOpacity={0.8}
              >
                <Text style={bannerStyles.orgPttJoinBtnText}>
                  {language === 'tr' ? 'Katıl' : 'Join'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={bannerStyles.orgPttDismissBtn}
                onPress={() => {
                  void voiceCallService.rejectCall();
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={16} color="#64748B" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          </View>
        )}

      {/* 18. SYSTEM DIAGNOSTIC VIEWER */}
      {diagnosticModalVisible && (
        <DiagnosticViewerModal
          visible={diagnosticModalVisible}
          onClose={() => setDiagnosticModalVisible && setDiagnosticModalVisible(false)}
          ticket={targetDiagnosticTicket}
          diagnosticData={diagnosticData}
          language={language}
        />
      )}

      {/* 19. GERÇEK UZAK MASAÜSTÜ (EKRAN YAYINI VE UZAKTAN KONTROL - TÜM EKRANLARDA AKTİF) */}
      <RemoteDesktopModal
        session={rdSession}
        language={language}
        onAcceptOffer={() => {
          void remoteDesktopService.acceptOffer();
        }}
        onRejectOffer={() => {
          void remoteDesktopService.rejectOffer();
        }}
        onEndSession={() => {
          void remoteDesktopService.endSession(true);
        }}
      />
    </>
  );
}

const bannerStyles = StyleSheet.create({
  orgPttTopBanner: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 38 : 50,
    left: 16,
    right: 16,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  orgPttTopBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  orgPttIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  orgPttTopBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  orgPttTopBannerSubtitle: {
    fontSize: 11,
    color: '#0D9488',
    fontWeight: '500',
  },
  orgPttTopBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orgPttJoinBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  orgPttJoinBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  orgPttDismissBtn: {
    padding: 6,
  },
});
