import { SafeSecureStore } from './storageService';
import { CryptoService } from './cryptoService';
import { apiClient } from './apiClient';
import { WhiteDeskCrypto, DEFAULT_THEWHITE_PUBKEY } from '../whitedesk-sdk';

// Sovereign WhiteDesk Client Service
// Completely decoupled from Calling Core (WebRTC/Agora) and Sovereign Mailbox (WhiteMail).
// Native Multi-Tenant Support: Supports 'inwhite' and external dynamic app tickets.

// SECURITY: Credentials are NEVER committed. Loaded from gitignored .env.local at bundle time.
// TEMPORARY — will be removed entirely once whitedesk-api (Vercel) backend is live.
const WHITEDESK_NEON_ENDPOINT = process.env.EXPO_PUBLIC_NEON_ENDPOINT || '';
const WHITEDESK_CONNECTION_STRING = process.env.EXPO_PUBLIC_NEON_CONNECTION_STRING || '';

export const CURRENT_APP_ID = 'inwhite';

const STORAGE_KEYS = {
  OWN_WHITE_ID: 'inwhite_id',
  ADMIN_KEY: 'inwhite_helpdesk_admin_secret',
  ADMIN_WHITE_ID: 'inwhite_helpdesk_admin_white_id',
  LEGACY_ADMIN_KEY: 'inwhite_mailbox_admin_secret',
  ADMIN_ROLE: 'inwhite_helpdesk_admin_role',
  ADMIN_ENTERPRISE_BLIND_ID: 'inwhite_helpdesk_admin_enterprise_blind_id',
  ADMIN_ORG_PUB: 'inwhite_helpdesk_admin_org_pub',
  ADMIN_ENTERPRISE_NAME: 'inwhite_helpdesk_admin_enterprise_name',
  USER_ORG_BLIND_ID: 'inwhite_helpdesk_user_org_blind_id',
  USER_ORG_PUB: 'inwhite_helpdesk_user_org_pub',
  USER_ENTERPRISE_NAME: 'inwhite_helpdesk_user_enterprise_name',
  CUSTOM_ALIAS: 'inwhite_helpdesk_custom_alias',
  ACTIVE_TENANT_BLIND_ID: 'inwhite_helpdesk_active_tenant_blind_id',
};

// In-memory structural performance caches (eliminates redundant Neon pooler HTTP overhead)
let _roleCache: { [whiteId: string]: { role: 'founder' | 'global_admin' | 'admin' | 'none'; ts: number } } = {};
let _categoryCache: { [appId: string]: HelpDeskCategory[] } = {};

export function invalidateHelpDeskRoleCache() {
  _roleCache = {};
  _categoryCache = {};
}

// ─── WhiteDesk Cosmic Alias Hierarchy ────────────────────────────────────────
//
//   Rol            Alias
//   ─────────────  ─────────────────────────────────────────────
//   founder        TheWhite        ← Kurucu / Lisansör Otoritesi (**)
//   global_admin   WhiteCosmos     ← Tenant Global Yöneticisi (*)
//   admin          Planet-1, vb.   ← Saha ve Destek Yöneticileri
//
const PLANET_NAMES = [
  'Planet', 'Orbit', 'Cluster',
];

/**
 * Role'e göre alias üretir:
 *   founder / master (ilk) → 'TheWhite'   (Kurucu / Lisansör)
 *   global_admin           → 'WhiteCosmos' (Kiracı Global Admin)
 *   operator / admin       → 'Planet-1', 'Planet-2' … (Destek Operatörleri)
 */
async function generateCosmoAlias(role: string = 'admin'): Promise<string> {
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

export type TicketStatus = 'open' | 'answered' | 'resolved' | 'closed';

export interface HelpDeskCategory {
  id: string;
  key: string;
  enterprise_blind_id?: string | null;
  org_id?: string | null;
  app_id?: string | null;
  icon?: string;
  labelTr: string;
  labelEn: string;
}

export const INWHITE_CATEGORIES: HelpDeskCategory[] = [
  { id: 'voice', key: 'voice', icon: 'Phone', labelTr: 'Ses & Görüşme', labelEn: 'Audio & Calls' },
  { id: 'security', key: 'security', icon: 'Shield', labelTr: 'Ağ & Güvenlik', labelEn: 'Network & Security' },
  { id: 'account', key: 'account', icon: 'User', labelTr: 'Hesap & whiteID', labelEn: 'Account & whiteID' },
  { id: 'general', key: 'general', icon: 'HelpCircle', labelTr: 'Genel Destek', labelEn: 'General Support' },
];

export interface AppEntry {
  app_id: string;
  enterprise_blind_id?: string;
  name: string;
  icon?: string;
  is_active?: boolean;
  created_at?: number;
}

export interface AppCatEntry {
  app_id: string;
  name?: string;
  enterprise_blind_id?: string;
  categories: HelpDeskCategory[];
  updated_at: number;
}

export type AppRegStatus = 'registered' | 'pending' | 'rejected' | 'unregistered';

export interface AppRequestEntry {
  id: number;
  app_id: string;
  app_name: string;
  description: string;
  requestor_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: number;
  reviewed_at?: number;
  reviewed_by?: string;
}

export interface AdminEntry {
  white_id: string;
  enterprise_blind_id?: string;
  enterprise_name?: string;
  alias: string;
  role: string;
  is_active: boolean;
  created_at: number;
}

export interface OrgEntry {
  org_id: string;
  enterprise_blind_id?: string;
  name: string;
  created_at: number;
}

export interface TenantEntry {
  enterprise_blind_id: string;
  name: string;
  org_pub: string;
  is_founder_tenant?: boolean;
  created_at: number;
}

export interface ApprovalEntry {
  id: number;
  type: 'global_admin' | 'admin' | 'user' | 'delete_app' | 'delete_org';
  tenant_blind_id: string;
  tenant_name?: string;
  candidate_white_id?: string;
  candidate_blind_id: string;
  candidate_alias?: string;
  target_org_id?: string;
  target_app_id?: string;
  target_categories?: string[];
  status: 'pending' | 'approved' | 'rejected';
  requested_at: number;
  reviewed_at?: number;
  reviewed_by?: string;
}

export interface AdminAllocEntry {
  id?: number;
  admin_white_id: string;
  enterprise_blind_id?: string;
  org_id?: string;
  app_id: string;
  category_id?: string;
  categories: string[];
  updated_at: number;
}

export interface HelpDeskTicket {
  id: string;
  enterprise_blind_id?: string;
  org_id?: string;
  app_id: string;
  user_white_id: string;
  user_blind_id?: string;
  user_pubkey?: string;
  ticket_pubkey?: string;
  subject: string;
  category?: string;
  status: TicketStatus;
  is_discussion?: boolean;
  created_at: number;
  updated_at: number;
}

export interface HelpDeskMessage {
  id: string;
  ticket_id: string;
  app_id: string;
  sender_white_id: string;
  sender_alias?: string | null;
  sender_blind_id?: string | null;
  is_admin: boolean;
  /** Role from whitedesk_admins: 'founder' | 'global_admin' | 'admin' | null */
  sender_role?: 'founder' | 'global_admin' | 'admin' | null;
  message: string;
  attachment_data?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  created_at: number;
}

function generateTicketId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TKT-${rand}`;
}

function escapeSqlString(val: string | null | undefined, nullable: boolean = false): string {
  if (val === null || val === undefined) return nullable ? 'NULL' : "''";
  return "'" + String(val).replace(/'/g, "''") + "'";
}

async function executeSql(query: string): Promise<any[]> {
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

export const helpDeskService = {
  /**
   * Current default application identifier
   */
  appId: CURRENT_APP_ID,

  /**
   * Retrieves the current device's WhiteID.
   */
  async getOwnWhiteId(): Promise<string> {
    try {
      const cryptoId = await CryptoService.getWhiteId();
      if (cryptoId) return cryptoId.trim();
    } catch {}
    const id = await SafeSecureStore.getItemAsync(STORAGE_KEYS.OWN_WHITE_ID);
    return id ? id.trim() : 'anonymous';
  },

  /**
   * Retrieves the saved Admin secret key.
   */
  async getSavedAdminKey(): Promise<string | null> {
    const key = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_KEY);
    if (key) return key;
    return await SafeSecureStore.getItemAsync(STORAGE_KEYS.LEGACY_ADMIN_KEY);
  },

  /**
   * Saves or clears the Admin secret key in secure hardware storage.
   */
  async setSavedAdminKey(key: string | null): Promise<void> {
    if (key) {
      await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_KEY, key.trim());
    } else {
      await SafeSecureStore.deleteItemAsync(STORAGE_KEYS.ADMIN_KEY);
    }
  },


  /**
   * Resolves the current user's admin role: 'founder' | 'global_admin' | 'admin' | 'none'
   */
  async getAdminRole(ownWhiteId: string): Promise<'founder' | 'global_admin' | 'admin' | 'none'> {
    try {
      if (!ownWhiteId || ownWhiteId === 'anonymous') return 'none';
      const cleanId = ownWhiteId.trim();
      const cached = _roleCache[cleanId];
      if (cached && (Date.now() - cached.ts < 60000)) {
        return cached.role;
      }

      const blindId = WhiteDeskCrypto.generateBlindId(cleanId);
      const rows = await executeSql(
        `SELECT role FROM whitedesk_admins 
         WHERE (white_id = ${escapeSqlString(blindId)} OR LOWER(white_id) = ${escapeSqlString(cleanId.toLowerCase())}) 
         AND is_active = true LIMIT 1;`
      );
      let resRole: 'founder' | 'global_admin' | 'admin' | 'none' = 'none';
      if (rows.length > 0) {
        const r = String(rows[0].role || '').toLowerCase();
        if (r === 'founder' || r === 'master') resRole = 'founder';
        else if (r === 'global_admin') resRole = 'global_admin';
        else resRole = 'admin';
      } else {
        const localRole = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ROLE);
        if (localRole === 'founder' || localRole === 'master') resRole = 'founder';
        else if (localRole === 'global_admin') resRole = 'global_admin';
        else if (localRole === 'admin') resRole = 'admin';
      }

      _roleCache[cleanId] = { role: resRole, ts: Date.now() };
      return resRole;
    } catch {
      return 'none';
    }
  },

  /**
   * Fast check if the given whiteID has any admin privileges.
   */
  async checkIfAdmin(ownWhiteId: string): Promise<boolean> {
    const role = await this.getAdminRole(ownWhiteId);
    return role !== 'none';
  },

  /**
   * Retrieves bound enterprise data for the current user device
   */
  async getUserEnterprise(): Promise<{ enterpriseBlindId: string | null; orgPub: string | null; enterpriseName: string | null }> {
    const enterpriseBlindId = await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID);
    const orgPub = await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_PUB);
    const enterpriseName = await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME);
    return { enterpriseBlindId, orgPub, enterpriseName };
  },

  /**
   * Retrieves registered enterprise data for the current admin device
   */
  async getAdminEnterprise(): Promise<{ enterpriseBlindId: string | null; orgPub: string | null; enterpriseName: string | null }> {
    const enterpriseBlindId = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID);
    const orgPub = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ORG_PUB);
    const enterpriseName = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME);
    return { enterpriseBlindId, orgPub, enterpriseName };
  },

  /**
   * Retrieves all registered tenants from whitedesk_enterprises (Level 0 - Founder visibility)
   */
  async getAllTenants(): Promise<TenantEntry[]> {
    try {
      const rows = await executeSql(
        `SELECT enterprise_blind_id, name, org_pub, is_founder_tenant, created_at 
         FROM whitedesk_enterprises 
         ORDER BY is_founder_tenant DESC, created_at ASC;`
      );
      return rows.map((r) => ({
        enterprise_blind_id: String(r.enterprise_blind_id),
        name: String(r.name),
        org_pub: String(r.org_pub),
        is_founder_tenant: Boolean(r.is_founder_tenant),
        created_at: Number(r.created_at || Date.now()),
      }));
    } catch (e) {
      console.warn('[HelpDeskService] getAllTenants error:', e);
      return [];
    }
  },

  /**
   * Self-Service Multi-Tenant Provizyonu:
   * Tek parametre: tenantName (Kurum Adı)
   * 1. whitedesk_enterprises tablosuna sadece name ve enterprise_blind_id ile kayıt ekler.
   * 2. 14 günlük deneme paketi kapsamında 3 adet tekil kriptografik hash üretir:
   *    - Global Admin Hash (1 kullanım, Kurucu)
   *    - Admin Hash (3 koltuk/kullanım, Destek Operatörleri, 14 gün)
   *    - User Hash (10 koltuk/kullanım, Müşteriler, 14 gün)
   * 3. whitedesk_recovery_hashes tablosuna ekler.
   */
  async createSelfServiceTenant(
    tenantName: string,
    customFields?: Array<{ key: string; label: string; required?: boolean }>,
    catalog?: Array<Record<string, string>>
  ): Promise<{
    success: boolean;
    enterpriseBlindId?: string;
    tenantName?: string;
    globalAdminHash?: string;
    adminHash?: string;
    userHash?: string;
    message?: string;
  }> {
    const cleanName = (tenantName || '').trim();
    if (!cleanName) {
      return { success: false, message: 'Lütfen geçerli bir kurum / şirket adı belirtin.' };
    }

    try {
      const now = Date.now();
      const randHex = (len: number = 12) => {
        const chars = 'abcdef0123456789';
        let res = '';
        for (let i = 0; i < len; i++) {
          res += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return res;
      };

      const enterpriseBlindId = 'ent_' + randHex(12);
      const globalAdminHash = 'ga_cosmos_' + randHex(16);
      const adminHash = 'adm_oper_' + randHex(16);
      const userHash = 'usr_div_' + randHex(16);
      const trialExpiresAt = now + 14 * 24 * 60 * 60 * 1000; // 14 gün deneme

      // JSONB kolonlarını hazırla (yoksa ekle)
      await executeSql(`
        ALTER TABLE whitedesk_enterprises ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE whitedesk_enterprises ADD COLUMN IF NOT EXISTS catalog JSONB DEFAULT '[]'::jsonb;
      `).catch(() => {});

      const fieldsJson = customFields && customFields.length > 0 ? JSON.stringify(customFields) : '[]';
      const catalogJson = catalog && catalog.length > 0 ? JSON.stringify(catalog) : '[]';

      // 1. whitedesk_enterprises kaydı
      await executeSql(`
        INSERT INTO whitedesk_enterprises (enterprise_blind_id, name, created_at, is_founder_tenant, custom_fields, catalog)
        VALUES (
          ${escapeSqlString(enterpriseBlindId)}, 
          ${escapeSqlString(cleanName)}, 
          ${now}, 
          FALSE,
          ${escapeSqlString(fieldsJson)}::jsonb,
          ${escapeSqlString(catalogJson)}::jsonb
        )
        ON CONFLICT (enterprise_blind_id) DO NOTHING;
      `);

      // 2. whitedesk_recovery_hashes içine 3 kademeli hash provizyonu
      await executeSql(`
        INSERT INTO whitedesk_recovery_hashes (hash, type, tenant_blind_id, org_id, app_id, max_uses, uses_count, used, expires_at, created_at)
        VALUES 
          (${escapeSqlString(globalAdminHash)}, 'global_admin', ${escapeSqlString(enterpriseBlindId)}, 'default', 'inwhite', 1, 0, FALSE, NULL, ${now}),
          (${escapeSqlString(adminHash)}, 'admin', ${escapeSqlString(enterpriseBlindId)}, 'default', 'inwhite', 3, 0, FALSE, ${trialExpiresAt}, ${now}),
          (${escapeSqlString(userHash)}, 'user', ${escapeSqlString(enterpriseBlindId)}, 'default', 'inwhite', 10, 0, FALSE, ${trialExpiresAt}, ${now});
      `);

      // Lokal önbelleğe al
      try {
        await SafeSecureStore.setItemAsync(`custom_fields_${enterpriseBlindId}`, fieldsJson);
        await SafeSecureStore.setItemAsync(`catalog_${enterpriseBlindId}`, catalogJson);
      } catch {}

      return {
        success: true,
        enterpriseBlindId,
        tenantName: cleanName,
        globalAdminHash,
        adminHash,
        userHash,
        message: `'${cleanName}' kurumsal destek masası ve 14 günlük deneme anahtarlarınız başarıyla oluşturuldu.`,
      };
    } catch (e: any) {
      console.warn('[HelpDeskService] createSelfServiceTenant error:', e);
      return { success: false, message: 'Kurum masası oluşturulurken bir hata oluştu: ' + (e?.message || e) };
    }
  },

  /**
   * Fetches tenant custom field definitions and product catalog
  /**
   * Returns active enterprise blind ID for either admin or user
   */
  async getActiveEnterpriseBlindId(): Promise<string | null> {
    const adminEnt = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID);
    if (adminEnt) return adminEnt;
    const userEnt = await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID);
    if (userEnt) return userEnt;
    return null;
  },

  /**
   * Fetches tenant custom field definitions and product catalog
   */
  async getTenantCustomFieldsAndCatalog(enterpriseBlindId?: string): Promise<{
    customFields: Array<{ key: string; label: string; required?: boolean }>;
    catalog: Array<Record<string, string>>;
  }> {
    const tenantId = enterpriseBlindId || (await this.getActiveEnterpriseBlindId()) || 'default';
    try {
      // 1. Önce yerel önbellek
      const cachedFields = await SafeSecureStore.getItemAsync(`custom_fields_${tenantId}`);
      const cachedCatalog = await SafeSecureStore.getItemAsync(`catalog_${tenantId}`);
      if (cachedFields && cachedCatalog) {
        return {
          customFields: JSON.parse(cachedFields),
          catalog: JSON.parse(cachedCatalog),
        };
      }

      // 2. Veritabanından çek
      const rows = await executeSql(`
        SELECT custom_fields, catalog FROM whitedesk_enterprises 
        WHERE enterprise_blind_id = ${escapeSqlString(tenantId)} LIMIT 1;
      `);
      if (rows && rows.length > 0) {
        const rawFields = rows[0].custom_fields;
        const rawCatalog = rows[0].catalog;
        const customFields = typeof rawFields === 'string' ? JSON.parse(rawFields) : (rawFields || []);
        const catalog = typeof rawCatalog === 'string' ? JSON.parse(rawCatalog) : (rawCatalog || []);
        
        await SafeSecureStore.setItemAsync(`custom_fields_${tenantId}`, JSON.stringify(customFields));
        await SafeSecureStore.setItemAsync(`catalog_${tenantId}`, JSON.stringify(catalog));

        return { customFields, catalog };
      }
    } catch (e) {
      console.warn('[HelpDeskService] getTenantCustomFieldsAndCatalog error:', e);
    }
    return { customFields: [], catalog: [] };
  },

  /**
   * Updates tenant custom fields and catalog
   */
  async updateTenantCustomFieldsAndCatalog(
    enterpriseBlindId: string,
    customFields: Array<{ key: string; label: string; required?: boolean }>,
    catalog?: Array<Record<string, string>>
  ): Promise<boolean> {
    try {
      const fieldsJson = JSON.stringify(customFields || []);
      const catalogJson = JSON.stringify(catalog || []);
      await executeSql(`
        UPDATE whitedesk_enterprises 
        SET custom_fields = ${escapeSqlString(fieldsJson)}::jsonb,
            catalog = ${escapeSqlString(catalogJson)}::jsonb
        WHERE enterprise_blind_id = ${escapeSqlString(enterpriseBlindId)};
      `);
      await SafeSecureStore.setItemAsync(`custom_fields_${enterpriseBlindId}`, fieldsJson);
      await SafeSecureStore.setItemAsync(`catalog_${enterpriseBlindId}`, catalogJson);
      return true;
    } catch (e) {
      console.warn('[HelpDeskService] updateTenantCustomFieldsAndCatalog error:', e);
      return false;
    }
  },

  /**
   * Generates a new Admin Operator Hash for a tenant
   */
  async generateNewAdminHash(enterpriseBlindId: string, maxUses: number = 1): Promise<{ success: boolean; hash?: string; message?: string }> {
    try {
      const now = Date.now();
      const randHex = (len: number = 12) => {
        const chars = 'abcdef0123456789';
        let res = '';
        for (let i = 0; i < len; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
        return res;
      };
      const hash = 'adm_oper_' + randHex(16);
      const trialExpiresAt = now + 14 * 24 * 60 * 60 * 1000;
      await executeSql(`
        INSERT INTO whitedesk_recovery_hashes (hash, type, tenant_blind_id, org_id, app_id, max_uses, uses_count, used, expires_at, created_at)
        VALUES (${escapeSqlString(hash)}, 'admin', ${escapeSqlString(enterpriseBlindId)}, 'default', 'inwhite', ${maxUses}, 0, FALSE, ${trialExpiresAt}, ${now});
      `);
      return { success: true, hash };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Hash üretilemedi.' };
    }
  },

  /**
   * Generates a new User Onboarding Hash for a tenant
   */
  async generateNewUserHash(enterpriseBlindId: string, maxUses: number = 25): Promise<{ success: boolean; hash?: string; message?: string }> {
    try {
      const now = Date.now();
      const randHex = (len: number = 12) => {
        const chars = 'abcdef0123456789';
        let res = '';
        for (let i = 0; i < len; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
        return res;
      };
      const hash = 'usr_div_' + randHex(16);
      const trialExpiresAt = now + 14 * 24 * 60 * 60 * 1000;
      await executeSql(`
        INSERT INTO whitedesk_recovery_hashes (hash, type, tenant_blind_id, org_id, app_id, max_uses, uses_count, used, expires_at, created_at)
        VALUES (${escapeSqlString(hash)}, 'user', ${escapeSqlString(enterpriseBlindId)}, 'default', 'inwhite', ${maxUses}, 0, FALSE, ${trialExpiresAt}, ${now});
      `);
      return { success: true, hash };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Hash üretilemedi.' };
    }
  },

  /**
   * Retrieves active operator & user counts for a tenant
   */
  async getTenantStats(enterpriseBlindId: string): Promise<{ adminCount: number; userCount: number }> {
    try {
      const ent = escapeSqlString(enterpriseBlindId);
      const [adminRows, userRows] = await Promise.all([
        executeSql(`SELECT COUNT(*) as cnt FROM whitedesk_admins WHERE enterprise_blind_id = ${ent};`),
        executeSql(`SELECT COUNT(*) as cnt FROM whitedesk_user_bindings WHERE tenant_blind_id = ${ent};`),
      ]);
      return {
        adminCount: Number(adminRows[0]?.cnt || 0),
        userCount: Number(userRows[0]?.cnt || 0),
      };
    } catch {
      return { adminCount: 0, userCount: 0 };
    }
  },

  /**
   * Get / Set custom identity alias ("Kendinizi tanımlayın")
   */
  async getCustomAlias(): Promise<string | null> {
    try {
      return await SafeSecureStore.getItemAsync(STORAGE_KEYS.CUSTOM_ALIAS);
    } catch {
      return null;
    }
  },

  async setCustomAlias(ownWhiteId: string, alias: string, isAdmin: boolean): Promise<void> {
    const cleanAlias = alias.trim();
    if (!cleanAlias) return;
    await SafeSecureStore.setItemAsync(STORAGE_KEYS.CUSTOM_ALIAS, cleanAlias);

    if (isAdmin) {
      const blindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
      await executeSql(`
        UPDATE whitedesk_admins 
        SET alias = ${escapeSqlString(cleanAlias)}
        WHERE white_id = ${escapeSqlString(blindId)} OR white_id = ${escapeSqlString(ownWhiteId)};
      `);
    }
  },

  /**
   * Handles Genesis Admin Claim Command: "admin <key_or_hash>"
   * 
   * Operational Hierarchy:
   *   1. tw_founder_... (TheWhite Founder Hash) -> Instant Zero-Approval Founder restoration (**)
   *   2. TheWhite Enterprise WhiteID           -> Direct Founder activation (**)
   *   3. ga_cosmos_... (Global Admin Hash)     -> Pending Approval drops to TheWhite (*)
   *   4. Tenant WhiteID                        -> Pending Approval drops to TheWhite (*)
   *   5. Admin WhiteID / Hash                  -> Pending Approval drops to tenant Global Admin
   */
  async handleAdminClaimCommand(
    ownWhiteId: string,
    keyOrHashInput: string
  ): Promise<{
    success: boolean;
    alreadyClaimed?: boolean;
    message: string;
    role?: 'founder' | 'global_admin' | 'admin';
    enterpriseName?: string;
    appName?: string;
    orgPub?: string;
    enterpriseBlindId?: string;
    adminBlindId?: string;
  }> {
    try {
      const input = (keyOrHashInput || '').trim();
      if (!input) {
        return { success: false, message: 'Geçersiz anahtar veya hash belirtildi.' };
      }

      const adminBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
      const now = Date.now();

      // ─── CASE 1: TheWhite Founder Recovery Hash (Zero-Approval Root Restore) ───
      if (input.startsWith('tw_founder_')) {
        const hashRows = await executeSql(
          `SELECT * FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)} AND type = 'founder' LIMIT 1;`
        );

        if (hashRows.length === 0) {
          return { success: false, message: 'Geçersiz veya bulunamayan Kurucu (Founder) kurtarma hash\'i.' };
        }

        const hashRecord = hashRows[0];
        if (hashRecord.used) {
          return { success: false, message: 'Bu Kurucu kurtarma hash\'i daha önce kullanılmıştır ve geçersizdir.' };
        }

        // Auto-purge Kurucu hash from DB
        await executeSql(`
          DELETE FROM whitedesk_recovery_hashes 
          WHERE hash = ${escapeSqlString(input)};
        `);

        // Seal TheWhite as Founder in whitedesk_admins
        const founderBlindId = String(hashRecord.tenant_blind_id || 'blind_thewhite_root');
        await executeSql(`
          INSERT INTO whitedesk_admins (white_id, enterprise_blind_id, alias, role, is_active, created_at)
          VALUES (${escapeSqlString(adminBlindId)}, ${escapeSqlString(founderBlindId)}, 'TheWhite', 'founder', TRUE, ${now})
          ON CONFLICT (white_id) DO UPDATE SET 
            enterprise_blind_id = EXCLUDED.enterprise_blind_id,
            role = 'founder',
            alias = 'TheWhite',
            is_active = TRUE;
        `);

        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'founder');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, 'TheWhite Enterprises');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, ownWhiteId);
        invalidateHelpDeskRoleCache();

        return {
          success: true,
          role: 'founder',
          enterpriseName: 'TheWhite Enterprises',
          message: 'TheWhite the Founder (**) kimliğiniz başarıyla geri yüklendi. Tüm kurucu ve sistem yetkileri aktif edilmiştir.',
        };
      }

      // ─── CASE 2: Global Admin Claim Hash (Instant Activation & Auto-Purge) ──────
      if (input.startsWith('ga_cosmos_')) {
        const hashRows = await executeSql(
          `SELECT * FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)} AND type = 'global_admin' LIMIT 1;`
        );

        if (hashRows.length === 0) {
          return { success: false, message: 'Geçersiz veya kullanılmış Global Admin claim hash\'i.' };
        }

        const hashRecord = hashRows[0];
        const targetTenantBlind = String(hashRecord.tenant_blind_id);
        const entRows = await executeSql(
          `SELECT name FROM whitedesk_enterprises WHERE enterprise_blind_id = ${escapeSqlString(targetTenantBlind)} LIMIT 1;`
        );
        const tenantName = entRows[0]?.name ? String(entRows[0].name) : 'Tenant Organization';

        // Direct Activation: Promote immediately to WhiteCosmos Global Admin (*)
        await executeSql(`
          INSERT INTO whitedesk_admins (white_id, enterprise_blind_id, alias, role, is_active, created_at)
          VALUES (${escapeSqlString(adminBlindId)}, ${escapeSqlString(targetTenantBlind)}, 'WhiteCosmos', 'global_admin', TRUE, ${now})
          ON CONFLICT (white_id) DO UPDATE SET 
            enterprise_blind_id = EXCLUDED.enterprise_blind_id,
            role = 'global_admin',
            alias = 'WhiteCosmos',
            is_active = TRUE;
        `);

        // Record approved history in audit queue
        await executeSql(`
          INSERT INTO whitedesk_approvals (
            type, tenant_blind_id, tenant_name, candidate_white_id, candidate_blind_id, candidate_alias, status, requested_at, reviewed_at, reviewed_by
          ) VALUES (
            'global_admin',
            ${escapeSqlString(targetTenantBlind)},
            ${escapeSqlString(tenantName)},
            ${escapeSqlString(ownWhiteId)},
            ${escapeSqlString(adminBlindId)},
            'WhiteCosmos',
            'approved',
            ${now},
            ${now},
            'self_service_claim'
          );
        `);

        // AUTO-PURGE: Single-use global admin hash is deleted from DB
        await executeSql(`
          DELETE FROM whitedesk_recovery_hashes 
          WHERE hash = ${escapeSqlString(input)};
        `);

        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'global_admin');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, ownWhiteId);
        invalidateHelpDeskRoleCache();

        return {
          success: true,
          role: 'global_admin',
          enterpriseName: tenantName,
          message: `'${tenantName}' Global Admin (WhiteCosmos *) yetkiniz aktifleşti. Kurumsal masanız kullanıma hazırdır.`,
        };
      }

      // ─── CASE 2.5: Destek Operatörü Admin Hash (adm_oper_... / Quota Auto-Purge) ───
      if (input.startsWith('adm_oper_')) {
        const hashRows = await executeSql(
          `SELECT * FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)} AND type = 'admin' LIMIT 1;`
        );

        if (hashRows.length === 0) {
          return { success: false, message: 'Geçersiz veya kotası tükenmiş Destek Operatörü hash\'i.' };
        }

        const hashRecord = hashRows[0];
        if (hashRecord.expires_at && Number(hashRecord.expires_at) < now) {
          await executeSql(`DELETE FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)};`);
          return { success: false, message: 'Bu operatör hash\'inin 14 günlük deneme kullanım süresi dolmuştur.' };
        }

        const targetTenantBlind = String(hashRecord.tenant_blind_id);
        const entRows = await executeSql(
          `SELECT name FROM whitedesk_enterprises WHERE enterprise_blind_id = ${escapeSqlString(targetTenantBlind)} LIMIT 1;`
        );
        const tenantName = entRows[0]?.name ? String(entRows[0].name) : 'Tenant Organization';
        const opAlias = await generateCosmoAlias('admin');

        // Promote to Admin Operator
        await executeSql(`
          INSERT INTO whitedesk_admins (white_id, enterprise_blind_id, alias, role, is_active, created_at)
          VALUES (${escapeSqlString(adminBlindId)}, ${escapeSqlString(targetTenantBlind)}, ${escapeSqlString(opAlias)}, 'admin', TRUE, ${now})
          ON CONFLICT (white_id) DO UPDATE SET 
            enterprise_blind_id = EXCLUDED.enterprise_blind_id,
            role = 'admin',
            alias = EXCLUDED.alias,
            is_active = TRUE;
        `);

        // Check quota and auto-purge if seats depleted
        const newUses = Number(hashRecord.uses_count || 0) + 1;
        const maxUses = Number(hashRecord.max_uses || 1);
        if (newUses >= maxUses) {
          await executeSql(`DELETE FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)};`);
        } else {
          await executeSql(`
            UPDATE whitedesk_recovery_hashes 
            SET uses_count = ${newUses}, used_at = ${now}, used_by_blind_id = ${escapeSqlString(adminBlindId)}
            WHERE hash = ${escapeSqlString(input)};
          `);
        }

        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'admin');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, ownWhiteId);
        invalidateHelpDeskRoleCache();

        return {
          success: true,
          role: 'admin',
          enterpriseName: tenantName,
          message: `'${tenantName}' destek ekibine katıldınız. Operatör kimliğiniz (${opAlias}) aktif edildi.`,
        };
      }

      // ─── CASE 3: Enterprise WhiteID (bod_...) from Genesis or Tenant Provisioning ──
      const enterpriseBlindId = WhiteDeskCrypto.generateBlindId(input);

      // Check Genesis Vault
      const vaultRows = await executeSql(
        `SELECT * FROM whitedesk_genesis_vault WHERE enterprise_blind_id = ${escapeSqlString(enterpriseBlindId)} LIMIT 1;`
      );

      if (vaultRows.length > 0) {
        const vault = vaultRows[0];
        const enterpriseName = String(vault.enterprise_name || 'Organization');
        const appName = String(vault.app_name || 'inwhite');
        const orgPub = String(vault.org_pub || '');
        const isFounderTenant = enterpriseName.toLowerCase().includes('thewhite');

        // If it's TheWhite root genesis, activate Founder immediately
        if (isFounderTenant) {
          await executeSql(`
            UPDATE whitedesk_genesis_vault 
            SET claimed = TRUE, claimed_by_blind_id = ${escapeSqlString(adminBlindId)}, claimed_at = ${now}
            WHERE enterprise_blind_id = ${escapeSqlString(enterpriseBlindId)};
          `);

          await executeSql(`
            INSERT INTO whitedesk_admins (white_id, enterprise_blind_id, alias, role, is_active, created_at)
            VALUES (${escapeSqlString(adminBlindId)}, ${escapeSqlString(enterpriseBlindId)}, 'TheWhite', 'founder', TRUE, ${now})
            ON CONFLICT (white_id) DO UPDATE SET 
              enterprise_blind_id = EXCLUDED.enterprise_blind_id, 
              role = 'founder', 
              alias = 'TheWhite',
              is_active = TRUE;
          `);

          await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'founder');
          await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, enterpriseBlindId);
          await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ORG_PUB, orgPub);
          await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, enterpriseName);
          await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, ownWhiteId);

          return {
            success: true,
            role: 'founder',
            enterpriseName,
            appName,
            orgPub,
            enterpriseBlindId,
            adminBlindId,
            message: `Tebrikler. '${enterpriseName}' kurucu lisansörü olarak 'TheWhite the Founder (**)' yetkiniz tescil edilmiştir.`,
          };
        }

        // For other tenants (e.g. Atlas Global Inc.): Approval drops to TheWhite
        await executeSql(`
          INSERT INTO whitedesk_approvals (
            type, tenant_blind_id, tenant_name, candidate_white_id, candidate_blind_id, candidate_alias, status, requested_at
          ) VALUES (
            'global_admin',
            ${escapeSqlString(enterpriseBlindId)},
            ${escapeSqlString(enterpriseName)},
            ${escapeSqlString(ownWhiteId)},
            ${escapeSqlString(adminBlindId)},
            'WhiteCosmos',
            'pending',
            ${now}
          );
        `);

        return {
          success: true,
          enterpriseName,
          appName,
          orgPub,
          enterpriseBlindId,
          adminBlindId,
          message: `'${enterpriseName}' Global Admin adaylığınız alındı. Kurucu TheWhite'ın onayına iletildi. Onaylandıktan sonra WhiteCosmos (*) yetkiniz aktifleşecektir.`,
        };
      }

      // ─── CASE 4: Normal Admin Claim Candidate -> Approval drops to WhiteCosmos ────
      const tenantBlindForAdmin = (await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID)) ||
                                  (await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID)) ||
                                  'default';

      await executeSql(`
        INSERT INTO whitedesk_approvals (
          type, tenant_blind_id, candidate_white_id, candidate_blind_id, candidate_alias, status, requested_at
        ) VALUES (
          'admin',
          ${escapeSqlString(tenantBlindForAdmin)},
          ${escapeSqlString(ownWhiteId)},
          ${escapeSqlString(adminBlindId)},
          'Admin',
          'pending',
          ${now}
        );
      `);

      return {
        success: true,
        message: 'Yönetici adaylığınız alındı. Firmanızın Global Admin (WhiteCosmos) onayı bekleniyor.',
      };
    } catch (err: any) {
      console.warn('[HelpDeskService] handleAdminClaimCommand error:', err);
      return {
        success: false,
        message: `İşlem sırasında veritabanı hatası oluştu: ${err?.message || err}`,
      };
    }
  },

  /**
   * Handles Standalone WhiteDesk User Join Command: "user <hash_or_org_pub>"
   */
  async handleUserJoinCommand(
    ownWhiteId: string,
    keyOrHashInput: string
  ): Promise<{
    success: boolean;
    message: string;
    enterpriseName?: string;
    enterpriseBlindId?: string;
    orgPub?: string;
    appId?: string;
  }> {
    try {
      const input = (keyOrHashInput || '').trim();
      if (!input) {
        return { success: false, message: 'Lütfen geçerli bir organizasyon anahtarı veya kullanıcı hash\'i belirtin.' };
      }

      const userBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
      const now = Date.now();

      // CASE 1: Divisional User Hash (usr_div_...)
      if (input.startsWith('usr_div_')) {
        const hashRows = await executeSql(
          `SELECT * FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)} AND type = 'user' LIMIT 1;`
        );

        if (hashRows.length === 0) {
          return { success: false, message: 'Geçersiz veya bulunamayan kullanıcı hash\'i.' };
        }

        const h = hashRows[0];
        const tenantBlind = String(h.tenant_blind_id);
        const orgId = String(h.org_id || 'default');
        const appId = String(h.app_id || CURRENT_APP_ID);

        const entRows = await executeSql(
          `SELECT name, org_pub FROM whitedesk_enterprises WHERE enterprise_blind_id = ${escapeSqlString(tenantBlind)} LIMIT 1;`
        );
        const tenantName = entRows[0]?.name ? String(entRows[0].name) : 'Tenant Organization';
        const orgPub = entRows[0]?.org_pub ? String(entRows[0].org_pub) : '';

        // Instant Activation for Users: bind directly into whitedesk_user_bindings
        await executeSql(`
          INSERT INTO whitedesk_user_bindings (
            user_blind_id, tenant_blind_id, org_id, app_id, status, created_at
          ) VALUES (
            ${escapeSqlString(userBlindId)},
            ${escapeSqlString(tenantBlind)},
            ${escapeSqlString(orgId)},
            ${escapeSqlString(appId)},
            'approved',
            ${now}
          )
          ON CONFLICT (user_blind_id) DO UPDATE SET
            tenant_blind_id = EXCLUDED.tenant_blind_id,
            org_id = EXCLUDED.org_id,
            app_id = EXCLUDED.app_id,
            status = 'approved';
        `);

        // Record in approvals as pre-approved history
        await executeSql(`
          INSERT INTO whitedesk_approvals (
            type, tenant_blind_id, tenant_name, candidate_white_id, candidate_blind_id, target_org_id, target_app_id, status, requested_at, reviewed_at, reviewed_by
          ) VALUES (
            'user',
            ${escapeSqlString(tenantBlind)},
            ${escapeSqlString(tenantName)},
            ${escapeSqlString(ownWhiteId)},
            ${escapeSqlString(userBlindId)},
            ${escapeSqlString(orgId)},
            ${escapeSqlString(appId)},
            'approved',
            ${now},
            ${now},
            'onboarding_hash'
          );
        `);

        // Check expiration
        if (h.expires_at && Number(h.expires_at) < now) {
          await executeSql(`DELETE FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)};`);
          return { success: false, message: 'Bu kullanıcı hash\'inin 14 günlük kullanım süresi dolmuştur.' };
        }

        // Increment hash usage count and auto-purge if quota exhausted
        const newUses = Number(h.uses_count || 0) + 1;
        const maxUses = Number(h.max_uses || 1);
        if (newUses >= maxUses) {
          await executeSql(`
            DELETE FROM whitedesk_recovery_hashes 
            WHERE hash = ${escapeSqlString(input)};
          `);
        } else {
          await executeSql(`
            UPDATE whitedesk_recovery_hashes 
            SET uses_count = ${newUses}, used_at = ${now}, used_by_blind_id = ${escapeSqlString(userBlindId)}
            WHERE hash = ${escapeSqlString(input)};
          `);
        }

        // Save local enterprise binding
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID, tenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_PUB, orgPub);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME, tenantName);

        return {
          success: true,
          enterpriseName: tenantName,
          enterpriseBlindId: tenantBlind,
          orgPub,
          appId,
          message: `'${tenantName}' kurumsal destek masasına başarıyla bağlandınız. Biletlerinizi anında oluşturabilirsiniz.`,
        };
      }

      // CASE 2: Org Public Key (org_pub)
      let searchBlindId = input;
      let searchPub = input;

      if (!input.startsWith('blind_') && input.length >= 32) {
        searchBlindId = WhiteDeskCrypto.generateBlindId(input);
      }

      let enterpriseRows = await executeSql(
        `SELECT enterprise_blind_id, name, org_pub FROM whitedesk_enterprises 
         WHERE enterprise_blind_id = ${escapeSqlString(searchBlindId)} OR org_pub = ${escapeSqlString(searchPub)} LIMIT 1;`
      );

      if (enterpriseRows.length === 0) {
        enterpriseRows = await executeSql(
          `SELECT enterprise_blind_id, enterprise_name as name, org_pub FROM whitedesk_genesis_vault 
           WHERE enterprise_blind_id = ${escapeSqlString(searchBlindId)} OR org_pub = ${escapeSqlString(searchPub)} LIMIT 1;`
        );
      }

      if (enterpriseRows.length === 0) {
        return {
          success: false,
          message: 'Organizasyon anahtarı bulunamadı. Lütfen yöneticinizden aldığınız geçerli org_pub anahtarını giriniz.',
        };
      }

      const ent = enterpriseRows[0];
      const enterpriseName = String(ent.name || 'Organization');
      const enterpriseBlindId = String(ent.enterprise_blind_id || '');
      const orgPub = String(ent.org_pub || '');

      // Insert pending user approval
      await executeSql(`
        INSERT INTO whitedesk_approvals (
          type, tenant_blind_id, tenant_name, candidate_white_id, candidate_blind_id, status, requested_at
        ) VALUES (
          'user',
          ${escapeSqlString(enterpriseBlindId)},
          ${escapeSqlString(enterpriseName)},
          ${escapeSqlString(ownWhiteId)},
          ${escapeSqlString(userBlindId)},
          'pending',
          ${now}
        );
      `);

      await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID, enterpriseBlindId);
      await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_PUB, orgPub);
      await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME, enterpriseName);

      return {
        success: true,
        enterpriseName,
        enterpriseBlindId,
        orgPub,
        appId: CURRENT_APP_ID,
        message: `'${enterpriseName}' yardım masasına katılma talebiniz yöneticilere iletildi. Onaylandıktan sonra taleplerinizi iletebilirsiniz.`,
      };
    } catch (err: any) {
      console.warn('[HelpDeskService] handleUserJoinCommand error:', err);
      return {
        success: false,
        message: `Bağlantı sırasında bir hata oluştu: ${err?.message || err}`,
      };
    }
  },

  /**
   * Pending Approvals Queue Engine
   */
  async getPendingApprovals(role: string, enterpriseBlindId?: string): Promise<ApprovalEntry[]> {
    try {
      let sql = '';
      if (role === 'founder') {
        // Founder sees pending Global Admin approvals and delete requests across all tenants
        sql = `SELECT * FROM whitedesk_approvals WHERE status = 'pending' ORDER BY requested_at DESC;`;
      } else if (role === 'global_admin') {
        // Cosmos sees pending Admin approvals and delete requests for their tenant
        const filter = enterpriseBlindId ? `AND (tenant_blind_id = ${escapeSqlString(enterpriseBlindId)} OR tenant_blind_id IS NULL)` : '';
        sql = `SELECT * FROM whitedesk_approvals WHERE type IN ('admin', 'delete_app', 'delete_org') ${filter} AND status = 'pending' ORDER BY requested_at DESC;`;
      } else {
        // Admin sees pending User approvals for their tenant
        const filter = enterpriseBlindId ? `AND tenant_blind_id = ${escapeSqlString(enterpriseBlindId)}` : '';
        sql = `SELECT * FROM whitedesk_approvals WHERE type = 'user' ${filter} AND status = 'pending' ORDER BY requested_at DESC;`;
      }

      const rows = await executeSql(sql);
      return rows.map((r) => ({
        id: Number(r.id),
        type: String(r.type) as 'global_admin' | 'admin' | 'user' | 'delete_app' | 'delete_org',
        tenant_blind_id: String(r.tenant_blind_id),
        tenant_name: r.tenant_name ? String(r.tenant_name) : undefined,
        candidate_white_id: r.candidate_white_id ? String(r.candidate_white_id) : undefined,
        candidate_blind_id: String(r.candidate_blind_id),
        candidate_alias: r.candidate_alias ? String(r.candidate_alias) : undefined,
        target_org_id: r.target_org_id ? String(r.target_org_id) : undefined,
        target_app_id: r.target_app_id ? String(r.target_app_id) : undefined,
        status: String(r.status) as 'pending' | 'approved' | 'rejected',
        requested_at: Number(r.requested_at),
        reviewed_at: r.reviewed_at ? Number(r.reviewed_at) : undefined,
        reviewed_by: r.reviewed_by ? String(r.reviewed_by) : undefined,
      }));
    } catch (e) {
      console.warn('[HelpDeskService] getPendingApprovals error:', e);
      return [];
    }
  },

  /**
   * Submits an approval request to Global Admin for deleting an App or Org
   */
  async requestDeletionApproval(
    type: 'delete_app' | 'delete_org',
    targetId: string,
    candidateWhiteId: string,
    tenantBlindId?: string,
    candidateAlias?: string
  ): Promise<boolean> {
    const now = Date.now();
    const cleanTarget = targetId.trim().toLowerCase();
    const entBlind = tenantBlindId && tenantBlindId !== 'all' ? escapeSqlString(tenantBlindId) : 'NULL';
    const cleanCandidate = candidateWhiteId.trim();
    const candidateBlind = WhiteDeskCrypto.generateBlindId(cleanCandidate);
    const aliasVal = candidateAlias ? escapeSqlString(candidateAlias) : 'NULL';
    
    let targetApp = 'NULL';
    let targetOrg = 'NULL';
    if (type === 'delete_app') {
      targetApp = escapeSqlString(cleanTarget);
    } else {
      targetOrg = escapeSqlString(cleanTarget);
    }

    try {
      await executeSql(`
        INSERT INTO whitedesk_approvals (
          type, tenant_blind_id, candidate_white_id, candidate_blind_id, candidate_alias, 
          target_app_id, target_org_id, status, requested_at
        ) VALUES (
          '${type}', ${entBlind}, ${escapeSqlString(cleanCandidate)}, ${escapeSqlString(candidateBlind)}, 
          ${aliasVal}, ${targetApp}, ${targetOrg}, 'pending', ${now}
        );
      `);
      return true;
    } catch (e) {
      console.warn('[HelpDeskService] requestDeletionApproval error:', e);
      return false;
    }
  },

  /**
   * Reviews an approval request: Approve or Reject
   */
  async reviewApproval(approvalId: number, approve: boolean, reviewerWhiteId: string): Promise<boolean> {
    const now = Date.now();
    try {
      const rows = await executeSql(`SELECT * FROM whitedesk_approvals WHERE id = ${approvalId} LIMIT 1;`);
      if (rows.length === 0) return false;

      const app = rows[0];
      const newStatus = approve ? 'approved' : 'rejected';

      await executeSql(`
        UPDATE whitedesk_approvals 
        SET status = '${newStatus}', reviewed_at = ${now}, reviewed_by = ${escapeSqlString(reviewerWhiteId)}
        WHERE id = ${approvalId};
      `);

      if (approve) {
        const candidateBlind = String(app.candidate_blind_id);
        const tenantBlind = String(app.tenant_blind_id);

        if (app.type === 'global_admin') {
          // Promote to WhiteCosmos Global Admin (*)
          await executeSql(`
            INSERT INTO whitedesk_admins (white_id, enterprise_blind_id, alias, role, is_active, created_at)
            VALUES (${escapeSqlString(candidateBlind)}, ${escapeSqlString(tenantBlind)}, 'WhiteCosmos', 'global_admin', TRUE, ${now})
            ON CONFLICT (white_id) DO UPDATE SET 
              enterprise_blind_id = EXCLUDED.enterprise_blind_id,
              role = 'global_admin',
              alias = 'WhiteCosmos',
              is_active = TRUE;
          `);
          const defaultOrgId = 'merkez_' + tenantBlind.slice(-6);
          await executeSql(`
            INSERT INTO whitedesk_admin_alloc (admin_white_id, enterprise_blind_id, org_id, app_id, categories, updated_at)
            VALUES (${escapeSqlString(candidateBlind)}, ${escapeSqlString(tenantBlind)}, ${escapeSqlString(defaultOrgId)}, 'inwhite', '["all"]', ${now});
          `);
        } else if (app.type === 'admin') {
          // Promote to Admin
          const alias = app.candidate_alias || (await generateCosmoAlias('admin'));
          await executeSql(`
            INSERT INTO whitedesk_admins (white_id, enterprise_blind_id, alias, role, is_active, created_at)
            VALUES (${escapeSqlString(candidateBlind)}, ${escapeSqlString(tenantBlind)}, ${escapeSqlString(alias)}, 'admin', TRUE, ${now})
            ON CONFLICT (white_id) DO UPDATE SET 
              enterprise_blind_id = EXCLUDED.enterprise_blind_id,
              role = 'admin',
              alias = EXCLUDED.alias,
              is_active = TRUE;
          `);
        } else if (app.type === 'user') {
          // Seal User Binding
          await executeSql(`
            INSERT INTO whitedesk_user_bindings (user_blind_id, tenant_blind_id, org_id, app_id, alias, status, created_at)
            VALUES (${escapeSqlString(candidateBlind)}, ${escapeSqlString(tenantBlind)}, ${escapeSqlString(app.target_org_id || 'default')}, ${escapeSqlString(app.target_app_id || CURRENT_APP_ID)}, ${escapeSqlString(app.candidate_alias || 'User')}, 'approved', ${now})
            ON CONFLICT (user_blind_id) DO UPDATE SET status = 'approved';
          `);
        } else if (app.type === 'delete_app') {
          if (app.target_app_id) {
            await this.removeApp(String(app.target_app_id));
          }
        } else if (app.type === 'delete_org') {
          if (app.target_org_id) {
            await this.removeOrganization(String(app.target_org_id));
          }
        }
      }

      return true;
    } catch (e) {
      console.warn('[HelpDeskService] reviewApproval error:', e);
      return false;
    }
  },

  /**
   * Registers/claims Admin status in whitedesk_admins
   */
  async claimAdmin(ownWhiteId: string, adminKey: string): Promise<boolean> {
    if (!adminKey || !adminKey.trim()) return false;
    await this.setSavedAdminKey(adminKey);
    await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, ownWhiteId);
    await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'admin');
    const now = Date.now();

    const blindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
    const masterAlias = await generateCosmoAlias('master');

    await executeSql(`
      INSERT INTO whitedesk_admins (white_id, alias, role, is_active, created_at)
      VALUES (${escapeSqlString(blindId)}, ${escapeSqlString(masterAlias)}, 'global_admin', true, ${now})
      ON CONFLICT (white_id) DO UPDATE SET role = 'global_admin', is_active = true;
    `);

    return true;
  },

  /**
   * Retrieves registered Admin WhiteID from Neon whitedesk_admins, with fallback.
   */
  async getAdminWhiteId(): Promise<string> {
    try {
      const rows = await executeSql(`SELECT white_id FROM whitedesk_admins WHERE role = 'founder' OR role = 'master' LIMIT 1;`);
      if (rows.length > 0 && rows[0]?.white_id) {
        return String(rows[0].white_id).trim();
      }
    } catch (e) {
      console.warn('[HelpDeskService] Failed to get admin_white_id:', e);
    }
    return '0362bed5a6ce744fe353a166dd478879bd480725615396d9976973bb396aa5989a';
  },

  /**
   * Ensures the database schema has the required tables and initial seed data.
   * Idempotent: Checks if tables exist. If missing, creates everything in one go. If present, continues smoothly.
   */
  async ensureSchema(): Promise<void> {
    try {
      const checkRows = await executeSql("SELECT to_regclass('public.whitedesk_tickets') as tbl;");
      if (checkRows.length > 0 && checkRows[0]?.tbl) {
        // Tablolar zaten mevcut, işlem yapmadan devam et
        return;
      }

      await executeSql(`
        CREATE TABLE IF NOT EXISTS whitedesk_enterprises (
            enterprise_blind_id VARCHAR(128) PRIMARY KEY,
            name VARCHAR(128) NOT NULL,
            org_pub TEXT,
            is_founder_tenant BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS whitedesk_apps (
            app_id VARCHAR(64) PRIMARY KEY,
            enterprise_blind_id VARCHAR(128) DEFAULT 'default',
            name VARCHAR(128) NOT NULL,
            description TEXT,
            icon VARCHAR(64) DEFAULT 'Layers',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS whitedesk_orgs (
            org_id VARCHAR(64) PRIMARY KEY,
            enterprise_blind_id VARCHAR(128) DEFAULT 'default',
            name VARCHAR(128) NOT NULL,
            public_key TEXT,
            created_by VARCHAR(128),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS whitedesk_categories (
            category_id VARCHAR(64) PRIMARY KEY,
            enterprise_blind_id VARCHAR(128) DEFAULT 'default',
            org_id VARCHAR(64) NOT NULL DEFAULT 'default',
            app_id VARCHAR(64) NOT NULL DEFAULT 'all',
            name_tr VARCHAR(128) NOT NULL,
            name_en VARCHAR(128) NOT NULL,
            icon VARCHAR(64) DEFAULT 'HelpCircle',
            sort_order INT DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS whitedesk_tickets (
            id VARCHAR(32) PRIMARY KEY,
            enterprise_blind_id VARCHAR(128),
            org_id VARCHAR(64) NOT NULL DEFAULT 'default',
            app_id VARCHAR(64) NOT NULL DEFAULT 'inwhite',
            user_white_id VARCHAR(128),
            user_blind_id VARCHAR(128) NOT NULL,
            user_pubkey TEXT,
            ticket_pubkey TEXT,
            subject TEXT NOT NULL,
            category VARCHAR(64) NOT NULL DEFAULT 'general',
            payload TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'open',
            is_discussion BOOLEAN DEFAULT FALSE,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS whitedesk_ticket_messages (
            id VARCHAR(64) PRIMARY KEY,
            ticket_id VARCHAR(32) NOT NULL,
            app_id VARCHAR(64) NOT NULL DEFAULT 'inwhite',
            sender_white_id VARCHAR(128) NOT NULL,
            sender_alias VARCHAR(64),
            sender_blind_id VARCHAR(128),
            is_admin BOOLEAN DEFAULT FALSE,
            message TEXT NOT NULL,
            attachment_data TEXT,
            attachment_name VARCHAR(255),
            attachment_type VARCHAR(32),
            created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS whitedesk_admins (
            id SERIAL PRIMARY KEY,
            white_id VARCHAR(128) UNIQUE NOT NULL,
            enterprise_blind_id VARCHAR(128) DEFAULT 'default',
            alias VARCHAR(64) NOT NULL,
            role VARCHAR(32) NOT NULL DEFAULT 'admin',
            pub_key TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            granted_by VARCHAR(128),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS whitedesk_admin_alloc (
            id SERIAL PRIMARY KEY,
            admin_white_id VARCHAR(128) NOT NULL,
            enterprise_blind_id VARCHAR(128) DEFAULT 'default',
            org_id VARCHAR(64) NOT NULL DEFAULT 'default',
            app_id VARCHAR(64) NOT NULL DEFAULT 'all',
            category_id VARCHAR(64) NOT NULL DEFAULT 'all',
            categories TEXT,
            ed25519_sig TEXT,
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_admin_alloc UNIQUE (admin_white_id, enterprise_blind_id, org_id, app_id, category_id)
        );

        CREATE TABLE IF NOT EXISTS whitedesk_approvals (
            id SERIAL PRIMARY KEY,
            type VARCHAR(64) NOT NULL,
            tenant_blind_id VARCHAR(128) NOT NULL DEFAULT 'default',
            candidate_white_id VARCHAR(128),
            candidate_blind_id VARCHAR(128),
            candidate_alias VARCHAR(64),
            target_org_id VARCHAR(64),
            target_app_id VARCHAR(64),
            target_categories TEXT,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            requested_at TIMESTAMPTZ DEFAULT NOW(),
            reviewed_at TIMESTAMPTZ,
            reviewed_by VARCHAR(128)
        );

        CREATE TABLE IF NOT EXISTS whitedesk_user_bindings (
            id SERIAL PRIMARY KEY,
            user_blind_id VARCHAR(128) NOT NULL,
            tenant_blind_id VARCHAR(128) NOT NULL DEFAULT 'default',
            org_id VARCHAR(64) NOT NULL DEFAULT 'default',
            app_id VARCHAR(64) NOT NULL DEFAULT 'all',
            alias VARCHAR(64),
            status VARCHAR(32) DEFAULT 'active',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_user_binding UNIQUE (user_blind_id, tenant_blind_id, org_id)
        );

        CREATE TABLE IF NOT EXISTS whitedesk_genesis_vault (
            enterprise_blind_id VARCHAR(128) PRIMARY KEY,
            claimed_by_blind_id VARCHAR(128),
            claimed_by_white_id VARCHAR(128),
            vault_payload TEXT,
            is_claimed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS whitedesk_recovery_hashes (
            hash VARCHAR(128) PRIMARY KEY,
            type VARCHAR(32) NOT NULL,
            enterprise_blind_id VARCHAR(128),
            is_claimed BOOLEAN DEFAULT FALSE,
            claimed_by VARCHAR(128),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS whitedesk_app_requests (
            id SERIAL PRIMARY KEY,
            app_id VARCHAR(64) NOT NULL,
            app_name VARCHAR(128) NOT NULL,
            description TEXT,
            requestor_id VARCHAR(128),
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS whitedesk_app_cat (
            id SERIAL PRIMARY KEY,
            app_id VARCHAR(64) NOT NULL,
            category_id VARCHAR(64) NOT NULL,
            label_tr VARCHAR(255),
            label_en VARCHAR(255),
            icon VARCHAR(64),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_app_category UNIQUE (app_id, category_id)
        );

        CREATE INDEX IF NOT EXISTS idx_whitedesk_tickets_user ON whitedesk_tickets(user_blind_id);
        CREATE INDEX IF NOT EXISTS idx_whitedesk_tickets_app_org ON whitedesk_tickets(app_id, org_id);
        CREATE INDEX IF NOT EXISTS idx_whitedesk_tickets_status ON whitedesk_tickets(status);
        CREATE INDEX IF NOT EXISTS idx_whitedesk_tickets_updated ON whitedesk_tickets(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_whitedesk_msgs_ticket ON whitedesk_ticket_messages(ticket_id);
        CREATE INDEX IF NOT EXISTS idx_whitedesk_admin_alloc ON whitedesk_admin_alloc(admin_white_id);
        CREATE INDEX IF NOT EXISTS idx_whitedesk_approvals_status ON whitedesk_approvals(status);

        INSERT INTO whitedesk_enterprises (enterprise_blind_id, name, is_founder_tenant)
        VALUES ('default', 'Whitechain Foundation', TRUE)
        ON CONFLICT (enterprise_blind_id) DO NOTHING;

        INSERT INTO whitedesk_apps (app_id, enterprise_blind_id, name, description, icon)
        VALUES 
            ('inwhite', 'default', 'inWhite Voice & Core', 'P2P ve Cloud TLS gizli iletişim protokolü', 'Phone'),
            ('whitedesk', 'default', 'WhiteDesk Operations', 'Merkezi Yönetim ve Yetkilendirme Masası', 'Headphones')
        ON CONFLICT (app_id) DO NOTHING;

        INSERT INTO whitedesk_orgs (org_id, enterprise_blind_id, name)
        VALUES 
            ('default', 'default', 'Genel Merkez / Genel Kurum'),
            ('*', 'default', 'Tüm Organizasyonlar (Kozmik Kapsam)')
        ON CONFLICT (org_id) DO NOTHING;

        INSERT INTO whitedesk_categories (category_id, enterprise_blind_id, org_id, app_id, name_tr, name_en, icon, sort_order)
        VALUES 
            ('voice', 'default', 'default', 'all', 'Ses & Görüşme', 'Audio & Calls', 'Phone', 1),
            ('security', 'default', 'default', 'all', 'Ağ & Güvenlik', 'Network & Security', 'Shield', 2),
            ('account', 'default', 'default', 'all', 'Hesap & whiteID', 'Account & whiteID', 'User', 3),
            ('general', 'default', 'default', 'all', 'Genel Destek', 'General Support', 'HelpCircle', 4)
        ON CONFLICT (category_id) DO NOTHING;
      `);
    } catch (err) {
      console.warn('[HelpDeskService] ensureSchema error:', err);
    }
  },

  /**
   * Checks the registration status of an app_id in Neon.
   * Returns: 'registered' | 'pending' | 'rejected' | 'unregistered'
   */
  async checkAppRegistration(appId: string): Promise<AppRegStatus> {
    const cleanApp = appId.trim().toLowerCase();
    try {
      // 1. Check whitedesk_apps (approved/active apps)
      const catRows = await executeSql(
        `SELECT app_id FROM whitedesk_apps WHERE app_id = ${escapeSqlString(cleanApp)} LIMIT 1;`
      );
      if (catRows.length > 0) return 'registered';

      // 2. Check whitedesk_app_requests for pending/rejected
      const reqRows = await executeSql(
        `SELECT status FROM whitedesk_app_requests WHERE app_id = ${escapeSqlString(cleanApp)} LIMIT 1;`
      );
      if (reqRows.length > 0) {
        const s = String(reqRows[0].status || 'pending');
        if (s === 'pending') return 'pending';
        if (s === 'rejected') return 'rejected';
        if (s === 'approved') return 'registered'; // approved but app_cat missing → treat as registered
      }
    } catch (e) {
      console.warn('[HelpDeskService] checkAppRegistration error:', e);
    }
    return 'unregistered';
  },

  /**
   * Submits a new app registration request.
   * Called from the provisioning console when the app is not yet registered.
   */
  async requestAppRegistration(
    appId: string,
    appName: string,
    requestorWhiteId: string,
    description: string = ''
  ): Promise<boolean> {
    const cleanApp = appId.trim().toLowerCase();
    const now = Date.now();
    try {
      await executeSql(`
        INSERT INTO whitedesk_app_requests (app_id, app_name, description, requestor_id, status, created_at)
        VALUES (
          ${escapeSqlString(cleanApp)},
          ${escapeSqlString(appName.trim())},
          ${escapeSqlString(description.trim())},
          ${escapeSqlString(requestorWhiteId.trim())},
          'pending',
          ${now}
        )
        ON CONFLICT (app_id) DO UPDATE
          SET app_name = EXCLUDED.app_name,
              description = EXCLUDED.description,
              status = 'pending',
              created_at = EXCLUDED.created_at;
      `);
      return true;
    } catch (e) {
      console.warn('[HelpDeskService] requestAppRegistration error:', e);
      return false;
    }
  },

  /**
   * Fetches all pending app registration requests. (Master-only)
   */
  async getPendingAppRequests(): Promise<AppRequestEntry[]> {
    try {
      const rows = await executeSql(
        `SELECT id, app_id, app_name, description, requestor_id, status, created_at, reviewed_at, reviewed_by
         FROM whitedesk_app_requests
         WHERE status = 'pending'
         ORDER BY created_at ASC;`
      );
      return rows.map(r => ({
        id: Number(r.id),
        app_id: String(r.app_id),
        app_name: String(r.app_name || r.app_id),
        description: String(r.description || ''),
        requestor_id: String(r.requestor_id),
        status: String(r.status || 'pending') as 'pending' | 'approved' | 'rejected',
        created_at: Number(r.created_at),
        reviewed_at: r.reviewed_at ? Number(r.reviewed_at) : undefined,
        reviewed_by: r.reviewed_by ? String(r.reviewed_by) : undefined,
      }));
    } catch (e) {
      console.warn('[HelpDeskService] getPendingAppRequests error:', e);
      return [];
    }
  },

  /**
   * Approves an app registration request. (Master-only)
   * Inserts into whitedesk_app_cat with empty categories.
   */
  async approveAppRequest(appId: string, reviewerWhiteId: string): Promise<boolean> {
    const cleanApp = appId.trim().toLowerCase();
    const now = Date.now();
    try {
      // Mark as approved
      await executeSql(`
        UPDATE whitedesk_app_requests
        SET status = 'approved', reviewed_at = ${now}, reviewed_by = ${escapeSqlString(reviewerWhiteId)}
        WHERE app_id = ${escapeSqlString(cleanApp)};
      `);
      // Activate in whitedesk_apps
      await executeSql(`
        INSERT INTO whitedesk_apps (app_id, name, is_active, created_at)
        VALUES (${escapeSqlString(cleanApp)}, ${escapeSqlString(cleanApp)}, TRUE, ${now})
        ON CONFLICT (app_id) DO UPDATE SET is_active = TRUE;
      `);
      return true;
    } catch (e) {
      console.warn('[HelpDeskService] approveAppRequest error:', e);
      return false;
    }
  },

  /**
   * Rejects an app registration request. (Master-only)
   */
  async rejectAppRequest(appId: string, reviewerWhiteId: string): Promise<boolean> {
    const cleanApp = appId.trim().toLowerCase();
    const now = Date.now();
    try {
      await executeSql(`
        UPDATE whitedesk_app_requests
        SET status = 'rejected', reviewed_at = ${now}, reviewed_by = ${escapeSqlString(reviewerWhiteId)}
        WHERE app_id = ${escapeSqlString(cleanApp)};
      `);
      return true;
    } catch (e) {
      console.warn('[HelpDeskService] rejectAppRequest error:', e);
      return false;
    }
  },


  /**
   * Fetches registered apps and their categories from whitedesk_apps and whitedesk_categories
   */
  async getAppCatList(tenantBlindId?: string): Promise<AppCatEntry[]> {
    try {
      let query = `SELECT app_id, enterprise_blind_id, name, icon, is_active, created_at FROM whitedesk_apps`;
      if (tenantBlindId && tenantBlindId !== 'all') {
        query += ` WHERE (enterprise_blind_id = ${escapeSqlString(tenantBlindId)} OR enterprise_blind_id IS NULL)`;
      }
      query += ` ORDER BY app_id ASC;`;
      const rows = await executeSql(query);
      if (rows.length > 0) {
        const catRows = await executeSql(`SELECT category_id, org_id, app_id, name_tr, name_en, icon FROM whitedesk_categories WHERE is_active = true;`);
        const catsByApp: Record<string, HelpDeskCategory[]> = {};
        for (const c of catRows) {
          const appKey = c.app_id || 'inwhite';
          if (!catsByApp[appKey]) catsByApp[appKey] = [];
          catsByApp[appKey].push({
            id: String(c.category_id),
            key: String(c.category_id),
            labelTr: String(c.name_tr),
            labelEn: String(c.name_en),
            icon: String(c.icon || 'HelpCircle'),
            org_id: c.org_id ? String(c.org_id) : undefined,
            app_id: c.app_id ? String(c.app_id) : undefined,
          });
        }
        return rows.map(r => ({
          app_id: String(r.app_id),
          name: String(r.name || r.app_id),
          enterprise_blind_id: r.enterprise_blind_id ? String(r.enterprise_blind_id) : undefined,
          categories: catsByApp[String(r.app_id)] || INWHITE_CATEGORIES,
          updated_at: Number(r.created_at || Date.now()),
        }));
      }
    } catch (e) {
      console.warn('[HelpDeskService] getAppCatList error:', e);
    }
    return [{
      app_id: 'inwhite',
      name: 'inWhite Telecom',
      categories: INWHITE_CATEGORIES,
      updated_at: Date.now(),
    }];
  },

  /**
   * Gets categories for a specific app_id (including universal/global categories)
   */
  async getAppCategories(appId: string = CURRENT_APP_ID): Promise<HelpDeskCategory[]> {
    const cleanApp = (appId || CURRENT_APP_ID).trim().toLowerCase();
    if (_categoryCache[cleanApp]) return _categoryCache[cleanApp];
    try {
      const rows = await executeSql(`
        SELECT category_id, org_id, app_id, name_tr, name_en, icon 
        FROM whitedesk_categories 
        WHERE (app_id = ${escapeSqlString(cleanApp)} OR (app_id IS NULL AND org_id IS NULL)) 
          AND is_active = true 
        ORDER BY created_at ASC;
      `);
      if (rows.length > 0) {
        const cats: HelpDeskCategory[] = rows.map(r => ({
          id: String(r.category_id),
          key: String(r.category_id),
          labelTr: String(r.name_tr),
          labelEn: String(r.name_en),
          icon: String(r.icon || 'HelpCircle'),
          org_id: r.org_id ? String(r.org_id) : undefined,
          app_id: r.app_id ? String(r.app_id) : undefined,
        }));
        _categoryCache[cleanApp] = cats;
        return cats;
      }
    } catch (e) {
      console.warn('[HelpDeskService] getAppCategories error:', e);
    }
    _categoryCache[cleanApp] = INWHITE_CATEGORIES;
    return INWHITE_CATEGORIES;
  },

  /**
   * Multi-dimensional category resolver: resolves categories for org, app, or enterprise scope
   */
  async getCategories(options?: { enterpriseBlindId?: string; orgId?: string | null; appId?: string | null }): Promise<HelpDeskCategory[]> {
    try {
      const conditions: string[] = ['is_active = true'];
      if (options?.enterpriseBlindId && options.enterpriseBlindId !== 'all') {
        conditions.push(`(enterprise_blind_id = ${escapeSqlString(options.enterpriseBlindId)} OR enterprise_blind_id IS NULL)`);
      }
      if (options?.orgId && options.orgId !== '*' && options.orgId !== 'all') {
        conditions.push(`(org_id = ${escapeSqlString(options.orgId)} OR (org_id IS NULL AND app_id IS NULL))`);
      } else if (options?.appId && options.appId !== '*' && options.appId !== 'all') {
        conditions.push(`(app_id = ${escapeSqlString(options.appId)} OR (app_id IS NULL AND org_id IS NULL))`);
      }
      const sql = `SELECT category_id, org_id, app_id, name_tr, name_en, icon FROM whitedesk_categories WHERE ${conditions.join(' AND ')} ORDER BY created_at ASC;`;
      const rows = await executeSql(sql);
      if (rows.length > 0) {
        return rows.map(r => ({
          id: String(r.category_id),
          key: String(r.category_id),
          labelTr: String(r.name_tr),
          labelEn: String(r.name_en),
          icon: String(r.icon || 'HelpCircle'),
          org_id: r.org_id ? String(r.org_id) : undefined,
          app_id: r.app_id ? String(r.app_id) : undefined,
        }));
      }
    } catch (e) {
      console.warn('[HelpDeskService] getCategories error:', e);
    }
    return INWHITE_CATEGORIES;
  },

  /**
   * Adds or registers a new app in whitedesk_apps
   */
  async addApp(appId: string, name?: string, enterpriseBlindId?: string): Promise<boolean> {
    const cleanAppId = appId.trim().toLowerCase();
    if (!cleanAppId) return false;
    const cleanName = (name || cleanAppId).trim();
    const entBlind = enterpriseBlindId ? escapeSqlString(enterpriseBlindId) : 'NULL';
    const now = Date.now();
    await executeSql(`
      INSERT INTO whitedesk_apps (app_id, enterprise_blind_id, name, icon, is_active, created_at)
      VALUES (${escapeSqlString(cleanAppId)}, ${entBlind}, ${escapeSqlString(cleanName)}, 'AppWindow', TRUE, ${now})
      ON CONFLICT (app_id) DO UPDATE SET is_active = TRUE, name = EXCLUDED.name;
    `);
    return true;
  },

  /**
   * Adds a category to whitedesk_categories
   */
  async addCategoryToApp(appId: string, category: HelpDeskCategory, orgId?: string, enterpriseBlindId?: string): Promise<boolean> {
    const cleanApp = appId.trim().toLowerCase();
    const catId = category.id || `${cleanApp}_${category.key}`;
    const cleanOrg = orgId ? escapeSqlString(orgId.trim()) : 'NULL';
    const entBlind = enterpriseBlindId ? escapeSqlString(enterpriseBlindId) : 'NULL';
    const now = Date.now();
    await executeSql(`
      INSERT INTO whitedesk_categories (category_id, enterprise_blind_id, org_id, app_id, name_tr, name_en, icon, is_active, created_at)
      VALUES (${escapeSqlString(catId)}, ${entBlind}, ${cleanOrg}, ${escapeSqlString(cleanApp)}, ${escapeSqlString(category.labelTr)}, ${escapeSqlString(category.labelEn)}, ${escapeSqlString(category.icon || 'HelpCircle')}, TRUE, ${now})
      ON CONFLICT (category_id) DO UPDATE SET name_tr = EXCLUDED.name_tr, name_en = EXCLUDED.name_en, icon = EXCLUDED.icon, is_active = TRUE;
    `);
    delete _categoryCache[cleanApp];
    return true;
  },

  /**
   * Removes a category from whitedesk_categories
   */
  async removeCategoryFromApp(appId: string, categoryId: string): Promise<boolean> {
    return this.deleteCategory(categoryId, appId);
  },

  /**
   * Deletes a category from whitedesk_categories (both global and app-specific)
   */
  async deleteCategory(categoryId: string, appId?: string): Promise<boolean> {
    const cleanCat = categoryId.trim();
    let sql = `DELETE FROM whitedesk_categories WHERE category_id = ${escapeSqlString(cleanCat)}`;
    if (appId && appId !== 'all') {
      sql += ` OR (app_id = ${escapeSqlString(appId.trim().toLowerCase())} AND category_id = ${escapeSqlString(cleanCat)})`;
    }
    sql += `;`;
    await executeSql(sql);
    if (appId && appId !== 'all') {
      delete _categoryCache[appId.trim().toLowerCase()];
    } else {
      for (const k of Object.keys(_categoryCache)) {
        delete _categoryCache[k];
      }
    }
    return true;
  },

  /**
   * Kaydetmeden önce önerilen alias'ı döner (kullanıcı değiştirebilir)
   * role: 'master' → 'TheWhite' / 'WhiteCosmos'
   * role: 'operator' → 'Planet-1' vb.
   */
  async suggestAdminAlias(role: string = 'operator'): Promise<string> {
    return generateCosmoAlias(role);
  },

  /**
   * Fetches registered admins (supports tenant filtering and hierarchy sorting)
   */
  async getAdminsList(tenantBlindId?: string): Promise<AdminEntry[]> {
    try {
      let query = `
        SELECT a.white_id, a.enterprise_blind_id, a.alias, a.role, a.is_active, a.created_at, e.name as enterprise_name
        FROM whitedesk_admins a
        LEFT JOIN whitedesk_enterprises e ON a.enterprise_blind_id = e.enterprise_blind_id
      `;
      if (tenantBlindId && tenantBlindId !== 'all') {
        query += ` WHERE a.enterprise_blind_id = ${escapeSqlString(tenantBlindId)}`;
      }
      query += ` ORDER BY 
        CASE 
          WHEN a.role IN ('founder', 'master') OR LOWER(a.alias) = 'thewhite' THEN 0 
          WHEN a.role = 'global_admin' OR LOWER(a.alias) LIKE '%whitecosmos%' OR LOWER(a.alias) LIKE '%global admin%' THEN 1 
          ELSE 2 
        END, a.created_at ASC;`;
      const rows = await executeSql(query);
      return rows.map(r => ({
        white_id: String(r.white_id),
        enterprise_blind_id: r.enterprise_blind_id ? String(r.enterprise_blind_id) : undefined,
        enterprise_name: r.enterprise_name ? String(r.enterprise_name) : undefined,
        alias: String(r.alias || 'Admin'),
        role: String(r.role || 'operator'),
        is_active: Boolean(r.is_active),
        created_at: Number(r.created_at || Date.now()),
      }));
    } catch (e) {
      console.warn('[HelpDeskService] getAdminsList error:', e);
      return [];
    }
  },

  /**
   * Adds or registers an admin in whitedesk_admins.
   * Alias boş bırakılırsa otomatik kurumsal Planet ismi atanır (Planet-1, Planet-2 …)
   */
  async addAdmin(whiteId: string, alias: string = '', role: string = 'operator', enterpriseBlindId?: string): Promise<boolean> {
    const cleanId = whiteId.trim();
    if (!cleanId) return false;
    const now = Date.now();

    // Alias yoksa ya da jenerik bir isimse → otomatik yıldız ismi ata
    const genericAliases = ['', 'admin', 'Admin', 'master admin', 'Master Admin', 'bu cihaz (master)', 'this device (master)'];
    let resolvedAlias = alias.trim();
    if (!resolvedAlias || genericAliases.includes(resolvedAlias.toLowerCase())) {
      resolvedAlias = await generateCosmoAlias(role);
    }

    const entVal = enterpriseBlindId ? escapeSqlString(enterpriseBlindId) : 'NULL';

    await executeSql(`
      INSERT INTO whitedesk_admins (white_id, enterprise_blind_id, alias, role, is_active, created_at)
      VALUES (${escapeSqlString(cleanId)}, ${entVal}, ${escapeSqlString(resolvedAlias)}, ${escapeSqlString(role)}, true, ${now})
      ON CONFLICT (white_id) DO UPDATE SET 
        enterprise_blind_id = COALESCE(EXCLUDED.enterprise_blind_id, whitedesk_admins.enterprise_blind_id),
        alias = EXCLUDED.alias, 
        is_active = true;
    `);
    return true;
  },

  /**
   * Removes an admin from whitedesk_admins and whitedesk_admin_alloc
   */
  async removeAdmin(whiteId: string): Promise<boolean> {
    const cleanId = whiteId.trim();
    await executeSql(`DELETE FROM whitedesk_admins WHERE white_id = ${escapeSqlString(cleanId)};`);
    await executeSql(`DELETE FROM whitedesk_admin_alloc WHERE admin_white_id = ${escapeSqlString(cleanId)};`);
    return true;
  },

  /**
   * Fetches registered organizations (supports tenant filtering)
   */
  async getOrgsList(tenantBlindId?: string): Promise<OrgEntry[]> {
    try {
      let query = `SELECT org_id, enterprise_blind_id, name, created_at FROM whitedesk_orgs`;
      if (tenantBlindId && tenantBlindId !== 'all') {
        query += ` WHERE enterprise_blind_id = ${escapeSqlString(tenantBlindId)}`;
      }
      query += ` ORDER BY org_id ASC;`;
      const rows = await executeSql(query);
      if (rows.length > 0) {
        return rows.map(r => ({
          org_id: String(r.org_id),
          enterprise_blind_id: r.enterprise_blind_id ? String(r.enterprise_blind_id) : undefined,
          name: String(r.name),
          created_at: Number(r.created_at || Date.now()),
        }));
      }
    } catch (e) {
      console.warn('[HelpDeskService] getOrgsList error:', e);
    }
    return [
      { org_id: 'default', name: 'Default Org', created_at: Date.now() },
      { org_id: 'thewhite', name: 'TheWhite', created_at: Date.now() },
    ];
  },

  /**
   * Adds a new organization (Cosmos level)
   */
  async addOrganization(orgId: string, name: string): Promise<boolean> {
    const cleanId = orgId.trim().toLowerCase();
    const cleanName = name.trim() || cleanId;
    if (!cleanId) return false;
    const now = Date.now();
    await executeSql(`
      INSERT INTO whitedesk_orgs (org_id, name, created_at)
      VALUES (${escapeSqlString(cleanId)}, ${escapeSqlString(cleanName)}, ${now})
      ON CONFLICT (org_id) DO UPDATE SET name = EXCLUDED.name;
    `);
    return true;
  },

  /**
   * Removes an organization (Cosmos level)
   */
  async removeOrganization(orgId: string): Promise<boolean> {
    const cleanId = orgId.trim().toLowerCase();
    if (cleanId === 'default' || cleanId === 'thewhite') return false;
    await executeSql(`DELETE FROM whitedesk_orgs WHERE org_id = ${escapeSqlString(cleanId)};`);
    await executeSql(`DELETE FROM whitedesk_admin_alloc WHERE org_id = ${escapeSqlString(cleanId)};`);
    return true;
  },

  /**
   * Removes an application from whitedesk_apps, whitedesk_categories and admin allocations
   */
  async removeApp(appId: string): Promise<boolean> {
    const cleanId = appId.trim().toLowerCase();
    if (cleanId === 'inwhite') return false;
    await executeSql(`DELETE FROM whitedesk_apps WHERE app_id = ${escapeSqlString(cleanId)};`);
    await executeSql(`DELETE FROM whitedesk_categories WHERE app_id = ${escapeSqlString(cleanId)};`);
    await executeSql(`DELETE FROM whitedesk_admin_alloc WHERE app_id = ${escapeSqlString(cleanId)};`);
    delete _categoryCache[cleanId];
    return true;
  },

  /**
   * Saves allocation for an admin: Scope Matrix (enterprise, org, app, category)
   */
  async saveAdminAlloc(
    adminWhiteId: string, 
    orgId: string = '*', 
    appId: string = '*', 
    categories: string[] = ['all'],
    enterpriseBlindId?: string,
    categoryId: string = '*'
  ): Promise<boolean> {
    const cleanId = adminWhiteId.trim();
    const cleanOrg = orgId.trim().toLowerCase() || '*';
    const cleanApp = appId.trim().toLowerCase() || '*';
    const cleanCat = categoryId.trim() || '*';
    const now = Date.now();
    const catList = categories.length > 0 ? categories : ['all'];
    const catJson = JSON.stringify(catList).replace(/'/g, "''");
    const entBlind = enterpriseBlindId ? escapeSqlString(enterpriseBlindId) : 'NULL';

    await executeSql(`DELETE FROM whitedesk_admin_alloc WHERE admin_white_id = ${escapeSqlString(cleanId)} AND org_id = ${escapeSqlString(cleanOrg)} AND app_id = ${escapeSqlString(cleanApp)};`);
    await executeSql(`
      INSERT INTO whitedesk_admin_alloc (admin_white_id, enterprise_blind_id, org_id, app_id, category_id, categories, updated_at)
      VALUES (${escapeSqlString(cleanId)}, ${entBlind}, ${escapeSqlString(cleanOrg)}, ${escapeSqlString(cleanApp)}, ${escapeSqlString(cleanCat)}, '${catJson}', ${now});
    `);
    return true;
  },

  /**
   * Deletes an allocation for an admin, org and app
   */
  async deleteAdminAlloc(adminWhiteId: string, appId: string, orgId?: string): Promise<boolean> {
    const cleanId = adminWhiteId.trim();
    const cleanApp = appId.trim().toLowerCase();
    let sql = `DELETE FROM whitedesk_admin_alloc WHERE admin_white_id = ${escapeSqlString(cleanId)} AND app_id = ${escapeSqlString(cleanApp)}`;
    if (orgId) {
      sql += ` AND org_id = ${escapeSqlString(orgId.trim().toLowerCase())}`;
    }
    sql += `;`;
    await executeSql(sql);
    return true;
  },

  /**
   * Gets allocations for an admin or all allocations (Scope Matrix)
   */
  async getAdminAllocations(adminWhiteId?: string): Promise<AdminAllocEntry[]> {
    try {
      let sql = `SELECT id, admin_white_id, enterprise_blind_id, org_id, app_id, category_id, categories, updated_at FROM whitedesk_admin_alloc`;
      if (adminWhiteId) {
        sql += ` WHERE admin_white_id = ${escapeSqlString(adminWhiteId.trim())}`;
      }
      sql += ` ORDER BY updated_at DESC;`;
      const rows = await executeSql(sql);
      return rows.map(r => ({
        id: Number(r.id),
        admin_white_id: String(r.admin_white_id),
        enterprise_blind_id: r.enterprise_blind_id ? String(r.enterprise_blind_id) : undefined,
        org_id: String(r.org_id || '*'),
        app_id: String(r.app_id || '*'),
        category_id: String(r.category_id || '*'),
        categories: typeof r.categories === 'string' ? JSON.parse(r.categories) : (r.categories || ['all']),
        updated_at: Number(r.updated_at),
      }));
    } catch (e) {
      console.warn('[HelpDeskService] getAdminAllocations error:', e);
      return [];
    }
  },

  /**
   * Fetches tickets.
   * - If admin: returns all tickets or tickets filtered by activeTenantBlindId, including discussions.
   * - If user: returns only tickets where user_white_id = ownWhiteId OR user_blind_id = blindId, NEVER discussions.
   */
  async getTickets(
    ownWhiteId: string, 
    isAdmin: boolean, 
    appId: string = CURRENT_APP_ID, 
    activeTenantBlindId?: string | null
  ): Promise<HelpDeskTicket[]> {
    const blindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
    let sql: string;
    if (isAdmin) {
      const adminRole = await this.getAdminRole(ownWhiteId);
      const isFounder = adminRole === 'founder';
      const isGlobalAdmin = adminRole === 'global_admin';

      let tenantFilter = '';
      if (activeTenantBlindId && activeTenantBlindId !== 'all') {
        tenantFilter = `AND (enterprise_blind_id = ${escapeSqlString(activeTenantBlindId)})`;
      }

      if (!isFounder && !isGlobalAdmin) {
        const allocs = await this.getAdminAllocations(ownWhiteId);
        const appConditions: string[] = [];
        for (const alloc of allocs) {
          const orgMatch = (!alloc.org_id || alloc.org_id === '*' || alloc.org_id === 'all')
            ? '1=1'
            : `org_id = ${escapeSqlString(alloc.org_id)}`;

          const appMatch = (!alloc.app_id || alloc.app_id === '*' || alloc.app_id === 'all')
            ? '1=1'
            : `app_id = ${escapeSqlString(alloc.app_id)}`;

          const catMatch = (!alloc.category_id || alloc.category_id === '*' || alloc.category_id === 'all' || alloc.categories.includes('all') || alloc.categories.includes('*'))
            ? '1=1'
            : (alloc.category_id && alloc.category_id !== '*' 
                ? `category = ${escapeSqlString(alloc.category_id)}`
                : `category IN (${alloc.categories.map(c => escapeSqlString(c)).join(',')})`);

          appConditions.push(`(${orgMatch} AND ${appMatch} AND ${catMatch})`);
        }
        const ownTicketCond = `(user_white_id = ${escapeSqlString(ownWhiteId)} OR user_blind_id = ${escapeSqlString(blindId)})`;
        const cond = appConditions.length > 0 ? `((${appConditions.join(' OR ')}) OR ${ownTicketCond})` : ownTicketCond;
        sql = `SELECT id, enterprise_blind_id, org_id, app_id, user_white_id, user_blind_id, user_pubkey, ticket_pubkey, subject, category, status, is_discussion, created_at, updated_at FROM whitedesk_tickets WHERE ${cond} ${tenantFilter} ORDER BY updated_at DESC;`;
      } else {
        const whereClause = tenantFilter ? `WHERE 1=1 ${tenantFilter}` : '';
        sql = `SELECT id, enterprise_blind_id, org_id, app_id, user_white_id, user_blind_id, user_pubkey, ticket_pubkey, subject, category, status, is_discussion, created_at, updated_at FROM whitedesk_tickets ${whereClause} ORDER BY updated_at DESC;`;
      }
    } else {
      sql = `SELECT id, enterprise_blind_id, org_id, app_id, user_white_id, user_blind_id, user_pubkey, ticket_pubkey, subject, category, status, is_discussion, created_at, updated_at FROM whitedesk_tickets WHERE (user_white_id = ${escapeSqlString(ownWhiteId)} OR user_blind_id = ${escapeSqlString(blindId)}) AND (is_discussion IS NULL OR is_discussion = FALSE) AND app_id = ${escapeSqlString(appId)} ORDER BY updated_at DESC;`;
    }

    const rows = await executeSql(sql);
    return rows.map(r => ({
      id: String(r.id),
      enterprise_blind_id: r.enterprise_blind_id ? String(r.enterprise_blind_id) : undefined,
      org_id: r.org_id ? String(r.org_id) : undefined,
      app_id: String(r.app_id || 'inwhite'),
      user_white_id: String(r.user_white_id || ''),
      user_blind_id: r.user_blind_id ? String(r.user_blind_id) : undefined,
      user_pubkey: r.user_pubkey ? String(r.user_pubkey) : undefined,
      ticket_pubkey: r.ticket_pubkey ? String(r.ticket_pubkey) : undefined,
      subject: String(r.subject),
      category: String(r.category || 'general'),
      status: (r.status as TicketStatus) || 'open',
      is_discussion: Boolean(r.is_discussion),
      created_at: Number(r.created_at),
      updated_at: Number(r.updated_at),
    }));
  },

  /**
   * Retrieves the current admin's alias (e.g. Global Admin, WhiteCosmos, Planet-1)
   */
  async getAdminAlias(ownWhiteId: string): Promise<string> {
    try {
      const blindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);

      const rows = await executeSql(
        `SELECT alias FROM whitedesk_admins WHERE (white_id = ${escapeSqlString(blindId)} OR white_id = ${escapeSqlString(ownWhiteId)}) LIMIT 1;`
      );
      if (rows.length > 0 && rows[0]?.alias) {
        return String(rows[0].alias);
      }
    } catch {}
    return 'Admin';
  },

  /**
   * Fetches conversation messages for a ticket, including sender role for admin badge rendering.
   */
  async getTicketMessages(ticketId: string): Promise<HelpDeskMessage[]> {
    const sql = `
      SELECT m.id, m.ticket_id, m.app_id, m.sender_white_id, m.sender_alias,
             m.sender_blind_id, m.is_admin, m.message,
             m.attachment_data, m.attachment_name, m.attachment_type, m.created_at,
             a.role as sender_role
      FROM whitedesk_ticket_messages m
      LEFT JOIN whitedesk_admins a
        ON (LOWER(a.white_id) = LOWER(m.sender_white_id) OR a.white_id = m.sender_blind_id)
        AND a.is_active = true
      WHERE m.ticket_id = ${escapeSqlString(ticketId)}
      ORDER BY m.created_at ASC;
    `;
    const rows = await executeSql(sql);
    return rows.map(r => {
      let senderRole: 'founder' | 'global_admin' | 'admin' | null = null;
      if (r.sender_role) {
        const role = String(r.sender_role).toLowerCase();
        if (role === 'founder' || role === 'master') senderRole = 'founder';
        else if (role === 'global_admin') senderRole = 'global_admin';
        else if (role === 'admin' || role === 'operator') senderRole = 'admin';
      }
      return {
        id: String(r.id),
        ticket_id: String(r.ticket_id),
        app_id: String(r.app_id || 'inwhite'),
        sender_white_id: String(r.sender_white_id || ''),
        sender_alias: r.sender_alias ? String(r.sender_alias) : null,
        sender_blind_id: r.sender_blind_id ? String(r.sender_blind_id) : null,
        is_admin: Boolean(r.is_admin),
        sender_role: senderRole,
        message: String(r.message || ''),
        attachment_data: r.attachment_data ? String(r.attachment_data) : null,
        attachment_name: r.attachment_name ? String(r.attachment_name) : null,
        attachment_type: r.attachment_type ? String(r.attachment_type) : null,
        created_at: Number(r.created_at),
      };
    });
  },

  /**
   * Creates a new ticket along with its first message and Zero-Knowledge credentials.
   */
  async createTicket(
    subject: string,
    message: string,
    attachment?: { data: string; name: string; type: string } | null,
    appId: string = CURRENT_APP_ID,
    category: string = 'general',
    isDiscussion: boolean = false,
    enterpriseBlindId?: string,
    orgId?: string
  ): Promise<string | null> {
    const ownWhiteId = await this.getOwnWhiteId();
    const ticketId = generateTicketId();
    const messageId = 'msg_' + Math.random().toString(36).substring(2, 10);
    const now = Date.now();

    // Zero-Knowledge Blind ID & PubKey derivation
    const blindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
    let userPubKey = '';
    try {
      const mnemonic = (await SafeSecureStore.getItemAsync('wb_secure_mnemonic')) || (await SafeSecureStore.getItemAsync('sec_mnemonic'));
      if (mnemonic) {
        userPubKey = WhiteDeskCrypto.deriveEd25519FromMnemonic(mnemonic).publicKeyHex;
      }
    } catch {}
    if (!userPubKey) {
      userPubKey = WhiteDeskCrypto.generateBlindId(blindId + '_pub').replace('blind_', '');
    }
    const ephemeral = WhiteDeskCrypto.generateEphemeralKeyPair();
    const ticketPubKey = ephemeral.publicKeyHex;

    const attData = attachment?.data ? escapeSqlString(attachment.data) : 'NULL';
    const attName = attachment?.name ? escapeSqlString(attachment.name) : 'NULL';
    const attType = attachment?.type ? escapeSqlString(attachment.type) : 'NULL';

    const sqlTicket = `INSERT INTO whitedesk_tickets (
      id, enterprise_blind_id, org_id, app_id, user_white_id, user_blind_id, user_pubkey, ticket_pubkey, subject, category, payload, status, is_discussion, created_at, updated_at
    ) VALUES (
      ${escapeSqlString(ticketId)},
      ${escapeSqlString(enterpriseBlindId || null, true)},
      ${escapeSqlString(orgId || 'default')},
      ${escapeSqlString(appId)},
      ${escapeSqlString(ownWhiteId)},
      ${escapeSqlString(blindId)},
      ${escapeSqlString(userPubKey)},
      ${escapeSqlString(ticketPubKey)},
      ${escapeSqlString(subject)},
      ${escapeSqlString(category)},
      ${escapeSqlString(message)},
      'open',
      ${isDiscussion ? 'TRUE' : 'FALSE'},
      ${now},
      ${now}
    );`;

    const isUserAdmin = await this.checkIfAdmin(ownWhiteId);
    const customAlias = await this.getCustomAlias();
    const senderAlias = customAlias || (isUserAdmin ? await this.getAdminAlias(ownWhiteId) : null);

    const sqlMsg = `INSERT INTO whitedesk_ticket_messages (
      id, ticket_id, app_id, sender_white_id, sender_alias, sender_blind_id, is_admin, message, attachment_data, attachment_name, attachment_type, created_at
    ) VALUES (
      ${escapeSqlString(messageId)},
      ${escapeSqlString(ticketId)},
      ${escapeSqlString(appId)},
      ${escapeSqlString(ownWhiteId)},
      ${escapeSqlString(senderAlias, true)},
      ${escapeSqlString(blindId)},
      ${isUserAdmin ? 'true' : 'false'},
      ${escapeSqlString(message)},
      ${attData},
      ${attName},
      ${attType},
      ${now}
    );`;

    await Promise.all([
      executeSql(sqlTicket),
      executeSql(sqlMsg),
    ]);

    return ticketId;
  },

  /**
   * Starts a new Admin Discussion (+ Start a Discussion)
   * 
   * TheWhite routing conventions (parsed from subject prefix):
   *   @tenantBlindId  → write to that specific tenant's global admins only
   *   @whiteId        → write to a specific admin directly
   *   /admin          → broadcast to ALL global admins AND admins across all tenants
   *   (no prefix)     → broadcast to all global admins (default founder scope)
   */
  async createDiscussion(
    subject: string,
    message: string,
    attachment?: { data: string; name: string; type: string } | null,
    appId: string = CURRENT_APP_ID,
    orgId: string = 'default',
    enterpriseBlindId?: string
  ): Promise<string | null> {
    // Parse TheWhite routing prefixes from subject
    let resolvedOrgId = orgId;
    let resolvedEnterpriseBlindId = enterpriseBlindId;
    let cleanSubject = subject;

    // Check for /admin prefix (broadcast to ALL admins and global admins across all tenants)
    if (subject.toLowerCase().startsWith('/admin')) {
      cleanSubject = subject.substring(6).trim();
      resolvedOrgId = 'all_admins';
      resolvedEnterpriseBlindId = undefined; // no tenant filter = all tenants
    }
    // Check for @ prefix (target specific tenant by blindId OR a specific admin by alias)
    else if (subject.startsWith('@')) {
      const atEndIdx = subject.indexOf(' ');
      const target = atEndIdx > 0 ? subject.substring(1, atEndIdx) : subject.substring(1);
      cleanSubject = atEndIdx > 0 ? subject.substring(atEndIdx + 1).trim() : '';

      // A tenant blind ID is a long hex hash (≥ 32 chars, no spaces/special chars)
      const isTenantId = target.length >= 32 && /^[a-fA-F0-9]+$/.test(target);
      if (isTenantId) {
        // Target a specific tenant's global admins
        resolvedEnterpriseBlindId = target;
        resolvedOrgId = 'default';
      } else {
        // Treat as a defined alias (the name the admin set under their WhiteDesk profile)
        // Store as @alias in org_id — getTickets() will filter accordingly
        resolvedOrgId = `@${target}`;
        resolvedEnterpriseBlindId = enterpriseBlindId;
      }
    }

    return await this.createTicket(
      cleanSubject || subject,
      message,
      attachment,
      appId,
      'discussion',
      true,
      resolvedEnterpriseBlindId,
      resolvedOrgId
    );
  },

  /**
   * Admin Operations: Update permissions, replace global admin, block user
   */
  async updateAdminPermissions(
    adminWhiteId: string, 
    orgId: string, 
    appId: string, 
    categories: string[]
  ): Promise<boolean> {
    return await this.saveAdminAlloc(adminWhiteId, orgId, appId, categories);
  },

  async replaceGlobalAdmin(newAdminWhiteId: string, tenantBlindId: string): Promise<boolean> {
    const now = Date.now();
    const blindId = WhiteDeskCrypto.generateBlindId(newAdminWhiteId);

    // Demote existing global admin
    await executeSql(`
      UPDATE whitedesk_admins 
      SET role = 'admin', alias = 'Admin' 
      WHERE enterprise_blind_id = ${escapeSqlString(tenantBlindId)} AND role = 'global_admin';
    `);

    // Promote new admin to WhiteCosmos
    await executeSql(`
      INSERT INTO whitedesk_admins (white_id, enterprise_blind_id, alias, role, is_active, created_at)
      VALUES (${escapeSqlString(blindId)}, ${escapeSqlString(tenantBlindId)}, 'WhiteCosmos', 'global_admin', TRUE, ${now})
      ON CONFLICT (white_id) DO UPDATE SET role = 'global_admin', alias = 'WhiteCosmos', is_active = TRUE;
    `);

    return true;
  },

  /**
   * Deletes a single ticket and all associated messages
   */
  async deleteTicket(ticketId: string | number): Promise<boolean> {
    const cleanId = String(ticketId).trim();
    try {
      await executeSql(`DELETE FROM whitedesk_ticket_messages WHERE ticket_id = ${escapeSqlString(cleanId)};`);
      await executeSql(`DELETE FROM whitedesk_tickets WHERE id = ${escapeSqlString(cleanId)};`);
      return true;
    } catch (e) {
      console.warn('[HelpDeskService] deleteTicket error:', e);
      return false;
    }
  },

  async blockOrDeleteUser(userWhiteId: string, tenantBlindId: string, action: 'block' | 'delete'): Promise<boolean> {
    const blindId = WhiteDeskCrypto.generateBlindId(userWhiteId);
    if (action === 'delete') {
      await executeSql(`DELETE FROM whitedesk_user_bindings WHERE user_blind_id = ${escapeSqlString(blindId)};`);
      await executeSql(`DELETE FROM whitedesk_tickets WHERE user_white_id = ${escapeSqlString(userWhiteId)} OR user_blind_id = ${escapeSqlString(blindId)};`);
    } else {
      await executeSql(`
        INSERT INTO whitedesk_user_bindings (user_blind_id, tenant_blind_id, status, created_at)
        VALUES (${escapeSqlString(blindId)}, ${escapeSqlString(tenantBlindId)}, 'blocked', ${Date.now()})
        ON CONFLICT (user_blind_id) DO UPDATE SET status = 'blocked';
      `);
    }
    return true;
  },

  async promoteUserToAdmin(userWhiteId: string, tenantBlindId: string, role: 'admin' | 'global_admin' = 'admin'): Promise<boolean> {
    const now = Date.now();
    const blindId = WhiteDeskCrypto.generateBlindId(userWhiteId);
    const alias = role === 'global_admin' ? 'WhiteCosmos' : (await generateCosmoAlias('admin'));

    await executeSql(`
      INSERT INTO whitedesk_admins (white_id, enterprise_blind_id, alias, role, is_active, created_at)
      VALUES (${escapeSqlString(blindId)}, ${escapeSqlString(tenantBlindId)}, ${escapeSqlString(alias)}, ${escapeSqlString(role)}, TRUE, ${now})
      ON CONFLICT (white_id) DO UPDATE SET role = ${escapeSqlString(role)}, alias = ${escapeSqlString(alias)}, is_active = TRUE;
    `);

    return true;
  },

  /**
   * Cryptographically grants admin authority from a ticket via Ed25519 signature
   */
  async grantAdminFromTicket(
    ticket: HelpDeskTicket,
    role: string = 'admin',
    alias?: string,
    appId: string = '*',
    categoryId: string = '*',
    orgId: string = 'default'
  ): Promise<boolean> {
    const grantorPrivKey = WhiteDeskCrypto.deriveGenesisPrivKey();
    const ownWhiteId = await this.getOwnWhiteId();
    const grantorBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
    const targetBlindId = ticket.user_blind_id || WhiteDeskCrypto.generateBlindId(ticket.user_white_id);

    let targetPubKey = ticket.user_pubkey;
    if (!targetPubKey) {
      targetPubKey = WhiteDeskCrypto.generateBlindId(targetBlindId + '_pubkey').replace('blind_', '');
    }

    const finalAlias = alias || (await generateCosmoAlias(role));
    const nonce = 'nonce_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const cleanOrg = orgId.trim().toLowerCase() || 'default';

    const payload = {
      admin_blind_id: targetBlindId,
      admin_pubkey: targetPubKey,
      app_id: appId,
      category_id: categoryId,
      role: role as any,
      alias: finalAlias,
      granted_by_blind: grantorBlindId,
      nonce,
    };


    // Save to whitedesk_admin_alloc for console visibility
    const catList = categoryId && categoryId !== '*' ? [categoryId] : ['all'];
    const catJson = JSON.stringify(catList).replace(/'/g, "''");
    const targetAdminWhiteId = ticket.user_white_id || targetBlindId;
    await executeSql(`
      INSERT INTO whitedesk_admin_alloc (admin_white_id, org_id, app_id, categories, updated_at)
      VALUES (${escapeSqlString(targetAdminWhiteId)}, ${escapeSqlString(cleanOrg)}, ${escapeSqlString(appId)}, '${catJson}', ${Date.now()});
    `);

    // Also register in legacy whitedesk_admins table for complete backward compatibility
    await executeSql(`
      INSERT INTO whitedesk_admins (white_id, alias, role, is_active, created_at)
      VALUES (${escapeSqlString(ticket.user_white_id || targetBlindId)}, ${escapeSqlString(finalAlias)}, ${escapeSqlString(role)}, true, ${Date.now()})
      ON CONFLICT (white_id) DO UPDATE SET is_active = true, alias = EXCLUDED.alias;
    `);

    // Insert system resolution message
    const now = Date.now();
    const messageId = 'msg_' + Math.random().toString(36).substring(2, 10);
    const msgSql = `
      INSERT INTO whitedesk_ticket_messages (id, ticket_id, app_id, sender_white_id, is_admin, message, created_at)
      VALUES (
        ${escapeSqlString(messageId)},
        ${escapeSqlString(ticket.id)},
        ${escapeSqlString(ticket.app_id || 'inwhite')},
        ${escapeSqlString(ownWhiteId)},
        true,
        ${escapeSqlString(`[Yetkilendirme Başarılı] WhiteDesk yetkiniz Ed25519 ile mühürlendi. Hoş geldiniz ${finalAlias}.`)},
        ${now}
      );
    `;
    const ticketSql = `UPDATE whitedesk_tickets SET status = 'resolved', updated_at = ${now} WHERE id = ${escapeSqlString(ticket.id)};`;

    await executeSql(msgSql);
    await executeSql(ticketSql);
    return true;
  },


  /**
   * Adds a reply to an existing ticket.
   */
  async replyToTicket(
    ticketId: string,
    message: string,
    isAdmin: boolean,
    attachment?: { data: string; name: string; type: string } | null,
    appId: string = CURRENT_APP_ID
  ): Promise<boolean> {
    const ownWhiteId = await this.getOwnWhiteId();
    const messageId = 'msg_' + Math.random().toString(36).substring(2, 10);
    const now = Date.now();
    const newStatus: TicketStatus = isAdmin ? 'answered' : 'open';

    const attData = attachment?.data ? escapeSqlString(attachment.data) : 'NULL';
    const attName = attachment?.name ? escapeSqlString(attachment.name) : 'NULL';
    const attType = attachment?.type ? escapeSqlString(attachment.type) : 'NULL';

    const senderAlias = isAdmin ? await this.getAdminAlias(ownWhiteId) : null;
    const blindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);

    const sqlMsg = `INSERT INTO whitedesk_ticket_messages (
      id, ticket_id, app_id, sender_white_id, sender_alias, sender_blind_id, is_admin, message, attachment_data, attachment_name, attachment_type, created_at
    ) VALUES (
      ${escapeSqlString(messageId)},
      ${escapeSqlString(ticketId)},
      ${escapeSqlString(appId)},
      ${escapeSqlString(ownWhiteId)},
      ${escapeSqlString(senderAlias, true)},
      ${escapeSqlString(blindId)},
      ${isAdmin ? 'true' : 'false'},
      ${escapeSqlString(message)},
      ${attData},
      ${attName},
      ${attType},
      ${now}
    );`;
    const sqlTicket = `UPDATE whitedesk_tickets SET status = ${escapeSqlString(newStatus)}, updated_at = ${now} WHERE id = ${escapeSqlString(ticketId)};`;

    await Promise.all([
      executeSql(sqlMsg),
      executeSql(sqlTicket),
    ]);

    // Asynchronously dispatch push notification to counterparty
    void (async () => {
      try {
        let targetWhiteId: string | null = null;
        const titleTr = 'inWhite Destek';
        const titleEn = 'inWhite Support';
        let bodyTr = "inWhite Destek'ten mesajınız var";
        let bodyEn = 'You have a message from inWhite Support';

        if (isAdmin) {
          const rows = await executeSql(`SELECT user_white_id, subject FROM whitedesk_tickets WHERE id = ${escapeSqlString(ticketId)} LIMIT 1;`);
          if (rows.length > 0 && rows[0]?.user_white_id) {
            targetWhiteId = String(rows[0].user_white_id).trim();
          }
          bodyTr = "inWhite Destek'ten mesajınız var";
          bodyEn = 'You have a message from inWhite Support';
        } else {
          targetWhiteId = await this.getAdminWhiteId();
          bodyTr = 'inWhite Kullanıcı Mesajı';
          bodyEn = 'inWhite User Message';
        }

        if (targetWhiteId && targetWhiteId.toLowerCase() !== ownWhiteId.toLowerCase()) {
          await apiClient.sendHelpDeskPushNotification(
            targetWhiteId,
            ownWhiteId,
            {
              titleTr,
              titleEn,
              bodyTr,
              bodyEn,
              ticketId,
            }
          );
        }
      } catch (pushErr) {
        console.warn('[HelpDeskService] reply push notice:', pushErr);
      }
    })();

    return true;
  },

  /**
   * Updates ticket status (e.g. closing a ticket).
   */
  async setTicketStatus(ticketId: string, status: TicketStatus): Promise<boolean> {
    const now = Date.now();
    const sql = `UPDATE whitedesk_tickets SET status = ${escapeSqlString(status)}, updated_at = ${now} WHERE id = ${escapeSqlString(ticketId)};`;
    await executeSql(sql);
    return true;
  },

  /**
   * Edits the text and attachment of an existing ticket message.
   */
  async editMessage(
    messageId: string,
    newMessage: string,
    attachment?: { data: string; name: string; type: string } | null
  ): Promise<boolean> {
    const attData = attachment?.data ? escapeSqlString(attachment.data) : 'NULL';
    const attName = attachment?.name ? escapeSqlString(attachment.name) : 'NULL';
    const attType = attachment?.type ? escapeSqlString(attachment.type) : 'NULL';

    const sqlMsg = `UPDATE whitedesk_ticket_messages SET message = ${escapeSqlString(newMessage)}, attachment_data = ${attData}, attachment_name = ${attName}, attachment_type = ${attType} WHERE id = ${escapeSqlString(messageId)};`;
    await executeSql(sqlMsg);
    return true;
  },

  /**
   * Verifies and consumes scanned WhiteDesk QR code or Deep Link payload.
   * Handles Founder (Instant), User (Instant), and Global Admin (Approval Queue).
   */
  async verifyAndConsumeWhiteDeskQr(
    rawQrData: string, 
    ownWhiteId: string
  ): Promise<{
    success: boolean;
    type: 'founder' | 'global_admin' | 'user' | 'unknown';
    message: string;
    enterpriseName?: string;
  }> {
    const raw = String(rawQrData || '').trim();
    if (!raw) {
      return { success: false, type: 'unknown', message: 'Taratılan QR kod içeriği boş.' };
    }

    // 1. Check for URL query parameter "hash" (e.g. inwhite://whitedesk/founder?hash=... or inwhite://whitedesk/join?hash=...)
    let hash = '';
    const hashMatch = raw.match(/[?&]hash=([a-zA-Z0-9_\-\.]+)/i);
    if (hashMatch && hashMatch[1]) {
      hash = hashMatch[1];
    } else {
      // Direct command formats like "admin <hash>" or "user <hash>"
      const cmdMatch = raw.match(/^(?:admin|user)\s+([a-zA-Z0-9_\-\.]+)/i);
      if (cmdMatch && cmdMatch[1]) {
        hash = cmdMatch[1];
      } else {
        // Raw hash or token string
        hash = raw;
      }
    }

    // Clean hash
    hash = hash.trim();

    // Route according to prefix
    if (hash.startsWith('tw_founder_')) {
      const res = await this.handleAdminClaimCommand(ownWhiteId, hash);
      return {
        success: res.success,
        type: 'founder',
        message: res.message,
        enterpriseName: res.enterpriseName,
      };
    }

    if (hash.startsWith('ga_cosmos_')) {
      const res = await this.handleAdminClaimCommand(ownWhiteId, hash);
      return {
        success: res.success,
        type: 'global_admin',
        message: res.message,
        enterpriseName: res.enterpriseName,
      };
    }

    if (hash.startsWith('usr_div_')) {
      const res = await this.handleUserJoinCommand(ownWhiteId, hash);
      return {
        success: res.success,
        type: 'user',
        message: res.message,
        enterpriseName: res.enterpriseName,
      };
    }

    // Fallback: check if it's an enterprise whiteId (bod_...)
    if (hash.startsWith('bod_') || hash.length === 66) {
      const res = await this.handleAdminClaimCommand(ownWhiteId, hash);
      return {
        success: res.success,
        type: res.success ? 'global_admin' : 'unknown',
        message: res.message,
        enterpriseName: res.enterpriseName,
      };
    }

    // Fallback: check if it's an org_pub hex string (64 or 66 chars)
    if (/^[0-9a-fA-F]{64,66}$/.test(hash)) {
      const res = await this.handleUserJoinCommand(ownWhiteId, hash);
      return {
        success: res.success,
        type: res.success ? 'user' : 'unknown',
        message: res.message,
        enterpriseName: res.enterpriseName,
      };
    }

    return {
      success: false,
      type: 'unknown',
      message: 'Geçersiz WhiteDesk QR kodu. Desteklenen bir yetkilendirme veya katılım anahtarı bulunamadı.',
    };
  },
};
