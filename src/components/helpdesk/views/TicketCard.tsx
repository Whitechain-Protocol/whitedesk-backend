import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { HelpDeskTicket, TicketStatus, helpDeskService } from '../../../services/helpDeskService';
import { piiSanitizer } from '../../../services/piiSanitizer';
import { AdminBadge, tierFromCategory } from '../AdminBadge';
import { MoreVertical, Leaf, Clock, Star, Paperclip, ImageIcon, FileText, ArrowRight, Database, Lock } from 'lucide-react-native';
import { isImageFile } from '../utils/fileMimeUtils';

interface TicketCardProps {
  ticket: HelpDeskTicket;
  onPress: () => void;
  onLongPress?: () => void;
  onMenuPress?: (ticket: HelpDeskTicket, pageY?: number) => void;
  getLabel: (key: string, tr: string, en: string) => string;
  formatWhiteId: (id: string) => string;
  formatAppId: (id?: string) => string;
  formatTicketDate: (ts: number, showTime?: boolean) => string;
  getCategoryLabel: (cat?: string) => string;
}

export const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  onPress,
  onLongPress,
  onMenuPress,
  getLabel,
  formatAppId,
  formatTicketDate,
  getCategoryLabel,
}) => {
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

  // Derive badge tier from ticket category — null means show category pill
  const effectiveCategory = ticket.is_discussion ? 'discussion' : ticket.category;
  const badgeTier = tierFromCategory(effectiveCategory);
  const selfDestructInfo = helpDeskService.getTicketSelfDestructInfo(ticket);
  const lifecycle = helpDeskService.getTicketLifecycleStatus(ticket);

  return (
    <TouchableOpacity
      style={styles.fluidTicketCard}
      onPress={onPress}
      delayPressIn={200}
      activeOpacity={0.75}
    >
      {/* Row 1: ID · App tag · Badge/Category · Status */}
      <View style={styles.cardHeaderTopRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.ticketIdMonoText}>{ticket.id}</Text>
          {/* Tenant Adı: Sabit 'inwhite' yerine gerçek kayıtlı Tenant Adı */}
          {ticket.enterprise_name ? (
            <View style={styles.appTagBadge}>
              <Text style={styles.appTagBadgeText}>{ticket.enterprise_name}</Text>
            </View>
          ) : (ticket.app_id && ticket.app_id.toLowerCase() !== 'inwhite' && ticket.app_id.toLowerCase() !== 'whitedesk') ? (
            <View style={styles.appTagBadge}>
              <Text style={styles.appTagBadgeText}>{ticket.app_id}</Text>
            </View>
          ) : null}
          {badgeTier !== null ? (
            /* Unified AdminBadge — same visual grammar as message bubbles */
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AdminBadge tier={badgeTier} size={13} />
              {ticket.category === 'root_support' && (
                <View style={styles.confidentialPill}>
                  <Lock size={9} color="#059669" style={{ marginRight: 2 }} />
                  <Text style={styles.confidentialPillText}>Çok Gizli</Text>
                </View>
              )}
            </View>
          ) : (
            /* Regular ticket: show category pill if not 'general' and not 'voice' */
            ticket.category && ticket.category !== 'general' && ticket.category.toLowerCase() !== 'voice' && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{getCategoryLabel(ticket.category)}</Text>
              </View>
            )
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {renderStatusPill(ticket.status)}
          {onMenuPress && (
            <TouchableOpacity
              style={{ marginLeft: 6, padding: 2 }}
              onPress={(e) => {
                e.stopPropagation?.();
                onMenuPress(ticket, e.nativeEvent?.pageY);
              }}
              delayPressIn={200}
              hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
              activeOpacity={0.7}
            >
              <MoreVertical size={16} color="#64748B" strokeWidth={2.2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Row 2: Subject */}
      <Text style={styles.fluidTicketSubject} numberOfLines={2}>
        {piiSanitizer.sanitize(ticket.subject).sanitizedText}
      </Text>

      {/* Row 3: Date & Leaf Countdown & Transfer indicator */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.ticketDateMutedText}>
            {getLabel('helpdesk.lastAction', 'Son işlem:', 'Updated:')} {formatTicketDate(ticket.updated_at || ticket.created_at, true)}
          </Text>
          {selfDestructInfo.inDestruction ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
              <Leaf size={12} color="#10B981" strokeWidth={2.4} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#10B981', marginLeft: 3 }}>
                {selfDestructInfo.remainingText || `${selfDestructInfo.remainingDays} g`}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {ticket.is_relay_pending && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Database size={13} color="#EF4444" strokeWidth={2.2} />
            </View>
          )}
          {ticket.transfer_status === 'pending' && (
            <ArrowRight size={13} color="#10B981" strokeWidth={2.5} />
          )}
          {ticket.transfer_status === 'accepted' && (ticket.transferred_from_alias || ticket.transfer_sender_alias) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#64748B' }}>
                @{ticket.transferred_from_alias || ticket.transfer_sender_alias}
              </Text>
              <ArrowRight size={12} color="#64748B" strokeWidth={2} />
            </View>
          )}
        </View>
      </View>

      {/* Row 3.5: Allocation, Pool & SLA Status */}
      {(() => {
        const isRevoked = ticket.status === 'revoked';
        const hasReassigned = !!ticket.reassigned_from;
        const assignedName = ticket.assigned_admin_name || ticket.assigned_admin_alias;
        const assignedBlind = ticket.assigned_admin_blind_id;
        const isPool = !assignedBlind || assignedBlind === 'unassigned';
        const isOpen = ticket.status === 'open';

        // Calculate live SLA countdown if open
        let slaRemainingMins: number | null = null;
        if (isOpen && ticket.created_at) {
          const elapsed = Date.now() - Number(ticket.created_at);
          const slaLimitMs = 120 * 60 * 1000; // 2 saat varsayılan SLA
          slaRemainingMins = Math.round((slaLimitMs - elapsed) / 60000);
        }

        const showRow = isRevoked || hasReassigned || assignedName || (assignedBlind && assignedBlind !== 'unassigned') || (isOpen && isPool) || slaRemainingMins !== null;
        if (!showRow) return null;

        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isRevoked ? (
                <View style={styles.inlineEscalatedPill}>
                  <Text style={styles.inlineEscalatedPillText}>
                    ⚠️ Eskale Edildi (SLA Aşımı)
                  </Text>
                </View>
              ) : hasReassigned ? (
                <Text style={styles.allocationMutedText}>
                  🔄 Yeniden Atandı: {assignedName ? `@${assignedName}` : (assignedBlind ? assignedBlind.substring(0, 10) + '...' : 'Havuz')}
                </Text>
              ) : assignedName ? (
                <Text style={styles.allocationMutedText}>
                  👤 Atandı: @{assignedName}
                </Text>
              ) : assignedBlind && assignedBlind !== 'unassigned' ? (
                <Text style={styles.allocationMutedText}>
                  👤 Atandı: {assignedBlind.substring(0, 10)}...
                </Text>
              ) : isOpen && isPool ? (
                <View style={styles.poolBadge}>
                  <Clock size={10} color="#3B82F6" style={{ marginRight: 3 }} />
                  <Text style={styles.poolBadgeText}>Havuzda (Atama Bekliyor)</Text>
                </View>
              ) : null}
            </View>

            {/* SLA Geri Sayım Rozeti (Yalnızca açık biletlerde) */}
            {slaRemainingMins !== null && (
              <View
                style={[
                  styles.slaBadge,
                  slaRemainingMins <= 0
                    ? styles.slaBadgeRed
                    : slaRemainingMins <= 15
                    ? styles.slaBadgeAmber
                    : styles.slaBadgeBlue,
                ]}
              >
                <Clock
                  size={9.5}
                  color={
                    slaRemainingMins <= 0
                      ? '#DC2626'
                      : slaRemainingMins <= 15
                      ? '#D97706'
                      : '#2563EB'
                  }
                  style={{ marginRight: 3 }}
                />
                <Text
                  style={[
                    styles.slaBadgeText,
                    slaRemainingMins <= 0
                      ? styles.slaBadgeTextRed
                      : slaRemainingMins <= 15
                      ? styles.slaBadgeTextAmber
                      : styles.slaBadgeTextBlue,
                  ]}
                >
                  {slaRemainingMins <= 0
                    ? 'SLA Aşımı'
                    : slaRemainingMins <= 15
                    ? `${slaRemainingMins} dk (Kritik SLA)`
                    : `${slaRemainingMins} dk SLA`}
                </Text>
              </View>
            )}
          </View>
        );
      })()}

      {/* Row 4: Çoklu Ekler (Tarih satırının altında tek bir satırda yatay kaydırılabilir) */}
      {(ticket.attachment_data || (ticket.attachments && ticket.attachments.length > 0)) && (() => {
        let attList: any[] = [];
        if (ticket.attachments && Array.isArray(ticket.attachments) && ticket.attachments.length > 0) {
          attList = ticket.attachments;
        } else if (ticket.attachment_data) {
          try {
            const parsed = JSON.parse(ticket.attachment_data);
            if (Array.isArray(parsed)) attList = parsed;
            else if (parsed && typeof parsed === 'object') attList = [parsed];
          } catch {
            attList = [{
              name: ticket.attachment_name || (ticket.attachment_type === 'image' ? 'photo.jpg' : 'ek_dosya'),
              type: ticket.attachment_type || 'document'
            }];
          }
        }
        if (attList.length === 0) return null;
        return (
          <ScrollView
            horizontal={true}
            nestedScrollEnabled={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 }}
            style={{ width: '100%', marginTop: 8 }}
          >
            {attList.map((att, attIdx) => {
              const isImg = isImageFile(att.name, att.mimeType, att.data);
              return (
                <View
                  key={`card_att_${ticket.id}_${attIdx}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#F8FAFC',
                    paddingHorizontal: 8,
                    paddingVertical: 3.5,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                  }}
                >
                  {isImg ? (
                    <ImageIcon size={11} color="#2563EB" style={{ marginRight: 4 }} />
                  ) : (
                    <FileText size={11} color="#2563EB" style={{ marginRight: 4 }} />
                  )}
                  <Text
                    style={{ fontSize: 10, fontWeight: '600', color: '#334155', maxWidth: 140 }}
                    numberOfLines={1}
                  >
                    {att.name || (isImg ? `Görsel ${attIdx + 1}` : `Belge ${attIdx + 1}`)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        );
      })()}
    </TouchableOpacity>
  );
};

// 🔒 KİLİTLİ TASARIM: Ana ekran bilet kartı (#F8FAFC, kenarlıksız, kontürsüz, gölgesiz) ve iç öğeleri kilitlenmiştir. Asla değiştirilmemelidir.
const styles = Object.freeze(StyleSheet.create({
  fluidTicketCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  cardHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketIdMonoText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginRight: 6,
  },
  appTagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  appTagBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
  fluidTicketSubject: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
    lineHeight: 20,
  },
  ticketDateMutedText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selfDestructLeafPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  selfDestructLeafText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#10B981',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  pillOpen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillOpenText: {
    fontSize: 10.5,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillAnsweredText: {
    fontSize: 10.5,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillClosedText: {
    fontSize: 10.5,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillRevokedText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#D97706',
    letterSpacing: -0.1,
  },
  inlineEscalatedPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  inlineEscalatedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  allocationMutedText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  confidentialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    marginLeft: 6,
  },
  confidentialPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#059669',
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
  slaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  slaBadgeBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
  },
  slaBadgeAmber: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  slaBadgeRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  slaBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  slaBadgeTextBlue: {
    color: '#1D4ED8',
  },
  slaBadgeTextAmber: {
    color: '#B45309',
  },
  slaBadgeTextRed: {
    color: '#DC2626',
  },
}));
