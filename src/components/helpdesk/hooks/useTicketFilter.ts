import { useState, useMemo, useCallback } from 'react';
import { HelpDeskTicket } from '../../../services/helpDeskService';
import { TicketFilterStatus } from '../types';

interface UseTicketFilterProps {
  tickets: HelpDeskTicket[];
  isFounder?: boolean;
}

export function useTicketFilter({ tickets, isFounder = false }: UseTicketFilterProps) {
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketFilterStatus>('all');
  const [filterTenantBlindId, setFilterTenantBlindId] = useState<string>('all');
  const [filterOrgId, setFilterOrgId] = useState<string>('all');
  const [filterAppId, setFilterAppId] = useState<string>('all');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');

  // Active Hierarchy Filter Check & Reset
  const hasActiveHierarchyFilters = useMemo(() => {
    return (
      (isFounder && filterTenantBlindId !== 'all') ||
      filterOrgId !== 'all' ||
      filterAppId !== 'all' ||
      filterCategoryId !== 'all'
    );
  }, [isFounder, filterTenantBlindId, filterOrgId, filterAppId, filterCategoryId]);

  const handleResetHierarchyFilters = useCallback(() => {
    setFilterTenantBlindId('all');
    setFilterOrgId('all');
    setFilterAppId('all');
    setFilterCategoryId('all');
  }, []);

  // Filtered tickets (Filter pills + Live search + Hierarchy filters)
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
      // 3. Hierarchy Filters:
      // 3.1 Tenant Filter (Founder)
      if (isFounder && filterTenantBlindId !== 'all') {
        if (ticket.enterprise_blind_id !== filterTenantBlindId) return false;
      }
      // 3.2 Org Filter (Founder, Global Admin, Multi-Category Admin)
      if (filterOrgId !== 'all') {
        const tOrg = ticket.org_id || 'merkez';
        if (tOrg.toLowerCase() !== filterOrgId.toLowerCase()) return false;
      }
      // 3.3 App Filter
      if (filterAppId !== 'all') {
        const tApp = (ticket.app_id || '').toLowerCase();
        if (tApp !== filterAppId.toLowerCase()) return false;
      }
      // 3.4 Category Filter
      if (filterCategoryId !== 'all') {
        if (ticket.category !== filterCategoryId) return false;
      }
      return true;
    });
  }, [
    ticketSearchQuery,
    tickets,
    statusFilter,
    isFounder,
    filterTenantBlindId,
    filterOrgId,
    filterAppId,
    filterCategoryId,
  ]);

  return {
    ticketSearchQuery,
    setTicketSearchQuery,
    statusFilter,
    setStatusFilter,
    filterTenantBlindId,
    setFilterTenantBlindId,
    filterOrgId,
    setFilterOrgId,
    filterAppId,
    setFilterAppId,
    filterCategoryId,
    setFilterCategoryId,
    hasActiveHierarchyFilters,
    handleResetHierarchyFilters,
    filteredTickets,
  };
}
