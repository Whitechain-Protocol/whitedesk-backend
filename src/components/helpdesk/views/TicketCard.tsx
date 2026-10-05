import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { HelpDeskTicket, TicketStatus } from '../../../services/helpDeskService';
import { AdminBadge, tierFromCategory } from '../AdminBadge';

interface TicketCardProps {
  ticket: HelpDeskTicket;
  onPress: () => void;
  onLongPress?: () => void;
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

  return (
    <TouchableOpacity
      style={styles.fluidTicketCard}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={200}
      activeOpacity={0.75}
    >
      {/* Row 1: ID · App tag · Badge/Category · Status */}
      <View style={styles.cardHeaderTopRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.ticketIdMonoText}>#{ticket.id}</Text>
          <View style={styles.appTagBadge}>
            <Text style={styles.appTagBadgeText}>{formatAppId(ticket.app_id)}</Text>
          </View>
          {badgeTier !== null ? (
            /* Unified AdminBadge — same visual grammar as message bubbles */
            <AdminBadge tier={badgeTier} size={13} />
          ) : (
            /* Regular ticket: show category pill if not 'general' */
            ticket.category && ticket.category !== 'general' && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{getCategoryLabel(ticket.category)}</Text>
              </View>
            )
          )}
        </View>
        {renderStatusPill(ticket.status)}
      </View>

      {/* Row 2: Subject */}
      <Text style={styles.fluidTicketSubject} numberOfLines={2}>
        {ticket.subject}
      </Text>

      {/* Row 3: Date */}
      <Text style={styles.ticketDateMutedText}>
        {getLabel('helpdesk.lastAction', 'Son işlem:', 'Updated:')} {formatTicketDate(ticket.updated_at || ticket.created_at, true)}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fluidTicketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketIdMonoText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginRight: 6,
  },
  appTagBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  appTagBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  categoryBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563EB',
  },
  fluidTicketSubject: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
    lineHeight: 20,
  },
  ticketDateMutedText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  pillOpen: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillOpenText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  pillAnswered: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillAnsweredText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  pillClosed: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillClosedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
});
