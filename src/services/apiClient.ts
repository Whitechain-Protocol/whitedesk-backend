import { Platform } from 'react-native';
import { CryptoService } from './cryptoService';
import { pushClient } from './pushClient';
import { relayClient, MailboxMessageItem, RelayInboxMessage } from './relayClient';

/**
 * WhiteDesk Sovereign Client API Gateway
 */

// WhiteDesk Sovereign Backend (Vercel whitedesk-backend or Cloudflare Worker)
const DEFAULT_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://whitedesk-backend.vercel.app';
const SIGNAL_RELAY_BACKEND_URL = DEFAULT_BACKEND_URL;

export const apiClient = {
  /**
   * Health check to verify if the Vercel backend is reachable.
   */
  async checkBackendHealth(backendUrl: string = SIGNAL_RELAY_BACKEND_URL): Promise<boolean> {
    try {
      const sanitizedUrl = (backendUrl || SIGNAL_RELAY_BACKEND_URL).replace(/\/$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const response = await fetch(`${sanitizedUrl}/api/signal?roomName=net_ping&role=callee`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response.status >= 200 && response.status < 500;
    } catch (err) {
      console.warn('apiClient: Backend health check failed:', err);
      return false;
    }
  },

  /**
   * Push Notifications & Wake-Up Layer (Delegated to pushClient)
   */
  registerPushToken: pushClient.registerPushToken,
  registerFcmToken: pushClient.registerFcmToken,
  updatePushLanguage: pushClient.updatePushLanguage,
  sendCallPushNotification: pushClient.sendCallPushNotification,
  sendCancelCallPushNotification: pushClient.sendCancelCallPushNotification,
  sendBroadcastPttPushNotification: pushClient.sendBroadcastPttPushNotification,
  registerVoipToken: pushClient.registerVoipToken,
  sendWakeUpPushNotification: pushClient.sendWakeUpPushNotification,
  sendChatMessagePushNotification: pushClient.sendChatMessagePushNotification,
  sendHelpDeskPushNotification: pushClient.sendHelpDeskPushNotification,
  sendChatAck: pushClient.sendChatAck,
  sendWebRtcSignal: pushClient.sendWebRtcSignal,

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
    backendUrl: string = SIGNAL_RELAY_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/signal`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, role, signalType, sdp, targetMode, candidate }),
      });
      if (!response.ok) {
        console.warn(`[apiClient] publishFastSignal failed: HTTP ${response.status} from ${sanitizedUrl}/api/signal`);
        return false;
      }
      return response.ok;
    } catch (err) {
      console.warn('[apiClient] publishFastSignal network error:', err);
      return false;
    }
  },

  /**
   * Fast poll of Vercel signal relay (checks RAM/DB in <80ms).
   */
  async fetchFastSignal(
    roomName: string,
    role: 'caller' | 'callee',
    backendUrl: string = SIGNAL_RELAY_BACKEND_URL
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
      if (!response.ok) {
        console.warn(`[apiClient] fetchFastSignal failed: HTTP ${response.status} from ${sanitizedUrl}/api/signal`);
        return null;
      }
      return await response.json();
    } catch (err) {
      console.warn('[apiClient] fetchFastSignal network error:', err);
      return null;
    }
  },

  /**
   * Purges ephemeral room signal when call completes or is declined.
   */
  async deleteFastSignal(
    roomName: string,
    backendUrl: string = SIGNAL_RELAY_BACKEND_URL
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
   * Cloudflare Calls Serverless SFU: Initialize WebRTC Session
   */
  async createCallsSession(
    offerSdp: string,
    tracks?: any[],
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<{ sessionId: string; sessionDescription: { type: 'answer'; sdp: string } } | null> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const bodyPayload: any = {
        action: 'new-session',
        sessionDescription: { type: 'offer', sdp: offerSdp },
      };
      if (tracks) bodyPayload.tracks = tracks;

      const response = await fetch(`${sanitizedUrl}/api/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      if (!response.ok) {
        console.warn(`[apiClient] createCallsSession failed: HTTP ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (e) {
      console.warn('[apiClient] createCallsSession error:', e);
      return null;
    }
  },

  /**
   * Cloudflare Calls Serverless SFU: Publish local audio track (speaker)
   */
  async publishCallsTrack(
    sessionId: string,
    offerSdp: string,
    trackName: string,
    mid: string = '0',
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<{ sessionDescription?: { type: 'answer'; sdp: string }; tracks?: any[] } | null> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'new-tracks',
          sessionId,
          sessionDescription: { type: 'offer', sdp: offerSdp },
          tracks: [{ location: 'local', mid, trackName }],
        }),
      });
      if (!response.ok) {
        console.warn(`[apiClient] publishCallsTrack failed: HTTP ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (e) {
      console.warn('[apiClient] publishCallsTrack error:', e);
      return null;
    }
  },

  /**
   * Cloudflare Calls Serverless SFU: Subscribe to remote speaker audio track (listener)
   */
  async subscribeCallsTrack(
    listenerSessionId: string,
    speakerSessionId: string,
    trackName: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<{ sessionDescription?: { type: 'offer'; sdp: string }; tracks?: any[] } | null> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'new-tracks',
          sessionId: listenerSessionId,
          tracks: [{ location: 'remote', sessionId: speakerSessionId, trackName }],
        }),
      });
      if (!response.ok) {
        console.warn(`[apiClient] subscribeCallsTrack failed: HTTP ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (e) {
      console.warn('[apiClient] subscribeCallsTrack error:', e);
      return null;
    }
  },

  /**
   * Cloudflare Calls Serverless SFU: Renegotiate session with answer SDP (listener)
   */
  async renegotiateCallsSession(
    sessionId: string,
    answerSdp: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'renegotiate',
          sessionId,
          sessionDescription: { type: 'answer', sdp: answerSdp },
        }),
      });
      return response.ok;
    } catch (e) {
      console.warn('[apiClient] renegotiateCallsSession error:', e);
      return false;
    }
  },

  /**
   * Cloudflare Calls Serverless SFU: Close track when user releases PTT
   */
  async closeCallsTrack(
    sessionId: string,
    trackName: string,
    backendUrl: string = DEFAULT_BACKEND_URL
  ): Promise<boolean> {
    try {
      const sanitizedUrl = backendUrl.replace(/\/$/, '');
      const response = await fetch(`${sanitizedUrl}/api/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close-tracks',
          sessionId,
          tracks: [{ trackName }],
        }),
      });
      return response.ok;
    } catch (e) {
      console.warn('[apiClient] closeCallsTrack error:', e);
      return false;
    }
  },

  /**
   * Fetches ephemeral Cloudflare Calls / TURN credentials from Vercel backend.
   */
  async fetchTurnCredentials(
    backendUrl: string = SIGNAL_RELAY_BACKEND_URL
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
   * Sovereign Mailbox & Cloudflare Relay (Delegated to relayClient)
   */
  fetchMailbox: relayClient.fetchMailbox,
  sendMailboxMessage: relayClient.sendMailboxMessage,
  verifyAdminSecret: relayClient.verifyAdminSecret,
  markMailboxRead: relayClient.markMailboxRead,
  sendRelayMessage: relayClient.sendRelayMessage,
  fetchRelayInbox: relayClient.fetchRelayInbox,
  confirmRelayAck: relayClient.confirmRelayAck,
  uploadRelayAttachmentBase64: relayClient.uploadRelayAttachmentBase64,
  fetchRelayAttachment: relayClient.fetchRelayAttachment,
  sendRosterHeartbeat: relayClient.sendRosterHeartbeat,
  allocateTicketAdmin: relayClient.allocateTicketAdmin,
  reissueTwinTickets: relayClient.reissueTwinTickets,
  fetchAdminRoster: relayClient.fetchAdminRoster,
};

export { pushClient } from './pushClient';
export { relayClient, MailboxMessageItem, RelayInboxMessage } from './relayClient';


