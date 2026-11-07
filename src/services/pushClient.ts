import { Platform } from 'react-native';

/**
 * WhiteDesk Sovereign Push Client (Google FCM & Apple APNs)
 * Zero Personal Data: Only WhiteID + Device Push Token.
 */

const DEFAULT_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.whitedesk.one';

export const pushClient = {
  /**
   * Registers this device's Expo push token against its whiteID so remote peers
   * can wake it via /api/push-notify. Zero-metadata: only whiteID + push token.
   */
  async registerPushToken(
    whiteId: string,
    pushToken: string,
    language?: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/register-push`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ whiteId, pushToken, language }),
      });

      return response.ok;
    } catch (err) {
      console.warn('pushClient: Failed to register push token:', err);
      return false;
    }
  },

  /**
   * Registers the RAW FCM device token (Android) used for data-only incoming-call
   * pushes via the Firebase Admin SDK (full-screen wake-up). Distinct from the
   * Expo push token.
   */
  async registerFcmToken(
    whiteId: string,
    fcmToken: string,
    language?: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/push`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'register', whiteId, pushToken: fcmToken, platform: 'android', language }),
      });

      return response.ok;
    } catch (err) {
      console.warn('pushClient: Failed to register FCM token:', err);
      return false;
    }
  },

  /**
   * Updates preferred language for the device's push notifications without altering tokens.
   */
  async updatePushLanguage(
    whiteId: string,
    language: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/register-push`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ whiteId, language }),
      });

      return response.ok;
    } catch (err) {
      console.warn('pushClient: Failed to update push language:', err);
      return false;
    }
  },

  /**
   * Sends High-Priority Google FCM Push Notification to wake up phone for incoming calls or PTT
   */
  async sendCallPushNotification(
    targetWhiteId: string,
    callerAlias: string,
    callerWhiteId: string,
    ticketId: string,
    callType: 'call' | 'ptt' | 'remote_desktop' = 'call',
    backendUrl: string = DEFAULT_BACKEND_URL,
    tenantId?: string
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/push`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send_call',
          targetWhiteId,
          callerAlias,
          callerWhiteId,
          ticketId,
          callType,
          tenantId,
        }),
      });
      return response.ok;
    } catch (err) {
      console.warn('pushClient: Failed to send call push notification:', err);
      return false;
    }
  },

  /**
   * Çağrı iptal bildirimini fırlatır (Arayan vazgeçtiğinde arananın zilini susturur)
   */
  async sendCancelCallPushNotification(
    targetWhiteId: string,
    callerWhiteId: string,
    ticketId: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/push`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cancel_call',
          targetWhiteId,
          callerWhiteId,
          ticketId,
        }),
      });
      return response.ok;
    } catch (err) {
      console.warn('pushClient: Failed to send cancel call push notification:', err);
      return false;
    }
  },

  /**
   * Dispatches High-Priority Multicast Push to all group members for walkie-talkie (Org PTT)
   */
  async sendBroadcastPttPushNotification(
    callerWhiteId: string,
    callerAlias: string,
    orgName: string,
    orgId: string,
    ticketId?: string,
    tenantId?: string,
    targetMembers?: string[],
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/push`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'broadcast_org',
          callerWhiteId,
          callerAlias,
          orgName,
          orgId,
          ticketId,
          tenantId: tenantId || 'default',
          targetMembers: targetMembers || [],
        }),
      });
      return response.ok;
    } catch (err) {
      console.warn('pushClient: Failed to send broadcast PTT push notification:', err);
      return false;
    }
  },

  /**
   * Registers the iOS PushKit VoIP device token (separate from the Expo push token).
   */
  async registerVoipToken(
    whiteId: string,
    voipToken: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/register-push`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ whiteId, voipToken }),
      });

      return response.ok;
    } catch (err) {
      console.warn('pushClient: Failed to register VoIP token:', err);
      return false;
    }
  },

  /**
   * Dispatches High-Priority VoIP wake-up push notification to the recipient peer
   */
  async sendWakeUpPushNotification(
    targetWhiteId: string,
    callerWhiteId: string,
    callerName: string,
    pushToken?: string,
    callType: 'voice' | 'video' = 'voice',
    channelName?: string,
    callerPublicKey?: string,
    backendUrl: string = DEFAULT_BACKEND_URL,
    transportMode?: 'p2p' | 'cloud' | 'stealth'
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/push-notify`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetWhiteId,
          callerWhiteId,
          callerName,
          pushToken,
          callType,
          type: callType,
          channelName,
          callerPublicKey,
          transportMode: transportMode || 'cloud',
          priority: 'high',
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        console.warn(`pushClient: push-notify endpoint responded with status ${response.status}`);
        return false;
      }
      return true;
    } catch (pushErr) {
      console.warn('pushClient: Failed to send remote VoIP push notify:', pushErr);
      return false;
    }
  },

  /**
   * Dispatches High-Priority Chat Message push notification to recipient peer
   */
  async sendChatMessagePushNotification(
    targetWhiteId: string,
    senderWhiteId: string,
    senderName: string,
    messageText: string,
    backendUrl: string = DEFAULT_BACKEND_URL,
    encryptedPayload?: { senderPublicKey: string; encV: number; ct: string }
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/push-notify`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetWhiteId,
          senderWhiteId,
          senderName,
          messageText,
          isChatMessage: true,
          priority: 'high',
          timestamp: Date.now(),
          encryptedPayload,
        }),
      });

      if (!response.ok) {
        console.warn(`pushClient: chat push-notify responded with status ${response.status}`);
        return false;
      }
      return true;
    } catch (pushErr) {
      console.warn('pushClient: Failed to send chat message push notify:', pushErr);
      return false;
    }
  },

  /**
   * Dispatches High-Priority Help Desk push notification to user or admin
   */
  async sendHelpDeskPushNotification(
    targetWhiteId: string,
    senderWhiteId: string,
    payloadOrTitle: string | {
      titleTr?: string;
      titleEn?: string;
      bodyTr?: string;
      bodyEn?: string;
      title?: string;
      body?: string;
      ticketId?: string;
    },
    body?: string,
    ticketId?: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      let title = 'inWhite Destek';
      let bodyText = '';
      let titleTr: string | undefined;
      let titleEn: string | undefined;
      let bodyTr: string | undefined;
      let bodyEn: string | undefined;
      let finalTicketId: string | undefined;

      if (typeof payloadOrTitle === 'object' && payloadOrTitle !== null) {
        titleTr = payloadOrTitle.titleTr;
        titleEn = payloadOrTitle.titleEn;
        bodyTr = payloadOrTitle.bodyTr;
        bodyEn = payloadOrTitle.bodyEn;
        title = payloadOrTitle.title || titleTr || titleEn || 'inWhite Destek';
        bodyText = payloadOrTitle.body || bodyTr || bodyEn || '';
        finalTicketId = payloadOrTitle.ticketId;
      } else {
        title = payloadOrTitle || 'inWhite Destek';
        bodyText = body || '';
        finalTicketId = ticketId;
      }

      const response = await fetch(`${sanitizedUrl}/api/push-notify`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetWhiteId,
          senderWhiteId,
          senderName: 'inWhite Destek',
          title,
          body: bodyText,
          title_tr: titleTr,
          title_en: titleEn,
          body_tr: bodyTr,
          body_en: bodyEn,
          messageText: bodyText,
          isHelpDesk: true,
          ticketId: finalTicketId,
          priority: 'high',
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        console.warn(`pushClient: helpdesk push-notify responded with status ${response.status}`);
        return false;
      }
      return true;
    } catch (pushErr) {
      console.warn('pushClient: Failed to send helpdesk push notify:', pushErr);
      return false;
    }
  },

  /**
   * Dispatches a silent Chat ACK (delivered or read receipt) via in-band E2EE message push
   */
  async sendChatAck(
    targetWhiteId: string,
    senderWhiteId: string,
    ackType: 'delivered' | 'read',
    messageId?: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const sdpPayload = JSON.stringify({ ackType, messageId: messageId || '' });
      const response = await fetch(`${sanitizedUrl}/api/push-notify`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetWhiteId,
          senderWhiteId,
          roomName: 'inwhite-ack',
          isWebRtcSignal: true,
          signalType: 'chat-ack',
          sdp: sdpPayload,
          isChatAck: true,
          ackType,
          messageId: messageId || '',
          priority: 'high',
          timestamp: Date.now(),
        }),
      });
      return response.ok;
    } catch (err) {
      console.warn('pushClient: Failed to send chat ack push notify:', err);
      return false;
    }
  },

  /**
   * Dispatches a WebRTC signaling message (offer/answer/ICE) over data-only FCM.
   */
  async sendWebRtcSignal(
    targetWhiteId: string,
    senderWhiteId: string,
    roomName: string,
    signalType: 'offer' | 'answer' | 'ice-candidate' | 'hangup' | 'reject' | 'busy' | 'answered' | 'fallback-relay' | 'mode-switch',
    sdp?: string,
    candidate?: string,
    targetMode?: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/push-notify`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetWhiteId,
          senderWhiteId,
          roomName,
          isWebRtcSignal: true,
          signalType,
          sdp,
          candidate,
          targetMode,
          priority: 'high',
          timestamp: Date.now(),
        }),
      });
      if (!response.ok) {
        console.warn(`pushClient: webrtc signal responded with status ${response.status}`);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('pushClient: Failed to send WebRTC signal:', err);
      return false;
    }
  },
};

export default pushClient;
