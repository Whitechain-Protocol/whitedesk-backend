import { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import { voiceCallService, VoiceCallSession } from '../../../services/voiceCallService';
import { remoteDesktopService } from '../../../services/remoteDesktopService';
import { helpDeskService, HelpDeskTicket, HelpDeskMessage, OrgEntry, AdminEntry, TenantEntry } from '../../../services/helpDeskService';
import { NotificationService } from '../../../services/notificationService';
import { WhiteDeskCrypto } from '../../../services/cryptoService';

export interface UseHelpDeskVoiceProps {
  ownWhiteId: string;
  customAlias: string | null;
  isAdmin: boolean;
  isFounder: boolean;
  adminRole: 'founder' | 'global_admin' | 'admin' | 'none';
  activeEnterpriseBlindId: string | null;
  currentEnterpriseName: string | null;
  selectedTicket: HelpDeskTicket | null;
  ticketMessages: HelpDeskMessage[];
  orgsList: OrgEntry[];
  adminsList: AdminEntry[];
  tenantsList: TenantEntry[];
  tickets: HelpDeskTicket[];
  filterOrgId: string;
  currentView: 'list' | 'detail' | 'compose';
  language: 'tr' | 'en';
  setConfirmSheet: (sheet: any) => void;
  advancedFeaturesConfig?: any;
  userAdvancedPrefs?: any;
  ticketClientPrefs?: any;
}

export function useHelpDeskVoice({
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
  language,
  setConfirmSheet,
  advancedFeaturesConfig,
  userAdvancedPrefs,
  ticketClientPrefs,
}: UseHelpDeskVoiceProps) {


  const [callSession, setCallSession] = useState<VoiceCallSession | null>(null);
  const [activeOrgChannelId, setActiveOrgChannelId] = useState<string>('all');
  const [pttTenantId, setPttTenantId] = useState<string>('');
  const [pttTenantName, setPttTenantName] = useState<string>('');
  const [allSystemOrgs, setAllSystemOrgs] = useState<OrgEntry[]>([]);

  // Subscribe to voiceCallService session updates
  useEffect(() => {
    const unsub = voiceCallService.subscribe((sess) => {
      setCallSession(sess);
    });
    return unsub;
  }, []);

  // Kırılmaz Firma İzolasyonu: voiceCallService ve native bildirim servisine aktif şirketi kaydet
  useEffect(() => {
    if (activeEnterpriseBlindId) {
      voiceCallService.setActiveEnterpriseBlindId(activeEnterpriseBlindId);
      NotificationService.setOwnTenantId(activeEnterpriseBlindId);
    }
  }, [activeEnterpriseBlindId]);

  // Kendi kimlik ve isim bilgisini (isim girilmemişse Blind ID maskesi için) ses servisine senkronize et
  useEffect(() => {
    voiceCallService.setOwnIdentity(ownWhiteId, customAlias);
  }, [ownWhiteId, customAlias]);

  // Push bildirimi tıklandığında veya kilit ekranında tam ekran arama intent'i geldiğinde doğrudan cevaplama modalını aç
  useEffect(() => {
    void NotificationService.getInitialCallIntent().then((data) => {
      if (data?.ticketId || data?.callerWhiteId) {
        console.warn('[PUSH] Cold start incoming call intent received:', data);
        if (data?.type === 'remote_desktop_offer' || data?.callType === 'remote_desktop') {
          void remoteDesktopService.receiveIncomingInvite(
            data.ticketId,
            data.callerAlias || 'Destek Uzmanı',
            userAdvancedPrefs?.remoteDesktopEnabled !== false
          );
          return;
        }
        const autoAnswer = data?.callAction === 'answer';
        if (data?.callAction === 'reject') {
          void voiceCallService.rejectCallRequest();
          return;
        }
        voiceCallService.presentIncomingCallFromPush(
          data,
          ownWhiteId || '',
          autoAnswer
        );
      }
    });

    const unsubTapped = NotificationService.onIncomingCallTapped((data) => {
      console.warn('[PUSH] Warm incoming call intent received:', data);
      if (data?.ticketId || data?.callerWhiteId) {
        if (data?.type === 'remote_desktop_offer' || data?.callType === 'remote_desktop') {
          void remoteDesktopService.receiveIncomingInvite(
            data.ticketId,
            data.callerAlias || 'Destek Uzmanı',
            userAdvancedPrefs?.remoteDesktopEnabled !== false
          );
          return;
        }
        const autoAnswer = data?.callAction === 'answer';
        if (data?.callAction === 'reject') {
          void voiceCallService.rejectCallRequest();
          return;
        }
        voiceCallService.presentIncomingCallFromPush(
          data,
          ownWhiteId || '',
          autoAnswer
        );
      }
    });

    const unsubAction = NotificationService.onIncomingCallAction((data) => {
      console.warn('[PUSH] Notification call action received:', data);
      if (data?.action === 'reject') {
        void voiceCallService.rejectCallRequest();
      } else if (data?.action === 'hangup') {
        NotificationService.dismissCallNotification();
        remoteDesktopService.dismissIncomingOffer(data?.ticketId);
      }
    });

    return () => {
      unsubTapped();
      unsubAction();
    };
  }, [ownWhiteId, activeEnterpriseBlindId]);

  // 1. Direct 1-on-1 Voice Call
  const handleCallPress = useCallback(async () => {
    if (!selectedTicket) return;

    const callerWhiteId = WhiteDeskCrypto.generateBlindId(ownWhiteId || '');
    const callerAlias = customAlias || (isAdmin ? 'WhiteDesk Admin' : 'Kullanıcı');

    let calleeWhiteId = isAdmin
      ? (selectedTicket.user_blind_id || selectedTicket.user_white_id || '')
      : (selectedTicket.assigned_admin_blind_id && selectedTicket.assigned_admin_blind_id !== 'unassigned'
          ? selectedTicket.assigned_admin_blind_id
          : '');

    if (!calleeWhiteId) {
      const targetMsg = [...ticketMessages].reverse().find(m =>
        (isAdmin ? !m.is_admin : m.is_admin) && ((m as any).sender_blind_id || m.sender_white_id)
      );
      if (targetMsg) {
        calleeWhiteId = (targetMsg as any).sender_blind_id || targetMsg.sender_white_id || '';
      }
    }

    if (!isAdmin && !calleeWhiteId) {
      const fallbackAdmin = await helpDeskService.getAdminWhiteId();
      if (fallbackAdmin) calleeWhiteId = fallbackAdmin;
    }

    if (calleeWhiteId) {
      calleeWhiteId = WhiteDeskCrypto.generateBlindId(calleeWhiteId);
    }

    const calleeAlias = isAdmin
      ? ((selectedTicket as any).user_name || (calleeWhiteId ? calleeWhiteId.slice(0, 12) : 'Kullanıcı'))
      : ((selectedTicket as any).assigned_admin_name || 'Destek Operatörü');

    const elig = await voiceCallService.checkCallEligibility(
      callerWhiteId,
      calleeWhiteId,
      selectedTicket.enterprise_blind_id || activeEnterpriseBlindId || undefined
    );
    if (!elig.allowed) {
      Alert.alert(
        language === 'tr' ? 'Sesli Çağrı' : 'Voice Call',
        elig.reason || (language === 'tr' ? 'Kullanıcı çağrı kabul etmiyor.' : 'User does not accept voice calls.')
      );
      return;
    }

    setConfirmSheet({
      visible: true,
      title: language === 'tr' ? 'Sesli Görüşme' : 'Voice Call',
      description: isAdmin
        ? (language === 'tr'
            ? `${calleeAlias} kullanıcısına bu bilet kapsamında uçtan uca şifreli sesli arama başlatılsın mı?`
            : `Start an end-to-end encrypted voice call with ${calleeAlias}?`)
        : (language === 'tr'
            ? 'Destek uzmanımıza bu bilet kapsamında uçtan uca şifreli sesli arama başlatılsın mı?'
            : 'Start an end-to-end encrypted voice call with support specialist?'),
      actionText: language === 'tr' ? 'Ara' : 'Call',
      actionColor: '#16A34A',
      cancelText: language === 'tr' ? 'Vazgeç' : 'Cancel',
      onCancel: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        const ticketOrg = orgsList.find(o => o.org_id === selectedTicket.org_id);
        const targetOrgName = ticketOrg ? ticketOrg.name : (selectedTicket.category || (language === 'tr' ? 'Genel Destek' : 'General Support'));
        await voiceCallService.startDirectCall(
          selectedTicket.id,
          callerWhiteId,
          callerAlias,
          calleeWhiteId,
          calleeAlias,
          'call',
          targetOrgName,
          selectedTicket.org_id
        );
      },
    });
  }, [
    selectedTicket,
    ticketMessages,
    ownWhiteId,
    customAlias,
    isAdmin,
    activeEnterpriseBlindId,
    language,
    orgsList,
    setConfirmSheet,
  ]);

  // 2. Direct 1-on-1 PTT (Push-to-Talk)
  const handlePttPress = useCallback(async () => {
    if (!selectedTicket) return;

    const callerWhiteId = WhiteDeskCrypto.generateBlindId(ownWhiteId || '');
    const callerAlias = customAlias || (isAdmin ? 'WhiteDesk Admin' : 'Kullanıcı');

    let calleeWhiteId = isAdmin
      ? (selectedTicket.user_blind_id || selectedTicket.user_white_id || '')
      : (selectedTicket.assigned_admin_blind_id && selectedTicket.assigned_admin_blind_id !== 'unassigned'
          ? selectedTicket.assigned_admin_blind_id
          : '');

    if (!calleeWhiteId) {
      const targetMsg = [...ticketMessages].reverse().find(m =>
        (isAdmin ? !m.is_admin : m.is_admin) && ((m as any).sender_blind_id || m.sender_white_id)
      );
      if (targetMsg) {
        calleeWhiteId = (targetMsg as any).sender_blind_id || targetMsg.sender_white_id || '';
      }
    }

    if (!isAdmin && !calleeWhiteId) {
      const fallbackAdmin = await helpDeskService.getAdminWhiteId();
      if (fallbackAdmin) calleeWhiteId = fallbackAdmin;
    }

    if (calleeWhiteId) {
      calleeWhiteId = WhiteDeskCrypto.generateBlindId(calleeWhiteId);
    }

    const calleeAlias = isAdmin
      ? ((selectedTicket as any).user_name || (calleeWhiteId ? calleeWhiteId.slice(0, 12) : 'Kullanıcı'))
      : ((selectedTicket as any).assigned_admin_name || 'Destek Operatörü');

    const elig = await voiceCallService.checkPttEligibility(
      callerWhiteId,
      calleeWhiteId,
      selectedTicket.enterprise_blind_id || activeEnterpriseBlindId || undefined
    );
    if (!elig.allowed) {
      Alert.alert(
        language === 'tr' ? 'Bas-Konuş' : 'Push-to-Talk',
        elig.reason || (language === 'tr' ? 'Kullanıcı bas-konuş çağrılarını kabul etmiyor.' : 'User does not accept PTT calls.')
      );
      return;
    }

    setConfirmSheet({
      visible: true,
      title: language === 'tr' ? 'Bas-Konuş İsteği' : 'Push-to-Talk Request',
      description: isAdmin
        ? (language === 'tr'
            ? `${calleeAlias} kullanıcısına bas-konuş oturumu başlatılsın mı?`
            : `Start a push-to-talk session with ${calleeAlias}?`)
        : (language === 'tr'
            ? 'Destek uzmanımıza bas-konuş oturumu başlatılsın mı?'
            : 'Start a push-to-talk session with support specialist?'),
      actionText: language === 'tr' ? 'Gönder' : 'Send',
      actionColor: '#0F766E',
      cancelText: language === 'tr' ? 'Vazgeç' : 'Cancel',
      onCancel: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        const ticketOrg = orgsList.find(o => o.org_id === selectedTicket.org_id);
        const targetOrgName = ticketOrg ? ticketOrg.name : (selectedTicket.category || (language === 'tr' ? 'Genel Destek' : 'General Support'));
        await voiceCallService.startDirectCall(
          selectedTicket.id,
          callerWhiteId,
          callerAlias,
          calleeWhiteId,
          calleeAlias,
          'ptt',
          targetOrgName,
          selectedTicket.org_id
        );
      },
    });
  }, [
    selectedTicket,
    ticketMessages,
    ownWhiteId,
    customAlias,
    isAdmin,
    activeEnterpriseBlindId,
    language,
    orgsList,
    setConfirmSheet,
  ]);

  // Admin Org ID derivation
  const myAdminOrgId = useMemo(() => {
    if (!isAdmin) return undefined;
    const ownBlind = WhiteDeskCrypto.generateBlindId(ownWhiteId || '').toLowerCase();
    const currentAdminEntry = adminsList.find(a =>
      WhiteDeskCrypto.generateBlindId(a.white_id || '').toLowerCase() === ownBlind
    );
    return currentAdminEntry?.org_id || undefined;
  }, [isAdmin, adminsList, ownWhiteId]);

  // Kırılmaz Grup / Birim İzolasyonu: voiceCallService ve native bildirim servisine aktif grubu kaydet
  useEffect(() => {
    const effectiveOrg = myAdminOrgId || (filterOrgId && filterOrgId !== 'all' && filterOrgId !== '*' ? filterOrgId : undefined);
    if (effectiveOrg) {
      voiceCallService.setActiveOrgId(effectiveOrg);
      NotificationService.setOwnOrgId(effectiveOrg);
    }
  }, [myAdminOrgId, filterOrgId]);

  // PTT Tenant change
  const handleChangePttTenant = useCallback((tId: string, tName: string) => {
    setPttTenantId(tId);
    setPttTenantName(tName);
    setActiveOrgChannelId('all');
    voiceCallService.updateOrgPttTarget('global', language === 'tr' ? 'Genel' : 'General', tId);
    void helpDeskService.getOrgsList('all').then((res) => {
      if (res) setAllSystemOrgs(res);
    }).catch(() => {});
  }, [language]);

  // Available PTT Org Channels
  const availableOrgChannels = useMemo(() => {
    const currentPttTenant = pttTenantId || activeEnterpriseBlindId || 'default';
    const isFounderRoot =
      currentPttTenant === 'blind_11fcac28453c3eaa3a06a5db6caf4ca1' ||
      currentPttTenant === 'blind_thewhite_root';
    const sourceOrgs = allSystemOrgs.length > 0 ? allSystemOrgs : orgsList;
    const tenantOrgs = sourceOrgs.filter((o) => {
      const entId = o.enterprise_blind_id;
      if (!entId) return false;
      if (isFounderRoot) {
        return entId === 'blind_11fcac28453c3eaa3a06a5db6caf4ca1' || entId === 'blind_thewhite_root';
      }
      return entId === currentPttTenant;
    });
    const channels = [
      { id: 'all', name: language === 'tr' ? 'Genel' : 'General' },
      ...tenantOrgs.map((o) => ({ id: o.org_id, name: o.name })),
    ];
    if (isAdmin) {
      channels.push({
        id: 'admins_only',
        name: language === 'tr' ? 'Yöneticiler' : 'Admins',
      });
    }
    return channels;
  }, [allSystemOrgs, orgsList, pttTenantId, activeEnterpriseBlindId, language, isAdmin]);

  const isSingleOrgAdmin = useMemo(() => {
    if (!isAdmin || isFounder || adminRole === 'global_admin') return false;
    return Boolean(
      (myAdminOrgId && myAdminOrgId !== 'all' && myAdminOrgId !== '*' && myAdminOrgId !== 'default') ||
      availableOrgChannels.length <= 1
    );
  }, [isAdmin, isFounder, adminRole, myAdminOrgId, availableOrgChannels.length]);

  const canSwitchHierarchy = useMemo(() => {
    if (!isAdmin) return false;
    if (isFounder) return true;
    if (adminRole === 'global_admin') return true;
    if (isSingleOrgAdmin) return false;
    return availableOrgChannels.length > 1;
  }, [isAdmin, isFounder, adminRole, isSingleOrgAdmin, availableOrgChannels.length]);

  // Bilet kartlarındaki blind_id'ler ve aktif yöneticilerden kanal hedeflerini çıkarır (KURAL 7: whitedesk_user_bindings şartı yoktur)
  const collectChannelTargetBlindIds = useCallback((tenantId: string, cleanOrgId: string): string[] => {
    const ownBlind = WhiteDeskCrypto.generateBlindId(ownWhiteId || '').toLowerCase();
    const memberSet = new Set<string>();

    const addBlind = (raw?: string | null) => {
      if (!raw || raw === 'unassigned' || raw === 'default' || raw === 'all') return;
      const b = WhiteDeskCrypto.generateBlindId(raw.trim());
      if (b && b.toLowerCase() !== ownBlind) {
        memberSet.add(b);
      }
    };

    if (cleanOrgId === 'admins_only') {
      adminsList.forEach(a => {
        if (!tenantId || !a.enterprise_blind_id || a.enterprise_blind_id === tenantId) {
          addBlind(a.white_id);
        }
      });
      return Array.from(memberSet);
    }

    const isGlobalOrg = !cleanOrgId || cleanOrgId === 'global' || cleanOrgId === 'all' || cleanOrgId === '*';

    // 1. Bilet kartlarındaki user_blind_id ve assigned_admin_blind_id
    tickets.forEach(t => {
      if (tenantId && t.enterprise_blind_id && t.enterprise_blind_id !== 'default' && t.enterprise_blind_id !== tenantId) {
        return;
      }
      const tOrg = t.org_id || 'global';
      if (isGlobalOrg || tOrg === cleanOrgId) {
        addBlind(t.user_blind_id || t.user_white_id);
        addBlind(t.assigned_admin_blind_id);
      }
    });

    // 2. Kurumsal temsilciler (whitedesk_admins)
    adminsList.forEach(a => {
      if (!tenantId || !a.enterprise_blind_id || a.enterprise_blind_id === tenantId) {
        if (isGlobalOrg || !a.org_id || a.org_id === 'all' || a.org_id === 'default' || a.org_id === cleanOrgId) {
          addBlind(a.white_id);
        }
      }
    });

    return Array.from(memberSet);
  }, [tickets, adminsList, ownWhiteId]);

  // Channel member count
  const currentChannelMemberCount = useMemo(() => {
    const tenantId = pttTenantId || activeEnterpriseBlindId || '';
    const cleanOrgId = activeOrgChannelId && activeOrgChannelId !== 'all' ? activeOrgChannelId : 'global';
    return collectChannelTargetBlindIds(tenantId, cleanOrgId).length;
  }, [activeOrgChannelId, pttTenantId, activeEnterpriseBlindId, collectChannelTargetBlindIds]);

  // Org Group PTT broadcast button
  const handleOrgGroupPttPress = useCallback(async () => {
    try {
      const tenantId = pttTenantId || activeEnterpriseBlindId;
      if (!tenantId || tenantId === 'all' || tenantId === 'unassigned') {
        console.warn('[useHelpDeskVoice] Telsiz başlatılamadı: Geçerli ve izole bir kurumsal firma seçilmelidir!');
        Alert.alert(
          language === 'tr' ? 'Firma Belirlenemedi' : 'Enterprise Required',
          language === 'tr'
            ? 'Telsiz anonsu başlatabilmek için geçerli bir kurumsal firma seçilmelidir.'
            : 'A valid enterprise tenant must be selected to start a radio broadcast.'
        );
        return;
      }

      let targetOrgCandidate = filterOrgId;
      if (isSingleOrgAdmin && myAdminOrgId && myAdminOrgId !== 'all' && myAdminOrgId !== '*') {
        targetOrgCandidate = myAdminOrgId;
      }
      const rawOrgId = targetOrgCandidate && targetOrgCandidate !== 'all' && targetOrgCandidate !== '*' ? targetOrgCandidate : 'global';
      const validOrgItem = availableOrgChannels.find(c => c.id !== 'all' && c.id === rawOrgId);
      const cleanOrgId = validOrgItem ? validOrgItem.id : (rawOrgId !== 'global' ? rawOrgId : 'global');
      const orgName = validOrgItem?.name || (rawOrgId !== 'global' ? rawOrgId : (language === 'tr' ? 'Genel' : 'General'));
      const callerAlias = customAlias || (isAdmin ? (isFounder ? 'TheWhite' : 'Yönetici') : 'Kullanıcı');
      const callerBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId || 'default');

      if (!pttTenantId || pttTenantId !== tenantId) {
        setPttTenantId(tenantId);
        setPttTenantName(currentEnterpriseName || '');
      }

      setActiveOrgChannelId(cleanOrgId === 'global' ? 'all' : cleanOrgId);

      // Bilet kartlarındaki blind_id'ler ve kurumsal temsilcilerden oluşan hedef kitle
      const targetMembers = collectChannelTargetBlindIds(tenantId, cleanOrgId);

      await voiceCallService.startOrgGroupPttCall(
        tenantId,
        cleanOrgId,
        orgName,
        callerBlindId,
        callerAlias,
        targetMembers
      );
    } catch (e) {
      console.warn('[useHelpDeskVoice] handleOrgGroupPttPress error:', e);
      Alert.alert(
        language === 'tr' ? 'Bas-Konuş' : 'Push-to-Talk',
        language === 'tr' ? 'Telsiz konsolu açılamadı.' : 'Could not open walkie-talkie console.'
      );
    }
  }, [
    pttTenantId,
    activeEnterpriseBlindId,
    filterOrgId,
    availableOrgChannels,
    currentEnterpriseName,
    ownWhiteId,
    customAlias,
    isAdmin,
    isFounder,
    isSingleOrgAdmin,
    myAdminOrgId,
    language,
    collectChannelTargetBlindIds,
  ]);

  const handleChangeOrgChannel = useCallback((newOrgId: string) => {
    setActiveOrgChannelId(newOrgId);
    const orgItem = availableOrgChannels.find(c => c.id === newOrgId);
    if (orgItem) {
      voiceCallService.updateOrgPttTarget(newOrgId === 'all' ? 'global' : newOrgId, orgItem.name);
    }
  }, [availableOrgChannels]);

  const handleBroadcastChannelInvite = useCallback(async (targetOrgId: string) => {
    try {
      const tenantId = pttTenantId || activeEnterpriseBlindId;
      if (!tenantId || tenantId === 'all' || tenantId === 'unassigned') {
        console.warn('[useHelpDeskVoice] Telsiz daveti gönderilemedi: Geçerli ve izole bir kurumsal firma seçilmelidir!');
        return;
      }

      const validOrgItem = availableOrgChannels.find(c => c.id !== 'all' && c.id === targetOrgId);
      const cleanOrgId = validOrgItem ? validOrgItem.id : (targetOrgId && targetOrgId !== 'all' && targetOrgId !== '*' && targetOrgId !== 'global' ? targetOrgId : 'global');
      const orgName = validOrgItem?.name || (cleanOrgId !== 'global' ? cleanOrgId : (language === 'tr' ? 'Genel' : 'General'));

      const targetMembers = collectChannelTargetBlindIds(tenantId, cleanOrgId);
      const callerAlias = customAlias || (isAdmin ? (isFounder ? 'TheWhite' : 'Yönetici') : 'Kullanıcı');
      const callerBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId || 'default');

      await voiceCallService.startOrgGroupPttCall(
        tenantId,
        cleanOrgId,
        orgName,
        callerBlindId,
        callerAlias,
        targetMembers
      );
    } catch (e) {
      console.warn('[useHelpDeskVoice] handleBroadcastChannelInvite error:', e);
    }
  }, [
    pttTenantId,
    activeEnterpriseBlindId,
    availableOrgChannels,
    ownWhiteId,
    customAlias,
    isAdmin,
    isFounder,
    language,
    collectChannelTargetBlindIds,
  ]);

  // Reactive handling of Call Handshake rejection alert
  useEffect(() => {
    if (!callSession) return;

    if (
      callSession.state === 'ended' &&
      callSession.role === 'caller' &&
      (callSession.failureReason === 'rejected' ||
        callSession.failureReason === 'call_disabled_by_user' ||
        callSession.failureReason === 'ptt_disabled_by_user' ||
        callSession.failureReason?.toLowerCase().includes('reddet') ||
        callSession.failureReason?.toLowerCase().includes('müsait'))
    ) {
      let rejectMsg = '';
      if (callSession.failureReason === 'call_disabled_by_user') {
        rejectMsg = language === 'tr'
          ? 'Kullanıcının arama özelliği kapalı durumdadır.'
          : 'User has disabled incoming calls in preferences.';
      } else if (callSession.failureReason === 'ptt_disabled_by_user') {
        rejectMsg = language === 'tr'
          ? 'Kullanıcının bas-konuş özelliği kapalı durumdadır.'
          : 'User has disabled push-to-talk in preferences.';
      } else {
        rejectMsg = isAdmin
          ? (language === 'tr'
              ? 'Kullanıcı şu anda görüşme için müsait değil. Dilerseniz bilet üzerinden yazılı olarak iletişime devam edebilirsiniz.'
              : 'The user is currently unavailable. You may continue the conversation via ticket messages.')
          : (language === 'tr'
              ? 'Destek uzmanımız şu anda başka bir görüşmede veya müsait değil. Dilerseniz bilet üzerinden mesajınızı iletebilirsiniz.'
              : 'Support specialist is currently unavailable or in another session. You may leave your message here.');
      }
      Alert.alert(language === 'tr' ? 'Çağrı Bildirimi' : 'Call Notice', rejectMsg);
    }
  }, [callSession?.state, callSession?.role, callSession?.failureReason, isAdmin, language]);

  const effectiveVoiceCall = useMemo(() => {
    const tenantEnabled = Boolean(advancedFeaturesConfig?.voiceCall?.enabled) &&
      advancedFeaturesConfig?.voiceCall?.policy !== 'disabled';
    if (!tenantEnabled) return false;

    if (userAdvancedPrefs?.voiceCallEnabled === false) return false;
    if (ticketClientPrefs?.voiceCallEnabled === false) return false;

    return true;
  }, [advancedFeaturesConfig?.voiceCall, userAdvancedPrefs?.voiceCallEnabled, ticketClientPrefs?.voiceCallEnabled]);

  const effectivePushToTalk = useMemo(() => {
    const tenantEnabled = Boolean(advancedFeaturesConfig?.pushToTalk?.enabled);
    if (!tenantEnabled) return false;

    if (isAdmin) {
      return ticketClientPrefs?.pushToTalkEnabled !== false;
    } else {
      return userAdvancedPrefs?.pushToTalkEnabled !== false;
    }
  }, [advancedFeaturesConfig?.pushToTalk, isAdmin, ticketClientPrefs?.pushToTalkEnabled, userAdvancedPrefs?.pushToTalkEnabled]);

  return {
    callSession,
    activeOrgChannelId,
    setActiveOrgChannelId,
    pttTenantId,
    setPttTenantId,
    pttTenantName,
    setPttTenantName,
    allSystemOrgs,
    setAllSystemOrgs,
    availableOrgChannels,
    myAdminOrgId,
    isSingleOrgAdmin,
    canSwitchHierarchy,
    currentChannelMemberCount,
    handleCallPress,
    handlePttPress,
    handleChangePttTenant,
    handleOrgGroupPttPress,
    handleChangeOrgChannel,
    handleBroadcastChannelInvite,
    effectiveVoiceCall,
    effectivePushToTalk,
  };
}
