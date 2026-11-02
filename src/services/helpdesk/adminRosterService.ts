import { AppState, NativeEventSubscription } from 'react-native';
import { SafeSecureStore } from '../storageService';
import { apiClient } from '../apiClient';
import { WhiteDeskCrypto } from '../../whitedesk-sdk';
import { keystoreTicketVault } from '../keystoreTicketVault';

const STORAGE_KEY_ROSTER_STATUS = 'wb_roster_admin_status';
const STORAGE_KEY_ROSTER_SUB_STATUS = 'wb_roster_admin_sub_status';
const STORAGE_KEY_ROSTER_CUSTOM_REASON = 'wb_roster_admin_custom_reason';
const STORAGE_KEY_ROSTER_SNOOZE = 'wb_roster_admin_snooze_until';

export type AdminSubStatus = 'izinde' | 'molada' | 'diger';

export interface AdminBreakState {
  isActive: boolean;
  subStatus?: AdminSubStatus;
  customReason?: string;
  snoozeUntil: number | null;
}

class AdminRosterService {
  private timer: any = null;
  private autoActiveTimer: any = null;
  private appStateSubscription: NativeEventSubscription | null = null;
  private currentWhiteId: string = '';
  private currentEnterpriseBlindId: string = '';
  private currentAlias: string = '';
  private listeners: Set<(state: AdminBreakState) => void> = new Set();

  /**
   * Subscribes to admin break/active state changes.
   */
  subscribe(listener: (state: AdminBreakState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(state: AdminBreakState): void {
    this.listeners.forEach((cb) => {
      try { cb(state); } catch {}
    });
  }

  /**
   * Initializes and starts 60-second background heartbeat loop for an admin.
   * Also listens to app foreground events (AppState active) to evaluate break return on entry.
   */
  startHeartbeat(params: {
    whiteId: string;
    enterpriseBlindId: string;
    alias?: string;
  }): void {
    this.currentWhiteId = params.whiteId;
    this.currentEnterpriseBlindId = params.enterpriseBlindId;
    this.currentAlias = params.alias || '';

    if (this.timer) clearInterval(this.timer);

    // Initial heartbeat
    void this.sendHeartbeat();

    // 60-second periodic heartbeat
    this.timer = setInterval(() => {
      void this.sendHeartbeat();
    }, 60000);

    // AppState listener: Admin uygulamaya giriş yaptıkça / ön plana aldıkça mola dönüşü tetiklenir!
    if (!this.appStateSubscription) {
      this.appStateSubscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          console.log('[AdminRosterService] App entered foreground: evaluating admin break return...');
          void this.getBreakStatus().then(() => this.sendHeartbeat());
        }
      });
    }
  }

  stopHeartbeat(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.autoActiveTimer) {
      clearTimeout(this.autoActiveTimer);
      this.autoActiveTimer = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  /**
   * Reads cached admin status. Automatically flips to 'active' if snooze period expired.
   */
  async getBreakStatus(): Promise<AdminBreakState> {
    try {
      const savedStatus = await SafeSecureStore.getItemAsync(STORAGE_KEY_ROSTER_STATUS);
      const savedSubStatus = await SafeSecureStore.getItemAsync(STORAGE_KEY_ROSTER_SUB_STATUS) as AdminSubStatus | null;
      const savedReason = await SafeSecureStore.getItemAsync(STORAGE_KEY_ROSTER_CUSTOM_REASON);
      const savedSnooze = await SafeSecureStore.getItemAsync(STORAGE_KEY_ROSTER_SNOOZE);
      const snoozeUntil = savedSnooze ? Number(savedSnooze) : null;

      if (savedStatus === 'passive' || savedStatus === 'break') {
        if (snoozeUntil && snoozeUntil <= Date.now()) {
          // ⏰ Süre doldu! Otomatik olarak 'Aktif' durumuna dön!
          console.log('[AdminRosterService] Snooze duration expired, automatically restoring to AKTIF.');
          await this.setBreakStatus(true);
          return { isActive: true, snoozeUntil: null };
        }
        return {
          isActive: false,
          subStatus: savedSubStatus || 'molada',
          customReason: savedReason || undefined,
          snoozeUntil,
        };
      }
      return { isActive: true, snoozeUntil: null };
    } catch {
      return { isActive: true, snoozeUntil: null };
    }
  }

  /**
   * Checks if break/passive period has expired upon admin entry/login.
   * If expired, automatically restores admin to 'Aktif' and dispatches online heartbeat.
   */
  async checkBreakReturnOnEntry(whiteId?: string, enterpriseBlindId?: string): Promise<boolean> {
    if (whiteId) this.currentWhiteId = whiteId;
    if (enterpriseBlindId) this.currentEnterpriseBlindId = enterpriseBlindId;
    const status = await this.getBreakStatus();
    return status.isActive;
  }

  /**
   * Updates admin status (Aktif vs Pasif: İzinde, Molada, Diğer) and duration.
   */
  async setBreakStatus(
    isActive: boolean,
    snoozeMinutes?: number,
    subStatus?: AdminSubStatus,
    customReason?: string
  ): Promise<boolean> {
    try {
      const now = Date.now();
      const snoozeUntil = (!isActive && snoozeMinutes && snoozeMinutes > 0)
        ? now + snoozeMinutes * 60 * 1000
        : null;

      if (this.autoActiveTimer) {
        clearTimeout(this.autoActiveTimer);
        this.autoActiveTimer = null;
      }

      await SafeSecureStore.setItemAsync(STORAGE_KEY_ROSTER_STATUS, isActive ? 'active' : 'passive');
      
      if (!isActive && subStatus) {
        await SafeSecureStore.setItemAsync(STORAGE_KEY_ROSTER_SUB_STATUS, subStatus);
      } else if (isActive) {
        await SafeSecureStore.deleteItemAsync(STORAGE_KEY_ROSTER_SUB_STATUS);
      }

      if (!isActive && customReason) {
        await SafeSecureStore.setItemAsync(STORAGE_KEY_ROSTER_CUSTOM_REASON, customReason);
      } else if (isActive) {
        await SafeSecureStore.deleteItemAsync(STORAGE_KEY_ROSTER_CUSTOM_REASON);
      }

      if (snoozeUntil) {
        await SafeSecureStore.setItemAsync(STORAGE_KEY_ROSTER_SNOOZE, String(snoozeUntil));
        
        // ⏰ Belirlenen süre sonunda otomatik Aktif yapacak yerel zamanlayıcı kur
        const remainingMs = snoozeUntil - now;
        if (remainingMs > 0 && remainingMs <= 2147483647) {
          this.autoActiveTimer = setTimeout(() => {
            console.log('[AdminRosterService] Timer triggered: Automatically restoring to Aktif!');
            void this.setBreakStatus(true);
          }, remainingMs);
        }
      } else {
        await SafeSecureStore.deleteItemAsync(STORAGE_KEY_ROSTER_SNOOZE);
      }

      await this.sendHeartbeat(isActive ? 1 : 0, snoozeUntil || undefined);
      this.notifyListeners({ isActive, subStatus: !isActive ? subStatus : undefined, customReason: !isActive ? customReason : undefined, snoozeUntil });
      return true;
    } catch (e) {
      console.warn('[AdminRosterService] setBreakStatus error:', e);
      return false;
    }
  }

  /**
   * Dispatches heartbeat to Cloudflare D1.
   */
  async sendHeartbeat(forceIsActive?: number, forceSnoozeUntil?: number): Promise<void> {
    if (!this.currentWhiteId || !this.currentEnterpriseBlindId) return;

    try {
      const blindId = WhiteDeskCrypto.generateBlindId(this.currentWhiteId);
      const { isActive, snoozeUntil } = await this.getBreakStatus();

      const effectiveIsActive = forceIsActive !== undefined ? forceIsActive : (isActive ? 1 : 0);
      const effectiveSnoozeUntil = forceSnoozeUntil !== undefined ? forceSnoozeUntil : (snoozeUntil || undefined);

      // Count locally open tickets assigned to this admin
      const allTickets = await keystoreTicketVault.getTickets();
      const openCount = allTickets.filter(
        t => t.assigned_admin_blind_id === blindId && t.status === 'open'
      ).length;

      const res = await apiClient.sendRosterHeartbeat({
        blind_id: blindId,
        enterprise_blind_id: this.currentEnterpriseBlindId,
        name: this.currentAlias || this.currentWhiteId,
        is_active: effectiveIsActive,
        snooze_until: effectiveSnoozeUntil,
        open_tickets: openCount,
      });

      console.log(`[AdminRosterService] Heartbeat sent (${effectiveIsActive === 1 ? 'AKTIF' : 'PASIF'}, open: ${openCount}):`, res);
    } catch (e) {
      console.warn('[AdminRosterService] Heartbeat failed:', e);
    }
  }
}

export const adminRosterService = new AdminRosterService();
