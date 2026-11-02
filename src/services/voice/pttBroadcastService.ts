import { apiClient } from '../apiClient';
import { VoiceCallSession } from './types';

/**
 * Kurumsal telsiz (PTT_broadcast) odası için tenant adını kanonikleştirir.
 * Her şirketin kendi bağımsız WebRTC telsiz odasında kalması için benzersiz tenantId'yi korur.
 */
/**
 * Kurumsal telsiz (PTT_broadcast) odası için KESİN VE KIRILAMAZ İZOLASYONLU oda adı üretir.
 * 1. Firma (Tenant) İzolasyonu: Tenant ID benzersiz bir ön ek olarak odaya kilitlenir.
 * 2. Birim (Org) İzolasyonu: Eğer birim seçilmişse sadece o birime, seçilmemişse tenant geneline (all) kilitlenir.
 */
export function buildPttRoomName(tenantId?: string, orgId?: string): string {
  const cleanTenant = (tenantId || 'unassigned').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const cleanOrg = (!orgId || orgId === 'all' || orgId === '*' || orgId === 'global')
    ? 'all'
    : orgId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return `wd_ptt_t_${cleanTenant}_org_${cleanOrg}`;
}

export function normalizeOrgPttTenant(tenantId?: string): string {
  if (!tenantId || tenantId === 'all') return 'default';
  const clean = tenantId.trim().toLowerCase();
  return clean.replace(/[^a-z0-9_-]/g, '_') || 'default';
}

/**
 * PttBroadcastService: Kurumsal Saha Grubu Telsizi (PTT_broadcast) Motoru
 * - Çok kullanıcılı kurumsal veya birim telsiz kanalı.
 * - Anlık anons yayını, aktif konuşmacı tespiti (speaker_start/stop), odaya katıldı/ayrıldı (peer_join/leave) olayları.
 */
export class PttBroadcastService {
  /**
   * PTT_broadcast Bekleme Konsolu Oturumu (Standby)
   */
  createStandbySession(
    tenantId: string,
    orgId: string,
    orgName: string,
    callerWhiteId: string,
    callerAlias: string
  ): VoiceCallSession {
    const cleanOrgId = orgId && orgId !== 'all' ? orgId : 'all';
    const roomName = buildPttRoomName(tenantId, cleanOrgId);
    const requestTs = Date.now();

    return {
      ticketId: `org_${cleanOrgId}`,
      roomName,
      callerWhiteId,
      callerAlias,
      calleeWhiteId: '',
      calleeAlias: orgName || '',
      state: 'connected',
      connectionMode: 'p2p_direct',
      durationSeconds: 0,
      isMuted: true,
      isSpeaker: true,
      role: 'caller',
      requestTs,
      callType: 'ptt',
      scope: 'org_group',
      pttMode: 'PTT_broadcast',
      targetOrgId: cleanOrgId,
      targetOrgName: orgName,
      activeSpeakerAlias: '',
      activeSpeakerWhiteId: '',
      isStandby: true,
    };
  }

  /**
   * PTT_broadcast Aktif Yayın Oturumu
   */
  createActiveSession(
    tenantId: string,
    orgId: string,
    orgName: string,
    callerWhiteId: string,
    callerAlias: string
  ): VoiceCallSession {
    const cleanOrgId = orgId && orgId !== 'all' ? orgId : 'all';
    const roomName = buildPttRoomName(tenantId, cleanOrgId);
    const requestTs = Date.now();

    return {
      ticketId: `org_${cleanOrgId}`,
      roomName,
      callerWhiteId,
      callerAlias,
      calleeWhiteId: '',
      calleeAlias: orgName || '',
      state: 'connected',
      connectionMode: 'p2p_direct',
      durationSeconds: 0,
      isMuted: true,
      isSpeaker: true,
      role: 'caller',
      requestTs,
      callType: 'ptt',
      scope: 'org_group',
      pttMode: 'PTT_broadcast',
      targetOrgId: cleanOrgId,
      targetOrgName: orgName,
      activeSpeakerAlias: '',
      activeSpeakerWhiteId: '',
      isStandby: false,
    };
  }

  /**
   * PTT_broadcast Hedef Grubu / Birimi Güncelleme
   */
  updateTarget(session: VoiceCallSession, orgId: string, orgName: string, tenantId?: string): void {
    const cleanOrgId = orgId && orgId !== 'all' ? orgId : 'all';
    session.targetOrgId = cleanOrgId;
    session.targetOrgName = orgName;
    session.calleeAlias = orgName;
    if (tenantId) {
      session.roomName = buildPttRoomName(tenantId, cleanOrgId);
    }
  }

  /**
   * PTT_broadcast Sinyal Yükü Oluşturma
   */
  buildBroadcastPayload(
    session: VoiceCallSession,
    tenantId: string,
    sdpToSend: string
  ): string {
    return JSON.stringify({
      type: 'org_ptt_broadcast',
      pttMode: 'PTT_broadcast',
      tenantId,
      orgId: session.targetOrgId,
      orgName: session.targetOrgName,
      callerWhiteId: session.callerWhiteId,
      callerAlias: session.callerAlias,
      ts: session.requestTs,
      sdp: sdpToSend,
      callType: 'ptt',
      scope: 'org_group',
    });
  }

  /**
   * PTT_broadcast Yayın Sinyalini İlgili Odalara ve Üyelere Dağıtma (Fan-out)
   */
  async dispatchBroadcastOffer(
    session: VoiceCallSession,
    tenantId: string,
    payload: string,
    targetMembers: string[] = []
  ): Promise<void> {
    console.warn('[PttBroadcastService] >>> DISPATCHING PTT_BROADCAST to room:', session.roomName, 'tenant:', tenantId, 'org:', session.targetOrgName, 'targetMembers:', targetMembers);

    await apiClient.publishFastSignal(
      session.roomName,
      'caller',
      'offer',
      payload,
      'org_ptt_broadcast'
    );

    // Hedef kayıtlı üyelerin özel odalarına fırlat
    if (targetMembers && targetMembers.length > 0) {
      for (const mId of targetMembers) {
        if (!mId || mId.toLowerCase() === session.callerWhiteId.toLowerCase()) continue;
        const userDirectRoom = `whitedesk_user_signal_${mId.toLowerCase().trim()}`;
        void apiClient.publishFastSignal(
          userDirectRoom,
          'caller',
          'offer',
          payload,
          'org_ptt_broadcast'
        );
      }
    }

    // Google FCM push ile şirket üyelerini uyandır (firma izolasyonu korunarak)
    void apiClient.sendBroadcastPttPushNotification(
      session.callerWhiteId,
      session.callerAlias,
      session.targetOrgName || '',
      session.targetOrgId || 'global',
      undefined,
      tenantId,
      targetMembers
    );
  }

  /**
   * PTT_broadcast Aktif Konuşmacı Sinyali (speaker_start / speaker_stop)
   */
  async broadcastSpeakerState(
    roomName: string,
    role: 'caller' | 'callee',
    isSpeaking: boolean,
    alias: string,
    whiteId: string,
    callsSessionId?: string | null,
    trackName?: string | null
  ): Promise<void> {
    if (!roomName) return;
    if (isSpeaking) {
      void apiClient.publishFastSignal(
        roomName,
        role,
        'mode-switch',
        JSON.stringify({
          isSpeaking: true,
          alias,
          whiteId,
          callsSessionId: callsSessionId || undefined,
          trackName: trackName || undefined,
        }),
        'speaker_start'
      );
    } else {
      void apiClient.publishFastSignal(
        roomName,
        role,
        'mode-switch',
        JSON.stringify({ isSpeaking: false, alias, whiteId }),
        'speaker_stop'
      );
    }
  }

  /**
   * PTT_broadcast Kanala Katılma / Ayrılma Sinyali (peer_join / peer_leave)
   */
  async broadcastPeerEvent(
    roomName: string,
    role: 'caller' | 'callee',
    action: 'joined' | 'left',
    alias: string,
    whiteId: string
  ): Promise<void> {
    if (!roomName) return;
    void apiClient.publishFastSignal(
      roomName,
      role,
      'mode-switch',
      JSON.stringify({ action, alias, whiteId }),
      action === 'joined' ? 'peer_join' : 'peer_leave'
    );
  }
}

export const pttBroadcastService = new PttBroadcastService();
