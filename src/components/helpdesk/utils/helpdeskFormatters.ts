import { HelpDeskCategory } from '../../../services/helpDeskService';
import { i18nService } from '../../../services/i18nService';

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
  _isTurkish: boolean = true
): string {
  if (!id) return '';
  if (ownWhiteId && id.toLowerCase() === ownWhiteId.toLowerCase()) {
    return i18nService.t('helpdesk.you_self');
  }
  return '';
}

/**
 * Formats a blind ID for display (e.g. for ticket creator or assigned admin) when no name is available.
 * Rule: 124495...77343
 * (First 6 characters after 'blind_', 3 dots for 7th-8th-9th, and 10th-14th characters)
 */
export function formatDisplayBlindId(rawBlindId?: string | null): string {
  if (!rawBlindId) return '';
  const cleanBlind = rawBlindId.startsWith('blind_') ? rawBlindId.substring(6) : rawBlindId;
  if (cleanBlind.length >= 14) {
    return `${cleanBlind.substring(0, 6)}...${cleanBlind.substring(9, 14)}`;
  } else if (cleanBlind.length >= 10) {
    return `${cleanBlind.substring(0, 6)}...${cleanBlind.substring(9)}`;
  } else if (cleanBlind.length > 6) {
    return `${cleanBlind.substring(0, 6)}...`;
  }
  return cleanBlind;
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
    return i18nService.t('helpdesk.cat_thewhite_support');
  }
  if (catKey === 'internal_admin_ticket') {
    return i18nService.t('helpdesk.cat_internal_admin_ticket');
  }
  if (catKey === 'voice' || catKey === 'general') {
    return '';
  }
  const i18nDirect = i18nService.t(`helpdesk.cat_${catKey}`);
  if (i18nDirect !== `helpdesk.cat_${catKey}`) {
    return i18nDirect;
  }
  const found = availableCategories.find(c => c.id === catKey || c.key === catKey);
  if (found) {
    const i18nFound = i18nService.t(`helpdesk.cat_${found.id}`);
    if (i18nFound !== `helpdesk.cat_${found.id}`) {
      return i18nFound;
    }
    return isTurkish ? found.labelTr : (found.labelEn || found.labelTr);
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

