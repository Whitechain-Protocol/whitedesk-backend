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
} from 'react-native';
import {
  ChevronLeft,
  Edit3,
  X,
  Camera,
  Paperclip,
  FileText,
  Phone,
  Send,
  Tag,
} from 'lucide-react-native';
import { HelpDeskTicket, HelpDeskMessage, TicketStatus } from '../../../services/helpDeskService';
import { AdminBadge, tierFromRole, tierFromCategory } from '../AdminBadge';
import { AttachedFile } from '../types';

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
  sending: boolean;
  language: string;
  getLabel: (key: string, tr: string, en: string) => string;
  formatWhiteId: (id: string) => string;
  formatAppId: (id?: string) => string;
  formatTicketDate: (ts: number, showTime?: boolean) => string;
  getCategoryLabel: (cat?: string) => string;
  onBack: () => void;
  onToggleStatus: () => void;
  onTicketLongPress?: (t: HelpDeskTicket) => void;
  onOpenDocument: (name: string, data: string) => void;
  onPreviewImage: (uri: string) => void;
  onPickCamera: () => void;
  onPickGallery: () => void;
  onPickDocument: () => void;
  onCallPress: () => void;
  onReplyTicket: () => void;
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
  editingMessage,
  setEditingMessage,
  replyText,
  setReplyText,
  replyFocused,
  setReplyFocused,
  attachedFile,
  setAttachedFile,
  sending,
  language,
  getLabel,
  formatWhiteId,
  formatAppId,
  formatTicketDate,
  getCategoryLabel,
  onBack,
  onToggleStatus,
  onTicketLongPress,
  onOpenDocument,
  onPreviewImage,
  onPickCamera,
  onPickGallery,
  onPickDocument,
  onCallPress,
  onReplyTicket,
}) => {
  const isClosed = selectedTicket.status === 'closed';

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
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color="#64748B" style={{ marginRight: 4 }} />
            <Text style={styles.sectionTitleText}>
              {getLabel('menu.helpDesk', 'Destek', 'Support')}
            </Text>
          </TouchableOpacity>

          <View style={styles.headerButtonlessActions}>
            <TouchableOpacity
              style={[styles.statusToggleBtnFluid, isClosed && styles.statusToggleBtnFluidClosed]}
              onPress={onToggleStatus}
              activeOpacity={0.7}
            >
              <Text style={[styles.statusToggleTextFluid, isClosed && styles.statusToggleTextFluidClosed]}>
                {isClosed 
                  ? getLabel('helpdesk.reopen', 'Yeniden Aç', 'Reopen Ticket')
                  : getLabel('helpdesk.close', 'Bileti Kapat', 'Close Ticket')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* TICKET HEADER CARD */}
        <TouchableOpacity 
          style={styles.detailCardHeaderFluid}
          onLongPress={() => onTicketLongPress?.(selectedTicket)}
          delayLongPress={200}
          activeOpacity={0.9}
        >
          <View style={styles.cardHeaderTopRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.ticketIdMonoText}>#{selectedTicket.id}</Text>
              <View style={styles.appTagBadge}>
                <Text style={styles.appTagBadgeText}>{formatAppId(selectedTicket.app_id)}</Text>
              </View>
              {(() => {
                const effectiveCat = selectedTicket.is_discussion ? 'discussion' : selectedTicket.category;
                const tier = tierFromCategory(effectiveCat);
                if (tier !== null) {
                  return <View style={{ marginLeft: 4 }}><AdminBadge tier={tier} size={13} /></View>;
                }
                return selectedTicket.category && selectedTicket.category !== 'general' ? (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{getCategoryLabel(selectedTicket.category)}</Text>
                  </View>
                ) : null;
              })()}
            </View>
            {renderStatusPill(selectedTicket.status)}
          </View>

          <Text style={styles.detailSubjectText}>{selectedTicket.subject}</Text>

          <View style={styles.detailCardBottomRow}>
            <Text style={styles.ticketDateMutedText}>
              {getLabel('helpdesk.created', 'Oluşturma:', 'Created:')} {formatTicketDate(selectedTicket.created_at, true)}
            </Text>
          </View>
        </TouchableOpacity>

        {/* MESSAGES LIST */}
        <View style={{ paddingTop: 10 }}>
          {ticketMessages.map((msg, index) => {
            const isMine = msg.sender_white_id && ownWhiteId && msg.sender_white_id.toLowerCase() === ownWhiteId.toLowerCase();
            const isLastMessage = index === ticketMessages.length - 1;
            const canEdit = isMine && isLastMessage && !isClosed;
            const isEditingThis = editingMessage?.id === msg.id;

            const senderLabel = isMine 
              ? (language === 'tr' ? 'Ben' : 'You')
              : (msg.is_admin 
                  ? (msg.sender_alias ? msg.sender_alias : (language === 'tr' ? 'inWhite Destek' : 'inWhite Support')) 
                  : (formatWhiteId(msg.sender_white_id) || (language === 'tr' ? 'Kullanıcı' : 'User')));

            return (
              <TouchableOpacity
                key={msg.id}
                activeOpacity={canEdit ? 0.75 : 1}
                onLongPress={() => {
                  if (canEdit) {
                    setEditingMessage(msg);
                    setReplyText(msg.message || '');
                    if (msg.attachment_data && msg.attachment_type) {
                      setAttachedFile({
                        data: msg.attachment_data,
                        name: msg.attachment_name || (msg.attachment_type === 'image' ? 'photo.jpg' : 'document.pdf'),
                        type: msg.attachment_type as 'image' | 'document',
                        mimeType: msg.attachment_type === 'image' ? 'image/jpeg' : 'application/octet-stream',
                      });
                    } else {
                      setAttachedFile(null);
                    }
                  }
                }}
                style={[
                  styles.messageBubbleWrapper,
                  isMine ? styles.messageBubbleMine : styles.messageBubbleOther,
                  isEditingThis && styles.messageBubbleEditing,
                ]}
              >
                <View style={styles.messageBubbleTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Text style={[styles.messageSenderText, isMine && { color: '#3B82F6' }]}>
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
                  <Text style={styles.messageTimeText}>
                    {formatTicketDate(msg.created_at, true)}
                  </Text>
                </View>

                {!!msg.message && (() => {
                  const delimiter = '--- 📋 [Kayıt Bilgileri] ---';
                  if (msg.message.includes(delimiter)) {
                    const [mainText, customDetails] = msg.message.split(delimiter);
                    const detailLines = (customDetails || '').trim().split('\n').filter(l => l.trim().length > 0);
                    return (
                      <View>
                        {!!mainText.trim() && (
                          <Text style={styles.messageBodyText} selectable={!canEdit}>
                            {mainText.trim()}
                          </Text>
                        )}
                        <View style={styles.customFieldsBubbleCard}>
                          <View style={styles.customFieldsBubbleHeader}>
                            <Tag size={11} color="#2563EB" style={{ marginRight: 4 }} />
                            <Text style={styles.customFieldsBubbleTitle}>Kayıt Bilgileri</Text>
                          </View>
                          {detailLines.map((line, lIdx) => (
                            <Text key={`det_${lIdx}`} style={styles.customFieldsBubbleLine}>
                              {line.replace(/^•\s*/, '• ')}
                            </Text>
                          ))}
                        </View>
                      </View>
                    );
                  }
                  return (
                    <Text style={styles.messageBodyText} selectable={!canEdit}>
                      {msg.message}
                    </Text>
                  );
                })()}

                {/* Attachment in Message */}
                {msg.attachment_data && (
                  msg.attachment_type === 'image' ? (
                    <TouchableOpacity
                      style={styles.msgAttachmentImageWrapper}
                      onPress={() => onPreviewImage(`data:image/jpeg;base64,${msg.attachment_data}`)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: `data:image/jpeg;base64,${msg.attachment_data}` }}
                        style={styles.msgImagePreview}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.msgDocContainer}
                      onPress={() => onOpenDocument(msg.attachment_name || 'document.pdf', msg.attachment_data!)}
                      activeOpacity={0.7}
                    >
                      <FileText size={18} color="#3B82F6" style={{ marginRight: 6 }} />
                      <Text style={styles.msgDocName} numberOfLines={1}>
                        {msg.attachment_name || 'document.pdf'}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.ScrollView>

      {/* WHITEFIN STYLE REPLY PANEL CARD (STICKS ABOVE KEYBOARD) */}
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

        {/* Attachment Preview Chip */}
        {attachedFile && (
          <View style={styles.attachPreviewBarFluid}>
            {attachedFile.type === 'image' ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${attachedFile.data}` }}
                style={styles.attachThumb}
              />
            ) : (
              <View style={styles.attachDocIconBox}>
                <FileText size={18} color="#3B82F6" />
              </View>
            )}
            <Text style={styles.attachFileName} numberOfLines={1}>
              {attachedFile.name}
            </Text>
            <TouchableOpacity
              onPress={() => setAttachedFile(null)}
              style={styles.attachRemoveBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        )}

        {/* Multiline Textarea */}
        <TextInput
          style={[
            styles.replyPanelTextArea,
            replyFocused && { borderColor: '#38BDF8' },
          ]}
          placeholder={isAdmin 
            ? getLabel('helpdesk.writeAdminReply', 'Yönetici olarak yanıtlayın...', 'Reply as Administrator...') 
            : getLabel('helpdesk.writeReply', 'Mesajınızı yazın...', 'Type your message...')}
          placeholderTextColor="#94a3b8"
          value={replyText}
          onChangeText={setReplyText}
          onFocus={() => setReplyFocused(true)}
          onBlur={() => setReplyFocused(false)}
          multiline={true}
          textAlignVertical="top"
        />

        {/* Bottom Controls Row: Attachment Buttons on Left (Camera, Gallery, Document, Phone), Send Button on Right */}
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
            
            {/* TELEFON İKONU (KULLANICI TALEBİ DOĞRULTUSUNDA KAMERA/ATTACH/BELGE SAĞINA EKLENDİ) */}
            <TouchableOpacity
              style={[styles.attachMiniBtn, styles.phoneCallBtn]}
              onPress={onCallPress}
              activeOpacity={0.7}
            >
              <Phone size={16} color="#2563EB" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.replyPanelSendBtn,
              (replyText.trim() || attachedFile) && styles.replyPanelSendBtnActive,
            ]}
            onPress={onReplyTicket}
            disabled={(!replyText.trim() && !attachedFile) || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Send
                  size={15}
                  color={(replyText.trim() || attachedFile) ? '#FFFFFF' : '#94a3b8'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.replyPanelSendBtnText,
                    (replyText.trim() || attachedFile) && styles.replyPanelSendBtnTextActive,
                  ]}
                >
                  {getLabel('helpdesk.reply', 'Gönder', 'Send')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
    paddingHorizontal: 8,
    marginBottom: 4,
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
  pillOpen: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pillOpenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  pillAnswered: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pillAnsweredText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  pillClosed: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pillClosedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  messageBubbleWrapper: {
    maxWidth: '85%',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  messageBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#EFF6FF',
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  messageBubbleEditing: {
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  messageBubbleTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 12,
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
  msgAttachmentImageWrapper: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  msgImagePreview: {
    width: 200,
    height: 140,
    borderRadius: 12,
  },
  msgDocContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  msgDocName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2563EB',
    flex: 1,
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
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
});
