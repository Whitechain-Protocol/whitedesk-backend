import { NativeModules, PermissionsAndroid, Platform, DeviceEventEmitter } from 'react-native';
import { apiClient } from './apiClient';
import { WhiteDeskCrypto } from '../whitedesk-sdk';

const { WhiteDeskNotificationModule } = NativeModules;

export class NotificationService {
  private static isInitialized = false;
  private static registeredWhiteId: string | null = null;
  private static registeredToken: string | null = null;

  static async init(whiteId: string): Promise<void> {
    if (Platform.OS !== 'android' || !whiteId) return;

    try {
      // 1. Android 13+ (API 33+) için bildirim iznini iste
      if (Platform.Version >= 33) {
        try {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        } catch {}
      }

      if (WhiteDeskNotificationModule?.setOwnWhiteId) {
        WhiteDeskNotificationModule.setOwnWhiteId(whiteId);
      }

      // 2. Native FCM Token'ı al ve backend'e kaydet (Yalnızca değiştiğinde)
      if (WhiteDeskNotificationModule?.getPushToken) {
        const token = await WhiteDeskNotificationModule.getPushToken();
        if (token && (this.registeredWhiteId !== whiteId || this.registeredToken !== token)) {
          this.registeredWhiteId = whiteId;
          this.registeredToken = token;
          console.warn('[PUSH] FCM Token acquired, registering with backend:', token);
          await apiClient.registerFcmToken(whiteId, token);
          try {
            const blind = WhiteDeskCrypto.generateBlindId(whiteId);
            if (blind && blind.toLowerCase() !== whiteId.toLowerCase()) {
              await apiClient.registerFcmToken(blind, token);
            }
          } catch (e) {
            console.warn('[PUSH] Error generating/registering blind token:', e);
          }
        }

        // 3. Token yenilendiğinde otomatik güncelle
        if (!this.isInitialized) {
          DeviceEventEmitter.addListener('onPushTokenRefresh', async (event: any) => {
            if (event?.token) {
              console.warn('[PUSH] Token refreshed, updating backend:', event.token);
              await apiClient.registerFcmToken(whiteId, event.token);
              try {
                const blind = WhiteDeskCrypto.generateBlindId(whiteId);
                if (blind && blind.toLowerCase() !== whiteId.toLowerCase()) {
                  await apiClient.registerFcmToken(blind, event.token);
                }
              } catch {}
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
