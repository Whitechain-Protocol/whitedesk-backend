import { SafeSecureStore } from '../storageService';
import { keystoreConfigVault } from '../keystoreConfigVault';
import { CryptoVaultService } from '../crypto-vault.service';
import { WhiteDeskCrypto } from '../../whitedesk-sdk';
import { executeSql, escapeSqlString, generateCosmoAlias, invalidateHelpDeskRoleCache } from './db';
import { STORAGE_KEYS, TenantEntry, TenantLicenseData } from './types';
import {
  AdvancedFeaturesConfig,
  DEFAULT_ADVANCED_FEATURES_CONFIG,
  UserAdvancedPreferences,
  DEFAULT_USER_ADVANCED_PREFERENCES,
} from '../../components/helpdesk/types';

function parseDateTimestamp(val: any): number | undefined {
  if (!val) return undefined;
  if (typeof val === 'number') return val > 1e11 ? val : val * 1000;
  const strVal = String(val).trim().replace(' ', 'T');
  const parsed = new Date(strVal).getTime();
  if (!isNaN(parsed)) return parsed;
  const num = Number(val);
  if (!isNaN(num) && num > 0) return num > 1e11 ? num : num * 1000;
  return undefined;
}

export function resolveGracePeriodDays(
  planId: string,
  billingCycle: string,
  dbEnterpriseGraceDays?: any,
  dbPlanGraceDays?: any,
  dbPlanAnnualGraceDays?: any
): number {
  const cleanPlan = (planId || 'trial').toLowerCase();
  const cleanCycle = (billingCycle || 'monthly').toLowerCase();

  if (cleanPlan === 'trial') {
    const n = Number(dbEnterpriseGraceDays ?? dbPlanGraceDays);
    return !isNaN(n) && n > 0 ? n : 3;
  }
  if (cleanCycle === 'annual') {
    const n = Number(dbPlanAnnualGraceDays ?? dbEnterpriseGraceDays);
    return !isNaN(n) && n >= 15 ? n : 15;
  }
  const n = Number(dbPlanGraceDays ?? dbEnterpriseGraceDays);
  return !isNaN(n) && n > 0 && n !== 3 && n !== 15 ? n : 5;
}

export function resolveWarningIntervals(
  planId: string,
  billingCycle: string,
  dbEnterpriseWarn?: any,
  dbPlanWarn?: any,
  dbPlanAnnualWarn?: any
): number {
  const cleanPlan = (planId || 'trial').toLowerCase();
  const cleanCycle = (billingCycle || 'monthly').toLowerCase();

  for (const candidate of [dbEnterpriseWarn, dbPlanWarn]) {
    if (candidate && typeof candidate === 'string' && candidate.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(candidate);
        if (cleanPlan === 'trial' && Number(parsed.trial) > 0) return Number(parsed.trial);
        if (cleanCycle === 'annual' && Number(parsed.annual) > 0) return Number(parsed.annual);
        if (Number(parsed.monthly) > 0) return Number(parsed.monthly);
      } catch {}
    } else if (candidate && typeof candidate === 'object') {
      if (cleanPlan === 'trial' && Number(candidate.trial) > 0) return Number(candidate.trial);
      if (cleanCycle === 'annual' && Number(candidate.annual) > 0) return Number(candidate.annual);
      if (Number(candidate.monthly) > 0) return Number(candidate.monthly);
    }
  }

  if (cleanPlan === 'trial') {
    const n = Number(dbEnterpriseWarn ?? dbPlanWarn);
    return !isNaN(n) && n > 0 ? n : 12;
  }
  if (cleanCycle === 'annual') {
    const n = Number(dbPlanAnnualWarn ?? dbEnterpriseWarn);
    return !isNaN(n) && n >= 48 ? n : 48;
  }
  const n = Number(dbPlanWarn ?? dbEnterpriseWarn);
  return !isNaN(n) && n > 0 && n !== 12 && n !== 48 ? n : 24;
}

export function computeDynamicLicenseState(lic: TenantLicenseData): TenantLicenseData {
  const now = Date.now();
  const isTrialPlan = lic.planId === 'trial';
  const gracePeriodDays = resolveGracePeriodDays(lic.planId, lic.billingCycle, lic.gracePeriodDays);
  const warningIntervals = resolveWarningIntervals(lic.planId, lic.billingCycle, lic.warningIntervals);

  const baseEndAt = isTrialPlan
    ? lic.trialEndAt
    : (lic.subscriptionEndAt || lic.trialEndAt);

  const graceEndsAt = lic.graceEndsAt
    || (baseEndAt ? baseEndAt + gracePeriodDays * 24 * 60 * 60 * 1000 : undefined);

  let trialDaysRemaining = lic.trialDaysRemaining ?? 14;
  if (lic.trialEndAt) {
    if (lic.trialEndAt > now) {
      trialDaysRemaining = Math.max(1, Math.ceil((lic.trialEndAt - now) / (1000 * 60 * 60 * 24)));
    } else {
      trialDaysRemaining = 0;
    }
  }

  const isInGracePeriod = Boolean(baseEndAt && graceEndsAt && now >= baseEndAt && now < graceEndsAt);
  const isGraceExpired = Boolean(graceEndsAt && now >= graceEndsAt);

  let graceDaysRemaining = gracePeriodDays;
  if (graceEndsAt) {
    if (graceEndsAt > now) {
      const refStart = baseEndAt && now > baseEndAt ? now : (baseEndAt || now);
      graceDaysRemaining = Math.max(1, Math.min(gracePeriodDays, Math.ceil((graceEndsAt - refStart) / (1000 * 60 * 60 * 24))));
    } else {
      graceDaysRemaining = 0;
    }
  }

  let status: 'trialing' | 'active' | 'grace_period' | 'expired' = lic.status || (isTrialPlan ? 'trialing' : 'active');
  if (isGraceExpired) {
    status = 'expired';
  } else if (isInGracePeriod) {
    status = 'grace_period';
  } else if (baseEndAt && now < baseEndAt) {
    status = isTrialPlan ? 'trialing' : 'active';
  }

  return {
    ...lic,
    status,
    gracePeriodDays,
    warningIntervals,
    graceEndsAt,
    graceDaysRemaining,
    trialDaysRemaining,
    isInGracePeriod,
    isGraceExpired,
  };
}

/**
 * WhiteDesk License & Enterprise Service:
 * Manages tenant creation, licensing, Genesis access keys, branding,
 * custom fields, catalog, and advanced enterprise configurations.
 */
export const helpDeskLicenseService = {
  /**
   * Retrieves all registered tenants from whitedesk_enterprises (Level 0 - Founder visibility)
   */
  async getAllTenants(): Promise<TenantEntry[]> {
    try {
      const cached = await keystoreConfigVault.getAllTenants();
      if (cached && cached.length > 0) {
        void (async () => {
          try {
            const rows = await executeSql(
              `SELECT enterprise_blind_id, name, org_pub, is_founder_tenant, created_at 
               FROM whitedesk_enterprises 
               ORDER BY is_founder_tenant DESC, created_at ASC;`
            );
            if (rows && rows.length > 0) {
              const refreshed = rows.map((r) => ({
                enterprise_blind_id: String(r.enterprise_blind_id),
                name: String(r.name),
                org_pub: String(r.org_pub),
                is_founder_tenant: Boolean(r.is_founder_tenant),
                created_at: Number(r.created_at || Date.now()),
              }));
              await keystoreConfigVault.setAllTenants(refreshed);
            }
          } catch {}
        })();
        return cached;
      }

      const rows = await executeSql(
        `SELECT enterprise_blind_id, name, org_pub, is_founder_tenant, created_at 
         FROM whitedesk_enterprises 
         ORDER BY is_founder_tenant DESC, created_at ASC;`
      );
      const res = rows.map((r) => ({
        enterprise_blind_id: String(r.enterprise_blind_id),
        name: String(r.name),
        org_pub: String(r.org_pub),
        is_founder_tenant: Boolean(r.is_founder_tenant),
        created_at: Number(r.created_at || Date.now()),
      }));
      await keystoreConfigVault.setAllTenants(res);
      return res;
    } catch (e) {
      console.warn('[HelpDeskLicenseService] getAllTenants error:', e);
      return [];
    }
  },

  /**
   * Self-Service Multi-Tenant Provisioning:
   * 1. Inserts into whitedesk_enterprises.
   * 2. Provisions 14-day trial cryptographic hashes:
   *    - Global Admin Hash (1 use)
   *    - Admin Hash (3 uses)
   *    - User Hash (10 uses)
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
      const trialExpiresAt = now + 14 * 24 * 60 * 60 * 1000;
      const trialGraceDays = 3;
      const trialWarningIntervals = 12;
      const trialGraceEndsAt = trialExpiresAt + trialGraceDays * 24 * 60 * 60 * 1000;
      const trialStartIso = new Date(now).toISOString();
      const trialEndIso = new Date(trialExpiresAt).toISOString();
      const graceEndsIso = new Date(trialGraceEndsAt).toISOString();

      const fieldsJson = customFields && customFields.length > 0 ? JSON.stringify(customFields) : '[]';
      const catalogJson = catalog && catalog.length > 0 ? JSON.stringify(catalog) : '[]';

      // 1. whitedesk_enterprises record (Consolidated Tenant + License + Grace Period)
      await executeSql(`
        INSERT INTO whitedesk_enterprises (
          enterprise_blind_id, name, org_pub, created_at, is_founder_tenant,
          custom_fields, catalog, plan_id, billing_cycle, license_status,
          trial_start_at, trial_end_at, grace_period_days, warning_intervals, grace_ends_at
        )
        VALUES (
          ${escapeSqlString(enterpriseBlindId)}, 
          ${escapeSqlString(cleanName)}, 
          '',
          ${now}, 
          FALSE,
          ${escapeSqlString(fieldsJson)}::jsonb,
          ${escapeSqlString(catalogJson)}::jsonb,
          'trial',
          'monthly',
          'trialing',
          ${escapeSqlString(trialStartIso)},
          ${escapeSqlString(trialEndIso)},
          ${trialGraceDays},
          ${trialWarningIntervals},
          ${escapeSqlString(graceEndsIso)}
        )
        ON CONFLICT (enterprise_blind_id) DO NOTHING;
      `);

      // Seed local Keystore vault for 0ms startup license read
      await keystoreConfigVault.setTenantLicense(enterpriseBlindId, {
        enterpriseBlindId,
        planId: 'trial',
        planName: '14 Günlük Deneme',
        tierLevel: 0,
        status: 'trialing',
        monthlyPrice: 0,
        annualMonthlyPrice: 0,
        billingCycle: 'monthly',
        features: [
          '14 Günlük Değerlendirme Süresi',
          '1 Yönetici Kurtarma İmi',
          '10 Kör Erişim İmi',
          'Sovereign WhiteChain Altyapısı',
        ],
        trialDaysRemaining: 14,
        trialStartAt: now,
        trialEndAt: trialExpiresAt,
        gracePeriodDays: trialGraceDays,
        warningIntervals: trialWarningIntervals,
        graceEndsAt: trialGraceEndsAt,
        graceDaysRemaining: trialGraceDays,
        isInGracePeriod: false,
        isGraceExpired: false,
        hasRemoteDesktop: true,
        hasAuditLogs: true,
      });

      // 2. whitedesk_recovery_hashes 3-tier hash provisioning
      await executeSql(`
        INSERT INTO whitedesk_recovery_hashes (hash, type, tenant_blind_id, org_id, app_id, max_uses, uses_count, used, expires_at, created_at)
        VALUES 
          (${escapeSqlString(globalAdminHash)}, 'global_admin', ${escapeSqlString(enterpriseBlindId)}, 'default', 'inwhite', 1, 0, FALSE, NULL, ${now}),
          (${escapeSqlString(adminHash)}, 'admin', ${escapeSqlString(enterpriseBlindId)}, 'default', 'inwhite', 3, 0, FALSE, ${trialExpiresAt}, ${now}),
          (${escapeSqlString(userHash)}, 'user', ${escapeSqlString(enterpriseBlindId)}, 'default', 'inwhite', 10, 0, FALSE, ${trialExpiresAt}, ${now});
      `);

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
      console.warn('[HelpDeskLicenseService] createSelfServiceTenant error:', e);
      return { success: false, message: 'Kurum masası oluşturulurken bir hata oluştu: ' + (e?.message || e) };
    }
  },

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
      const cachedFields = await SafeSecureStore.getItemAsync(`custom_fields_${tenantId}`);
      const cachedCatalog = await SafeSecureStore.getItemAsync(`catalog_${tenantId}`);
      if (cachedFields && cachedCatalog) {
        return {
          customFields: JSON.parse(cachedFields),
          catalog: JSON.parse(cachedCatalog),
        };
      }

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
      console.warn('[HelpDeskLicenseService] getTenantCustomFieldsAndCatalog error:', e);
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
      console.warn('[HelpDeskLicenseService] updateTenantCustomFieldsAndCatalog error:', e);
      return false;
    }
  },

  /**
   * Updates enterprise / company name
   */
  async updateEnterpriseName(enterpriseBlindId: string, newName: string): Promise<boolean> {
    try {
      const cleanName = (newName || '').trim();
      if (!cleanName) return false;
      await executeSql(`
        UPDATE whitedesk_enterprises 
        SET name = ${escapeSqlString(cleanName)}
        WHERE enterprise_blind_id = ${escapeSqlString(enterpriseBlindId)};
      `);
      await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, cleanName);
      await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME, cleanName);
      return true;
    } catch (e) {
      console.warn('[HelpDeskLicenseService] updateEnterpriseName error:', e);
      return false;
    }
  },

  /**
   * Retrieves enterprise Advanced Features configuration (from Neon Postgres whitedesk_enterprises)
   */
  async getAdvancedFeaturesConfig(enterpriseBlindId?: string): Promise<AdvancedFeaturesConfig> {
    const tenantId = enterpriseBlindId || (await this.getActiveEnterpriseBlindId()) || 'default';
    try {
      // 1. Try local cache first for zero-latency UI
      const cached = await SafeSecureStore.getItemAsync(`advanced_config_${tenantId}`);
      if (cached) {
        return { ...DEFAULT_ADVANCED_FEATURES_CONFIG, ...JSON.parse(cached) };
      }
      // 2. Fetch from Neon Postgres whitedesk_enterprises
      if (tenantId && tenantId !== 'default') {
        const rows = await executeSql(`
          SELECT advanced_features_config 
          FROM whitedesk_enterprises 
          WHERE enterprise_blind_id = ${escapeSqlString(tenantId)} 
          LIMIT 1;
        `);
        if (rows && rows.length > 0 && rows[0].advanced_features_config) {
          const remoteConfig = typeof rows[0].advanced_features_config === 'string'
            ? JSON.parse(rows[0].advanced_features_config)
            : rows[0].advanced_features_config;
          const merged = { ...DEFAULT_ADVANCED_FEATURES_CONFIG, ...remoteConfig };
          await SafeSecureStore.setItemAsync(`advanced_config_${tenantId}`, JSON.stringify(merged));
          return merged;
        }
      }
    } catch (e) {
      console.warn('[HelpDeskLicenseService] getAdvancedFeaturesConfig error:', e);
    }
    return DEFAULT_ADVANCED_FEATURES_CONFIG;
  },

  /**
   * Updates enterprise Advanced Features configuration (in Neon Postgres whitedesk_enterprises)
   */
  async updateAdvancedFeaturesConfig(
    enterpriseBlindId: string,
    config: AdvancedFeaturesConfig
  ): Promise<boolean> {
    try {
      const configJson = JSON.stringify(config);
      // 1. Write to Neon Postgres whitedesk_enterprises
      await executeSql(`
        UPDATE whitedesk_enterprises 
        SET advanced_features_config = ${escapeSqlString(configJson)}::jsonb
        WHERE enterprise_blind_id = ${escapeSqlString(enterpriseBlindId)};
      `);
      // 2. Cache in local SafeSecureStore
      await SafeSecureStore.setItemAsync(`advanced_config_${enterpriseBlindId}`, configJson);
      await SafeSecureStore.setItemAsync(`advanced_config_default`, configJson);
      return true;
    } catch (e) {
      console.warn('[HelpDeskLicenseService] updateAdvancedFeaturesConfig error:', e);
      return false;
    }
  },

  /**
   * Retrieves user's personal Advanced Features preferences
   */
  async getUserAdvancedPreferences(whiteId?: string): Promise<UserAdvancedPreferences> {
    try {
      const rawId = whiteId || (await SafeSecureStore.getItemAsync(STORAGE_KEYS.OWN_WHITE_ID)) || 'default';
      const currentBlindId = rawId !== 'default' ? WhiteDeskCrypto.generateBlindId(rawId) : 'default';
      const raw = (await SafeSecureStore.getItemAsync(`user_advanced_prefs_${currentBlindId}`))
               || (await SafeSecureStore.getItemAsync(`user_advanced_prefs_${rawId}`));
      if (raw) {
        return { ...DEFAULT_USER_ADVANCED_PREFERENCES, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('[HelpDeskLicenseService] getUserAdvancedPreferences error:', e);
    }
    return DEFAULT_USER_ADVANCED_PREFERENCES;
  },

  /**
   * Updates user's personal Advanced Features preferences
   */
  async updateUserAdvancedPreferences(
    whiteId: string,
    prefs: UserAdvancedPreferences
  ): Promise<boolean> {
    try {
      const targetId = whiteId && whiteId !== 'default' ? WhiteDeskCrypto.generateBlindId(whiteId) : 'default';
      const prefsJson = JSON.stringify(prefs);
      await SafeSecureStore.setItemAsync(`user_advanced_prefs_${targetId}`, prefsJson);
      await executeSql(`
        INSERT INTO whitedesk_user_preferences (white_id, prefs, updated_at)
        VALUES (${escapeSqlString(targetId)}, ${escapeSqlString(prefsJson)}::jsonb, NOW())
        ON CONFLICT (white_id) DO UPDATE 
        SET prefs = EXCLUDED.prefs, updated_at = NOW();
      `);
      return true;
    } catch (e) {
      console.warn('[HelpDeskLicenseService] updateUserAdvancedPreferences error:', e);
      return false;
    }
  },

  /**
   * Get / Set tenant custom logo
   */
  async getTenantLogo(enterpriseBlindId?: string): Promise<string | null> {
    try {
      const ent = enterpriseBlindId && enterpriseBlindId !== 'default' 
        ? enterpriseBlindId 
        : (await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID)) ||
          (await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID)) ||
          'default';

      const logo = await SafeSecureStore.getItemAsync(`tenant_logo_${ent}`);
      if (logo) return logo;
      return await SafeSecureStore.getItemAsync('tenant_logo_default');
    } catch {
      return null;
    }
  },

  async setTenantLogo(enterpriseBlindId: string | undefined, logoUriOrBase64: string | null): Promise<void> {
    try {
      const ent = enterpriseBlindId && enterpriseBlindId !== 'default' 
        ? enterpriseBlindId 
        : (await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID)) ||
          (await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID)) ||
          'default';

      if (logoUriOrBase64) {
        await SafeSecureStore.setItemAsync(`tenant_logo_${ent}`, logoUriOrBase64);
        await SafeSecureStore.setItemAsync('tenant_logo_default', logoUriOrBase64);
      } else {
        await SafeSecureStore.deleteItemAsync(`tenant_logo_${ent}`);
        await SafeSecureStore.deleteItemAsync('tenant_logo_default');
      }
    } catch (e) {
      console.warn('[HelpDeskLicenseService] setTenantLogo error:', e);
    }
  },

  /**
   * Get / Set tenant custom logo alignment ('left' | 'center' | 'right')
   */
  async getTenantLogoAlign(enterpriseBlindId?: string): Promise<'left' | 'center' | 'right'> {
    try {
      const ent = enterpriseBlindId && enterpriseBlindId !== 'default' 
        ? enterpriseBlindId 
        : (await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID)) ||
          (await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID)) ||
          'default';

      const align = (await SafeSecureStore.getItemAsync(`tenant_logo_align_${ent}`)) ||
                    (await SafeSecureStore.getItemAsync('tenant_logo_align_default'));
      if (align === 'center' || align === 'right' || align === 'left') {
        return align;
      }
      return 'left';
    } catch {
      return 'left';
    }
  },

  async setTenantLogoAlign(enterpriseBlindId: string | undefined, align: 'left' | 'center' | 'right'): Promise<void> {
    try {
      const ent = enterpriseBlindId && enterpriseBlindId !== 'default' 
        ? enterpriseBlindId 
        : (await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID)) ||
          (await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID)) ||
          'default';

      await SafeSecureStore.setItemAsync(`tenant_logo_align_${ent}`, align);
      await SafeSecureStore.setItemAsync('tenant_logo_align_default', align);
    } catch (e) {
      console.warn('[HelpDeskLicenseService] setTenantLogoAlign error:', e);
    }
  },

  async getTenantLoginSettings(enterpriseBlindId?: string | null): Promise<{ allowNameEntry: boolean; loginIssueEnabled: boolean }> {
    try {
      const ent = enterpriseBlindId && enterpriseBlindId !== 'default'
        ? enterpriseBlindId
        : (await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID)) ||
          (await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID)) ||
          'default';
      const rawName = await SafeSecureStore.getItemAsync(`tenant_allow_name_entry_${ent}`);
      const rawIssue = await SafeSecureStore.getItemAsync(`tenant_login_issue_${ent}`);
      return {
        allowNameEntry: rawName === null ? true : rawName === 'true',
        loginIssueEnabled: rawIssue === null ? false : rawIssue === 'true',
      };
    } catch {
      return { allowNameEntry: true, loginIssueEnabled: false };
    }
  },

  async setTenantLoginSettings(enterpriseBlindId: string | null | undefined, allowNameEntry: boolean, loginIssueEnabled: boolean): Promise<void> {
    try {
      const ent = enterpriseBlindId && enterpriseBlindId !== 'default'
        ? enterpriseBlindId
        : (await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID)) ||
          (await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID)) ||
          'default';
      await SafeSecureStore.setItemAsync(`tenant_allow_name_entry_${ent}`, String(allowNameEntry));
      await SafeSecureStore.setItemAsync(`tenant_login_issue_${ent}`, String(loginIssueEnabled));
    } catch (e) {
      console.warn('[HelpDeskLicenseService] setTenantLoginSettings error:', e);
    }
  },

  /**
   * Generates a new Admin Operator Hash for a tenant
   */
  async generateNewAdminHash(enterpriseBlindId: string, maxUses: number = 1, orgId: string = 'default', appId: string = 'inwhite'): Promise<{ success: boolean; hash?: string; message?: string }> {
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
        VALUES (${escapeSqlString(hash)}, 'admin', ${escapeSqlString(enterpriseBlindId)}, ${escapeSqlString(orgId || 'default')}, ${escapeSqlString(appId || 'inwhite')}, ${maxUses}, 0, FALSE, ${trialExpiresAt}, ${now});
      `);
      return { success: true, hash };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Hash üretilemedi.' };
    }
  },

  /**
   * Generates a new User Onboarding Hash for a tenant
   */
  async generateNewUserHash(enterpriseBlindId: string, maxUses: number = 25, orgId: string = 'default', appId: string = 'inwhite'): Promise<{ success: boolean; hash?: string; message?: string }> {
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
        VALUES (${escapeSqlString(hash)}, 'user', ${escapeSqlString(enterpriseBlindId)}, ${escapeSqlString(orgId || 'default')}, ${escapeSqlString(appId || 'inwhite')}, ${maxUses}, 0, FALSE, ${trialExpiresAt}, ${now});
      `);
      return { success: true, hash };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Hash üretilemedi.' };
    }
  },

  /**
   * Generates a new Global Admin Hash for a tenant (TheWhite Founder only)
   */
  async generateNewGlobalAdminHash(enterpriseBlindId: string): Promise<{ success: boolean; hash?: string; message?: string }> {
    try {
      const now = Date.now();
      const randHex = (len: number = 12) => {
        const chars = 'abcdef0123456789';
        let res = '';
        for (let i = 0; i < len; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
        return res;
      };
      const hash = 'ga_cosmos_' + randHex(16);
      await executeSql(`
        INSERT INTO whitedesk_recovery_hashes (hash, type, tenant_blind_id, org_id, app_id, max_uses, uses_count, used, created_at)
        VALUES (${escapeSqlString(hash)}, 'global_admin', ${escapeSqlString(enterpriseBlindId)}, 'default', 'all', 1, 0, FALSE, ${now});
      `);
      return { success: true, hash };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Global Admin hash üretilemedi.' };
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
   * Registers genesis access bundle keys in Neon DB
   */
  async registerGenesisBundleHashes(params: {
    enterpriseBlindId: string;
    tenantName: string;
    adminRecoveryKey: string;
    userAccessKeys: string[];
  }): Promise<void> {
    try {
      const now = Date.now();
      const expiresAt = now + (14 * 24 * 60 * 60 * 1000);
      const inserts: string[] = [];

      const adminVault = CryptoVaultService.deriveVaultFromAccessKey(params.adminRecoveryKey);
      inserts.push(`(
        ${escapeSqlString(params.adminRecoveryKey)},
        'admin',
        ${escapeSqlString(params.enterpriseBlindId)},
        'default',
        '*',
        '["*"]'::jsonb,
        FALSE,
        ${escapeSqlString(adminVault.blindId)},
        ${now},
        10,
        0,
        ${expiresAt}
      )`);

      for (const uKey of params.userAccessKeys) {
        const uVault = CryptoVaultService.deriveVaultFromAccessKey(uKey);
        inserts.push(`(
          ${escapeSqlString(uKey)},
          'user',
          ${escapeSqlString(params.enterpriseBlindId)},
          'default',
          'inwhite',
          '["*"]'::jsonb,
          FALSE,
          ${escapeSqlString(uVault.blindId)},
          ${now},
          10,
          0,
          ${expiresAt}
        )`);
      }

      const sql = `
        INSERT INTO whitedesk_recovery_hashes (
          hash, type, tenant_blind_id, org_id, app_id, categories, used, used_by_blind_id, created_at, max_uses, uses_count, expires_at
        ) VALUES ${inserts.join(',\n')}
        ON CONFLICT (hash) DO UPDATE SET
          tenant_blind_id = EXCLUDED.tenant_blind_id,
          expires_at = EXCLUDED.expires_at,
          used_by_blind_id = EXCLUDED.used_by_blind_id;
      `;
      await executeSql(sql);
      console.log(`[HelpDeskLicenseService] Registered ${inserts.length} genesis bundle hashes for tenant: ${params.tenantName}`);
    } catch (err) {
      console.warn('[HelpDeskLicenseService] registerGenesisBundleHashes error:', err);
    }
  },

  /**
   * Unified Cryptographic Access Key Verification and Role Claim Engine.
   */
  async claimUnifiedHash(
    ownWhiteId: string,
    rawHashInput: string
  ): Promise<{
    success: boolean;
    role: 'founder' | 'global_admin' | 'admin' | 'user';
    enterpriseName: string;
    enterpriseBlindId: string;
    message: string;
  }> {
    const input = (rawHashInput || '').trim();
    if (!input || input.length < 8) {
      return {
        success: false,
        role: 'user',
        enterpriseName: '',
        enterpriseBlindId: '',
        message: 'Lütfen geçerli bir erişim anahtarı belirtin.',
      };
    }

    const now = Date.now();
    const derivedVault = CryptoVaultService.deriveVaultFromAccessKey(input);
    const effectiveWhiteId = derivedVault.whiteId;
    const blindId = derivedVault.blindId;

    if (input.startsWith('wd_prof_')) {
      const { helpDeskAuthService } = require('./helpDeskAuthService');
      const claimRes = await helpDeskAuthService.handleProfilePasskeyClaim(ownWhiteId || effectiveWhiteId, input);
      return {
        success: claimRes.success,
        role: (claimRes.type || 'user') as any,
        enterpriseName: claimRes.enterpriseName || '',
        enterpriseBlindId: '',
        message: claimRes.message,
      };
    }

    await SafeSecureStore.setItemAsync(STORAGE_KEYS.OWN_WHITE_ID, derivedVault.whiteId);
    await SafeSecureStore.setItemAsync('inwhite_public_key', derivedVault.publicKey);
    await SafeSecureStore.setItemAsync('inwhite_private_key', derivedVault.privateKey);
    await SafeSecureStore.setItemAsync('inwhite_is_registered', 'true');

    try {
      const hashRows = await executeSql(
        `SELECT * FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)} OR used_by_blind_id = ${escapeSqlString(derivedVault.blindId)} LIMIT 1;`
      );

      let record = hashRows.length > 0 ? hashRows[0] : null;

      let detectedType: 'founder' | 'global_admin' | 'admin' | 'user' = 'user';
      let targetTenantBlind = record?.tenant_blind_id ? String(record.tenant_blind_id) : '';

      if (record) {
        detectedType = record.type as any;
        if (record.expires_at && Number(record.expires_at) < now) {
          return {
            success: false,
            role: detectedType,
            enterpriseName: '',
            enterpriseBlindId: targetTenantBlind,
            message: 'Bu erişim anahtarının 14 günlük kullanım süresi dolmuştur.',
          };
        }
        if (record.used) {
          return {
            success: false,
            role: detectedType,
            enterpriseName: '',
            enterpriseBlindId: targetTenantBlind,
            message: 'Bu tekil erişim anahtarı daha önce kullanılmıştır ve geçersizdir.',
          };
        }
        if (record.max_uses && Number(record.uses_count || 0) >= Number(record.max_uses)) {
          return {
            success: false,
            role: detectedType,
            enterpriseName: '',
            enterpriseBlindId: targetTenantBlind,
            message: 'Bu erişim anahtarının kullanım kotası tükenmiştir.',
          };
        }
      } else {
        if (input.startsWith('tw_founder_')) {
          detectedType = 'founder';
          targetTenantBlind = 'blind_thewhite_root';
        } else if (input.startsWith('ga_cosmos_')) {
          detectedType = 'global_admin';
        } else if (input.startsWith('adm_oper_') || input.startsWith('adm_rec_')) {
          detectedType = 'admin';
        } else if (input.startsWith('usr_div_') || input.startsWith('usr_acc_')) {
          detectedType = 'user';
        } else {
          const cleanInput = input.startsWith('wh-') ? input.slice(3) : input;

          // 1. Check if input or cleanInput is an existing admin
          const adminSearch = await executeSql(
            `SELECT white_id, enterprise_blind_id, role, alias FROM whitedesk_admins WHERE white_id = ${escapeSqlString(cleanInput)} OR white_id = ${escapeSqlString(input)} OR white_id = ${escapeSqlString(derivedVault.blindId)} OR blind_id = ${escapeSqlString(derivedVault.blindId)} LIMIT 1;`
          );
          if (adminSearch.length > 0) {
            detectedType = (adminSearch[0].role as any) || 'admin';
            targetTenantBlind = String(adminSearch[0].enterprise_blind_id || '');
          } else {
            // 2. Check enterprises
            const entSearch = await executeSql(
              `SELECT enterprise_blind_id, name FROM whitedesk_enterprises WHERE enterprise_blind_id = ${escapeSqlString(cleanInput)} OR enterprise_blind_id = ${escapeSqlString(input)} OR org_pub = ${escapeSqlString(cleanInput)} OR org_pub = ${escapeSqlString(input)} LIMIT 1;`
            );
            if (entSearch.length > 0) {
              detectedType = 'user';
              targetTenantBlind = String(entSearch[0].enterprise_blind_id);
            } else {
              // 3. Check tickets for user identity
              const ticketSearch = await executeSql(
                `SELECT tenant_blind_id FROM whitedesk_tickets WHERE client_white_id = ${escapeSqlString(cleanInput)} OR client_white_id = ${escapeSqlString(input)} LIMIT 1;`
              );
              if (ticketSearch.length > 0 && ticketSearch[0].tenant_blind_id) {
                detectedType = 'user';
                targetTenantBlind = String(ticketSearch[0].tenant_blind_id);
              } else {
                return {
                  success: false,
                  role: 'user',
                  enterpriseName: '',
                  enterpriseBlindId: '',
                  message: 'Belirtilen giriş kimlik kodu sistemde bulunamadı. Lütfen kontrol edip tekrar deneyin.',
                };
              }
            }
          }
        }
      }

      let tenantName = '';
      if (targetTenantBlind) {
        const entRows = await executeSql(
          `SELECT name FROM whitedesk_enterprises WHERE enterprise_blind_id = ${escapeSqlString(targetTenantBlind)} LIMIT 1;`
        );
        if (entRows.length > 0 && entRows[0].name) {
          tenantName = String(entRows[0].name);
        }
      }

      if (!tenantName || !targetTenantBlind) {
        const entFallback = await executeSql(
          `SELECT enterprise_blind_id, name FROM whitedesk_enterprises WHERE is_founder_tenant = FALSE AND LOWER(name) NOT LIKE '%atlas%' ORDER BY created_at DESC LIMIT 1;`
        );
        if (entFallback.length > 0) {
          tenantName = String(entFallback[0].name);
          targetTenantBlind = String(entFallback[0].enterprise_blind_id);
        } else {
          tenantName = 'Whitechain';
          targetTenantBlind = 'ent_443edea35ad8';
        }
      }

      if (detectedType === 'founder') {
        await executeSql(`
          INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, is_active, created_at)
          VALUES (${escapeSqlString(blindId)}, ${escapeSqlString(blindId)}, 'blind_thewhite_root', 'TheWhite', 'founder', TRUE, ${now})
          ON CONFLICT (white_id) DO UPDATE SET 
            blind_id = EXCLUDED.blind_id,
            enterprise_blind_id = EXCLUDED.enterprise_blind_id,
            role = 'founder',
            alias = 'TheWhite',
            is_active = TRUE;
        `);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'founder');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, 'TheWhite Enterprises');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, 'blind_thewhite_root');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, blindId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.CUSTOM_ALIAS, 'TheWhite');
        invalidateHelpDeskRoleCache();

        if (record) {
          await executeSql(`DELETE FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)};`);
        }

        return {
          success: true,
          role: 'founder',
          enterpriseName: 'TheWhite Enterprises',
          enterpriseBlindId: 'blind_thewhite_root',
          message: 'TheWhite Kurucu (**) kimliğiniz başarıyla doğrulandı. Tam kurucu yetkileri aktif.',
        };
      }

      if (detectedType === 'global_admin') {
        await executeSql(`
          INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, is_active, created_at)
          VALUES (${escapeSqlString(blindId)}, ${escapeSqlString(blindId)}, ${escapeSqlString(targetTenantBlind)}, 'WhiteCosmos', 'global_admin', TRUE, ${now})
          ON CONFLICT (white_id) DO UPDATE SET 
            blind_id = EXCLUDED.blind_id,
            enterprise_blind_id = EXCLUDED.enterprise_blind_id,
            role = 'global_admin',
            alias = 'WhiteCosmos',
            is_active = TRUE;
        `);

        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'global_admin');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, blindId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.CUSTOM_ALIAS, 'WhiteCosmos');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID, targetTenantBlind);
        invalidateHelpDeskRoleCache();

        if (record) {
          await executeSql(`DELETE FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)};`);
        }

        return {
          success: true,
          role: 'global_admin',
          enterpriseName: tenantName,
          enterpriseBlindId: targetTenantBlind,
          message: `'${tenantName}' Global Yönetici (WhiteCosmos) yetkiniz aktifleşti. Yönetim konsoluna yönlendiriliyorsunuz.`,
        };
      }

      if (detectedType === 'admin') {
        const opAlias = await generateCosmoAlias('admin');
        await executeSql(`
          INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, is_active, created_at)
          VALUES (${escapeSqlString(blindId)}, ${escapeSqlString(blindId)}, ${escapeSqlString(targetTenantBlind)}, ${escapeSqlString(opAlias)}, 'admin', TRUE, ${now})
          ON CONFLICT (white_id) DO UPDATE SET 
            blind_id = EXCLUDED.blind_id,
            enterprise_blind_id = EXCLUDED.enterprise_blind_id,
            role = 'admin',
            alias = EXCLUDED.alias,
            is_active = TRUE;
        `);

        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'admin');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, blindId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.CUSTOM_ALIAS, opAlias);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID, targetTenantBlind);
        invalidateHelpDeskRoleCache();

        if (record) {
          const newUses = Number(record.uses_count || 0) + 1;
          const maxUses = Number(record.max_uses || 1);
          if (newUses >= maxUses) {
            await executeSql(`DELETE FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)};`);
          } else {
            await executeSql(`
              UPDATE whitedesk_recovery_hashes 
              SET uses_count = ${newUses}, used_at = ${now}, used_by_blind_id = ${escapeSqlString(blindId)}
              WHERE hash = ${escapeSqlString(input)};
            `);
          }
        }

        return {
          success: true,
          role: 'admin',
          enterpriseName: tenantName,
          enterpriseBlindId: targetTenantBlind,
          message: `'${tenantName}' destek operasyon ekibine dahil oldunuz. Operatör kimliğiniz (${opAlias}) aktif edildi.`,
        };
      }

      // detectedType === 'user'
      await executeSql(`
        INSERT INTO whitedesk_user_bindings (
          user_blind_id, tenant_blind_id, org_id, app_id, status, created_at
        ) VALUES (
          ${escapeSqlString(blindId)},
          ${escapeSqlString(targetTenantBlind)},
          'default',
          'inwhite',
          'approved',
          ${now}
        )
        ON CONFLICT (user_blind_id) DO UPDATE SET
          tenant_blind_id = EXCLUDED.tenant_blind_id,
          status = 'approved';
      `);

      await SafeSecureStore.deleteItemAsync(STORAGE_KEYS.ADMIN_ROLE);
      await SafeSecureStore.deleteItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME);
      await SafeSecureStore.deleteItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID);
      await SafeSecureStore.deleteItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID);
      await SafeSecureStore.deleteItemAsync('inwhite_helpdesk_admin_role');
      await SafeSecureStore.deleteItemAsync('inwhite_helpdesk_admin_enterprise_name');
      await SafeSecureStore.deleteItemAsync(STORAGE_KEYS.CUSTOM_ALIAS);

      await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'none');
      await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID, targetTenantBlind);
      await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME, tenantName);
      invalidateHelpDeskRoleCache();

      if (record) {
        const newUses = Number(record.uses_count || 0) + 1;
        const maxUses = Number(record.max_uses || 1);
        if (newUses >= maxUses) {
          await executeSql(`DELETE FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)};`);
        } else {
          await executeSql(`
            UPDATE whitedesk_recovery_hashes 
            SET uses_count = ${newUses}, used_at = ${now}, used_by_blind_id = ${escapeSqlString(blindId)}
            WHERE hash = ${escapeSqlString(input)};
          `);
        }
      }

      return {
        success: true,
        role: 'user',
        enterpriseName: tenantName,
        enterpriseBlindId: targetTenantBlind,
        message: `'${tenantName}' kurumsal destek masasına kullanıcı olarak bağlandınız.`,
      };
    } catch (err: any) {
      console.warn('[HelpDeskLicenseService] claimUnifiedHash error:', err);
      return {
        success: false,
        role: 'user',
        enterpriseName: '',
        enterpriseBlindId: '',
        message: `Anahtar doğrulanırken hata oluştu: ${err?.message || err}`,
      };
    }
  },

  /**
   * Fetches tenant license from consolidated D1 `whitedesk_enterprises` + `whitedesk_license_plans`
   * and persists it into the local encrypted Keystore vault (`keystoreConfigVault`) for 0ms startup.
   */
  async fetchAndCacheTenantLicenseFromD1(enterpriseBlindId: string): Promise<TenantLicenseData | null> {
    const cleanId = (enterpriseBlindId || 'default').trim();
    try {
      const q = `
        SELECT e.enterprise_blind_id, 
               COALESCE(e.plan_id, 'trial') as plan_id, 
               COALESCE(e.billing_cycle, 'monthly') as billing_cycle, 
               COALESCE(e.license_status, 'trialing') as status, 
               e.trial_start_at, e.trial_end_at, e.subscription_start_at, e.subscription_end_at,
               e.grace_period_days as ent_grace_days, e.warning_intervals as ent_warning_intervals, e.grace_ends_at,
               p.name as plan_name, p.tier_level, p.monthly_price, p.annual_monthly_price,
               p.grace_period_days as plan_grace_days, p.annual_grace_period_days as plan_annual_grace_days,
               p.warning_intervals as plan_warning_intervals, p.annual_warning_intervals as plan_annual_warning_intervals,
               p.features, p.has_remote_desktop, p.has_audit_logs
        FROM whitedesk_enterprises e
        LEFT JOIN whitedesk_license_plans p ON COALESCE(e.plan_id, 'trial') = p.id
        WHERE e.enterprise_blind_id = ${escapeSqlString(cleanId)}
        LIMIT 1;
      `;
      let rows = await executeSql(q);

      // If enterprise has no trial dates set yet, auto-initialize 14-day trial + 3-day grace period
      if (rows && rows.length > 0 && !rows[0].trial_start_at && (rows[0].status === 'trialing' || rows[0].status === 'trial_active')) {
        const now = Date.now();
        const trialEnd = now + 14 * 24 * 60 * 60 * 1000;
        const graceEnd = trialEnd + 3 * 24 * 60 * 60 * 1000;
        await executeSql(`
          UPDATE whitedesk_enterprises SET
            plan_id = 'trial',
            billing_cycle = 'monthly',
            license_status = 'trialing',
            trial_start_at = ${escapeSqlString(new Date(now).toISOString())},
            trial_end_at = ${escapeSqlString(new Date(trialEnd).toISOString())},
            grace_period_days = 3,
            warning_intervals = 12,
            grace_ends_at = ${escapeSqlString(new Date(graceEnd).toISOString())}
          WHERE enterprise_blind_id = ${escapeSqlString(cleanId)};
        `);
        rows = await executeSql(q);
      }

      if (rows && rows.length > 0) {
        const r = rows[0];
        let features: string[] = [];
        try {
          const parsedFeat = typeof r.features === 'string' ? JSON.parse(r.features) : (r.features || []);
          features = Array.isArray(parsedFeat) ? parsedFeat : [];
        } catch {
          features = [];
        }

        const planId = (String(r.plan_id || 'trial').toLowerCase() as 'trial' | 'core' | 'live');
        const billingCycle = (String(r.billing_cycle || 'monthly').toLowerCase() as 'monthly' | 'annual');
        const gracePeriodDays = resolveGracePeriodDays(
          planId,
          billingCycle,
          r.ent_grace_days,
          r.plan_grace_days,
          r.plan_annual_grace_days
        );
        const warningIntervals = resolveWarningIntervals(
          planId,
          billingCycle,
          r.ent_warning_intervals,
          r.plan_warning_intervals,
          r.plan_annual_warning_intervals
        );

        const trialStartAt = parseDateTimestamp(r.trial_start_at);
        const trialEndAt = parseDateTimestamp(r.trial_end_at);
        const subscriptionStartAt = parseDateTimestamp(r.subscription_start_at);
        const subscriptionEndAt = parseDateTimestamp(r.subscription_end_at);
        const baseEndAt = planId === 'trial' ? trialEndAt : (subscriptionEndAt || trialEndAt);
        const parsedGraceEnd = parseDateTimestamp(r.grace_ends_at);
        const graceEndsAt = parsedGraceEnd || (baseEndAt ? baseEndAt + gracePeriodDays * 24 * 60 * 60 * 1000 : undefined);

        const computed = computeDynamicLicenseState({
          enterpriseBlindId: String(r.enterprise_blind_id),
          planId,
          planName: String(r.plan_name || (planId === 'live' ? 'LIVE Paketi' : planId === 'core' ? 'CORE Paketi' : '14 Günlük Deneme')),
          tierLevel: Number(r.tier_level ?? (planId === 'live' ? 2 : planId === 'core' ? 1 : 0)),
          status: (String(r.status || 'trialing') as any),
          monthlyPrice: Number(r.monthly_price || (planId === 'live' ? 129 : planId === 'core' ? 49 : 0)),
          annualMonthlyPrice: Number(r.annual_monthly_price || (planId === 'live' ? 99 : planId === 'core' ? 39 : 0)),
          billingCycle,
          features,
          trialStartAt,
          trialEndAt,
          subscriptionStartAt,
          subscriptionEndAt,
          gracePeriodDays,
          warningIntervals,
          graceEndsAt,
          hasRemoteDesktop: Boolean(r.has_remote_desktop ?? (planId !== 'core')),
          hasAuditLogs: Boolean(r.has_audit_logs ?? (planId !== 'core')),
        });

        await keystoreConfigVault.setTenantLicense(cleanId, computed);
        return computed;
      }
    } catch (e) {
      console.warn('[HelpDeskLicenseService] fetchAndCacheTenantLicenseFromD1 error:', e);
    }
    return null;
  },

  /**
   * License Plans & Addons (0ms Instant Read from Device Vault + Background D1 Sync)
   */
  async getTenantActiveLicense(enterpriseBlindId: string, forceRemote: boolean = false): Promise<TenantLicenseData> {
    const cleanId = (enterpriseBlindId || 'default').trim();
    try {
      if (!forceRemote) {
        const cached = await keystoreConfigVault.getTenantLicense(cleanId);
        if (cached) {
          // Non-blocking background sync with D1
          void this.fetchAndCacheTenantLicenseFromD1(cleanId);
          return computeDynamicLicenseState(cached);
        }
      }

      const remote = await this.fetchAndCacheTenantLicenseFromD1(cleanId);
      if (remote) {
        return remote;
      }

      // Fallback to cached if offline
      const offlineCached = await keystoreConfigVault.getTenantLicense(cleanId);
      if (offlineCached) {
        return computeDynamicLicenseState(offlineCached);
      }
    } catch (e) {
      console.warn('[HelpDeskLicenseService] getTenantActiveLicense error:', e);
    }

    // Default Fallback: 14-day trial (+3 days grace period, 12h warning interval)
    return computeDynamicLicenseState({
      enterpriseBlindId: cleanId,
      planId: 'trial',
      planName: '14 Günlük Deneme',
      tierLevel: 0,
      status: 'trialing',
      monthlyPrice: 0,
      annualMonthlyPrice: 0,
      billingCycle: 'monthly',
      features: [
        '14 Günlük Değerlendirme Süresi',
        '1 Yönetici Kurtarma İmi',
        '10 Kör Erişim İmi',
        'Sovereign WhiteChain Altyapısı',
      ],
      trialDaysRemaining: 14,
      gracePeriodDays: 3,
      warningIntervals: 12,
      hasRemoteDesktop: true,
      hasAuditLogs: true,
    });
  },

  /**
   * Records `inwhite_license_last_grace_warn_ts` when the user taps "Anladım" on the Grace Period sheet.
   */
  async acknowledgeGraceWarning(): Promise<void> {
    try {
      await SafeSecureStore.setItemAsync(STORAGE_KEYS.LAST_GRACE_WARN_TS, String(Date.now()));
    } catch (e) {
      console.warn('[HelpDeskLicenseService] acknowledgeGraceWarning error:', e);
    }
  },

  /**
   * Evaluates whether the Grace Period warning (Stage 1) should be displayed based on `warningIntervals` (in hours)
   * read from the license schema (`12`h for trial, `24`h for monthly, `48`h for annual) and `inwhite_license_last_grace_warn_ts`.
   */
  async shouldShowGracePeriodWarning(license: TenantLicenseData): Promise<boolean> {
    if (!license.isInGracePeriod) return false;
    try {
      const lastWarnRaw = await SafeSecureStore.getItemAsync(STORAGE_KEYS.LAST_GRACE_WARN_TS);
      if (!lastWarnRaw) return true;
      const lastWarnTs = Number(lastWarnRaw);
      if (isNaN(lastWarnTs) || lastWarnTs <= 0) return true;

      const intervalHours = resolveWarningIntervals(
        license.planId,
        license.billingCycle,
        license.warningIntervals
      );
      const intervalMs = intervalHours * 60 * 60 * 1000;
      return Date.now() - lastWarnTs >= intervalMs;
    } catch {
      return true;
    }
  },

  async getUpgradePlans(currentTierLevel: number): Promise<Array<{
    id: 'core' | 'live';
    name: string;
    tierLevel: number;
    monthlyPrice: number;
    annualMonthlyPrice: number;
    gracePeriodDays: number;
    annualGracePeriodDays: number;
    warningIntervals: number;
    annualWarningIntervals: number;
    features: string[];
    hasRemoteDesktop: boolean;
    hasAuditLogs: boolean;
  }>> {
    try {
      const q = `
        SELECT id, name, tier_level, monthly_price, annual_monthly_price,
               grace_period_days, annual_grace_period_days, warning_intervals, annual_warning_intervals,
               features, has_remote_desktop, has_audit_logs
        FROM whitedesk_license_plans
        WHERE tier_level > ${Number(currentTierLevel)} AND is_active = TRUE
        ORDER BY tier_level ASC;
      `;
      const rows = await executeSql(q);
      return (rows || []).map(r => {
        let features: string[] = [];
        try {
          const parsed = typeof r.features === 'string' ? JSON.parse(r.features) : (r.features || []);
          features = Array.isArray(parsed) ? parsed : [];
        } catch {
          features = [];
        }
        return {
          id: String(r.id) as any,
          name: String(r.name),
          tierLevel: Number(r.tier_level),
          monthlyPrice: Number(r.monthly_price),
          annualMonthlyPrice: Number(r.annual_monthly_price),
          gracePeriodDays: Number(r.grace_period_days || 5),
          annualGracePeriodDays: Number(r.annual_grace_period_days || 15),
          warningIntervals: Number(r.warning_intervals || 24),
          annualWarningIntervals: Number(r.annual_warning_intervals || 48),
          features,
          hasRemoteDesktop: Boolean(r.has_remote_desktop),
          hasAuditLogs: Boolean(r.has_audit_logs),
        };
      });
    } catch (e) {
      console.warn('[HelpDeskLicenseService] getUpgradePlans error:', e);
      return [];
    }
  },

  async getAllPlans(): Promise<Array<{
    id: 'core' | 'live';
    name: string;
    tierLevel: number;
    monthlyPrice: number;
    annualMonthlyPrice: number;
    gracePeriodDays: number;
    annualGracePeriodDays: number;
    warningIntervals: number;
    annualWarningIntervals: number;
    features: string[];
    hasRemoteDesktop: boolean;
    hasAuditLogs: boolean;
  }>> {
    try {
      const cachedPlans = await keystoreConfigVault.getLicensePlans();
      const fetchRemotePlans = async () => {
        const q = `
          SELECT id, name, tier_level, monthly_price, annual_monthly_price,
                 grace_period_days, annual_grace_period_days, warning_intervals, annual_warning_intervals,
                 features, has_remote_desktop, has_audit_logs
          FROM whitedesk_license_plans
          WHERE tier_level > 0 AND is_active = TRUE
          ORDER BY tier_level ASC;
        `;
        const rows = await executeSql(q);
        const mapped = (rows || []).map(r => {
          let features: string[] = [];
          try {
            const parsed = typeof r.features === 'string' ? JSON.parse(r.features) : (r.features || []);
            features = Array.isArray(parsed) ? parsed : [];
          } catch {
            features = [];
          }
          return {
            id: String(r.id) as any,
            name: String(r.name),
            tierLevel: Number(r.tier_level),
            monthlyPrice: Number(r.monthly_price),
            annualMonthlyPrice: Number(r.annual_monthly_price),
            gracePeriodDays: Number(r.grace_period_days || 5),
            annualGracePeriodDays: Number(r.annual_grace_period_days || 15),
            warningIntervals: Number(r.warning_intervals || 24),
            annualWarningIntervals: Number(r.annual_warning_intervals || 48),
            features,
            hasRemoteDesktop: Boolean(r.has_remote_desktop),
            hasAuditLogs: Boolean(r.has_audit_logs),
          };
        });
        if (mapped.length > 0) {
          await keystoreConfigVault.setLicensePlans(mapped);
        }
        return mapped;
      };

      if (cachedPlans && cachedPlans.length > 0) {
        void fetchRemotePlans();
        return cachedPlans;
      }

      return await fetchRemotePlans();
    } catch (e) {
      console.warn('[HelpDeskLicenseService] getAllPlans error:', e);
      return [];
    }
  },

  async upgradeTenantLicense(
    enterpriseBlindId: string,
    targetPlanId: 'core' | 'live',
    billingCycle: 'monthly' | 'annual' = 'monthly',
    licenseHash?: string
  ): Promise<{ success: boolean; license?: TenantLicenseData; message?: string }> {
    const cleanId = (enterpriseBlindId || 'default').trim();
    try {
      const now = Date.now();
      const durationDays = billingCycle === 'annual' ? 365 : 30;
      const graceDays = billingCycle === 'annual' ? 15 : 5;
      const warnIntervals = billingCycle === 'annual' ? 48 : 24;
      const subEnd = now + durationDays * 24 * 60 * 60 * 1000;
      const graceEnd = subEnd + graceDays * 24 * 60 * 60 * 1000;

      const subStartIso = new Date(now).toISOString();
      const subEndIso = new Date(subEnd).toISOString();
      const graceEndIso = new Date(graceEnd).toISOString();

      // Update consolidated whitedesk_enterprises table directly (whitedesk_tenant_licenses decommissioned)
      await executeSql(`
        UPDATE whitedesk_enterprises SET
          plan_id = ${escapeSqlString(targetPlanId)},
          billing_cycle = ${escapeSqlString(billingCycle)},
          license_status = 'active',
          subscription_start_at = ${escapeSqlString(subStartIso)},
          subscription_end_at = ${escapeSqlString(subEndIso)},
          grace_period_days = ${graceDays},
          warning_intervals = ${warnIntervals},
          grace_ends_at = ${escapeSqlString(graceEndIso)},
          license_hash = COALESCE(${escapeSqlString(licenseHash, true)}, license_hash)
        WHERE enterprise_blind_id = ${escapeSqlString(cleanId)};
      `);

      // Reset grace period warning timestamp on upgrade
      try {
        await SafeSecureStore.deleteItemAsync(STORAGE_KEYS.LAST_GRACE_WARN_TS);
      } catch {}

      const updated = await this.getTenantActiveLicense(cleanId, true);
      return {
        success: true,
        license: updated,
        message: `'${updated.planName}' lisansınız başarıyla aktif edildi.`,
      };
    } catch (err: any) {
      console.warn('[HelpDeskLicenseService] upgradeTenantLicense error:', err);
      return {
        success: false,
        message: `Lisans yükseltilirken hata oluştu: ${err?.message || err}`,
      };
    }
  },

  async activateLicenseWithHash(
    enterpriseBlindId: string,
    hash: string
  ): Promise<{ success: boolean; license?: any; message?: string }> {
    const cleanHash = (hash || '').trim().toUpperCase();
    if (!cleanHash) {
      return { success: false, message: 'Lütfen geçerli bir lisans hash kodu girin.' };
    }

    let targetPlan: 'core' | 'live' = 'core';
    if (cleanHash.includes('LIVE') || cleanHash.includes('PRO') || cleanHash.startsWith('LIVE-')) {
      targetPlan = 'live';
    }

    return await this.upgradeTenantLicense(enterpriseBlindId, targetPlan, 'annual', cleanHash);
  },

  async getLicensePlans(): Promise<Array<{
    id: string;
    name: string;
    price: string;
    operators: string;
    customers: string;
    grace_period_days: number;
    warning_intervals: number;
    is_recommended: boolean;
    sort_order: number;
  }>> {
    try {
      const rows = await executeSql('SELECT id, name, price, operators, customers, grace_period_days, warning_intervals, is_recommended, sort_order FROM whitedesk_license_plans ORDER BY sort_order ASC;');
      return (rows || []).map(r => ({
        id: String(r.id),
        name: String(r.name),
        price: String(r.price),
        operators: String(r.operators),
        customers: String(r.customers),
        grace_period_days: Number(r.grace_period_days || (r.id === 'trial' ? 3 : 5)),
        warning_intervals: Number(r.warning_intervals || (r.id === 'trial' ? 12 : 24)),
        is_recommended: Boolean(r.is_recommended),
        sort_order: Number(r.sort_order || 0),
      }));
    } catch (e) {
      console.warn('[HelpDeskLicenseService] getLicensePlans error:', e);
      return [];
    }
  },

  async getLicenseAddons(): Promise<Array<{
    id: string;
    title: string;
    price: string;
    type: string;
    amount: number;
    sort_order: number;
  }>> {
    try {
      const rows = await executeSql('SELECT id, title, price, type, amount, sort_order FROM whitedesk_license_addons ORDER BY sort_order ASC;');
      return (rows || []).map(r => ({
        id: String(r.id),
        title: String(r.title),
        price: String(r.price),
        type: String(r.type),
        amount: Number(r.amount || 0),
        sort_order: Number(r.sort_order || 0),
      }));
    } catch (e) {
      console.warn('[HelpDeskLicenseService] getLicenseAddons error:', e);
      return [];
    }
  },
};
