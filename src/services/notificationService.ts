import { NativeModules, PermissionsAndroid, Platform, DeviceEventEmitter } from 'react-native';
import { apiClient } from './apiClient';
import { WhiteDeskCrypto } from '../whitedesk-sdk';
import { SafeSecureStore } from './storageService';
import { STORAGE_KEYS } from './helpdesk/types';

const { WhiteDeskNotificationModule } = NativeModules;

export class NotificationService {
  private static isInitialized = false;
  private static registeredWhiteId: string | null = null;
  private static registeredToken: string | null = null;

  static async init(whiteId: string): Promise<void> {
    if (Platform.OS !== 'android' || !whiteId) return;
    const blindId = WhiteDeskCrypto.generateBlindId(whiteId);

    try {
      // 1. Android 13+ (API 33+) için bildirim iznini iste
      if (Platform.Version >= 33) {
        try {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        } catch {}
      }

      if (WhiteDeskNotificationModule?.setOwnWhiteId) {
        WhiteDeskNotificationModule.setOwnWhiteId(blindId);
      }

      // Native katmana tenant ve org ID'lerini aktararak ZERO-TRUST filtrelerinin doğru çalışmasını sağla
      try {
        const [adminEnt, userEnt, userOrg] = await Promise.all([
          SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID).catch(() => null),
          SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID).catch(() => null),
          SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_ID).catch(() => null),
        ]);
        const tenant = adminEnt || userEnt || 'ent_1fc4c76b722c';
        if (tenant) {
          this.setOwnTenantId(tenant);
        }
        if (userOrg) {
          this.setOwnOrgId(userOrg);
        }
      } catch (err) {
        console.warn('[PUSH] Error setting initial tenant/org in native:', err);
      }

      // 2. Native FCM Token'ı al ve backend'e YALNIZCA blind_id ile kaydet
      if (WhiteDeskNotificationModule?.getPushToken) {
        const token = await WhiteDeskNotificationModule.getPushToken();
        if (token && (this.registeredWhiteId !== blindId || this.registeredToken !== token)) {
          this.registeredWhiteId = blindId;
          this.registeredToken = token;
          console.warn('[PUSH] FCM Token acquired, registering blind_id with backend:', blindId);
          await apiClient.registerFcmToken(blindId, token);
        }

        // 3. Token yenilendiğinde otomatik güncelle
        if (!this.isInitialized) {
          DeviceEventEmitter.addListener('onPushTokenRefresh', async (event: any) => {
            if (event?.token) {
              console.warn('[PUSH] Token refreshed, updating backend with blind_id:', blindId);
              await apiClient.registerFcmToken(blindId, event.token);
            }
          });
          this.isInitialized = true;
        }
      }
    } catch (err) {
      console.warn('[PUSH] NotificationService initialization error:', err);
    }
  }

  static setOwnTenantId(tenantId: string): void {
    if (Platform.OS !== 'android' || !tenantId) return;
    try {
      if (WhiteDeskNotificationModule?.setOwnTenantId) {
        WhiteDeskNotificationModule.setOwnTenantId(tenantId);
      }
    } catch (e) {
      console.warn('[PUSH] Error setting own tenant ID in native:', e);
    }
  }

  static setOwnOrgId(orgId: string): void {
    if (Platform.OS !== 'android' || !orgId) return;
    try {
      if (WhiteDeskNotificationModule?.setOwnOrgId) {
        WhiteDeskNotificationModule.setOwnOrgId(orgId);
      }
    } catch (e) {
      console.warn('[PUSH] Error setting own org ID in native:', e);
    }
  }

  static async getInitialCallIntent(): Promise<any> {
    if (Platform.OS !== 'android') return null;
    try {
      if (WhiteDeskNotificationModule?.getInitialCallIntent) {
        const res = await WhiteDeskNotificationModule.getInitialCallIntent();
        if (res?.isIncomingCall) {
          WhiteDeskNotificationModule.clearCallIntent();
          return res;
        }
      }
    } catch {}
    return null;
  }

  static onIncomingCallTapped(callback: (data: any) => void): () => void {
    if (Platform.OS !== 'android') return () => {};
    const sub = DeviceEventEmitter.addListener('onIncomingCallNotificationTapped', (event: any) => {
      if (event?.isIncomingCall) {
        WhiteDeskNotificationModule?.clearCallIntent();
        callback(event);
      }
    });
    return () => sub.remove();
  }

  static onIncomingCallAction(callback: (data: { action: string; ticketId: string; callerWhiteId: string }) => void): () => void {
    if (Platform.OS !== 'android') return () => {};
    const sub = DeviceEventEmitter.addListener('onIncomingCallAction', (event: any) => {
      if (event?.action) {
        callback(event);
      }
    });
    return () => sub.remove();
  }

  static dismissCallNotification(): void {
    if (Platform.OS !== 'android') return;
    try {
      WhiteDeskNotificationModule?.dismissIncomingCallNotification?.();
    } catch {}
  }
}
