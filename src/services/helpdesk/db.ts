import { HelpDeskCategory } from './types';

// SECURITY: Credentials are loaded from process.env at bundle time.
export const WHITEDESK_NEON_ENDPOINT = process.env.EXPO_PUBLIC_NEON_ENDPOINT || '';
export const WHITEDESK_CONNECTION_STRING = process.env.EXPO_PUBLIC_NEON_CONNECTION_STRING || '';

// In-memory structural performance caches (eliminates redundant Neon pooler HTTP overhead)
export let _roleCache: { [whiteId: string]: { role: 'founder' | 'global_admin' | 'admin' | 'none'; ts: number } } = {};
export let _categoryCache: { [appId: string]: HelpDeskCategory[] } = {};

export function invalidateHelpDeskRoleCache() {
  _roleCache = {};
  _categoryCache = {};
}

export function clearCategoryCache() {
  _categoryCache = {};
}

export function generateTicketId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TKT-${rand}`;
}

export function escapeSqlString(val: string | null | undefined, nullable: boolean = false): string {
  if (val === null || val === undefined) return nullable ? 'NULL' : "''";
  return "'" + String(val).replace(/'/g, "''") + "'";
}

export async function executeSql(query: string): Promise<any[]> {
  try {
    const res = await fetch(WHITEDESK_NEON_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Neon-Connection-String': WHITEDESK_CONNECTION_STRING,
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[HelpDeskService] SQL error:', res.status, errText);
      return [];
    }

    const data = await res.json();
    return Array.isArray(data.rows) ? data.rows : [];
  } catch (err) {
    console.warn('[HelpDeskService] executeSql network error:', err);
    return [];
  }
}

/**
 * Role'e göre alias üretir:
 *   founder / master (ilk) → 'TheWhite'   (Kurucu / Lisansör)
 *   global_admin           → 'WhiteCosmos' (Kiracı Global Admin)
 *   operator / admin       → 'Planet-1', 'Planet-2' … (Destek Operatörleri)
 */
export async function generateCosmoAlias(role: string = 'admin'): Promise<string> {
  try {
    if (role === 'founder' || role === 'master') {
      return 'TheWhite';
    }
    if (role === 'global_admin') {
      return 'WhiteCosmos';
    }

    const opRows = await executeSql(`SELECT COUNT(*) as cnt FROM whitedesk_admins WHERE role != 'founder' AND role != 'global_admin' AND role != 'master';`);
    const opCount = Number(opRows[0]?.cnt || 0);
    return `Planet-${opCount + 1}`;
  } catch {
    if (role === 'founder') return 'TheWhite';
    if (role === 'global_admin') return 'WhiteCosmos';
    return `Planet-${Math.floor(Math.random() * 9) + 1}`;
  }
}
