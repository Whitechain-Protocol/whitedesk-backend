import { VoiceCallSession } from './types';
import { pttP2pService, PttP2pService } from './pttP2pService';
import { pttBroadcastService, PttBroadcastService } from './pttBroadcastService';

export * from './pttP2pService';
export * from './pttBroadcastService';

/**
 * PttService: PTT_P2P ve PTT_broadcast motorlarını birleşik bir çatı altında sunan Facade
 */
export class PttService {
  readonly p2p: PttP2pService = pttP2pService;
  readonly broadcast: PttBroadcastService = pttBroadcastService;

  /**
   * PTT Uygunluk Denetimi (Hem 1-e-1 hem grup için ortak taban kuralı)
   */
  async checkPttEligibility(
    callerWhiteId: string,
    calleeWhiteId: string,
    tenantId?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    return this.p2p.checkEligibility(callerWhiteId, calleeWhiteId, tenantId);
  }

  /**
   * PTT_P2P: Bilet İçi 1-e-1 Bas-Konuş Oturumu
   */
  async prepareDirectTicketPttSession(
    ticketId: string,
    callerWhiteId: string,
    callerAlias: string,
    calleeWhiteId: string,
    calleeAlias: string,
    targetOrgName?: string,
    targetOrgId?: string
  ): Promise<VoiceCallSession> {
    return this.p2p.prepareP2pSession(
      ticketId,
      callerWhiteId,
      callerAlias,
      calleeWhiteId,
      calleeAlias,
      targetOrgName,
      targetOrgId
    );
  }

  /**
   * PTT_broadcast: Bekleme Konsolu Oturumu (Standby)
   */
  createStandbyOrgPttSession(
    tenantId: string,
    orgId: string,
    orgName: string,
    callerWhiteId: string,
    callerAlias: string
  ): VoiceCallSession {
    return this.broadcast.createStandbySession(tenantId, orgId, orgName, callerWhiteId, callerAlias);
  }

  /**
   * PTT_broadcast: Aktif Telsiz Yayını Oturumu
   */
  createActiveOrgPttSession(
    tenantId: string,
    orgId: string,
    orgName: string,
    callerWhiteId: string,
    callerAlias: string
  ): VoiceCallSession {
    return this.broadcast.createActiveSession(tenantId, orgId, orgName, callerWhiteId, callerAlias);
  }

  /**
   * PTT_broadcast: Hedef Birim Güncelleme
   */
  updateOrgPttTarget(session: VoiceCallSession, orgId: string, orgName: string, tenantId?: string): void {
    this.broadcast.updateTarget(session, orgId, orgName, tenantId);
  }

  /**
   * PTT_broadcast: Aktif Konuşmacı Sinyali
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
    return this.broadcast.broadcastSpeakerState(
      roomName,
      role,
      isSpeaking,
      alias,
      whiteId,
      callsSessionId,
      trackName
    );
  }

  /**
   * PTT_broadcast: Katıldı / Ayrıldı Sinyali
   */
  async broadcastPeerEvent(
    roomName: string,
    role: 'caller' | 'callee',
    action: 'joined' | 'left',
    alias: string,
    whiteId: string
  ): Promise<void> {
    return this.broadcast.broadcastPeerEvent(roomName, role, action, alias, whiteId);
  }
}

export const pttService = new PttService();
