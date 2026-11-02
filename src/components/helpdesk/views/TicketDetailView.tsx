import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  Modal,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import {
  ChevronLeft,
  Edit3,
  X,
  Camera,
  Paperclip,
  FileText,
  Phone,
  Mic,
  Send,
  Tag,
  MoreVertical,
  Leaf,
  Image as ImageIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  Cpu,
  Monitor,
  ArrowRight,
  Share2,
  Lock,
  Search,
  Check,
  Eye,
  UserCheck,
  AlertCircle,
  ShieldCheck,
  Clock,
} from 'lucide-react-native';
import { HelpDeskTicket, HelpDeskMessage, TicketStatus, helpDeskService } from '../../../services/helpDeskService';
import { piiSanitizer } from '../../../services/piiSanitizer';
import { WhiteDeskCrypto } from '../../../whitedesk-sdk';
import { AdminBadge, tierFromRole, tierFromCategory } from '../AdminBadge';
import { AttachedFile, RemoteDesktopScope } from '../types';
import { isImageFile, getFileMimeType } from '../utils/fileMimeUtils';
import { remoteDesktopService, RemoteDesktopSession } from '../../../services/remoteDesktopService';
import { RemoteDesktopModal } from '../modals/RemoteDesktopModal';

interface TicketDetailViewProps {
  safeTop: number;
  keyboardHeight: number;
  insetsBottom: number;
  scrollY: Animated.Value;
  messagesScrollRef: React.RefObject<ScrollView | null>;
  selectedTicket: HelpDeskTicket;
  ticketMessages: HelpDeskMessage[];
  ownWhiteId: string;
  isAdmin: boolean;
  customAlias: string | null;
  editingMessage: HelpDeskMessage | null;
  setEditingMessage: (m: HelpDeskMessage | null) => void;
  replyText: string;
  setReplyText: (t: string) => void;
  replyFocused: boolean;
  setReplyFocused: (f: boolean) => void;
  attachedFile: AttachedFile | null;
  setAttachedFile: (f: AttachedFile | null) => void;
  attachedFiles?: AttachedFile[];
  onRemoveAttachedFile?: (index: number) => void;
  onSetAttachedFiles?: (files: AttachedFile[]) => void;
  sending: boolean;
  language: string;
  getLabel: (key: string, tr: string, en: string) => string;
  formatWhiteId: (id: string) => string;
  formatAppId: (id?: string) => string;
  formatTicketDate: (ts: number, showTime?: boolean) => string;
  getCategoryLabel: (cat?: string) => string;
  showResolutionCheck?: boolean;
  isAutoClosed?: boolean;
  isSecondReminder?: boolean;
  onResolutionClose?: () => void;
  onResolutionAsk?: () => void;
  onBack: () => void;
  onToggleStatus: () => void;
  onTicketLongPress?: (t: HelpDeskTicket) => void;
  onTicketMenuPress?: (t: HelpDeskTicket, pageY?: number) => void;
  onOpenDocument: (name: string, data: string) => void;
  onPreviewImage: (uri: string, name?: string) => void;
  onPickCamera: () => void;
  onPickGallery: () => void;
  onPickDocument: () => void;
  onCallPress: () => void;
  onPttPress?: () => void;
  onReplyTicket: () => void;
  showVoiceCall?: boolean;
  showPushToTalk?: boolean;
  onPttPressIn?: () => void;
  onPttPressOut?: () => void;
  isPttActive?: boolean;
  onOpenRating?: () => void;
  onStartSelfDestruct?: () => void;
  onCancelSelfDestruct?: () => void;
  onInspectDiagnostics?: (ticket: HelpDeskTicket, diagnosticAttachment?: any) => void;
  attachDiagnostics?: boolean;
  setAttachDiagnostics?: (v: boolean) => void;
  onMainMenuPress?: () => void;
  showRemoteDesktop?: boolean;
  userRemoteDesktopEnabled?: boolean;
  userRemoteDesktopScope?: RemoteDesktopScope;
  isTransferMode?: boolean;
  selectedTransferAdmin?: { white_id: string; blind_id: string; alias: string; role?: string } | null;
  transferSearchText?: string;
  setTransferSearchText?: (text: string) => void;
  transferBottomSheetVisible?: boolean;
  setTransferBottomSheetVisible?: (val: boolean) => void;
  enterpriseAdminsList?: Array<{ white_id: string; blind_id: string; alias: string; role: string; assigned_tickets_count: number }>;
  onSelectTransferAdmin?: (admin: any) => void;
  onCancelTransfer?: () => void;
  onSendTransfer?: () => void;
  onAcceptTransfer?: () => void;
  onOpenReject?: () => void;
  rejectModalVisible?: boolean;
  setRejectModalVisible?: (val: boolean) => void;
  rejectReason?: string;
  setRejectReason?: (val: string) => void;
  onConfirmReject?: () => void;
  isInspectMode?: boolean;
  setIsInspectMode?: (val: boolean) => void;
  onTriggerWhisperAt?: () => void;
  onTakeOverTicket?: (ticket: HelpDeskTicket) => void;
}

export const TicketDetailView: React.FC<TicketDetailViewProps> = ({
  safeTop,
  keyboardHeight,
  insetsBottom,
  scrollY,
  messagesScrollRef,
  selectedTicket,
  ticketMessages,
  ownWhiteId,
  isAdmin,
  customAlias,
  editingMessage,
  setEditingMessage,
  onTakeOverTicket,
  replyText,
  setReplyText,
  replyFocused,
  setReplyFocused,
  attachedFile,
  setAttachedFile,
  attachedFiles = [],
  onRemoveAttachedFile,
  onSetAttachedFiles,
  sending,
  language,
  getLabel,
  formatWhiteId,
  formatAppId,
  formatTicketDate,
  getCategoryLabel,
  showResolutionCheck = false,
  isAutoClosed = false,
  isSecondReminder = false,
  onResolutionClose,
  onResolutionAsk,
  onBack,
  onToggleStatus,
  onTicketLongPress,
  onTicketMenuPress,
  onOpenDocument,
  onPreviewImage,
  onPickCamera,
  onPickGallery,
  onPickDocument,
  onCallPress,
  onPttPress,
  onReplyTicket,
  showVoiceCall = false,
  showPushToTalk = false,
  onPttPressIn,
  onPttPressOut,
  isPttActive = false,
  onOpenRating,
  onStartSelfDestruct,
  onCancelSelfDestruct,
  onInspectDiagnostics,
  attachDiagnostics = false,
  setAttachDiagnostics,
  onMainMenuPress,
  showRemoteDesktop = true,
  userRemoteDesktopEnabled = true,
  userRemoteDesktopScope = 'in_app',
  isTransferMode = false,
  selectedTransferAdmin = null,
  transferSearchText = '',
  setTransferSearchText,
  transferBottomSheetVisible = false,
  setTransferBottomSheetVisible,
  enterpriseAdminsList = [],
  onSelectTransferAdmin,
  onCancelTransfer,
  onSendTransfer,
  onAcceptTransfer,
  onOpenReject,
  rejectModalVisible = false,
  setRejectModalVisible,
  rejectReason = '',
  setRejectReason,
  onConfirmReject,
  isInspectMode = false,
  setIsInspectMode,
  onTriggerWhisperAt,
}) => {
  const [rdSession, setRdSession] = React.useState<RemoteDesktopSession | null>(
    remoteDesktopService.getSession()
  );

  React.useEffect(() => {
    const unsub = remoteDesktopService.subscribe(setRdSession);
    return () => unsub();
  }, []);

  React.useEffect(() => {
    if (!selectedTicket?.id || isAdmin) return;
    const stopWatch = remoteDesktopService.startUserWatcher(
      selectedTicket.id,
      isAdmin,
      userRemoteDesktopEnabled !== false
    );
    return () => stopWatch();
  }, [
    selectedTicket?.id,
    isAdmin,
    userRemoteDesktopEnabled,
  ]);
  const diagnosticAttachment = React.useMemo(() => {
    if (selectedTicket?.attachment_name?.includes('diagnostics.whitedesk') || selectedTicket?.attachment_type === 'diagnostic') {
      return {
        name: selectedTicket.attachment_name || 'diagnostics.whitedesk',
        data: selectedTicket.attachment_data,
        type: 'diagnostic',
      };
    }
    if (Array.isArray(selectedTicket?.attachments)) {
      const found = selectedTicket.attachments.find((f: any) => f.name?.includes('diagnostics.whitedesk') || f.type === 'diagnostic');
      if (found) return found;
    }
    if (selectedTicket?.attachment_data && selectedTicket.attachment_data.startsWith('[')) {
      try {
        const parsed = JSON.parse(selectedTicket.attachment_data);
        if (Array.isArray(parsed)) {
          const found = parsed.find((f: any) => f.name?.includes('diagnostics.whitedesk') || f.type === 'diagnostic');
          if (found) return found;
        }
      } catch {}
    }
    for (const msg of (ticketMessages || [])) {
      if (msg.attachment_name?.includes('diagnostics.whitedesk') || msg.attachment_type === 'diagnostic') {
        return {
          name: msg.attachment_name || 'diagnostics.whitedesk',
          data: msg.attachment_data,
          type: 'diagnostic',
        };
      }
      if (Array.isArray(msg.attachments)) {
        const found = msg.attachments.find((f: any) => f.name?.includes('diagnostics.whitedesk') || f.type === 'diagnostic');
        if (found) return found;
      }
      if (msg.attachment_data && msg.attachment_data.startsWith('[')) {
        try {
          const parsed = JSON.parse(msg.attachment_data);
          if (Array.isArray(parsed)) {
            const found = parsed.find((f: any) => f.name?.includes('diagnostics.whitedesk') || f.type === 'diagnostic');
            if (found) return found;
          }
        } catch {}
      }
    }
    return null;
  }, [selectedTicket, ticketMessages]);

  const hasDiagnostics = !!diagnosticAttachment;

  const isClosed = selectedTicket?.status === 'closed';
  const selfDestructInfo = (typeof helpDeskService?.getTicketSelfDestructInfo === 'function')
    ? helpDeskService.getTicketSelfDestructInfo(selectedTicket)
    : { inDestruction: false };
  const lifecycle = (typeof helpDeskService?.getTicketLifecycleStatus === 'function')
    ? helpDeskService.getTicketLifecycleStatus(selectedTicket)
    : { stage: 'open' as const, inDestruction: false };
  const effectiveAttachedFiles = attachedFiles.length > 0 ? attachedFiles : (attachedFile ? [attachedFile] : []);

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
    if (status === 'revoked') {
      return (
        <View style={styles.pillRevoked}>
          <Text style={styles.pillRevokedText}>
            {getLabel('helpdesk.filterRevoked', 'Eskale Edildi', 'Escalated')}
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

      {/* DETAIL SCROLL VIEW */}
      <Animated.ScrollView 
        key="helpdesk-detail-scroll"
        ref={messagesScrollRef}
        style={StyleSheet.absoluteFillObject}
        contentContainerStyle={[
          styles.scrollContainerFluid,
          {
            paddingTop: safeTop + 10,
            paddingBottom: (attachedFile ? 250 : 200) + (keyboardHeight > 0 ? keyboardHeight + 10 : Math.max(insetsBottom, 14)),
          }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        onContentSizeChange={() => messagesScrollRef.current?.scrollToEnd({ animated: true })}
      >
        {/* WHITEDESK LOGO */}
        <View style={styles.scrollLogoRow}>
          <Text style={styles.logoText} numberOfLines={1} adjustsFontSizeToFit>WhiteDesk</Text>
        </View>

        {/* SECTION HEADER ROW */}
        <View style={styles.sectionRowFluid}>
          <TouchableOpacity
            style={styles.sectionTitleContainer}
            onPress={onBack}
            activeOpacity={0.6}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 30 }}
          >
            <ChevronLeft size={20} color="#64748B" style={{ marginRight: 4 }} />
            <Text style={styles.sectionTitleText}>
              {getLabel('menu.helpDesk', 'Destek', 'Support')}
            </Text>
          </TouchableOpacity>

          <View style={styles.headerButtonlessActions}>
            {showVoiceCall && (
              <TouchableOpacity
                style={[styles.headerActionCircleBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                onPress={onCallPress}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Phone size={16} color="#15803D" strokeWidth={2.2} />
              </TouchableOpacity>
            )}

            {showPushToTalk && (
              <TouchableOpacity
                style={[
                  styles.headerActionCircleBtn,
                  {
                    backgroundColor: isPttActive ? '#CCFBF1' : '#F0FDFA',
                    borderColor: isPttActive ? '#0F766E' : '#99F6E4',
                    marginLeft: 8,
                  },
                ]}
                onPress={onPttPress}
                onPressIn={onPttPressIn}
                onPressOut={onPttPressOut}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Mic size={16} color="#0F766E" strokeWidth={2.2} />
              </TouchableOpacity>
            )}

            {isAdmin && showRemoteDesktop && !isClosed && (
              <TouchableOpacity
                style={[
                  styles.headerActionCircleBtn,
                  {
                    backgroundColor: rdSession?.status === 'active' ? '#DBEAFE' : '#EFF6FF',
                    borderColor: rdSession?.status === 'active' ? '#2563EB' : '#BFDBFE',
                    marginLeft: 8,
                  },
                ]}
                onPress={() => {
                  void remoteDesktopService.startAdminOffer(
                    selectedTicket.id,
                    customAlias || 'Admin',
                    selectedTicket.user_white_id || selectedTicket.user_blind_id || '',
                    ownWhiteId || ''
                  );
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Monitor size={16} color="#2563EB" strokeWidth={2.2} />
              </TouchableOpacity>
            )}

            {(onTicketMenuPress || onMainMenuPress) && (
              <TouchableOpacity
                style={[
                  styles.headerActionCircleBtn,
                  {
                    backgroundColor: '#F8FAFC',
                    borderColor: '#E2E8F0',
                    marginLeft: 8,
                  },
                ]}
                onPress={(e) => {
                  if (onTicketMenuPress && selectedTicket) {
                    onTicketMenuPress(selectedTicket, e.nativeEvent?.pageY);
                  } else if (onMainMenuPress) {
                    onMainMenuPress();
                  }
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <MoreVertical size={16} color="#475569" strokeWidth={2.2} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* TICKET HEADER CARD */}
        <View style={styles.detailCardHeaderFluid}>
          {/* Strictly Confidential Banner (Karar 2: TheWhite ◄► Global Admin) */}
          {selectedTicket.category === 'root_support' && (
            <View style={styles.rootConfidentialBanner}>
              <Lock size={13} color="#059669" style={{ marginRight: 6 }} />
              <Text style={styles.rootConfidentialBannerText}>
                {language === 'tr'
                  ? 'Tam Gizli: Bu bilet TheWhite ve Global Admin arasında doğrudan uçtan uca şifrelidir.'
                  : 'Strictly Confidential: This ticket is end-to-end encrypted between TheWhite and Global Admin.'}
              </Text>
            </View>
          )}

          <View style={styles.cardHeaderTopRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.ticketIdMonoText}>{selectedTicket.id}</Text>
              {/* Tenant Adı: Sabit 'inwhite' yerine gerçek kayıtlı Tenant Adı */}
              {selectedTicket.enterprise_name ? (
                <View style={styles.appTagBadge}>
                  <Text style={styles.appTagBadgeText}>{selectedTicket.enterprise_name}</Text>
                </View>
              ) : (selectedTicket.app_id && selectedTicket.app_id.toLowerCase() !== 'inwhite' && selectedTicket.app_id.toLowerCase() !== 'whitedesk') ? (
                <View style={styles.appTagBadge}>
                  <Text style={styles.appTagBadgeText}>{selectedTicket.app_id}</Text>
                </View>
              ) : null}
              {(() => {
                const effectiveCat = selectedTicket.is_discussion ? 'discussion' : selectedTicket.category;
                const tier = tierFromCategory(effectiveCat);
                if (tier !== null) {
                  return <View style={{ marginLeft: 4 }}><AdminBadge tier={tier} size={13} /></View>;
                }
                return selectedTicket.category && selectedTicket.category !== 'general' && selectedTicket.category.toLowerCase() !== 'voice' ? (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{getCategoryLabel(selectedTicket.category)}</Text>
                  </View>
                ) : null;
              })()}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {renderStatusPill(selectedTicket.status)}
              {onTicketMenuPress && (
                <TouchableOpacity
                  style={{ marginLeft: 8, padding: 6 }}
                  onPress={(e) => onTicketMenuPress(selectedTicket, e.nativeEvent?.pageY)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.6}
                >
                  <MoreVertical size={18} color="#475569" strokeWidth={2.2} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.detailSubjectText}>{piiSanitizer.sanitize(selectedTicket.subject).sanitizedText}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.ticketDateMutedText}>
                {getLabel('helpdesk.created', 'Oluşturma:', 'Created:')} {formatTicketDate(selectedTicket.created_at, true)}
              </Text>
              {selfDestructInfo.inDestruction && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                  <Leaf size={12} color="#10B981" strokeWidth={2.4} />
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#10B981', marginLeft: 3 }}>
                    {selfDestructInfo.remainingText || `${selfDestructInfo.remainingDays} g`}
                  </Text>
                </View>
              )}
            </View>

            {/* 1. İletme esnasında (beklemede/gönderilirken): tarihin sağında YALNIZCA yeşil ok */}
            {(isTransferMode || selectedTicket.transfer_status === 'pending') && (
              <ArrowRight size={15} color="#10B981" strokeWidth={2.5} />
            )}

            {/* 2. Bileti kabul ettikten sonra: tarihin sağında sağa yanaşık, okun solunda hangi adminden geldiği, hem admin adı hem ok gri */}
            {!isTransferMode && selectedTicket.transfer_status === 'accepted' && (selectedTicket.transferred_from_alias || selectedTicket.transfer_sender_alias) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B' }}>
                  @{selectedTicket.transferred_from_alias || selectedTicket.transfer_sender_alias}
                </Text>
                <ArrowRight size={13} color="#64748B" strokeWidth={2} />
              </View>
            )}
          </View>

          {/* Allocation & SLA Escalation Status & Claim Button */}
          {(() => {
            const isRevoked = selectedTicket.status === 'revoked';
            const assignedName = selectedTicket.assigned_admin_name || selectedTicket.assigned_admin_alias;
            const assignedBlind = selectedTicket.assigned_admin_blind_id;
            const isPool = !assignedBlind || assignedBlind === 'unassigned';
            const myBlindId = (ownWhiteId && typeof WhiteDeskCrypto?.generateBlindId === 'function')
              ? WhiteDeskCrypto.generateBlindId(ownWhiteId)
              : '';
            const canClaim = isAdmin && (isRevoked || isPool || (myBlindId && myBlindId !== assignedBlind));

            const showSection = isRevoked || selectedTicket.reassigned_from || assignedName || (assignedBlind && assignedBlind !== 'unassigned') || isPool || canClaim;
            if (!showSection) return null;

            return (
              <View style={{ marginTop: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {isRevoked ? (
                      <View style={styles.inlineEscalatedPill}>
                        <Text style={styles.inlineEscalatedPillText}>
                          ⚠️ Eskale Edildi (SLA Aşımı)
                        </Text>
                      </View>
                    ) : selectedTicket.reassigned_from ? (
                      <Text style={styles.allocationMutedText}>
                        🔄 Yeniden Atandı: {assignedName ? `@${assignedName}` : (assignedBlind ? assignedBlind.substring(0, 14) + '...' : 'Havuz')}
                      </Text>
                    ) : assignedName ? (
                      <Text style={styles.allocationMutedText}>
                        👤 Atandı: @{assignedName}
                      </Text>
                    ) : assignedBlind && assignedBlind !== 'unassigned' ? (
                      <Text style={styles.allocationMutedText}>
                        👤 Atandı: {assignedBlind.substring(0, 14)}...
                      </Text>
                    ) : isPool ? (
                      <View style={styles.poolBadge}>
                        <Clock size={10} color="#3B82F6" style={{ marginRight: 3 }} />
                        <Text style={styles.poolBadgeText}>Havuzda (Atama Bekliyor)</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Claim (Bileti Devral) Butonu (Karar 3: Claim Modeli) */}
                  {canClaim && onTakeOverTicket && (
                    <TouchableOpacity
                      style={styles.claimActionBtn}
                      onPress={() => onTakeOverTicket(selectedTicket)}
                      activeOpacity={0.7}
                    >
                      <ShieldCheck size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.claimActionBtnText}>
                        {language === 'tr' ? 'Bileti Devral (Claim)' : 'Claim Ticket'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })()}

          {/* Tarih-saatin altındaki Transfer Satırı & Admin Seçimi */}
          {(isTransferMode || selectedTicket.transfer_status === 'pending') && (
            <View style={styles.transferInfoRow}>
              <Text style={styles.transferInfoLabel}>{language === 'tr' ? 'Transfer Et:' : 'Hand Over:'}</Text>
              {isTransferMode ? (
                <TouchableOpacity
                  style={styles.transferAdminSelectBtn}
                  onPress={() => setTransferBottomSheetVisible?.(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.transferAdminSelectBtnText}>
                    {selectedTransferAdmin ? `@${selectedTransferAdmin.alias}` : (language === 'tr' ? 'Admin Seçin...' : 'Select Admin...')}
                  </Text>
                  <ChevronLeft size={14} color="#64748B" style={{ transform: [{ rotate: '-90deg' }] }} />
                </TouchableOpacity>
              ) : (
                <View style={styles.transferBadgeFixed}>
                  <Text style={styles.transferBadgeFixedText}>
                    {selectedTicket.transfer_sender_alias ? `@${selectedTicket.transfer_sender_alias} ➔ ` : ''}
                    {selectedTicket.transfer_target_alias ? `@${selectedTicket.transfer_target_alias}` : 'Onay Bekliyor'}
                  </Text>
                </View>
              )}
              {isTransferMode && onCancelTransfer && (
                <TouchableOpacity
                  style={styles.transferCancelMiniBtn}
                  onPress={onCancelTransfer}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={14} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* MESSAGES LIST */}
        <View style={{ paddingTop: 10 }}>
          {(() => {
            const ownBlindId = (ownWhiteId && typeof WhiteDeskCrypto?.generateBlindId === 'function')
              ? WhiteDeskCrypto.generateBlindId(ownWhiteId)
              : '';
            const effectiveMessages = (ticketMessages || []).filter(msg => {
              // 0 Sızıntı İlkesi: Müşteri cihazı dahili notları ve fısıltıları ASLA göremez!
              if (!isAdmin && (msg.is_internal || msg.is_whisper)) {
                return false;
              }
              return true;
            });
            return effectiveMessages.map((msg, index) => {
              const isMine =
                (msg.sender_blind_id && ownBlindId && msg.sender_blind_id === ownBlindId) ||
                (msg.sender_white_id && ownBlindId && msg.sender_white_id === ownBlindId) ||
                (msg.sender_white_id && ownWhiteId && msg.sender_white_id.toLowerCase() === ownWhiteId.toLowerCase());
              const isLastMessage = index === ticketMessages.length - 1;
              const canEdit = isMine && isLastMessage && !isClosed;
              const isEditingThis = editingMessage?.id === msg.id;

              let senderLabel = '';
              if (isMine) {
                senderLabel = language === 'tr' ? 'Ben' : 'You';
              } else if (isAdmin) {
                // Admin tarafında: Karşı taraf kullanıcıdır.
                const rawAlias = msg.sender_alias?.trim();
                const isGeneric = !rawAlias ||
                  rawAlias.toLowerCase() === 'kullanıcı' ||
                  rawAlias.toLowerCase() === 'kullanici' ||
                  rawAlias.toLowerCase() === 'user' ||
                  rawAlias.toLowerCase() === 'destek' ||
                  rawAlias.startsWith('blind_') ||
                  rawAlias.length >= 30;
                senderLabel = isGeneric ? (language === 'tr' ? 'Kullanıcı' : 'User') : rawAlias;
              } else {
                // Kullanıcı tarafında: Karşı taraf admindir.
                const rawAlias = msg.sender_alias?.trim();
                const isGeneric = !rawAlias ||
                  rawAlias.toLowerCase() === 'admin' ||
                  rawAlias.toLowerCase() === 'operator' ||
                  rawAlias.toLowerCase() === 'destek' ||
                  rawAlias.toLowerCase().includes('thewhite') ||
                  rawAlias.toLowerCase().includes('whitecosmos') ||
                  rawAlias.toLowerCase().startsWith('planet-');
                senderLabel = isGeneric ? 'Admin' : rawAlias;
              }

              // Çoklu ek çözümleme (Single base64, msg.attachments veya JSON Array)
              let msgAttachments: AttachedFile[] = [];
              if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
                msgAttachments = msg.attachments.map((a: any, aIdx: number) => {
                  const effectiveName = a.name || `ek_${aIdx + 1}`;
                  const effectiveMime = a.mimeType || getFileMimeType(effectiveName);
                  const isImg = isImageFile(effectiveName, effectiveMime, a.data);
                  return {
                    name: effectiveName,
                    data: a.data || '',
                    type: (isImg ? 'image' : (a.type || 'document')) as any,
                    mimeType: effectiveMime,
                  };
                });
              } else if (msg.attachment_data) {
                if (msg.attachment_type === 'multi' || msg.attachment_data.startsWith('[') || msg.attachment_data.startsWith('{"')) {
                  try {
                    const parsed = JSON.parse(msg.attachment_data);
                    if (Array.isArray(parsed)) {
                      msgAttachments = parsed.map((a: any, aIdx: number) => {
                        const effectiveName = a.name || `ek_${aIdx + 1}`;
                        const effectiveMime = a.mimeType || getFileMimeType(effectiveName);
                        const isImg = isImageFile(effectiveName, effectiveMime, a.data);
                        return {
                          name: effectiveName,
                          data: a.data || '',
                          type: (isImg ? 'image' : (a.type || 'document')) as any,
                          mimeType: effectiveMime,
                        };
                      });
                    } else if (parsed && typeof parsed === 'object') {
                      const effectiveName = parsed.name || msg.attachment_name || 'ek_dosya';
                      const effectiveMime = parsed.mimeType || getFileMimeType(effectiveName);
                      const isImg = isImageFile(effectiveName, effectiveMime, parsed.data);
                      msgAttachments = [{
                        name: effectiveName,
                        data: parsed.data || msg.attachment_data,
                        type: (isImg ? 'image' : (parsed.type || 'document')) as any,
                        mimeType: effectiveMime,
                      }];
                    }
                  } catch {
                    const effectiveName = msg.attachment_name || 'belge.pdf';
                    const effectiveMime = getFileMimeType(effectiveName);
                    const isImg = isImageFile(effectiveName, effectiveMime, msg.attachment_data);
                    msgAttachments = [{
                      name: effectiveName,
                      data: msg.attachment_data,
                      type: (isImg ? 'image' : (msg.attachment_type === 'image' ? 'image' : 'document')) as any,
                      mimeType: effectiveMime,
                    }];
                  }
                } else {
                  const effectiveName = msg.attachment_name || (msg.attachment_type === 'image' ? 'photo.jpg' : 'belge.pdf');
                  const effectiveMime = getFileMimeType(effectiveName);
                  const isImg = isImageFile(effectiveName, effectiveMime, msg.attachment_data);
                  msgAttachments = [{
                    name: effectiveName,
                    data: msg.attachment_data,
                    type: (isImg ? 'image' : 'document') as any,
                    mimeType: effectiveMime,
                  }];
                }
              }

              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageBubbleWrapper,
                    isMine ? styles.messageBubbleMine : styles.messageBubbleOther,
                    isEditingThis && styles.messageBubbleEditing,
                  ]}
                >
                  <View style={styles.messageBubbleTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
                      <Text style={[styles.messageSenderText, isMine && { color: '#3B82F6' }]} numberOfLines={1}>
                        {senderLabel}
                      </Text>
                      {/* Unified AdminBadge — same tier logic as ticket cards */}
                      {msg.is_admin && !isMine && (() => {
                        const tier = tierFromRole(msg.is_admin, msg.sender_role);
                        return tier !== null ? (
                          <View style={{ marginLeft: 5 }}>
                            <AdminBadge tier={tier} size={11} />
                          </View>
                        ) : null;
                      })()}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {isMine ? (
                        <ArrowUpRight size={12} color="#94A3B8" strokeWidth={2.4} style={{ marginRight: 4 }} />
                      ) : (
                        <ArrowDownLeft size={12} color="#94A3B8" strokeWidth={2.4} style={{ marginRight: 4 }} />
                      )}
                      <Text style={styles.messageTimeText}>
                        {formatTicketDate(msg.created_at, true)}
                      </Text>
                    </View>
                  </View>

                  {/* Fısıltı Rozeti */}
                  {msg.is_whisper && (
                    <View style={styles.whisperBadgeRow}>
                      <Lock size={10} color="#7C3AED" style={{ marginRight: 3 }} />
                      <Text style={styles.whisperBadgeText}>
                        {msg.whisper_target_alias ? `Fısıltı: @${msg.whisper_target_alias}` : 'Özel Fısıltı'}
                      </Text>
                    </View>
                  )}

                  {(() => {
                    const isWhisperTarget = Boolean(
                      (msg.whisper_target_blind_id && ownBlindId && msg.whisper_target_blind_id === ownBlindId) ||
                      (msg.whisper_target_white_id && ownWhiteId && msg.whisper_target_white_id.toLowerCase() === ownWhiteId.toLowerCase()) ||
                      (msg.whisper_target_alias && customAlias && msg.whisper_target_alias.toLowerCase() === customAlias.toLowerCase())
                    );
                    const canReadWhisper = !msg.is_whisper || isMine || isWhisperTarget;

                    if (!canReadWhisper) {
                      return (
                        <View style={{ paddingVertical: 4 }}>
                          <Text style={[styles.messageBodyText, { fontStyle: 'italic', color: '#6D28D9' }]}>
                            🔒 [Özel Fısıltı: @{msg.whisper_target_alias || 'Yönetici'} için şifrelendi]
                          </Text>
                        </View>
                      );
                    }

                    if (!msg.message) return null;
                    const delimiter = '--- 📋 [Kayıt Bilgileri] ---';
                    if (msg.message.includes(delimiter)) {
                      const parts = msg.message.split(delimiter);
                      const mainText = parts[0] || '';
                      const customDetails = parts[1] || '';
                      const detailLines = customDetails.trim().split('\n').filter(l => l.trim().length > 0);
                    return (
                      <View>
                        {!!mainText.trim() && (
                          <TouchableOpacity
                            activeOpacity={canEdit ? 0.75 : 1}
                            disabled={!canEdit}
                            onLongPress={() => {
                              if (canEdit) {
                                setEditingMessage(msg);
                                setReplyText(msg.message || '');
                                if (msgAttachments.length > 0) {
                                  if (onSetAttachedFiles) onSetAttachedFiles(msgAttachments);
                                  else setAttachedFile(msgAttachments[0]);
                                }
                              }
                            }}
                          >
                            <Text style={styles.messageBodyText} selectable={!canEdit}>
                              {piiSanitizer.sanitize(mainText.trim()).sanitizedText}
                            </Text>
                          </TouchableOpacity>
                        )}
                        <View style={[
                          styles.customFieldsBubbleCard,
                          {
                            backgroundColor: isEditingThis ? '#DCEBFC' : (isMine ? '#E8F1FC' : 'rgba(255, 255, 255, 0.65)'),
                          },
                        ]}>
                          <View style={styles.customFieldsBubbleHeader}>
                            <Tag size={11} color="#2563EB" style={{ marginRight: 4 }} />
                            <Text style={styles.customFieldsBubbleTitle}>Kayıt Bilgileri</Text>
                          </View>
                          {detailLines.map((line, lIdx) => (
                            <Text key={`det_${lIdx}`} style={styles.customFieldsBubbleLine}>
                              {piiSanitizer.sanitize(line.replace(/^•\s*/, '• ')).sanitizedText}
                            </Text>
                          ))}
                        </View>
                      </View>
                    );
                  }
                  return (
                    <TouchableOpacity
                      activeOpacity={canEdit ? 0.75 : 1}
                      disabled={!canEdit}
                      onLongPress={() => {
                        if (canEdit) {
                          setEditingMessage(msg);
                          setReplyText(msg.message || '');
                          if (msgAttachments.length > 0) {
                            if (onSetAttachedFiles) onSetAttachedFiles(msgAttachments);
                            else setAttachedFile(msgAttachments[0]);
                          }
                        }
                      }}
                    >
                      <Text style={styles.messageBodyText} selectable={!canEdit}>
                        {piiSanitizer.sanitize(msg.message).sanitizedText}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}

                {/* Attachments List: Compact Pill / Box Layout, Wraps smoothly, Never huge image dump */}
                {msgAttachments.length > 0 && (
                  <View style={styles.msgAttachmentsGrid}>
                    {msgAttachments.map((att, attIdx) => {
                      const isImg = isImageFile(att.name, att.mimeType, att.data);
                      return (
                        <TouchableOpacity
                          key={`msg_att_${msg.id}_${attIdx}`}
                          style={[
                            styles.msgAttachmentPill,
                            {
                              backgroundColor: isEditingThis ? '#DCEBFC' : (isMine ? '#E8F1FC' : 'rgba(255, 255, 255, 0.65)'),
                            },
                          ]}
                          onPress={() => {
                            if (att.name?.includes('diagnostics.whitedesk') || (att as any).type === 'diagnostic') {
                              onInspectDiagnostics?.(selectedTicket, att);
                              return;
                            }
                            if (isImg) {
                              const rawData = att.data || '';
                              const uriToSend = (rawData.startsWith('file://') || rawData.startsWith('http://') || rawData.startsWith('https://'))
                                ? rawData
                                : (rawData.startsWith('data:') ? rawData : `data:${att.mimeType || 'image/jpeg'};base64,${rawData}`);
                              onPreviewImage(uriToSend, att.name || `image_${attIdx + 1}.jpg`);
                            } else {
                              onOpenDocument(att.name || 'document.pdf', att.data || '');
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          {isImg ? (
                            <ImageIcon size={14} color="#2563EB" style={{ marginRight: 6 }} />
                          ) : (
                            <FileText size={14} color="#2563EB" style={{ marginRight: 6 }} />
                          )}
                          <Text style={styles.msgAttachmentPillText} numberOfLines={1}>
                            {att.name || (isImg ? `Görsel ${attIdx + 1}` : `Belge ${attIdx + 1}`)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          });
        })()}
        </View>
      </Animated.ScrollView>

      {/* WHITEFIN STYLE REPLY PANEL CARD (STICKS ABOVE KEYBOARD) */}
      {selectedTicket?.status === 'revoked' ? (
        <View
          style={[
            styles.replyCardPanelContainerFluid,
            {
              bottom: keyboardHeight > 0 ? keyboardHeight + 8 : Math.max(insetsBottom, 12),
              backgroundColor: '#FEF3C7',
              borderColor: '#F59E0B',
              borderWidth: 1,
              paddingVertical: 14,
              paddingHorizontal: 16,
            }
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AlertCircle size={20} color="#D97706" style={{ marginRight: 10 }} />
            <Text style={{ flex: 1, fontSize: 13, color: '#92400E', fontWeight: '700', lineHeight: 18 }}>
              {language === 'tr'
                ? 'Bu bilet SLA yanıt süresi aşıldığı için yeni bir temsilciye aktarılmıştır. Bilet salt-okunur moddadır.'
                : 'This ticket was escalated due to SLA timeout. It is now in read-only mode.'}
            </Text>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.replyCardPanelContainerFluid,
            {
              bottom: keyboardHeight > 0 ? keyboardHeight + 8 : Math.max(insetsBottom, 12),
            }
          ]}
        >
        {/* Edit Mode Indicator */}
        {editingMessage && (
          <View style={styles.editIndicatorBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Edit3 size={14} color="#3B82F6" style={{ marginRight: 6 }} />
              <Text style={styles.editIndicatorText}>
                {getLabel('helpdesk.editingMessage', 'Mesajı Düzenle', 'Edit Message')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setEditingMessage(null);
                setReplyText('');
                setAttachedFile(null);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.editCancelBtn}
            >
              <X size={15} color="#64748b" />
            </TouchableOpacity>
          </View>
        )}

        {/* Attachment Preview Chips (Multiple Support) */}
        {effectiveAttachedFiles.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingBottom: 6 }}
          >
            {effectiveAttachedFiles.map((file, fIdx) => (
              <View key={`panel_att_${fIdx}`} style={styles.attachPreviewBarFluid}>
                {file.type === 'image' && file.data ? (
                  <Image
                    source={{ uri: file.data.startsWith('data:') ? file.data : `data:image/jpeg;base64,${file.data}` }}
                    style={styles.attachThumb}
                  />
                ) : (
                  <View style={styles.attachDocIconBox}>
                    <FileText size={18} color="#3B82F6" />
                  </View>
                )}
                <Text style={styles.attachFileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    if (onRemoveAttachedFile) {
                      onRemoveAttachedFile(fIdx);
                    } else {
                      setAttachedFile(null);
                    }
                  }}
                  style={styles.attachRemoveBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* RECIPIENT TRANSFER ACTION ROW: [ Reddet ] [ Kabul Et ] */}
        {selectedTicket.transfer_status === 'pending' && (
          <View style={styles.transferRecipientActionRow}>
            <TouchableOpacity
              style={[styles.transferActionBtn, styles.transferRejectBtn]}
              onPress={onOpenReject}
              activeOpacity={0.7}
            >
              <X size={15} color="#DC2626" style={{ marginRight: 4 }} />
              <Text style={styles.transferRejectBtnText}>Reddet</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.transferActionBtn, styles.transferAcceptBtn]}
              onPress={onAcceptTransfer}
              activeOpacity={0.7}
            >
              <Check size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.transferAcceptBtnText}>Kabul Et</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Multiline Textarea */}
        <TextInput
              style={[
                styles.replyPanelTextArea,
                replyFocused && { borderColor: '#38BDF8' },
                isTransferMode && { borderColor: '#10B981' },
              ]}
              placeholder={
                isTransferMode
                  ? 'Bilet devretme gerekçesi veya açıklama yazın...'
                  : (isAdmin 
                      ? getLabel('helpdesk.writeAdminReply', 'Yönetici olarak yanıtlayın...', 'Reply as Administrator...') 
                      : getLabel('helpdesk.writeReply', 'Mesajınızı yazın...', 'Type your message...'))
              }
              placeholderTextColor="#94a3b8"
              value={replyText}
              onChangeText={(text) => {
                setReplyText(text);
                if (isAdmin && !isTransferMode && (text.endsWith('@') || text === '@')) {
                  onTriggerWhisperAt?.();
                }
              }}
              onFocus={() => setReplyFocused(true)}
              onBlur={() => setReplyFocused(false)}
              multiline={true}
              textAlignVertical="top"
            />

            {/* Bottom Controls Row: Attachment Buttons on Left, Send Button on Right */}
            <View style={styles.replyPanelBottomRow}>
              <View style={styles.replyPanelAttachButtons}>
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
                {!hasDiagnostics && !isTransferMode && (
                  <TouchableOpacity
                    style={[
                      styles.attachMiniBtn,
                      attachDiagnostics && styles.attachMiniBtnActiveDiag,
                    ]}
                    onPress={() => {
                      if (setAttachDiagnostics) {
                        setAttachDiagnostics(!attachDiagnostics);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Cpu
                      size={16}
                      color={attachDiagnostics ? '#15803D' : '#64748B'}
                    />
                    {attachDiagnostics && <View style={styles.attachActiveDot} />}
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.replyPanelSendBtn,
                  isTransferMode && { backgroundColor: '#10B981' },
                  (replyText.trim() || attachedFile || isTransferMode) && styles.replyPanelSendBtnActive,
                ]}
                onPress={isTransferMode ? onSendTransfer : onReplyTicket}
                disabled={(isTransferMode && !selectedTransferAdmin) || ((!replyText.trim() && !attachedFile && !isTransferMode) || sending)}
                activeOpacity={0.7}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {isTransferMode ? (
                      <ArrowRight size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    ) : (
                      <Send
                        size={15}
                        color={(replyText.trim() || attachedFile) ? '#FFFFFF' : '#94a3b8'}
                        style={{ marginRight: 6 }}
                      />
                    )}
                    <Text
                      style={[
                        styles.replyPanelSendBtnText,
                        (replyText.trim() || attachedFile || isTransferMode) && styles.replyPanelSendBtnTextActive,
                      ]}
                    >
                      {isTransferMode
                        ? (language === 'tr' ? 'Transfer Et' : 'Hand Over')
                        : getLabel('helpdesk.reply', 'Gönder', 'Send')}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
      </View>
      )}

      {/* ─── ADMIN SELECTION BOTTOM SHEET ─── */}
      <Modal
        visible={transferBottomSheetVisible}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setTransferBottomSheetVisible?.(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.bsOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setTransferBottomSheetVisible?.(false)}
          />
          <View style={[
            styles.bsContainer,
            {
              maxHeight: keyboardHeight > 0 ? Dimensions.get('window').height - keyboardHeight - 40 : '75%',
              paddingBottom: keyboardHeight > 0 ? 8 : Math.max(insetsBottom, 16),
              marginBottom: keyboardHeight > 0 ? keyboardHeight : 0,
            }
          ]}>
            <View style={styles.bsHandle} />

            <View style={styles.bsHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ArrowRight size={18} color="#475569" style={{ marginRight: 8 }} />
                <Text style={styles.bsTitle}>{language === 'tr' ? 'Bileti Devret' : 'Hand Over'}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setTransferBottomSheetVisible?.(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.bsCloseBtn}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Parmakla Kaydırılabilir Admin Listesi (Search box'ın üzerinde yukarı doğru uzanır) */}
            <ScrollView
              style={[
                styles.bsAdminList,
                { maxHeight: keyboardHeight > 0 ? Math.max(160, Dimensions.get('window').height - keyboardHeight - 160) : 340 }
              ]}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {(() => {
                const query = (transferSearchText || '').trim().toLowerCase();
                const filtered = enterpriseAdminsList.filter(a =>
                  !query ||
                  a.alias.toLowerCase().includes(query) ||
                  a.blind_id.toLowerCase().includes(query)
                );

                if (filtered.length === 0) {
                  return (
                    <View style={styles.bsEmptyBox}>
                      <Text style={styles.bsEmptyText}>Eşleşen yönetici bulunamadı.</Text>
                    </View>
                  );
                }

                return filtered.map((adm, idx) => {
                  const isSelected = selectedTransferAdmin?.blind_id === adm.blind_id;
                  const isSelf = adm.alias.includes('(Kendim - Test)');
                  const shortBlind = adm.blind_id ? `#${adm.blind_id.substring(0, 6)}` : '';
                  return (
                    <TouchableOpacity
                      key={`adm_${idx}_${adm.blind_id}`}
                      style={[
                        styles.bsAdminRow,
                        isSelected && styles.bsAdminRowSelected,
                        isSelf && styles.bsAdminRowSelf,
                      ]}
                      onPress={() => onSelectTransferAdmin?.(adm)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[styles.bsAdminAlias, isSelected && { color: '#0F172A', fontWeight: '700' }]}>
                            {adm.alias}
                          </Text>
                          {isSelf && (
                            <View style={styles.bsSelfBadge}>
                              <Text style={styles.bsSelfBadgeText}>Test</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.bsAdminMeta}>
                          {shortBlind} • {adm.role || 'admin'} • {adm.assigned_tickets_count || 0} aktif bilet
                        </Text>
                      </View>
                      {isSelected ? (
                        <Check size={18} color="#475569" strokeWidth={2.5} />
                      ) : (
                        <ArrowRight size={16} color="#94A3B8" />
                      )}
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>

            {/* Arama Inputu: En altta (Klavye açılınca klavyenin hemen önünde oturur) */}
            <View style={[styles.bsSearchBox, { marginTop: 8, marginBottom: 4 }]}>
              <Search size={15} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.bsSearchInput}
                placeholder="Admin adı veya rumuz ile ara..."
                placeholderTextColor="#94A3B8"
                value={transferSearchText}
                onChangeText={setTransferSearchText}
                autoCapitalize="none"
              />
              {!!transferSearchText && (
                <TouchableOpacity onPress={() => setTransferSearchText?.('')}>
                  <X size={14} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── REJECT REASON MODAL ─── */}
      <Modal
        visible={rejectModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setRejectModalVisible?.(false)}
      >
        <View style={styles.bsOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setRejectModalVisible?.(false)}
          />
          <View style={[styles.rejectCardContainer, { marginBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 40 }]}>
            <View style={styles.rejectCardHeader}>
              <X size={18} color="#DC2626" style={{ marginRight: 6 }} />
              <Text style={styles.rejectCardTitle}>Bilet Devrini Reddet</Text>
            </View>
            <Text style={styles.rejectCardSub}>
              Lütfen devir talebini reddetme gerekçenizi belirtin.
            </Text>
            <TextInput
              style={styles.rejectInput}
              placeholder="Gerekçe (örn: Bu konu başka birim tarafından çözülmeli)..."
              placeholderTextColor="#94A3B8"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline={true}
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.rejectBtnRow}>
              <TouchableOpacity
                style={styles.rejectCancelBtn}
                onPress={() => setRejectModalVisible?.(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.rejectCancelBtnText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectConfirmBtn}
                onPress={onConfirmReject}
                activeOpacity={0.7}
              >
                <Text style={styles.rejectConfirmBtnText}>Reddet ve Bildir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F4F7FA',
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
    alignItems: 'flex-start',
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
  sectionRowFluid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
    width: '100%',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerButtonlessActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusToggleBtnFluid: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  statusToggleBtnFluidClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusToggleTextFluid: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  statusToggleTextFluidClosed: {
    color: '#DC2626',
  },
  detailCardHeaderFluid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ticketIdMonoText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginRight: 8,
  },
  appTagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  appTagBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  securityBadgeButtonless: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminRoleBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminStarBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  detailSubjectText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  detailCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketDateMutedText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  selfDestructDetailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  selfDestructDetailText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  detailDiagInspectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 6,
  },
  detailDiagInspectBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  pillOpen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  pillOpenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    letterSpacing: -0.1,
  },
  pillAnswered: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  pillAnsweredText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    letterSpacing: -0.1,
  },
  pillClosed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  pillClosedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: -0.1,
  },
  pillRevoked: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  pillRevokedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
    letterSpacing: -0.1,
  },
  inlineEscalatedPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  inlineEscalatedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  allocationMutedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  messageBubbleWrapper: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 0,
    elevation: 0,
  },
  messageBubbleMine: {
    backgroundColor: '#E8F1FC', // Pastel ferah gök mavisi
    borderWidth: 0,
    elevation: 0,
  },
  messageBubbleOther: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)', // Yarı saydam beyaz zemin
    borderWidth: 0,
    elevation: 0,
  },
  messageBubbleEditing: {
    borderWidth: 0,
    backgroundColor: '#DCEBFC',
  },
  messageBubbleTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 16,
    minWidth: '100%',
  },
  messageSenderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  messageTimeText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  messageBodyText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 19,
  },
  msgAttachmentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  msgAttachmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#CBD5E1', // İnce gri kontür
    maxWidth: '100%',
  },
  msgAttachmentPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    maxWidth: 200,
  },
  replyCardPanelContainerFluid: {
    position: 'absolute',
    left: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  editIndicatorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  editIndicatorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  editCancelBtn: {
    padding: 4,
  },
  attachPreviewBarFluid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    marginBottom: 8,
  },
  attachThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 8,
  },
  attachDocIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  attachFileName: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    color: '#334155',
  },
  attachRemoveBtn: {
    padding: 4,
  },
  replyPanelTextArea: {
    minHeight: 52,
    maxHeight: 120,
    fontSize: 13,
    color: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  replyPanelBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  replyPanelAttachButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachMiniBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachMiniBtnActiveDiag: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  attachActiveDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#15803D',
  },
  phoneCallBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  replyPanelSendBtn: {
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyPanelSendBtnActive: {
    backgroundColor: '#3B82F6',
  },
  replyPanelSendBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  replyPanelSendBtnTextActive: {
    color: '#FFFFFF',
  },
  customFieldsBubbleCard: {
    marginTop: 8,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1', // İnce gri kontür
  },
  customFieldsBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  customFieldsBubbleTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  customFieldsBubbleLine: {
    fontSize: 12,
    lineHeight: 18,
    color: '#1E293B',
    fontWeight: '500',
  },
  transferArrowHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderColor: '#A7F3D0',
    borderWidth: 1,
  },
  transferArrowHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  transferInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  transferInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 8,
  },
  transferAdminSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  transferAdminSelectBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginRight: 6,
  },
  transferBadgeFixed: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  transferBadgeFixedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  transferCancelMiniBtn: {
    marginLeft: 8,
    padding: 4,
  },
  inspectModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  inspectModeBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
    flex: 1,
  },
  transferRecipientActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  transferActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 10,
  },
  transferRejectBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
  },
  transferRejectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  transferInspectBtn: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  transferInspectBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  transferInspectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  transferAcceptBtn: {
    backgroundColor: '#10B981',
  },
  transferAcceptBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inspectModeBannerInner: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    alignItems: 'center',
  },
  inspectModeInnerText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  whisperBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  whisperBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  internalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  internalBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  bsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  bsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bsHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  bsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  bsCloseBtn: {
    padding: 4,
  },
  bsSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 10,
  },
  bsSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  bsAdminList: {
    maxHeight: 280,
  },
  bsAdminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  bsAdminRowSelected: {
    backgroundColor: '#F0FDF4',
  },
  bsAdminRowSelf: {
    backgroundColor: '#F8FAFC',
  },
  bsAdminAlias: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  bsAdminMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  bsSelfBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  bsSelfBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4338CA',
  },
  bsEmptyBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  bsEmptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  rejectCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    padding: 16,
  },
  rejectCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  rejectCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  rejectCardSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  rejectInput: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 70,
    marginBottom: 12,
  },
  rejectBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  rejectCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  rejectCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  rejectConfirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  rejectConfirmBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rootConfidentialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  rootConfidentialBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#065F46',
    lineHeight: 16,
  },
  poolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  poolBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  claimActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  claimActionBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
