import { apiClient } from '../apiClient';
import { helpDeskService } from '../helpDeskService';
import { i18nService } from '../i18nService';
import { InWhiteRingtone } from '../../../modules/inwhite-ringtone';
import { NotificationService } from '../notificationService';
import { VoiceCallSession } from './types';
import { signalingService } from './signalingService';

export class CallService {
  /**
   * 1. 1-1 GÖRÜŞME UYGUNLUK DENETİMİ (Triple-Handshake)
   */
  async checkCallEligibility(
    callerWhiteId: string,
    calleeWhiteId: string,
    tenantId?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const effectiveTenant = tenantId || 'default';
      const config = await helpDeskService.getAdvancedFeaturesConfig(effectiveTenant);
      if (config.voiceCall?.enabled === false || config.voiceCall?.policy === 'disabled') {
        return {
          allowed: false,
          reason: i18nService.t('voice.call.disabled_by_enterprise'),
        };
      }

      const callerPrefs = await helpDeskService.getUserAdvancedPreferences(callerWhiteId);
      if (callerPrefs.voiceCallEnabled === false) {
        return {
          allowed: false,
          reason: i18nService.t('voice.call.disabled_in_own_settings'),
        };
      }

      if (calleeWhiteId) {
        const calleePrefs = await helpDeskService.getUserAdvancedPreferences(calleeWhiteId);
        if (calleePrefs.voiceCallEnabled === false) {
          return {
            allowed: false,
            reason: i18nService.t('voice.call.callee_not_accepting_calls'),
          };
        }
      }

      return { allowed: true };
    } catch (err) {
      console.warn('[CallService] checkCallEligibility error:', err);
      return { allowed: true };
    }
  }

  /**
   * 2. DOĞRUDAN 1-1 SESLİ ARAMA BAŞLATMA
   */
  async prepareDirectCallSession(
    ticketId: string,
    callerWhiteId: string,
    callerAlias: string,
    calleeWhiteId: string,
    calleeAlias: string,
    targetOrgName?: string,
    targetOrgId?: string
  ): Promise<{ session: VoiceCallSession; offerPayload: string }> {
    const roomName = `whitedesk_call_${ticketId}`;
    const requestTs = Date.now();

    await apiClient.deleteFastSignal(roomName);
    if (calleeWhiteId) {
      const userDirectRoom = `whitedesk_user_signal_${calleeWhiteId.toLowerCase().trim()}`;
      await apiClient.deleteFastSignal(userDirectRoom);
    }

    const session: VoiceCallSession = {
      ticketId,
      roomName,
      callerWhiteId,
      callerAlias,
      calleeWhiteId,
      calleeAlias,
      state: 'outgoing_ringing',
      connectionMode: 'p2p_direct',
      durationSeconds: 0,
      isMuted: false,
      isSpeaker: false,
      role: 'caller',
      requestTs,
      callType: 'call',
      scope: 'direct',
      targetOrgName,
      targetOrgId,
    };

    InWhiteRingtone.startRingback();

    return { session, offerPayload: '' };
  }

  /**
   * 3. 1-1 ARAYAN TARAFIN SİNYAL DİNLEYİCİSİ
   */
  startCallerPolling(
    roomName: string,
    onAnswerReceived: (answerSdp: string) => Promise<void>,
    onRejected: (reason: string) => void,
    onHangup: () => void,
    callerWhiteId?: string
  ): NodeJS.Timeout {
    let attempts = 0;
    let answerHandled = false;
    const cleanCallerId = (callerWhiteId || '').toLowerCase().trim();
    return setInterval(async () => {
      attempts++;
      if (attempts > 60) {
        onRejected(i18nService.t('voice.call.no_answer'));
        return;
      }

      const signal = await apiClient.fetchFastSignal(roomName, 'caller') as any;
      if (signal && signal.found) {
        const hasValidAnswerSdp = typeof signal.answerSdp === 'string' && (signal.answerSdp.includes('v=') || signal.answerSdp.includes('m='));
        const remoteAnswerSdp = hasValidAnswerSdp ? (signal.answerSdp || '') : '';
        const hasOtherPeerInPool =
          roomName.startsWith('wd_ptt_t_') &&
          ((Array.isArray(signal.activePeers) &&
            signal.activePeers.some((p: any) => {
              const pid = String(p?.whiteId || '').toLowerCase().trim();
              return pid && (!cleanCallerId || pid !== cleanCallerId);
            })) ||
            signal.targetMode === 'peer_join' ||
            signal.targetMode === 'call_connected' ||
            signal.targetMode === 'speaker_start');

        if (signal.candidates && signal.candidates.length > 0) {
          for (const candStr of signal.candidates) {
            try {
              const candObj = JSON.parse(candStr);
              signalingService.queueRemoteCandidate(candObj);
            } catch {}
          }
        }

        if ((hasValidAnswerSdp || hasOtherPeerInPool) && !answerHandled) {
          answerHandled = true;
          InWhiteRingtone.stopRingback();
          await onAnswerReceived(remoteAnswerSdp);
        } else if (signal.signalType === 'reject' && !roomName.startsWith('wd_ptt_t_')) {
          void apiClient.deleteFastSignal(roomName);
          const failureReason = signal.targetMode === 'call_disabled_by_user'
            ? 'call_disabled_by_user'
            : 'rejected';
          onRejected(failureReason);
        } else if (signal.signalType === 'hangup' && !roomName.startsWith('wd_ptt_t_')) {
          onHangup();
        }
      }
    }, 900);
  }

  /**
   * 4. 1-1 ARANAN TARAF ÇALARKEN ARAYANIN İPTAL EDİP ETMEDİĞİNİ İZLEME
   */
  startCalleeRingingWatcher(
    roomName: string,
    ownWhiteId: string | undefined,
    onCancelled: (reason: string) => void
  ): NodeJS.Timeout {
    let ringingNotFoundCount = 0;
    return setInterval(async () => {
      const signal = await apiClient.fetchFastSignal(roomName, 'callee');
      if (signal?.signalType === 'hangup' || signal?.signalType === 'reject') {
        console.warn('[CallService] Caller explicitly cancelled call before answer.');
        if (ownWhiteId) {
          void apiClient.deleteFastSignal(`whitedesk_user_signal_${ownWhiteId.toLowerCase().trim()}`);
        }
        void apiClient.deleteFastSignal(roomName);
        NotificationService.dismissCallNotification();
        onCancelled(i18nService.t('voice.call.cancelled_by_caller'));
        return;
      }

      if (!signal || !signal.found) {
        ringingNotFoundCount++;
        if (ringingNotFoundCount >= 12) {
          console.warn('[CallService] Caller signal expired/cancelled before answer.');
          if (ownWhiteId) {
            void apiClient.deleteFastSignal(`whitedesk_user_signal_${ownWhiteId.toLowerCase().trim()}`);
          }
          void apiClient.deleteFastSignal(roomName);
          NotificationService.dismissCallNotification();
          onCancelled(i18nService.t('voice.call.cancelled_by_caller'));
        }
        return;
      }

      ringingNotFoundCount = 0;
    }, 350);
  }

  /**
   * 5. BAĞLI ÇAĞRIDA HANGUP KONTROLÜ
   */
  startConnectedHangupWatcher(
    roomName: string,
    role: 'caller' | 'callee',
    onHangup: (reason: string) => void
  ): NodeJS.Timeout {
    let connectedNotFoundCount = 0;
    return setInterval(async () => {
      const signal = await apiClient.fetchFastSignal(roomName, role);
      if (signal?.signalType === 'hangup' || signal?.signalType === 'reject') {
        console.warn('[CallService] Counterpart hung up the call. Closing session.');
        onHangup(i18nService.t('voice.call.ended_by_counterpart'));
        return;
      }

      if (!signal || !signal.found) {
        connectedNotFoundCount++;
        if (connectedNotFoundCount >= 3) {
          console.warn('[CallService] Room signal ended/cleared. Closing session.');
          onHangup(i18nService.t('voice.call.ended'));
        }
        return;
      }
      connectedNotFoundCount = 0;
    }, 900);
  }
}

export const callService = new CallService();
