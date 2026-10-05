import { Platform } from 'react-native';
import { CryptoService } from './cryptoService';

/**
 * inWhite - Secures communication proxies with Vercel API Gateway
 * Establishes standard client token requests.
 */

// Replace this with your actual Vercel production deployment URL
// This is the default inWhite secure backend for token generation.
const DEFAULT_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://backend-gilt-three-mcjd0qs5vx.vercel.app';

export interface TokenResponse {
  rtcToken?: string;
  rtmToken?: string;
  channelName?: string;
  uid?: number;
  account?: string;
  expireDuration: number;
  expiresAt: number;
  status: 'success' | 'error';
}

export const apiClient = {
  /**
   * Health check to verify if the Vercel backend is reachable.
   */
  async checkBackendHealth(backendUrl: string = DEFAULT_BACKEND_URL): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(`${sanitizedUrl}/api/get-token?channelName=health-check`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response.status === 200 || response.status === 400; // 400 is fine as it means the API reached the handler
    } catch (err) {
      console.warn('apiClient: Backend health check failed:', err);
      return false;
    }
  },

  /**
   * Fetches an RTC and/or RTM token from the Vercel Serverless Backend.
   */
  async getAgoraToken(
    channelName: string,
    uid: number | string = 0,
    tokenType: 'rtc' | 'rtm' | 'both' = 'rtc',
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<TokenResponse> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const queryParams = new URLSearchParams({
        channelName,
        uid: uid.toString(),
        tokenType,
        expireDuration: '3600', // 1 hour token lifetime
      });

      const url = `${sanitizedUrl}/api/get-token?${queryParams.toString()}`;
      console.log('apiClient: Fetching token from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-inWhite-Channel': channelName, // Adding context header for easier debugging
        },
      });

      if (!response.ok) {
        let errMsg = `Server returned status code ${response.status}`;
        let errBodyText = '';
        try {
          errBodyText = await response.text();
          const errData = JSON.parse(errBodyText);
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (e) {
          // Response was not valid JSON
        }
        console.error(`apiClient: Token fetch rejected! URL: ${url}. Status: ${response.status}, Body: ${errBodyText}`);
        throw new Error(errMsg);
      }

      const rawData = await response.json();
      if (rawData.status === 'error') {
        throw new Error(rawData.error || 'Server rejected token issuance.');
      }

      // Robust compatibility mapping
      if (!rawData.rtcToken && rawData.token) {
        rawData.rtcToken = rawData.token;
      }
      if (!rawData.status) {
        rawData.status = 'success';
      }

      return rawData as TokenResponse;
    } catch (error: any) {
      // On Web, if the network fetch fails, we can fallback to mock tokens so the UI doesn't crash
      if (Platform.OS === 'web') {
        console.warn('apiClient: Web network fetch failed or backend unreachable. Falling back to mock tokens.', error.message || error);
        return {
          rtcToken: 'mock-rtc-token',
          rtmToken: 'mock-rtm-token',
          channelName,
          uid: Number(uid) || 0,
          expireDuration: 3600,
          expiresAt: Date.now() + 3600000,
          status: 'success'
        };
      }
      
      console.error('apiClient: Error fetching authentic credentials:', error);
      throw new Error(error.message || 'Network exception. Failed to connect with inWhite secure backend.');
    }
  },

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
      console.warn('apiClient: Failed to register push token:', err);
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
      const response = await fetch(`${sanitizedUrl}/api/register-push`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ whiteId, fcmToken, language }),
      });

      return response.ok;
    } catch (err) {
      console.warn('apiClient: Failed to register FCM token:', err);
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
      console.warn('apiClient: Failed to update push language:', err);
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
      console.warn('apiClient: Failed to register VoIP token:', err);
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
        console.warn(`apiClient: push-notify endpoint responded with status ${response.status}`);
        return false;
      }
      return true;
    } catch (pushErr) {
      console.warn('apiClient: Failed to send remote VoIP push notify:', pushErr);
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
        console.warn(`apiClient: chat push-notify responded with status ${response.status}`);
        return false;
      }
      return true;
    } catch (pushErr) {
      console.warn('apiClient: Failed to send chat message push notify:', pushErr);
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
        console.warn(`apiClient: helpdesk push-notify responded with status ${response.status}`);
        return false;
      }
      return true;
    } catch (pushErr) {
      console.warn('apiClient: Failed to send helpdesk push notify:', pushErr);
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
      console.warn('apiClient: Failed to send silent chat ACK signal:', err);
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
        console.warn(`apiClient: webrtc signal responded with status ${response.status}`);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('apiClient: Failed to send WebRTC signal:', err);
      return false;
    }
  },

  /**
   * Publishes an ephemeral signal directly to Vercel (RAM + Neon DB) for ultra-fast exchange.
   */
  async publishFastSignal(
    roomName: string,
    role: 'caller' | 'callee',
    signalType: 'offer' | 'answer' | 'hangup' | 'reject' | 'busy' | 'answered' | 'fallback-relay' | 'mode-switch' | 'ice-candidate',
    sdp?: string,
    targetMode?: string,
    candidate?: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/signal`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, role, signalType, sdp, targetMode, candidate }),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Fast poll of Vercel signal relay (checks RAM/DB in <80ms).
   */
  async fetchFastSignal(
    roomName: string,
    role: 'caller' | 'callee',
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<{
    found: boolean;
    offerSdp?: string;
    answerSdp?: string;
    signalType?: string;
    targetMode?: string;
    candidates?: string[];
  } | null> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/signal?roomName=${encodeURIComponent(roomName)}&role=${role}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },

  /**
   * Purges ephemeral room signal when call completes or is declined.
   */
  async deleteFastSignal(
    roomName: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/signal?roomName=${encodeURIComponent(roomName)}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Fetches ephemeral Cloudflare Calls / TURN credentials from Vercel backend.
   */
  async fetchTurnCredentials(
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<{ iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>; provider?: string } | null> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const response = await fetch(`${sanitizedUrl}/api/get-turn-credentials`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      console.warn('apiClient: fetchTurnCredentials failed:', err);
      return null;
    }
  },

  /**
   * Dispatches anonymous user feedback / issue report via Vercel & Resend API.
   */
  async sendFeedback(
    category: 'technical' | 'language' | 'suggestion',
    message: string,
    deviceInfo?: { model?: string; os?: string; appVersion?: string; language?: string },
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<{ success: boolean; ticketId?: string; error?: string }> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(`${sanitizedUrl}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message, deviceInfo }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        return { success: false, error: errText || 'Server returned an error' };
      }

      const json = await response.json();
      return { success: !!json.success, ticketId: json.ticketId };
    } catch (err: any) {
      console.warn('apiClient: sendFeedback error:', err);
      return { success: false, error: err.message || 'Network error' };
    }
  },

  /**
   * Sovereign Mailbox: Fetches inbox messages for the given whiteId (or all for admin).
   */
  async fetchMailbox(
    whiteId: string,
    adminKey?: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<{ success: boolean; isAdmin: boolean; messages: MailboxMessageItem[] }> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const query = adminKey 
        ? `adminKey=${encodeURIComponent(adminKey)}` 
        : `whiteId=${encodeURIComponent(whiteId)}`;
      const res = await fetch(`${sanitizedUrl}/api/mailbox?${query}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) return { success: false, isAdmin: false, messages: [] };
      const data = await res.json();
      return { success: true, isAdmin: !!data.isAdmin, messages: data.messages || [] };
    } catch (err) {
      console.warn('apiClient: fetchMailbox error:', err);
      return { success: false, isAdmin: false, messages: [] };
    }
  },

  /**
   * Sovereign Mailbox: Sends a new message or reply.
   */
  async sendMailboxMessage(
    payload: {
      fromId: string;
      toId?: string;
      senderName?: string;
      subject: string;
      category?: string;
      body: string;
      imageData?: string | null;
      deviceInfo?: any;
      threadId?: string;
      adminKey?: string;
    },
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<{ success: boolean; id?: string; threadId?: string; error?: string }> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const res = await fetch(`${sanitizedUrl}/api/mailbox?action=send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: errText };
      }
      const data = await res.json();
      return { success: true, id: data.id, threadId: data.threadId };
    } catch (err: any) {
      console.warn('apiClient: sendMailboxMessage error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Sovereign Mailbox: Verifies admin secret key.
   */
  async verifyAdminSecret(
    key: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const res = await fetch(`${sanitizedUrl}/api/mailbox?action=auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      if (!res.ok) return false;
      const data = await res.json();
      return !!data.valid;
    } catch (err) {
      console.warn('apiClient: verifyAdminSecret error:', err);
      return false;
    }
  },

  /**
   * Sovereign Mailbox: Marks message as read.
   */
  async markMailboxRead(
    messageId: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const res = await fetch(`${sanitizedUrl}/api/mailbox?action=read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};

export interface MailboxMessageItem {
  id: string;
  thread_id: string;
  from_id: string;
  to_id: string;
  sender_name: string;
  subject: string;
  category: string;
  body: string;
  image_data?: string | null;
  device_info?: string | null;
  is_read: boolean;
  created_at: number;
}

