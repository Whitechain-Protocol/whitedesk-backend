import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  LayoutAnimation,
  UIManager,
  Animated,
  Image,
  Modal,
  Keyboard,
  BackHandler,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Headphones,
  Plus,
  ArrowRight,
  Send,
  CheckCircle2,
  Clock,
  Check,
  ChevronLeft,
  ChevronDown,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Camera,
  X,
  Edit3,
  Search,
  RotateCcw,
  MessageSquare,
  LogOut,
  Trash2,
  UserCheck,
  Layers,
  Tag,
  ShieldCheck,
  Shield,
  Star,
  Sparkles,
  Building2,
  HelpCircle,
  BookOpen,
  Bell,
  UserPlus,
  ScanLine,
  ChevronUp,
  Copy,
  Users,
  KeyRound,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { 
  helpDeskService, 
  HelpDeskTicket, 
  HelpDeskMessage, 
  TicketStatus,
  INWHITE_CATEGORIES,
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
import { useTranslation } from '../services/i18nService';
import helpdeskLang from '../locales/helpdeskLang.json';
import { BottomConfirmationSheet } from '../components/BottomConfirmationSheet';
import { HelpDeskHeader } from '../components/helpdesk/HelpDeskHeader';
import { TicketComposeView } from '../components/helpdesk/views/TicketComposeView';
import { TicketDetailView } from '../components/helpdesk/views/TicketDetailView';
import { TicketListView } from '../components/helpdesk/views/TicketListView';
import { TenantStationModal } from '../components/helpdesk/station/TenantStationModal';
import { AdminGuideModal } from '../components/helpdesk/modals/AdminGuideModal';
import { IdentityModal } from '../components/helpdesk/modals/IdentityModal';
import { ApprovalsModal } from '../components/helpdesk/modals/ApprovalsModal';
import { TicketActionModal } from '../components/helpdesk/modals/TicketActionModal';
import { AttachMenuModal } from '../components/helpdesk/modals/AttachMenuModal';
import { ImagePreviewModal } from '../components/helpdesk/modals/ImagePreviewModal';
import { AttachedFile, CustomFieldDef, CatalogItem } from '../components/helpdesk/types';
import { AdminBadge, tierFromCategory } from '../components/helpdesk/AdminBadge';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

const COSMIC_PREFIXES = [
  'Planet',
  'Orbit',
  'Cluster',
];

export default function HelpDeskScreen() {
  const { t: baseT, language } = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const getHelpDeskString = useCallback((key: string, params?: Record<string, string | number>): string => {
    const rawKey = key.replace(/^helpdesk\./, '');
    const currentLangDict = (helpdeskLang as Record<string, Record<string, string>>)[language];
    let val: string | undefined;
    if (currentLangDict && currentLangDict[rawKey]) {
      val = currentLangDict[rawKey];
    } else {
      const enDict = (helpdeskLang as Record<string, Record<string, string>>)['en'];
      if (enDict && enDict[rawKey]) {
        val = enDict[rawKey];
      }
    }
    if (val) {
      if (params) {
        Object.entries(params).forEach(([pKey, pVal]) => {
          val = val!.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
        });
      }
      return val;
    }
    return baseT(key, params);
  }, [baseT, language]);

  const t = getHelpDeskString;

  const getLabel = useCallback((key: string, tr: string, en: string): string => {
    if (key.startsWith('common.')) {
      const cVal = baseT(key);
      if (cVal && !cVal.includes('.') && cVal !== key) {
        return cVal;
      }
    }
    const localized = getHelpDeskString(key);
    if (localized && localized !== key && !localized.startsWith('helpdesk.')) {
      return localized;
    }
    return language === 'tr' ? tr : en;
  }, [baseT, getHelpDeskString, language]);

  const safeTop = Math.max(insets.top, StatusBar.currentHeight || 0, Platform.OS === 'android' ? 42 : 44);
  const headerTopOffset = safeTop + 14;

  const scrollY = useRef(new Animated.Value(0)).current;
  const messagesScrollRef = useRef<ScrollView>(null);
  const listScrollRef = useRef<ScrollView>(null);
  const composeScrollRef = useRef<ScrollView>(null);

  // Core States
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'compose'>('list');
  const [tickets, setTickets] = useState<HelpDeskTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<HelpDeskTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<HelpDeskMessage[]>([]);
  const [ownWhiteId, setOwnWhiteId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Search & Filter States
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'answered' | 'closed'>('all');

  // Compose View States
  const [composeSubject, setComposeSubject] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [composeCategory, setComposeCategory] = useState<string>('voice');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [tenantCustomFields, setTenantCustomFields] = useState<CustomFieldDef[]>([]);
  const [tenantCatalog, setTenantCatalog] = useState<CatalogItem[]>([]);

  // Dynamic Categories from whitedesk_app_cat
  const [availableCategories, setAvailableCategories] = useState<HelpDeskCategory[]>(INWHITE_CATEGORIES);

  // Admin Provisioning Console States
  const [consoleVisible, setConsoleVisible] = useState(false);
  const [adminGuideVisible, setAdminGuideVisible] = useState(false);

  // Console Data
  const [adminsList, setAdminsList] = useState<AdminEntry[]>([]);
  const [orgsList, setOrgsList] = useState<OrgEntry[]>([]);
  const [appsList, setAppsList] = useState<AppCatEntry[]>([]);
  const [allocationsList, setAllocationsList] = useState<AdminAllocEntry[]>([]);

  // 4-Tier Linear Selection: Admin -> Org -> App -> Cat
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('default');
  const [selectedAppId, setSelectedAppId] = useState<string>('all');
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>(['all']);

  // Modals for "+ Add" actions
  const [addAdminModalVisible, setAddAdminModalVisible] = useState(false);
  const [assigningTicket, setAssigningTicket] = useState<HelpDeskTicket | null>(null);
  const [newAdminIdInput, setNewAdminIdInput] = useState('');
  const [newAdminAliasInput, setNewAdminAliasInput] = useState('');
  const [suggestPrefixIndex, setSuggestPrefixIndex] = useState(0);
  const [suggestCount, setSuggestCount] = useState(1);
  const [assignAppId, setAssignAppId] = useState<string>('*');
  const [assignCatId, setAssignCatId] = useState<string>('*');

  const [addOrgModalVisible, setAddOrgModalVisible] = useState(false);
  const [newOrgIdInput, setNewOrgIdInput] = useState('');
  const [newOrgNameInput, setNewOrgNameInput] = useState('');

  const [addAppModalVisible, setAddAppModalVisible] = useState(false);
  const [newAppIdInput, setNewAppIdInput] = useState('');

  const [addCatModalVisible, setAddCatModalVisible] = useState(false);
  const [newCatIdInput, setNewCatIdInput] = useState('');
  const [newCatTrInput, setNewCatTrInput] = useState('');
  const [newCatEnInput, setNewCatEnInput] = useState('');

  // App Registration Workflow
  const [appRegStatus, setAppRegStatus] = useState<AppRegStatus | null>(null);
  const [appRegModalVisible, setAppRegModalVisible] = useState(false);
  const [appRegNameInput, setAppRegNameInput] = useState('');
  const [appRegDescInput, setAppRegDescInput] = useState('');
  const [pendingAppRequests, setPendingAppRequests] = useState<AppRequestEntry[]>([]);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<'founder' | 'global_admin' | 'admin' | 'none'>('none');
  const [isFounder, setIsFounder] = useState(false);
  const [isCreatingDiscussion, setIsCreatingDiscussion] = useState(false);
  const [escalationTarget, setEscalationTarget] = useState<'none' | 'thewhite' | 'global_admin'>('none');
  const [customAlias, setCustomAlias] = useState<string | null>(null);
  const [identityModalVisible, setIdentityModalVisible] = useState(false);
  const [identityInput, setIdentityInput] = useState('');
  const [approvalsModalVisible, setApprovalsModalVisible] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalEntry[]>([]);
  const [tenantsList, setTenantsList] = useState<TenantEntry[]>([]);
  const [selectedTenantBlindId, setSelectedTenantBlindId] = useState<string>('all');
  const [currentEnterpriseName, setCurrentEnterpriseName] = useState<string>('Atlas Global Inc.');
  const [ticketActionModalVisible, setTicketActionModalVisible] = useState(false);
  const [targetActionTicket, setTargetActionTicket] = useState<HelpDeskTicket | null>(null);
  const [targetActionRole, setTargetActionRole] = useState<'founder' | 'global_admin' | 'admin' | 'none'>('none');

  // Gemini-Style Global Admin Console State
  const [expandedGeminiSection, setExpandedGeminiSection] = useState<'tenant' | 'license' | 'operators' | null>('tenant');
  const [tenantStats, setTenantStats] = useState<{ adminCount: number; userCount: number }>({ adminCount: 1, userCount: 0 });
  const [activeEnterpriseBlindId, setActiveEnterpriseBlindId] = useState<string>('');
  const [generatedOperatorHash, setGeneratedOperatorHash] = useState<string | null>(null);
  const [generatedUserHash, setGeneratedUserHash] = useState<string | null>(null);
  const [copiedConsoleHash, setCopiedConsoleHash] = useState<string | null>(null);

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

  const getCategoryLabel = useCallback((catKey?: string) => {
    if (!catKey || catKey === 'discussion') return '';
    if (catKey === 'root_support' || catKey === 'thewhite_support') {
      return language === 'tr' ? 'TheWhite Destek' : 'TheWhite Support';
    }
    if (catKey === 'internal_admin_ticket') {
      return language === 'tr' ? 'Yönetici Talebi' : 'Admin Request';
    }
    const found = availableCategories.find(c => c.id === catKey || c.key === catKey) || INWHITE_CATEGORIES.find(c => c.id === catKey || c.key === catKey);
    if (found) {
      return language === 'tr' ? found.labelTr : found.labelEn;
    }
    return catKey;
  }, [availableCategories, language]);

  // Detail / Reply States
  const [replyText, setReplyText] = useState('');
  const [replyFocused, setReplyFocused] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<HelpDeskMessage | null>(null);

  const handleBackToList = useCallback(() => {
    Keyboard.dismiss();
    setSelectedTicket(null);
    setIsCreatingDiscussion(false);
    setEscalationTarget('none');
    scrollY.setValue(0);
    setCurrentView('list');
    setTimeout(() => {
      listScrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 10);
  }, [scrollY]);

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
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Format date
  const formatTicketDate = useCallback((timestamp: number, showTime: boolean = false) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, '0');
    const monthKey = MONTH_KEYS[date.getMonth()];
    const monthName = t(`common.months.${monthKey}`) || monthKey;
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${mins}`;

    return showTime 
      ? `${day} ${monthName} ${date.getFullYear()} ${timeStr}` 
      : `${day} ${monthName} ${date.getFullYear()}`;
  }, [t]);

  // WhiteId hiçbir zaman kullanıcıya gösterilmez.
  // Kendi mesajlarında 'Siz/You', başkalarında boş string döner.
  // Sender label'ı varsa (alias) o zaten ayrıca kullanılır.
  const formatWhiteId = useCallback((id: string) => {
    if (!id) return '';
    if (ownWhiteId && id.toLowerCase() === ownWhiteId.toLowerCase()) {
      return language === 'tr' ? 'Siz' : 'You';
    }
    return ''; // WhiteId asla dışarıya açılmaz
  }, [ownWhiteId, language]);

  const formatAppId = (appId?: string) => {
    if (!appId) return 'inWhite';
    const low = appId.toLowerCase();
    if (low === 'inwhite') return 'inWhite';
    return appId;
  };

  // Load identity and tickets
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const myId = await helpDeskService.getOwnWhiteId();
      setOwnWhiteId(myId);

      // Fast Parallel Phase 1: Role & Local Metadata
      const [role, alias, userEnt, adminEnt] = await Promise.all([
        helpDeskService.getAdminRole(myId),
        helpDeskService.getCustomAlias(),
        helpDeskService.getUserEnterprise(),
        helpDeskService.getAdminEnterprise(),
      ]);

      const admin = role !== 'none';
      setIsAdmin(admin);
      setAdminRole(role);
      const isFounderUser = role === 'founder' || (role as string) === 'master';
      setIsFounder(isFounderUser);
      setIsMasterAdmin(isFounderUser || role === 'global_admin');
      setCustomAlias(alias);
      setCurrentEnterpriseName(adminEnt.enterpriseName || userEnt.enterpriseName || 'Atlas Global Inc.');

      // Fast Parallel Phase 2: Remote Data (Tickets, Approvals, Tenants, Categories, Custom Fields)
      const tenantFilter = isFounderUser && selectedTenantBlindId !== 'all' ? selectedTenantBlindId : null;
      const targetTenantId = adminEnt.enterpriseBlindId || userEnt.enterpriseBlindId || (selectedTenantBlindId !== 'all' ? selectedTenantBlindId : undefined);
      const [list, approvals, tenants, cats, customData] = await Promise.all([
        helpDeskService.getTickets(myId, admin, CURRENT_APP_ID, tenantFilter),
        admin ? helpDeskService.getPendingApprovals(role, selectedTenantBlindId !== 'all' ? selectedTenantBlindId : undefined) : Promise.resolve([]),
        isFounderUser ? helpDeskService.getAllTenants() : Promise.resolve([]),
        helpDeskService.getAppCategories(CURRENT_APP_ID).catch(() => []),
        helpDeskService.getTenantCustomFieldsAndCatalog(targetTenantId).catch(() => ({ customFields: [], catalog: [] })),
      ]);

      setTickets(list);
      if (admin) setPendingApprovals(approvals);
      if (isFounderUser) setTenantsList(tenants);
      if (cats && cats.length > 0) setAvailableCategories(cats);
      if (customData) {
        setTenantCustomFields(customData.customFields || []);
        setTenantCatalog(customData.catalog || []);
      }
    } catch (err) {
      console.warn('[HelpDeskScreen] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTenantBlindId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Filtered tickets (Filter pills + Live search)
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // 1. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'open' && ticket.status !== 'open') return false;
        if (statusFilter === 'answered' && ticket.status !== 'answered') return false;
        if (statusFilter === 'closed' && ticket.status !== 'closed') return false;
      }
      // 2. Search Query
      if (ticketSearchQuery.trim()) {
        const q = ticketSearchQuery.toLowerCase().trim();
        const subject = (ticket.subject || '').toLowerCase();
        const appId = (ticket.app_id || '').toLowerCase();
        const id = String(ticket.id).toLowerCase();
        const sender = (ticket.user_white_id || '').toLowerCase();
        if (!subject.includes(q) && !appId.includes(q) && !id.includes(q) && !sender.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [ticketSearchQuery, tickets, statusFilter]);

  // Load messages for a ticket
  const openTicketDetail = async (ticket: HelpDeskTicket) => {
    setSelectedTicket(ticket);
    setEditingMessage(null);
    setReplyText('');
    setAttachedFile(null);
    scrollY.setValue(0);
    setCurrentView('detail');
    try {
      const msgs = await helpDeskService.getTicketMessages(ticket.id);
      setTicketMessages(msgs);
      setTimeout(() => {
        messagesScrollRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (err) {
      console.warn('[HelpDeskScreen] openTicketDetail error:', err);
    }
  };

  // Attachment Handlers
  const handlePickCamera = async () => {
    setAttachMenuVisible(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
      const res = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setAttachedFile({
          data: asset.base64 || '',
          name: 'photo_' + Date.now() + '.jpg',
          type: 'image',
          mimeType: 'image/jpeg',
        });
      }
    } catch (err) {
      console.warn('[HelpDeskScreen] Camera picker error:', err);
    }
  };

  const handlePickGallery = async () => {
    setAttachMenuVisible(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.5,
        base64: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setAttachedFile({
          data: asset.base64 || '',
          name: asset.fileName || ('photo_' + Date.now() + '.jpg'),
          type: 'image',
          mimeType: 'image/jpeg',
        });
      }
    } catch (err) {
      console.warn('[HelpDeskScreen] Gallery picker error:', err);
    }
  };

  const handlePickDocument = async () => {
    setAttachMenuVisible(false);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const doc = res.assets[0];
        const base64Data = await ReactNativeBlobUtil.fs.readFile(doc.uri, 'base64');
        setAttachedFile({
          data: base64Data,
          name: doc.name || 'document.pdf',
          type: 'document',
          mimeType: doc.mimeType || 'application/octet-stream',
        });
      }
    } catch (err) {
      console.warn('[HelpDeskScreen] Document picker error:', err);
    }
  };

  const exportOrgPubCertificate = async (data: {
    enterpriseName?: string;
    appName?: string;
    orgPub?: string;
    enterpriseBlindId?: string;
  }) => {
    try {
      const orgName = data.enterpriseName || 'Organization';
      const certData = {
        enterprise_name: orgName,
        app_name: data.appName || 'WhiteDesk',
        org_pub: data.orgPub || '',
        enterprise_blind_id: data.enterpriseBlindId || '',
        issued_at: new Date().toISOString(),
        authority: 'TheWhite Root Authority',
        type: 'WhiteDesk Organization Public Certificate',
      };
      const jsonContent = JSON.stringify(certData, null, 2);
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const filename = `${slug}_org_pub.json`;

      if (Platform.OS === 'web') {
        if (typeof document !== 'undefined') {
          const blob = new Blob([jsonContent], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else {
        const filePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
        await ReactNativeBlobUtil.fs.writeFile(filePath, jsonContent, 'utf8');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'application/json',
            dialogTitle: `${orgName} Organizasyon Açık Anahtarı (org_pub)`,
            UTI: 'public.json',
          });
        }
      }
    } catch (e) {
      console.warn('[HelpDeskScreen] exportOrgPubCertificate error:', e);
    }
  };

  const handleOpenDocument = async (name: string, base64Data: string) => {
    try {
      const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${name}`;
      await ReactNativeBlobUtil.fs.writeFile(path, base64Data, 'base64');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path);
      }
    } catch (err) {
      console.warn('[HelpDeskScreen] handleOpenDocument error:', err);
    }
  };

  // Create new ticket
  const handleCreateTicket = async () => {
    if (!composeSubject.trim() || !composeMessage.trim() || sending) return;
    setSending(true);
    try {
      const msgText = composeMessage.trim();

      // 1. Check for "admin <enterprise_white_id_or_hash>" Claim Command
      const adminMatch = msgText.match(/^admin\s+([a-zA-Z0-9_\-\.]+)/i);
      if (adminMatch && adminMatch[1]) {
        const claimResult = await helpDeskService.handleAdminClaimCommand(ownWhiteId, adminMatch[1]);
        if (claimResult.success && claimResult.orgPub) {
          await exportOrgPubCertificate(claimResult);
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
        setAttachedFile(null);
        setCurrentView('list');
        setSending(false);
        void loadData();
        void loadConsoleData();
        return;
      }

      // 2. Check for "user <hash_or_org_pub>" Standalone User Join Command
      const userMatch = msgText.match(/^user\s+([a-zA-Z0-9_\-\.]+)/i);
      if (userMatch && userMatch[1]) {
        const joinResult = await helpDeskService.handleUserJoinCommand(ownWhiteId, userMatch[1]);
        await helpDeskService.createTicket(
          composeSubject.trim() || `[Bağlantı] ${joinResult.enterpriseName || 'Kurumsal'}`,
          joinResult.message,
          null,
          joinResult.appId || helpDeskService.appId,
          'account'
        );
        setComposeSubject('');
        setComposeMessage('');
        setAttachedFile(null);
        setCurrentView('list');
        setSending(false);
        void loadData();
        return;
      }

      // Pack custom field values if present (Dual-layer: human-readable structured block)
      let finalMessage = composeMessage.trim();
      const filledFieldKeys = Object.keys(customFieldValues).filter(k => customFieldValues[k]?.trim());
      if (filledFieldKeys.length > 0) {
        const detailsLines = filledFieldKeys.map(k => {
          const fieldDef = tenantCustomFields.find(f => f.key === k || f.label === k);
          const label = fieldDef?.label || k;
          return `• ${label}: ${customFieldValues[k].trim()}`;
        });
        finalMessage += `\n\n--- 📋 [Kayıt Bilgileri] ---\n${detailsLines.join('\n')}`;
      }

      if (isAdmin && isCreatingDiscussion) {
        await helpDeskService.createDiscussion(
          composeSubject.trim(), 
          finalMessage, 
          attachedFile,
          helpDeskService.appId,
          'merkez',
          selectedTenantBlindId !== 'all' ? selectedTenantBlindId : undefined
        );
        setIsCreatingDiscussion(false);
      } else if (escalationTarget === 'thewhite') {
        // Global Admin -> TheWhite Root Platform Support
        await helpDeskService.createTicket(
          composeSubject.trim(),
          finalMessage,
          attachedFile,
          'whitedesk',
          'root_support'
        );
      } else if (escalationTarget === 'global_admin') {
        // Operator Admin -> Global Admin Internal Request
        await helpDeskService.createTicket(
          composeSubject.trim(),
          finalMessage,
          attachedFile,
          helpDeskService.appId,
          'internal_admin_ticket'
        );
      } else {
        await helpDeskService.createTicket(
          composeSubject.trim(), 
          finalMessage, 
          attachedFile,
          helpDeskService.appId,
          composeCategory
        );
      }
      setComposeSubject('');
      setComposeMessage('');
      setCustomFieldValues({});
      setAttachedFile(null);
      setComposeCategory('voice');
      setEscalationTarget('none');
      setCurrentView('list');
      setSending(false);
      void loadData();
    } catch (err) {
      console.warn('[HelpDeskScreen] handleCreateTicket error:', err);
    } finally {
      setSending(false);
    }
  };

  // Load console provisioning data with dynamic cascading tenant support
  const loadConsoleData = useCallback(async (targetTenantBlindId?: string) => {
    try {
      const myId = await helpDeskService.getOwnWhiteId();
      const role = await helpDeskService.getAdminRole(myId);
      const isFounderUser = role === 'founder' || (role as string) === 'master';
      const master = role === 'global_admin' || isFounderUser;
      setIsFounder(isFounderUser);
      setIsMasterAdmin(master);

      // Resolve tenant scope: If NOT founder, ALWAYS lock strictly to user's own tenant blind ID!
      let effectiveTenant: string | undefined = undefined;
      if (!isFounderUser) {
        const { enterpriseBlindId } = await helpDeskService.getAdminEnterprise();
        effectiveTenant = enterpriseBlindId || undefined;
      } else {
        effectiveTenant = targetTenantBlindId !== undefined ? targetTenantBlindId : selectedTenantBlindId;
      }

      const [admins, apps, allocs, orgs] = await Promise.all([
        helpDeskService.getAdminsList(effectiveTenant),
        helpDeskService.getAppCatList(effectiveTenant),
        helpDeskService.getAdminAllocations(),
        helpDeskService.getOrgsList(effectiveTenant),
      ]);

      if (effectiveTenant) {
        setActiveEnterpriseBlindId(effectiveTenant);
        try {
          const stats = await helpDeskService.getTenantStats(effectiveTenant);
          setTenantStats(stats);
        } catch {}
      }

      const sortedAdmins = [...admins].sort((a, b) => {
        const getRank = (adm: AdminEntry) => {
          if (adm.role === 'founder' || adm.role === 'master' || (adm.alias && adm.alias.toLowerCase().trim() === 'thewhite')) return 0;
          if (adm.role === 'global_admin' || (adm.alias && (adm.alias.toLowerCase().includes('whitecosmos') || adm.alias.toLowerCase().includes('global admin')))) return 1;
          return 2;
        };
        const rankDiff = getRank(a) - getRank(b);
        if (rankDiff !== 0) return rankDiff;
        return (a.created_at || 0) - (b.created_at || 0);
      });

      setAdminsList(sortedAdmins);
      setAppsList(apps);
      setAllocationsList(allocs);
      setOrgsList(orgs);

      // Auto-align admin selection
      if (sortedAdmins.length > 0) {
        setSelectedAdminId(prev => (sortedAdmins.some(a => a.white_id === prev) ? prev : sortedAdmins[0].white_id));
      } else {
        setSelectedAdminId('');
      }

      // Auto-align app selection
      if (apps.length > 0) {
        setSelectedAppId(prev => (prev === 'all' || apps.some(a => a.app_id === prev) ? prev : apps[0].app_id));
      } else {
        setSelectedAppId('all');
      }

      // Auto-align org selection
      if (orgs.length > 0) {
        setSelectedOrgId(prev => (prev === '*' || prev === 'default' || orgs.some(o => o.org_id === prev) ? prev : orgs[0].org_id));
      } else {
        setSelectedOrgId('default');
      }

      // Master/Global admins also load pending app requests
      if (master) {
        const pending = await helpDeskService.getPendingAppRequests();
        setPendingAppRequests(pending);
      }
    } catch (e) {
      console.warn('[HelpDeskScreen] loadConsoleData error:', e);
    }
  }, [selectedTenantBlindId]);

  // Security Badge / Admin Provisioning Station Press
  const handleLockPress = () => {
    if (!isAdmin) return;
    setConsoleVisible(true);
    void loadConsoleData();
  };

  const handleQuickAddThisDevice = async () => {
    if (!ownWhiteId) return;
    // Modal'ı ownWhiteId + önerilen alias ile aç — kullanıcı kaydetmeden değiştirebilir
    const suggested = await helpDeskService.suggestAdminAlias('master');
    setNewAdminIdInput(ownWhiteId);
    setNewAdminAliasInput(suggested);
    setAddAdminModalVisible(true);
  };

  // App Registration Workflow Handlers
  const handleSubmitAppRegistration = async () => {
    const appName = appRegNameInput.trim() || CURRENT_APP_ID;
    const ok = await helpDeskService.requestAppRegistration(
      CURRENT_APP_ID, appName, ownWhiteId, appRegDescInput.trim()
    );
    if (ok) {
      setAppRegStatus('pending');
    }
  };

  const handleApproveAppRequest = (appId: string) => {
    setConfirmSheet({
      visible: true,
      title: language === 'tr' ? 'Uygulamayı Onayla' : 'Approve Application',
      description: `"${appId}" ${language === 'tr' ? 'WhiteDesk sistemine eklenecek.' : 'will be added to WhiteDesk.'}`,
      actionText: language === 'tr' ? 'Onayla' : 'Approve',
      actionColor: '#22C55E',
      cancelText: language === 'tr' ? 'Vazgeç' : 'Cancel',
      onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet(prev => ({ ...prev, visible: false }));
        await helpDeskService.approveAppRequest(appId, ownWhiteId);
        await loadConsoleData();
      },
    });
  };

  const handleRejectAppRequest = (appId: string) => {
    setConfirmSheet({
      visible: true,
      title: language === 'tr' ? 'Talebi Reddet' : 'Reject Request',
      description: `"${appId}" ${language === 'tr' ? 'talebi reddedilecek.' : 'request will be rejected.'}`,
      actionText: language === 'tr' ? 'Reddet' : 'Reject',
      actionColor: '#EF4444',
      cancelText: language === 'tr' ? 'Vazgeç' : 'Cancel',
      onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet(prev => ({ ...prev, visible: false }));
        await helpDeskService.rejectAppRequest(appId, ownWhiteId);
        await loadConsoleData();
      },
    });
  };


  const handleAddCustomAdminSubmit = async () => {
    const cleanId = newAdminIdInput.trim();
    if (!cleanId && !assigningTicket) return;

    if (assigningTicket) {
      // Flow from Ticket Long Press: Close input modal and confirm via BottomConfirmationSheet
      const targetTicket = assigningTicket;
      const targetAlias = newAdminAliasInput.trim() || `${COSMIC_PREFIXES[suggestPrefixIndex % COSMIC_PREFIXES.length]}-${suggestCount}`;
      const targetApp = assignAppId;
      const targetCat = assignCatId;
      setAddAdminModalVisible(false);

      const ticketIdLabel = `#${targetTicket.id}`;
      const appLabel = targetApp === '*' ? (language === 'tr' ? 'Tüm Uygulamalar (*)' : 'All Apps (*)') : formatAppId(targetApp);
      const catLabel = targetCat === '*' ? (language === 'tr' ? 'Tüm Kategoriler (*)' : 'All Categories (*)') : getCategoryLabel(targetCat);

      const descTemplate = language === 'tr'
        ? `${ticketIdLabel} bilet sahibine (${targetAlias}) [${appLabel} • ${catLabel}] için Ed25519 kriptografik yönetici yetkisi tanımlanacak ve Neon sistemine mühürlenecektir. Onaylıyor musunuz?`
        : `${ticketIdLabel} ticket owner will be authorized as ${targetAlias} for [${appLabel} • ${catLabel}] with Ed25519 and sealed to Neon. Do you confirm?`;

      setConfirmSheet({
        visible: true,
        title: getLabel('helpdesk.assignAdminTitle', 'Admin Authorization', 'Admin Authorization'),
        description: descTemplate,
        actionText: getLabel('helpdesk.assignAdminBtn', 'Yetkilendir ve Mühürle', 'Authorize & Seal'),
        actionColor: '#3B82F6',
        cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
        onCancel: () => {
          setConfirmSheet(prev => ({ ...prev, visible: false }));
          setAssigningTicket(null);
          setNewAdminIdInput('');
          setNewAdminAliasInput('');
        },
        onAction: async () => {
          setConfirmSheet(prev => ({ ...prev, visible: false }));
          try {
            const success = await helpDeskService.grantAdminFromTicket(
              targetTicket, 
              'admin', 
              targetAlias,
              targetApp,
              targetCat
            );
            if (success) {
              await loadData();
              const successDesc = language === 'tr'
                ? `${ticketIdLabel} bilet sahibine (${targetAlias}) başarıyla Ed25519 yönetici yetkisi verildi.`
                : `${ticketIdLabel} ticket owner (${targetAlias}) has been successfully granted Ed25519 admin authority.`;

              setTimeout(() => {
                setConfirmSheet({
                  visible: true,
                  title: getLabel('helpdesk.assignSuccessTitle', 'Yetkilendirme Mühürlendi', 'Authorization Sealed'),
                  description: successDesc,
                  actionText: getLabel('common.ok', 'Tamam', 'OK'),
                  actionColor: '#3B82F6',
                  onAction: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
                });
              }, 300);
            }
          } catch (err) {
            console.warn('[HelpDeskScreen] grantAdminFromTicket error:', err);
          } finally {
            setAssigningTicket(null);
            setNewAdminIdInput('');
            setNewAdminAliasInput('');
          }
        },
      });
      return;
    }

    // Normal Console Admin Add
    await helpDeskService.addAdmin(cleanId, newAdminAliasInput.trim());
    setAddAdminModalVisible(false);
    setNewAdminIdInput('');
    setNewAdminAliasInput('');
    await loadConsoleData();
  };



  const handleAddCustomAppSubmit = async () => {
    const cleanApp = newAppIdInput.trim().toLowerCase();
    if (!cleanApp) return;
    await helpDeskService.addApp(cleanApp);
    setAddAppModalVisible(false);
    setNewAppIdInput('');
    await loadConsoleData();
    setSelectedAppId(cleanApp);
    setSelectedCatIds(['all']);
  };

  const handleAddCustomCategorySubmit = async () => {
    const cleanCat = newCatIdInput.trim().toLowerCase();
    if (!cleanCat || selectedAppId === 'all') return;
    const label = newCatTrInput.trim() || cleanCat; // single label field (newCatTrInput reused)
    const newCatObj: HelpDeskCategory = {
      id: cleanCat,
      key: cleanCat,
      icon: 'HelpCircle',
      labelTr: label,
      labelEn: label,
    };
    await helpDeskService.addCategoryToApp(selectedAppId, newCatObj);
    setAddCatModalVisible(false);
    setNewCatIdInput('');
    setNewCatTrInput('');
    setNewCatEnInput('');
    await loadConsoleData();
    if (selectedAppId === CURRENT_APP_ID) {
      const cats = await helpDeskService.getAppCategories(CURRENT_APP_ID);
      setAvailableCategories(cats);
    }
    setSelectedCatIds(prev => prev.includes('all') ? [cleanCat] : [...prev, cleanCat]);
  };

  const handleDeleteCategory = (catId: string) => {
    if (catId === 'all') return;
    const cat = availableCategories.find(c => c.id === catId || c.key === catId);
    const catLabel = cat ? (language === 'tr' ? cat.labelTr : cat.labelEn) : catId;
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.deleteCatTitle', 'Kategoriyi Sil', 'Delete Category'),
      description: `"${catLabel}" ${getLabel('helpdesk.deleteCatConfirm', 'kategorisi sistemden silinecek. Onaylıyor musunuz?', 'category will be removed from the system. Do you confirm?')}`,
      actionText: getLabel('common.delete', 'Sil', 'Delete'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
      onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet(prev => ({ ...prev, visible: false }));
        await helpDeskService.deleteCategory(catId, selectedAppId);
        await loadConsoleData();
        const cats = await helpDeskService.getAppCategories(selectedAppId === 'all' ? CURRENT_APP_ID : selectedAppId);
        setAvailableCategories(cats);
        setSelectedCatIds(prev => prev.filter(id => id !== catId));
      },
    });
  };

  const handleDeleteApp = (appId: string) => {
    if (appId === 'all' || appId === 'inwhite') return;
    if (isMasterAdmin) {
      setConfirmSheet({
        visible: true,
        title: getLabel('helpdesk.deleteAppTitle', 'Uygulamayı Sil', 'Delete Application'),
        description: `"${formatAppId(appId)}" ${getLabel('helpdesk.deleteAppConfirm', 'uygulaması sistemden ve tüm yetkilendirmelerden silinecektir. Onaylıyor musunuz?', 'application and all allocations will be removed. Do you confirm?')}`,
        actionText: getLabel('common.delete', 'Sil', 'Delete'),
        actionColor: '#EF4444',
        cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
        onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
        onAction: async () => {
          setConfirmSheet(prev => ({ ...prev, visible: false }));
          await helpDeskService.removeApp(appId);
          await loadConsoleData();
          if (selectedAppId === appId) {
            setSelectedAppId('all');
            setSelectedCatIds(['all']);
          }
        },
      });
    } else {
      setConfirmSheet({
        visible: true,
        title: getLabel('helpdesk.reqDeleteAppTitle', 'Uygulama Silme Onayı Talebi', 'Request App Deletion'),
        description: `"${formatAppId(appId)}" ${getLabel('helpdesk.reqDeleteAppDesc', 'uygulamasını silme yetkisi Global Admin onayına tabidir. Onay talebi iletilsin mi?', 'application deletion requires Global Admin approval. Send request?')}`,
        actionText: getLabel('helpdesk.sendForApproval', 'Onaya Gönder', 'Submit for Approval'),
        actionColor: '#3B82F6',
        cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
        onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
        onAction: async () => {
          setConfirmSheet(prev => ({ ...prev, visible: false }));
          await helpDeskService.requestDeletionApproval('delete_app', appId, ownWhiteId, selectedTenantBlindId, customAlias || undefined);
          setTimeout(() => {
            setConfirmSheet({
              visible: true,
              title: getLabel('helpdesk.reqSentTitle', 'Talep İletildi', 'Request Submitted'),
              description: getLabel('helpdesk.reqSentDesc', 'Uygulama silme talebiniz Global Admin onayına sunuldu.', 'Deletion request submitted for Global Admin review.'),
              actionText: getLabel('common.ok', 'Tamam', 'OK'),
              actionColor: '#3B82F6',
              onAction: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
            });
          }, 300);
        },
      });
    }
  };

  const handleDeleteOrg = (orgId: string) => {
    if (orgId === 'default' || orgId === '*') return;
    if (isMasterAdmin) {
      setConfirmSheet({
        visible: true,
        title: getLabel('helpdesk.deleteOrgTitle', 'Organizasyonu Sil', 'Delete Organization'),
        description: `"${orgId}" ${getLabel('helpdesk.deleteOrgConfirm', 'organizasyonu ve bağlı yetkilendirmeler sistemden silinecektir. Onaylıyor musunuz?', 'organization and all allocations will be removed. Do you confirm?')}`,
        actionText: getLabel('common.delete', 'Sil', 'Delete'),
        actionColor: '#EF4444',
        cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
        onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
        onAction: async () => {
          setConfirmSheet(prev => ({ ...prev, visible: false }));
          await helpDeskService.removeOrganization(orgId);
          await loadConsoleData();
          if (selectedOrgId === orgId) {
            setSelectedOrgId('default');
          }
        },
      });
    } else {
      setConfirmSheet({
        visible: true,
        title: getLabel('helpdesk.reqDeleteOrgTitle', 'Organizasyon Silme Onayı Talebi', 'Request Org Deletion'),
        description: `"${orgId}" ${getLabel('helpdesk.reqDeleteOrgDesc', 'organizasyonunu silme yetkisi Global Admin onayına tabidir. Onay talebi iletilsin mi?', 'organization deletion requires Global Admin approval. Send request?')}`,
        actionText: getLabel('helpdesk.sendForApproval', 'Onaya Gönder', 'Submit for Approval'),
        actionColor: '#3B82F6',
        cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
        onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
        onAction: async () => {
          setConfirmSheet(prev => ({ ...prev, visible: false }));
          await helpDeskService.requestDeletionApproval('delete_org', orgId, ownWhiteId, selectedTenantBlindId, customAlias || undefined);
          setTimeout(() => {
            setConfirmSheet({
              visible: true,
              title: getLabel('helpdesk.reqSentTitle', 'Talep İletildi', 'Request Submitted'),
              description: getLabel('helpdesk.reqSentDesc', 'Organizasyon silme talebiniz Global Admin onayına sunuldu.', 'Deletion request submitted for Global Admin review.'),
              actionText: getLabel('common.ok', 'Tamam', 'OK'),
              actionColor: '#3B82F6',
              onAction: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
            });
          }, 300);
        },
      });
    }
  };

  const handleToggleCategory = (catId: string) => {
    if (catId === 'all') {
      setSelectedCatIds(['all']);
      return;
    }
    let next = selectedCatIds.filter(c => c !== 'all');
    if (next.includes(catId)) {
      next = next.filter(c => c !== catId);
      if (next.length === 0) {
        next = ['all'];
      }
    } else {
      next.push(catId);
    }
    setSelectedCatIds(next);
  };

  const handleAddCustomOrgSubmit = async () => {
    const cleanOrg = newOrgIdInput.trim().toLowerCase();
    if (!cleanOrg) return;
    const cleanName = newOrgNameInput.trim() || cleanOrg;
    await helpDeskService.addOrganization(cleanOrg, cleanName);
    setAddOrgModalVisible(false);
    setNewOrgIdInput('');
    setNewOrgNameInput('');
    await loadConsoleData();
    setSelectedOrgId(cleanOrg);
  };

  const handleSaveAllocationSubmit = async () => {
    if (!selectedAdminId) return;
    const finalCats = selectedAppId === 'all' || selectedCatIds.length === 0 ? ['all'] : selectedCatIds;
    const selectedAdm = adminsList.find(a => a.white_id === selectedAdminId);
    const tenantBlind = selectedAdm?.enterprise_blind_id || (selectedTenantBlindId !== 'all' ? selectedTenantBlindId : undefined);
    await helpDeskService.saveAdminAlloc(
      selectedAdminId, 
      selectedOrgId || '*', 
      selectedAppId, 
      finalCats,
      tenantBlind,
      finalCats.length === 1 ? finalCats[0] : '*'
    );
    await loadConsoleData();
  };

  const handleDeleteAlloc = (adminWhiteId: string, appId: string, orgId?: string) => {
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.deleteAllocTitle', 'Atamayı Sil', 'Delete Allocation'),
      description: getLabel('helpdesk.deleteAllocConfirm', 'Bu yetki ataması sistemden silinecektir.', 'This allocation will be removed from the system.'),
      actionText: getLabel('common.delete', 'Sil', 'Delete'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
      onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet(prev => ({ ...prev, visible: false }));
        await helpDeskService.deleteAdminAlloc(adminWhiteId, appId, orgId);
        await loadConsoleData();
      },
    });
  };

  const handleRemoveAdmin = (adminWhiteId: string) => {
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.removeAdminTitle', 'Yöneticiyi Sil', 'Remove Admin'),
      description: `${formatWhiteId(adminWhiteId)} ${getLabel('helpdesk.removeAdminConfirm', 'yöneticisini ve tüm yetki atamalarını silmek istediğinizden emin misiniz?', 'Are you sure you want to remove this admin and all their allocations?')}`,
      actionText: getLabel('common.delete', 'Sil', 'Delete'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
      onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet(prev => ({ ...prev, visible: false }));
        await helpDeskService.removeAdmin(adminWhiteId);
        await loadConsoleData();
        if (selectedAdminId === adminWhiteId) {
          setSelectedAdminId('');
        }
      },
    });
  };

  const handleRevokeMasterStation = () => {
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.adminRevoke', 'Yetkiyi Kaldır', 'Revoke Admin'),
      description: getLabel('helpdesk.adminRevokeDesc', 'Bu cihazın yönetici yetkisi kaldırılacak ve konsol kilitlenecektir.', 'Admin privileges will be removed from this device and the console will be locked.'),
      actionText: getLabel('helpdesk.adminRevoke', 'Yetkiyi Kaldır', 'Revoke Admin'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
      onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet(prev => ({ ...prev, visible: false }));
        await helpDeskService.setSavedAdminKey(null);
        setIsAdmin(false);
        setConsoleVisible(false);
        await loadData();
      },
    });
  };

  // Helper for Admin Hierarchy Rank: Founder (3) > Global Admin (2) > Admin (1) > User (0)
  const getRank = useCallback((r: 'founder' | 'global_admin' | 'admin' | 'none') => {
    if (r === 'founder') return 3;
    if (r === 'global_admin') return 2;
    if (r === 'admin') return 1;
    return 0;
  }, []);

  // Ticket Long Press -> Show options (Delete Ticket, Promote to Admin, Make Cosmos, Revoke, Block)
  const handleTicketLongPress = useCallback(async (ticket: HelpDeskTicket) => {
    if (!isAdmin) return;
    const targetId = ticket.user_white_id || ticket.user_blind_id || '';
    let targetRole: 'founder' | 'global_admin' | 'admin' | 'none' = 'none';
    if (targetId) {
      targetRole = await helpDeskService.getAdminRole(targetId);
    }
    setTargetActionTicket(ticket);
    setTargetActionRole(targetRole);
    setTicketActionModalVisible(true);
  }, [isAdmin]);

  const handleDeleteSingleTicket = useCallback(() => {
    if (!targetActionTicket) return;
    const tkt = targetActionTicket;
    setTicketActionModalVisible(false);
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.deleteTicketTitle', 'Bileti Sil', 'Delete Ticket'),
      description: `#${tkt.id} ${getLabel('helpdesk.deleteTicketConfirm', 'numaralı bilet ve tüm mesajları kalıcı olarak silinecektir. Onaylıyor musunuz?', 'ticket and all its messages will be permanently deleted. Do you confirm?')}`,
      actionText: getLabel('common.delete', 'Sil', 'Delete'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
      onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet(prev => ({ ...prev, visible: false }));
        await helpDeskService.deleteTicket(tkt.id);
        if (selectedTicket && selectedTicket.id === tkt.id) {
          handleBackToList();
        }
        await loadData();
      },
    });
  }, [targetActionTicket, selectedTicket, getLabel, handleBackToList, loadData]);

  const handleRevokeUserAdmin = useCallback(() => {
    if (!targetActionTicket) return;
    const targetId = targetActionTicket.user_white_id || targetActionTicket.user_blind_id || '';
    if (!targetId || targetId === ownWhiteId) return;

    setTicketActionModalVisible(false);
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.adminRevokeUserTitle', 'Yöneticilik Yetkisini İptal Et', 'Revoke Admin Authority'),
      description: `${formatWhiteId(targetId)} ${getLabel('helpdesk.adminRevokeConfirm', 'kullanıcısının yöneticilik yetkisi ve tüm yetkilendirmeleri iptal edilecektir. Onaylıyor musunuz?', 'admin privileges and all allocations will be revoked. Do you confirm?')}`,
      actionText: getLabel('helpdesk.adminRevokeAction', 'Yetkiyi İptal Et', 'Revoke Authority'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
      onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet(prev => ({ ...prev, visible: false }));
        await helpDeskService.removeAdmin(targetId);
        await loadData();
        await loadConsoleData();
      },
    });
  }, [targetActionTicket, ownWhiteId, getLabel, loadData, loadConsoleData]);

  const handlePromoteTicketUserToAdmin = useCallback(() => {
    if (!targetActionTicket) return;
    const targetId = targetActionTicket.user_white_id || targetActionTicket.user_blind_id || '';
    setTicketActionModalVisible(false);
    setAssigningTicket(targetActionTicket);
    setNewAdminIdInput(targetId);
    setSuggestPrefixIndex(0);
    setSuggestCount(1);
    setNewAdminAliasInput('Planet-1');
    setAssignAppId(targetActionTicket.app_id || '*');
    setAssignCatId(targetActionTicket.category && targetActionTicket.category !== 'general' ? targetActionTicket.category : '*');
    setAddAdminModalVisible(true);
  }, [targetActionTicket]);

  const handlePromoteTicketUserToCosmos = useCallback(() => {
    if (!targetActionTicket) return;
    const targetId = targetActionTicket.user_white_id || targetActionTicket.user_blind_id || '';
    const ticketTenant = targetActionTicket.enterprise_blind_id || selectedTenantBlindId || 'default';
    setTicketActionModalVisible(false);
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.makeCosmosTitle', 'WhiteCosmos (Global Admin *) Ata', 'Assign WhiteCosmos (Global Admin *)'),
      description: `${formatWhiteId(targetId)} ${getLabel('helpdesk.makeCosmosConfirm', 'kullanıcısını bu kiracının tek ve yetkili WhiteCosmos Global Yöneticisi yapmak istiyor musunuz?', 'promote this user to the sole WhiteCosmos Global Admin for this tenant?')}`,
      actionText: getLabel('helpdesk.makeCosmosAction', 'Global Admin Ata', 'Assign Global Admin'),
      actionColor: '#7C3AED',
      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
      onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet(prev => ({ ...prev, visible: false }));
        await helpDeskService.promoteUserToAdmin(targetId, ticketTenant, 'global_admin');
        await loadData();
        await loadConsoleData();
      },
    });
  }, [targetActionTicket, selectedTenantBlindId, getLabel, loadData, loadConsoleData]);

  const handleBlockTicketUser = useCallback(() => {
    if (!targetActionTicket) return;
    const targetId = targetActionTicket.user_white_id || targetActionTicket.user_blind_id || '';
    const ticketTenant = targetActionTicket.enterprise_blind_id || selectedTenantBlindId || 'default';
    setTicketActionModalVisible(false);
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.blockUserTitle', 'Kullanıcıyı Engelle', 'Block User'),
      description: `${formatWhiteId(targetId)} ${getLabel('helpdesk.blockUserConfirm', 'kullanıcısının tüm destek biletleri ve erişimleri engellenecektir. Onaylıyor musunuz?', 'user tickets and access will be blocked. Do you confirm?')}`,
      actionText: getLabel('helpdesk.blockUserAction', 'Engelle', 'Block User'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
      onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet(prev => ({ ...prev, visible: false }));
        await helpDeskService.blockOrDeleteUser(targetId, ticketTenant, 'block');
        await loadData();
      },
    });
  }, [targetActionTicket, selectedTenantBlindId, getLabel, loadData]);

  const handleDeleteTicketAndUser = useCallback(() => {
    if (!targetActionTicket) return;
    const targetId = targetActionTicket.user_white_id || targetActionTicket.user_blind_id || '';
    const ticketTenant = targetActionTicket.enterprise_blind_id || selectedTenantBlindId || 'default';
    setTicketActionModalVisible(false);
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.deleteTicketUserTitle', 'Bileti ve Kullanıcıyı Sil', 'Delete Ticket and User'),
      description: `${formatWhiteId(targetId)} ${getLabel('helpdesk.deleteTicketUserConfirm', 'kullanıcısının biletleri ve sistem bağlaması kalıcı olarak silinecektir. Onaylıyor musunuz?', 'user tickets and bindings will be permanently deleted. Do you confirm?')}`,
      actionText: getLabel('common.delete', 'Sil', 'Delete'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
      onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet(prev => ({ ...prev, visible: false }));
        await helpDeskService.blockOrDeleteUser(targetId, ticketTenant, 'delete');
        await loadData();
      },
    });
  }, [targetActionTicket, selectedTenantBlindId, getLabel, loadData]);

  const handleIdentitySave = useCallback(async () => {
    const trimmed = identityInput.trim();
    await helpDeskService.setCustomAlias(ownWhiteId, trimmed, isAdmin);
    setCustomAlias(trimmed || null);
    setIdentityModalVisible(false);
  }, [identityInput, ownWhiteId, isAdmin]);

  const handleReviewApproval = useCallback(async (approvalId: number, status: 'approved' | 'rejected') => {
    try {
      setLoading(true);
      await helpDeskService.reviewApproval(approvalId, status === 'approved', ownWhiteId);
      const remaining = await helpDeskService.getPendingApprovals(adminRole, selectedTenantBlindId !== 'all' ? selectedTenantBlindId : undefined);
      setPendingApprovals(remaining);
      if (remaining.length === 0) {
        setApprovalsModalVisible(false);
      }
      await loadData();
      await loadConsoleData();
    } catch (err: any) {
      console.warn('Failed to review approval:', err);
    } finally {
      setLoading(false);
    }
  }, [adminRole, selectedTenantBlindId, ownWhiteId, loadData, loadConsoleData]);

  const handleSuggestNextCount = useCallback(() => {
    setSuggestCount(prevCount => {
      const nextCount = prevCount + 1;
      const prefix = COSMIC_PREFIXES[suggestPrefixIndex % COSMIC_PREFIXES.length];
      setNewAdminAliasInput(`${prefix}-${nextCount}`);
      return nextCount;
    });
  }, [suggestPrefixIndex]);

  const handleSuggestCyclePrefix = useCallback(() => {
    setSuggestPrefixIndex(prevIdx => {
      const nextPrefixIdx = (prevIdx + 1) % COSMIC_PREFIXES.length;
      const prefix = COSMIC_PREFIXES[nextPrefixIdx];
      setNewAdminAliasInput(`${prefix}-${suggestCount}`);
      return nextPrefixIdx;
    });
  }, [suggestCount]);

  const modalAppCategories = useMemo(() => {
    if (!assignAppId || assignAppId === '*' || assignAppId === 'inwhite') {
      return INWHITE_CATEGORIES;
    }
    const appEntry = appsList.find(a => a.app_id.toLowerCase() === assignAppId.toLowerCase());
    if (appEntry && appEntry.categories && appEntry.categories.length > 0) {
      return appEntry.categories;
    }
    return INWHITE_CATEGORIES;
  }, [assignAppId, appsList]);

  const currentAppCategories = useMemo(() => {
    if (selectedAppId === 'all') return [];
    const appEntry = appsList.find(a => a.app_id.toLowerCase() === selectedAppId.toLowerCase());
    return appEntry?.categories || [];
  }, [appsList, selectedAppId]);

  // Reply or Edit ticket message
  const handleReplyTicket = async () => {
    if (!selectedTicket || (!replyText.trim() && !attachedFile) || sending) return;
    const textToSend = replyText.trim();
    const fileToSend = attachedFile;
    setSending(true);
    try {
      // 1. Check for "admin <enterprise_white_id>" Genesis Claim Command
      const adminMatch = textToSend.match(/^admin\s+([a-zA-Z0-9_\-\.]+)/i);
      if (adminMatch && adminMatch[1]) {
        const claimResult = await helpDeskService.handleAdminClaimCommand(ownWhiteId, adminMatch[1]);
        if (claimResult.success && claimResult.orgPub) {
          await exportOrgPubCertificate(claimResult);
          setIsAdmin(true);
          setIsMasterAdmin(true);
        }
        await helpDeskService.replyToTicket(selectedTicket.id, claimResult.message, true, null);
        setReplyText('');
        setAttachedFile(null);
        const msgs = await helpDeskService.getTicketMessages(selectedTicket.id);
        setTicketMessages(msgs);
        await loadData();
        await loadConsoleData();
        setTimeout(() => {
          messagesScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
        return;
      }

      // 2. Check for "user <org_pub>" Standalone User Join Command
      const userMatch = textToSend.match(/^user\s+([a-zA-Z0-9_\-\.]+)/i);
      if (userMatch && userMatch[1]) {
        const joinResult = await helpDeskService.handleUserJoinCommand(ownWhiteId, userMatch[1]);
        await helpDeskService.replyToTicket(selectedTicket.id, joinResult.message, false, null);
        setReplyText('');
        setAttachedFile(null);
        const msgs = await helpDeskService.getTicketMessages(selectedTicket.id);
        setTicketMessages(msgs);
        await loadData();
        setTimeout(() => {
          messagesScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
        return;
      }

      if (editingMessage) {
        await helpDeskService.editMessage(editingMessage.id, textToSend, fileToSend);
        setEditingMessage(null);
      } else {
        await helpDeskService.replyToTicket(selectedTicket.id, textToSend, isAdmin, fileToSend);
        setSelectedTicket(prev => prev ? { ...prev, status: isAdmin ? 'answered' : 'open' } : null);
      }
      setReplyText('');
      setAttachedFile(null);
      const msgs = await helpDeskService.getTicketMessages(selectedTicket.id);
      setTicketMessages(msgs);
      loadData();
      setTimeout(() => {
        messagesScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.warn('[HelpDeskScreen] handleReplyTicket error:', err);
    } finally {
      setSending(false);
    }
  };

  // Toggle ticket status (Close / Reopen)
  const handleToggleStatus = async () => {
    if (!selectedTicket) return;
    const nextStatus: TicketStatus = selectedTicket.status === 'closed' ? 'open' : 'closed';
    await helpDeskService.setTicketStatus(selectedTicket.id, nextStatus);
    setSelectedTicket(prev => prev ? { ...prev, status: nextStatus } : null);
    loadData();
  };

  const areRequiredFieldsFilled = tenantCustomFields
    .filter(f => f.required)
    .every(f => (customFieldValues[f.key] || '').trim().length > 0);

  const isHelpCommand = composeMessage.trim().toLowerCase() === '/help';
  const isSendActive = !isHelpCommand && composeSubject.trim().length > 0 && composeMessage.trim().length > 0 && areRequiredFieldsFilled;

  // Status Pill Component
  const renderStatusPill = (status: TicketStatus) => {
    if (status === 'answered') {
      return (
        <View style={styles.pillAnswered}>
          <Text style={styles.pillAnsweredText}>
            {getLabel('helpdesk.filterAnswered', 'Yanıtlandı', 'Answered')}
          </Text>
        </View>
      );
    }
    if (status === 'closed') {
      return (
        <View style={styles.pillClosed}>
          <Text style={styles.pillClosedText}>
            {getLabel('helpdesk.filterClosed', 'Kapalı', 'Closed')}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.pillOpen}>
        <Text style={styles.pillOpenText}>
          {getLabel('helpdesk.filterOpen', 'Açık', 'Open')}
        </Text>
      </View>
    );
  };

  // Attachment Modal
  const renderAttachMenuModal = () => (
    <Modal
      visible={attachMenuVisible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={() => setAttachMenuVisible(false)}
    >
      <TouchableOpacity
        style={styles.attachModalOverlay}
        activeOpacity={1}
        onPress={() => setAttachMenuVisible(false)}
      >
        <View style={styles.attachModalContainer}>
          <Text style={styles.attachModalTitle}>
            {getLabel('helpdesk.attachTitle', 'Dosya Ekle', 'Attach File')}
          </Text>
          <Text style={styles.attachModalSubtitle}>
            {getLabel('helpdesk.attachSubtitle', 'Talebinize görsel veya belge ekleyin', 'Attach image or document to your ticket')}
          </Text>

          <View style={styles.attachOptionsRow}>
            <TouchableOpacity style={styles.attachOptionBtn} onPress={handlePickCamera} activeOpacity={0.7}>
              <View style={[styles.attachOptionIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.08)' }]}>
                <Camera size={22} color="#3B82F6" />
              </View>
              <Text style={styles.attachOptionLabel}>
                {getLabel('helpdesk.camera', 'Kamera', 'Camera')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachOptionBtn} onPress={handlePickGallery} activeOpacity={0.7}>
              <View style={[styles.attachOptionIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                <ImageIcon size={22} color="#10b981" />
              </View>
              <Text style={styles.attachOptionLabel}>
                {getLabel('helpdesk.gallery', 'Galeri', 'Gallery')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachOptionBtn} onPress={handlePickDocument} activeOpacity={0.7}>
              <View style={[styles.attachOptionIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.08)' }]}>
                <FileText size={22} color="#d97706" />
              </View>
              <Text style={styles.attachOptionLabel}>
                {getLabel('helpdesk.document', 'Belge', 'Document')}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.attachCancelBtn}
            onPress={() => setAttachMenuVisible(false)}
            activeOpacity={0.7}
          >
            <Text style={styles.attachCancelText}>
              {getLabel('helpdesk.cancel', 'Vazgeç', 'Cancel')}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Fullscreen Image Preview Modal
  const renderImagePreviewModal = () => (
    <Modal
      visible={previewImageUri !== null}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={() => setPreviewImageUri(null)}
    >
      <View style={styles.fullImageOverlay}>
        <TouchableOpacity
          style={styles.fullImageCloseBtn}
          onPress={() => setPreviewImageUri(null)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={24} color="#ffffff" />
        </TouchableOpacity>
        {previewImageUri && (
          <Image
            source={{ uri: previewImageUri }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        )}
      </View>
    </Modal>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: COMPOSE (NEW TICKET) VIEW — FLUID & RESPONSIVE
  // ─────────────────────────────────────────────────────────────────────────────
  // P2P WebRTC Direct Voice Call Handler
  const handleCallPress = useCallback(() => {
    setConfirmSheet({
      visible: true,
      title: language === 'tr' ? 'P2P Sesli Görüşme' : 'P2P Voice Call',
      description: language === 'tr'
        ? 'Uçtan uca şifreli (E2EE) doğrudan WebRTC sesli iletişim kanalı başlatılsın mı?'
        : 'Initiate end-to-end encrypted (E2EE) direct WebRTC voice call channel?',
      actionText: language === 'tr' ? 'Aramayı Başlat' : 'Start Call',
      actionColor: '#2563EB',
      cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
      onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
      onAction: () => {
        setConfirmSheet(prev => ({ ...prev, visible: false }));
      },
    });
  }, [language, getLabel]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: COMPOSE (NEW TICKET) VIEW — MODULAR
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
        />
        <AttachMenuModal
          visible={attachMenuVisible}
          onClose={() => setAttachMenuVisible(false)}
          onPickCamera={handlePickCamera}
          onPickGallery={handlePickGallery}
          onPickDocument={handlePickDocument}
          getLabel={getLabel}
        />
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
          sending={sending}
          language={language}
          getLabel={getLabel}
          formatWhiteId={formatWhiteId}
          formatAppId={formatAppId}
          formatTicketDate={formatTicketDate}
          getCategoryLabel={getCategoryLabel}
          onBack={handleBackToList}
          onToggleStatus={handleToggleStatus}
          onTicketLongPress={handleTicketLongPress}
          onOpenDocument={handleOpenDocument}
          onPreviewImage={(uri) => setPreviewImageUri(uri)}
          onPickCamera={handlePickCamera}
          onPickGallery={handlePickGallery}
          onPickDocument={handlePickDocument}
          onCallPress={handleCallPress}
          onReplyTicket={handleReplyTicket}
        />
        <AttachMenuModal
          visible={attachMenuVisible}
          onClose={() => setAttachMenuVisible(false)}
          onPickCamera={handlePickCamera}
          onPickGallery={handlePickGallery}
          onPickDocument={handlePickDocument}
          getLabel={getLabel}
        />
        <ImagePreviewModal
          visible={previewImageUri !== null}
          imageUri={previewImageUri}
          onClose={() => setPreviewImageUri(null)}
        />
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
        style={StyleSheet.absoluteFillObject}
        contentContainerStyle={[
          styles.scrollContainerFluid,
          {
            paddingTop: safeTop + 10,
            paddingBottom: 40 + Math.max(insets.bottom, 16),
          }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
        {/* WHITEDESK LOGO (NATURALLY SCROLLS UP AND PASSES UNDER 50% STATUS BAR) */}
        <View style={styles.scrollLogoRow}>
          <Text style={styles.logoText} numberOfLines={1} adjustsFontSizeToFit>WhiteDesk</Text>
        </View>

        {/* SAMSUNG ONE UI DIRECT ON CANVAS BACK BUTTON ROW */}
        <View style={styles.topBackHeaderRow}>
          <TouchableOpacity
            style={styles.samsungBackRow}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={22} color="#1E293B" strokeWidth={2.4} style={{ marginRight: 4 }} />
            <Text style={styles.samsungBackText}>
              {baseT('menu.helpDesk') || 'Destek'}
            </Text>
          </TouchableOpacity>

          {/* Right action buttons: Approvals Badge + Admin Guide (?) + Refresh icon + Security Badge (ShieldCheck) */}
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

            {isAdmin && (
              <TouchableOpacity
                style={[styles.refreshRoundBtn, { marginRight: 8 }]}
                onPress={() => setAdminGuideVisible(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <HelpCircle size={16} color="#475569" strokeWidth={2} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.refreshRoundBtn}
              onPress={loadData}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <RotateCcw size={16} color="#475569" strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.refreshRoundBtn, { marginLeft: 8 }]}
              onPress={() => (navigation as any).navigate('WhiteDeskScanner')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ScanLine size={16} color="#475569" strokeWidth={2} />
            </TouchableOpacity>

            {(adminRole === 'global_admin' || isFounder) && (
              <TouchableOpacity
                style={[
                  styles.refreshRoundBtn,
                  { marginLeft: 8, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }
                ]}
                onPress={handleLockPress}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ShieldCheck size={16} color="#3B82F6" strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* WHITE PANEL CONTAINER (NEW SUPPORT TICKET STYLE) */}
        <View style={styles.mainWhitePanel}>
          {/* SECTION HEADER ROW INSIDE PANEL */}
          <View style={styles.panelHeaderRow}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.titleIconBox}>
                <Headphones size={20} color="#1E293B" strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitleText}>
                  {isAdmin ? 'WhiteDesk Admin' : 'WhiteDesk'}
                </Text>
                <Text style={styles.sectionSubtitleText}>
                  {isAdmin 
                    ? (isFounder ? 'TheWhite Root Licensing & Multi-Tenant' : currentEnterpriseName)
                    : currentEnterpriseName}
                </Text>

                {/* "Kendinizi tanımlayın" with grey pencil icon */}
                <TouchableOpacity
                  style={styles.identifyRow}
                  onPress={() => {
                    setIdentityInput(customAlias || '');
                    setIdentityModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Edit3 size={12} color="#94A3B8" strokeWidth={2} style={{ marginRight: 4 }} />
                  <Text style={styles.identifyText}>
                    {customAlias ? customAlias : (language === 'tr' ? 'Kendinizi tanımlayın' : 'Identify yourself')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* FLUID ACTION BUTTON: Yeni Tartışma Başlat (for Admins) OR Yeni Destek Bileti (for Users) */}
          <TouchableOpacity
            style={styles.fluidNewTicketBtn}
            onPress={() => {
              setIsCreatingDiscussion(isAdmin);
              setEscalationTarget('none');
              setCurrentView('compose');
            }}
            activeOpacity={0.85}
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
            <Text style={styles.fluidNewTicketBtnText}>
              {isAdmin 
                ? getLabel('helpdesk.newDiscussion', 'Yeni Tartışma Başlat', 'Start New Discussion')
                : getLabel('helpdesk.newTicket', 'Yeni Destek Bileti', 'New Support Ticket')}
            </Text>
          </TouchableOpacity>

          {/* YEŞİL "YENİ BİR BİLET OLUŞTUR" BUTONU (TÜM ADMİNLER İÇİN KADEMELİ ESKALASYON) */}
          {isAdmin && (
            <TouchableOpacity
              style={[styles.fluidNewTicketBtn, styles.fluidAdminGreenBtn]}
              onPress={() => {
                setIsCreatingDiscussion(false);
                setEscalationTarget(isMasterAdmin ? 'thewhite' : 'global_admin');
                setComposeCategory(isMasterAdmin ? 'root_support' : 'internal_admin_ticket');
                setCurrentView('compose');
              }}
              activeOpacity={0.85}
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
              <Text style={styles.fluidNewTicketBtnText}>
                {isMasterAdmin
                  ? getLabel('helpdesk.newTicketTheWhite', 'Yeni Bir Bilet Oluştur (TheWhite Destek)', 'Create a New Ticket (TheWhite Support)')
                  : getLabel('helpdesk.newTicketAdmin', 'Yeni Bir Bilet Oluştur (Yöneticiye Talep)', 'Create a New Ticket (To Global Admin)')}
              </Text>
            </TouchableOpacity>
          )}

          {/* FLUID SEARCH BAR */}
          <View style={styles.fluidSearchBar}>
            <Search size={17} color="#94A3B8" strokeWidth={2} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.fluidSearchInput}
              placeholder={getLabel('helpdesk.searchPlaceholder', 'Bilet no veya konu ara...', 'Search by ticket no or subject...')}
              placeholderTextColor="#94A3B8"
              value={ticketSearchQuery}
              onChangeText={setTicketSearchQuery}
              returnKeyType="search"
            />
            {ticketSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setTicketSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* FILTER PILLS ROW */}
          <View style={styles.fluidFilterRow}>
            {(['all', 'open', 'answered', 'closed'] as const).map((filterKey) => {
              const isSelected = statusFilter === filterKey;
              const label = filterKey === 'all' 
                ? getLabel('helpdesk.filterAll', 'Tümü', 'All') 
                : filterKey === 'open' 
                  ? getLabel('helpdesk.filterOpen', 'Açık', 'Open') 
                  : filterKey === 'answered' 
                    ? getLabel('helpdesk.filterAnswered', 'Yanıtlandı', 'Answered') 
                    : getLabel('helpdesk.filterClosed', 'Kapalı', 'Closed');

              return (
                <TouchableOpacity
                  key={filterKey}
                  style={[styles.fluidFilterPill, isSelected && styles.fluidFilterPillActive]}
                  onPress={() => setStatusFilter(filterKey)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.fluidFilterPillText, isSelected && styles.fluidFilterPillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* TICKETS LIST */}
          {filteredTickets.length === 0 ? (
            <View style={styles.emptyContainerFluid}>
              <MessageSquare size={36} color="#CBD5E1" strokeWidth={1.5} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTextFluid}>
                {ticketSearchQuery.trim()
                  ? getLabel('helpdesk.emptySearch', 'Arama kriterlerinize uygun bilet bulunamadı.', 'No tickets match your search.')
                  : statusFilter !== 'all'
                    ? getLabel('helpdesk.emptyFilter', 'Bu filtrede destek bileti bulunmuyor.', 'No support tickets in this filter.')
                    : getLabel('helpdesk.emptyTickets', 'Henüz bir destek biletiniz yok.', 'No support tickets found.')}
              </Text>
            </View>
          ) : (
            <View style={styles.ticketsListWrapper}>
              {filteredTickets.map((ticket) => {
                return (
                  <TouchableOpacity
                    key={ticket.id}
                    style={styles.fluidTicketCard}
                    onPress={() => openTicketDetail(ticket)}
                    onLongPress={() => handleTicketLongPress(ticket)}
                    delayLongPress={200}
                    activeOpacity={0.75}
                  >
                    {/* Satır 1: ID, App Rozeti, Kategori Rozeti, Durum Rozeti */}
                    <View style={styles.cardHeaderTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.ticketIdMonoText}>#{ticket.id}</Text>
                        <View style={styles.appTagBadge}>
                          <Text style={styles.appTagBadgeText}>{formatAppId(ticket.app_id)}</Text>
                        </View>
                        {(() => {
                          const effectiveCat = ticket.is_discussion ? 'discussion' : ticket.category;
                          const tier = tierFromCategory(effectiveCat);
                          if (tier !== null) return <View style={{ marginLeft: 4 }}><AdminBadge tier={tier} size={13} /></View>;
                          return ticket.category && ticket.category !== 'general' ? (
                            <View style={styles.categoryBadge}>
                              <Text style={styles.categoryBadgeText}>{getCategoryLabel(ticket.category)}</Text>
                            </View>
                          ) : null;
                        })()}
                      </View>
                      {renderStatusPill(ticket.status)}
                    </View>

                    {/* Satır 2: Konu Başlığı */}
                    <Text style={styles.fluidTicketSubject} numberOfLines={2}>
                      {ticket.subject}
                    </Text>

                    {/* Satır 3: Son İşlem Tarihi */}
                    <Text style={styles.ticketDateMutedText}>
                      {getLabel('helpdesk.lastAction', 'Son işlem:', 'Updated:')} {formatTicketDate(ticket.updated_at || ticket.created_at, true)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* 1.5. DEDICATED WHITEDESK ADMIN OPERATIONAL MANUAL MODAL */}
      {isAdmin && (
        <Modal
          visible={adminGuideVisible}
          transparent={true}
          animationType="slide"
          statusBarTranslucent={true}
          onRequestClose={() => setAdminGuideVisible(false)}
        >
          <View style={styles.consoleModalOverlay}>
            <View style={styles.consoleModalContainer}>
              {/* Header */}
              <View style={styles.consoleHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={styles.consoleIconBox}>
                    <BookOpen size={20} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.consoleTitleText}>
                      {language === 'tr' ? 'WhiteDesk Yönetici Kılavuzu' : 'WhiteDesk Admin Guide'}
                    </Text>
                    <Text style={styles.consoleSubtitleText}>
                      {language === 'tr' ? 'Genesis, Provizyon ve İdari Operasyonlar' : 'Genesis, Provisioning & Admin Operations'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.consoleCloseBtn}
                  onPress={() => setAdminGuideVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Scrollable Guide Cards */}
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                {/* Section 1: Genesis Kurulumu */}
                <View style={styles.guideCard}>
                  <View style={styles.guideCardHeader}>
                    <View style={styles.guideNumberBadge}>
                      <Text style={styles.guideNumberText}>1</Text>
                    </View>
                    <Text style={styles.guideCardTitle}>
                      {language === 'tr' ? 'Genesis Kurulumu & İlk Sahiplenme' : 'Genesis Provisioning & First Claim'}
                    </Text>
                  </View>
                  <Text style={styles.guideCardBody}>
                    {language === 'tr'
                      ? 'Lisansörün terminalden ürettiği "enterprise_white_id" anahtarını destek bilet mesaj kutusuna "admin <enterprise_white_id>" yazarak gönderin. Neon PostgreSQL tabloları anında açılır, cihazınız Global Yönetici olarak tescil edilir ve şirket açık anahtarınız (org_pub) otomatik indirilir.'
                      : 'Submit "admin <enterprise_white_id>" in the ticket message box. Neon PostgreSQL tables are provisioned immediately, your device is elevated to Global Admin, and the organization public key (org_pub) is automatically downloaded.'}
                  </Text>
                </View>

                {/* Section 2: Bilet & Talep Yönetimi */}
                <View style={styles.guideCard}>
                  <View style={styles.guideCardHeader}>
                    <View style={styles.guideNumberBadge}>
                      <Text style={styles.guideNumberText}>2</Text>
                    </View>
                    <Text style={styles.guideCardTitle}>
                      {language === 'tr' ? 'Bilet (Ticket) Operasyonları' : 'Ticket Management Operations'}
                    </Text>
                  </View>
                  <Text style={styles.guideCardBody}>
                    {language === 'tr'
                      ? 'Gelen tüm biletleri listeleyin ve departman filtreleriyle inceleyin. Bilet detayına girerek yanıtlayabilir, ataş simgesiyle PDF belgesi veya fotoğraf ekleyebilirsiniz. Üst durum hapına dokunarak bilet durumunu tek tıkla Açık / Kapalı yapabilirsiniz.'
                      : 'Browse incoming tickets with department filters. Tap any ticket to view history, reply, or attach PDFs and images. Tap the status pill to toggle between Open and Closed.'}
                  </Text>
                </View>

                {/* Section 3: 3 Kademeli Provizyon Konsolu */}
                <View style={styles.guideCard}>
                  <View style={styles.guideCardHeader}>
                    <View style={styles.guideNumberBadge}>
                      <Text style={styles.guideNumberText}>3</Text>
                    </View>
                    <Text style={styles.guideCardTitle}>
                      {language === 'tr' ? '3 Kademeli Provizyon Konsolu' : '3-Tier Linear Provisioning'}
                    </Text>
                  </View>
                  <Text style={styles.guideCardBody}>
                    {language === 'tr'
                      ? 'Sağ üstteki kalkan simgesine basarak açılır. Kademe 1: Yönetici seçin veya "+ Yeni Yönetici Ekle" ile kör kimlik üzerinden operatör ekleyin (Global Admin / Admin). Kademe 2: Şube ve uygulama seçin. Kademe 3: Görebileceği kategorileri seçip yetkilendirin.'
                      : 'Access via the top-right Shield badge. Tier 1: Select or add an admin via blind-ID. Tier 2: Choose branch and application. Tier 3: Assign department categories.'}
                  </Text>
                </View>

                {/* Section 4: Personel Bağlama */}
                <View style={styles.guideCard}>
                  <View style={styles.guideCardHeader}>
                    <View style={styles.guideNumberBadge}>
                      <Text style={styles.guideNumberText}>4</Text>
                    </View>
                    <Text style={styles.guideCardTitle}>
                      {language === 'tr' ? 'Personel & Kullanıcı Bağlantısı' : 'Staff & User Onboarding'}
                    </Text>
                  </View>
                  <Text style={styles.guideCardBody}>
                    {language === 'tr'
                      ? 'Kurulumda inen "org_pub" açık anahtarını personellerinize iletin. Personeller mesaj kutusuna "user <org_pub>" yazdıklarında yetkisiz son kullanıcı olarak şirket masasına bağlanır ve departman biletleri açabilir.'
                      : 'Share the "org_pub" certificate with your staff. Employees submit "user <org_pub>" in their ticket window to connect to the organization helpdesk as regular users.'}
                  </Text>
                </View>

                {/* Section 5: Afet Kurtarma & Cihaz Kaybı */}
                <View style={styles.guideCard}>
                  <View style={styles.guideCardHeader}>
                    <View style={styles.guideNumberBadge}>
                      <Text style={styles.guideNumberText}>5</Text>
                    </View>
                    <Text style={styles.guideCardTitle}>
                      {language === 'tr' ? 'Afet Kurtarma & Cihaz Değişimi' : 'Disaster Recovery & Transfer'}
                    </Text>
                  </View>
                  <Text style={styles.guideCardBody}>
                    {language === 'tr'
                      ? 'Cihaz kaybolduğunda ve 12 kelimelik tohum yedeği olmadığında: Yeni telefondaki WhiteID lisansöre bildirilir. Lisansör terminalden "wd run admin transfer org:\"<Firma>\" to:\"<YeniWhiteID>\"" çalıştırır. Geçmiş tüm biletler, şubeler ve ayarlar 0 byte veri kaybıyla yeni cihaza aktarılır.'
                      : 'If your device and 12-word seed are lost: Share your new WhiteID with the licensor. The licensor runs "wd run admin transfer". All historical tickets and allocations are preserved with zero data loss.'}
                  </Text>
                </View>

                {/* Section 6: Sıfır-Bilgi & Kör Kimlik */}
                <View style={styles.guideCard}>
                  <View style={styles.guideCardHeader}>
                    <View style={styles.guideNumberBadge}>
                      <Text style={styles.guideNumberText}>6</Text>
                    </View>
                    <Text style={styles.guideCardTitle}>
                      {language === 'tr' ? 'Sıfır-Bilgi (Zero-Knowledge) Güvencesi' : 'Zero-Knowledge Security Assurance'}
                    </Text>
                  </View>
                  <Text style={styles.guideCardBody}>
                    {language === 'tr'
                      ? 'Sistemde hiçbir merkezi ana şifre bulunmaz. Veritabanına hiçbir zaman açık WhiteID yazılmaz; tüm kimlikler tek yönlü HMAC-SHA256 (blind_id) ile saklanır.'
                      : 'Zero centralized master passwords. WhiteIDs are never stored in plaintext; all identities are blinded irreversibly via HMAC-SHA256.'}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* 2. GEMINI-STYLE SPACIOUS GLOBAL ADMIN MANAGEMENT CONSOLE */}
      <Modal
        visible={consoleVisible}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setConsoleVisible(false)}
      >
        <View style={styles.consoleModalOverlay}>
          <View style={styles.consoleModalContainer}>
            {/* Header */}
            <View style={styles.consoleHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={[styles.consoleIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <ShieldCheck size={20} color="#2563EB" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.consoleTitleText}>
                    {language === 'tr' ? 'Yönetim & Kiracı Masası' : 'Tenant & Admin Station'}
                  </Text>
                  <Text style={styles.consoleSubtitleText} numberOfLines={1}>
                    {currentEnterpriseName} • WhiteCosmos (*)
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.consoleCloseBtn}
                onPress={() => setConsoleVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Scrollable Gemini Accordion Sections */}
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {/* --- BÖLÜM 1: KIRACI BİLGİLERİ (GEMINI ACCORDION) --- */}
              <View style={styles.geminiCard}>
                <TouchableOpacity
                  style={styles.geminiCardHeader}
                  onPress={() => setExpandedGeminiSection(prev => prev === 'tenant' ? null : 'tenant')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.geminiIconCircle, { backgroundColor: '#EFF6FF' }]}>
                    <Building2 size={20} color="#2563EB" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.geminiCardTitle}>Kurum & Kiracı Bilgileri</Text>
                    <Text style={styles.geminiCardSubtitle}>Sovereign mülkiyet ve bağlantı detayları</Text>
                  </View>
                  <View style={styles.geminiStatusPill}>
                    <Text style={styles.geminiStatusPillText}>Mühürlü</Text>
                  </View>
                  {expandedGeminiSection === 'tenant' ? (
                    <ChevronUp size={20} color="#64748B" style={{ marginLeft: 6 }} />
                  ) : (
                    <ChevronDown size={20} color="#64748B" style={{ marginLeft: 6 }} />
                  )}
                </TouchableOpacity>

                {expandedGeminiSection === 'tenant' && (
                  <View style={styles.geminiCardBody}>
                    <View style={styles.infoRowItem}>
                      <Text style={styles.infoRowLabel}>Kurum Adı</Text>
                      <Text style={styles.infoRowValue}>{currentEnterpriseName}</Text>
                    </View>

                    <View style={styles.infoRowItem}>
                      <Text style={styles.infoRowLabel}>Kör Kimlik (Blind ID)</Text>
                      <TouchableOpacity 
                        style={styles.copyChipRow}
                        onPress={async () => {
                          const id = activeEnterpriseBlindId || 'default';
                          await Clipboard.setStringAsync(id);
                          setCopiedConsoleHash(id);
                          setTimeout(() => setCopiedConsoleHash(null), 2000);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.copyChipText} numberOfLines={1} ellipsizeMode="middle">
                          {activeEnterpriseBlindId || 'default'}
                        </Text>
                        <Copy size={13} color="#2563EB" style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.infoRowItem}>
                      <Text style={styles.infoRowLabel}>Yönetici Yetkisi</Text>
                      <Text style={[styles.infoRowValue, { color: '#2563EB', fontWeight: '800' }]}>
                        WhiteCosmos (*) Global Admin
                      </Text>
                    </View>

                    <View style={styles.infoRowItem}>
                      <Text style={styles.infoRowLabel}>Protokol</Text>
                      <Text style={styles.infoRowValue}>Neon HTTPS • Sıfır Kişisel Veri • E2EE</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* --- BÖLÜM 2: LİSANS & ABONELİK (GEMINI ACCORDION) --- */}
              <View style={styles.geminiCard}>
                <TouchableOpacity
                  style={styles.geminiCardHeader}
                  onPress={() => setExpandedGeminiSection(prev => prev === 'license' ? null : 'license')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.geminiIconCircle, { backgroundColor: '#ECFDF5' }]}>
                    <Sparkles size={20} color="#059669" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.geminiCardTitle}>Lisans & Kotalar</Text>
                    <Text style={styles.geminiCardSubtitle}>14 gün deneme, koltuklar ve paketler</Text>
                  </View>
                  <View style={[styles.geminiStatusPill, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={[styles.geminiStatusPillText, { color: '#15803D' }]}>14 Gün Deneme</Text>
                  </View>
                  {expandedGeminiSection === 'license' ? (
                    <ChevronUp size={20} color="#64748B" style={{ marginLeft: 6 }} />
                  ) : (
                    <ChevronDown size={20} color="#64748B" style={{ marginLeft: 6 }} />
                  )}
                </TouchableOpacity>

                {expandedGeminiSection === 'license' && (
                  <View style={styles.geminiCardBody}>
                    {/* CANLI KOTA SAYAÇLARI */}
                    <View style={styles.quotaCountersRow}>
                      <View style={styles.quotaBox}>
                        <Text style={styles.quotaBoxNumber}>{tenantStats.adminCount} / 3</Text>
                        <Text style={styles.quotaBoxLabel}>Operatör Koltuğu</Text>
                      </View>
                      <View style={styles.quotaBox}>
                        <Text style={styles.quotaBoxNumber}>{tenantStats.userCount} / 10</Text>
                        <Text style={styles.quotaBoxLabel}>Müşteri Kotası</Text>
                      </View>
                    </View>

                    {/* HIZLI İLAVE HASH ÜRETİMİ (ADD-ON) */}
                    <Text style={styles.subSectionHeader}>Hızlı İlave Hash Üret (Store Add-on)</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                      <TouchableOpacity
                        style={styles.addonActionBtn}
                        onPress={async () => {
                          const res = await helpDeskService.generateNewAdminHash(activeEnterpriseBlindId || 'default', 1);
                          if (res.success && res.hash) {
                            await Clipboard.setStringAsync(res.hash);
                            setGeneratedOperatorHash(res.hash);
                            setCopiedConsoleHash(res.hash);
                            setTimeout(() => setCopiedConsoleHash(null), 3500);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <UserPlus size={14} color="#2563EB" style={{ marginRight: 4 }} />
                        <Text style={styles.addonActionBtnText}>+1 Operatör ($9)</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.addonActionBtn}
                        onPress={async () => {
                          const res = await helpDeskService.generateNewUserHash(activeEnterpriseBlindId || 'default', 25);
                          if (res.success && res.hash) {
                            await Clipboard.setStringAsync(res.hash);
                            setGeneratedUserHash(res.hash);
                            setCopiedConsoleHash(res.hash);
                            setTimeout(() => setCopiedConsoleHash(null), 3500);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Users size={14} color="#2563EB" style={{ marginRight: 4 }} />
                        <Text style={styles.addonActionBtnText}>+25 Müşteri ($9)</Text>
                      </TouchableOpacity>
                    </View>

                    {copiedConsoleHash && (
                      <View style={styles.copiedBanner}>
                        <Check size={14} color="#16A34A" style={{ marginRight: 6 }} />
                        <Text style={styles.copiedBannerText} numberOfLines={1}>
                          Yeni Hash Kopyalandı: {copiedConsoleHash}
                        </Text>
                      </View>
                    )}

                    {/* ABONELİK PLANLARI BİLGİ KARTLARI */}
                    <Text style={[styles.subSectionHeader, { marginTop: 12 }]}>Abonelik Paketleri</Text>
                    <View style={styles.tierPlanBox}>
                      <Text style={styles.tierPlanName}>🥉 Starter</Text>
                      <Text style={styles.tierPlanPrice}>$19/ay · $190/yıl</Text>
                      <Text style={styles.tierPlanDesc}>1 Admin + 1 Operatör + 25 Müşteri</Text>
                    </View>

                    <View style={[styles.tierPlanBox, styles.tierPlanBoxPro]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.tierPlanName}>🥈 Pro ⭐</Text>
                        <Text style={styles.popularBadge}>Önerilen</Text>
                      </View>
                      <Text style={styles.tierPlanPrice}>$49/ay · $490/yıl</Text>
                      <Text style={styles.tierPlanDesc}>1 Admin + 3 Operatör + 100 Müşteri</Text>
                    </View>

                    <View style={styles.tierPlanBox}>
                      <Text style={styles.tierPlanName}>🥇 Enterprise</Text>
                      <Text style={styles.tierPlanPrice}>$149/ay · $1.490/yıl</Text>
                      <Text style={styles.tierPlanDesc}>1 Admin + 10 Operatör + 500 Müşteri</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* --- BÖLÜM 3: YETKİLENDİRME & OPERATÖRLER (GEMINI ACCORDION) --- */}
              <View style={styles.geminiCard}>
                <TouchableOpacity
                  style={styles.geminiCardHeader}
                  onPress={() => setExpandedGeminiSection(prev => prev === 'operators' ? null : 'operators')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.geminiIconCircle, { backgroundColor: '#EEF2FF' }]}>
                    <Users size={20} color="#4F46E5" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.geminiCardTitle}>Yetkilendirme & Ekip</Text>
                    <Text style={styles.geminiCardSubtitle}>Destek operatörleri ve departmanlar</Text>
                  </View>
                  <View style={[styles.geminiStatusPill, { backgroundColor: '#E0E7FF' }]}>
                    <Text style={[styles.geminiStatusPillText, { color: '#4338CA' }]}>{adminsList.length} Personel</Text>
                  </View>
                  {expandedGeminiSection === 'operators' ? (
                    <ChevronUp size={20} color="#64748B" style={{ marginLeft: 6 }} />
                  ) : (
                    <ChevronDown size={20} color="#64748B" style={{ marginLeft: 6 }} />
                  )}
                </TouchableOpacity>

                {expandedGeminiSection === 'operators' && (
                  <View style={styles.geminiCardBody}>
                    <Text style={styles.subSectionHeader}>Masadaki Aktif Yöneticiler</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {adminsList.map((adm) => {
                        const isSelected = selectedAdminId === adm.white_id;
                        return (
                          <TouchableOpacity
                            key={adm.white_id}
                            style={[styles.adminPill, isSelected && styles.adminPillSelected]}
                            onPress={() => setSelectedAdminId(adm.white_id)}
                            onLongPress={() => handleRemoveAdmin(adm.white_id)}
                            delayLongPress={500}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.adminPillAlias, isSelected && styles.adminPillAliasSelected]}>
                              {adm.alias || 'Admin'}
                            </Text>
                            <Text style={[styles.adminPillId, isSelected && styles.adminPillIdSelected]}>
                              {adm.role === 'global_admin' ? 'WhiteCosmos' : adm.role}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <TouchableOpacity
                      style={styles.addOpBtn}
                      onPress={async () => {
                        const res = await helpDeskService.generateNewAdminHash(activeEnterpriseBlindId || 'default', 1);
                        if (res.success && res.hash) {
                          await Clipboard.setStringAsync(res.hash);
                          setCopiedConsoleHash(res.hash);
                          setTimeout(() => setCopiedConsoleHash(null), 3500);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <UserPlus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.addOpBtnText}>Yeni Operatör Davet Hash'i Üret & Kopyala</Text>
                    </TouchableOpacity>

                    {/* Departman Yetki Matrisi */}
                    <Text style={[styles.subSectionHeader, { marginTop: 14 }]}>Departman Yetki Matrisi</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      <TouchableOpacity
                        style={[styles.catPill, selectedCatIds.includes('all') && styles.catPillSelected]}
                        onPress={() => handleToggleCategory('all')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.catPillText, selectedCatIds.includes('all') && styles.catPillTextSelected]}>
                          {t('all')}
                        </Text>
                      </TouchableOpacity>
                      {currentAppCategories.map((cat) => {
                        const isSelected = selectedCatIds.includes(cat.id);
                        return (
                          <TouchableOpacity
                            key={cat.id}
                            style={[styles.catPill, isSelected && styles.catPillSelected]}
                            onPress={() => handleToggleCategory(cat.id)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.catPillText, isSelected && styles.catPillTextSelected]}>
                              {cat.labelTr || cat.id}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <TouchableOpacity
                      style={[styles.fluidSubmitBtn, styles.fluidSubmitBtnActive, { paddingVertical: 12 }]}
                      onPress={handleSaveAllocationSubmit}
                      activeOpacity={0.8}
                    >
                      <CheckCircle2 size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={[styles.fluidSubmitBtnText, { fontSize: 13 }]}>Yetkiyi Kaydet</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* SUB-MODAL: ADD NEW ORGANIZATION (COSMOS ROOT ONLY) */}
      <Modal
        visible={addOrgModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setAddOrgModalVisible(false)}
      >
        <View style={styles.attachModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setAddOrgModalVisible(false)}
          />
          <KeyboardAvoidingView
            behavior='padding'
            pointerEvents="box-none"
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.attachModalContainer, { maxWidth: 420 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Building2 size={20} color="#3B82F6" style={{ marginRight: 8 }} />
                <Text style={styles.attachModalTitle}>
                  {language === 'tr' ? 'Yeni Organizasyon Ekle' : 'Add New Organization'}
                </Text>
              </View>

              <Text style={[styles.allocCatsText, { marginBottom: 14, color: '#64748B' }]}>
                {language === 'tr' 
                  ? 'Cosmos Makamı: Yeni bir firma / holding organizasyonu tanımlayınız.' 
                  : 'Cosmos Authority: Define a new company / holding organization.'}
              </Text>

              <TextInput
                style={[styles.composeInputField, { marginBottom: 10 }]}
                placeholder={language === 'tr' ? 'Organizasyon Kodu (Örn: elektroser, holding_a)' : 'Org Code (e.g. elektroser)'}
                placeholderTextColor="#94a3b8"
                value={newOrgIdInput}
                onChangeText={setNewOrgIdInput}
                autoFocus={true}
                autoCapitalize="none"
              />

              <TextInput
                style={[styles.composeInputField, { marginBottom: 16 }]}
                placeholder={language === 'tr' ? 'Firma / Kurum Adı (Örn: Elektroser A.Ş.)' : 'Org Name (e.g. Elektroser Corp)'}
                placeholderTextColor="#94a3b8"
                value={newOrgNameInput}
                onChangeText={setNewOrgNameInput}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.attachCancelBtn, { flex: 1, marginTop: 0 }]}
                  onPress={() => {
                    setAddOrgModalVisible(false);
                    setNewOrgIdInput('');
                    setNewOrgNameInput('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.attachCancelText}>
                    {getLabel('common.cancel', 'Vazgeç', 'Cancel')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.fluidSubmitBtn,
                    { flex: 1, paddingVertical: 12 },
                    newOrgIdInput.trim().length > 0 && styles.fluidSubmitBtnActive
                  ]}
                  onPress={handleAddCustomOrgSubmit}
                  disabled={!newOrgIdInput.trim()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.fluidSubmitBtnText}>
                    {getLabel('helpdesk.addBtn', 'Ekle', 'Add')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* APP REGISTRATION MODAL */}
      <Modal
        visible={appRegModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setAppRegModalVisible(false)}
      >
        <View style={[styles.consoleModalOverlay, { justifyContent: 'center', padding: 24 }]}>
          <KeyboardAvoidingView behavior='padding' style={{ width: '100%' }}>
            <View style={[styles.attachModalContainer, { maxWidth: 440 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <ShieldCheck size={20} color="#3B82F6" style={{ marginRight: 8 }} />
                <Text style={styles.attachModalTitle}>
                  {language === 'tr' ? 'Uygulama Kaydı' : 'App Registration'}
                </Text>
              </View>

              {/* Status: unregistered → show form */}
              {(appRegStatus === 'unregistered' || appRegStatus === null) && (
                <>
                  <Text style={[styles.allocCatsText, { marginBottom: 14, color: '#374151' }]}>
                    {t('helpdesk.appNotRegisteredDesc', { appId: CURRENT_APP_ID })}
                  </Text>
                  <TextInput
                    style={[styles.composeInputField, { marginBottom: 10 }]}
                    placeholder={t('helpdesk.appNamePlaceholder')}
                    placeholderTextColor="#94a3b8"
                    value={appRegNameInput}
                    onChangeText={setAppRegNameInput}
                    autoFocus={true}
                  />
                  <TextInput
                    style={[styles.composeInputField, { marginBottom: 16 }]}
                    placeholder={t('helpdesk.appDescPlaceholder')}
                    placeholderTextColor="#94a3b8"
                    value={appRegDescInput}
                    onChangeText={setAppRegDescInput}
                  />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.attachCancelBtn, { flex: 1, marginTop: 0 }]}
                      onPress={() => setAppRegModalVisible(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.attachCancelText}>{language === 'tr' ? 'Vazgeç' : 'Cancel'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.fluidSubmitBtn, styles.fluidSubmitBtnActive, { flex: 1, paddingVertical: 12 }]}
                      onPress={handleSubmitAppRegistration}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.fluidSubmitBtnText}>{language === 'tr' ? 'Talep Gönder' : 'Send Request'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Status: pending */}
              {appRegStatus === 'pending' && (
                <>
                  <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
                      <Clock size={26} color="#F59E0B" />
                    </View>
                    <Text style={[styles.attachModalTitle, { textAlign: 'center', marginBottom: 8 }]}>
                      {language === 'tr' ? 'Talebiniz İnceleniyor' : 'Request Under Review'}
                    </Text>
                    <Text style={[styles.allocCatsText, { textAlign: 'center', color: '#64748B' }]}>
                      {language === 'tr'
                        ? 'TheWhite veya WhiteCosmos talebinizi inceleyecek. Onaylandıktan sonra konsol aktif olacak.'
                        : 'TheWhite or WhiteCosmos will review your request. Console will be activated upon approval.'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.attachCancelBtn, { marginTop: 0 }]}
                    onPress={() => setAppRegModalVisible(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.attachCancelText}>{language === 'tr' ? 'Kapat' : 'Close'}</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Status: rejected */}
              {appRegStatus === 'rejected' && (
                <>
                  <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
                      <X size={26} color="#DC2626" />
                    </View>
                    <Text style={[styles.attachModalTitle, { textAlign: 'center', marginBottom: 8, color: '#DC2626' }]}>
                      {language === 'tr' ? 'Talep Reddedildi' : 'Request Rejected'}
                    </Text>
                    <Text style={[styles.allocCatsText, { textAlign: 'center', color: '#64748B' }]}>
                      {language === 'tr'
                        ? 'Talebiniz reddedildi. Detay için TheWhite ile iletişime geçin.'
                        : 'Your request was rejected. Please contact TheWhite for details.'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.attachCancelBtn, { marginTop: 0 }]}
                    onPress={() => setAppRegModalVisible(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.attachCancelText}>{language === 'tr' ? 'Kapat' : 'Close'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* 3. SUB-MODAL: ADD NEW ADMIN / TICKET ADMIN AUTHORIZATION */}
      <Modal
        visible={addAdminModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => {
          setAddAdminModalVisible(false);
          setAssigningTicket(null);
        }}
      >
        <View style={styles.attachModalOverlay}>
          {/* Backdrop Touch Dismiss Sibling */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setAddAdminModalVisible(false);
              setAssigningTicket(null);
            }}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
            style={{ width: '100%', alignItems: 'center', zIndex: 10 }}
          >
            <View style={[styles.attachModalContainer, { maxWidth: 440 }]}>
              {/* TOP HEADER ROW: Left-aligned title + Ticket No Badge (no long hash) */}
              <View style={styles.authModalHeaderRow}>
                <Text style={styles.authModalTitleLeft}>
                  {assigningTicket 
                    ? 'Admin Authorization' 
                    : getLabel('helpdesk.newAdminModalTitle', 'Yeni Yönetici Ekle', 'Add New Admin')}
                </Text>
                {assigningTicket && (
                  <View style={styles.ticketBadgeBox}>
                    <Text style={styles.ticketBadgeText}>#{assigningTicket.id}</Text>
                  </View>
                )}
              </View>

              {assigningTicket ? (
                <>
                  {/* APP SELECTOR */}
                  <View style={styles.modalSectionBox}>
                    <Text style={styles.modalFieldLabel}>
                      {language === 'tr' ? 'Uygulama' : 'Application'}
                    </Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.modalChipsScroll}
                    >
                      {/* Option: All (*) */}
                      <TouchableOpacity
                        style={[
                          styles.modalChipPill,
                          assignAppId === '*' && styles.modalChipPillActive,
                        ]}
                        onPress={() => setAssignAppId('*')}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.modalChipPillText,
                          assignAppId === '*' && styles.modalChipPillTextActive,
                        ]}>
                          🌐 {language === 'tr' ? 'Tümü (*)' : 'All (*)'}
                        </Text>
                      </TouchableOpacity>

                      {/* Option: inWhite */}
                      <TouchableOpacity
                        style={[
                          styles.modalChipPill,
                          assignAppId === 'inwhite' && styles.modalChipPillActive,
                        ]}
                        onPress={() => setAssignAppId('inwhite')}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.modalChipPillText,
                          assignAppId === 'inwhite' && styles.modalChipPillTextActive,
                        ]}>
                          inWhite
                        </Text>
                      </TouchableOpacity>

                      {/* Dynamic other apps from appsList */}
                      {appsList
                        .filter(a => a.app_id.toLowerCase() !== 'inwhite')
                        .map(app => (
                          <TouchableOpacity
                            key={app.app_id}
                            style={[
                              styles.modalChipPill,
                              assignAppId === app.app_id && styles.modalChipPillActive,
                            ]}
                            onPress={() => setAssignAppId(app.app_id)}
                            activeOpacity={0.7}
                          >
                            <Text style={[
                              styles.modalChipPillText,
                              assignAppId === app.app_id && styles.modalChipPillTextActive,
                            ]}>
                              {formatAppId(app.app_id)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </View>

                  {/* CATEGORY SELECTOR (HORIZONTAL SWIPEABLE CHIPS) */}
                  <View style={styles.modalSectionBox}>
                    <Text style={styles.modalFieldLabel}>
                      {language === 'tr' ? 'Kategori' : 'Category'}
                    </Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.modalChipsScroll}
                    >
                      {/* Option: All (*) */}
                      <TouchableOpacity
                        style={[
                          styles.modalChipPill,
                          assignCatId === '*' && styles.modalChipPillActive,
                        ]}
                        onPress={() => setAssignCatId('*')}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.modalChipPillText,
                          assignCatId === '*' && styles.modalChipPillTextActive,
                        ]}>
                          🌐 {language === 'tr' ? 'Tümü (*)' : 'All (*)'}
                        </Text>
                      </TouchableOpacity>

                      {/* Categories for chosen app */}
                      {modalAppCategories.map(cat => {
                        const isSelected = assignCatId === cat.id;
                        const label = language === 'tr' ? cat.labelTr : cat.labelEn;
                        return (
                          <TouchableOpacity
                            key={cat.id}
                            style={[
                              styles.modalChipPill,
                              isSelected && styles.modalChipPillActive,
                            ]}
                            onPress={() => setAssignCatId(cat.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={[
                              styles.modalChipPillText,
                              isSelected && styles.modalChipPillTextActive,
                            ]}>
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </>
              ) : (
                /* Non-ticket manual admin add: show WhiteID input */
                <TextInput
                  style={[styles.composeInputField, { marginBottom: 12 }]}
                  placeholder={getLabel('helpdesk.newAdminIdPlaceholder', 'WhiteID (Örn: 0362bed5...)', 'WhiteID')}
                  placeholderTextColor="#94a3b8"
                  value={newAdminIdInput}
                  onChangeText={setNewAdminIdInput}
                  autoFocus={true}
                />
              )}

              {/* NAME / ALIAS INPUT WITH SUGGEST BUTTON */}
              <View style={[styles.modalSectionBox, { marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.modalFieldLabel}>
                    {language === 'tr' ? 'İsim / Kod Adı' : 'Name / Alias'}
                  </Text>
                  <TouchableOpacity
                    onPress={handleSuggestNextCount}
                    onLongPress={handleSuggestCyclePrefix}
                    delayLongPress={300}
                    activeOpacity={0.7}
                    style={styles.suggestPillBtn}
                  >
                    <Sparkles size={12} color="#3B82F6" style={{ marginRight: 4 }} />
                    <Text style={styles.suggestPillBtnText}>
                      Suggest
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[styles.composeInputField, { borderColor: newAdminAliasInput ? '#BFDBFE' : '#E2E8F0' }]}
                  placeholder={getLabel('helpdesk.newAdminAliasPlaceholder', 'İsim / Kod Adı (Örn: Planet-1, Ahmet)', 'Name / Alias (e.g. Planet-1, Ahmet)')}
                  placeholderTextColor="#94a3b8"
                  value={newAdminAliasInput}
                  onChangeText={setNewAdminAliasInput}
                />
                <Text style={styles.suggestHintText}>
                  {language === 'tr' 
                    ? '💡 Suggest: Dokun: +1 | Uzun bas: Planet, Orbit...' 
                    : '💡 Suggest: Tap: +1 | Long-press: Planet, Orbit...'}
                </Text>
              </View>

              {/* ACTION BUTTONS */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.attachCancelBtn, { flex: 1, marginTop: 0 }]}
                  onPress={() => {
                    setAddAdminModalVisible(false);
                    setAssigningTicket(null);
                    setNewAdminIdInput('');
                    setNewAdminAliasInput('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.attachCancelText}>
                    {getLabel('common.cancel', 'Vazgeç', 'Cancel')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.fluidSubmitBtn,
                    { flex: 1.2, paddingVertical: 12 },
                    (newAdminIdInput.trim().length > 0 || assigningTicket) && styles.fluidSubmitBtnActive
                  ]}
                  onPress={handleAddCustomAdminSubmit}
                  disabled={!newAdminIdInput.trim() && !assigningTicket}
                  activeOpacity={0.7}
                >
                  <Text style={styles.fluidSubmitBtnText}>
                    {assigningTicket 
                      ? getLabel('helpdesk.assignAdminBtn', 'Yetkilendir ve Mühürle', 'Authorize & Seal')
                      : getLabel('helpdesk.addBtn', 'Ekle', 'Add')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* 4. SUB-MODAL: ADD NEW APP */}
      <Modal
        visible={addAppModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setAddAppModalVisible(false)}
      >
        <View style={styles.attachModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setAddAppModalVisible(false)}
          />
          <KeyboardAvoidingView
            behavior='padding'
            pointerEvents="box-none"
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.attachModalContainer, { maxWidth: 420 }]}>
              <Text style={styles.attachModalTitle}>
                {getLabel('helpdesk.newAppModalTitle', 'Yeni Uygulama Kaydet', 'Register New Application')}
              </Text>

              <TextInput
                style={[styles.composeInputField, { marginBottom: 16 }]}
                placeholder={getLabel('helpdesk.newAppIdPlaceholder', 'Uygulama Kodu (Örn: crm_portal, mobil_app)', 'App Code (e.g. crm_portal)')}
                placeholderTextColor="#94a3b8"
                value={newAppIdInput}
                onChangeText={setNewAppIdInput}
                autoFocus={true}
                autoCapitalize="none"
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.attachCancelBtn, { flex: 1, marginTop: 0 }]}
                  onPress={() => {
                    setAddAppModalVisible(false);
                    setNewAppIdInput('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.attachCancelText}>
                    {getLabel('common.cancel', 'Vazgeç', 'Cancel')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.fluidSubmitBtn,
                    { flex: 1, paddingVertical: 12 },
                    newAppIdInput.trim().length > 0 && styles.fluidSubmitBtnActive
                  ]}
                  onPress={handleAddCustomAppSubmit}
                  disabled={!newAppIdInput.trim()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.fluidSubmitBtnText}>
                    {getLabel('helpdesk.addBtn', 'Ekle', 'Add')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* 5. SUB-MODAL: ADD NEW CATEGORY */}
      <Modal
        visible={addCatModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setAddCatModalVisible(false)}
      >
        <View style={styles.attachModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setAddCatModalVisible(false)}
          />
          <KeyboardAvoidingView
            behavior='padding'
            pointerEvents="box-none"
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.attachModalContainer, { maxWidth: 420 }]}>
              <Text style={styles.attachModalTitle}>
                {getLabel('helpdesk.newCatModalTitle', 'Yeni Kategori Ekle', 'Add New Category')}
              </Text>
              <Text style={[styles.attachModalSubtitle, { marginBottom: 12 }]}>
                {formatAppId(selectedAppId)}
              </Text>

              <TextInput
                style={[styles.composeInputField, { marginBottom: 10 }]}
                placeholder={getLabel('helpdesk.newCatIdPlaceholder', 'Kategori Kodu (Örn: billing, kargo)', 'Category Code (e.g. billing, cargo)')}
                placeholderTextColor="#94a3b8"
                value={newCatIdInput}
                onChangeText={setNewCatIdInput}
                autoFocus={true}
                autoCapitalize="none"
              />

              <TextInput
                style={[styles.composeInputField, { marginBottom: 16 }]}
                placeholder={getLabel('helpdesk.newCatTrPlaceholder', 'Kategori Adı (Örn: Fatura & Ödemeler)', 'Category Label')}
                placeholderTextColor="#94a3b8"
                value={newCatTrInput}
                onChangeText={setNewCatTrInput}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.attachCancelBtn, { flex: 1, marginTop: 0 }]}
                  onPress={() => {
                    setAddCatModalVisible(false);
                    setNewCatIdInput('');
                    setNewCatTrInput('');
                    setNewCatEnInput('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.attachCancelText}>
                    {getLabel('common.cancel', 'Vazgeç', 'Cancel')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.fluidSubmitBtn,
                    { flex: 1, paddingVertical: 12 },
                    newCatIdInput.trim().length > 0 && styles.fluidSubmitBtnActive
                  ]}
                  onPress={handleAddCustomCategorySubmit}
                  disabled={!newCatIdInput.trim()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.fluidSubmitBtnText}>
                    {getLabel('helpdesk.addBtn', 'Ekle', 'Add')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* 6. MODAL: IDENTITY MODAL (KENDİNİZİ TANIMLAYIN) */}
      <Modal
        visible={identityModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setIdentityModalVisible(false)}
      >
        <View style={styles.attachModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIdentityModalVisible(false)}
          />
          <KeyboardAvoidingView
            behavior='padding'
            pointerEvents="box-none"
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View style={[styles.attachModalContainer, { maxWidth: 420 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Edit3 size={18} color="#3B82F6" style={{ marginRight: 8 }} />
                <Text style={styles.attachModalTitle}>
                  {language === 'tr' ? 'Kendinizi Tanımlayın' : 'Identify Yourself'}
                </Text>
              </View>
              <Text style={[styles.attachModalSubtitle, { marginBottom: 14 }]}>
                {language === 'tr' 
                  ? 'Destek biletlerinde ve admin panellerinde görünecek adınızı, rumuzunuzu veya unvanınızı belirleyin.'
                  : 'Set your name, nickname, or operational title visible in support tickets and admin panels.'}
              </Text>

              <TextInput
                style={[styles.composeInputField, { marginBottom: 16 }]}
                placeholder={language === 'tr' ? 'Örn: Mustafa ERYILMAZ, Tech Lead vb.' : 'e.g. John Doe, Tech Lead etc.'}
                placeholderTextColor="#94a3b8"
                value={identityInput}
                onChangeText={setIdentityInput}
                autoFocus={true}
                autoCapitalize="words"
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.attachCancelBtn, { flex: 1, marginTop: 0 }]}
                  onPress={() => setIdentityModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.attachCancelText}>
                    {getLabel('common.cancel', 'Vazgeç', 'Cancel')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.fluidSubmitBtn,
                    { flex: 1, paddingVertical: 12 },
                    identityInput.trim().length > 0 && styles.fluidSubmitBtnActive
                  ]}
                  onPress={handleIdentitySave}
                  activeOpacity={0.7}
                >
                  <Text style={styles.fluidSubmitBtnText}>
                    {getLabel('common.save', 'Kaydet', 'Save')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* 7. MODAL: PENDING APPROVALS (BEKLEYEN YETKİ ONAYLARI) */}
      <Modal
        visible={approvalsModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setApprovalsModalVisible(false)}
      >
        <View style={styles.attachModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setApprovalsModalVisible(false)}
          />
          <View style={[styles.attachModalContainer, { maxWidth: 460, maxHeight: '80%' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <UserCheck size={18} color="#D97706" style={{ marginRight: 8 }} />
                <Text style={styles.attachModalTitle}>
                  {language === 'tr' ? 'Bekleyen Yetki Onayları' : 'Pending Approvals'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setApprovalsModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {pendingApprovals.length === 0 ? (
                <Text style={{ textAlign: 'center', color: '#94A3B8', paddingVertical: 20, fontSize: 13 }}>
                  {language === 'tr' ? 'Bekleyen onay talebi bulunmuyor.' : 'No pending approval requests.'}
                </Text>
              ) : (
                pendingApprovals.map((appr) => {
                  const isDeleteReq = appr.type === 'delete_app' || appr.type === 'delete_org';
                  const roleTitle = appr.type === 'global_admin'
                    ? 'WhiteCosmos (Global Admin *)'
                    : appr.type === 'admin'
                    ? (language === 'tr' ? 'Yönetici (Admin)' : 'Admin')
                    : appr.type === 'delete_app'
                    ? (language === 'tr' ? 'Uygulama Silme Talebi' : 'App Deletion Request')
                    : appr.type === 'delete_org'
                    ? (language === 'tr' ? 'Organizasyon Silme Talebi' : 'Org Deletion Request')
                    : (language === 'tr' ? 'Bölüm Kullanıcısı' : 'Divisional User Binding');

                  const candidateId = appr.candidate_white_id || appr.candidate_blind_id;
                  const tenantDisplay = appr.tenant_name || appr.tenant_blind_id;

                  const handleApproveWithConfirm = () => {
                    if (isDeleteReq) {
                      const targetName = appr.type === 'delete_app' ? formatAppId(appr.target_app_id || '') : (appr.target_org_id || '');
                      setConfirmSheet({
                        visible: true,
                        title: getLabel('helpdesk.confirmDeleteApprovalTitle', 'Silme İşlemini Onayla', 'Confirm Deletion'),
                        description: `"${targetName}" ${getLabel('helpdesk.confirmDeleteApprovalDesc', 'öğesini sistemden kalıcı olarak silmeyi onaylıyor musunuz?', 'will be permanently removed. Do you confirm?')}`,
                        actionText: getLabel('common.delete', 'Sil', 'Delete'),
                        actionColor: '#EF4444',
                        cancelText: getLabel('common.cancel', 'Vazgeç', 'Cancel'),
                        onCancel: () => setConfirmSheet(prev => ({ ...prev, visible: false })),
                        onAction: async () => {
                          setConfirmSheet(prev => ({ ...prev, visible: false }));
                          await handleReviewApproval(appr.id, 'approved');
                        },
                      });
                    } else {
                      handleReviewApproval(appr.id, 'approved');
                    }
                  };

                  return (
                    <View key={appr.id} style={styles.approvalItemCard}>
                      <View style={styles.approvalItemHeader}>
                        <View style={[styles.approvalTypeBadge, isDeleteReq && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                          <Text style={[styles.approvalTypeBadgeText, isDeleteReq && { color: '#DC2626' }]}>{roleTitle}</Text>
                        </View>
                        <Text style={styles.approvalDateText}>
                          {new Date(appr.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      {isDeleteReq ? (
                        <View style={{ marginBottom: 4 }}>
                          <Text style={[styles.approvalCandidateText, { fontWeight: '700', color: '#DC2626' }]}>
                            {appr.type === 'delete_app' 
                              ? `${language === 'tr' ? 'Silinecek Uygulama' : 'Target App'}: ${formatAppId(appr.target_app_id || '')}`
                              : `${language === 'tr' ? 'Silinecek Organizasyon' : 'Target Org'}: ${appr.target_org_id || ''}`
                            }
                          </Text>
                          <Text style={[styles.approvalEnterpriseText, { color: '#64748B' }]}>
                            {language === 'tr' ? 'Talep Eden Admin:' : 'Requester Admin:'} {appr.candidate_alias || formatWhiteId(candidateId)}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.approvalCandidateText}>
                          ID: {formatWhiteId(candidateId)}
                        </Text>
                      )}
                      {tenantDisplay && (
                        <Text style={styles.approvalEnterpriseText}>
                          {language === 'tr' ? 'Kiracı/Şirket:' : 'Tenant/Enterprise:'} {tenantDisplay}
                        </Text>
                      )}
                      <View style={styles.approvalActionsRow}>
                        <TouchableOpacity
                          style={styles.approvalRejectBtn}
                          onPress={() => handleReviewApproval(appr.id, 'rejected')}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.approvalRejectText}>
                            {language === 'tr' ? 'Reddet' : 'Reject'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.approvalAcceptBtn}
                          onPress={handleApproveWithConfirm}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.approvalAcceptText}>
                            {language === 'tr' ? 'Onayla' : 'Approve'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.attachCancelBtn, { marginTop: 12 }]}
              onPress={() => setApprovalsModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.attachCancelText}>
                {getLabel('common.close', 'Kapat', 'Close')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 8. MODAL: TICKET USER GOVERNANCE ACTION SHEET */}
      <Modal
        visible={ticketActionModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setTicketActionModalVisible(false)}
      >
        <View style={styles.attachModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setTicketActionModalVisible(false)}
          />
          <View style={[styles.attachModalContainer, { maxWidth: 440 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View>
                <Text style={styles.attachModalTitle}>
                  {language === 'tr' ? 'Kullanıcı & Bilet Yönetimi' : 'User & Ticket Governance'}
                </Text>
                {targetActionTicket && (
                  <Text style={styles.attachModalSubtitle}>
                    #{targetActionTicket.id} · {formatWhiteId(targetActionTicket.user_white_id || targetActionTicket.user_blind_id || '')}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setTicketActionModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Option 1: Delete Ticket (Primary Admin Action) */}
            <TouchableOpacity
              style={styles.ticketActionOptionBtn}
              onPress={handleDeleteSingleTicket}
              activeOpacity={0.7}
            >
              <Trash2 size={20} color="#DC2626" style={styles.ticketActionOptionIcon} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.ticketActionOptionTitle, { color: '#DC2626' }]}>
                  {language === 'tr' ? 'Bileti Sil' : 'Delete Ticket'}
                </Text>
                <Text style={styles.ticketActionOptionDesc}>
                  {language === 'tr' ? 'Bu destek biletini ve tüm mesajlarını kalıcı olarak siler.' : 'Permanently remove this support ticket and all messages.'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 2: Revoke Admin Privileges (Subordinates only, never self or superiors) */}
            {targetActionTicket && (targetActionTicket.user_white_id || targetActionTicket.user_blind_id || '') !== ownWhiteId && targetActionRole !== 'none' && getRank(adminRole) > getRank(targetActionRole) && (
              <TouchableOpacity
                style={styles.ticketActionOptionBtn}
                onPress={handleRevokeUserAdmin}
                activeOpacity={0.7}
              >
                <LogOut size={20} color="#EF4444" style={styles.ticketActionOptionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ticketActionOptionTitle, { color: '#EF4444' }]}>
                    {language === 'tr' ? 'Yöneticilik Yetkisini İptal Et' : 'Revoke Admin Authority'}
                  </Text>
                  <Text style={styles.ticketActionOptionDesc}>
                    {language === 'tr' ? 'Kullanıcının yöneticilik yetkisini ve tüm yetkilendirmelerini iptal eder.' : 'Revoke admin privileges and all allocations.'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Option 3: Promote to Admin (Non-admins only) */}
            {isMasterAdmin && targetActionRole === 'none' && targetActionTicket && (targetActionTicket.user_white_id || targetActionTicket.user_blind_id || '') !== ownWhiteId && (
              <TouchableOpacity
                style={styles.ticketActionOptionBtn}
                onPress={handlePromoteTicketUserToAdmin}
                activeOpacity={0.7}
              >
                <UserPlus size={20} color="#3B82F6" style={styles.ticketActionOptionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ticketActionOptionTitle}>
                    {language === 'tr' ? 'Yönetici Yetkisi Ver (Admin Yap)' : 'Grant Admin Privileges'}
                  </Text>
                  <Text style={styles.ticketActionOptionDesc}>
                    {language === 'tr' ? 'Kullanıcıyı kategori ve uygulama destek yöneticisi yapar.' : 'Assign user to manage app/category support tickets.'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Option 4: Promote to Global Admin (Founder Only) */}
            {isFounder && targetActionRole !== 'founder' && targetActionRole !== 'global_admin' && targetActionTicket && (targetActionTicket.user_white_id || targetActionTicket.user_blind_id || '') !== ownWhiteId && (
              <TouchableOpacity
                style={styles.ticketActionOptionBtn}
                onPress={handlePromoteTicketUserToCosmos}
                activeOpacity={0.7}
              >
                <Sparkles size={20} color="#7C3AED" style={styles.ticketActionOptionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ticketActionOptionTitle, { color: '#7C3AED' }]}>
                    {language === 'tr' ? 'Kiracı Global Admini (WhiteCosmos *) Ata' : 'Assign WhiteCosmos (Global Admin *)'}
                  </Text>
                  <Text style={styles.ticketActionOptionDesc}>
                    {language === 'tr' ? 'Bu kiracının tek ve yetkili WhiteCosmos Global Yöneticisi yapar.' : 'Promote this user to the sole WhiteCosmos Global Admin.'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Option 5: Block User */}
            {targetActionTicket && (targetActionTicket.user_white_id || targetActionTicket.user_blind_id || '') !== ownWhiteId && (targetActionRole === 'none' || getRank(adminRole) > getRank(targetActionRole)) && (
              <TouchableOpacity
                style={styles.ticketActionOptionBtn}
                onPress={handleBlockTicketUser}
                activeOpacity={0.7}
              >
                <ShieldCheck size={20} color="#D97706" style={styles.ticketActionOptionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ticketActionOptionTitle, { color: '#D97706' }]}>
                    {language === 'tr' ? 'Kullanıcıyı Engelle' : 'Block User'}
                  </Text>
                  <Text style={styles.ticketActionOptionDesc}>
                    {language === 'tr' ? 'Kullanıcının sisteme bilet açmasını engeller.' : 'Prevent user from opening further support tickets.'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Option 6: Delete User & Ticket */}
            {isMasterAdmin && targetActionTicket && (targetActionTicket.user_white_id || targetActionTicket.user_blind_id || '') !== ownWhiteId && (targetActionRole === 'none' || getRank(adminRole) > getRank(targetActionRole)) && (
              <TouchableOpacity
                style={styles.ticketActionOptionBtn}
                onPress={handleDeleteTicketAndUser}
                activeOpacity={0.7}
              >
                <Trash2 size={20} color="#DC2626" style={styles.ticketActionOptionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ticketActionOptionTitle, { color: '#DC2626' }]}>
                    {language === 'tr' ? 'Bileti ve Kullanıcıyı Sil' : 'Delete User & Ticket'}
                  </Text>
                  <Text style={styles.ticketActionOptionDesc}>
                    {language === 'tr' ? 'Kullanıcı bağlamasını ve destek biletini kalıcı olarak siler.' : 'Permanently remove user binding and support ticket.'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.attachCancelBtn, { marginTop: 8 }]}
              onPress={() => setTicketActionModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.attachCancelText}>
                {getLabel('common.cancel', 'Vazgeç', 'Cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CONFIRMATION / ALERT SHEET (RULE MANDATED) */}
      <BottomConfirmationSheet
        visible={confirmSheet.visible}
        title={confirmSheet.title}
        description={confirmSheet.description}
        actionText={confirmSheet.actionText}
        actionColor={confirmSheet.actionColor}
        cancelText={confirmSheet.cancelText}
        onCancel={confirmSheet.onCancel}
        onAction={confirmSheet.onAction}
      />
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
  headerArea: {
    paddingTop: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24),
    justifyContent: 'center',
    paddingLeft: 20,
    backgroundColor: 'transparent',
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

  // FLUID SCROLL CONTAINER (SPREADS 100% ACROSS FULL WIDTH)
  scrollContainerFluid: {
    paddingHorizontal: 4,
    width: '100%',
    alignSelf: 'stretch',
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

  // Section Header Row
  sectionRowFluid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    width: '100%',
    alignSelf: 'stretch',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  topBackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  // Samsung One UI Direct On Canvas Back Row
  samsungBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  samsungBackText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },

  // Main White Panel Container (New Support Ticket Card Style)
  mainWhitePanel: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 0,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 28,
    elevation: 3,
    marginBottom: 40,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  identifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  identifyText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    fontStyle: 'italic',
  },

  // Tenant Governance Level 0 (Founder View)
  tenantLevel0Bar: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    marginTop: 8,
    marginBottom: 12,
  },
  tenantLevel0Header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tenantLevel0Label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tenantChipsScroll: {
    flexDirection: 'row',
  },
  tenantChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  tenantChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  tenantChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  tenantChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
  buttonlessIconBtn: {
    marginLeft: 14,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Action Button: Yeni Destek Bileti
  fluidNewTicketBtn: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
  },
  fluidNewTicketBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  fluidAdminGreenBtn: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
    marginTop: 8,
  },
  securityBadgeGreen: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Live Search Bar
  fluidSearchBar: {
    width: '100%',
    alignSelf: 'stretch',
    height: 46,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  fluidSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },

  // Filter Pills Row
  fluidFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
    alignSelf: 'stretch',
  },
  fluidFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  fluidFilterPillActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  fluidFilterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  fluidFilterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Ticket Cards List
  ticketsListWrapper: {
    width: '100%',
    alignSelf: 'stretch',
  },
  fluidTicketCard: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 15,
    marginBottom: 10,
  },
  cardHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ticketIdMonoText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  appTagBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    marginLeft: 6,
  },
  appTagBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  adminSenderText: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 6,
  },
  fluidTicketSubject: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 20,
    marginBottom: 6,
  },
  ticketDateMutedText: {
    fontSize: 11,
    fontWeight: '400',
    color: '#94A3B8',
  },

  // Status Pills
  pillOpen: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  pillOpenText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
  },
  pillAnswered: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  pillAnsweredText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  pillClosed: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pillClosedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },

  // Category Styles (Fluid Horizontal Scroll & Badges)
  categoryScrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
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
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  categoryPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoryBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
  },
  securityBadgeButtonless: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollLogoRow: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },

  // Empty State
  emptyContainerFluid: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  emptyTextFluid: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'center',
  },

  // Compose View Styles (Fluid)
  composeCardFluid: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 0,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 28,
    elevation: 3,
  },
  composeFieldGroup: {
    marginBottom: 14,
  },
  composeFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    minHeight: 110,
    maxHeight: 170,
    lineHeight: 20,
  },
  composeAttachRowFluid: {
    marginBottom: 16,
  },
  composeAttachLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  fluidSubmitBtn: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#94A3B8',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fluidSubmitBtnActive: {
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 3,
  },
  fluidSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Detail View Styles (Fluid)
  detailCardHeaderFluid: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 28,
    elevation: 3,
  },
  detailSubjectText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
    marginVertical: 6,
  },
  detailCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 8,
    marginTop: 4,
  },
  statusToggleBtnFluid: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusToggleBtnFluidClosed: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  statusToggleTextFluid: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  statusToggleTextFluidClosed: {
    color: '#3B82F6',
  },

  // Message Bubbles (Fluid)
  messageBubbleWrapper: {
    width: '100%',
    padding: 13,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 0,
  },
  messageBubbleMine: {
    backgroundColor: '#EFF6FF',
    borderWidth: 0,
  },
  messageBubbleOther: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
  },
  messageBubbleEditing: {
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
  },
  messageBubbleTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageSenderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageTimeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '400',
  },
  messageBodyText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#0F172A',
  },

  // Sticky Reply Card Panel (Fluid)
  replyCardPanelContainerFluid: {
    position: 'absolute',
    left: 4,
    right: 4,
    zIndex: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0,
    padding: 15,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 28,
    elevation: 3,
  },
  replyPanelTextArea: {
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 65,
    maxHeight: 115,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  replyPanelBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  replyPanelAttachButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyPanelSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  replyPanelSendBtnActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 2,
  },
  replyPanelSendBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  replyPanelSendBtnTextActive: {
    color: '#FFFFFF',
  },

  // Attachment Preview & Modals
  attachPreviewBarFluid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 8,
  },
  attachThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
  },
  attachDocIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  attachFileName: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
  },
  attachRemoveBtn: {
    padding: 6,
    marginLeft: 8,
  },
  msgAttachmentImageWrapper: {
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  msgImagePreview: {
    width: 220,
    height: 150,
    borderRadius: 10,
  },
  msgDocContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignSelf: 'flex-start',
  },
  msgDocName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0F172A',
    flexShrink: 1,
  },
  editIndicatorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  editIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  editCancelBtn: {
    padding: 4,
  },

  // Attach Modal Sheet
  attachModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 16,
    zIndex: 99999,
  },
  attachModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    marginBottom: Platform.OS === 'ios' ? 24 : 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 25,
  },
  attachModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  attachModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 20,
  },
  attachOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  attachOptionBtn: {
    alignItems: 'center',
  },
  attachOptionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachOptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  attachCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  attachCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  // Approvals Modal Styles
  approvalItemCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  approvalItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  approvalTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
  },
  approvalTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
    textTransform: 'uppercase',
  },
  approvalDateText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  approvalCandidateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  approvalEnterpriseText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
  },
  approvalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  approvalRejectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  approvalRejectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  approvalAcceptBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
  },
  approvalAcceptText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Ticket Action Options Sheet
  ticketActionOptionBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  ticketActionOptionIcon: {
    marginRight: 12,
  },
  ticketActionOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  ticketActionOptionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  // Full Image Modal
  fullImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImageCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 44 : 54,
    right: 20,
    zIndex: 20,
    padding: 8,
  },
  fullImage: {
    width: '92%',
    height: '80%',
  },

  // Console Modal Styles
  consoleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  consoleModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    flex: 1,
    flexShrink: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 25,
  },
  consoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  consoleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  consoleTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  consoleSubtitleText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  consoleRevokeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  consoleCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // RPG II Tiers
  tierSection: {
    marginBottom: 16,
  },
  tierHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tierTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 0.3,
  },
  tierQuickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  tierIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierQuickActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
  },
  tierHScroll: {
    paddingVertical: 2,
  },
  tierEmptyText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 6,
  },

  // Admin Pill
  adminPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    minWidth: 110,
  },
  adminPillSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  adminPillAlias: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  adminPillAliasSelected: {
    color: '#1D4ED8',
  },
  adminPillId: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  adminPillIdSelected: {
    color: '#3B82F6',
  },

  // App Pill
  appPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  appPillSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  appPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  appPillTextSelected: {
    color: '#1D4ED8',
    fontWeight: '700',
  },

  // Category Pill
  catPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catPill: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  catPillSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  catPillTextSelected: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  allCoveredBanner: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  allCoveredBannerText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },

  // Allocation Row Card
  allocRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  allocAdminName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginRight: 6,
  },
  allocAppBadge: {
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: '#DBEAFE',
    color: '#1E40AF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  allocCatsText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  allocCountBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  allocCountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },

  // Admin Authorization Modal Specifics
  authModalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    width: '100%',
  },
  authModalTitleLeft: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  ticketBadgeBox: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  ticketBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#3B82F6',
  },
  modalSectionBox: {
    width: '100%',
    marginBottom: 12,
  },
  modalFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modalChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  modalChipPill: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalChipPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  modalChipPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  modalChipPillTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  suggestPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  suggestPillBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
  },
  suggestHintText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  guideCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  guideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  guideNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  guideNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
  },
  guideCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  guideCardBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },

  // Gemini-Style Global Admin Station Styles
  geminiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  geminiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  geminiIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  geminiCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  geminiCardSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
  },
  geminiStatusPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 4,
  },
  geminiStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  geminiCardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFAFC',
  },
  infoRowItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoRowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  infoRowValue: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  copyChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  copyChipText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    maxWidth: 260,
  },
  quotaCountersRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 10,
  },
  quotaBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quotaBoxNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 2,
  },
  quotaBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  subSectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
  },
  addonActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  addonActionBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E40AF',
  },
  copiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  copiedBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    flex: 1,
  },
  tierPlanBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tierPlanBoxPro: {
    borderColor: '#93C5FD',
    backgroundColor: '#F0F9FF',
  },
  tierPlanName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  popularBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tierPlanPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    marginVertical: 2,
  },
  tierPlanDesc: {
    fontSize: 11,
    color: '#64748B',
  },
  addOpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 11,
    marginBottom: 10,
  },
  addOpBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
