import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Keyboard, Alert, BackHandler, AppState, DeviceEventEmitter } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import * as Sharing from 'expo-sharing';
import {
  helpDeskService,
  HelpDeskTicket,
  HelpDeskMessage,
  HelpDeskCategory,
  TicketStatus,
  AdminEntry,
  OrgEntry,
  AppCatEntry,
  TenantEntry,
  ApprovalEntry,
  CURRENT_APP_ID,
} from '../../../services/helpDeskService';
import { SafeSecureStore } from '../../../services/storageService';
import { CryptoService } from '../../../services/cryptoService';
import { WhiteDeskCrypto } from '../../../whitedesk-sdk';
import { NotificationService } from '../../../services/notificationService';
import { piiSanitizer } from '../../../services/piiSanitizer';
import { diagnosticRecorder, DiagnosticPackage } from '../../../services/diagnosticRecorder';
import { apiClient } from '../../../services/apiClient';
import { keystoreTicketVault } from '../../../services/keystoreTicketVault';
import { voiceCallService } from '../../../services/voiceCallService';
import {
  AttachedFile,
  AdvancedFeaturesConfig,
  UserAdvancedPreferences,
  DEFAULT_ADVANCED_FEATURES_CONFIG,
  DEFAULT_USER_ADVANCED_PREFERENCES,
  CustomFieldDef,
  CatalogItem,
} from '../types';
import { useTicketFilter } from './useTicketFilter';

export interface UseHelpDeskTicketStateProps {
  language: 'tr' | 'en';
  ownWhiteId: string;
  setOwnWhiteId: (id: string) => void;
  isAdmin: boolean;
  setIsAdmin: (val: boolean) => void;
  adminRole: 'founder' | 'global_admin' | 'admin' | 'none';
  setAdminRole: (role: 'founder' | 'global_admin' | 'admin' | 'none') => void;
  isFounder: boolean;
  setIsFounder: (val: boolean) => void;
  isMasterAdmin: boolean;
  setIsMasterAdmin: (val: boolean) => void;
  customAlias: string | null;
  setCustomAlias: (alias: string | null) => void;
  activeEnterpriseBlindId: string;
  setActiveEnterpriseBlindId: (id: string) => void;
  currentEnterpriseName: string;
  setCurrentEnterpriseName: (name: string) => void;
  selectedTenantBlindId: string;
  setSelectedTenantBlindId: (id: string) => void;
  setPttTenantId: (id: string) => void;
  setPttTenantName: (name: string) => void;
  setAdminsList: React.Dispatch<React.SetStateAction<AdminEntry[]>>;
  setOrgsList: React.Dispatch<React.SetStateAction<OrgEntry[]>>;
  setAppsList: React.Dispatch<React.SetStateAction<AppCatEntry[]>>;
  setTenantsList: React.Dispatch<React.SetStateAction<TenantEntry[]>>;
  setPendingApprovals: React.Dispatch<React.SetStateAction<ApprovalEntry[]>>;
  setTenantLogoUri?: (uri: string | null) => void;
  setTenantLogoAlign?: (align: 'left' | 'center' | 'right') => void;
  advancedFeaturesConfig: AdvancedFeaturesConfig;
  setAdvancedFeaturesConfig: React.Dispatch<React.SetStateAction<AdvancedFeaturesConfig>>;
  userAdvancedPrefs: UserAdvancedPreferences;
  setUserAdvancedPrefs: React.Dispatch<React.SetStateAction<UserAdvancedPreferences>>;
  setTicketClientPrefs: React.Dispatch<React.SetStateAction<UserAdvancedPreferences>>;
  tenantCustomFields?: CustomFieldDef[];
  getTenantCustomFields?: () => CustomFieldDef[];
  setTenantCustomFields?: React.Dispatch<React.SetStateAction<CustomFieldDef[]>>;
  setTenantCatalog?: React.Dispatch<React.SetStateAction<CatalogItem[]>>;
  attachedFiles: AttachedFile[];
  setAttachedFiles: React.Dispatch<React.SetStateAction<AttachedFile[]>>;
  formatAttachmentForSend: (files: any[]) => { data: string; name: string; type: string } | null;
  exportOrgPubCertificate?: (claimResult: any) => Promise<void>;
  loadConsoleData?: () => Promise<void>;
  setConfirmSheet: React.Dispatch<React.SetStateAction<any>>;
  showDigitalCleanProposal?: (ticket: HelpDeskTicket) => void;
  scrollY: any;
  messagesScrollRef: React.RefObject<any>;
  listScrollRef: React.RefObject<any>;
  routeParams?: any;
}

export function useHelpDeskTicketState({
  language,
  ownWhiteId,
  setOwnWhiteId,
  isAdmin,
  setIsAdmin,
  adminRole,
  setAdminRole,
  isFounder,
  setIsFounder,
  isMasterAdmin,
  setIsMasterAdmin,
  customAlias,
  setCustomAlias,
  activeEnterpriseBlindId,
  setActiveEnterpriseBlindId,
  currentEnterpriseName,
  setCurrentEnterpriseName,
  selectedTenantBlindId,
  setSelectedTenantBlindId,
  setPttTenantId,
  setPttTenantName,
  setAdminsList,
  setOrgsList,
  setAppsList,
  setTenantsList,
  setPendingApprovals,
  setTenantLogoUri,
  setTenantLogoAlign,
  advancedFeaturesConfig,
  setAdvancedFeaturesConfig,
  userAdvancedPrefs,
  setUserAdvancedPrefs,
  setTicketClientPrefs,
  tenantCustomFields,
  getTenantCustomFields,
  setTenantCustomFields,
  setTenantCatalog,
  attachedFiles,
  setAttachedFiles,
  formatAttachmentForSend,
  exportOrgPubCertificate,
  loadConsoleData,
  setConfirmSheet,
  showDigitalCleanProposal,
  scrollY,
  messagesScrollRef,
  listScrollRef,
  routeParams,
}: UseHelpDeskTicketStateProps) {
  // Navigation & View States
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'compose'>('list');
  const [tickets, setTickets] = useState<HelpDeskTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<HelpDeskTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<HelpDeskMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Message & Reply States
  const [replyText, setReplyText] = useState('');
  const [editingMessage, setEditingMessage] = useState<HelpDeskMessage | null>(null);

  // Compose View States
  const [composeSubject, setComposeSubject] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [composeCategory, setComposeCategory] = useState<string>('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [availableCategories, setAvailableCategories] = useState<HelpDeskCategory[]>([]);
  const [isCreatingDiscussion, setIsCreatingDiscussion] = useState(false);
  const [escalationTarget, setEscalationTarget] = useState<'none' | 'thewhite' | 'global_admin'>('none');

  // Rating & Action Targets
  const [ratingTargetTicket, setRatingTargetTicket] = useState<HelpDeskTicket | null>(null);
  const [feedbackDialogVisible, setFeedbackDialogVisible] = useState(false);

  // Diagnostic (BlackBox & Replay) States
  const [attachDiagnostics, setAttachDiagnostics] = useState<boolean>(false);
  const [diagnosticModalVisible, setDiagnosticModalVisible] = useState<boolean>(false);
  const [selectedDiagnosticData, setSelectedDiagnosticData] = useState<DiagnosticPackage | null>(null);
  const [targetDiagnosticTicket, setTargetDiagnosticTicket] = useState<HelpDeskTicket | null>(null);
  const dismissedResolutionChecks = useRef<Set<string>>(new Set());

  // Ticket Transfer (İlet) States
  const [isTransferMode, setIsTransferMode] = useState<boolean>(false);
  const [adminSelectorMode, setAdminSelectorMode] = useState<'transfer' | 'whisper'>('transfer');
  const [selectedTransferAdmin, setSelectedTransferAdmin] = useState<{ white_id: string; blind_id: string; alias: string; role?: string } | null>(null);
  const [transferSearchText, setTransferSearchText] = useState<string>('');
  const [transferBottomSheetVisible, setTransferBottomSheetVisible] = useState<boolean>(false);
  const [rejectModalVisible, setRejectModalVisible] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isInspectMode, setIsInspectMode] = useState<boolean>(false);
  const [enterpriseAdminsList, setEnterpriseAdminsList] = useState<Array<{ white_id: string; blind_id: string; alias: string; role: string; assigned_tickets_count: number }>>([]);

  // Ticket Hierarchy & Search Filtering Hook
  const {
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
  } = useTicketFilter({ tickets, isFounder });

  // Return to ticket list
  const handleBackToList = useCallback(() => {
    Keyboard.dismiss();
    diagnosticRecorder.recordNavigation('Ana Ekran (Bilet Listesi)');
    setSelectedTicket(null);
    setIsCreatingDiscussion(false);
    setEscalationTarget('none');
    setAttachDiagnostics(false);
    scrollY.setValue(0);
    setCurrentView('list');
    setTimeout(() => {
      listScrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 10);
  }, [scrollY, listScrollRef]);

  // Record view changes (compose / detail / list)
  useEffect(() => {
    if (currentView === 'compose') {
      diagnosticRecorder.recordNavigation('Yeni Bilet Oluşturma Ekranı', {
        mod: isCreatingDiscussion ? 'Yönetici Tartışması' : 'Destek Talebi',
      });
    } else if (currentView === 'list') {
      diagnosticRecorder.recordNavigation('Ana Ekran (Bilet Listesi)');
    }
  }, [currentView, isCreatingDiscussion]);

  // Load identity and tickets
  const loadData = useCallback(async (opts?: { overrideTenantId?: string; overrideTenantName?: string }) => {
    try {
      const myId = await helpDeskService.getOwnWhiteId();
      setOwnWhiteId(myId);

      const [
        alias,
        localRole,
        localEntName,
        localEntBlindId,
        userEntName,
        userEntBlindId,
        localAdminOrgId,
        localUserOrgId,
        activeTenantBlindId,
      ] = await Promise.all([
        helpDeskService.getCustomAlias(),
        SafeSecureStore.getItemAsync('inwhite_helpdesk_admin_role'),
        SafeSecureStore.getItemAsync('inwhite_helpdesk_admin_enterprise_name'),
        SafeSecureStore.getItemAsync('inwhite_helpdesk_admin_enterprise_blind_id'),
        SafeSecureStore.getItemAsync('inwhite_helpdesk_user_enterprise_name'),
        SafeSecureStore.getItemAsync('inwhite_helpdesk_user_org_blind_id'),
        SafeSecureStore.getItemAsync('inwhite_helpdesk_admin_org_id'),
        SafeSecureStore.getItemAsync('inwhite_helpdesk_user_org_id'),
        SafeSecureStore.getItemAsync('inwhite_helpdesk_active_tenant_blind_id'),
      ]);

      const paramRole = routeParams?.role;
      const paramEntName = routeParams?.enterpriseName;

      const isExplicitUser = (paramRole as string) === 'user';
      let effectiveRole: 'founder' | 'global_admin' | 'admin' | 'none' = 'none';

      if (isExplicitUser) {
        effectiveRole = 'none';
      } else if (paramRole && paramRole !== 'none' && (paramRole as string) !== 'user') {
        effectiveRole = paramRole;
      } else if (localRole && localRole !== 'none') {
        effectiveRole = localRole as any;
      }

      const admin = effectiveRole !== 'none';
      setIsAdmin(admin);
      setAdminRole(effectiveRole);
      const isFounderUser = effectiveRole === 'founder' || (effectiveRole as string) === 'master';
      setIsFounder(isFounderUser);
      setIsMasterAdmin(isFounderUser || effectiveRole === 'global_admin');
      if (alias) setCustomAlias(alias);

      // Self-Healing Firma ve Grup İzolasyonu: Eğer yerel kasada tenant blind ID veya org ID yoksa DB'den otomatik çöz
      let resolvedLocalEntBlindId = localEntBlindId;
      let resolvedLocalEntName = localEntName;
      let resolvedUserEntBlindId = userEntBlindId;
      let resolvedUserEntName = userEntName;
      let resolvedOrgId = admin ? (localAdminOrgId || null) : (localUserOrgId || null);

      if ((!resolvedLocalEntBlindId && !resolvedUserEntBlindId) || !resolvedOrgId) {
        if (myId && myId !== 'anonymous') {
          if (admin) {
            const admEnt = await helpDeskService.getAdminEnterprise(myId);
            if (admEnt.enterpriseBlindId) {
              resolvedLocalEntBlindId = admEnt.enterpriseBlindId;
              if (admEnt.enterpriseName) resolvedLocalEntName = admEnt.enterpriseName;
            }
            if (admEnt.orgId) resolvedOrgId = admEnt.orgId;
          } else {
            const usrEnt = await helpDeskService.getUserEnterprise(myId);
            if (usrEnt.enterpriseBlindId) {
              resolvedUserEntBlindId = usrEnt.enterpriseBlindId;
              if (usrEnt.enterpriseName) resolvedUserEntName = usrEnt.enterpriseName;
            }
            if (usrEnt.orgId) resolvedOrgId = usrEnt.orgId;
          }
        }
      }

      const resolvedEntName = opts?.overrideTenantName || paramEntName || resolvedLocalEntName || resolvedUserEntName || (isFounderUser ? 'TheWhite Enterprises' : 'Whitechain');
      setCurrentEnterpriseName(resolvedEntName);
      setPttTenantName(resolvedEntName);

      const targetTenantId = opts?.overrideTenantId || (selectedTenantBlindId !== 'all' ? selectedTenantBlindId : (isFounderUser ? 'blind_11fcac28453c3eaa3a06a5db6caf4ca1' : resolvedLocalEntBlindId || resolvedUserEntBlindId || activeTenantBlindId || undefined));
      if (targetTenantId) {
        setActiveEnterpriseBlindId(targetTenantId);
        setPttTenantId(targetTenantId);
        NotificationService.setOwnTenantId(targetTenantId);
        voiceCallService.setActiveEnterpriseBlindId(targetTenantId);
      }

      if (resolvedOrgId && resolvedOrgId !== 'all' && resolvedOrgId !== '*') {
        voiceCallService.setActiveOrgId(resolvedOrgId);
        NotificationService.setOwnOrgId(resolvedOrgId);
      }

      const tenantFilter = isFounderUser ? (selectedTenantBlindId !== 'all' ? selectedTenantBlindId : null) : targetTenantId;

      // ⚡ 0ms ANINDA YEREL KASA OKUMASI: Uzak SQL sorgularını beklemeden biletleri anında ekrana bas
      const list = await helpDeskService.getTickets(myId, admin, CURRENT_APP_ID, tenantFilter, effectiveRole);
      setTickets(list);
      setLoading(false);

      // Kurumsal logo, kategori ve yapılandırma verilerini arka planda paralel yükle
      const [savedLogo, savedAlign, advConfig, userPrefs, cats, orgs, apps, tenantMeta] = await Promise.all([
        helpDeskService.getTenantLogo(targetTenantId || 'default').catch(() => null),
        helpDeskService.getTenantLogoAlign(targetTenantId || 'default').catch(() => 'left'),
        helpDeskService.getAdvancedFeaturesConfig(targetTenantId).catch(() => DEFAULT_ADVANCED_FEATURES_CONFIG),
        helpDeskService.getUserAdvancedPreferences(myId).catch(() => DEFAULT_USER_ADVANCED_PREFERENCES),
        helpDeskService.getCategories({ enterpriseBlindId: targetTenantId || undefined }).catch(() => []),
        helpDeskService.getOrgsList(targetTenantId).catch(() => []),
        helpDeskService.getAppCatList(targetTenantId).catch(() => []),
        helpDeskService.getTenantCustomFieldsAndCatalog(targetTenantId).catch(() => ({ customFields: [], catalog: [] })),
      ]);

      if (savedLogo) setTenantLogoUri?.(savedLogo);
      if (savedAlign) setTenantLogoAlign?.(savedAlign as any);
      if (advConfig) setAdvancedFeaturesConfig(advConfig);
      if (userPrefs) setUserAdvancedPrefs(userPrefs);
      if (tenantMeta) {
        if (tenantMeta.customFields) setTenantCustomFields?.(tenantMeta.customFields);
        if (tenantMeta.catalog) setTenantCatalog?.(tenantMeta.catalog);
      }
      if (cats && cats.length > 0) {
        setAvailableCategories(cats);
        setComposeCategory(prev => prev && cats.some(c => c.id === prev) ? prev : (cats[0].id || ''));
      }
      if (orgs && orgs.length > 0) setOrgsList(orgs);
      if (apps && apps.length > 0) setAppsList(apps);

      setTimeout(() => {
        void (async () => {
          try {
            if (myId) {
              void NotificationService.init(myId);
            }
            const hasChanges = await helpDeskService.syncRelayInbox(myId, tenantFilter, effectiveRole);
            if (hasChanges) {
              const updated = await helpDeskService.getTickets(myId, admin, CURRENT_APP_ID, tenantFilter, effectiveRole);
              setTickets(updated);
            }
            // SLA Engine Check (Hem kullanıcı hem admin için)
            const slaRes = await helpDeskService.checkAndEscalateTickets({ ownWhiteId: myId });
            if (slaRes && slaRes.escalatedCount > 0) {
              const updated = await helpDeskService.getTickets(myId, admin, CURRENT_APP_ID, tenantFilter, effectiveRole);
              setTickets(updated);
            }
            if (admin) {
              const [freshRole, approvals] = await Promise.all([
                helpDeskService.getAdminRole(myId).catch(() => effectiveRole),
                helpDeskService.getPendingApprovals(effectiveRole, selectedTenantBlindId !== 'all' ? selectedTenantBlindId : undefined).catch(() => []),
              ]);
              if (freshRole && freshRole !== effectiveRole) {
                setAdminRole(freshRole);
                setIsAdmin(freshRole !== 'none');
              }
              if (approvals) setPendingApprovals(approvals);

              // 💓 Start admin heartbeat loop to Cloudflare D1 roster
              const adminEnt = await helpDeskService.getAdminEnterprise(myId).catch(() => ({ enterpriseBlindId: 'default' }));
              const entBlindId = adminEnt?.enterpriseBlindId || selectedTenantBlindId || 'default';
              const adminAlias = await helpDeskService.getAdminAlias(myId).catch(() => null);
              helpDeskService.startAdminHeartbeat({
                whiteId: myId,
                enterpriseBlindId: entBlindId,
                alias: adminAlias || undefined,
              });
            }
            if (isFounderUser || admin) {
              const tenants = await helpDeskService.getAllTenants().catch(() => []);
              if (tenants && tenants.length > 0) setTenantsList(tenants);
            }
          } catch (bgErr) {
            console.warn('[useHelpDeskTicketState] Background idle sync warning:', bgErr);
          }
        })();
      }, 1500);

    } catch (err) {
      console.warn('[useHelpDeskTicketState] loadData error:', err);
      setLoading(false);
    }
  }, [
    routeParams,
    selectedTenantBlindId,
    setOwnWhiteId,
    setIsAdmin,
    setAdminRole,
    setIsFounder,
    setIsMasterAdmin,
    setCustomAlias,
    setCurrentEnterpriseName,
    setPttTenantName,
    setActiveEnterpriseBlindId,
    setPttTenantId,
    setTenantLogoUri,
    setTenantLogoAlign,
    setAdvancedFeaturesConfig,
    setUserAdvancedPrefs,
    setTenantCustomFields,
    setTenantCatalog,
    setOrgsList,
    setAppsList,
    setPendingApprovals,
    setTenantsList,
  ]);

  // 0-Polling FCM Push & AppState Foreground Wakeup Listener:
  // Yeni destek bileti veya mesajı bildirimi (FCM Push) geldiğinde ya da uygulama ön plana alındığında D1 havuzunu anında senkronize eder
  useEffect(() => {
    const syncNow = async (incomingTicketId?: string) => {
      try {
        const myId = ownWhiteId || (await helpDeskService.getOwnWhiteId());
        if (!myId || myId === 'anonymous') return;
        const tenantFilter = isFounder
          ? (selectedTenantBlindId !== 'all' ? selectedTenantBlindId : null)
          : (activeEnterpriseBlindId || undefined);
        const hasChanges = await helpDeskService.syncRelayInbox(myId, tenantFilter, adminRole);
        const updatedTickets = await helpDeskService.getTickets(myId, isAdmin, CURRENT_APP_ID, tenantFilter, adminRole);
        setTickets(updatedTickets);

        const activeTicketId = selectedTicket?.id || incomingTicketId;
        if (currentView === 'detail' && selectedTicket && (!incomingTicketId || incomingTicketId === selectedTicket.id || hasChanges)) {
          const msgs = await helpDeskService.getTicketMessages(selectedTicket.id);
          setTicketMessages(msgs);
          const refreshedTicket = updatedTickets.find(t => t.id === selectedTicket.id);
          if (refreshedTicket) {
            setSelectedTicket(refreshedTicket);
          }
          setTimeout(() => {
            messagesScrollRef.current?.scrollToEnd({ animated: true });
          }, 150);
        } else if (activeTicketId && hasChanges) {
          const refreshedTicket = updatedTickets.find(t => t.id === activeTicketId);
          if (refreshedTicket && selectedTicket?.id === activeTicketId) {
            setSelectedTicket(refreshedTicket);
          }
        }
      } catch (err) {
        console.warn('[useHelpDeskTicketState] FCM push / foreground sync warning:', err);
      }
    };

    const pushSub = DeviceEventEmitter.addListener('onHelpDeskPushReceived', (event: any) => {
      void syncNow(event?.ticketId);
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void syncNow();
      }
    });

    return () => {
      pushSub.remove();
      appStateSub.remove();
    };
  }, [
    ownWhiteId,
    isAdmin,
    isFounder,
    adminRole,
    selectedTenantBlindId,
    activeEnterpriseBlindId,
    currentView,
    selectedTicket,
    messagesScrollRef,
  ]);

  // Open ticket detail and fetch messages
  const openTicketDetail = useCallback(async (ticket: HelpDeskTicket) => {
    diagnosticRecorder.recordNavigation(`Bilet Detayı (#${ticket.id})`, {
      biletNo: `#${ticket.id}`,
      durum: ticket.status,
      uygulama: ticket.app_id || 'whitedesk',
    });
    setSelectedTicket(ticket);
    setEditingMessage(null);
    setReplyText('');
    setAttachedFiles([]);
    setAttachDiagnostics(false);
    scrollY.setValue(0);
    setCurrentView('detail');
    try {
      const ticketTenantId = ticket.enterprise_blind_id || activeEnterpriseBlindId || 'default';
      const cfg = await helpDeskService.getAdvancedFeaturesConfig(ticketTenantId);
      if (cfg) setAdvancedFeaturesConfig(cfg);

      const msgs = await helpDeskService.getTicketMessages(ticket.id);
      setTicketMessages(msgs);
      if (isAdmin) {
        const clientTargetId = ticket.user_white_id || ticket.user_blind_id;
        if (clientTargetId) {
          const clientPrefs = await helpDeskService.getUserAdvancedPreferences(clientTargetId);
          setTicketClientPrefs(clientPrefs);
        }
      } else {
        const myPrefs = await helpDeskService.getUserAdvancedPreferences(ownWhiteId);
        setUserAdvancedPrefs(myPrefs);
        const adminTargetId = ticket.assigned_admin_blind_id;
        if (adminTargetId) {
          const admPrefs = await helpDeskService.getUserAdvancedPreferences(adminTargetId);
          setTicketClientPrefs(admPrefs);
        } else {
          setTicketClientPrefs(DEFAULT_USER_ADVANCED_PREFERENCES);
        }
      }
      setTimeout(() => {
        messagesScrollRef.current?.scrollToEnd({ animated: false });
        checkTicketResolutionStatus(ticket, msgs);
      }, 300);
    } catch (err) {
      console.warn('[useHelpDeskTicketState] openTicketDetail error:', err);
    }
  }, [
    activeEnterpriseBlindId,
    isAdmin,
    ownWhiteId,
    scrollY,
    messagesScrollRef,
    setAdvancedFeaturesConfig,
    setTicketClientPrefs,
    setUserAdvancedPrefs,
    setAttachedFiles,
  ]);

  // Resolution status check
  const checkTicketResolutionStatus = useCallback((ticket: HelpDeskTicket, msgs: HelpDeskMessage[]) => {
    if (isAdmin || isFounder || isMasterAdmin || adminRole !== 'none') return;
    if (ticket.status === 'closed') return;
    if (dismissedResolutionChecks.current.has(ticket.id)) return;

    const ownBlind = ownWhiteId ? WhiteDeskCrypto.generateBlindId(ownWhiteId).toLowerCase() : '';
    const ticketOwnerBlind = WhiteDeskCrypto.generateBlindId(ticket.user_blind_id || ticket.user_white_id || '').toLowerCase();
    const isOwner = Boolean(ownBlind) && Boolean(ticketOwnerBlind) && ticketOwnerBlind === ownBlind;
    if (!isOwner) return;
    if (!msgs || msgs.length === 0) return;

    const lastMsg = msgs[msgs.length - 1];
    if (!lastMsg || !lastMsg.is_admin) return;

    const lastReplyTime = Number(lastMsg.created_at);
    const TWENTY_FOUR_HOURS_MS = 24 * 3600 * 1000;
    const isOver24Hours = (Date.now() - lastReplyTime) >= TWENTY_FOUR_HOURS_MS;

    if (isOver24Hours) {
      const anyTicket = ticket as any;
      const ticketRef = anyTicket.ticket_code 
        ? `#${anyTicket.ticket_code}` 
        : (ticket.subject ? `«${ticket.subject}»` : `#${ticket.id.slice(0, 8)}`);
      const isTr = language === 'tr';

      setConfirmSheet({
        visible: true,
        title: isTr 
          ? `${ticketRef} Çözüldü mü?`
          : `Has ${ticketRef} Been Resolved?`,
        description: isTr
          ? 'Destek uzmanımızın yanıtı sorununuzu çözdüyse bileti kapatabilir, ek sorunuz varsa görüşmeye devam edebilirsiniz.'
          : 'If our support specialist resolved your issue, you can close this ticket; if you have further questions, you can continue.',
        actionText: isTr ? 'Çözüldü, Kapat' : 'Resolved, Close',
        cancelText: isTr ? 'Devam Et' : 'Continue',
        actionColor: '#10B981',
        onAction: async () => {
          setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
          await helpDeskService.setTicketStatus(ticket.id, 'closed');
          setSelectedTicket(prev => prev ? { ...prev, status: 'closed' } : null);
          if (!isAdmin) {
            setTimeout(() => {
              showDigitalCleanProposal?.(ticket);
            }, 350);
          }
        },
        onCancel: () => {
          dismissedResolutionChecks.current.add(ticket.id);
          setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
          if (currentView !== 'detail' || selectedTicket?.id !== ticket.id) {
            void openTicketDetail(ticket);
          }
        },
      });
    }
  }, [
    isAdmin,
    isFounder,
    isMasterAdmin,
    adminRole,
    ownWhiteId,
    language,
    currentView,
    selectedTicket,
    openTicketDetail,
    setConfirmSheet,
    showDigitalCleanProposal,
  ]);

  // Process ticket closure with cryptographic receipt and TTL self-destruction
  const processTicketClosure = useCallback(async (ticketId: string, currentMsgs?: HelpDeskMessage[]) => {
    try {
      if (advancedFeaturesConfig.proofOfIntegrity?.enabled) {
        const msgs = (currentMsgs && currentMsgs.length > 0)
          ? currentMsgs
          : await helpDeskService.getTicketMessages(ticketId);

        const msgHashes = msgs.map(m => {
          const content = `${m.id}:${m.sender_white_id}:${m.created_at}:${m.message || ''}`;
          return CryptoService.calculateMerkleRoot([content]);
        });

        const myBlindId = ownWhiteId ? WhiteDeskCrypto.generateBlindId(ownWhiteId) : 'client_node';
        const { receiptJson } = await CryptoService.generateProofOfIntegrityReceipt({
          ticketId,
          tenantBlindId: activeEnterpriseBlindId || 'default',
          clientBlindId: myBlindId,
          messageHashes: msgHashes,
        });

        const autoDownload = Boolean(
          advancedFeaturesConfig.proofOfIntegrity.autoDownloadReceipt &&
          userAdvancedPrefs.autoDownloadReceipt !== false
        );

        if (autoDownload) {
          const filename = `whitedesk_receipt_${ticketId.substring(0, 8)}.json`;
          const filePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
          await ReactNativeBlobUtil.fs.writeFile(filePath, receiptJson, 'utf8');
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(filePath, {
              mimeType: 'application/json',
              dialogTitle: language === 'tr' ? 'Değişmezlik Makbuzu (.json)' : 'Proof of Integrity Receipt (.json)',
              UTI: 'public.json',
            });
          }
        }
      }

      if (advancedFeaturesConfig.selfDestruct?.enabled) {
        const retentionHours = advancedFeaturesConfig.selfDestruct.retentionAfterResolvedHours;
        if (retentionHours === 0) {
          await CryptoService.destroyTicketSessionKey(ticketId);
        } else {
          const expiryMs = Date.now() + retentionHours * 3600 * 1000;
          await SafeSecureStore.setItemAsync(`ticket_ttl_expiry_${ticketId}`, expiryMs.toString());
        }
      }
    } catch (e) {
      console.warn('[useHelpDeskTicketState] processTicketClosure error:', e);
    }
  }, [advancedFeaturesConfig, userAdvancedPrefs, ownWhiteId, activeEnterpriseBlindId, language]);

  // Toggle ticket status (Close / Reopen)
  const handleToggleStatus = useCallback(async () => {
    if (!selectedTicket) return;
    const nextStatus: TicketStatus = selectedTicket.status === 'closed' ? 'open' : 'closed';
    diagnosticRecorder.recordAction(
      nextStatus === 'closed' ? `Bilet Kapatıldı (#${selectedTicket.id})` : `Bilet Yeniden Açıldı (#${selectedTicket.id})`,
      { biletNo: `#${selectedTicket.id}`, yeniDurum: nextStatus }
    );
    await helpDeskService.setTicketStatus(selectedTicket.id, nextStatus);
    if (nextStatus === 'closed') {
      void processTicketClosure(selectedTicket.id, ticketMessages);
    }
    setSelectedTicket(prev => prev ? { ...prev, status: nextStatus } : null);
    void loadData();
  }, [selectedTicket, ticketMessages, processTicketClosure, loadData]);

  // Create new ticket
  const handleCreateTicket = useCallback(async () => {
    if (!composeSubject.trim() || !composeMessage.trim() || sending) return;
    setSending(true);
    try {
      diagnosticRecorder.recordAction('Yeni Bilet Gönderimi Başlatıldı', {
        kategori: composeCategory || 'genel',
        ekSayisi: attachedFiles.length + (attachDiagnostics ? 1 : 0),
        sistemTanisi: attachDiagnostics ? 'Eklendi' : 'Yok',
      });
      const msgText = composeMessage.trim();

      const adminMatch = msgText.match(/^admin\s+([a-zA-Z0-9_\-\.]+)/i);
      if (adminMatch && adminMatch[1]) {
        const claimResult = await helpDeskService.handleAdminClaimCommand(ownWhiteId, adminMatch[1]);
        if (claimResult.success && claimResult.orgPub) {
          await exportOrgPubCertificate?.(claimResult);
        }
        if (claimResult.role === 'founder') {
          setIsAdmin(true);
          setIsFounder(true);
          setIsMasterAdmin(true);
          setAdminRole('founder');
        } else if (claimResult.role === 'global_admin') {
          setIsAdmin(true);
          setIsMasterAdmin(true);
          setAdminRole('global_admin');
        } else if (claimResult.role === 'admin') {
          setIsAdmin(true);
          setAdminRole('admin');
        }

        if (claimResult.enterpriseBlindId) {
          setActiveEnterpriseBlindId(claimResult.enterpriseBlindId);
          setCurrentEnterpriseName(claimResult.enterpriseName || '');
          setPttTenantId?.(claimResult.enterpriseBlindId);
          setPttTenantName?.(claimResult.enterpriseName || '');
          try {
            voiceCallService.setActiveEnterpriseBlindId(claimResult.enterpriseBlindId);
            voiceCallService.setActiveOrgId('');
            NotificationService.setOwnTenantId(claimResult.enterpriseBlindId);
            NotificationService.setOwnOrgId('');
          } catch {}
        }

        await helpDeskService.createTicket(
          composeSubject.trim() || `[İşlem] ${claimResult.enterpriseName || 'WhiteDesk'}`,
          claimResult.message,
          null,
          claimResult.appName?.toLowerCase() || helpDeskService.appId,
          'account'
        );
        setComposeSubject('');
        setComposeMessage('');
        setAttachedFiles([]);
        setCurrentView('list');
        setSending(false);
        void loadData();
        void loadConsoleData?.();
        return;
      }

      const userMatch = msgText.match(/^user\s+([a-zA-Z0-9_\-\.]+)/i);
      if (userMatch && userMatch[1]) {
        const joinResult = await helpDeskService.handleUserJoinCommand(ownWhiteId, userMatch[1]);
        if (joinResult.enterpriseBlindId) {
          setActiveEnterpriseBlindId(joinResult.enterpriseBlindId);
          setCurrentEnterpriseName(joinResult.enterpriseName || '');
          setPttTenantId?.(joinResult.enterpriseBlindId);
          setPttTenantName?.(joinResult.enterpriseName || '');
          try {
            voiceCallService.setActiveEnterpriseBlindId(joinResult.enterpriseBlindId);
            NotificationService.setOwnTenantId(joinResult.enterpriseBlindId);
          } catch {}
        }
        await helpDeskService.createTicket(
          composeSubject.trim() || `[Bağlantı] ${joinResult.enterpriseName || 'Kurumsal'}`,
          joinResult.message,
          null,
          joinResult.appId || helpDeskService.appId,
          'account'
        );
        setComposeSubject('');
        setComposeMessage('');
        setAttachedFiles([]);
        setCurrentView('list');
        setSending(false);
        void loadData();
        return;
      }

      let finalSubject = composeSubject.trim();
      let finalMessage = composeMessage.trim();
      const fields = getTenantCustomFields?.() || tenantCustomFields || [];
      const filledFieldKeys = Object.keys(customFieldValues).filter(k => customFieldValues[k]?.trim());
      if (filledFieldKeys.length > 0) {
        const detailsLines = filledFieldKeys.map(k => {
          const fieldDef = fields.find(f => f.key === k || f.label === k);
          const label = fieldDef?.label || k;
          return `• ${label}: ${customFieldValues[k].trim()}`;
        });
        finalMessage += `\n\n--- 📋 [Kayıt Bilgileri] ---\n${detailsLines.join('\n')}`;
      }

      // Cihazda Otomatik Hassas Veri Maskeleme (Client-Side PII Redaction)
      if (userAdvancedPrefs?.piiRedactionEnabled !== false) {
        finalSubject = piiSanitizer.sanitize(finalSubject).sanitizedText;
        finalMessage = piiSanitizer.sanitize(finalMessage).sanitizedText;
      }

      let filesToProcess = [...attachedFiles];
      if (attachDiagnostics) {
        const diagPackage = diagnosticRecorder.exportPackage();
        filesToProcess.push({
          name: 'diagnostics.whitedesk',
          type: 'diagnostic' as any,
          mimeType: 'application/x-whitedesk-diagnostics',
          data: JSON.stringify(diagPackage),
        });
      }
      const fileToSend = formatAttachmentForSend(filesToProcess);

      if (isAdmin && isCreatingDiscussion) {
        await helpDeskService.createDiscussion(
          finalSubject, 
          finalMessage, 
          fileToSend,
          helpDeskService.appId,
          'merkez',
          selectedTenantBlindId !== 'all' ? selectedTenantBlindId : undefined
        );
        setIsCreatingDiscussion(false);
      } else if (escalationTarget === 'thewhite') {
        await helpDeskService.createTicket(
          finalSubject,
          finalMessage,
          fileToSend,
          'whitedesk',
          'root_support'
        );
      } else if (escalationTarget === 'global_admin') {
        await helpDeskService.createTicket(
          finalSubject,
          finalMessage,
          fileToSend,
          helpDeskService.appId,
          'internal_admin_ticket'
        );
      } else {
        const cleanCat = composeCategory && composeCategory.toLowerCase() !== 'voice' ? composeCategory : (availableCategories[0]?.id || undefined);
        await helpDeskService.createTicket(
          finalSubject, 
          finalMessage, 
          fileToSend,
          helpDeskService.appId,
          cleanCat,
          false,
          activeEnterpriseBlindId || undefined
        );
      }
      setComposeSubject('');
      setComposeMessage('');
      setCustomFieldValues({});
      setAttachedFiles([]);
      setAttachDiagnostics(false);
      setComposeCategory(availableCategories[0]?.id || '');
      setEscalationTarget('none');
      setCurrentView('list');
      setSending(false);
      void loadData();
    } catch (err) {
      console.warn('[useHelpDeskTicketState] handleCreateTicket error:', err);
    } finally {
      setSending(false);
    }
  }, [
    composeSubject,
    composeMessage,
    sending,
    ownWhiteId,
    exportOrgPubCertificate,
    setIsAdmin,
    setIsFounder,
    setIsMasterAdmin,
    setAdminRole,
    setAttachedFiles,
    loadData,
    loadConsoleData,
    customFieldValues,
    tenantCustomFields,
    attachedFiles,
    formatAttachmentForSend,
    isAdmin,
    isCreatingDiscussion,
    selectedTenantBlindId,
    escalationTarget,
    composeCategory,
    availableCategories,
    activeEnterpriseBlindId,
  ]);

  // Reply or Edit ticket message
  const handleReplyTicket = useCallback(async () => {
    if (!selectedTicket || (!replyText.trim() && attachedFiles.length === 0) || sending) return;
    const rawText = replyText.trim();
    const textToSend = userAdvancedPrefs?.piiRedactionEnabled !== false
      ? piiSanitizer.sanitize(rawText).sanitizedText
      : rawText;
    let filesToProcess = [...attachedFiles];
    diagnosticRecorder.recordAction(`Bilet Yanıtı Gönderildi (#${selectedTicket.id})`, {
      biletNo: `#${selectedTicket.id}`,
      ekSayisi: attachedFiles.length + (attachDiagnostics ? 1 : 0),
      sistemTanisi: attachDiagnostics ? 'Eklendi' : 'Yok',
    });
    if (attachDiagnostics) {
      const diagPackage = diagnosticRecorder.exportPackage();
      filesToProcess.push({
        name: 'diagnostics.whitedesk',
        type: 'diagnostic' as any,
        mimeType: 'application/x-whitedesk-diagnostics',
        data: JSON.stringify(diagPackage),
      });
      setAttachDiagnostics(false);
    }
    const fileToSend = formatAttachmentForSend(filesToProcess);

    setReplyText('');
    setAttachedFiles([]);
    setSending(true);

    try {
      const adminMatch = textToSend.match(/^admin\s+([a-zA-Z0-9_\-\.]+)/i);
      if (adminMatch && adminMatch[1]) {
        const claimResult = await helpDeskService.handleAdminClaimCommand(ownWhiteId, adminMatch[1]);
        if (claimResult.success && claimResult.orgPub) {
          await exportOrgPubCertificate?.(claimResult);
          setIsAdmin(true);
          setIsMasterAdmin(true);
        }
        await helpDeskService.replyToTicket(selectedTicket.id, claimResult.message, true, null);
        const msgs = await helpDeskService.getLocalTicketMessages(selectedTicket.id);
        setTicketMessages(msgs);
        setSending(false);
        void loadData();
        void loadConsoleData?.();
        setTimeout(() => {
          messagesScrollRef.current?.scrollToEnd({ animated: true });
        }, 50);
        return;
      }

      const userMatch = textToSend.match(/^user\s+([a-zA-Z0-9_\-\.]+)/i);
      if (userMatch && userMatch[1]) {
        const joinResult = await helpDeskService.handleUserJoinCommand(ownWhiteId, userMatch[1]);
        await helpDeskService.replyToTicket(selectedTicket.id, joinResult.message, false, null);
        const msgs = await helpDeskService.getLocalTicketMessages(selectedTicket.id);
        setTicketMessages(msgs);
        setSending(false);
        void loadData();
        setTimeout(() => {
          messagesScrollRef.current?.scrollToEnd({ animated: true });
        }, 50);
        return;
      }

      if (editingMessage) {
        await helpDeskService.editMessage(editingMessage.id, textToSend, fileToSend, selectedTicket.id);
        setEditingMessage(null);
      } else {
        await helpDeskService.replyToTicket(selectedTicket.id, textToSend, isAdmin, fileToSend);
        setSelectedTicket(prev => prev ? { ...prev, status: isAdmin ? 'answered' : 'open' } : null);
      }

      const msgs = await helpDeskService.getLocalTicketMessages(selectedTicket.id);
      setTicketMessages(msgs);
      setSending(false);

      setTimeout(() => {
        messagesScrollRef.current?.scrollToEnd({ animated: true });
      }, 50);

      void loadData();
    } catch (err) {
      console.warn('[useHelpDeskTicketState] handleReplyTicket error:', err);
    } finally {
      setSending(false);
    }
  }, [
    selectedTicket,
    replyText,
    attachedFiles,
    sending,
    formatAttachmentForSend,
    setAttachedFiles,
    ownWhiteId,
    exportOrgPubCertificate,
    setIsAdmin,
    setIsMasterAdmin,
    loadData,
    loadConsoleData,
    messagesScrollRef,
    editingMessage,
    isAdmin,
    attachDiagnostics,
    setAttachDiagnostics,
  ]);

  const areRequiredFieldsFilled = useMemo(() => {
    const fields = getTenantCustomFields?.() || tenantCustomFields || [];
    return fields
      .filter(f => f.required)
      .every(f => (customFieldValues[f.key] || '').trim().length > 0);
  }, [tenantCustomFields, getTenantCustomFields, customFieldValues]);

  const isHelpCommand = composeMessage.trim().toLowerCase() === '/help';
  const isSendActive = !isHelpCommand && composeSubject.trim().length > 0 && composeMessage.trim().length > 0 && areRequiredFieldsFilled;

  // Rating Submit & Dialog Handlers
  const handleOpenRating = useCallback((ticket?: HelpDeskTicket | null) => {
    const tkt = ticket || selectedTicket;
    if (!tkt) return;
    setRatingTargetTicket(tkt);
    setFeedbackDialogVisible(true);
  }, [selectedTicket]);

  const handleFeedbackSubmit = useCallback(async (score: number, comment: string) => {
    if (!ratingTargetTicket) return;
    try {
      const adminId = ratingTargetTicket.assigned_admin_blind_id || 'admin_genel';
      await helpDeskService.submitRatingWithDelay(
        ratingTargetTicket.id,
        activeEnterpriseBlindId || 'default',
        adminId,
        score,
        comment,
        ratingTargetTicket.org_id,
        0
      );
      setFeedbackDialogVisible(false);
      setRatingTargetTicket(null);
      void loadData();
    } catch (e) {
      console.warn('[useHelpDeskTicketState] handleFeedbackSubmit error:', e);
    }
  }, [ratingTargetTicket, activeEnterpriseBlindId, loadData]);

  const handleFeedbackClose = useCallback(() => {
    setFeedbackDialogVisible(false);
    setRatingTargetTicket(null);
  }, []);

  const handleUserCloseTicket = useCallback(async () => {
    if (!selectedTicket) return;
    try {
      await helpDeskService.resolveTicketByUser(
        selectedTicket.id,
        'Kullanıcı Çözüm Onayı'
      );
      setSelectedTicket(prev => prev ? { ...prev, status: 'closed', resolution_note: 'Kullanıcı Çözüm Onayı' } : null);
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'closed', resolution_note: 'Kullanıcı Çözüm Onayı' } : t));
      handleOpenRating(selectedTicket);
    } catch (e) {
      console.warn('[useHelpDeskTicketState] handleUserCloseTicket error:', e);
    }
  }, [selectedTicket, handleOpenRating]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RESOLUTION CHECK & CSAT RATING LOGIC
  // ─────────────────────────────────────────────────────────────────────────────
  const hasAdminReplied = useMemo(() => {
    if (!selectedTicket) return false;
    if (selectedTicket.last_admin_reply_at) return true;
    return ticketMessages.some(m => m.is_admin);
  }, [selectedTicket, ticketMessages]);

  const isTicketAutoClosed = useMemo(() => {
    if (!selectedTicket) return false;
    if (selectedTicket.resolution_note && selectedTicket.resolution_note.includes('Otomatik')) return true;
    if (selectedTicket.status !== 'closed' && selectedTicket.last_admin_reply_at) {
      const elapsed = Date.now() - selectedTicket.last_admin_reply_at;
      return elapsed >= 48 * 3600 * 1000;
    }
    return false;
  }, [selectedTicket]);

  const isTicketSecondReminder = useMemo(() => {
    if (!selectedTicket || isTicketAutoClosed) return false;
    if (selectedTicket.status !== 'closed' && selectedTicket.last_admin_reply_at) {
      const elapsed = Date.now() - selectedTicket.last_admin_reply_at;
      return elapsed >= 24 * 3600 * 1000;
    }
    return false;
  }, [selectedTicket, isTicketAutoClosed]);

  const shouldShowResolutionCheck = useMemo(() => {
    if (isAdmin || isFounder || isMasterAdmin || adminRole !== 'none' || !selectedTicket) return false;
    if (isTicketAutoClosed) return true;
    return selectedTicket.status !== 'closed' && hasAdminReplied;
  }, [isAdmin, isFounder, isMasterAdmin, adminRole, selectedTicket, isTicketAutoClosed, hasAdminReplied]);

  // Auto-close effect if 48h elapsed without user answering
  useEffect(() => {
    if (!isAdmin && selectedTicket && selectedTicket.status !== 'closed' && selectedTicket.last_admin_reply_at) {
      const elapsed = Date.now() - selectedTicket.last_admin_reply_at;
      if (elapsed >= 48 * 3600 * 1000) {
        void (async () => {
          await helpDeskService.resolveTicketByUser(
            selectedTicket.id,
            'Otomatik Kapanış (Zaman Aşımı)'
          );
          setSelectedTicket(prev => prev ? { ...prev, status: 'closed', resolution_note: 'Otomatik Kapanış (Zaman Aşımı)' } : null);
          setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'closed', resolution_note: 'Otomatik Kapanış (Zaman Aşımı)' } : t));
        })();
      }
    }
  }, [isAdmin, selectedTicket, activeEnterpriseBlindId]);

  // Sovereign D1 Relay Periodic Foreground Synchronization (Detail: 3.5s, List: 8s, Background: 0)
  useEffect(() => {
    if (!ownWhiteId || ownWhiteId === 'anonymous') return;
    const intervalMs = currentView === 'detail' ? 3500 : 8000;
    const syncTimer = setInterval(async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const tenantFilter = isFounder ? (selectedTenantBlindId !== 'all' ? selectedTenantBlindId : null) : (selectedTenantBlindId !== 'all' ? selectedTenantBlindId : activeEnterpriseBlindId);
        const hasChanges = await helpDeskService.syncRelayInbox(ownWhiteId, tenantFilter, adminRole);
        if (hasChanges) {
          const updated = await helpDeskService.getTickets(ownWhiteId, isAdmin, CURRENT_APP_ID, tenantFilter, adminRole);
          setTickets(updated);
          if (currentView === 'detail' && selectedTicket) {
            const freshMsgs = await helpDeskService.getLocalTicketMessages(selectedTicket.id);
            setTicketMessages(freshMsgs);
          }
        }
        // SLA Engine Check (Periyodik döngüde hem kullanıcı hem admin için)
        const slaRes = await helpDeskService.checkAndEscalateTickets({ ownWhiteId });
        if (slaRes && slaRes.escalatedCount > 0) {
          const updated = await helpDeskService.getTickets(ownWhiteId, isAdmin, CURRENT_APP_ID, tenantFilter, adminRole);
          setTickets(updated);
          if (currentView === 'detail' && selectedTicket) {
            const freshMsgs = await helpDeskService.getLocalTicketMessages(selectedTicket.id);
            setTicketMessages(freshMsgs);
          }
        }
      } catch {}
    }, intervalMs);
    return () => clearInterval(syncTimer);
  }, [ownWhiteId, isAdmin, isFounder, adminRole, selectedTenantBlindId, activeEnterpriseBlindId, currentView, selectedTicket?.id]);

  // Hardware Back Press
  useEffect(() => {
    const onBack = () => {
      if (currentView === 'detail' || currentView === 'compose') {
        handleBackToList();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [currentView, handleBackToList]);

  const handleInspectDiagnostics = useCallback(async (ticket: HelpDeskTicket, specificAttachment?: any) => {
    setTargetDiagnosticTicket(ticket);
    let rawData: any = null;
    if (specificAttachment?.data) {
      rawData = specificAttachment.data;
    } else if (specificAttachment && (specificAttachment.events || specificAttachment.device)) {
      setSelectedDiagnosticData(specificAttachment);
      setDiagnosticModalVisible(true);
      return;
    } else if (ticket.attachment_name?.includes('diagnostics.whitedesk') || ticket.attachment_type === 'diagnostic') {
      rawData = ticket.attachment_data || null;
    } else if (ticket.attachment_data) {
      try {
        const parsed = typeof ticket.attachment_data === 'string' ? JSON.parse(ticket.attachment_data) : ticket.attachment_data;
        if (Array.isArray(parsed)) {
          const found = parsed.find((f: any) => f.name?.includes('diagnostics.whitedesk') || f.type === 'diagnostic');
          if (found) rawData = found.data;
        } else if (parsed && (parsed.events || parsed.device)) {
          setSelectedDiagnosticData(parsed);
          setDiagnosticModalVisible(true);
          return;
        }
      } catch {}
    }

    if (!rawData) {
      try {
        const msgs = await helpDeskService.getLocalTicketMessages(ticket.id);
        for (let i = msgs.length - 1; i >= 0; i--) {
          const m = msgs[i];
          if (m.attachment_type === 'diagnostic' || m.attachment_name?.includes('diagnostics.whitedesk')) {
            if (m.attachment_data) {
              rawData = m.attachment_data;
              break;
            }
          }
          if (Array.isArray(m.attachments)) {
            const found = m.attachments.find((a: any) => a.type === 'diagnostic' || a.name?.includes('diagnostics.whitedesk'));
            if (found?.data) {
              rawData = found.data;
              break;
            }
          }
          if (m.attachment_data && typeof m.attachment_data === 'string' && m.attachment_data.startsWith('[')) {
            try {
              const parsed = JSON.parse(m.attachment_data);
              if (Array.isArray(parsed)) {
                const found = parsed.find((f: any) => f.name?.includes('diagnostics.whitedesk') || f.type === 'diagnostic');
                if (found?.data) {
                  rawData = found.data;
                  break;
                }
              }
            } catch {}
          }
        }
      } catch {}
    }

    if (rawData) {
      try {
        const pkg = typeof rawData === 'object' ? rawData : JSON.parse(rawData);
        setSelectedDiagnosticData(pkg);
        setDiagnosticModalVisible(true);
        return;
      } catch {}
    }

    // Canlı telemetri & olay akışını göster
    const livePkg = diagnosticRecorder.exportPackage();
    setSelectedDiagnosticData(livePkg);
    setDiagnosticModalVisible(true);
  }, []);

  const handleAttachDiagnostics = useCallback(async (ticket: HelpDeskTicket) => {
    try {
      diagnosticRecorder.recordAction(`Sistem Tanısı Mühürlendi (#${ticket.id})`, {
        biletNo: `#${ticket.id}`,
        iletim: 'Cloudflare R2 + D1 Relay',
      });
      const diagPackage = diagnosticRecorder.exportPackage();
      await helpDeskService.attachDiagnosticToTicket(ticket.id, diagPackage);
      await loadData();
      if (selectedTicket && selectedTicket.id === ticket.id) {
        const msgs = await helpDeskService.getLocalTicketMessages(ticket.id);
        setTicketMessages(msgs);
        setSelectedTicket(prev => prev ? {
          ...prev,
          attachment_name: 'diagnostics.whitedesk',
          attachment_type: 'diagnostic',
        } : null);
      }
    } catch (e) {
      console.warn('[useHelpDeskTicketState] handleAttachDiagnostics error:', e);
    }
  }, [loadData, selectedTicket]);

  const handleDeleteDiagnostics = useCallback(async (ticket: HelpDeskTicket) => {
    try {
      await helpDeskService.deleteTicketDiagnostics(ticket.id);
      await loadData();
      if (selectedTicket && selectedTicket.id === ticket.id) {
        const msgs = await helpDeskService.getLocalTicketMessages(ticket.id);
        setTicketMessages(msgs);
        setSelectedTicket(prev => prev ? {
          ...prev,
          attachment_name: null,
          attachment_type: null,
          attachment_data: null,
        } : null);
      }
    } catch (e) {
      console.warn('[useHelpDeskTicketState] handleDeleteDiagnostics error:', e);
    }
  }, [loadData, selectedTicket]);

  const handleStartTransfer = useCallback(async (ticket?: HelpDeskTicket) => {
    const tkt = ticket || selectedTicket;
    if (tkt) {
      if (!selectedTicket || selectedTicket.id !== tkt.id) {
        await openTicketDetail(tkt);
      }
    }
    setAdminSelectorMode('transfer');
    setIsTransferMode(true);
    setTransferBottomSheetVisible(true);
    try {
      const entAdmins = await helpDeskService.getEnterpriseAdmins(tkt?.enterprise_blind_id);
      const ownBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
      const list = [...entAdmins];
      const hasSelf = list.some(a => a.white_id === ownWhiteId || a.blind_id === ownBlindId);
      if (!hasSelf) {
        list.unshift({
          white_id: ownWhiteId,
          blind_id: ownBlindId,
          alias: (customAlias || 'Admin') + ' (Kendim - Test)',
          role: adminRole || 'admin',
          assigned_tickets_count: 0,
        });
      }
      setEnterpriseAdminsList(list);
    } catch (e) {
      console.warn('[useHelpDeskTicketState] handleStartTransfer fetch admins error:', e);
    }
  }, [selectedTicket, openTicketDetail, ownWhiteId, customAlias, adminRole]);

  const handleTriggerWhisperAt = useCallback(async () => {
    setAdminSelectorMode('whisper');
    setTransferBottomSheetVisible(true);
    try {
      const entAdmins = await helpDeskService.getEnterpriseAdmins(selectedTicket?.enterprise_blind_id);
      const ownBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
      const list = [...entAdmins];
      const hasSelf = list.some(a => a.white_id === ownWhiteId || a.blind_id === ownBlindId);
      if (!hasSelf) {
        list.unshift({
          white_id: ownWhiteId,
          blind_id: ownBlindId,
          alias: (customAlias || 'Admin') + ' (Kendim - Test)',
          role: adminRole || 'admin',
          assigned_tickets_count: 0,
        });
      }
      setEnterpriseAdminsList(list);
    } catch (e) {
      console.warn('[useHelpDeskTicketState] handleTriggerWhisperAt fetch admins error:', e);
    }
  }, [selectedTicket, ownWhiteId, customAlias, adminRole]);

  const handleCancelTransfer = useCallback(async (ticket?: HelpDeskTicket) => {
    const tkt = ticket || selectedTicket;
    if (tkt?.transfer_status === 'pending') {
      try {
        await helpDeskService.cancelTicketTransfer(tkt.id);
        setSelectedTicket(prev => (prev && prev.id === tkt.id) ? {
          ...prev,
          transfer_status: null,
          transfer_target_blind_id: null,
          transfer_target_alias: null,
          transfer_note: null,
        } : prev);
        const msgs = await helpDeskService.getLocalTicketMessages(tkt.id);
        setTicketMessages(msgs);
        void loadData();
      } catch (err) {
        console.warn('[useHelpDeskTicketState] handleCancelTransfer error:', err);
      }
    }
    setIsTransferMode(false);
    setSelectedTransferAdmin(null);
    setTransferBottomSheetVisible(false);
  }, [selectedTicket, loadData]);

  const handleSelectTransferAdmin = useCallback(async (admin: { white_id: string; blind_id: string; alias: string; role?: string }) => {
    if (adminSelectorMode === 'whisper') {
      const cleanAlias = admin.alias.replace(/\s*\(Kendim - Test\)/i, '').trim();
      setReplyText(prev => {
        const trimmed = prev.endsWith('@') ? prev.slice(0, -1) : prev;
        return `${trimmed}@[${cleanAlias}] `;
      });
      setTransferBottomSheetVisible(false);
    } else {
      try {
        const tenantId = selectedTicket?.enterprise_blind_id || activeEnterpriseBlindId;
        const loginSettings = await helpDeskService.getTenantLoginSettings(tenantId);
        if (!loginSettings.allowNameEntry) {
          Alert.alert('Transfer Yapılamaz', 'Ad soyad girişi kapalı olduğunda bilet transferi yapılamaz.');
          setTransferBottomSheetVisible(false);
          return;
        }
      } catch {}
      setSelectedTransferAdmin(admin);
      setTransferBottomSheetVisible(false);
    }
  }, [adminSelectorMode, selectedTicket, activeEnterpriseBlindId]);

  const handleSendTransfer = useCallback(async () => {
    if (!selectedTicket || !selectedTransferAdmin) return;
    try {
      const tenantId = selectedTicket.enterprise_blind_id || activeEnterpriseBlindId;
      const loginSettings = await helpDeskService.getTenantLoginSettings(tenantId);
      if (!loginSettings.allowNameEntry) {
        Alert.alert('Transfer Yapılamaz', 'Ad soyad girişi kapalı olduğunda bilet transferi yapılamaz.');
        return;
      }
    } catch {}
    setSending(true);
    try {
      const rawText = replyText.trim();
      const filesToProcess = [...attachedFiles];
      const fileToSend = formatAttachmentForSend(filesToProcess);
      await helpDeskService.requestTicketTransfer(
        selectedTicket.id,
        selectedTransferAdmin.blind_id,
        selectedTransferAdmin.alias,
        rawText || undefined,
        fileToSend
      );
      setReplyText('');
      setAttachedFiles([]);
      setIsTransferMode(false);
      setSelectedTransferAdmin(null);
      setSelectedTicket(prev => prev ? {
        ...prev,
        transfer_status: 'pending',
        transfer_target_blind_id: selectedTransferAdmin.blind_id,
        transfer_target_alias: selectedTransferAdmin.alias,
        transfer_note: rawText || null,
      } : null);
      const msgs = await helpDeskService.getLocalTicketMessages(selectedTicket.id);
      setTicketMessages(msgs);
      void loadData();
    } catch (err) {
      console.warn('[useHelpDeskTicketState] handleSendTransfer error:', err);
    } finally {
      setSending(false);
    }
  }, [selectedTicket, selectedTransferAdmin, replyText, attachedFiles, formatAttachmentForSend, setAttachedFiles, loadData]);

  const handleAcceptTransfer = useCallback(async () => {
    if (!selectedTicket) return;
    setSending(true);
    try {
      await helpDeskService.acceptTicketTransfer(selectedTicket.id);
      const ownBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
      setSelectedTicket(prev => prev ? {
        ...prev,
        assigned_admin_blind_id: ownBlindId,
        transfer_status: 'accepted',
        transferred_from_alias: prev.transfer_sender_alias || prev.transferred_from_alias,
      } : null);
      setIsInspectMode(false);
      const msgs = await helpDeskService.getLocalTicketMessages(selectedTicket.id);
      setTicketMessages(msgs);
      void loadData();
    } catch (err) {
      console.warn('[useHelpDeskTicketState] handleAcceptTransfer error:', err);
    } finally {
      setSending(false);
    }
  }, [selectedTicket, ownWhiteId, loadData]);

  const handleOpenReject = useCallback(() => {
    setRejectReason('');
    setRejectModalVisible(true);
  }, []);

  const handleConfirmReject = useCallback(async () => {
    if (!selectedTicket) return;
    setSending(true);
    try {
      await helpDeskService.rejectTicketTransfer(selectedTicket.id, rejectReason);
      setRejectModalVisible(false);
      setSelectedTicket(null);
      void loadData();
    } catch (err) {
      console.warn('[useHelpDeskTicketState] handleConfirmReject error:', err);
    } finally {
      setSending(false);
    }
  }, [selectedTicket, rejectReason, loadData]);

  // 3.0 Global Admin ve Kurucu İçin Bileti Devral (Take Over) ve Sunucudan Buharlaştır
  const handleTakeOverTicket = useCallback(async (ticket: HelpDeskTicket) => {
    try {
      if (ticket.relay_item_id) {
        await apiClient.confirmRelayAck(ticket.relay_item_id, ticket.relay_attachment_r2_key || undefined);
      }
      const myBlindId = ownWhiteId ? WhiteDeskCrypto.generateBlindId(ownWhiteId) : 'admin_node';
      const myAlias = customAlias || (isFounder ? 'TheWhite' : 'Yönetici');
      ticket.is_relay_pending = false;
      ticket.assigned_admin_blind_id = myBlindId;
      ticket.assigned_admin_name = myAlias;
      ticket.assigned_admin_alias = myAlias;
      if (ticket.status === 'revoked') {
        ticket.status = 'open';
      }
      ticket.updated_at = Date.now();
      await helpDeskService.setTicketStatus(ticket.id, ticket.status);
      await keystoreTicketVault.upsertTicket(ticket);
      const takeOverMsg: HelpDeskMessage = {
        id: 'msg_' + Math.random().toString(36).substring(2, 10),
        ticket_id: ticket.id,
        app_id: ticket.app_id || 'inwhite',
        sender_white_id: ownWhiteId,
        sender_alias: myAlias,
        sender_blind_id: myBlindId,
        is_admin: true,
        is_internal: true,
        visibility_level: 'internal',
        message: `⚡ [Devralındı] Bilet sunucudan (D1/R2) buharlaştırılarak @${myAlias} tarafından devralındı.`,
        created_at: Date.now(),
      };
      await keystoreTicketVault.appendMessage(ticket.id, takeOverMsg);
      setSelectedTicket({ ...ticket });
      const msgs = await helpDeskService.getTicketMessages(ticket.id);
      setTicketMessages(msgs);
      await loadData();
      Alert.alert(
        language === 'tr' ? 'Bilet Devralındı' : 'Ticket Taken Over',
        language === 'tr'
          ? 'Bilet başarıyla devralındı ve size zimmetlendi.'
          : 'Ticket successfully claimed and assigned to you.'
      );
    } catch (err) {
      console.warn('[useHelpDeskTicketState] handleTakeOverTicket error:', err);
      Alert.alert(
        language === 'tr' ? 'Hata' : 'Error',
        language === 'tr' ? 'Bilet devralınırken bir sorun oluştu.' : 'Failed to take over ticket.'
      );
    }
  }, [ownWhiteId, customAlias, isFounder, language, loadData]);

  return {
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
    setIsCreatingDiscussion,
    escalationTarget,
    setEscalationTarget,
    ratingTargetTicket,
    setRatingTargetTicket,
    feedbackDialogVisible,
    setFeedbackDialogVisible,
    // Ticket Filter states & actions
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
    // Handlers
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
    processTicketClosure,
    isSendActive,
    areRequiredFieldsFilled,
    shouldShowResolutionCheck,
    isTicketAutoClosed,
    isTicketSecondReminder,
    attachDiagnostics,
    setAttachDiagnostics,
    diagnosticModalVisible,
    setDiagnosticModalVisible,
    selectedDiagnosticData,
    setSelectedDiagnosticData,
    targetDiagnosticTicket,
    setTargetDiagnosticTicket,
    handleInspectDiagnostics,
    handleAttachDiagnostics,
    handleDeleteDiagnostics,
    // Ticket Transfer & Fısıltı
    isTransferMode,
    setIsTransferMode,
    selectedTransferAdmin,
    setSelectedTransferAdmin,
    transferSearchText,
    setTransferSearchText,
    transferBottomSheetVisible,
    setTransferBottomSheetVisible,
    rejectModalVisible,
    setRejectModalVisible,
    rejectReason,
    setRejectReason,
    isInspectMode,
    setIsInspectMode,
    enterpriseAdminsList,
    handleStartTransfer,
    handleTriggerWhisperAt,
    handleCancelTransfer,
    handleSelectTransferAdmin,
    handleSendTransfer,
    handleAcceptTransfer,
    handleOpenReject,
    handleConfirmReject,
    handleTakeOverTicket,
  };
}
