import { apiClient } from '../apiClient';
import { helpDeskService } from '../helpDeskService';
import { InWhiteRingtone } from '../../../modules/inwhite-ringtone';
import { WhiteDeskCrypto } from '../../whitedesk-sdk';
import { NotificationService } from '../notificationService';
import { SafeSecureStore } from '../storageService';
import { STORAGE_KEYS } from '../helpdesk/types';

import {
  VoiceCallSession,
  VoiceCallState,
  VoiceCallConnectionMode,
  VoiceCallType,
  PttMode,
  CallStateListener,
  P2P_STUN_SERVERS,
} from './types';
import { signalingService, SignalingService, optimizeOpusSdp } from './signalingService';
import { callService, CallService } from './callService';
import { pttService, PttService } from './pttService';
import { pttP2pService, PttP2pService } from './pttP2pService';
import { pttBroadcastService, PttBroadcastService, normalizeOrgPttTenant, buildPttRoomName } from './pttBroadcastService';

export * from './types';
export * from './signalingService';
export * from './callService';
export * from './pttService';
export * from './pttP2pService';
export * from './pttBroadcastService';

export class VoiceCallService {
  public activeEnterpriseBlindId: string = '';
  public activeOrgId: string = '';

  setActiveEnterpriseBlindId(id: string): void {
    this.activeEnterpriseBlindId = (id || '').trim();
  }

  setActiveOrgId(orgId: string): void {
    this.activeOrgId = (orgId || '').trim();
  }

  async resolveEffectiveTenantId(providedTenant?: string): Promise<string> {
    if (providedTenant && providedTenant.trim()) {
      return providedTenant.trim().toLowerCase();
    }
    if (this.activeEnterpriseBlindId && this.activeEnterpriseBlindId.trim()) {
      return this.activeEnterpriseBlindId.trim().toLowerCase();
    }
    try {
      const active = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ACTIVE_TENANT_BLIND_ID);
      if (active && active.trim()) {
        this.activeEnterpriseBlindId = active.trim();
        return active.trim().toLowerCase();
      }
      const userOrg = await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_BLIND_ID);
      if (userOrg && userOrg.trim()) {
        this.activeEnterpriseBlindId = userOrg.trim();
        return userOrg.trim().toLowerCase();
      }
      const adminEnt = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ENTERPRISE_BLIND_ID);
      if (adminEnt && adminEnt.trim()) {
        this.activeEnterpriseBlindId = adminEnt.trim();
        return adminEnt.trim().toLowerCase();
      }
    } catch (e) {
      console.warn('[VoiceCallService] Error resolving effective tenant:', e);
    }
    return '';
  }

  async resolveEffectiveOrgId(): Promise<string> {
    if (this.activeOrgId && this.activeOrgId.trim()) {
      return this.activeOrgId.trim().toLowerCase();
    }
    try {
      const userOrg = await SafeSecureStore.getItemAsync(STORAGE_KEYS.USER_ORG_ID);
      if (userOrg && userOrg.trim()) {
        this.activeOrgId = userOrg.trim();
        return userOrg.trim().toLowerCase();
      }
      const adminOrg = await SafeSecureStore.getItemAsync(STORAGE_KEYS.ADMIN_ORG_ID);
      if (adminOrg && adminOrg.trim()) {
        this.activeOrgId = adminOrg.trim();
        return adminOrg.trim().toLowerCase();
      }
    } catch (e) {
      console.warn('[VoiceCallService] Error resolving effective org:', e);
    }
    return 'default';
  }

  private currentSession: VoiceCallSession | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private durationInterval: NodeJS.Timeout | null = null;
  private listeners: Set<CallStateListener> = new Set();

  private callsSessionId: string | null = null;
  private callsPublishedTrackName: string | null = null;
  private callsSubscribedSpeakerTrack: string | null = null;

  private dismissedRooms: Map<string, number> = new Map();
  private lastHandledRequestTs: number = 0;

  readonly call: CallService = callService;
  readonly ptt: PttService = pttService;
  readonly pttP2p: PttP2pService = pttP2pService;
  readonly pttBroadcast: PttBroadcastService = pttBroadcastService;
  readonly signaling: SignalingService = signalingService;

  cancelPendingDeletion(roomName: string): void {
    signalingService.cancelPendingDeletion(roomName);
  }

  schedulePendingDeletion(roomName: string, delayMs = 3500): void {
    signalingService.schedulePendingDeletion(roomName, delayMs);
  }

  subscribe(listener: CallStateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSession);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentSession ? { ...this.currentSession } : null);
      } catch (err) {
        console.warn('[VoiceCallService] Listener error:', err);
      }
    });
  }

  getCurrentSession(): VoiceCallSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  async checkCallEligibility(
    callerWhiteId: string,
    calleeWhiteId: string,
    tenantId?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    return callService.checkCallEligibility(callerWhiteId, calleeWhiteId, tenantId);
  }

  async checkPttEligibility(
    callerWhiteId: string,
    calleeWhiteId: string,
    tenantId?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    return pttService.checkPttEligibility(callerWhiteId, calleeWhiteId, tenantId);
  }

  resetFullState(): void {
    signalingService.clearPendingDeletions();
    this.dismissedRooms.clear();

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    InWhiteRingtone.releaseProximityLock();
    InWhiteRingtone.releaseVoipWakeLock();
    InWhiteRingtone.stopRingtone();
    InWhiteRingtone.stopRingback();
    InWhiteRingtone.resetAudioMode();

    signalingService.cleanupMedia();
    this.callsSessionId = null;
    this.callsPublishedTrackName = null;
    this.callsSubscribedSpeakerTrack = null;
    this.currentSession = null;
    this.notify();
  }

  /**
   * 1-1 Sesli Arama VEYA Bilet İçi 1-1 Bas-Konuş (PTT_P2P) Başlatma
   */
  async startDirectCall(
    ticketId: string,
    callerWhiteId: string,
    callerAlias: string,
    calleeWhiteId: string,
    calleeAlias: string,
    callType: VoiceCallType = 'call',
    targetOrgName?: string,
    targetOrgId?: string
  ): Promise<boolean> {
    this.resetFullState();

    if (callType === 'ptt') {
      // ── PTT_P2P MODU ──────────────────────────────────────────────
      this.currentSession = await pttP2pService.prepareP2pSession(
        ticketId,
        callerWhiteId,
        callerAlias,
        calleeWhiteId,
        calleeAlias,
        targetOrgName,
        targetOrgId
      );
    } else {
      // ── 1-1 TELEFON ÇAĞRISI MODU ──────────────────────────────────
      const prepared = await callService.prepareDirectCallSession(
        ticketId,
        callerWhiteId,
        callerAlias,
        calleeWhiteId,
        calleeAlias,
        targetOrgName,
        targetOrgId
      );
      this.currentSession = prepared.session;
    }
    this.notify();

    if (callType === 'ptt') {
      InWhiteRingtone.startRadioRingback();
    } else {
      InWhiteRingtone.startRingback();
    }

    await signalingService.setupPeerConnection('caller', this.currentSession.roomName, callType === 'ptt', {
      onRemoteTrackConnected: () => {
        this.establishConnectedState();
      },
      onConnectionConnected: () => {
        this.establishConnectedState();
      },
      onTurnFallbackNeeded: () => {
        void this.triggerCloudflareTurnFallback();
      },
    });

    const sdpToSend = await signalingService.createOfferSdp();

    if (callType === 'ptt') {
      const payload = pttP2pService.buildOfferPayload(this.currentSession, sdpToSend);
      await pttP2pService.dispatchP2pOffer(this.currentSession, payload);
    } else {
      const payload = JSON.stringify({
        type: 'direct_call',
        callerWhiteId,
        callerAlias,
        calleeWhiteId,
        calleeAlias,
        ticketId,
        ts: this.currentSession.requestTs,
        sdp: sdpToSend,
        callType: 'call',
        scope: 'direct',
        targetOrgName,
        targetOrgId,
      });

      console.warn('[VOICE] >>> DISPATCHING 1-1 DIRECT CALL to ticket:', ticketId, 'from:', callerAlias);

      await apiClient.publishFastSignal(
        this.currentSession.roomName,
        'caller',
        'offer',
        payload,
        'direct_call'
      );

      if (calleeWhiteId) {
        const userDirectRoom = `whitedesk_user_signal_${calleeWhiteId.toLowerCase().trim()}`;
        void apiClient.publishFastSignal(
          userDirectRoom,
          'caller',
          'offer',
          payload,
          'direct_call'
        );

        void apiClient.sendCallPushNotification(
          calleeWhiteId,
          callerAlias,
          callerWhiteId,
          ticketId,
          'call'
        );
      }
    }

    this.startCallerCallPolling(this.currentSession.roomName);
    return true;
  }

  async sendCallRequest(
    ticketId: string,
    callerWhiteId: string,
    callerAlias: string,
    calleeWhiteId: string,
    calleeAlias: string
  ): Promise<boolean> {
    return this.startDirectCall(ticketId, callerWhiteId, callerAlias, calleeWhiteId, calleeAlias);
  }

  openOrgPttConsole(
    tenantId: string,
    orgId: string,
    orgName: string,
    callerWhiteId: string,
    callerAlias: string
  ): void {
    this.resetFullState();
    this.currentSession = pttBroadcastService.createStandbySession(
      tenantId,
      orgId,
      orgName,
      callerWhiteId,
      callerAlias
    );
    this.notify();
  }

  updateOrgPttTarget(orgId: string, orgName: string, tenantId?: string): void {
    if (this.currentSession && this.currentSession.callType === 'ptt' && this.currentSession.scope === 'org_group') {
      pttBroadcastService.updateTarget(this.currentSession, orgId, orgName, tenantId);
      this.notify();
    }
  }

  setPeerEvent(text: string, type?: 'join' | 'leave', alias?: string): void {
    if (this.currentSession) {
      this.currentSession.lastPeerEvent = { text, ts: Date.now(), type, alias };
      this.notify();
    }
  }

  leaveOrgChannel(): void {
    if (this.currentSession && this.currentSession.callType === 'ptt' && this.currentSession.scope === 'org_group') {
      const roomName = this.currentSession.roomName;
      const myAlias = this.currentSession.callerAlias || this.currentSession.calleeAlias || 'Kullanıcı';
      const myId = this.currentSession.callerWhiteId || this.currentSession.calleeWhiteId || '';

      if (roomName) {
        void pttBroadcastService.broadcastPeerEvent(roomName, this.currentSession.role || 'callee', 'left', myAlias, myId);
      }

      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
      if (this.durationInterval) {
        clearInterval(this.durationInterval);
        this.durationInterval = null;
      }
      InWhiteRingtone.releaseProximityLock();
      InWhiteRingtone.releaseVoipWakeLock();
      InWhiteRingtone.stopRingtone();
      InWhiteRingtone.stopRingback();
      InWhiteRingtone.playRadioTone('close');
      InWhiteRingtone.resetAudioMode();

      signalingService.cleanupMedia();
      this.callsSessionId = null;
      this.callsPublishedTrackName = null;
      this.callsSubscribedSpeakerTrack = null;

      this.currentSession.isStandby = true;
      this.currentSession.isMuted = true;
      this.currentSession.durationSeconds = 0;
      this.currentSession.activeSpeakerAlias = '';
      this.currentSession.activeSpeakerWhiteId = '';
      this.notify();
    }
  }

  /**
   * PTT_broadcast: Saha / Kurumsal Grup Telsizi Başlatma
   */
  async startOrgGroupPttCall(
    tenantId: string,
    orgId: string,
    orgName: string,
    callerWhiteId: string,
    callerAlias: string,
    targetMembers: string[] = []
  ): Promise<boolean> {
    const cleanOrgId = orgId && orgId !== 'all' ? orgId : 'all';
    const roomName = buildPttRoomName(tenantId, cleanOrgId);

    this.resetFullState();
    await apiClient.deleteFastSignal(roomName);

    this.currentSession = pttBroadcastService.createActiveSession(
      tenantId,
      cleanOrgId,
      orgName,
      callerWhiteId,
      callerAlias
    );
    this.notify();

    InWhiteRingtone.startRadioRingback();

    this.durationInterval = setInterval(() => {
      if (this.currentSession && this.currentSession.state === 'connected') {
        this.currentSession.durationSeconds++;
        this.notify();
      }
    }, 1000);

    await signalingService.setupPeerConnection('caller', roomName, true, {
      onRemoteTrackConnected: () => {
        this.establishConnectedState();
      },
      onConnectionConnected: () => {
        this.establishConnectedState();
      },
      onTurnFallbackNeeded: () => {
        void this.triggerCloudflareTurnFallback();
      },
    });

    const sdpToSend = await signalingService.createOfferSdp();
    const payload = pttBroadcastService.buildBroadcastPayload(this.currentSession, tenantId, sdpToSend);

    await pttBroadcastService.dispatchBroadcastOffer(this.currentSession, tenantId, payload, targetMembers);

    this.startCallerCallPolling(roomName);
    return true;
  }

  async cancelCallRequest(): Promise<void> {
    return this.endCall();
  }

  async answerCall(): Promise<void> {
    if (!this.currentSession) return;
    const roomName = this.currentSession.roomName;

    InWhiteRingtone.stopRingtone();
    NotificationService.dismissCallNotification();

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.currentSession.state = 'connecting';
    this.notify();

    await signalingService.setupPeerConnection('callee', roomName, this.currentSession.isMuted, {
      onRemoteTrackConnected: () => {
        this.establishConnectedState();
      },
      onConnectionConnected: () => {
        this.establishConnectedState();
      },
      onTurnFallbackNeeded: () => {
        void this.triggerCloudflareTurnFallback();
      },
    });

    let remoteOfferSdp = signalingService.getRemoteOfferSdp();
    if (!remoteOfferSdp && roomName) {
      remoteOfferSdp = await signalingService.fetchOfferSdpForRoom(roomName);
    }

    const answerSdpToSend = remoteOfferSdp ? await signalingService.createAnswerSdp(remoteOfferSdp) : '';

    await apiClient.publishFastSignal(
      roomName,
      'callee',
      'answer',
      answerSdpToSend,
      'call_connected'
    );

    if (roomName.includes('_default_')) {
      const entRoom = roomName.replace('_default_', '_ent_1fc4c76b722c_');
      void apiClient.publishFastSignal(entRoom, 'callee', 'answer', answerSdpToSend, 'call_connected');
    } else if (roomName.includes('_ent_1fc4c76b722c_')) {
      const defRoom = roomName.replace('_ent_1fc4c76b722c_', '_default_');
      void apiClient.publishFastSignal(defRoom, 'callee', 'answer', answerSdpToSend, 'call_connected');
    }

    if (this.currentSession?.scope === 'org_group') {
      const myAlias = this.currentSession.calleeAlias || this.currentSession.callerAlias || 'Kullanıcı';
      const myId = this.currentSession.calleeWhiteId || this.currentSession.callerWhiteId || '';
      void pttBroadcastService.broadcastPeerEvent(roomName, 'callee', 'joined', myAlias, myId);
    }

    void InWhiteRingtone.routeAudio(true);

    setTimeout(() => {
      this.establishConnectedState();
    }, 400);
  }

  async acceptCallRequest(): Promise<void> {
    return this.answerCall();
  }

  async rejectCall(): Promise<void> {
    if (!this.currentSession) return;
    const roomName = this.currentSession.roomName;
    const calleeWhiteId = this.currentSession.calleeWhiteId;
    const callerWhiteId = this.currentSession.callerWhiteId;
    const currentTs = this.currentSession.requestTs || Date.now();
    this.lastHandledRequestTs = Math.max(this.lastHandledRequestTs, currentTs, Date.now());

    const now = Date.now();
    this.dismissedRooms.set(roomName, now);
    if (callerWhiteId) {
      this.dismissedRooms.set(`whitedesk_user_signal_${callerWhiteId.toLowerCase().trim()}`, now);
    }
    if (calleeWhiteId) {
      this.dismissedRooms.set(`whitedesk_user_signal_${calleeWhiteId.toLowerCase().trim()}`, now);
    }

    InWhiteRingtone.stopRingtone();
    InWhiteRingtone.stopRingback();
    InWhiteRingtone.resetAudioMode();
    this.cleanupSession();

    void apiClient.publishFastSignal(roomName, 'callee', 'reject');
    void apiClient.deleteFastSignal(roomName);
    if (callerWhiteId) {
      const callerDirectRoom = `whitedesk_user_signal_${callerWhiteId.toLowerCase().trim()}`;
      void apiClient.publishFastSignal(callerDirectRoom, 'callee', 'reject');
    }
    if (calleeWhiteId) {
      void apiClient.deleteFastSignal(`whitedesk_user_signal_${calleeWhiteId.toLowerCase().trim()}`);
    }
  }

  async rejectCallRequest(): Promise<void> {
    return this.rejectCall();
  }

  async endCall(): Promise<void> {
    if (!this.currentSession) return;
    const roomName = this.currentSession.roomName;
    const role = this.currentSession.role;
    const otherWhiteId = role === 'caller' ? this.currentSession.calleeWhiteId : this.currentSession.callerWhiteId;

    InWhiteRingtone.stopRingtone();
    InWhiteRingtone.stopRingback();
    NotificationService.dismissCallNotification();
    this.dismissedRooms.set(roomName, Date.now());
    const ticketId = this.currentSession.ticketId;
    const myId = role === 'caller' ? this.currentSession.callerWhiteId : this.currentSession.calleeWhiteId;
    this.cleanupSession();

    await apiClient.publishFastSignal(roomName, role, 'hangup');
    if (otherWhiteId) {
      const otherRoom = `whitedesk_user_signal_${otherWhiteId.toLowerCase().trim()}`;
      void apiClient.publishFastSignal(otherRoom, role, 'hangup');
      signalingService.schedulePendingDeletion(otherRoom, 3000);
      void apiClient.sendCancelCallPushNotification(otherWhiteId, myId || '', ticketId);
    }

    signalingService.schedulePendingDeletion(roomName, 3000);
  }

  toggleMute(): boolean {
    if (!this.currentSession) return false;
    this.currentSession.isMuted = !this.currentSession.isMuted;
    signalingService.setMute(this.currentSession.isMuted);
    this.notify();
    return this.currentSession.isMuted;
  }

  setMute(muted: boolean): void {
    if (!this.currentSession) return;
    this.currentSession.isMuted = muted;
    signalingService.setMute(muted);

    if (this.currentSession.scope === 'org_group' && this.currentSession.roomName) {
      const myAlias = this.currentSession.callerAlias || this.currentSession.calleeAlias || 'Kullanıcı';
      const myId = this.currentSession.callerWhiteId || this.currentSession.calleeWhiteId || '';

      void pttBroadcastService.broadcastSpeakerState(
        this.currentSession.roomName,
        this.currentSession.role || 'callee',
        !muted,
        myAlias,
        myId,
        this.callsSessionId,
        this.callsPublishedTrackName
      );
    }

    this.notify();
  }

  toggleSpeaker(): boolean {
    if (!this.currentSession) return false;
    this.currentSession.isSpeaker = !this.currentSession.isSpeaker;
    signalingService.toggleSpeaker(this.currentSession.isSpeaker);
    this.notify();
    return this.currentSession.isSpeaker;
  }

  async triggerCloudflareTurnFallback(): Promise<void> {
    if (!this.currentSession) return;
    try {
      const turn = await apiClient.fetchTurnCredentials();
      if (turn && turn.iceServers) {
        this.currentSession.connectionMode = 'cloudflare_turn_relay';
        this.notify();
      }
    } catch (e) {
      console.warn('[VoiceCallService] TURN Relay fallback failed:', e);
    }
  }

  private startCallerCallPolling(roomName: string) {
    if (this.pollInterval) clearInterval(this.pollInterval);

    this.pollInterval = callService.startCallerPolling(
      roomName,
      async (remoteAnswerSdp) => {
        if (remoteAnswerSdp) {
          await signalingService.setRemoteAnswerSdp(remoteAnswerSdp);
        }
        void InWhiteRingtone.routeAudio(true);
        if (this.currentSession) {
          this.currentSession.state = 'connecting';
          this.notify();
          setTimeout(() => {
            this.establishConnectedState();
          }, 600);
        }
      },
      (failureReason) => {
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = null;
        }
        this.dismissedRooms.set(roomName, Date.now());
        this.cleanupSession(failureReason);
      },
      () => {
        this.cleanupSession('Arama sonlandırıldı.');
      }
    );
  }

  private startCalleeRingingWatcher(roomName: string, ownWhiteId?: string) {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = callService.startCalleeRingingWatcher(
      roomName,
      ownWhiteId,
      (reason) => {
        this.cleanupSession(reason);
      }
    );
  }

  private startConnectedHangupWatcher(roomName: string, role: 'caller' | 'callee') {
    if (this.pollInterval) clearInterval(this.pollInterval);
    let connectedNotFoundCount = 0;

    this.pollInterval = setInterval(async () => {
      if (!this.currentSession || this.currentSession.state !== 'connected') {
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = null;
        }
        return;
      }

      const signal = await apiClient.fetchFastSignal(roomName, role);
      if (signal?.signalType === 'hangup' || signal?.signalType === 'reject') {
        if (this.currentSession.scope !== 'org_group') {
          console.warn('[VOICE] Counterpart hung up the call. Closing session.');
          this.cleanupSession('Görüşme karşı tarafça sonlandırıldı.');
          return;
        }
      }

      if (!signal || !signal.found) {
        connectedNotFoundCount++;
        if (connectedNotFoundCount >= 3) {
          if (this.currentSession.scope !== 'org_group') {
            console.warn('[VOICE] Room signal ended/cleared. Closing session.');
            this.cleanupSession('Görüşme sonlandırıldı.');
          }
        }
        return;
      }
      connectedNotFoundCount = 0;

      if (this.currentSession.scope === 'org_group') {
        if (signal.targetMode === 'peer_join' || signal.targetMode === 'peer_leave') {
          try {
            const data = JSON.parse(signal.offerSdp || signal.answerSdp || '{}');
            const myId = this.currentSession.callerWhiteId || this.currentSession.calleeWhiteId || '';
            if (data.whiteId && data.whiteId.toLowerCase() !== myId.toLowerCase()) {
              const alias = data.alias || 'Birisi';
              if (signal.targetMode === 'peer_join') {
                this.setPeerEvent(`${alias} katıldı`, 'join', alias);
              } else {
                this.setPeerEvent(`${alias} ayrıldı`, 'leave', alias);
              }
            }
          } catch {}
        } else if (signal.targetMode === 'speaker_start' || signal.targetMode === 'speaker_stop') {
          try {
            const data = JSON.parse(signal.offerSdp || signal.answerSdp || '{}');
            const myId = this.currentSession.callerWhiteId || this.currentSession.calleeWhiteId || '';
            if (data.whiteId && data.whiteId.toLowerCase() !== myId.toLowerCase()) {
              if (signal.targetMode === 'speaker_start') {
                this.currentSession.activeSpeakerAlias = data.alias;
                this.currentSession.activeSpeakerWhiteId = data.whiteId;
              } else {
                this.currentSession.activeSpeakerAlias = '';
                this.currentSession.activeSpeakerWhiteId = '';
              }
              this.notify();
            }
          } catch {}
        }
      }
    }, 900);
  }

  private establishConnectedState() {
    if (!this.currentSession || this.currentSession.state === 'connected') return;
    this.currentSession.state = 'connected';
    this.currentSession.startTime = Date.now();
    this.notify();

    InWhiteRingtone.stopRingtone();
    InWhiteRingtone.stopRingback();

    if (this.currentSession.callType === 'ptt') {
      InWhiteRingtone.playRadioTone('open');
    }

    const isTablet = InWhiteRingtone.isTablet();
    const shouldSpeaker = isTablet ? true : this.currentSession.isSpeaker;
    this.currentSession.isSpeaker = shouldSpeaker;
    void InWhiteRingtone.routeAudio(shouldSpeaker);

    InWhiteRingtone.acquireVoipWakeLock();
    if (!isTablet) {
      InWhiteRingtone.acquireProximityLock();
    }

    this.startConnectedHangupWatcher(this.currentSession.roomName, this.currentSession.role);

    if (this.durationInterval) clearInterval(this.durationInterval);
    this.durationInterval = setInterval(() => {
      if (this.currentSession && this.currentSession.state === 'connected') {
        this.currentSession.durationSeconds += 1;
        this.notify();
      }
    }, 1000);
  }

  private cleanupSession(reason?: string) {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }

    InWhiteRingtone.releaseProximityLock();
    InWhiteRingtone.releaseVoipWakeLock();
    InWhiteRingtone.stopRingtone();
    InWhiteRingtone.stopRingback();

    if (this.currentSession?.callType === 'ptt') {
      InWhiteRingtone.playRadioTone('close');
    }

    InWhiteRingtone.resetAudioMode();
    NotificationService.dismissCallNotification();

    signalingService.cleanupMedia();
    this.callsSessionId = null;
    this.callsPublishedTrackName = null;
    this.callsSubscribedSpeakerTrack = null;

    if (this.currentSession) {
      this.currentSession.state = 'ended';
      this.currentSession.failureReason = reason;
      this.notify();

      if (reason === 'rejected') {
        setTimeout(() => {
          this.currentSession = null;
          this.notify();
        }, 50);
      } else {
        this.currentSession = null;
        this.notify();
      }
    }
  }

  async presentIncomingCallFromPush(
    data: {
      ticketId?: string;
      callerAlias?: string;
      callerWhiteId?: string;
      callType?: string;
      type?: string;
    },
    ownWhiteId?: string,
    autoAnswer: boolean = false
  ): Promise<void> {
    try {
      if (this.currentSession && this.currentSession.state !== 'idle') {
        if (autoAnswer && this.currentSession.state === 'incoming_ringing') {
          void this.answerCall();
        }
        return;
      }

      const isPtt = data.callType === 'ptt' || data.type === 'org_ptt' || data.type === 'direct_ptt';
      const cleanOrgId = (data as any).targetOrgId || (data as any).orgId || 'all';
      const resolvedTicketId = data.ticketId || (isPtt ? `org_${cleanOrgId}` : 'direct');
      const isOrgPtt = data.type === 'org_ptt' || data.type === 'org_ptt_broadcast' || (isPtt && !data.ticketId);
      const incomingTenant = (data as any).tenantId || (data as any).tenant_id || (data as any).enterpriseBlindId;

      // 🛑 KESİN VE KIRILAMAZ FİRMA & GRUP İZOLASYONU GİRİŞ BARİYERİ (ZERO TRUST)
      if (isOrgPtt) {
        const myTenant = await this.resolveEffectiveTenantId();
        const incTenant = (incomingTenant || '').trim().toLowerCase();

        // 1. Firma Kontrolü: Her iki tarafın firması da dolu olmalı ve birbirine BİREBİR eşit olmalıdır!
        if (!incTenant || !myTenant || myTenant !== incTenant) {
          console.warn('[VOICE ISOLATION] Incoming PTT call BLOCKED! Callee tenant:', myTenant, 'vs Incoming tenant:', incTenant);
          return;
        }

        // 2. Grup / Birim Kontrolü: Eğer belirli bir gruba anons yapılmışsa, yalnızca o gruptaki kullanıcılarda çalar!
        const targetOrg = cleanOrgId ? cleanOrgId.trim().toLowerCase() : 'all';
        const myOrg = await this.resolveEffectiveOrgId();
        if (targetOrg !== 'all' && targetOrg !== '*' && targetOrg !== 'global') {
          if (myOrg && myOrg !== targetOrg) {
            console.warn('[VOICE ISOLATION] Incoming PTT call BLOCKED by group filter! Target org:', targetOrg, 'vs My org:', myOrg);
            return;
          }
        }
      }

      const tenantId = incomingTenant || this.activeEnterpriseBlindId || 'unassigned';
      const actualCallRoom = isOrgPtt
        ? buildPttRoomName(tenantId, cleanOrgId)
        : `whitedesk_call_${resolvedTicketId}`;
      const incomingCallType: 'call' | 'ptt' = isPtt ? 'ptt' : 'call';
      const pttMode: PttMode | undefined = isPtt ? (isOrgPtt ? 'PTT_broadcast' : 'PTT_P2P') : undefined;

      console.warn('[VOICE] >>> PRESENTING INCOMING CALL/PTT MODAL! Caller:', data.callerAlias, 'Ticket:', resolvedTicketId, 'isPtt:', isPtt, 'Room:', actualCallRoom, 'autoAnswer:', autoAnswer);

      this.currentSession = {
        ticketId: resolvedTicketId,
        roomName: actualCallRoom,
        callerWhiteId: data.callerWhiteId || '',
        callerAlias: data.callerAlias || (isPtt ? 'Kurumsal Telsiz' : 'Operatör'),
        calleeWhiteId: ownWhiteId || '',
        calleeAlias: isOrgPtt ? ((data as any).orgName || (data as any).targetOrgName || 'Birim Telsizi') : 'Siz',
        state: 'incoming_ringing',
        connectionMode: 'p2p_direct',
        durationSeconds: 0,
        isMuted: isPtt,
        isSpeaker: true,
        role: 'callee',
        requestTs: Date.now(),
        callType: incomingCallType,
        scope: isOrgPtt ? 'org_group' : 'direct',
        pttMode,
        targetOrgId: cleanOrgId,
        targetOrgName: (data as any).targetOrgName || (data as any).orgName || data.callerAlias || 'Kurumsal Telsiz',
      } as any;
      this.notify();

      NotificationService.dismissCallNotification();
      if (isPtt) {
        InWhiteRingtone.startRadioRingtone();
      } else {
        InWhiteRingtone.startRingtone();
      }

      if (!isOrgPtt) {
        this.startCalleeRingingWatcher(actualCallRoom, ownWhiteId);
      }

      void signalingService.fetchOfferSdpForRoom(actualCallRoom);

      if (autoAnswer) {
        setTimeout(() => {
          void this.answerCall();
        }, 60);
      }
    } catch (err) {
      console.warn('[VOICE] Error in presentIncomingCallFromPush:', err);
    }
  }

  async checkForIncomingCall(
    ticketId?: string,
    ownWhiteId?: string,
    tenantId?: string,
    orgId?: string,
    autoAnswer: boolean = false
  ): Promise<boolean> {
    if (this.currentSession && this.currentSession.state !== 'idle') return false;
    try {
      const roomsToCheck: string[] = [];
      if (ownWhiteId) {
        roomsToCheck.push(`whitedesk_user_signal_${ownWhiteId.toLowerCase().trim()}`);
        try {
          const blind = WhiteDeskCrypto.generateBlindId(ownWhiteId);
          if (blind && blind.toLowerCase().trim() !== ownWhiteId.toLowerCase().trim()) {
            roomsToCheck.push(`whitedesk_user_signal_${blind.toLowerCase().trim()}`);
          }
        } catch {}
      }
      if (ticketId) {
        roomsToCheck.push(`whitedesk_call_${ticketId}`);
      }
      const effectiveTenant = tenantId || this.activeEnterpriseBlindId;
      if (effectiveTenant) {
        const cleanOrgId = orgId && orgId !== 'all' ? orgId : 'all';
        roomsToCheck.push(buildPttRoomName(effectiveTenant, cleanOrgId));
        if (cleanOrgId !== 'all') {
          roomsToCheck.push(buildPttRoomName(effectiveTenant, 'all'));
        }
      }

      for (const roomName of roomsToCheck) {
        const signal = await apiClient.fetchFastSignal(roomName, 'callee');
        if (signal && signal.found && signal.offerSdp) {
          if (signal.signalType === 'reject' || signal.signalType === 'hangup') {
            continue;
          }

          let callData: any = null;
          let offerSdpText = signal.offerSdp;
          try {
            const parsed = JSON.parse(signal.offerSdp);
            if (parsed && typeof parsed === 'object') {
              callData = parsed;
              if (parsed.sdp) {
                offerSdpText = parsed.sdp;
              }
            }
          } catch {}

          const isOrgPttBroadcast =
            callData?.type === 'org_ptt_broadcast' ||
            signal.targetMode === 'org_ptt_broadcast';

          const incomingCallType: VoiceCallType =
            isOrgPttBroadcast ||
            callData?.callType === 'ptt' ||
            callData?.type === 'direct_ptt' ||
            signal.targetMode === 'direct_ptt'
              ? 'ptt'
              : 'call';

          const pttMode: PttMode | undefined =
            incomingCallType === 'ptt'
              ? (isOrgPttBroadcast ? 'PTT_broadcast' : 'PTT_P2P')
              : undefined;

          const isDirectCall =
            isOrgPttBroadcast ||
            callData?.type === 'direct_call' ||
            callData?.type === 'direct_ptt' ||
            callData?.type === 'call_request' ||
            signal.targetMode === 'direct_call' ||
            signal.targetMode === 'direct_ptt' ||
            signal.targetMode === 'start_call';

          if (!isDirectCall) continue;

          const signalTs = Number(callData?.ts);
          if (!signalTs || isNaN(signalTs)) {
            void apiClient.deleteFastSignal(roomName);
            continue;
          }

          if (signalTs <= this.lastHandledRequestTs) {
            continue;
          }

          if (Date.now() - signalTs < 35000) {
            const callerId = callData?.callerWhiteId || '';
            if (callerId && ownWhiteId && callerId.toLowerCase() === ownWhiteId.toLowerCase()) {
              continue;
            }

            // 🛑 KESİN VE KIRILAMAZ FİRMA & GRUP İZOLASYONU (ZERO TRUST)
            if (isOrgPttBroadcast) {
              const incomingTenant = (callData?.tenantId || '').trim().toLowerCase();
              const expectedTenant = await this.resolveEffectiveTenantId(tenantId);
              if (!incomingTenant || !expectedTenant || incomingTenant !== expectedTenant) {
                console.warn('[VOICE ISOLATION] Dropping signal offer: Callee tenant:', expectedTenant, 'vs Incoming tenant:', incomingTenant);
                void apiClient.deleteFastSignal(roomName);
                continue;
              }

              // Grup Kontrolü
              const targetOrg = (callData?.orgId || '').trim().toLowerCase();
              const myOrg = await this.resolveEffectiveOrgId();
              if (targetOrg && targetOrg !== 'all' && targetOrg !== '*' && targetOrg !== 'global') {
                if (myOrg !== targetOrg) {
                  console.warn('[VOICE ISOLATION] Dropping signal offer by group filter: Target org:', targetOrg, 'vs My org:', myOrg);
                  void apiClient.deleteFastSignal(roomName);
                  continue;
                }
              }
            }

            const resolvedTicketId = callData?.ticketId || (isOrgPttBroadcast ? `org_${callData?.orgId || 'all'}` : ticketId) || 'general';
            const actualCallRoom = isOrgPttBroadcast
              ? buildPttRoomName(callData?.tenantId || tenantId, callData?.orgId)
              : `whitedesk_call_${resolvedTicketId}`;

            if (!isOrgPttBroadcast && ownWhiteId) {
              try {
                const userPrefs = await helpDeskService.getUserAdvancedPreferences(ownWhiteId);
                const isCallDisabled = incomingCallType === 'call' && userPrefs.voiceCallEnabled === false;
                const isPttDisabled = incomingCallType === 'ptt' && userPrefs.pushToTalkEnabled === false;

                if (isCallDisabled || isPttDisabled) {
                  const reasonMode = isPttDisabled ? 'ptt_disabled_by_user' : 'call_disabled_by_user';
                  console.warn(`[VOICE] Auto-rejecting incoming ${incomingCallType} because user preference is disabled.`);
                  this.lastHandledRequestTs = signalTs;
                  this.dismissedRooms.set(actualCallRoom, Date.now());
                  await apiClient.publishFastSignal(actualCallRoom, 'callee', 'reject', undefined, reasonMode);
                  void apiClient.deleteFastSignal(actualCallRoom);
                  if (callerId) {
                    const callerDirectRoom = `whitedesk_user_signal_${callerId.toLowerCase().trim()}`;
                    void apiClient.publishFastSignal(callerDirectRoom, 'callee', 'reject', undefined, reasonMode);
                  }
                  if (ownWhiteId) {
                    void apiClient.deleteFastSignal(`whitedesk_user_signal_${ownWhiteId.toLowerCase().trim()}`);
                  }
                  continue;
                }
              } catch (prefErr) {
                console.warn('[VOICE] Error checking recipient local prefs:', prefErr);
              }
            }

            console.warn('[VOICE] <<< INCOMING DIRECT CALL RECEIVED! From:', callData?.callerAlias || 'Operatör', 'Ticket:', resolvedTicketId, 'type:', incomingCallType, 'pttMode:', pttMode);
            this.lastHandledRequestTs = signalTs;
            signalingService.cancelPendingDeletion(roomName);
            signalingService.cancelPendingDeletion(actualCallRoom);
            this.dismissedRooms.delete(roomName);
            this.dismissedRooms.delete(actualCallRoom);

            signalingService.setRemoteOfferSdp(offerSdpText);
            if (incomingCallType === 'ptt') {
              InWhiteRingtone.startRadioRingtone();
            } else {
              InWhiteRingtone.startRingtone();
            }

            this.currentSession = {
              ticketId: resolvedTicketId,
              roomName: actualCallRoom,
              callerWhiteId: callData?.callerWhiteId || '',
              callerAlias: callData?.callerAlias || 'Operatör',
              calleeWhiteId: ownWhiteId || '',
              calleeAlias: isOrgPttBroadcast ? (callData?.orgName || 'Birim Telsizi') : 'Siz',
              state: 'incoming_ringing',
              connectionMode: 'p2p_direct',
              durationSeconds: 0,
              isMuted: incomingCallType === 'ptt',
              isSpeaker: true,
              role: 'callee',
              requestTs: signalTs,
              callType: incomingCallType,
              scope: isOrgPttBroadcast ? 'org_group' : 'direct',
              pttMode,
              targetOrgId: callData?.orgId,
              targetOrgName: callData?.orgName,
              activeSpeakerAlias: callData?.callerAlias,
              activeSpeakerWhiteId: callData?.callerWhiteId,
              publisherCallsSessionId: callData?.callsSessionId,
              publisherTrackName: callData?.trackName,
            } as any;
            this.notify();

            if (!isOrgPttBroadcast) {
              this.startCalleeRingingWatcher(actualCallRoom, ownWhiteId);
            }
            if (autoAnswer) {
              setTimeout(() => {
                void this.answerCall();
              }, 60);
            }
            return true;
          } else {
            if (roomName.startsWith('whitedesk_user_signal_')) {
              void apiClient.deleteFastSignal(roomName);
            }
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  }
}

export const voiceCallService = new VoiceCallService();
