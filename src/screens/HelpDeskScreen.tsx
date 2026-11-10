import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  UIManager,
  Animated,
  Keyboard,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  UserCheck,
  ScanLine,
  Radio,
  MoreVertical,
} from 'lucide-react-native';
import { 
  helpDeskService, 
  HelpDeskTicket, 
  HelpDeskMessage, 
  TicketStatus,
  HelpDeskCategory,
  AppCatEntry,
  AdminEntry,
  AdminAllocEntry,
  OrgEntry,
  AppRegStatus,
  AppRequestEntry,
  TenantEntry,
  ApprovalEntry,
  CURRENT_APP_ID,
} from '../services/helpDeskService';
import { TenantLogo } from '../components/TenantLogo';
import { TicketComposeView } from '../components/helpdesk/views/TicketComposeView';
import { TicketDetailView } from '../components/helpdesk/views/TicketDetailView';
import { remoteDesktopService } from '../services/remoteDesktopService';
import { WhiteDeskCrypto } from '../whitedesk-sdk';
import { TicketListView } from '../components/helpdesk/views/TicketListView';
import { buttonThemeService, ButtonTheme } from '../services/helpdesk/buttonThemeService';
import { 
  useHelpDeskAttachments,
  useHelpDeskVoice,
  useHelpDeskGovernance,
  useHelpDeskStation,
  useHelpDeskTicketState,
  useHelpDeskModalsProps,
  useHelpDeskConsoleData,
  useHelpDeskI18n,
} from '../components/helpdesk/hooks';
import {
  formatTicketDate as formatTicketDateUtil,
  formatWhiteId as formatWhiteIdUtil,
  formatAppId,
  getCategoryLabel as getCategoryLabelUtil,
} from '../components/helpdesk/utils/helpdeskFormatters';
import { 
  AttachedFile, 
  CustomFieldDef, 
  CatalogItem,
  AdvancedFeaturesConfig,
  DEFAULT_ADVANCED_FEATURES_CONFIG,
  UserAdvancedPreferences,
  DEFAULT_USER_ADVANCED_PREFERENCES,
} from '../components/helpdesk/types';
import { HelpDeskModalsContainer, HelpDeskModalsContainerProps } from '../components/helpdesk/modals/HelpDeskModalsContainer';
import { exportOrgPubCertificate } from '../components/helpdesk/station/certUtils';
import { voiceCallService } from '../services/voiceCallService';
import { NotificationService } from '../services/notificationService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function HelpDeskScreen() {
  const { language, currentLanguage, t, getLabel } = useHelpDeskI18n();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const adminModalHeight = Math.round(windowHeight * 0.86);

  const safeTop = Math.max(insets.top, StatusBar.currentHeight || 0, Platform.OS === 'android' ? 42 : 44);

  const scrollY = useRef(new Animated.Value(0)).current;
  const messagesScrollRef = useRef<ScrollView>(null);
  const listScrollRef = useRef<ScrollView>(null);
  const composeScrollRef = useRef<ScrollView>(null);

  // Admin & Identity States
  const [ownWhiteId, setOwnWhiteId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<'founder' | 'global_admin' | 'admin' | 'none'>('none');
  const [isFounder, setIsFounder] = useState(false);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [customAlias, setCustomAlias] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const isSearchActive = Boolean(searchFocused && keyboardHeight > 0);

  // Filter Modal Visibility
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Console & Tenant Data States
  const [consoleVisible, setConsoleVisible] = useState(false);
  const [adminGuideVisible, setAdminGuideVisible] = useState(false);
  const [userGuideVisible, setUserGuideVisible] = useState(false);
  const [securityPrivacyVisible, setSecurityPrivacyVisible] = useState(false);
  const [adminsList, setAdminsList] = useState<AdminEntry[]>([]);
  const [orgsList, setOrgsList] = useState<OrgEntry[]>([]);
  const [appsList, setAppsList] = useState<AppCatEntry[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('*');
  const [selectedAppId, setSelectedAppId] = useState<string>('all');
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>(['all']);
  const [identityModalVisible, setIdentityModalVisible] = useState(false);
  const [identityInput, setIdentityInput] = useState('');
  const [approvalsModalVisible, setApprovalsModalVisible] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalEntry[]>([]);
  const [tenantsList, setTenantsList] = useState<TenantEntry[]>([]);
  const [selectedTenantBlindId, setSelectedTenantBlindId] = useState<string>('all');
  const [currentEnterpriseName, setCurrentEnterpriseName] = useState<string>('');

  // Gemini-Style Global Admin Console State
  const [expandedGeminiSection, setExpandedGeminiSection] = useState<'tenant' | 'license' | 'operators' | null>('tenant');
  const [tenantStats, setTenantStats] = useState<{ adminCount: number; userCount: number }>({ adminCount: 1, userCount: 0 });
  const [activeEnterpriseBlindId, setActiveEnterpriseBlindId] = useState<string>('');
  const [generatedOperatorHash, setGeneratedOperatorHash] = useState<string | null>(null);
  const [generatedUserHash, setGeneratedUserHash] = useState<string | null>(null);
  const [copiedConsoleHash, setCopiedConsoleHash] = useState<string | null>(null);

  // 3-Dots Admin Menu Modal State
  const [adminMenuVisible, setAdminMenuVisible] = useState(false);
  const [harvestModalVisible, setHarvestModalVisible] = useState(false);
  const [auditModalVisible, setAuditModalVisible] = useState(false);
  const [adminScreenType, setAdminScreenType] = useState<'provisioning' | 'license' | 'settings' | 'advanced' | null>(null);

  // New Integration, Provisioning & Rating States
  const [sdkIntegrationVisible, setSdkIntegrationVisible] = useState(false);
  const [adminRatingsVisible, setAdminRatingsVisible] = useState(false);

  // Advanced Features & User Preferences States
  const [advancedFeaturesConfig, setAdvancedFeaturesConfig] = useState<AdvancedFeaturesConfig>(DEFAULT_ADVANCED_FEATURES_CONFIG);
  const [userAdvancedPrefs, setUserAdvancedPrefs] = useState<UserAdvancedPreferences>(DEFAULT_USER_ADVANCED_PREFERENCES);
  const [ticketClientPrefs, setTicketClientPrefs] = useState<UserAdvancedPreferences>(DEFAULT_USER_ADVANCED_PREFERENCES);
  const [userPrefsModalVisible, setUserPrefsModalVisible] = useState(false);
  const [savingAdvancedConfig, setSavingAdvancedConfig] = useState(false);

  // Button Theme State
  const [buttonTheme, setButtonTheme] = useState<ButtonTheme>(buttonThemeService.getDefaultTheme());

  useEffect(() => {
    buttonThemeService.getSavedTheme().then(setButtonTheme);
    const unsub = buttonThemeService.subscribe(setButtonTheme);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (advancedFeaturesConfig?.buttonThemeId) {
      const theme = buttonThemeService.getThemeById(advancedFeaturesConfig.buttonThemeId);
      setButtonTheme(theme);
    }
  }, [advancedFeaturesConfig?.buttonThemeId]);

  const [confirmSheet, setConfirmSheet] = useState<{
    visible: boolean;
    title: string;
    description: string;
    actionText: string;
    actionColor?: string;
    cancelText?: string;
    onAction: () => void;
    onCancel?: () => void;
  }>({
    visible: false,
    title: '',
    description: '',
    actionText: '',
    onAction: () => {},
  });

  const [replyFocused, setReplyFocused] = useState(false);

  // SLA Escalation Toast Notification
  const [slaToast, setSlaToast] = useState<{ visible: boolean; ticketId: string; subject: string } | null>(null);

  useEffect(() => {
    const unsub = helpDeskService.onSlaEscalated((ticketId: string, subject: string) => {
      setSlaToast({ visible: true, ticketId, subject });
      setTimeout(() => {
        setSlaToast(null);
      }, 6000);
    });
    return unsub;
  }, []);

  // Modular Attachments Hook
  const attachments = useHelpDeskAttachments();
  const {
    attachedFiles,
    setAttachedFiles,
    attachedFile,
    setAttachedFile,
    handleRemoveAttachedFile,
    clearAttachments,
    attachMenuVisible,
    setAttachMenuVisible,
    formatAttachmentForSend,
    handlePickCamera,
    handlePickGallery,
    handlePickDocument,
    previewImageUri,
    setPreviewImageUri,
    previewFileName,
    setPreviewFileName,
    handleOpenDocument,
    handlePreviewImage,
  } = attachments;

  // ─── MODULAR HELPDESK TICKET STATE HOOK ────────────────────────────────────
  const loadConsoleDataRef = useRef<() => Promise<void>>(async () => {});
  const showDigitalCleanProposalRef = useRef<((ticket: HelpDeskTicket) => void) | undefined>(undefined);
  const pttSettersRef = useRef<{ setPttTenantId?: (id: string) => void; setPttTenantName?: (name: string) => void }>({});
  const tenantStationRef = useRef<{
    setTenantLogoUri?: (uri: string | null) => void;
    setTenantLogoAlign?: (align: 'left' | 'center' | 'right') => void;
    setTenantCustomFields?: React.Dispatch<React.SetStateAction<CustomFieldDef[]>>;
    setTenantCatalog?: React.Dispatch<React.SetStateAction<CatalogItem[]>>;
    getTenantCustomFields?: () => CustomFieldDef[];
  }>({});

  const handleSetPttTenantId = useCallback((id: string) => { pttSettersRef.current.setPttTenantId?.(id); }, []);
  const handleSetPttTenantName = useCallback((name: string) => { pttSettersRef.current.setPttTenantName?.(name); }, []);
  const handleSetTenantLogoUri = useCallback((uri: string | null) => { tenantStationRef.current.setTenantLogoUri?.(uri); }, []);
  const handleSetTenantLogoAlign = useCallback((align: 'left' | 'center' | 'right') => { tenantStationRef.current.setTenantLogoAlign?.(align); }, []);
  const handleGetTenantCustomFields = useCallback(() => tenantStationRef.current.getTenantCustomFields?.() || [], []);
  const handleSetTenantCustomFields = useCallback((fields: any) => { tenantStationRef.current.setTenantCustomFields?.(fields); }, []);
  const handleSetTenantCatalog = useCallback((cat: any) => { tenantStationRef.current.setTenantCatalog?.(cat); }, []);
  const handleLoadConsoleData = useCallback(async () => { await loadConsoleDataRef.current(); }, []);
  const handleShowDigitalCleanProposal = useCallback((ticket: any) => { showDigitalCleanProposalRef.current?.(ticket); }, []);

  const ticketState = useHelpDeskTicketState({
    language: (language === 'tr' ? 'tr' : 'en'),
    ownWhiteId, setOwnWhiteId,
    isAdmin, setIsAdmin,
    adminRole, setAdminRole,
    isFounder, setIsFounder,
    isMasterAdmin, setIsMasterAdmin,
    customAlias, setCustomAlias,
    activeEnterpriseBlindId, setActiveEnterpriseBlindId,
    currentEnterpriseName, setCurrentEnterpriseName,
    selectedTenantBlindId, setSelectedTenantBlindId,
    setPttTenantId: handleSetPttTenantId,
    setPttTenantName: handleSetPttTenantName,
    setAdminsList, setOrgsList, setAppsList, setTenantsList, setPendingApprovals,
    setTenantLogoUri: handleSetTenantLogoUri,
    setTenantLogoAlign: handleSetTenantLogoAlign,
    advancedFeaturesConfig, setAdvancedFeaturesConfig,
    userAdvancedPrefs, setUserAdvancedPrefs,
    setTicketClientPrefs,
    getTenantCustomFields: handleGetTenantCustomFields,
    setTenantCustomFields: handleSetTenantCustomFields,
    setTenantCatalog: handleSetTenantCatalog,
    attachedFiles, setAttachedFiles,
    formatAttachmentForSend, exportOrgPubCertificate,
    loadConsoleData: handleLoadConsoleData,
    showDigitalCleanProposal: handleShowDigitalCleanProposal,
    setConfirmSheet, scrollY, messagesScrollRef, listScrollRef,
    routeParams: route.params,
  });

  const {
    currentView,
    setCurrentView,
    tickets,
    setTickets,
    selectedTicket,
    setSelectedTicket,
    ticketMessages,
    setTicketMessages,
    loading,
    setLoading,
    sending,
    setSending,
    replyText,
    setReplyText,
    editingMessage,
    setEditingMessage,
    composeSubject,
    setComposeSubject,
    composeMessage,
    setComposeMessage,
    composeCategory,
    setComposeCategory,
    customFieldValues,
    setCustomFieldValues,
    availableCategories,
    setAvailableCategories,
    isCreatingDiscussion,
    attachDiagnostics,
    setAttachDiagnostics,
    handleInspectDiagnostics,
    setIsCreatingDiscussion,
    escalationTarget,
    setEscalationTarget,
    ticketSearchQuery,
    setTicketSearchQuery,
    statusFilter,
    setStatusFilter,
    filterTenantBlindId,
    setFilterTenantBlindId,
    filterOrgId,
    setFilterOrgId,
    filterAppId,
    setFilterAppId,
    filterCategoryId,
    setFilterCategoryId,
    hasActiveHierarchyFilters,
    handleResetHierarchyFilters,
    filteredTickets,
    handleBackToList,
    loadData,
    openTicketDetail,
    handleToggleStatus,
    handleCreateTicket,
    handleReplyTicket,
    handleOpenRating,
    handleFeedbackSubmit,
    handleFeedbackClose,
    handleUserCloseTicket,
    isSendActive,
    shouldShowResolutionCheck,
    isTicketAutoClosed,
    isTicketSecondReminder,
  } = ticketState;

  // Modular Voice & PTT Hook
  const voice = useHelpDeskVoice({
    ownWhiteId,
    customAlias,
    isAdmin,
    isFounder,
    adminRole,
    activeEnterpriseBlindId,
    currentEnterpriseName,
    selectedTicket,
    ticketMessages,
    orgsList,
    adminsList,
    tenantsList,
    tickets,
    filterOrgId,
    currentView,
    language: currentLanguage,
    setConfirmSheet,
    advancedFeaturesConfig,
    userAdvancedPrefs,
    ticketClientPrefs,
  });

  const {
    callSession,
    activeOrgChannelId,
    setActiveOrgChannelId,
    pttTenantId,
    setPttTenantId,
    pttTenantName,
    setPttTenantName,
    availableOrgChannels,
    myAdminOrgId,
    setAllSystemOrgs,
    currentChannelMemberCount,
    handleCallPress,
    handlePttPress,
    handleChangePttTenant,
    handleOrgGroupPttPress,
    handleChangeOrgChannel,
    handleBroadcastChannelInvite,
    effectiveVoiceCall,
    effectivePushToTalk,
  } = voice;


  pttSettersRef.current = { setPttTenantId, setPttTenantName };

  // Dynamic Keyboard Tracking (Never sinks under keyboard)
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          messagesScrollRef.current?.scrollToEnd({ animated: true });
          composeScrollRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setSearchFocused(false);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Main Screen Live Search Keyboard-Docked Auto-Scroll (Always keeps last record + search bar right above keyboard)
  useEffect(() => {
    if (isSearchActive) {
      const timer = setTimeout(() => {
        listScrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isSearchActive, keyboardHeight, ticketSearchQuery, statusFilter]);

  // Formatters
  const formatTicketDate = useCallback((timestamp: number, showTime: boolean = false) => {
    return formatTicketDateUtil(timestamp, showTime, t);
  }, [t]);

  const formatWhiteId = useCallback((id: string | null | undefined): string => {
    return formatWhiteIdUtil(id, ownWhiteId, language === 'tr');
  }, [ownWhiteId, language]);

  const getCategoryLabel = useCallback((catKey?: string | null) => {
    return getCategoryLabelUtil(catKey, availableCategories, language === 'tr');
  }, [availableCategories, language]);

  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  useFocusEffect(
    useCallback(() => {
      loadDataRef.current();
    }, [])
  );

  // Console & Tenant Data Hook
  const {
    licensePlans,
    loadConsoleData,
  } = useHelpDeskConsoleData({
    ownWhiteId,
    adminRole,
    selectedTenantBlindId,
    activeEnterpriseBlindId,
    setActiveEnterpriseBlindId,
    setIsFounder,
    setIsMasterAdmin,
    setTenantStats,
    setAdminsList,
    setAppsList,
    setOrgsList,
    setAllSystemOrgs,
    setSelectedAdminId,
    setSelectedAppId,
    setSelectedOrgId,
    setAvailableCategories,
    language: currentLanguage,
    loadData,
  });

  loadConsoleDataRef.current = loadConsoleData;

  // Modular Station & Provisioning Hook
  const station = useHelpDeskStation({
    ownWhiteId,
    isMasterAdmin,
    activeEnterpriseBlindId,
    selectedTenantBlindId,
    currentEnterpriseName,
    setCurrentEnterpriseName,
    adminsList,
    appsList,
    availableCategories,
    setAvailableCategories,
    selectedAppId,
    setSelectedAppId,
    selectedOrgId,
    setSelectedOrgId,
    selectedCatIds,
    setSelectedCatIds,
    selectedAdminId,
    setSelectedAdminId,
    language: currentLanguage,
    getLabel,
    formatWhiteId,
    formatAppId,
    getCategoryLabel,
    setConfirmSheet,
    loadConsoleData,
    loadData,
    CURRENT_APP_ID,
  });

  const {
    tenantLogoUri,
    setTenantLogoUri,
    tenantLogoAlign,
    setTenantLogoAlign,
    tenantCustomFields,
    setTenantCustomFields,
    tenantCatalog,
    setTenantCatalog,
  } = station;

  tenantStationRef.current = {
    setTenantLogoUri,
    setTenantLogoAlign,
    setTenantCustomFields,
    setTenantCatalog,
    getTenantCustomFields: () => tenantCustomFields,
  };

  // Modular Ticket Governance Hook
  const governance = useHelpDeskGovernance({
    ownWhiteId,
    adminRole,
    isAdmin,
    isMasterAdmin,
    isFounder,
    activeEnterpriseBlindId,
    selectedTenantBlindId,
    currentEnterpriseName,
    selectedTicket,
    setSelectedTicket,
    setTickets,
    advancedFeaturesConfig,
    language: currentLanguage,
    getLabel,
    formatWhiteId,
    setConfirmSheet,
    handleBackToList,
    loadData,
    loadConsoleData,
    setAssigningTicket: (station as any).setAssigningTicket,
    setNewAdminIdInput: (station as any).setNewAdminIdInput,
    setSuggestPrefixIndex: (station as any).setSuggestPrefixIndex,
    setSuggestCount: (station as any).setSuggestCount,
    setNewAdminAliasInput: (station as any).setNewAdminAliasInput,
    setAssignAppId: (station as any).setAssignAppId,
    setAssignCatId: (station as any).setAssignCatId,
    setAddAdminModalVisible: (station as any).setAddAdminModalVisible,
  });

  const {
    handleTicketMenuPress,
    handleTicketLongPress,
    showDigitalCleanProposal,
    handleStartSelfDestruct,
    handleCancelSelfDestruct,
  } = governance;

  showDigitalCleanProposalRef.current = showDigitalCleanProposal;

  const isHelpCommand = composeMessage.trim().toLowerCase() === '/help';

  const handleUserAskQuestion = () => {
    setReplyFocused(true);
  };

  // Sıfır-Polling Kuralı (KURAL 7): Boşta arka plan veya ön plan polling döngüsü çalıştırılmaz.
  // Uzak masaüstü ve çağrı uyandırmaları FCM Push (WhiteDeskMessagingService) üzerinden yürütülür.

  const handleRemoteDesktopPress = useCallback(() => {
    if (!selectedTicket) return;

    const sess = remoteDesktopService.getSession();
    if (sess && sess.status === 'active' && String(sess.ticketId) === String(selectedTicket.id)) {
      remoteDesktopService.notify();
      return;
    }

    const callerWhiteId = WhiteDeskCrypto.generateBlindId(ownWhiteId || '');
    const callerAlias = customAlias || (isAdmin ? t('helpdesk.support_specialist') : t('helpdesk.user'));

    let targetWhiteId = selectedTicket.user_blind_id || selectedTicket.user_white_id || '';
    const ownBlind = callerWhiteId.toLowerCase();

    const isSelf = (id?: string) => {
      if (!id) return false;
      const b = WhiteDeskCrypto.generateBlindId(id.trim()).toLowerCase();
      return b === ownBlind;
    };

    if (!targetWhiteId || isSelf(targetWhiteId)) {
      const clientMsg = [...ticketMessages].reverse().find(m => {
        const sender = ((m as any).sender_blind_id || m.sender_white_id || '').trim();
        return !m.is_admin && sender && !isSelf(sender);
      });
      if (clientMsg) {
        targetWhiteId = (clientMsg as any).sender_blind_id || clientMsg.sender_white_id || '';
      }
    }

    const ticketCreatedBy = (selectedTicket as any).created_by;
    if ((!targetWhiteId || isSelf(targetWhiteId)) && ticketCreatedBy && !isSelf(ticketCreatedBy)) {
      targetWhiteId = ticketCreatedBy;
    }
    if (targetWhiteId) {
      targetWhiteId = WhiteDeskCrypto.generateBlindId(targetWhiteId);
    }

    setConfirmSheet({
      visible: true,
      title: t('helpdesk.remote_desktop_title'),
      description: t('helpdesk.remote_desktop_request_confirm', { ticketId: selectedTicket.id }),
      actionText: t('helpdesk.send_request_btn'),
      actionColor: '#2563EB',
      cancelText: t('helpdesk.cancel'),
      onCancel: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        console.warn('[RemoteDesktop] startAdminOffer ticketId:', selectedTicket.id, 'targetWhiteId:', targetWhiteId, 'caller:', callerWhiteId);
        await remoteDesktopService.startAdminOffer(
          String(selectedTicket.id),
          callerAlias,
          targetWhiteId,
          callerWhiteId
        );
      },
    });
  }, [selectedTicket, ownWhiteId, customAlias, isAdmin, t, setConfirmSheet, ticketMessages]);

  const modalsContainerProps = useHelpDeskModalsProps({
    language: (language === 'tr' ? 'tr' : 'en'),
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
    harvestModalVisible,
    setHarvestModalVisible,
    auditModalVisible,
    setAuditModalVisible,

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
    adminsList,
    orgsList,
    appsList,
    selectedTenantBlindId,
    onSelectTenant: async (blindId: string) => {
      setSelectedTenantBlindId(blindId);
      const matched = tenantsList.find(t => t.enterprise_blind_id === blindId);
      const targetName = matched?.name || '';
      if (targetName) setCurrentEnterpriseName(targetName);

      // 🛑 KESİN VE KIRILAMAZ FİRMA İZOLASYONU: Telsiz ve ses servislerini anında yeni firmaya kilitle!
      if (blindId && blindId !== 'all') {
        setActiveEnterpriseBlindId(blindId);
        handleSetPttTenantId(blindId);
        if (targetName) handleSetPttTenantName(targetName);
        voiceCallService.setActiveEnterpriseBlindId(blindId);
        NotificationService.setOwnTenantId(blindId);
      }

      await loadConsoleData(blindId);
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER VIEWS WITH CLEAN SHARED CONTAINER
  // ─────────────────────────────────────────────────────────────────────────────
  if (currentView === 'compose') {
    return (
      <View style={styles.screenContainer}>
        <TicketComposeView
          safeTop={safeTop}
          keyboardHeight={keyboardHeight}
          composeScrollRef={composeScrollRef}
          composeSubject={composeSubject}
          setComposeSubject={setComposeSubject}
          composeMessage={composeMessage}
          setComposeMessage={setComposeMessage}
          composeCategory={composeCategory}
          setComposeCategory={setComposeCategory}
          availableCategories={availableCategories}
          attachedFile={attachedFile}
          setAttachedFile={setAttachedFile}
          attachedFiles={attachedFiles}
          onRemoveAttachedFile={handleRemoveAttachedFile}
          isSendActive={isSendActive}
          sending={sending}
          language={language}
          getLabel={getLabel}
          onBack={handleBackToList}
          onPickCamera={handlePickCamera}
          onPickGallery={handlePickGallery}
          onPickDocument={handlePickDocument}
          onCreateTicket={handleCreateTicket}
          customFields={tenantCustomFields}
          customFieldValues={customFieldValues}
          setCustomFieldValues={setCustomFieldValues}
          catalog={tenantCatalog}
          supportTicketTarget={escalationTarget}
          isHelpCommand={isHelpCommand}
          isAdmin={isAdmin}
          isFounder={isFounder}
          enterpriseName={currentEnterpriseName}
          isCreatingDiscussion={isCreatingDiscussion}
          attachDiagnostics={attachDiagnostics}
          setAttachDiagnostics={setAttachDiagnostics}
        />
        <HelpDeskModalsContainer {...modalsContainerProps} />
        {slaToast?.visible && (
          <View style={styles.slaToastContainer}>
            <View style={styles.slaToastDot} />
            <Text style={styles.slaToastText} numberOfLines={2}>
              {t('helpdesk.sla_delayed_transferred_toast', { ticketId: slaToast.ticketId })}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: DETAIL VIEW (THREAD MESSAGES) — FLUID & RESPONSIVE
  // ─────────────────────────────────────────────────────────────────────────────
  if (currentView === 'detail' && selectedTicket) {
    return (
      <View style={styles.screenContainer}>
        <TicketDetailView
          safeTop={safeTop}
          keyboardHeight={keyboardHeight}
          insetsBottom={insets.bottom}
          scrollY={scrollY}
          messagesScrollRef={messagesScrollRef}
          selectedTicket={selectedTicket}
          ticketMessages={ticketMessages}
          ownWhiteId={ownWhiteId}
          isAdmin={isAdmin}
          customAlias={customAlias}
          editingMessage={editingMessage}
          setEditingMessage={setEditingMessage}
          replyText={replyText}
          setReplyText={setReplyText}
          replyFocused={replyFocused}
          setReplyFocused={setReplyFocused}
          attachedFile={attachedFile}
          setAttachedFile={setAttachedFile}
          attachedFiles={attachedFiles}
          onRemoveAttachedFile={handleRemoveAttachedFile}
          onSetAttachedFiles={setAttachedFiles}
          sending={sending}
          language={language}
          getLabel={getLabel}
          formatWhiteId={formatWhiteId}
          formatAppId={formatAppId}
          formatTicketDate={formatTicketDate}
          getCategoryLabel={getCategoryLabel}
          showResolutionCheck={shouldShowResolutionCheck}
          isAutoClosed={isTicketAutoClosed}
          isSecondReminder={isTicketSecondReminder}
          onResolutionClose={handleUserCloseTicket}
          onResolutionAsk={handleUserAskQuestion}
          onBack={handleBackToList}
          onToggleStatus={handleToggleStatus}
          onTicketLongPress={handleTicketLongPress}
          onTicketMenuPress={handleTicketMenuPress}
          onOpenDocument={handleOpenDocument}
          onPreviewImage={handlePreviewImage}
          onPickCamera={handlePickCamera}
          onPickGallery={handlePickGallery}
          onPickDocument={handlePickDocument}
          onCallPress={handleCallPress}
          onPttPress={handlePttPress}
          onReplyTicket={ticketState.isTransferMode ? ticketState.handleSendTransfer : handleReplyTicket}
          showVoiceCall={effectiveVoiceCall}
          showPushToTalk={effectivePushToTalk}
          onOpenRating={() => handleOpenRating(selectedTicket)}
          onStartSelfDestruct={() => handleStartSelfDestruct(selectedTicket)}
          onCancelSelfDestruct={() => handleCancelSelfDestruct(selectedTicket)}
          onInspectDiagnostics={handleInspectDiagnostics}
          attachDiagnostics={attachDiagnostics}
          setAttachDiagnostics={setAttachDiagnostics}
          onMainMenuPress={() => setAdminMenuVisible(true)}
          onRemoteDesktopPress={handleRemoteDesktopPress}
          showRemoteDesktop={advancedFeaturesConfig?.remoteDesktop?.enabled !== false}
          userRemoteDesktopEnabled={userAdvancedPrefs?.remoteDesktopEnabled !== false}
          userRemoteDesktopScope={userAdvancedPrefs?.remoteDesktopScope || 'in_app'}
          isTransferMode={ticketState.isTransferMode}
          selectedTransferAdmin={ticketState.selectedTransferAdmin}
          transferSearchText={ticketState.transferSearchText}
          setTransferSearchText={ticketState.setTransferSearchText}
          transferBottomSheetVisible={ticketState.transferBottomSheetVisible}
          setTransferBottomSheetVisible={ticketState.setTransferBottomSheetVisible}
          enterpriseAdminsList={ticketState.enterpriseAdminsList}
          onSelectTransferAdmin={ticketState.handleSelectTransferAdmin}
          onCancelTransfer={ticketState.handleCancelTransfer}
          onSendTransfer={ticketState.handleSendTransfer}
          onAcceptTransfer={ticketState.handleAcceptTransfer}
          onOpenReject={ticketState.handleOpenReject}
          rejectModalVisible={ticketState.rejectModalVisible}
          setRejectModalVisible={ticketState.setRejectModalVisible}
          rejectReason={ticketState.rejectReason}
          setRejectReason={ticketState.setRejectReason}
          onConfirmReject={ticketState.handleConfirmReject}
          isInspectMode={ticketState.isInspectMode}
          setIsInspectMode={ticketState.setIsInspectMode}
          onTriggerWhisperAt={ticketState.handleTriggerWhisperAt}
          onTakeOverTicket={ticketState.handleTakeOverTicket}
        />
        <HelpDeskModalsContainer {...modalsContainerProps} />
        {slaToast?.visible && (
          <View style={styles.slaToastContainer}>
            <View style={styles.slaToastDot} />
            <Text style={styles.slaToastText} numberOfLines={2}>
              {t('helpdesk.sla_delayed_transferred_toast', { ticketId: slaToast.ticketId })}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: LIST VIEW (MAIN FLUID DASHBOARD)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screenContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

      {/* 50% SEMI-TRANSPARENT STATUS BAR OVERLAY (HELPDESK EXCLUSIVE) */}
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

      {/* FLUID LIST CONTENT */}
      <Animated.ScrollView
        key="helpdesk-list-scroll"
        ref={listScrollRef}
        style={[
          StyleSheet.absoluteFillObject,
          isSearchActive ? { bottom: keyboardHeight } : null,
        ]}
        contentContainerStyle={[
          styles.scrollContainerFluid,
          {
            paddingTop: isSearchActive ? safeTop + 6 : safeTop + 10,
            paddingBottom: isSearchActive ? 8 : 40 + Math.max(insets.bottom, 16),
            flexGrow: isSearchActive ? 1 : undefined,
            justifyContent: isSearchActive ? 'flex-end' : undefined,
          }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (isSearchActive) {
            listScrollRef.current?.scrollToEnd({ animated: false });
          }
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl 
            refreshing={loading} 
            onRefresh={loadData} 
            tintColor="#3B82F6" 
            colors={['#3B82F6']} 
            progressViewOffset={safeTop + 40}
          />
        }
      >
        {/* WHITEDESK LOGO (SOLA YANAŞIK - BİLET DETAY EKRANI İLE BİREBİR AYNI) */}
        {!isSearchActive && (
          <View style={[styles.scrollLogoRow, { alignItems: 'flex-start' }]}>
            {tenantLogoUri ? (
              <TenantLogo
                uri={tenantLogoUri}
                autoSize={true}
                maxHeight={76}
                align="left"
              />
            ) : (
              <Text
                style={[
                  styles.logoText,
                  { textAlign: 'left' },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                WhiteDesk
              </Text>
            )}
          </View>
        )}

        {/* TOP ACTION BUTTONS ROW (Samsung geri oku ve kapı çıkış ikonu kaldırıldı; çıkış 3 nokta menüsünde) */}
        {!isSearchActive && (
          <View style={[styles.topBackHeaderRow, { justifyContent: 'flex-end' }]}>
            {/* Right action buttons: Approvals Badge + Admin Guide (?) + Refresh icon + Scanner + 3-Dot Menu */}
            <View style={styles.headerButtonlessActions}>
              {isAdmin && pendingApprovals.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.refreshRoundBtn,
                    { marginRight: 8, backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }
                  ]}
                  onPress={() => setApprovalsModalVisible(true)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <UserCheck size={16} color="#D97706" strokeWidth={2} />
                  <View style={styles.pendingBadgeCircle}>
                    <Text style={styles.pendingBadgeCircleText}>{pendingApprovals.length}</Text>
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.refreshRoundBtn}
                onPress={() => (navigation as any).navigate('WhiteDeskScanner')}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ScanLine size={16} color="#475569" strokeWidth={2} />
              </TouchableOpacity>

              {/* 3 NOKTA MENÜSÜ: TÜM KULLANICILAR VE YÖNETİCİLER İÇİN */}
              <TouchableOpacity
                style={[
                  styles.refreshRoundBtn,
                  {
                    marginLeft: 8,
                    backgroundColor: isAdmin ? '#EFF6FF' : '#F8FAFC',
                    borderColor: isAdmin ? '#BFDBFE' : '#E2E8F0',
                  },
                ]}
                onPress={() => setAdminMenuVisible(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MoreVertical size={16} color={isAdmin ? '#2563EB' : '#475569'} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* WHITE PANEL CONTAINER (MODULAR TICKET LIST VIEW) */}
        <TicketListView
          isSearchActive={isSearchActive}
          onSearchFocusChange={setSearchFocused}
          isAdmin={isAdmin}
          isFounder={isFounder}
          isMasterAdmin={isMasterAdmin}
          isGlobalAdmin={adminRole === 'global_admin'}
          currentEnterpriseName={currentEnterpriseName || ''}
          customAlias={customAlias}
          onIdentifyPress={() => {
            setIdentityInput(customAlias || '');
            setIdentityModalVisible(true);
          }}
          onNewTicketPress={() => {
            setIsCreatingDiscussion(false);
            if (adminRole === 'global_admin') {
              setEscalationTarget('thewhite');
              setComposeCategory('internal_admin_ticket');
            } else if (isAdmin) {
              setEscalationTarget('global_admin');
              setComposeCategory('internal_admin_ticket');
            } else {
              setEscalationTarget('none');
            }
            setCurrentView('compose');
          }}
          onNewDiscussionPress={() => {
            setIsCreatingDiscussion(true);
            setEscalationTarget('none');
            setCurrentView('compose');
          }}
          ticketSearchQuery={ticketSearchQuery}
          setTicketSearchQuery={setTicketSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          filteredTickets={filteredTickets}
          openTicketDetail={openTicketDetail}
          handleTicketLongPress={handleTicketLongPress}
          getLabel={getLabel}
          formatWhiteId={formatWhiteId}
          formatAppId={formatAppId}
          formatTicketDate={formatTicketDate}
          getCategoryLabel={getCategoryLabel}
          language={language}
          onAdminSupportTicketPress={
            isAdmin && !isMasterAdmin && !isFounder && !(currentEnterpriseName && (currentEnterpriseName.toLowerCase().includes('thewhite') || currentEnterpriseName.toLowerCase().includes('the white')))
              ? () => {
                  setIsCreatingDiscussion(false);
                  setEscalationTarget('thewhite');
                  setComposeCategory('internal_admin_ticket');
                  setCurrentView('compose');
                }
              : undefined
          }
          onTicketMenuPress={handleTicketMenuPress}
          onFilterPress={() => setFilterModalVisible(true)}
          hasActiveFilters={hasActiveHierarchyFilters}
          filterTenantBlindId={filterTenantBlindId}
          setFilterTenantBlindId={setFilterTenantBlindId}
          filterOrgId={filterOrgId}
          setFilterOrgId={setFilterOrgId}
          filterAppId={filterAppId}
          setFilterAppId={setFilterAppId}
          filterCategoryId={filterCategoryId}
          setFilterCategoryId={setFilterCategoryId}
          tenantsList={tenantsList}
          orgsList={orgsList}
          appsList={appsList}
          onResetHierarchyFilters={handleResetHierarchyFilters}
          showRadioBroadcastBar={
            Boolean(advancedFeaturesConfig?.pushToTalk?.radioEnabled ?? advancedFeaturesConfig?.pushToTalk?.enabled) &&
            (isAdmin || Boolean(advancedFeaturesConfig?.pushToTalk?.allowGroupBroadcast ?? advancedFeaturesConfig?.pushToTalk?.allowUserPtt))
          }
          onRadioBroadcastPress={handleOrgGroupPttPress}
          buttonTheme={buttonTheme}
        />
      </Animated.ScrollView>

      {/* UNIFIED MODULAR MODALS CONTAINER */}
      <HelpDeskModalsContainer {...modalsContainerProps} />
      {slaToast?.visible && (
        <View style={styles.slaToastContainer}>
          <View style={styles.slaToastDot} />
          <Text style={styles.slaToastText} numberOfLines={2}>
            {t('helpdesk.sla_delayed_transferred_toast', { ticketId: slaToast.ticketId })}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLUID & RESPONSIVE STYLESHEET (ADAPTS 100% TO TABLET AND PHONE)
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F4F7FA',
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
  scrollContainerFluid: {
    paddingHorizontal: 4,
    width: '100%',
    alignSelf: 'stretch',
  },
  scrollLogoRow: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
    width: '100%',
  },
  topBackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  headerButtonlessActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshRoundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  pendingBadgeCircle: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  pendingBadgeCircleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  slaToastContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 99999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  slaToastDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginRight: 10,
  },
  slaToastText: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    lineHeight: 18,
  },
});
