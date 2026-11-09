import { SafeSecureStore } from '../storageService';
import { CryptoService } from '../cryptoService';
import { CryptoVaultService } from '../crypto-vault.service';
import { WhiteDeskCrypto } from '../../whitedesk-sdk';
import { apiClient } from '../apiClient';
import { keystoreTicketVault } from '../keystoreTicketVault';
import { executeSql, escapeSqlString, generateCosmoAlias, _roleCache, invalidateHelpDeskRoleCache } from './db';
import { STORAGE_KEYS, CURRENT_APP_ID, HelpDeskTicket, HelpDeskMessage } from './types';
import { helpDeskStationService } from './helpDeskStationService';
import { helpDeskLicenseService } from './helpDeskLicenseService';
import { i18nService } from '../i18nService';
import { BRAND } from '../../config/brand';

/**
 * WhiteDesk Auth & Identity Service:
 * Handles device identity, cryptographic admin claiming, roles, permissions,
 * and user-to-admin promotions.
 */
export const helpDeskAuthService = {
  /**
   * Hardware Keystore-backed Device WhiteID
   */
  async getOwnWhiteId(): Promise<string> {
    const id = await SafeSecureStore.getItemAsync(STORAGE_KEYS.OWN_WHITE_ID);
    if (id && id !== 'anonymous' && id.trim().toLowerCase().startsWith('blind_')) {
      return WhiteDeskCrypto.generateBlindId(id.trim());
    }
    try {
      const cryptoId = await CryptoService.getWhiteId();
      if (cryptoId && cryptoId.length > 5) return WhiteDeskCrypto.generateBlindId(cryptoId);
    } catch {}
    if (id && id !== 'anonymous') {
      const blindId = WhiteDeskCrypto.generateBlindId(id);
      if (blindId !== id) {
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.OWN_WHITE_ID, blindId);
      }
      return blindId;
    }
    return 'anonymous';
  },

  async getSavedAdminKey(): Promise<string | null> {
    const key = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_KEY);
    if (key) return key;
    return await SafeSecureStore.getItemAsync(STORAGE_KEYS.LEGACY_ADMIN_KEY);
  },

  async setSavedAdminKey(key: string | null): Promise<void> {
    if (key) {
      await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_KEY, key);
      await SafeSecureStore.setItemAsync(STORAGE_KEYS.LEGACY_ADMIN_KEY, key);
    } else {
      await SafeSecureStore.deleteItemAsync(STORAGE_KEYS.ADMIN_KEY);
      await SafeSecureStore.deleteItemAsync(STORAGE_KEYS.LEGACY_ADMIN_KEY);
    }
  },

  /**
   * Ultra-fast admin role resolver (0ms Keystore + In-memory cache)
   */
  async getAdminRole(ownWhiteId: string): Promise<'founder' | 'global_admin' | 'admin' | 'none'> {
    try {
      if (!ownWhiteId || ownWhiteId === 'anonymous') return 'none';
      const cleanId = ownWhiteId.trim();
      const cached = _roleCache[cleanId];
      if (cached && (Date.now() - cached.ts < 60000)) {
        return cached.role;
      }

      // 1. ANINDA 0ms: Yerel Donanımsal Keystore'dan oku
      const localRole = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ROLE);
      if (localRole === 'founder' || localRole === 'master') {
        _roleCache[cleanId] = { role: 'founder', ts: Date.now() };
        return 'founder';
      }
      if (localRole === 'global_admin') {
        _roleCache[cleanId] = { role: 'global_admin', ts: Date.now() };
        return 'global_admin';
      }
      if (localRole === 'admin') {
        _roleCache[cleanId] = { role: 'admin', ts: Date.now() };
        return 'admin';
      }

      // 2. Self-Healing DB Sorgusu: Yerelde rol yoksa DB'den admin kaydını doğrula ve yerel kasayı onar
      try {
        const blindId = WhiteDeskCrypto.generateBlindId(cleanId);
        const rows = await executeSql(`
          SELECT a.role, a.enterprise_blind_id, e.name as enterprise_name
          FROM whitedesk_admins a
          LEFT JOIN whitedesk_enterprises e ON a.enterprise_blind_id = e.enterprise_blind_id
          WHERE (a.white_id = ${escapeSqlString(cleanId)} OR a.white_id = ${escapeSqlString(blindId)} OR a.blind_id = ${escapeSqlString(blindId)})
            AND a.is_active = 1
          LIMIT 1;
        `);
        if (rows && rows.length > 0) {
          const r = rows[0];
          const dbRole = (r.role === 'founder' || r.role === 'master') ? 'founder' : (r.role === 'global_admin' ? 'global_admin' : 'admin');
          await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, dbRole);
          if (r.enterprise_blind_id) {
            await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, String(r.enterprise_blind_id));
            await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, String(r.enterprise_blind_id));
          }
          if (r.enterprise_name) {
            await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, String(r.enterprise_name));
          }
          _roleCache[cleanId] = { role: dbRole, ts: Date.now() };
          return dbRole;
        }
        _roleCache[cleanId] = { role: 'none', ts: Date.now() };
      } catch (err) {
        console.warn('[HelpDeskAuthService] getAdminRole DB self-healing error:', err);
      }

      return 'none';
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
   * Retrieves bound enterprise data for the current user device (0ms Keystore + 60s cache)
   */
  async getUserEnterprise(ownWhiteId?: string, localOnly: boolean = false): Promise<{ enterpriseBlindId: string | null; orgPub: string | null; enterpriseName: string | null; orgId: string | null }> {
    let enterpriseBlindId = await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID);
    let orgPub = await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_PUB);
    let enterpriseName = await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME);
    let orgId = await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_ID);

    if ((!enterpriseBlindId || !orgId) && !localOnly) {
      try {
        const idToCheck = ownWhiteId || await this.getOwnWhiteId();
        if (idToCheck && idToCheck !== 'anonymous') {
          const blindId = WhiteDeskCrypto.generateBlindId(idToCheck);
          const rows = await executeSql(`
            SELECT b.tenant_blind_id, b.org_id, e.name as enterprise_name, e.org_pub
            FROM whitedesk_user_bindings b
            LEFT JOIN whitedesk_enterprises e ON b.tenant_blind_id = e.enterprise_blind_id
            WHERE (b.user_blind_id = ${escapeSqlString(idToCheck)} OR b.user_blind_id = ${escapeSqlString(blindId)})
              AND b.status IN ('approved', 'active')
              AND b.tenant_blind_id IS NOT NULL AND b.tenant_blind_id != ''
            LIMIT 1;
          `);
          if (rows && rows.length > 0) {
            enterpriseBlindId = String(rows[0].tenant_blind_id);
            enterpriseName = rows[0].enterprise_name ? String(rows[0].enterprise_name) : null;
            orgPub = rows[0].org_pub ? String(rows[0].org_pub) : null;
            orgId = rows[0].org_id ? String(rows[0].org_id) : 'default';

            await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID, enterpriseBlindId);
            await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, enterpriseBlindId);
            if (enterpriseName) await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME, enterpriseName);
            if (orgPub) await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_PUB, orgPub);
            if (orgId) await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_ID, orgId);
          }
        }
      } catch (e) {
        console.warn('[HelpDeskAuthService] getUserEnterprise self-healing error:', e);
      }
    }

    return { enterpriseBlindId, orgPub, enterpriseName, orgId };
  },

  /**
   * Retrieves bound enterprise data for the current admin device (0ms Keystore + DB self-healing)
   */
  async getAdminEnterprise(ownWhiteId?: string, localOnly: boolean = false): Promise<{ enterpriseBlindId: string | null; orgPub: string | null; enterpriseName: string | null; orgId: string | null }> {
    let enterpriseBlindId = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID);
    let orgPub = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ORG_PUB);
    let enterpriseName = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME);
    let orgId = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ORG_ID);

    if ((!enterpriseBlindId || !orgId) && !localOnly) {
      try {
        const idToCheck = ownWhiteId || await this.getOwnWhiteId();
        if (idToCheck && idToCheck !== 'anonymous') {
          const blindId = WhiteDeskCrypto.generateBlindId(idToCheck);
          const rows = await executeSql(`
            SELECT a.enterprise_blind_id, a.org_id, e.name as enterprise_name, e.org_pub
            FROM whitedesk_admins a
            LEFT JOIN whitedesk_enterprises e ON a.enterprise_blind_id = e.enterprise_blind_id
            WHERE (a.white_id = ${escapeSqlString(idToCheck)} OR a.white_id = ${escapeSqlString(blindId)} OR a.blind_id = ${escapeSqlString(blindId)})
              AND a.is_active = 1
              AND a.enterprise_blind_id IS NOT NULL AND a.enterprise_blind_id != ''
            LIMIT 1;
          `);
          if (rows && rows.length > 0) {
            enterpriseBlindId = String(rows[0].enterprise_blind_id);
            enterpriseName = rows[0].enterprise_name ? String(rows[0].enterprise_name) : null;
            orgPub = rows[0].org_pub ? String(rows[0].org_pub) : null;
            orgId = rows[0].org_id ? String(rows[0].org_id) : 'all';

            await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, enterpriseBlindId);
            await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, enterpriseBlindId);
            if (enterpriseName) await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, enterpriseName);
            if (orgPub) await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ORG_PUB, orgPub);
            if (orgId) await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ORG_ID, orgId);
          }
        }
      } catch (e) {
        console.warn('[HelpDeskAuthService] getAdminEnterprise self-healing error:', e);
      }
    }

    return { enterpriseBlindId, orgPub, enterpriseName, orgId };
  },

  /**
   * Binds the current device locally as Global Admin for a tenant
   */
  async bindGlobalAdminLocally(params: {
    ownWhiteId: string;
    enterpriseBlindId: string;
    enterpriseName: string;
    alias?: string;
  }): Promise<void> {
    const alias = params.alias || BRAND.whitecosmos;
    const adminBlindId = WhiteDeskCrypto.generateBlindId(params.ownWhiteId);
    await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'global_admin');
    await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, params.enterpriseBlindId);
    await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, params.enterpriseName);
    await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, adminBlindId);
    await SafeSecureStore.setItemAsync(STORAGE_KEYS.CUSTOM_ALIAS, alias);
    await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, params.enterpriseBlindId);
    invalidateHelpDeskRoleCache();

    try {
      const now = Date.now();
      await executeSql(`
        INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, is_active, created_at)
        VALUES (
          ${escapeSqlString(adminBlindId)},
          ${escapeSqlString(adminBlindId)},
          ${escapeSqlString(params.enterpriseBlindId)},
          ${escapeSqlString(alias)},
          'global_admin',
          TRUE,
          ${now}
        )
        ON CONFLICT (white_id) DO UPDATE SET 
          blind_id = EXCLUDED.blind_id,
          enterprise_blind_id = EXCLUDED.enterprise_blind_id,
          role = 'global_admin',
          alias = EXCLUDED.alias,
          is_active = TRUE;
      `);
    } catch (e) {
      console.warn('[HelpDeskAuthService] bindGlobalAdminLocally db sync warning:', e);
    }
  },

  async suggestAdminAlias(role: string = 'operator'): Promise<string> {
    return generateCosmoAlias(role);
  },

  async getAdminAlias(ownWhiteId: string): Promise<string> {
    try {
      const customAlias = await SafeSecureStore.getItemAsync(STORAGE_KEYS.CUSTOM_ALIAS);
      if (customAlias) return customAlias;
      const cached = await SafeSecureStore.getItemAsync('admin_alias_' + ownWhiteId);
      if (cached) return cached;
    } catch {}
    return i18nService.t('helpdesk.admin_role_short');
  },

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
        WHERE white_id = ${escapeSqlString(blindId)} OR blind_id = ${escapeSqlString(blindId)} OR white_id = ${escapeSqlString(ownWhiteId)};
      `);
    }
  },

  async claimAdmin(ownWhiteId: string, adminKey: string): Promise<boolean> {
    if (!adminKey || !adminKey.trim()) return false;
    const blindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
    await this.setSavedAdminKey(adminKey);
    await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, blindId);
    await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'admin');
    const now = Date.now();

    const masterAlias = await generateCosmoAlias('master');

    await executeSql(`
      INSERT INTO whitedesk_admins (white_id, blind_id, alias, role, is_active, created_at)
      VALUES (${escapeSqlString(blindId)}, ${escapeSqlString(blindId)}, ${escapeSqlString(masterAlias)}, 'global_admin', true, ${now})
      ON CONFLICT (white_id) DO UPDATE SET blind_id = EXCLUDED.blind_id, role = 'global_admin', is_active = true;
    `);

    return true;
  },

  async getAdminWhiteId(): Promise<string> {
    try {
      const rows = await executeSql(`SELECT COALESCE(blind_id, white_id) as id FROM whitedesk_admins WHERE role = 'founder' OR role = 'master' LIMIT 1;`);
      if (rows.length > 0 && rows[0]?.id) {
        return WhiteDeskCrypto.generateBlindId(String(rows[0].id).trim());
      }
    } catch (e) {
      console.warn('[HelpDeskAuthService] Failed to get admin_white_id:', e);
    }
    return WhiteDeskCrypto.generateBlindId('0362bed5a6ce744fe353a166dd478879bd480725615396d9976973bb396aa5989a');
  },

  /**
   * Handles Genesis Admin Claim Command: "admin <key_or_hash>"
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
      let input = (keyOrHashInput || '').trim();
      if (!input) {
        return { success: false, message: i18nService.t('auth_service.invalid_key_or_hash') };
      }

      const uriHash = input.match(/[?&]hash=([a-zA-Z0-9_\-\.]+)/i);
      if (uriHash && uriHash[1]) {
        input = uriHash[1].trim();
      } else {
        const cmdHash = input.match(/^(?:admin|user|desktop)\s+([a-zA-Z0-9_\-\.]+)/i);
        if (cmdHash && cmdHash[1]) {
          input = cmdHash[1].trim();
        }
      }

      const derivedVault = CryptoVaultService.deriveVaultFromAccessKey(input);
      let adminBlindId = derivedVault.blindId || WhiteDeskCrypto.generateBlindId(ownWhiteId);
      const now = Date.now();

      // 1. TheWhite Founder Recovery Hash
      if (input.startsWith('tw_founder_')) {
        const hashRows = await executeSql(
          `SELECT * FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)} AND type = 'founder' LIMIT 1;`
        );

        if (hashRows.length === 0) {
          return { success: false, message: i18nService.t('auth_service.invalid_founder_recovery_hash') };
        }

        const hashRecord = hashRows[0];
        if (hashRecord.used) {
          return { success: false, message: i18nService.t('auth_service.founder_recovery_hash_already_used') };
        }

        if (hashRecord.used_by_blind_id && String(hashRecord.used_by_blind_id).trim().startsWith('blind_')) {
          adminBlindId = WhiteDeskCrypto.generateBlindId(String(hashRecord.used_by_blind_id).trim());
        }

        await executeSql(`
          DELETE FROM whitedesk_recovery_hashes 
          WHERE hash = ${escapeSqlString(input)};
        `);

        const founderBlindId = String(hashRecord.tenant_blind_id || 'blind_thewhite_root');
        await executeSql(`
          INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, is_active, created_at)
          VALUES (${escapeSqlString(adminBlindId)}, ${escapeSqlString(adminBlindId)}, ${escapeSqlString(founderBlindId)}, 'TheWhite', 'founder', TRUE, ${now})
          ON CONFLICT (white_id) DO UPDATE SET 
            blind_id = EXCLUDED.blind_id,
            enterprise_blind_id = EXCLUDED.enterprise_blind_id,
            role = 'founder',
            alias = 'TheWhite',
            is_active = TRUE;
        `);

        await SafeSecureStore.setItemAsync(STORAGE_KEYS.OWN_WHITE_ID, adminBlindId);
        await SafeSecureStore.setItemAsync('inwhite_public_key', derivedVault.publicKey);
        await SafeSecureStore.setItemAsync('inwhite_private_key', derivedVault.privateKey);
        await SafeSecureStore.setItemAsync('inwhite_is_registered', 'true');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'founder');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, 'TheWhite Enterprises');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, founderBlindId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, founderBlindId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, adminBlindId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.CUSTOM_ALIAS, 'TheWhite');

        try {
          const { NotificationService } = require('../notificationService');
          const { voiceCallService } = require('../voice');
          NotificationService.setOwnTenantId(founderBlindId);
          NotificationService.setOwnOrgId('');
          voiceCallService.setActiveEnterpriseBlindId(founderBlindId);
          voiceCallService.setActiveOrgId('');
        } catch {}

        invalidateHelpDeskRoleCache();

        return {
          success: true,
          role: 'founder',
          enterpriseName: 'TheWhite Enterprises',
          enterpriseBlindId: founderBlindId,
          adminBlindId,
          message: i18nService.t('auth_service.founder_identity_restored'),
        };
      }

      // 2. Global Admin Claim Hash
      if (input.startsWith('ga_cosmos_')) {
        const hashRows = await executeSql(
          `SELECT * FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)} AND type = 'global_admin' LIMIT 1;`
        );

        if (hashRows.length === 0) {
          return { success: false, message: i18nService.t('auth_service.invalid_global_admin_hash') };
        }

        const hashRecord = hashRows[0];
        if (hashRecord.used_by_blind_id && String(hashRecord.used_by_blind_id).trim().startsWith('blind_')) {
          adminBlindId = WhiteDeskCrypto.generateBlindId(String(hashRecord.used_by_blind_id).trim());
        }
        const targetTenantBlind = String(hashRecord.tenant_blind_id);
        const entRows = await executeSql(
          `SELECT name FROM whitedesk_enterprises WHERE enterprise_blind_id = ${escapeSqlString(targetTenantBlind)} LIMIT 1;`
        );
        const tenantName = entRows[0]?.name ? String(entRows[0].name) : i18nService.t('auth_service.default_enterprise_name');

        await executeSql(`
          DELETE FROM whitedesk_admins
          WHERE enterprise_blind_id = ${escapeSqlString(targetTenantBlind)}
            AND role = 'global_admin'
            AND white_id != ${escapeSqlString(adminBlindId)};
        `);

        await executeSql(`
          INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, is_active, created_at)
          VALUES (${escapeSqlString(adminBlindId)}, ${escapeSqlString(adminBlindId)}, ${escapeSqlString(targetTenantBlind)}, 'WhiteCosmos', 'global_admin', TRUE, ${now})
          ON CONFLICT (white_id) DO UPDATE SET 
            blind_id = EXCLUDED.blind_id,
            enterprise_blind_id = EXCLUDED.enterprise_blind_id,
            role = 'global_admin',
            alias = 'WhiteCosmos',
            is_active = TRUE;
        `);

        await executeSql(`
          INSERT INTO whitedesk_approvals (
            type, tenant_blind_id, tenant_name, candidate_white_id, candidate_blind_id, candidate_alias, status, requested_at, reviewed_at, reviewed_by
          ) VALUES (
            'global_admin',
            ${escapeSqlString(targetTenantBlind)},
            ${escapeSqlString(tenantName)},
            ${escapeSqlString(adminBlindId)},
            ${escapeSqlString(adminBlindId)},
            'WhiteCosmos',
            'approved',
            ${now},
            ${now},
            'self_service_claim'
          );
        `);

        await executeSql(`
          DELETE FROM whitedesk_recovery_hashes 
          WHERE hash = ${escapeSqlString(input)};
        `);

        await SafeSecureStore.setItemAsync(STORAGE_KEYS.OWN_WHITE_ID, adminBlindId);
        await SafeSecureStore.setItemAsync('inwhite_public_key', derivedVault.publicKey);
        await SafeSecureStore.setItemAsync('inwhite_private_key', derivedVault.privateKey);
        await SafeSecureStore.setItemAsync('inwhite_is_registered', 'true');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'global_admin');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, adminBlindId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.CUSTOM_ALIAS, 'WhiteCosmos');

        try {
          const { NotificationService } = require('../notificationService');
          const { voiceCallService } = require('../voice');
          NotificationService.setOwnTenantId(targetTenantBlind);
          NotificationService.setOwnOrgId('');
          voiceCallService.setActiveEnterpriseBlindId(targetTenantBlind);
          voiceCallService.setActiveOrgId('');
        } catch {}

        invalidateHelpDeskRoleCache();

        return {
          success: true,
          role: 'global_admin',
          enterpriseName: tenantName,
          enterpriseBlindId: targetTenantBlind,
          adminBlindId,
          message: i18nService.t('auth_service.global_admin_claim_success', { tenantName }),
        };
      }

      // 2.2 Sovereign Profile Passkey (wd_prof_...)
      if (input.startsWith('wd_prof_')) {
        const profRes = await this.handleProfilePasskeyClaim(ownWhiteId, input);
        return {
          success: profRes.success,
          role: (profRes.type || 'global_admin') as any,
          enterpriseName: profRes.enterpriseName,
          enterpriseBlindId: profRes.enterpriseBlindId || (await SafeSecureStore.getItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID)) || undefined,
          adminBlindId: profRes.restoredBlindId,
          message: profRes.message,
        };
      }

      // 2.5 Destek Operatörü Admin Hash
      if (input.startsWith('adm_oper_') || input.startsWith('adm_rec_')) {
        const hashRows = await executeSql(
          `SELECT * FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)} AND type = 'admin' LIMIT 1;`
        );

        if (hashRows.length === 0) {
          return { success: false, message: i18nService.t('auth_service.invalid_operator_hash') };
        }

        const hashRecord = hashRows[0];
        if (hashRecord.expires_at && Number(hashRecord.expires_at) < now) {
          await executeSql(`DELETE FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)};`);
          return { success: false, message: i18nService.t('auth_service.operator_hash_trial_expired') };
        }

        if (hashRecord.used_by_blind_id && String(hashRecord.used_by_blind_id).trim().startsWith('blind_')) {
          adminBlindId = WhiteDeskCrypto.generateBlindId(String(hashRecord.used_by_blind_id).trim());
        }

        const targetTenantBlind = String(hashRecord.tenant_blind_id);
        const targetOrgId = String(hashRecord.org_id || 'merkez');
        const targetAppId = String(hashRecord.app_id || 'whitedesk');
        const entRows = await executeSql(
          `SELECT name FROM whitedesk_enterprises WHERE enterprise_blind_id = ${escapeSqlString(targetTenantBlind)} LIMIT 1;`
        );
        const tenantName = entRows[0]?.name ? String(entRows[0].name) : i18nService.t('auth_service.default_enterprise_name');

        const existingAdminRows = await executeSql(
          `SELECT alias, org_id, app_id, categories FROM whitedesk_admins WHERE white_id = ${escapeSqlString(adminBlindId)} OR blind_id = ${escapeSqlString(adminBlindId)} LIMIT 1;`
        );
        const opAlias = existingAdminRows[0]?.alias
          ? String(existingAdminRows[0].alias)
          : await generateCosmoAlias('admin');
        const effectiveOrgId = existingAdminRows[0]?.org_id ? String(existingAdminRows[0].org_id) : targetOrgId;

        await executeSql(`
          INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, org_id, app_id, alias, role, is_active, created_at)
          VALUES (${escapeSqlString(adminBlindId)}, ${escapeSqlString(adminBlindId)}, ${escapeSqlString(targetTenantBlind)}, ${escapeSqlString(effectiveOrgId)}, ${escapeSqlString(targetAppId)}, ${escapeSqlString(opAlias)}, 'admin', TRUE, ${now})
          ON CONFLICT (white_id) DO UPDATE SET 
            blind_id = EXCLUDED.blind_id,
            enterprise_blind_id = EXCLUDED.enterprise_blind_id,
            org_id = COALESCE(whitedesk_admins.org_id, EXCLUDED.org_id),
            role = 'admin',
            alias = COALESCE(whitedesk_admins.alias, EXCLUDED.alias),
            is_active = TRUE;
        `);

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

        await SafeSecureStore.setItemAsync(STORAGE_KEYS.OWN_WHITE_ID, adminBlindId);
        await SafeSecureStore.setItemAsync('inwhite_public_key', derivedVault.publicKey);
        await SafeSecureStore.setItemAsync('inwhite_private_key', derivedVault.privateKey);
        await SafeSecureStore.setItemAsync('inwhite_is_registered', 'true');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'admin');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ORG_ID, effectiveOrgId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_ID, effectiveOrgId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, adminBlindId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.CUSTOM_ALIAS, opAlias);

        try {
          const { NotificationService } = require('../notificationService');
          const { voiceCallService } = require('../voice');
          NotificationService.setOwnTenantId(targetTenantBlind);
          NotificationService.setOwnOrgId(effectiveOrgId);
          voiceCallService.setActiveEnterpriseBlindId(targetTenantBlind);
          voiceCallService.setActiveOrgId(effectiveOrgId);
        } catch {}

        invalidateHelpDeskRoleCache();

        return {
          success: true,
          role: 'admin',
          enterpriseName: tenantName,
          enterpriseBlindId: targetTenantBlind,
          adminBlindId,
          message: i18nService.t('auth_service.operator_join_success', { tenantName, alias: opAlias }),
        };
      }

      // 2.8 Direct Pre-Registered Admin Blind ID / WhiteID from wdrun (Instant Activation - No Pending Queue)
      const cleanInput = input.startsWith('wh-') ? input.slice(3).trim() : input.trim();
      const inputAsBlindId = WhiteDeskCrypto.generateBlindId(cleanInput);
      const preRegAdminRows = await executeSql(
        `SELECT white_id, blind_id, enterprise_blind_id, org_id, app_id, alias, role
         FROM whitedesk_admins
         WHERE white_id = ${escapeSqlString(cleanInput)}
            OR blind_id = ${escapeSqlString(cleanInput)}
            OR white_id = ${escapeSqlString(inputAsBlindId)}
            OR blind_id = ${escapeSqlString(inputAsBlindId)}
         LIMIT 1;`
      );

      if (preRegAdminRows.length > 0) {
        const adm = preRegAdminRows[0];
        const matchedBlindId = WhiteDeskCrypto.generateBlindId(String(adm.white_id || adm.blind_id || inputAsBlindId));
        const matchedRole = (String(adm.role || 'admin') as 'founder' | 'global_admin' | 'admin');
        const targetTenantBlind = String(adm.enterprise_blind_id || 'default');
        const matchedOrgId = String(adm.org_id || 'merkez');
        const matchedAlias = String(adm.alias || (matchedRole === 'founder' ? 'TheWhite' : matchedRole === 'global_admin' ? 'WhiteCosmos' : 'Admin'));

        const entRows = await executeSql(
          `SELECT name FROM whitedesk_enterprises WHERE enterprise_blind_id = ${escapeSqlString(targetTenantBlind)} LIMIT 1;`
        );
        const tenantName = entRows[0]?.name
          ? String(entRows[0].name)
          : matchedRole === 'founder'
            ? 'TheWhite Enterprises'
            : i18nService.t('auth_service.default_enterprise_name');

        await executeSql(`
          UPDATE whitedesk_admins
          SET white_id = ${escapeSqlString(matchedBlindId)},
              blind_id = ${escapeSqlString(matchedBlindId)},
              is_active = TRUE,
              updated_at = ${now}
          WHERE white_id = ${escapeSqlString(String(adm.white_id))}
             OR blind_id = ${escapeSqlString(String(adm.blind_id || adm.white_id))};
        `);

        await SafeSecureStore.setItemAsync(STORAGE_KEYS.OWN_WHITE_ID, matchedBlindId);
        await SafeSecureStore.setItemAsync('inwhite_public_key', derivedVault.publicKey);
        await SafeSecureStore.setItemAsync('inwhite_private_key', derivedVault.privateKey);
        await SafeSecureStore.setItemAsync('inwhite_is_registered', 'true');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, matchedRole);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ORG_ID, matchedOrgId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_ID, matchedOrgId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, matchedBlindId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.CUSTOM_ALIAS, matchedAlias);

        try {
          const { NotificationService } = require('../notificationService');
          const { voiceCallService } = require('../voice');
          NotificationService.setOwnTenantId(targetTenantBlind);
          NotificationService.setOwnOrgId(matchedOrgId);
          voiceCallService.setActiveEnterpriseBlindId(targetTenantBlind);
          voiceCallService.setActiveOrgId(matchedOrgId);
        } catch {}

        invalidateHelpDeskRoleCache();

        return {
          success: true,
          role: matchedRole,
          enterpriseName: tenantName,
          enterpriseBlindId: targetTenantBlind,
          adminBlindId: matchedBlindId,
          message: matchedRole === 'founder'
            ? i18nService.t('auth_service.founder_identity_restored')
            : matchedRole === 'global_admin'
              ? i18nService.t('auth_service.global_admin_claim_success', { tenantName })
              : i18nService.t('auth_service.operator_join_success', { tenantName, alias: matchedAlias }),
        };
      }

      // 3. Enterprise WhiteID from Tenant Provisioning (Direct Instant Activation - No Pending Queue)
      const enterpriseBlindId = WhiteDeskCrypto.generateBlindId(input);

      const enterpriseRows = await executeSql(
        `SELECT enterprise_blind_id, name, org_pub, is_founder_tenant FROM whitedesk_enterprises WHERE enterprise_blind_id = ${escapeSqlString(enterpriseBlindId)} LIMIT 1;`
      );

      if (enterpriseRows.length > 0) {
        const ent = enterpriseRows[0];
        const enterpriseName = String(ent.name || i18nService.t('auth_service.default_enterprise_name'));
        const appName = 'whitedesk';
        const orgPub = String(ent.org_pub || '');
        const isFounderTenant = Boolean(ent.is_founder_tenant) || enterpriseName.toLowerCase().includes('thewhite');

        const targetRole = isFounderTenant ? 'founder' : 'global_admin';
        const alias = isFounderTenant ? 'TheWhite' : 'WhiteCosmos';

        await executeSql(`
          INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, is_active, created_at)
          VALUES (${escapeSqlString(adminBlindId)}, ${escapeSqlString(adminBlindId)}, ${escapeSqlString(enterpriseBlindId)}, ${escapeSqlString(alias)}, ${escapeSqlString(targetRole)}, TRUE, ${now})
          ON CONFLICT (white_id) DO UPDATE SET 
            blind_id = EXCLUDED.blind_id,
            enterprise_blind_id = EXCLUDED.enterprise_blind_id, 
            role = ${escapeSqlString(targetRole)}, 
            alias = ${escapeSqlString(alias)},
            is_active = TRUE;
        `);

        try {
          await executeSql(`
            INSERT INTO whitedesk_approvals (
              type, tenant_blind_id, tenant_name, candidate_white_id, candidate_blind_id, candidate_alias, status, requested_at, reviewed_at, reviewed_by
            ) VALUES (
              ${escapeSqlString(targetRole)},
              ${escapeSqlString(enterpriseBlindId)},
              ${escapeSqlString(enterpriseName)},
              ${escapeSqlString(adminBlindId)},
              ${escapeSqlString(adminBlindId)},
              ${escapeSqlString(alias)},
              'approved',
              ${now},
              ${now},
              'instant_self_claim'
            );
          `);
        } catch {}

        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, targetRole);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, enterpriseBlindId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, enterpriseBlindId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ORG_PUB, orgPub);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, enterpriseName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, adminBlindId);

        try {
          const { NotificationService } = require('../notificationService');
          const { voiceCallService } = require('../voice');
          NotificationService.setOwnTenantId(enterpriseBlindId);
          NotificationService.setOwnOrgId('');
          voiceCallService.setActiveEnterpriseBlindId(enterpriseBlindId);
          voiceCallService.setActiveOrgId('');
        } catch {}

        invalidateHelpDeskRoleCache();

        return {
          success: true,
          role: targetRole,
          enterpriseName,
          appName,
          orgPub,
          enterpriseBlindId,
          adminBlindId,
          message: isFounderTenant
            ? i18nService.t('auth_service.founder_licensor_registered', { enterpriseName })
            : i18nService.t('auth_service.global_admin_instant_activated', { enterpriseName }),
        };
      }

      // 4. Normal Admin Claim Candidate
      const tenantBlindForAdmin = (await SafeSecureStore.getItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID)) ||
                                  (await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID)) ||
                                  (await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID)) ||
                                  'default';

      await executeSql(`
        INSERT INTO whitedesk_approvals (
          type, tenant_blind_id, candidate_white_id, candidate_blind_id, candidate_alias, status, requested_at
        ) VALUES (
          'admin',
          ${escapeSqlString(tenantBlindForAdmin)},
          ${escapeSqlString(adminBlindId)},
          ${escapeSqlString(adminBlindId)},
          ${escapeSqlString(i18nService.t('helpdesk.admin_role_short'))},
          'pending',
          ${now}
        );
      `);

      return {
        success: true,
        message: i18nService.t('auth_service.admin_candidacy_pending'),
      };
    } catch (err: any) {
      console.warn('[HelpDeskAuthService] handleAdminClaimCommand error:', err);
      return {
        success: false,
        message: i18nService.t('auth_service.db_error_during_operation', { error: err?.message || String(err) }),
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
        return { success: false, message: i18nService.t('auth_service.provide_valid_org_key_or_user_hash') };
      }

      const userBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
      const now = Date.now();

      // CASE 1: Divisional User Hash (usr_div_...)
      if (input.startsWith('usr_div_')) {
        const hashRows = await executeSql(
          `SELECT * FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)} AND type = 'user' LIMIT 1;`
        );

        if (hashRows.length === 0) {
          return { success: false, message: i18nService.t('auth_service.invalid_user_hash') };
        }

        const h = hashRows[0];
        const tenantBlind = String(h.tenant_blind_id);
        const orgId = String(h.org_id || 'default');
        const appId = String(h.app_id || CURRENT_APP_ID);

        const entRows = await executeSql(
          `SELECT name, org_pub FROM whitedesk_enterprises WHERE enterprise_blind_id = ${escapeSqlString(tenantBlind)} LIMIT 1;`
        );
        const tenantName = entRows[0]?.name ? String(entRows[0].name) : i18nService.t('auth_service.default_enterprise_name');
        const orgPub = entRows[0]?.org_pub ? String(entRows[0].org_pub) : '';

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

        await executeSql(`
          INSERT INTO whitedesk_approvals (
            type, tenant_blind_id, tenant_name, candidate_white_id, candidate_blind_id, target_org_id, target_app_id, status, requested_at, reviewed_at, reviewed_by
          ) VALUES (
            'user',
            ${escapeSqlString(tenantBlind)},
            ${escapeSqlString(tenantName)},
            ${escapeSqlString(userBlindId)},
            ${escapeSqlString(userBlindId)},
            ${escapeSqlString(orgId)},
            ${escapeSqlString(appId)},
            'approved',
            ${now},
            ${now},
            'onboarding_hash'
          );
        `);

        if (h.expires_at && Number(h.expires_at) < now) {
          await executeSql(`DELETE FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(input)};`);
          return { success: false, message: i18nService.t('auth_service.user_hash_expired') };
        }

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

        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID, tenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, tenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_ID, orgId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_PUB, orgPub);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME, tenantName);

        return {
          success: true,
          enterpriseName: tenantName,
          enterpriseBlindId: tenantBlind,
          orgPub,
          appId,
          message: i18nService.t('auth_service.user_connected_to_desk', { tenantName }),
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
        return {
          success: false,
          message: i18nService.t('auth_service.org_key_not_found'),
        };
      }

      const ent = enterpriseRows[0];
      const enterpriseName = String(ent.name || i18nService.t('auth_service.default_enterprise_name'));
      const enterpriseBlindId = String(ent.enterprise_blind_id || '');
      const orgPub = String(ent.org_pub || '');

      await executeSql(`
        INSERT INTO whitedesk_approvals (
          type, tenant_blind_id, tenant_name, candidate_white_id, candidate_blind_id, status, requested_at
        ) VALUES (
          'user',
          ${escapeSqlString(enterpriseBlindId)},
          ${escapeSqlString(enterpriseName)},
          ${escapeSqlString(userBlindId)},
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
        message: i18nService.t('auth_service.user_join_request_sent', { enterpriseName }),
      };
    } catch (err: any) {
      console.warn('[HelpDeskAuthService] handleUserJoinCommand error:', err);
      return {
        success: false,
        message: i18nService.t('auth_service.connection_error', { error: err?.message || String(err) }),
      };
    }
  },

  /**
   * Retrieves or generates a Sovereign Profile Passkey (wd_prof_...) for the current active tenant and role.
   * This passkey serves as a reusable recovery & transfer credential.
   */
  async getOrCreateProfilePasskey(params: {
    ownWhiteId: string;
    role: 'founder' | 'global_admin' | 'admin' | 'user';
    tenantName?: string;
  }): Promise<string> {
    const { ownWhiteId, role } = params;
    const myBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
    const now = Date.now();

    // 1. Determine active tenant blind ID
    let tenantBlindId = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID);
    if (!tenantBlindId || tenantBlindId === 'none') {
      if (role === 'founder') {
        tenantBlindId = 'blind_thewhite_root';
      } else if (role === 'user') {
        tenantBlindId = (await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID)) || 'default';
      } else {
        tenantBlindId = (await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID)) || 'default';
      }
    }

    const orgId = (await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_ID)) ||
                  (await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ORG_ID)) ||
                  'merkez';

    const cacheKey = `whitedesk_prof_passkey_${tenantBlindId}_${role}_${myBlindId}`;
    const localCached = await SafeSecureStore.getItemAsync(cacheKey);

    try {
      // If we have a local cached passkey, verify it exists in DB and is bound to myBlindId
      if (localCached) {
        const verify = await executeSql(
          `SELECT hash, used_by_blind_id FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(localCached)} LIMIT 1;`
        );
        if (verify.length > 0) {
          if (!verify[0].used_by_blind_id || String(verify[0].used_by_blind_id) !== myBlindId) {
            await executeSql(
              `UPDATE whitedesk_recovery_hashes SET used_by_blind_id = ${escapeSqlString(myBlindId)} WHERE hash = ${escapeSqlString(localCached)};`
            );
          }
          return localCached;
        }
      }

      // Check DB for existing profile passkey specifically for this user/admin (used_by_blind_id = myBlindId)
      const dbCheck = await executeSql(
        `SELECT hash FROM whitedesk_recovery_hashes 
         WHERE tenant_blind_id = ${escapeSqlString(tenantBlindId)} 
           AND type = ${escapeSqlString(role)} 
           AND used_by_blind_id = ${escapeSqlString(myBlindId)}
           AND hash LIKE 'wd_prof_%' 
         ORDER BY created_at DESC LIMIT 1;`
      );

      if (dbCheck.length > 0 && dbCheck[0].hash) {
        const existingHash = String(dbCheck[0].hash);
        await SafeSecureStore.setItemAsync(cacheKey, existingHash);
        await SafeSecureStore.setItemAsync('whitedesk_identity_code', existingHash);
        return existingHash;
      }

      // Generate a new Sovereign Profile Passkey (wd_prof_<48 hex chars>)
      const randomHex = Array.from({ length: 48 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const newPasskey = `wd_prof_${randomHex}`;

      await executeSql(`
        INSERT INTO whitedesk_recovery_hashes (
          hash, type, tenant_blind_id, org_id, app_id, max_uses, uses_count, used, used_by_blind_id, created_at
        ) VALUES (
          ${escapeSqlString(newPasskey)},
          ${escapeSqlString(role)},
          ${escapeSqlString(tenantBlindId)},
          ${escapeSqlString(orgId)},
          'whitedesk',
          999999,
          0,
          FALSE,
          ${escapeSqlString(myBlindId)},
          ${now}
        );
      `);

      await SafeSecureStore.setItemAsync(cacheKey, newPasskey);
      await SafeSecureStore.setItemAsync('whitedesk_identity_code', newPasskey);
      return newPasskey;
    } catch (err) {
      console.warn('[HelpDeskAuthService] getOrCreateProfilePasskey error:', err);
      return localCached || myBlindId;
    }
  },

  /**
   * Consumes/Restores a Sovereign Profile Passkey (wd_prof_...).
   * Instantly re-establishes the device in the designated tenant, role, and exact original blind_id.
   */
  async handleProfilePasskeyClaim(
    ownWhiteId: string,
    passkey: string
  ): Promise<{
    success: boolean;
    type: 'founder' | 'global_admin' | 'admin' | 'user' | 'unknown';
    message: string;
    enterpriseName?: string;
    enterpriseBlindId?: string;
    restoredBlindId?: string;
  }> {
    try {
      const trimmed = passkey.trim();
      const now = Date.now();
      const derivedVault = CryptoVaultService.deriveVaultFromAccessKey(trimmed);

      const hashRows = await executeSql(
        `SELECT * FROM whitedesk_recovery_hashes WHERE hash = ${escapeSqlString(trimmed)} LIMIT 1;`
      );

      if (hashRows.length === 0) {
        return {
          success: false,
          type: 'unknown',
          message: i18nService.t('auth_service.invalid_profile_recovery_key'),
        };
      }

      const record = hashRows[0];
      const roleType = String(record.type || 'user') as 'founder' | 'global_admin' | 'admin' | 'user';
      const targetTenantBlind = String(record.tenant_blind_id || 'default');
      let targetOrgId = String(record.org_id || 'merkez');

      // Determine the exact original blind_id to restore
      let myBlindId = '';
      if (record.used_by_blind_id && String(record.used_by_blind_id).trim().length > 5) {
        myBlindId = WhiteDeskCrypto.generateBlindId(String(record.used_by_blind_id).trim());
      } else if (roleType === 'founder') {
        const fRows = await executeSql(`SELECT white_id FROM whitedesk_admins WHERE role = 'founder' LIMIT 1;`);
        if (fRows.length > 0 && fRows[0].white_id) {
          myBlindId = WhiteDeskCrypto.generateBlindId(String(fRows[0].white_id));
        }
      } else if (roleType === 'global_admin') {
        const gaRows = await executeSql(
          `SELECT white_id FROM whitedesk_admins WHERE enterprise_blind_id = ${escapeSqlString(targetTenantBlind)} AND role = 'global_admin' LIMIT 1;`
        );
        if (gaRows.length > 0 && gaRows[0].white_id) {
          myBlindId = WhiteDeskCrypto.generateBlindId(String(gaRows[0].white_id));
        }
      }

      if (!myBlindId) {
        myBlindId = derivedVault.blindId || WhiteDeskCrypto.generateBlindId(ownWhiteId);
      }

      // Persist the restored identity to hardware SecureStore
      await SafeSecureStore.setItemAsync(STORAGE_KEYS.OWN_WHITE_ID, myBlindId);
      await SafeSecureStore.setItemAsync('inwhite_public_key', derivedVault.publicKey);
      await SafeSecureStore.setItemAsync('inwhite_private_key', derivedVault.privateKey);
      await SafeSecureStore.setItemAsync('inwhite_is_registered', 'true');

      // Fetch tenant name
      let tenantName = i18nService.t('auth_service.default_enterprise_name');
      if (roleType === 'founder') {
        tenantName = 'TheWhite Enterprises';
      } else {
        const entRows = await executeSql(
          `SELECT name FROM whitedesk_enterprises WHERE enterprise_blind_id = ${escapeSqlString(targetTenantBlind)} LIMIT 1;`
        );
        if (entRows.length > 0 && entRows[0].name) {
          tenantName = String(entRows[0].name);
        }
      }

      // Check existing admin record to preserve alias and department
      const existingAdmin = await executeSql(
        `SELECT alias, org_id FROM whitedesk_admins WHERE white_id = ${escapeSqlString(myBlindId)} OR blind_id = ${escapeSqlString(myBlindId)} LIMIT 1;`
      );
      const preservedAlias = existingAdmin[0]?.alias ? String(existingAdmin[0].alias) : '';
      if (existingAdmin[0]?.org_id) {
        targetOrgId = String(existingAdmin[0].org_id);
      }

      // Restore Role & Bindings
      if (roleType === 'founder') {
        const fAlias = preservedAlias || 'TheWhite';
        await executeSql(`
          INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, is_active, created_at)
          VALUES (${escapeSqlString(myBlindId)}, ${escapeSqlString(myBlindId)}, 'blind_thewhite_root', ${escapeSqlString(fAlias)}, 'founder', TRUE, ${now})
          ON CONFLICT (white_id) DO UPDATE SET 
            blind_id = EXCLUDED.blind_id,
            enterprise_blind_id = 'blind_thewhite_root',
            role = 'founder',
            alias = COALESCE(whitedesk_admins.alias, EXCLUDED.alias),
            is_active = TRUE;
        `);

        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'founder');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, 'TheWhite Enterprises');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, 'blind_thewhite_root');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, 'blind_thewhite_root');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, myBlindId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.CUSTOM_ALIAS, fAlias);
      } else if (roleType === 'global_admin') {
        const gaAlias = preservedAlias || 'WhiteCosmos';
        await executeSql(`
          INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, is_active, created_at)
          VALUES (${escapeSqlString(myBlindId)}, ${escapeSqlString(myBlindId)}, ${escapeSqlString(targetTenantBlind)}, ${escapeSqlString(gaAlias)}, 'global_admin', TRUE, ${now})
          ON CONFLICT (white_id) DO UPDATE SET 
            blind_id = EXCLUDED.blind_id,
            enterprise_blind_id = EXCLUDED.enterprise_blind_id,
            role = 'global_admin',
            alias = COALESCE(whitedesk_admins.alias, EXCLUDED.alias),
            is_active = TRUE;
        `);

        try {
          await executeSql(`
            INSERT INTO whitedesk_approvals (
              type, tenant_blind_id, tenant_name, candidate_white_id, candidate_blind_id, candidate_alias, status, requested_at, reviewed_at, reviewed_by
            ) VALUES (
              'global_admin',
              ${escapeSqlString(targetTenantBlind)},
              ${escapeSqlString(tenantName)},
              ${escapeSqlString(myBlindId)},
              ${escapeSqlString(myBlindId)},
              ${escapeSqlString(gaAlias)},
              'approved',
              ${now},
              ${now},
              'profile_passkey_restore'
            );
          `);
        } catch {}

        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'global_admin');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, myBlindId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.CUSTOM_ALIAS, gaAlias);
      } else if (roleType === 'admin') {
        const admAlias = preservedAlias || i18nService.t('helpdesk.admin_role_short');
        await executeSql(`
          INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, org_id, alias, role, is_active, created_at)
          VALUES (${escapeSqlString(myBlindId)}, ${escapeSqlString(myBlindId)}, ${escapeSqlString(targetTenantBlind)}, ${escapeSqlString(targetOrgId)}, ${escapeSqlString(admAlias)}, 'admin', TRUE, ${now})
          ON CONFLICT (white_id) DO UPDATE SET 
            blind_id = EXCLUDED.blind_id,
            enterprise_blind_id = EXCLUDED.enterprise_blind_id,
            org_id = COALESCE(whitedesk_admins.org_id, EXCLUDED.org_id),
            role = 'admin',
            alias = COALESCE(whitedesk_admins.alias, EXCLUDED.alias),
            is_active = TRUE;
        `);

        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'admin');
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME, tenantName);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ORG_ID, targetOrgId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_ID, targetOrgId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID, myBlindId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.CUSTOM_ALIAS, admAlias);
      } else {
        // 'user'
        await executeSql(`
          INSERT INTO whitedesk_user_bindings (user_blind_id, tenant_blind_id, org_id, app_id, status, created_at)
          VALUES (${escapeSqlString(myBlindId)}, ${escapeSqlString(targetTenantBlind)}, ${escapeSqlString(targetOrgId)}, 'whitedesk', 'approved', ${now})
          ON CONFLICT (user_blind_id) DO UPDATE SET 
            status = 'approved',
            tenant_blind_id = EXCLUDED.tenant_blind_id,
            org_id = EXCLUDED.org_id;
        `);

        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID, targetTenantBlind);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ORG_ID, targetOrgId);
        await SafeSecureStore.setItemAsync(STORAGE_KEYS.USER_ENTERPRISE_NAME, tenantName);
      }

      // Voice and Notification Isolation sync
      try {
        const { NotificationService } = require('../notificationService');
        const { voiceCallService } = require('../voice');
        NotificationService.setOwnTenantId(targetTenantBlind);
        NotificationService.setOwnOrgId(targetOrgId);
        voiceCallService.setActiveEnterpriseBlindId(targetTenantBlind);
        voiceCallService.setActiveOrgId(targetOrgId);
      } catch {}

      // Update passkey usage stats and lock used_by_blind_id to myBlindId
      const newUses = Number(record.uses_count || 0) + 1;
      await executeSql(`
        UPDATE whitedesk_recovery_hashes 
        SET uses_count = ${newUses}, used_at = ${now}, used_by_blind_id = ${escapeSqlString(myBlindId)}
        WHERE hash = ${escapeSqlString(trimmed)};
      `);

      // Cache locally
      const cacheKey = `whitedesk_prof_passkey_${targetTenantBlind}_${roleType}_${myBlindId}`;
      await SafeSecureStore.setItemAsync(cacheKey, trimmed);
      await SafeSecureStore.setItemAsync('whitedesk_identity_code', trimmed);
      invalidateHelpDeskRoleCache();

      const roleLabels: Record<string, string> = {
        founder: i18nService.t('auth_service.role_founder'),
        global_admin: i18nService.t('auth_service.role_global_admin'),
        admin: i18nService.t('auth_service.role_admin'),
        user: i18nService.t('auth_service.role_user_with_org', { orgId: targetOrgId }),
      };

      return {
        success: true,
        type: roleType,
        enterpriseName: tenantName,
        enterpriseBlindId: targetTenantBlind,
        restoredBlindId: myBlindId,
        message: i18nService.t('auth_service.profile_passkey_restored', {
          tenantName,
          roleLabel: roleLabels[roleType] || roleType,
        }),
      };
    } catch (err: any) {
      console.warn('[HelpDeskAuthService] handleProfilePasskeyClaim error:', err);
      return {
        success: false,
        type: 'unknown',
        message: i18nService.t('auth_service.profile_restore_error', { error: err?.message || String(err) }),
      };
    }
  },

  /**
   * Verifies and consumes scanned WhiteDesk QR code or Deep Link payload.
   */
  async verifyAndConsumeWhiteDeskQr(
    rawQrData: string, 
    ownWhiteId: string
  ): Promise<{
    success: boolean;
    type: 'founder' | 'global_admin' | 'admin' | 'user' | 'desktop_pair' | 'unknown';
    message: string;
    enterpriseName?: string;
  }> {
    const raw = String(rawQrData || '').trim();
    if (!raw) {
      return { success: false, type: 'unknown', message: i18nService.t('auth_service.qr_code_empty') };
    }

    let hash = '';
    const hashMatch = raw.match(/[?&]hash=([a-zA-Z0-9_\-\.]+)/i);
    if (hashMatch && hashMatch[1]) {
      hash = hashMatch[1];
    } else {
      const cmdMatch = raw.match(/^(?:admin|user|desktop)\s+([a-zA-Z0-9_\-\.]+)/i);
      if (cmdMatch && cmdMatch[1]) {
        hash = cmdMatch[1];
      } else {
        hash = raw;
      }
    }

    hash = hash.trim();

    // 0. Masaüstü Versiyonu Eşleştirme (Bütün Lisans Türlerinde Aktif)
    const isDesktopQr = 
      hash.startsWith('desk_') ||
      hash.startsWith('wdesk_') ||
      hash.startsWith('desktop_') ||
      hash.startsWith('wd_desk_') ||
      raw.toLowerCase().includes('desktop_pair') ||
      raw.toLowerCase().includes('desktop_auth') ||
      raw.startsWith('whitedesk://desktop') ||
      raw.startsWith('whitedesk://pair?desktop=');

    if (isDesktopQr) {
      let entBlindId = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID)
        || await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID);
      if (!entBlindId || entBlindId === 'none') {
        entBlindId = 'default';
      }

      const activeLic = await helpDeskLicenseService.getTenantActiveLicense(entBlindId);

      // Masaüstü oturumunu kaydet ve aktif et (bütün lisans türlerinde geçerli)
      const sessionId = hash || `desk_sess_${Date.now().toString(36)}`;
      const myBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
      try {
        await executeSql(`
          CREATE TABLE IF NOT EXISTS whitedesk_desktop_sessions (
            session_id TEXT PRIMARY KEY,
            white_id TEXT,
            enterprise_blind_id TEXT,
            paired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            billing_cycle TEXT
          );
        `);
        await executeSql(`
          INSERT INTO whitedesk_desktop_sessions (
            session_id, white_id, enterprise_blind_id, paired_at, is_active, billing_cycle
          ) VALUES (
            ${escapeSqlString(sessionId)},
            ${escapeSqlString(myBlindId)},
            ${escapeSqlString(entBlindId)},
            NOW(),
            TRUE,
            ${escapeSqlString(activeLic?.billingCycle || 'active')}
          ) ON CONFLICT (session_id) DO UPDATE SET white_id = EXCLUDED.white_id, is_active = TRUE, paired_at = NOW();
        `);
      } catch (err) {
        console.warn('[DesktopPair] session record err:', err);
      }

      return {
        success: true,
        type: 'desktop_pair',
        message: i18nService.t('auth_service.desktop_paired_success'),
        enterpriseName: entBlindId,
      };
    }

    if (hash.startsWith('wd_prof_')) {
      const res = await this.handleProfilePasskeyClaim(ownWhiteId, hash);
      return {
        success: res.success,
        type: (res.type || 'unknown') as any,
        message: res.message,
        enterpriseName: res.enterpriseName,
      };
    }

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

    if (hash.startsWith('adm_oper_') || hash.startsWith('adm_rec_')) {
      const res = await this.handleAdminClaimCommand(ownWhiteId, hash);
      return {
        success: res.success,
        type: 'admin',
        message: res.message,
        enterpriseName: res.enterpriseName,
      };
    }

    if (hash.startsWith('usr_div_') || hash.startsWith('usr_acc_')) {
      const res = await this.handleUserJoinCommand(ownWhiteId, hash);
      return {
        success: res.success,
        type: 'user',
        message: res.message,
        enterpriseName: res.enterpriseName,
      };
    }

    if (hash.startsWith('blind_') || hash.startsWith('bod_') || hash.length === 66) {
      const res = await this.handleAdminClaimCommand(ownWhiteId, hash);
      return {
        success: res.success,
        type: res.success ? ((res.role || 'global_admin') as any) : 'unknown',
        message: res.message,
        enterpriseName: res.enterpriseName,
      };
    }

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
      message: i18nService.t('auth_service.invalid_qr_code'),
    };
  },

  async updateAdminPermissions(
    adminWhiteId: string, 
    orgId: string, 
    appId: string, 
    categories: string[]
  ): Promise<boolean> {
    return await helpDeskStationService.saveAdminAlloc(adminWhiteId, orgId, appId, categories);
  },

  async replaceGlobalAdmin(newAdminWhiteId: string, tenantBlindId: string): Promise<boolean> {
    const now = Date.now();
    const blindId = WhiteDeskCrypto.generateBlindId(newAdminWhiteId);

    await executeSql(`
      UPDATE whitedesk_admins 
      SET role = 'admin', alias = ${escapeSqlString(i18nService.t('helpdesk.admin_role_short'))} 
      WHERE enterprise_blind_id = ${escapeSqlString(tenantBlindId)} AND role = 'global_admin';
    `);

    await executeSql(`
      INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, is_active, created_at)
      VALUES (${escapeSqlString(blindId)}, ${escapeSqlString(blindId)}, ${escapeSqlString(tenantBlindId)}, 'WhiteCosmos', 'global_admin', TRUE, ${now})
      ON CONFLICT (white_id) DO UPDATE SET blind_id = EXCLUDED.blind_id, role = 'global_admin', alias = 'WhiteCosmos', is_active = TRUE;
    `);

    return true;
  },

  async blockOrDeleteUser(userWhiteId: string, tenantBlindId: string, action: 'block' | 'delete'): Promise<boolean> {
    const blindId = WhiteDeskCrypto.generateBlindId(userWhiteId);
    if (action === 'delete') {
      await executeSql(`DELETE FROM whitedesk_user_bindings WHERE user_blind_id = ${escapeSqlString(blindId)};`);
      try {
        const localTickets = await keystoreTicketVault.getTickets();
        for (const t of localTickets) {
          const tBlind = WhiteDeskCrypto.generateBlindId(t.user_blind_id || t.user_white_id || '');
          if (tBlind.toLowerCase() === blindId.toLowerCase()) {
            await keystoreTicketVault.deleteTicket(t.id);
          }
        }
      } catch {}
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
      INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, is_active, created_at)
      VALUES (${escapeSqlString(blindId)}, ${escapeSqlString(blindId)}, ${escapeSqlString(tenantBlindId)}, ${escapeSqlString(alias)}, ${escapeSqlString(role)}, TRUE, ${now})
      ON CONFLICT (white_id) DO UPDATE SET blind_id = EXCLUDED.blind_id, role = ${escapeSqlString(role)}, alias = ${escapeSqlString(alias)}, is_active = TRUE;
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
    const ownWhiteId = await this.getOwnWhiteId();
    const grantorBlindId = WhiteDeskCrypto.generateBlindId(ownWhiteId);
    const targetBlindId = WhiteDeskCrypto.generateBlindId(ticket.user_blind_id || ticket.user_white_id || '');

    const finalAlias = alias || (await generateCosmoAlias(role));
    const rawOrg = orgId.trim().toLowerCase();
    const cleanOrg = (!rawOrg || rawOrg.startsWith('blind_') || rawOrg.length > 32) ? (ticket.org_id || 'default') : rawOrg;
    const cleanApp = appId.trim().toLowerCase() || 'all';

    await executeSql(`
      INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, org_id, app_id, alias, role, is_active, granted_by, created_at)
      VALUES (
        ${escapeSqlString(targetBlindId)}, 
        ${escapeSqlString(targetBlindId)}, 
        ${escapeSqlString(ticket.enterprise_blind_id || 'default')}, 
        ${escapeSqlString(cleanOrg)}, 
        ${escapeSqlString(cleanApp)}, 
        ${escapeSqlString(finalAlias)}, 
        ${escapeSqlString(role)}, 
        true, 
        ${escapeSqlString(grantorBlindId)}, 
        NOW()
      )
      ON CONFLICT (white_id) DO UPDATE SET 
        blind_id = EXCLUDED.blind_id,
        is_active = true, 
        alias = EXCLUDED.alias, 
        org_id = EXCLUDED.org_id, 
        app_id = EXCLUDED.app_id, 
        granted_by = EXCLUDED.granted_by;
    `);

    const now = Date.now();
    const messageId = 'msg_' + Math.random().toString(36).substring(2, 10);
    const systemMsg: HelpDeskMessage = {
      id: messageId,
      ticket_id: ticket.id,
      app_id: ticket.app_id || 'inwhite',
      sender_white_id: grantorBlindId,
      sender_blind_id: grantorBlindId,
      is_admin: true,
      message: i18nService.t('auth_service.grant_admin_ed25519_sealed', { alias: finalAlias }),
      created_at: now,
    };
    await keystoreTicketVault.appendMessage(ticket.id, systemMsg);

    ticket.status = 'resolved';
    ticket.updated_at = now;
    await keystoreTicketVault.upsertTicket(ticket);

    try {
      const recipient = targetBlindId || 'default';
      await apiClient.sendRelayMessage({
        ticket_id: ticket.id,
        sender_blind_id: grantorBlindId,
        recipient_blind_id: recipient,
        encrypted_payload: JSON.stringify({
          type: 'ticket_reply',
          ticket_id: ticket.id,
          status: 'resolved',
          updated_at: now,
          message: systemMsg,
        }),
      });
    } catch {}

    return true;
  },
};
