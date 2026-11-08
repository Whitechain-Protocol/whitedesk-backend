import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { helpDeskService, HelpDeskTicket, HelpDeskMessage } from '../../../services/helpDeskService';
import { WhiteDeskCrypto } from '../../../whitedesk-sdk';
import { ephemeralAuthService } from '../../../services/ephemeralAuthService';
import { i18nService } from '../../../services/i18nService';
import { AdvancedFeaturesConfig } from '../types';

export interface UseHelpDeskGovernanceProps {
  ownWhiteId: string;
  adminRole: 'founder' | 'global_admin' | 'admin' | 'none';
  isAdmin: boolean;
  isMasterAdmin: boolean;
  isFounder: boolean;
  activeEnterpriseBlindId: string | null;
  selectedTenantBlindId: string;
  currentEnterpriseName: string | null;
  selectedTicket: HelpDeskTicket | null;
  setSelectedTicket: React.Dispatch<React.SetStateAction<HelpDeskTicket | null>>;
  setTickets: React.Dispatch<React.SetStateAction<HelpDeskTicket[]>>;
  advancedFeaturesConfig: AdvancedFeaturesConfig | null;
  language: 'tr' | 'en';
  getLabel: (key: string, tr?: string | Record<string, string | number>, en?: string) => string;
  formatWhiteId: (id: string | null | undefined) => string;
  setConfirmSheet: (sheet: any) => void;
  handleBackToList: () => void;
  loadData: () => Promise<void>;
  loadConsoleData: () => Promise<void>;
  // Admin assignment sub-modal triggers
  setAssigningTicket: (t: HelpDeskTicket | null) => void;
  setNewAdminIdInput: (id: string) => void;
  setSuggestPrefixIndex: (idx: number) => void;
  setSuggestCount: (cnt: number) => void;
  setNewAdminAliasInput: (alias: string) => void;
  setAssignAppId: (appId: string) => void;
  setAssignCatId: (catId: string) => void;
  setAddAdminModalVisible: (vis: boolean) => void;
}

export function useHelpDeskGovernance({
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
  language,
  getLabel,
  formatWhiteId,
  setConfirmSheet,
  handleBackToList,
  loadData,
  loadConsoleData,
  setAssigningTicket,
  setNewAdminIdInput,
  setSuggestPrefixIndex,
  setSuggestCount,
  setNewAdminAliasInput,
  setAssignAppId,
  setAssignCatId,
  setAddAdminModalVisible,
}: UseHelpDeskGovernanceProps) {
  const [ticketActionModalVisible, setTicketActionModalVisible] = useState(false);
  const [targetActionTicket, setTargetActionTicket] = useState<HelpDeskTicket | null>(null);
  const [targetActionMessages, setTargetActionMessages] = useState<HelpDeskMessage[]>([]);
  const [targetActionRole, setTargetActionRole] = useState<'founder' | 'global_admin' | 'admin' | 'none'>('none');
  const [ticketOrgAssignModalVisible, setTicketOrgAssignModalVisible] = useState(false);
  const [ticketMenuAnchorY, setTicketMenuAnchorY] = useState<number | null>(null);

  // 1. Ticket Action Sheet trigger
  const handleTicketMenuPress = useCallback(async (ticket: HelpDeskTicket, pageY?: number) => {
    setTicketMenuAnchorY(pageY !== undefined ? pageY : null);
    const targetId = ticket.user_white_id || ticket.user_blind_id || '';
    let targetRole: 'founder' | 'global_admin' | 'admin' | 'none' = 'none';
    if (targetId) {
      targetRole = await helpDeskService.getAdminRole(targetId);
    }
    try {
      const msgs = await helpDeskService.getLocalTicketMessages(ticket.id);
      setTargetActionMessages(msgs || []);
    } catch {
      setTargetActionMessages([]);
    }
    setTargetActionTicket(ticket);
    setTargetActionRole(targetRole);
    setTicketActionModalVisible(true);
  }, []);

  const handleTicketLongPress = handleTicketMenuPress;

  // 2. Org & App assignment
  const handleOpenTicketOrgAssign = useCallback(() => {
    setTicketActionModalVisible(false);
    setTicketOrgAssignModalVisible(true);
  }, []);

  const handleSaveTicketOrgAssign = useCallback(async (orgId: string, appId: string) => {
    const tkt = targetActionTicket || selectedTicket;
    if (!tkt) return;
    const userBlind = tkt.user_blind_id || (tkt.user_white_id ? WhiteDeskCrypto.generateBlindId(tkt.user_white_id) : '');
    const entBlind = tkt.enterprise_blind_id || activeEnterpriseBlindId || 'default';

    const success = await helpDeskService.reassignTicketAndUserOrgApp({
      ticketId: tkt.id,
      userBlindId: userBlind,
      enterpriseBlindId: entBlind,
      orgId,
      appId,
    });

    if (success) {
      if (selectedTicket && selectedTicket.id === tkt.id) {
        setSelectedTicket(prev => prev ? { ...prev, org_id: orgId, app_id: appId } : prev);
      }
      setTickets(prev => prev.map(t => t.id === tkt.id ? { ...t, org_id: orgId, app_id: appId } : t));
      setTicketOrgAssignModalVisible(false);

      Alert.alert(
        getLabel('helpdesk.org_app_assign_title'),
        getLabel('helpdesk.org_app_assign_updated_desc')
      );
    }
  }, [targetActionTicket, selectedTicket, activeEnterpriseBlindId, getLabel, setSelectedTicket, setTickets]);

  // 3. Delete single ticket
  const handleDeleteSingleTicket = useCallback(() => {
    if (!targetActionTicket) return;
    const tkt = targetActionTicket;
    setTicketActionModalVisible(false);
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.deleteTicketTitle'),
      description: `#${tkt.id} ${getLabel('helpdesk.deleteTicketConfirm')}`,
      actionText: getLabel('common.delete'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel'),
      onCancel: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        await helpDeskService.deleteTicket(tkt.id);
        if (selectedTicket && selectedTicket.id === tkt.id) {
          handleBackToList();
        }
        await loadData();
      },
    });
  }, [targetActionTicket, selectedTicket, getLabel, handleBackToList, loadData, setConfirmSheet]);

  // 4. Revoke admin authority
  const handleRevokeUserAdmin = useCallback(() => {
    if (!targetActionTicket) return;
    const targetId = targetActionTicket.user_white_id || targetActionTicket.user_blind_id || '';
    if (!targetId || targetId === ownWhiteId) return;

    setTicketActionModalVisible(false);
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.adminRevokeUserTitle'),
      description: `${formatWhiteId(targetId)} ${getLabel('helpdesk.adminRevokeConfirm')}`,
      actionText: getLabel('helpdesk.adminRevokeAction'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel'),
      onCancel: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        await helpDeskService.removeAdmin(targetId);
        const ticketTenant = targetActionTicket.enterprise_blind_id || selectedTenantBlindId || activeEnterpriseBlindId || 'default';
        void ephemeralAuthService.dispatchRevocation({
          targetWhiteId: targetId,
          tenantBlindId: ticketTenant,
          initiatorWhiteId: ownWhiteId,
          initiatorRole: adminRole as any,
        });
        await loadData();
        await loadConsoleData();
      },
    });
  }, [targetActionTicket, ownWhiteId, getLabel, loadData, loadConsoleData, selectedTenantBlindId, activeEnterpriseBlindId, adminRole, formatWhiteId, setConfirmSheet]);

  // 5. Promote user to Admin
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
  }, [targetActionTicket, setAssigningTicket, setNewAdminIdInput, setSuggestPrefixIndex, setSuggestCount, setNewAdminAliasInput, setAssignAppId, setAssignCatId, setAddAdminModalVisible]);

  // 6. Promote user to WhiteCosmos (Global Admin)
  const handlePromoteTicketUserToCosmos = useCallback(() => {
    if (!targetActionTicket) return;
    const targetId = targetActionTicket.user_white_id || targetActionTicket.user_blind_id || '';
    const ticketTenant = targetActionTicket.enterprise_blind_id || selectedTenantBlindId || activeEnterpriseBlindId || 'default';
    setTicketActionModalVisible(false);
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.makeCosmosTitle'),
      description: `${formatWhiteId(targetId)} ${getLabel('helpdesk.makeCosmosConfirm')}`,
      actionText: getLabel('helpdesk.makeCosmosAction'),
      actionColor: '#7C3AED',
      cancelText: getLabel('common.cancel'),
      onCancel: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        await helpDeskService.promoteUserToAdmin(targetId, ticketTenant, 'global_admin');
        void ephemeralAuthService.dispatchPromotion({
          targetWhiteId: targetId,
          targetRole: 'global_admin',
          tenantBlindId: ticketTenant,
          enterpriseName: currentEnterpriseName || undefined,
          initiatorWhiteId: ownWhiteId,
          initiatorRole: adminRole as any,
        });
        await loadData();
        await loadConsoleData();
      },
    });
  }, [targetActionTicket, selectedTenantBlindId, activeEnterpriseBlindId, currentEnterpriseName, ownWhiteId, adminRole, getLabel, loadData, loadConsoleData, formatWhiteId, setConfirmSheet]);

  // 7. Block user
  const handleBlockTicketUser = useCallback(() => {
    if (!targetActionTicket) return;
    const targetId = targetActionTicket.user_white_id || targetActionTicket.user_blind_id || '';
    const ticketTenant = targetActionTicket.enterprise_blind_id || selectedTenantBlindId || 'default';
    setTicketActionModalVisible(false);
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.blockUserTitle'),
      description: `${formatWhiteId(targetId)} ${getLabel('helpdesk.blockUserConfirm')}`,
      actionText: getLabel('helpdesk.blockUserAction'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel'),
      onCancel: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        await helpDeskService.blockOrDeleteUser(targetId, ticketTenant, 'block');
        await loadData();
      },
    });
  }, [targetActionTicket, selectedTenantBlindId, getLabel, loadData, formatWhiteId, setConfirmSheet]);

  // 8. Delete ticket & user
  const handleDeleteTicketAndUser = useCallback(() => {
    if (!targetActionTicket) return;
    const targetId = targetActionTicket.user_white_id || targetActionTicket.user_blind_id || '';
    const ticketTenant = targetActionTicket.enterprise_blind_id || selectedTenantBlindId || 'default';
    setTicketActionModalVisible(false);
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.deleteTicketUserTitle'),
      description: `${formatWhiteId(targetId)} ${getLabel('helpdesk.deleteTicketUserConfirm')}`,
      actionText: getLabel('common.delete'),
      actionColor: '#EF4444',
      cancelText: getLabel('common.cancel'),
      onCancel: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
      onAction: async () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        await helpDeskService.blockOrDeleteUser(targetId, ticketTenant, 'delete');
        await loadData();
      },
    });
  }, [targetActionTicket, selectedTenantBlindId, getLabel, loadData, formatWhiteId, setConfirmSheet]);

  // 9. Self destruct / Digital Clean proposal
  const showDigitalCleanProposal = useCallback((ticket: HelpDeskTicket) => {
    const retentionHours = Number(advancedFeaturesConfig?.selfDestruct?.retentionAfterResolvedHours) || 72;
    const durationText = retentionHours >= 168
      ? i18nService.t('helpdesk.duration_days', { count: Math.round(retentionHours / 24) })
      : i18nService.t('helpdesk.duration_hours', { count: retentionHours });

    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.self_destruct_start_title'),
      description: i18nService.t('helpdesk.self_destruct_start_desc', { duration: durationText }),
      actionText: getLabel('helpdesk.self_destruct_start_btn'),
      cancelText: getLabel('helpdesk.self_destruct_keep_btn'),
      actionColor: '#10B981',
      onAction: async () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        await helpDeskService.scheduleTicketAutoDelete(ticket.id, retentionHours);
        const autoDelAt = Date.now() + retentionHours * 60 * 60 * 1000;
        const note = `TTL_${Math.max(1, Math.round(retentionHours / 24))}D_${autoDelAt}`;
        setSelectedTicket(prev => prev?.id === ticket.id ? { ...prev, auto_delete_at: autoDelAt, resolution_note: note, status: 'closed' } : prev);
        setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, auto_delete_at: autoDelAt, resolution_note: note, status: 'closed' } : t));
        void loadData();
        setTimeout(() => {
          setConfirmSheet({
            visible: true,
            title: getLabel('helpdesk.self_destruct_started_title'),
            description: i18nService.t('helpdesk.self_destruct_started_desc', { duration: durationText }),
            actionText: getLabel('common.ok'),
            actionColor: '#10B981',
            onAction: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
          });
        }, 350);
      },
      onCancel: () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
      },
    });
  }, [advancedFeaturesConfig, getLabel, loadData, setSelectedTicket, setTickets, setConfirmSheet]);

  const handleStopAutoDelete = useCallback((ticket: HelpDeskTicket) => {
    setConfirmSheet({
      visible: true,
      title: getLabel('helpdesk.self_destruct_stop_title'),
      description: getLabel('helpdesk.self_destruct_stop_desc'),
      actionText: getLabel('helpdesk.self_destruct_stop_btn'),
      cancelText: getLabel('common.cancel'),
      actionColor: '#EF4444',
      onAction: async () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
        await helpDeskService.cancelTicketAutoDelete(ticket.id);
        setSelectedTicket(prev => prev?.id === ticket.id ? { ...prev, auto_delete_at: null } : prev);
        setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, auto_delete_at: null } : t));
        void loadData();
        setTimeout(() => {
          setConfirmSheet({
            visible: true,
            title: getLabel('helpdesk.self_destruct_stopped_title'),
            description: getLabel('helpdesk.self_destruct_stopped_desc'),
            actionText: getLabel('common.ok'),
            actionColor: '#3B82F6',
            onAction: () => setConfirmSheet((prev: any) => ({ ...prev, visible: false })),
          });
        }, 350);
      },
      onCancel: () => {
        setConfirmSheet((prev: any) => ({ ...prev, visible: false }));
      },
    });
  }, [getLabel, loadData, setSelectedTicket, setTickets, setConfirmSheet]);

  const handleStartSelfDestruct = useCallback(async (ticket?: any) => {
    const tkt = (ticket && typeof ticket === 'object' && 'id' in ticket && typeof ticket.id === 'string')
      ? (ticket as HelpDeskTicket)
      : (targetActionTicket || selectedTicket);
    if (!tkt) return;
    setTicketActionModalVisible(false);
    setTimeout(() => {
      showDigitalCleanProposal(tkt);
    }, 200);
  }, [targetActionTicket, selectedTicket, showDigitalCleanProposal]);

  const handleCancelSelfDestruct = useCallback(async (ticket?: any) => {
    const tkt = (ticket && typeof ticket === 'object' && 'id' in ticket && typeof ticket.id === 'string')
      ? (ticket as HelpDeskTicket)
      : (targetActionTicket || selectedTicket);
    if (!tkt) return;
    setTicketActionModalVisible(false);
    setTimeout(() => {
      handleStopAutoDelete(tkt);
    }, 200);
  }, [targetActionTicket, selectedTicket, handleStopAutoDelete]);

  return {
    ticketActionModalVisible,
    setTicketActionModalVisible,
    targetActionTicket,
    setTargetActionTicket,
    targetActionMessages,
    targetActionRole,
    setTargetActionRole,
    ticketOrgAssignModalVisible,
    setTicketOrgAssignModalVisible,
    ticketMenuAnchorY,
    handleTicketMenuPress,
    handleTicketLongPress,
    handleOpenTicketOrgAssign,
    handleSaveTicketOrgAssign,
    handleDeleteSingleTicket,
    handleRevokeUserAdmin,
    handlePromoteTicketUserToAdmin,
    handlePromoteTicketUserToCosmos,
    handleBlockTicketUser,
    handleDeleteTicketAndUser,
    showDigitalCleanProposal,
    handleStopAutoDelete,
    handleStartSelfDestruct,
    handleCancelSelfDestruct,
  };
}
