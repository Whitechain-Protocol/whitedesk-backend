import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { HelpDeskTicket, TicketStatus, OrgEntry, helpDeskService } from '../../../services/helpDeskService';
import { piiSanitizer } from '../../../services/piiSanitizer';
import { AdminBadge, tierFromCategory } from '../AdminBadge';
import { MoreVertical, Leaf, Clock, Star, Paperclip, ImageIcon, FileText, ArrowRight, Cloud, Lock, User } from 'lucide-react-native';
import { isImageFile } from '../utils/fileMimeUtils';
import { formatDisplayBlindId } from '../utils/helpdeskFormatters';

interface TicketCardProps {
  ticket: HelpDeskTicket;
  onPress?: () => void;
  onLongPress?: () => void;
  onMenuPress?: (ticket: HelpDeskTicket, pageY?: number) => void;
  getLabel: (key: string, tr: string, en: string) => string;
  formatWhiteId?: (id: string) => string;
  formatAppId?: (id?: string) => string;
  formatTicketDate: (ts: number, showTime?: boolean) => string;
  getCategoryLabel: (cat?: string) => string;
  orgsList?: OrgEntry[];
  containerStyle?: any;
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
  orgsList,
  containerStyle,
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
      style={[styles.fluidTicketCard, containerStyle]}
      onPress={onPress}
      disabled={!onPress}
      delayPressIn={200}
      activeOpacity={onPress ? 0.75 : 1}
    >
      {/* Row 1: ID · ORG (Birim / Departman) · Status */}
      <View style={styles.cardHeaderTopRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8, flexWrap: 'nowrap' }}>
          {/* Bilet Numarası Başta */}
          <Text style={styles.ticketIdText}>{ticket.id}</Text>

          {/* ORG (Birim / Departman: Saha, Muhasebe vb. - Kategori Değil!) */}
          {(() => {
            const rawOrg = (ticket.org_id || '').trim();
            if (!rawOrg || rawOrg.toLowerCase() === 'default' || rawOrg === 'all') {
              return null;
            }
            const matchedOrg = orgsList?.find(o => o.org_id.toLowerCase() === rawOrg.toLowerCase());
            const orgDisplay = matchedOrg?.name || rawOrg;
            return (
              <Text style={styles.metaSubUnitText} numberOfLines={1}>
                <Text style={styles.metaDotSeparator}> · </Text>
                {orgDisplay}
              </Text>
            );
          })()}

          {badgeTier !== null && (
            /* Unified AdminBadge — same visual grammar as message bubbles */
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4 }}>
              <AdminBadge tier={badgeTier} size={13} />
              {ticket.category === 'root_support' && (
                <View style={styles.confidentialPill}>
                  <Lock size={9} color="#059669" style={{ marginRight: 2 }} />
                  <Text style={styles.confidentialPillText}>Çok Gizli</Text>
                </View>
              )}
            </View>
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

      {/* Row 3: Google M3 Alt Barı (Temsilci Mikro-Çipi + Tarih · Sağ Ray: Bulut + Sayaç) */}
      {(() => {
        const rawName = (ticket.assigned_admin_name || ticket.assigned_admin_alias || '').trim();
        const cleanName = rawName.startsWith('@') ? rawName.substring(1) : rawName;
        const assignedBlind = (ticket.assigned_admin_blind_id || '').trim();
        const newBlind = ((ticket as any).reassigned_to || ticket.transfer_target_blind_id || '').trim();
        const isRevoked = ticket.status === 'revoked';
        const hasChanged = isRevoked || Boolean((ticket as any).reassigned_to) || Boolean((ticket as any).reassigned_from) || Boolean(ticket.transfer_target_blind_id) || ((ticket as any).escalation_stage && (ticket as any).escalation_stage > 0);

        let representativeText = 'Havuzda';
        if (hasChanged) {
          const targetBlind = (newBlind && newBlind !== 'unassigned')
            ? newBlind
            : (assignedBlind && assignedBlind !== 'unassigned')
              ? assignedBlind
              : '';
          if (targetBlind) {
            representativeText = formatDisplayBlindId(targetBlind);
          }
        } else {
          const isPool = !assignedBlind || assignedBlind === 'unassigned';
          if (!isPool) {
            if (cleanName) {
              representativeText = cleanName;
            } else if (assignedBlind && assignedBlind !== 'unassigned') {
              representativeText = formatDisplayBlindId(assignedBlind);
            }
          }
        }

        // Oluşturan Bilgisi (İsim varsa isim, yoksa blind id formatı: 124495...77343)
        const rawCreatorName = (ticket.user_alias || (ticket as any).user_name || '').trim();
        const rawCreatorBlind = (ticket.user_blind_id || ticket.user_white_id || '').trim();
        let creatorText = 'Anonim';
        if (rawCreatorName) {
          creatorText = rawCreatorName;
        } else if (rawCreatorBlind) {
          creatorText = formatDisplayBlindId(rawCreatorBlind);
        }

        return (
          <>
            {/* Oluşturan Satırı: Pill olmadan yalın, en başta içi boş yıldız ikonlu + Oluşturma Tarihi */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
              <Star size={11} color="#64748B" strokeWidth={2.2} style={{ marginRight: 4, flexShrink: 0 }} />
              <Text style={[styles.ticketDateMutedText, { fontWeight: '600', color: '#475569' }]} numberOfLines={1}>
                {creatorText}
              </Text>
              <Text style={styles.metaDotSeparator}> · </Text>
              <Text style={styles.ticketDateMutedText} numberOfLines={1}>
                {formatTicketDate(ticket.created_at, true)}
              </Text>
            </View>

            {/* Son Satır: Temsilci (Pill Yok, Mavi) + Atama/Havuz/Devir Tarihi · Sağ Ray: Bulut + Sayaç */}
            <View style={styles.cardMetaRow}>
              {/* Sol: Temsilci + Atama Tarihi */}
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 8, overflow: 'hidden' }}>
                <User size={11} color="#2563EB" strokeWidth={2.2} style={{ marginRight: 4, flexShrink: 0 }} />
                <Text style={[styles.ticketDateMutedText, { fontWeight: '600', color: '#2563EB' }]} numberOfLines={1}>
                  {representativeText}
                </Text>

                <Text style={styles.metaDotSeparator}> · </Text>

                <Text style={styles.ticketDateMutedText} numberOfLines={1}>
                  {formatTicketDate(ticket.assigned_at || ticket.updated_at || ticket.created_at, true)}
                </Text>
              </View>

              {/* Sağ: Tonal Shade Bulut + Tonal Shade Yaprak/Sayaç Rayı */}
              <View style={styles.rightIconRail}>
                <View style={styles.cloudChip}>
                  <Cloud size={11} color="#2563EB" strokeWidth={2.2} />
                </View>

                {selfDestructInfo.inDestruction ? (
                  <View style={styles.leafChip}>
                    <Leaf size={10} color="#059669" strokeWidth={2.4} />
                    <Text style={styles.leafChipText}>
                      {selfDestructInfo.remainingText || `${selfDestructInfo.remainingDays} g`}
                    </Text>
                  </View>
                ) : null}

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
          </>
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

// 🔒 KİLİTLİ TASARIM: Ana ekran bilet kartı (#F4F7FA, kenarlıksız, kontürsüz, gölgesiz) ve iç öğeleri kilitlenmiştir. Asla değiştirilmemelidir.
const styles = Object.freeze(StyleSheet.create({
  fluidTicketCard: {
    backgroundColor: '#F4F7FA',
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
    marginBottom: 6,
  },
  metaTenantText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  metaDotSeparator: {
    fontSize: 12,
    fontWeight: '400',
    color: '#94A3B8',
  },
  metaCategoryText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748B',
  },
  metaSubUnitText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748B',
  },
  ticketIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  ticketIdMonoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  rightIconRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  representativeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 155,
    flexShrink: 1,
  },
  representativeChipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  cloudChip: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  leafChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  leafChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    marginLeft: 3,
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
    fontSize: 12.5,
    fontWeight: '500',
    color: '#0F172A',
    marginBottom: 6,
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  ticketDateMutedText: {
    fontSize: 11,
    color: '#64748B',
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
