import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import {
  Headphones,
  Edit3,
  Plus,
  Search,
  X,
  MessageSquare,
} from 'lucide-react-native';
import { HelpDeskTicket } from '../../../services/helpDeskService';
import { TicketFilterStatus } from '../types';
import { TicketCard } from './TicketCard';

interface TicketListViewProps {
  isAdmin: boolean;
  isFounder: boolean;
  currentEnterpriseName: string;
  customAlias: string | null;
  onIdentifyPress: () => void;
  onNewTicketPress: () => void;
  ticketSearchQuery: string;
  setTicketSearchQuery: (q: string) => void;
  statusFilter: TicketFilterStatus;
  setStatusFilter: (s: TicketFilterStatus) => void;
  filteredTickets: HelpDeskTicket[];
  openTicketDetail: (ticket: HelpDeskTicket) => void;
  handleTicketLongPress: (ticket: HelpDeskTicket) => void;
  getLabel: (key: string, tr: string, en: string) => string;
  formatWhiteId: (id: string) => string;
  formatAppId: (id?: string) => string;
  formatTicketDate: (ts: number, showTime?: boolean) => string;
  getCategoryLabel: (cat?: string) => string;
  language: string;
  isGlobalAdmin?: boolean;
  onAdminSupportTicketPress?: () => void;
}

export const TicketListView: React.FC<TicketListViewProps> = ({
  isAdmin,
  isFounder,
  currentEnterpriseName,
  customAlias,
  onIdentifyPress,
  onNewTicketPress,
  ticketSearchQuery,
  setTicketSearchQuery,
  statusFilter,
  setStatusFilter,
  filteredTickets,
  openTicketDetail,
  handleTicketLongPress,
  getLabel,
  formatWhiteId,
  formatAppId,
  formatTicketDate,
  getCategoryLabel,
  language,
  isGlobalAdmin = false,
  onAdminSupportTicketPress,
}) => {
  return (
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
              onPress={onIdentifyPress}
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
        onPress={onNewTicketPress}
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
      {isAdmin && onAdminSupportTicketPress && (
        <TouchableOpacity
          style={[styles.fluidNewTicketBtn, styles.fluidAdminGreenBtn]}
          onPress={onAdminSupportTicketPress}
          activeOpacity={0.85}
        >
          <Plus size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
          <Text style={styles.fluidNewTicketBtnText}>
            {isGlobalAdmin
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
          {filteredTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onPress={() => openTicketDetail(ticket)}
              onLongPress={() => handleTicketLongPress(ticket)}
              getLabel={getLabel}
              formatWhiteId={formatWhiteId}
              formatAppId={formatAppId}
              formatTicketDate={formatTicketDate}
              getCategoryLabel={getCategoryLabel}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainWhitePanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    marginBottom: 20,
  },
  panelHeaderRow: {
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sectionSubtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  identifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  identifyText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  fluidNewTicketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 14,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  fluidNewTicketBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fluidSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  fluidSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  fluidFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  fluidFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fluidFilterPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  fluidFilterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  fluidFilterPillTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  emptyContainerFluid: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTextFluid: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  ticketsListWrapper: {
    width: '100%',
  },
  fluidAdminGreenBtn: {
    backgroundColor: '#16A34A',
    marginTop: 8,
  },
});
