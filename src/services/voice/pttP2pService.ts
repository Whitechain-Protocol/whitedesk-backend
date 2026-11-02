import { apiClient } from '../apiClient';
import { helpDeskService } from '../helpDeskService';
import { VoiceCallSession } from './types';

/**
 * PttP2pService: Bilet içi 1-e-1 Bas-Konuş (PTT_P2P) Motoru
 * - Bilet sahibi ve destek operatörü arasında uçtan uca şifreli (E2EE) izole telsiz.
 * - Başlangıçta sessiz (dinleme) modunda açılır, telsiz butonuna basıldığında konuşulur.
 */
export class PttP2pService {
  /**
   * PTT_P2P Uygunluk Denetimi
   */
  async checkEligibility(
    callerWhiteId: string,
    calleeWhiteId: string,
    tenantId?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const effectiveTenant = tenantId || 'default';
      const config = await helpDeskService.getAdvancedFeaturesConfig(effectiveTenant);
      if (config.pushToTalk?.enabled === false) {
        return {
          allowed: false,
          reason: 'Kurum yöneticisi bu masada bas-konuş telsiz özelliğini devre dışı bırakmıştır.',
        };
      }

      const callerPrefs = await helpDeskService.getUserAdvancedPreferences(callerWhiteId);
      if (callerPrefs.pushToTalkEnabled === false) {
        return {
          allowed: false,
          reason: 'Kendi ayarlarınızda bas-konuş özelliği kapalıdır. Profil ayarlarınızdan aktif edebilirsiniz.',
        };
      }

      if (calleeWhiteId) {
        const calleePrefs = await helpDeskService.getUserAdvancedPreferences(calleeWhiteId);
        if (calleePrefs.pushToTalkEnabled === false) {
          return {
            allowed: false,
            reason: 'Kullanıcı bas-konuş çağrılarını kabul etmiyor.',
          };
        }
      }

      return { allowed: true };
    } catch (err) {
      console.warn('[PttP2pService] checkEligibility error:', err);
      return { allowed: true };
    }
  }

  /**
   * PTT_P2P Oturumu Hazırlama (Bilet İçi 1-e-1)
   */
  async prepareP2pSession(
    ticketId: string,
    callerWhiteId: string,
    callerAlias: string,
    calleeWhiteId: string,
    calleeAlias: string,
    targetOrgName?: string,
    targetOrgId?: string
  ): Promise<VoiceCallSession> {
    const roomName = `whitedesk_call_${ticketId}`;
    const requestTs = Date.now();

    await apiClient.deleteFastSignal(roomName);
    if (calleeWhiteId) {
      const userDirectRoom = `whitedesk_user_signal_${calleeWhiteId.toLowerCase().trim()}`;
      await apiClient.deleteFastSignal(userDirectRoom);
    }

    return {
      ticketId,
      roomName,
      callerWhiteId,
      callerAlias,
      calleeWhiteId,
      calleeAlias,
      state: 'outgoing_ringing',
      connectionMode: 'p2p_direct',
      durationSeconds: 0,
      isMuted: true, // PTT_P2P kuralı: konuşma butonuna basılana kadar mikrofon kapalı
      isSpeaker: true, // Telsiz hoparlörden çıkar
      role: 'caller',
      requestTs,
      callType: 'ptt',
      scope: 'direct',
      pttMode: 'PTT_P2P',
      targetOrgName,
      targetOrgId,
    };
  }

  /**
   * PTT_P2P Sinyal Yükü Oluşturma
   */
  buildOfferPayload(
    session: VoiceCallSession,
    sdpToSend: string
  ): string {
    return JSON.stringify({
      type: 'direct_ptt',
      pttMode: 'PTT_P2P',
      callerWhiteId: session.callerWhiteId,
      callerAlias: session.callerAlias,
      calleeWhiteId: session.calleeWhiteId,
      calleeAlias: session.calleeAlias,
      ticketId: session.ticketId,
      ts: session.requestTs,
      sdp: sdpToSend,
      callType: 'ptt',
      scope: 'direct',
      targetOrgName: session.targetOrgName,
      targetOrgId: session.targetOrgId,
    });
  }

  /**
   * PTT_P2P Sinyalini İlgili Odalara Fırlatma
   */
  async dispatchP2pOffer(
    session: VoiceCallSession,
    payload: string
  ): Promise<void> {
    console.warn('[PttP2pService] >>> DISPATCHING PTT_P2P OFFER to room:', session.roomName, 'ticket:', session.ticketId);

    await apiClient.publishFastSignal(
      session.roomName,
      'caller',
      'offer',
      payload,
      'direct_ptt'
    );

    if (session.calleeWhiteId) {
      const userDirectRoom = `whitedesk_user_signal_${session.calleeWhiteId.toLowerCase().trim()}`;
      void apiClient.publishFastSignal(
        userDirectRoom,
        'caller',
        'offer',
        payload,
        'direct_ptt'
      );

      void apiClient.sendCallPushNotification(
        session.calleeWhiteId,
        session.callerAlias,
        session.callerWhiteId,
        session.ticketId,
        'ptt'
      );
    }
  }
}

export const pttP2pService = new PttP2pService();
