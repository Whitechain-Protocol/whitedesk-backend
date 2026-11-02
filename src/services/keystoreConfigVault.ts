// @ts-ignore
import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { SafeSecureStore } from './storageService';
import type { 
  HelpDeskCategory, 
  OrgEntry, 
  AppCatEntry, 
  TenantEntry 
} from './helpDeskService';
import {
  AdvancedFeaturesConfig,
  DEFAULT_ADVANCED_FEATURES_CONFIG,
} from '../components/helpdesk/types';

// Polyfill CryptoJS.lib.WordArray.random for Hermes using expo-crypto SecureRandom
try {
  CryptoJS.lib.WordArray.random = function (nBytes: number) {
    try {
      const bytes = Crypto.getRandomBytes(nBytes);
      const words: number[] = [];
      for (let i = 0; i < nBytes; i += 4) {
        words.push(
          ((bytes[i] || 0) << 24) |
          ((bytes[i + 1] || 0) << 16) |
          ((bytes[i + 2] || 0) << 8) |
          ((bytes[i + 3] || 0) << 0)
        );
      }
      return CryptoJS.lib.WordArray.create(words, nBytes);
    } catch {
      const words: number[] = [];
      for (let i = 0; i < nBytes; i += 4) {
        words.push((Math.random() * 0x100000000) >>> 0);
      }
      return CryptoJS.lib.WordArray.create(words, nBytes);
    }
  };
} catch {}

const VAULT_KEY_ALIAS = 'whitedesk_keystore_master_aes_key';
const CONFIG_VAULT_FILE = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/whitedesk_vault_config.enc`;

export interface TenantMetaVault {
  name?: string;
  enterpriseBlindId?: string;
  logoUri?: string | null;
  logoAlign?: 'left' | 'center' | 'right';
  customFields?: Array<{ key: string; label: string; required?: boolean }>;
  catalog?: Array<Record<string, string>>;
  advancedConfig?: AdvancedFeaturesConfig;
  updatedAt?: number;
}

export interface SystemVaultConfig {
  tenantsMeta: Record<string, TenantMetaVault>;
  categories: Record<string, HelpDeskCategory[]>;
  orgs: Record<string, OrgEntry[]>;
  apps: Record<string, AppCatEntry[]>;
  allTenants: TenantEntry[];
  lastSyncedAt?: number;
}

const DEFAULT_CONFIG: SystemVaultConfig = {
  tenantsMeta: {},
  categories: {},
  orgs: {},
  apps: {},
  allTenants: [],
  lastSyncedAt: 0,
};

class KeystoreConfigVault {
  private masterKey: string | null = null;
  private inMemoryCache: SystemVaultConfig | null = null;

  private async getMasterKey(): Promise<string> {
    if (this.masterKey) return this.masterKey;

    let key = await SafeSecureStore.getItemAsync(VAULT_KEY_ALIAS);
    if (!key) {
      try {
        const randBytes = await Crypto.getRandomBytesAsync(32);
        key = Array.from(randBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch {
        key = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      }
      await SafeSecureStore.setItemAsync(VAULT_KEY_ALIAS, key);
    }
    const resolvedKey: string = key ? key : 'whitedesk_vault_key_fixed_256';
    this.masterKey = resolvedKey;
    return resolvedKey;
  }

  /**
   * 0ms Instant Local Read: Decrypts all tenant and system configurations from local Keystore vault.
   */
  async getConfig(): Promise<SystemVaultConfig> {
    if (this.inMemoryCache) {
      return this.inMemoryCache;
    }

    try {
      const exists = await ReactNativeBlobUtil.fs.exists(CONFIG_VAULT_FILE);
      if (exists) {
        const ciphertext = await ReactNativeBlobUtil.fs.readFile(CONFIG_VAULT_FILE, 'utf8');
        if (ciphertext && ciphertext.trim()) {
          const key = await this.getMasterKey();
          const decryptedBytes = CryptoJS.AES.decrypt(ciphertext.trim(), key);
          const decryptedJson = decryptedBytes.toString(CryptoJS.enc.Utf8);
          if (decryptedJson) {
            const parsed = JSON.parse(decryptedJson);
            if (parsed && typeof parsed === 'object') {
              const loaded: SystemVaultConfig = { ...DEFAULT_CONFIG, ...parsed };
              this.inMemoryCache = loaded;
              return loaded;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[KeystoreConfigVault] Error reading encrypted config vault:', err);
    }

    const fallback: SystemVaultConfig = { ...DEFAULT_CONFIG };
    this.inMemoryCache = fallback;
    return fallback;
  }

  /**
   * Encrypts and persists configuration to sandboxed filesystem.
   */
  async saveConfig(config: SystemVaultConfig): Promise<void> {
    this.inMemoryCache = config;
    try {
      const key = await this.getMasterKey();
      const rawJson = JSON.stringify(config);
      const ciphertext = CryptoJS.AES.encrypt(rawJson, key).toString();
      await ReactNativeBlobUtil.fs.writeFile(CONFIG_VAULT_FILE, ciphertext, 'utf8');
    } catch (err) {
      console.warn('[KeystoreConfigVault] Error saving encrypted config vault:', err);
    }
  }

  // --- TENANT META ---
  async getTenantMeta(tenantId: string = 'default'): Promise<TenantMetaVault> {
    const config = await this.getConfig();
    return config.tenantsMeta[tenantId] || {
      enterpriseBlindId: tenantId,
      logoAlign: 'left',
      advancedConfig: DEFAULT_ADVANCED_FEATURES_CONFIG,
    };
  }

  async setTenantMeta(tenantId: string = 'default', meta: Partial<TenantMetaVault>): Promise<void> {
    const config = await this.getConfig();
    const existing = config.tenantsMeta[tenantId] || {};
    config.tenantsMeta[tenantId] = {
      ...existing,
      ...meta,
      updatedAt: Date.now(),
    };
    await this.saveConfig(config);
  }

  // --- CATEGORIES ---
  async getCategories(tenantId: string = 'all'): Promise<HelpDeskCategory[]> {
    const config = await this.getConfig();
    return config.categories[tenantId] || config.categories['all'] || [];
  }

  async setCategories(tenantId: string = 'all', categories: HelpDeskCategory[]): Promise<void> {
    const config = await this.getConfig();
    config.categories[tenantId] = categories;
    await this.saveConfig(config);
  }

  // --- ORGS ---
  async getOrgs(tenantId: string = 'all'): Promise<OrgEntry[]> {
    const config = await this.getConfig();
    return config.orgs[tenantId] || config.orgs['all'] || [];
  }

  async setOrgs(tenantId: string = 'all', orgs: OrgEntry[]): Promise<void> {
    const config = await this.getConfig();
    config.orgs[tenantId] = orgs;
    await this.saveConfig(config);
  }

  // --- APPS ---
  async getApps(tenantId: string = 'all'): Promise<AppCatEntry[]> {
    const config = await this.getConfig();
    return config.apps[tenantId] || config.apps['all'] || [];
  }

  async setApps(tenantId: string = 'all', apps: AppCatEntry[]): Promise<void> {
    const config = await this.getConfig();
    config.apps[tenantId] = apps;
    await this.saveConfig(config);
  }

  // --- ALL TENANTS ---
  async getAllTenants(): Promise<TenantEntry[]> {
    const config = await this.getConfig();
    return config.allTenants || [];
  }

  async setAllTenants(tenants: TenantEntry[]): Promise<void> {
    const config = await this.getConfig();
    config.allTenants = tenants;
    await this.saveConfig(config);
  }
}

export const keystoreConfigVault = new KeystoreConfigVault();
