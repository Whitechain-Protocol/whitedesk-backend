import { SafeSecureStore } from './storageService';
import { CryptoService } from './cryptoService';
import { invalidateHelpDeskRoleCache } from './helpDeskService';

export interface AuthActionPayload {
  action: 'PROMOTE' | 'REVOKE';
  targetWhiteId: string;
  targetRole?: 'admin' | 'global_admin' | 'none';
  tenantBlindId: string;
  enterpriseName?: string;
  initiatorWhiteId: string;
  initiatorRole: 'founder' | 'global_admin' | 'admin';
  signature?: string;
  timestamp: number;
}

type AuthActionListener = (action: AuthActionPayload) => void;

const STORAGE_KEYS = {
  ADMIN_ROLE: 'inwhite_helpdesk_admin_role',
  ADMIN_ENTERPRISE_BLIND_ID: 'inwhite_helpdesk_admin_enterprise_blind_id',
  ADMIN_ORG_PUB: 'inwhite_helpdesk_admin_org_pub',
  ADMIN_ENTERPRISE_NAME: 'inwhite_helpdesk_admin_enterprise_name',
  ADMIN_WHITE_ID: 'inwhite_helpdesk_admin_white_id',
  CUSTOM_ALIAS: 'inwhite_helpdesk_custom_alias',
};

// Configurable endpoint for Cloudflare Worker & Durable Object Relay
const RELAY_BASE_URL =
  process.env.EXPO_PUBLIC_DO_RELAY_URL || 'https://whitedesk-auth-relay.whitechain.workers.dev';

class EphemeralAuthService {
  private ws: WebSocket | null = null;
  private ownWhiteId: string = '';
  private ownRole: string = 'user';
  private tenantBlindId: string = 'default';
  private listeners: Set<AuthActionListener> = new Set();
  private reconnectTimer: any = null;
  private isDestroyed: boolean = false;

  /**
   * Initializes real-time Durable Object listener for this client enclave.
   */
  public init(ownWhiteId: string, currentRole: string = 'user', tenantBlindId: string = 'default') {
    this.ownWhiteId = ownWhiteId.trim().toLowerCase();
    this.ownRole = currentRole;
    this.tenantBlindId = tenantBlindId || 'default';
    this.isDestroyed = false;

    if (!this.ownWhiteId) return;

    this.connectWebSocket();
  }

  /**
   * Subscribes UI or services to real-time promotion/revocation events.
   */
  public addListener(listener: AuthActionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Connects to the Cloudflare Durable Object via WebSocket.
   */
  private connectWebSocket() {
    if (this.isDestroyed || !this.ownWhiteId) return;

    try {
      if (this.ws) {
        try {
          this.ws.close();
        } catch {}
        this.ws = null;
      }

      const wsProtocol = RELAY_BASE_URL.startsWith('https') ? 'wss:' : 'ws:';
      const cleanHost = RELAY_BASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const wsUrl = `${wsProtocol}//${cleanHost}/ws?whiteId=${encodeURIComponent(
        this.ownWhiteId
      )}&role=${encodeURIComponent(this.ownRole)}&tenant=${encodeURIComponent(
        this.tenantBlindId
      )}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Send initial keepalive
        this.sendPing();
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === 'AUTH_ACTION' && data?.payload) {
            await this.handleIncomingAction(data.payload as AuthActionPayload);
          }
        } catch (err) {
          console.warn('[EphemeralAuth] Message parse error:', err);
        }
      };

      this.ws.onerror = (e) => {
        // Silent error handler; will fallback to HTTP or reconnect
      };

      this.ws.onclose = () => {
        this.ws = null;
        if (!this.isDestroyed) {
          // Reconnect with backoff
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 15_000);
        }
      };
    } catch (e) {
      // Ignore initial connection failure in offline mode
    }
  }

  private sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      } catch {}
    }
  }

  /**
   * Dispatches a promotion action (User -> Admin OR Admin -> Global Admin).
   */
  public async dispatchPromotion(params: {
    targetWhiteId: string;
    targetRole: 'admin' | 'global_admin';
    tenantBlindId: string;
    enterpriseName?: string;
    initiatorWhiteId: string;
    initiatorRole: 'founder' | 'global_admin' | 'admin';
  }): Promise<{ success: boolean; deliveredOnline?: boolean }> {
    const payload: AuthActionPayload = {
      action: 'PROMOTE',
      targetWhiteId: params.targetWhiteId.trim().toLowerCase(),
      targetRole: params.targetRole,
      tenantBlindId: params.tenantBlindId,
      enterpriseName: params.enterpriseName,
      initiatorWhiteId: params.initiatorWhiteId,
      initiatorRole: params.initiatorRole,
      timestamp: Date.now(),
    };

    // Sign payload using P-256
    try {
      const dataToSign = `${payload.action}:${payload.targetWhiteId}:${payload.targetRole}:${payload.tenantBlindId}:${payload.timestamp}`;
      payload.signature = await CryptoService.signData(dataToSign);
    } catch {}

    return await this.sendActionToRelay(payload);
  }

  /**
   * Dispatches a revocation action ("Poison Pill" remote vault wipe).
   */
  public async dispatchRevocation(params: {
    targetWhiteId: string;
    tenantBlindId: string;
    initiatorWhiteId: string;
    initiatorRole: 'founder' | 'global_admin' | 'admin';
  }): Promise<{ success: boolean; deliveredOnline?: boolean }> {
    const payload: AuthActionPayload = {
      action: 'REVOKE',
      targetWhiteId: params.targetWhiteId.trim().toLowerCase(),
      targetRole: 'none',
      tenantBlindId: params.tenantBlindId,
      initiatorWhiteId: params.initiatorWhiteId,
      initiatorRole: params.initiatorRole,
      timestamp: Date.now(),
    };

    // Sign revocation command
    try {
      const dataToSign = `${payload.action}:${payload.targetWhiteId}:${payload.tenantBlindId}:${payload.timestamp}`;
      payload.signature = await CryptoService.signData(dataToSign);
    } catch {}

    return await this.sendActionToRelay(payload);
  }

  /**
   * Sends action payload to Cloudflare Durable Object via HTTP POST relay.
   */
  private async sendActionToRelay(
    payload: AuthActionPayload
  ): Promise<{ success: boolean; deliveredOnline?: boolean }> {
    try {
      const url = `${RELAY_BASE_URL.replace(/\/$/, '')}/dispatch-action?tenant=${encodeURIComponent(
        payload.tenantBlindId || 'default'
      )}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        return { success: true, deliveredOnline: json.deliveredOnline };
      }
      return { success: false };
    } catch {
      // In offline / fallback scenario, still return false gracefully
      return { success: false };
    }
  }

  /**
   * Executes local vault updates upon receiving a verified action targeting this device.
   */
  public async handleIncomingAction(payload: AuthActionPayload) {
    if (!payload || !payload.targetWhiteId) return;

    const myId = this.ownWhiteId.toLowerCase();
    const targetId = payload.targetWhiteId.toLowerCase();

    if (myId !== targetId) return;

    if (payload.action === 'REVOKE') {
      // 🚨 POISON PILL: Wipe admin keys from local hardware SecureStore
      await this.wipeLocalAdminVault();
    } else if (payload.action === 'PROMOTE') {
      // 👑 PROMOTE: Elevate local credentials
      await this.elevateLocalVault(payload);
    }

    // Notify registered UI listeners
    for (const listener of this.listeners) {
      try {
        listener(payload);
      } catch (err) {
        console.warn('[EphemeralAuth] Listener error:', err);
      }
    }
  }

  /**
   * Complete remote vault wipe: Clears all local admin tokens, returning device to pure User role.
   */
  public async wipeLocalAdminVault() {
    await SafeSecureStore.deleteItemAsync(STORAGE_KEYS.ADMIN_ROLE);
    await SafeSecureStore.deleteItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_NAME);
    await SafeSecureStore.deleteItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID);
    await SafeSecureStore.deleteItemAsync(STORAGE_KEYS.ADMIN_WHITE_ID);
    await SafeSecureStore.deleteItemAsync(STORAGE_KEYS.ADMIN_ORG_PUB);
    await SafeSecureStore.deleteItemAsync(STORAGE_KEYS.CUSTOM_ALIAS);
    await SafeSecureStore.deleteItemAsync('inwhite_helpdesk_admin_role');
    await SafeSecureStore.deleteItemAsync('inwhite_helpdesk_admin_enterprise_name');

    await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, 'none');
    this.ownRole = 'user';
    invalidateHelpDeskRoleCache();
  }

  /**
   * Elevates local vault credentials upon receiving promotion.
   */
  private async elevateLocalVault(payload: AuthActionPayload) {
    const role = payload.targetRole || 'admin';
    await SafeSecureStore.setItemAsync(STORAGE_KEYS.ADMIN_ROLE, role);
    this.ownRole = role;

    if (payload.tenantBlindId) {
      await SafeSecureStore.setItemAsync(
        STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID,
        payload.tenantBlindId
      );
    }
    if (payload.enterpriseName) {
      await SafeSecureStore.setItemAsync(
        STORAGE_KEYS.ADMIN_ENTERPRISE_NAME,
        payload.enterpriseName
      );
    }

    invalidateHelpDeskRoleCache();
  }

  public destroy() {
    this.isDestroyed = true;
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.listeners.clear();
  }
}

export const ephemeralAuthService = new EphemeralAuthService();
