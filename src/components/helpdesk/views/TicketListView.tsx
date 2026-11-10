import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Headphones,
  Edit3,
  Plus,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowRight,
  Search,
  X,
  MessageSquare,
  Building2,
  Users,
  Smartphone,
  Tag,
  Radio,
} from 'lucide-react-native';
import { HelpDeskTicket, TenantEntry, OrgEntry, AppCatEntry } from '../../../services/helpDeskService';
import { TicketFilterStatus } from '../types';
import { TicketCard } from './TicketCard';
import { FilterSlidersIcon } from '../icons/FilterSlidersIcon';
import { HeadphoneChatIcon } from '../icons/HeadphoneChatIcon';
import { buttonThemeService, ButtonTheme } from '../../../services/helpdesk/buttonThemeService';

interface TicketListViewProps {
  isAdmin: boolean;
  isFounder: boolean;
  isMasterAdmin?: boolean;
  currentEnterpriseName: string;
  customAlias: string | null;
  onIdentifyPress: () => void;
  onNewTicketPress: () => void;
  onNewDiscussionPress?: () => void;
  ticketSearchQuery: string;
  setTicketSearchQuery: (q: string) => void;
  statusFilter: TicketFilterStatus;
  setStatusFilter: (s: TicketFilterStatus) => void;
  filteredTickets: HelpDeskTicket[];
  openTicketDetail: (ticket: HelpDeskTicket) => void;
  handleTicketLongPress: (ticket: HelpDeskTicket) => void;
  getLabel: (key: string, trOrParams?: string | Record<string, string | number>, en?: string, maybeParams?: Record<string, string | number>) => string;
  formatWhiteId: (id: string) => string;
  formatAppId: (id?: string) => string;
  formatTicketDate: (ts: number, showTime?: boolean) => string;
  getCategoryLabel: (cat?: string) => string;
  language: string;
  isGlobalAdmin?: boolean;
  onAdminSupportTicketPress?: () => void;
  onTicketMenuPress?: (ticket: HelpDeskTicket, pageY?: number) => void;
  onFilterPress?: () => void;
  hasActiveFilters?: boolean;
  // Hierarchy chips & filters
  filterTenantBlindId?: string;
  setFilterTenantBlindId?: (id: string) => void;
  filterOrgId?: string;
  setFilterOrgId?: (id: string) => void;
  filterAppId?: string;
  setFilterAppId?: (id: string) => void;
  filterCategoryId?: string;
  setFilterCategoryId?: (id: string) => void;
  tenantsList?: TenantEntry[];
  orgsList?: OrgEntry[];
  appsList?: AppCatEntry[];
  onResetHierarchyFilters?: () => void;
  showRadioBroadcastBar?: boolean;
  onRadioBroadcastPress?: () => void;
  isSearchActive?: boolean;
  onSearchFocusChange?: (focused: boolean) => void;
  buttonTheme?: ButtonTheme;
}

export const TicketListView: React.FC<TicketListViewProps> = ({
  isAdmin,
  isFounder,
  isMasterAdmin = false,
  isGlobalAdmin = false,
  currentEnterpriseName,
  customAlias,
  onIdentifyPress,
  onNewTicketPress,
  onNewDiscussionPress,
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
  onAdminSupportTicketPress,
  onTicketMenuPress,
  onFilterPress,
  hasActiveFilters = false,
  filterTenantBlindId = 'all',
  setFilterTenantBlindId,
  filterOrgId = 'all',
  setFilterOrgId,
  filterAppId = 'all',
  setFilterAppId,
  filterCategoryId = 'all',
  setFilterCategoryId,
  tenantsList = [],
  orgsList = [],
  appsList = [],
  onResetHierarchyFilters,
  showRadioBroadcastBar = false,
  onRadioBroadcastPress,
  isSearchActive = false,
  onSearchFocusChange,
  buttonTheme,
}) => {
  const theme = buttonTheme || buttonThemeService.getDefaultTheme();
  const isTheWhite = Boolean(
    currentEnterpriseName &&
    (currentEnterpriseName.toLowerCase().includes('thewhite') ||
     currentEnterpriseName.toLowerCase().includes('the white'))
  );

  return (
    <View style={styles.mainWhitePanel}>
      {/* SECTION HEADER ROW INSIDE PANEL */}
      <View style={[styles.panelHeaderRow, isSearchActive && { display: 'none' }]}>
        <View style={styles.sectionTitleContainer}>
          <View style={styles.titleIconBox}>
            <HeadphoneChatIcon size={28} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitleText}>
              {isAdmin ? getLabel('helpdesk.titleAdmin') : getLabel('helpdesk.titleUser')}
            </Text>
            <Text style={styles.sectionSubtitleText}>
              {isAdmin
                ? (isFounder ? getLabel('helpdesk.founder_root_subtitle') : (currentEnterpriseName || getLabel('helpdesk.enterprise_support_desk')))
                : (currentEnterpriseName || getLabel('helpdesk.support_and_ops_center'))}
            </Text>

            {/* "Kendinizi tanımlayın" with grey pencil icon */}
            <TouchableOpacity
              style={styles.identifyRow}
              onPress={onIdentifyPress}
              activeOpacity={0.7}
            >
              <Edit3 size={12} color="#94A3B8" strokeWidth={2} style={{ marginRight: 4 }} />
              <Text style={styles.identifyText}>
                {customAlias ? customAlias : getLabel('helpdesk.identify_yourself')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 1. TEMA: Yeni bir bilet oluştur */}
      {!isFounder && !isTheWhite && (!isMasterAdmin || isGlobalAdmin) && (
        <TouchableOpacity
          style={[
            styles.fluidNewTicketBtn,
            {
              backgroundColor: theme.ticket.bg,
              borderColor: theme.ticket.border !== 'transparent' ? theme.ticket.border : 'transparent',
              borderWidth: theme.ticket.border !== 'transparent' ? 1 : 0,
              shadowColor: theme.ticket.bg !== '#FFFFFF' ? theme.ticket.bg : '#000000',
            },
            isSearchActive && { display: 'none' },
          ]}
          onPress={onNewTicketPress}
          activeOpacity={0.85}
        >
          <Plus size={18} color={theme.ticket.text} strokeWidth={2.5} style={{ marginRight: 6 }} />
          <Text style={[styles.fluidNewTicketBtnText, { color: theme.ticket.text }]}>
            {getLabel('helpdesk.create_new_ticket_btn')}
          </Text>
          <ArrowUp size={16} color={theme.ticket.text} strokeWidth={2.5} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      )}

      {/* 2. TEMA (TURUNCU): Bir Tartışma Başlat (Admin, Global Admin, Kurucu) */}
      {(isAdmin || isFounder || isMasterAdmin || isTheWhite) && (
        <TouchableOpacity
          style={[
            styles.fluidNewTicketBtn,
            styles.fluidDiscussionPurpleBtn,
            {
              backgroundColor: theme.disc.bg,
              borderColor: theme.disc.border !== 'transparent' ? theme.disc.border : 'transparent',
              borderWidth: theme.disc.border !== 'transparent' ? 1 : 0,
              shadowColor: theme.disc.bg !== '#FFFFFF' ? theme.disc.bg : '#000000',
            },
            isSearchActive && { display: 'none' },
          ]}
          onPress={onNewDiscussionPress || onNewTicketPress}
          activeOpacity={0.85}
        >
          <MessageSquare size={18} color={theme.disc.text} strokeWidth={2.2} style={{ marginRight: 6 }} />
          <Text style={[styles.fluidNewTicketBtnText, { color: theme.disc.text }]}>
            {getLabel('helpdesk.start_discussion_btn')}
          </Text>
          {isMasterAdmin || isFounder || isTheWhite || isGlobalAdmin ? (
            <ArrowDown size={16} color={theme.disc.text} strokeWidth={2.5} style={{ marginLeft: 6 }} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
              <ArrowRight size={15} color={theme.disc.text} strokeWidth={2.5} />
              <ArrowUp size={15} color={theme.disc.text} strokeWidth={2.5} style={{ marginLeft: 2 }} />
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* 3. TEMA: Bir telsiz yayını başlat */}
      {showRadioBroadcastBar && onRadioBroadcastPress && (
        <TouchableOpacity
          style={[
            styles.fluidNewTicketBtn,
            styles.fluidRadioBroadcastBtn,
            {
              backgroundColor: theme.radio.bg,
              borderColor: theme.radio.border !== 'transparent' ? theme.radio.border : 'transparent',
              borderWidth: theme.radio.border !== 'transparent' ? 1 : 0,
              shadowColor: theme.radio.bg !== '#FFFFFF' ? theme.radio.bg : '#000000',
            },
            isSearchActive && { display: 'none' },
          ]}
          onPress={onRadioBroadcastPress}
          activeOpacity={0.85}
        >
          <Radio size={18} color={theme.radio.text} strokeWidth={2.2} style={{ marginRight: 8 }} />
          <Text style={[styles.fluidNewTicketBtnText, { color: theme.radio.text }]}>
            {getLabel('helpdesk.start_radio_broadcast_btn')}
          </Text>
        </TouchableOpacity>
      )}

      <View style={{ flexDirection: isSearchActive ? 'column-reverse' : 'column' }}>
        <View style={isSearchActive ? { marginTop: 8 } : undefined}>
          {/* FLUID SEARCH BAR */}
          <View style={styles.fluidSearchBar}>
            <Search size={17} color="#94A3B8" strokeWidth={2} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.fluidSearchInput}
              placeholder={getLabel('helpdesk.searchPlaceholder')}
              placeholderTextColor="#94A3B8"
              value={ticketSearchQuery}
              onChangeText={setTicketSearchQuery}
              onFocus={() => onSearchFocusChange?.(true)}
              onBlur={() => onSearchFocusChange?.(false)}
              returnKeyType="search"
            />
            {ticketSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setTicketSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: 6 }}>
                <X size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}
            {onFilterPress && (
              <TouchableOpacity
                onPress={onFilterPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.searchFilterBtn}
                activeOpacity={0.7}
              >
                <FilterSlidersIcon
                  size={17}
                  color={hasActiveFilters ? '#16A34A' : '#94A3B8'}
                  strokeWidth={2}
                />
                {hasActiveFilters && <View style={styles.filterBadgeDot} />}
              </TouchableOpacity>
            )}
          </View>

          {/* ACTIVE FILTER CHIPS STRIP */}
          {hasActiveFilters && (
            <View style={styles.activeFilterChipsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.activeFilterChipsScroll}
              >
                {isFounder && filterTenantBlindId !== 'all' && setFilterTenantBlindId && (
                  <TouchableOpacity
                    style={styles.activeFilterChip}
                    onPress={() => setFilterTenantBlindId('all')}
                    activeOpacity={0.7}
                  >
                    <Building2 size={11} color="#0D9488" style={{ marginRight: 4 }} />
                    <Text style={styles.activeFilterChipText}>
                      {tenantsList.find((t) => t.enterprise_blind_id === filterTenantBlindId)?.name ||
                        filterTenantBlindId.slice(0, 8)}
                    </Text>
                    <X size={11} color="#166534" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                )}

                {filterOrgId !== 'all' && setFilterOrgId && (
                  <TouchableOpacity
                    style={styles.activeFilterChip}
                    onPress={() => setFilterOrgId('all')}
                    activeOpacity={0.7}
                  >
                    <Users size={11} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={styles.activeFilterChipText}>
                      {orgsList.find((o) => o.org_id.toLowerCase() === filterOrgId.toLowerCase())?.name || filterOrgId}
                    </Text>
                    <X size={11} color="#166534" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                )}

                {filterAppId !== 'all' && setFilterAppId && (
                  <TouchableOpacity
                    style={styles.activeFilterChip}
                    onPress={() => setFilterAppId('all')}
                    activeOpacity={0.7}
                  >
                    <Smartphone size={11} color="#0D9488" style={{ marginRight: 4 }} />
                    <Text style={styles.activeFilterChipText}>
                      {appsList.find((a) => a.app_id.toLowerCase() === filterAppId.toLowerCase())?.name || filterAppId}
                    </Text>
                    <X size={11} color="#166534" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                )}

                {filterCategoryId !== 'all' && setFilterCategoryId && (
                  <TouchableOpacity
                    style={styles.activeFilterChip}
                    onPress={() => setFilterCategoryId('all')}
                    activeOpacity={0.7}
                  >
                    <Tag size={11} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={styles.activeFilterChipText}>
                      {getCategoryLabel(filterCategoryId)}
                    </Text>
                    <X size={11} color="#166534" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                )}

                {onResetHierarchyFilters && (
                  <TouchableOpacity
                    style={styles.clearAllFilterChip}
                    onPress={onResetHierarchyFilters}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.clearAllFilterChipText}>
                      {getLabel('helpdesk.clear_filters')}
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}

          {/* FILTER PILLS ROW */}
          <View style={[styles.fluidFilterRow, isSearchActive && { marginBottom: 4 }]}>
            {(['all', 'open', 'answered', 'closed'] as const).map((filterKey) => {
              const isSelected = statusFilter === filterKey;
              const label = filterKey === 'all'
                ? getLabel('helpdesk.filterAll')
                : filterKey === 'open'
                  ? getLabel('helpdesk.filterOpen')
                  : filterKey === 'answered'
                    ? getLabel('helpdesk.filterAnswered')
                    : getLabel('helpdesk.filterClosed');

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
        </View>

        {/* TICKETS LIST */}
        {filteredTickets.length === 0 ? (
          <View style={styles.emptyContainerFluid}>
            <MessageSquare size={36} color="#CBD5E1" strokeWidth={1.5} style={{ marginBottom: 10 }} />
            <Text style={styles.emptyTextFluid}>
              {ticketSearchQuery.trim()
                ? getLabel('helpdesk.emptySearch')
                : statusFilter !== 'all'
                  ? getLabel('helpdesk.emptyFilter')
                  : getLabel('helpdesk.emptyTickets')}
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
                onMenuPress={(tkt, pageY) => (onTicketMenuPress || handleTicketLongPress)(tkt, pageY)}
                getLabel={getLabel}
                formatWhiteId={formatWhiteId}
                formatAppId={formatAppId}
                formatTicketDate={formatTicketDate}
                getCategoryLabel={getCategoryLabel}
                orgsList={orgsList}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

// 🔒 KİLİTLİ TASARIM: Ana ekran panel, buton, arama çubuğu ve filtre haplarının durumları tespit edilip kilitlenmiştir. Asla değiştirilmemelidir.
const styles = Object.freeze(StyleSheet.create({
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
    backgroundColor: '#F1F5F9',
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
  fluidDiscussionPurpleBtn: {
    backgroundColor: '#EA580C',
    shadowColor: '#EA580C',
    marginTop: -4,
    marginBottom: 14,
  },
  fluidAdminGreenBtn: {
    backgroundColor: '#16A34A',
    marginTop: -4,
    marginBottom: 14,
  },
  fluidRadioBroadcastBtn: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    marginTop: -4,
    marginBottom: 14,
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
  searchFilterBtn: {
    paddingLeft: 8,
    paddingVertical: 2,
    position: 'relative',
  },
  filterBadgeDot: {
    position: 'absolute',
    top: 0,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  activeFilterChipsContainer: {
    marginBottom: 12,
  },
  activeFilterChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeFilterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },
  clearAllFilterChip: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  clearAllFilterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
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
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1.5,
  },
  fluidFilterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  fluidFilterPillTextActive: {
    color: '#166534',
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
}));
