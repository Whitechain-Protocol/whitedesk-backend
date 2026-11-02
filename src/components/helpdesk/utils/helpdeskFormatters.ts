import { HelpDeskCategory } from '../../../services/helpDeskService';

export const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

export function formatTicketDate(
  timestamp: number,
  showTime: boolean = false,
  t?: (key: string) => string
): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, '0');
  const monthKey = MONTH_KEYS[date.getMonth()];
  const monthName = t ? (t(`common.months.${monthKey}`) || monthKey) : monthKey;
  const hours = date.getHours().toString().padStart(2, '0');
  const mins = date.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${mins}`;

  return showTime
    ? `${day} ${monthName} ${date.getFullYear()} ${timeStr}`
    : `${day} ${monthName} ${date.getFullYear()}`;
}

/**
 * WhiteId is never directly revealed to the end user for privacy and security.
 * Returns 'Siz' / 'You' for own messages, or empty string for others.
 */
export function formatWhiteId(
  id: string | null | undefined,
  ownWhiteId?: string,
  isTurkish: boolean = true
): string {
  if (!id) return '';
  if (ownWhiteId && id.toLowerCase() === ownWhiteId.toLowerCase()) {
    return isTurkish ? 'Siz' : 'You';
  }
  return '';
}

export function formatAppId(appId?: string | null): string {
  if (!appId) return '';
  const low = appId.toLowerCase();
  if (low === 'inwhite' || low === 'whitedesk') return '';
  return appId;
}

export function getCategoryLabel(
  catKey: string | null | undefined,
  availableCategories: HelpDeskCategory[],
  isTurkish: boolean = true
): string {
  if (!catKey || catKey === 'discussion') return '';
  if (catKey === 'root_support' || catKey === 'thewhite_support') {
    return isTurkish ? 'TheWhite Destek' : 'TheWhite Support';
  }
  if (catKey === 'internal_admin_ticket') {
    return isTurkish ? 'Yönetici Talebi' : 'Admin Request';
  }
  if (catKey === 'voice' || catKey === 'general') {
    return '';
  }
  const found = availableCategories.find(c => c.id === catKey || c.key === catKey);
  if (found) {
    return isTurkish ? found.labelTr : found.labelEn;
  }
  return '';
}

/**
 * Checks whether a ticket or its messages contain a WhiteDesk diagnostic package.
 */
export function checkTicketHasDiagnostics(
  ticket: {
    attachment_name?: string | null;
    attachment_type?: string | null;
    attachment_data?: string | null;
    attachments?: Array<{ name?: string; type?: string }> | null;
  } | null | undefined,
  messages?: Array<{
    attachment_name?: string | null;
    attachment_type?: string | null;
    attachment_data?: string | null;
    attachments?: Array<{ name?: string; type?: string }> | null;
  }> | null
): boolean {
  if (!ticket) return false;
  if (ticket.attachment_type === 'diagnostic' || ticket.attachment_name?.includes('diagnostics.whitedesk')) {
    return true;
  }
  if (Array.isArray(ticket.attachments)) {
    if (ticket.attachments.some(a => a.type === 'diagnostic' || a.name?.includes('diagnostics.whitedesk'))) {
      return true;
    }
  }
  if (ticket.attachment_data && typeof ticket.attachment_data === 'string' && ticket.attachment_data.startsWith('[')) {
    try {
      const parsed = JSON.parse(ticket.attachment_data);
      if (Array.isArray(parsed) && parsed.some((f: any) => f.name?.includes('diagnostics.whitedesk') || f.type === 'diagnostic')) {
        return true;
      }
    } catch {}
  }
  if (messages && Array.isArray(messages)) {
    for (const msg of messages) {
      if (msg.attachment_type === 'diagnostic' || msg.attachment_name?.includes('diagnostics.whitedesk')) {
        return true;
      }
      if (Array.isArray(msg.attachments)) {
        if (msg.attachments.some(a => a.type === 'diagnostic' || a.name?.includes('diagnostics.whitedesk'))) {
          return true;
        }
      }
      if (msg.attachment_data && typeof msg.attachment_data === 'string' && msg.attachment_data.startsWith('[')) {
        try {
          const parsed = JSON.parse(msg.attachment_data);
          if (Array.isArray(parsed) && parsed.some((f: any) => f.name?.includes('diagnostics.whitedesk') || f.type === 'diagnostic')) {
            return true;
          }
        } catch {}
      }
    }
  }
  return false;
}

