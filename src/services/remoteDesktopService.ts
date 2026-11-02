import { Platform, NativeModules, DeviceEventEmitter } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import { apiClient } from './apiClient';
import { P2P_STUN_SERVERS } from './voice/types';
import { diagnosticRecorder } from './diagnosticRecorder';
import { WhiteDeskCrypto } from '../whitedesk-sdk';

export interface RemoteDesktopSession {
  ticketId: string;
  roomName: string;
  role: 'admin' | 'user';
  status:
    | 'idle'
    | 'offering'
    | 'incoming_offer'
    | 'connecting'
    | 'active'
    | 'rejected'
    | 'disabled_by_user'
    | 'ended';
  peerAlias?: string;
  liveFrameUri?: string | null;
  remoteControlGranted?: boolean;
  targetUserWhiteId?: string;
  callerWhiteId?: string;
}

type SessionListener = (session: RemoteDesktopSession | null) => void;

const CHUNK_SIZE = 14000;

class RemoteDesktopService {
  private currentSession: RemoteDesktopSession | null = null;
  private listeners: Set<SessionListener> = new Set();
  private pollTimer: any = null;
  private nativeFrameSub: any = null;
  private lastProcessedCmdTs: number = 0;
  private isUploadingFallbackFrame: boolean = false;

  // P2P WebRTC DataChannel
  private pc: any = null;
  private dataChannel: any = null;
  private isP2pOpen: boolean = false;
  private handledOfferSdp: boolean = false;
  private handledAnswerSdp: boolean = false;
  private incomingFrameChunks: Map<number, { total: number; parts: string[] }> = new Map();
  private frameSeq: number = 0;

  public subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSession);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const l of this.listeners) {
      try {
        l(this.currentSession ? { ...this.currentSession } : null);
      } catch {}
    }
  }

  public getSession(): RemoteDesktopSession | null {
    return this.currentSession;
  }

  private getRoomName(ticketId: string): string {
    return `whitedesk_rd_${ticketId.toLowerCase().trim()}`;
  }

  public async isNativeAccessibilityEnabled(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const mod = NativeModules.WhiteDeskNotificationModule;
      if (mod && typeof mod.isRemoteControlEnabled === 'function') {
        return Boolean(await mod.isRemoteControlEnabled());
      }
    } catch {}
    return false;
  }

  public openNativeAccessibilitySettings(): void {
    if (Platform.OS !== 'android') return;
    try {
      const mod = NativeModules.WhiteDeskNotificationModule;
      if (mod && typeof mod.openRemoteControlSettings === 'function') {
        mod.openRemoteControlSettings();
      }
    } catch {}
  }

  public minimizeAppToBackground(): void {
    if (Platform.OS !== 'android') return;
    try {
      const mod = NativeModules.WhiteDeskNotificationModule;
      if (mod && typeof mod.minimizeApp === 'function') {
        mod.minimizeApp();
      }
    } catch {}
  }

  private async captureSystemScreenFrame(): Promise<string | null> {
    if (Platform.OS !== 'android') return null;
    try {
      const mod = NativeModules.WhiteDeskNotificationModule;
      if (mod && typeof mod.captureScreenFrame === 'function') {
        return await mod.captureScreenFrame();
      }
    } catch {}
    return null;
  }

  private startNativeStreamLoop(): void {
    if (Platform.OS !== 'android') return;
    if (this.nativeFrameSub) {
      this.nativeFrameSub.remove();
      this.nativeFrameSub = null;
    }

    // Native Kotlin Handler(Looper.getMainLooper()) her ~260ms'de ve her dokunuş sonrasında
    // arka planda (Masaüstünde / diğer uygulamalarda) hiç donmadan bu olayı tetikler!
    this.nativeFrameSub = DeviceEventEmitter.addListener(
      'onNativeRemoteScreenFrame',
      (event: { frame?: string }) => {
        if (!this.currentSession || this.currentSession.status !== 'active') return;
        const frameUri = event?.frame;
        if (frameUri) {
          const sentP2p = this.sendFrameOverP2p(frameUri);
          if (!sentP2p && !this.isUploadingFallbackFrame) {
            this.isUploadingFallbackFrame = true;
            const roomName = this.currentSession.roomName;
            void apiClient
              .publishFastSignal(
                roomName,
                'callee',
                'answer',
                JSON.stringify({
                  type: 'rd_live_frame',
                  frame: frameUri,
                  timestamp: Date.now(),
                }),
                'rd_live_frame'
              )
              .finally(() => {
                this.isUploadingFallbackFrame = false;
              });
          }
        }
        // Masaüstündeyken JS setInterval uyutulsa bile native tick ile bekleyen P2P/komut sinyallerini kontrol et
        if (!this.isP2pOpen) {
          void this.pollUserSignalOnce();
        }
      }
    );

    try {
      const mod = NativeModules.WhiteDeskNotificationModule;
      if (mod && typeof mod.startNativeScreenStream === 'function') {
        mod.startNativeScreenStream();
      }
    } catch {}
  }

  private stopNativeStreamLoop(): void {
    if (this.nativeFrameSub) {
      this.nativeFrameSub.remove();
      this.nativeFrameSub = null;
    }
    if (Platform.OS === 'android') {
      try {
        const mod = NativeModules.WhiteDeskNotificationModule;
        if (mod && typeof mod.stopNativeScreenStream === 'function') {
          mod.stopNativeScreenStream();
        }
      } catch {}
    }
  }

  private async getIceServers(): Promise<Array<{ urls: string | string[]; username?: string; credential?: string }>> {
    try {
      const turn = await apiClient.fetchTurnCredentials();
      if (turn?.iceServers && turn.iceServers.length > 0) {
        return turn.iceServers;
      }
    } catch {}
    return P2P_STUN_SERVERS;
  }

  private waitForIceGathering(pc: any, timeoutMs: number = 600): Promise<void> {
    return new Promise((resolve) => {
      if (!pc || pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          finish();
        }
      };
    });
  }

  private wireDataChannel(dc: any): void {
    this.dataChannel = dc;
    dc.onopen = () => {
      this.isP2pOpen = true;
    };
    dc.onclose = () => {
      this.isP2pOpen = false;
    };
    dc.onmessage = (event: any) => {
      try {
        const msg = JSON.parse(event.data);
        if (!msg) return;

        if (msg.type === 'rd_input') {
          void this.executeIncomingRemoteCommand(msg);
          return;
        }

        if (msg.type === 'rd_frame_chunk') {
          const { seq, idx, total, data } = msg;
          let entry = this.incomingFrameChunks.get(seq);
          if (!entry) {
            if (this.incomingFrameChunks.size > 3) {
              this.incomingFrameChunks.clear();
            }
            entry = { total, parts: new Array(total).fill('') };
            this.incomingFrameChunks.set(seq, entry);
          }
          entry.parts[idx] = data;
          const isComplete = entry.parts.every((p) => p.length > 0);
          if (isComplete) {
            const fullFrame = entry.parts.join('');
            this.incomingFrameChunks.delete(seq);
            if (this.currentSession) {
              this.currentSession = {
                ...this.currentSession,
                status: 'active',
                liveFrameUri: fullFrame,
              };
              this.notify();
            }
          }
          return;
        }

        if (msg.type === 'rd_hangup') {
          void this.endSession(false);
        }
      } catch {}
    };
  }

  private sendFrameOverP2p(frameUri: string): boolean {
    if (!this.isP2pOpen || !this.dataChannel || this.dataChannel.readyState !== 'open') {
      return false;
    }
    try {
      const seq = ++this.frameSeq;
      const total = Math.ceil(frameUri.length / CHUNK_SIZE);
      for (let i = 0; i < total; i++) {
        const slice = frameUri.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        this.dataChannel.send(
          JSON.stringify({
            type: 'rd_frame_chunk',
            seq,
            idx: i,
            total,
            data: slice,
          })
        );
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 1. ADMIN: Uzak Masaüstü İsteği Başlatır
   */
  public async startAdminOffer(
    ticketId: string,
    adminAlias: string,
    targetUserWhiteId?: string,
    callerWhiteId?: string
  ): Promise<void> {
    this.cleanupP2p();
    this.stopPolling();
    const roomName = this.getRoomName(ticketId);
    await apiClient.deleteFastSignal(roomName);

    this.handledOfferSdp = false;
    this.handledAnswerSdp = false;

    this.currentSession = {
      ticketId,
      roomName,
      role: 'admin',
      status: 'offering',
      peerAlias: adminAlias || 'Admin',
      liveFrameUri: null,
      targetUserWhiteId,
      callerWhiteId,
    };
    this.notify();

    diagnosticRecorder.recordAction(`Uzak Masaüstü İsteği Gönderildi (#${ticketId})`, {
      biletNo: `#${ticketId}`,
      oda: roomName,
    });

    const invitePayload = JSON.stringify({
      type: 'rd_invite',
      ticketId,
      adminAlias: adminAlias || 'Admin',
      timestamp: Date.now(),
    });

    await apiClient.publishFastSignal(roomName, 'caller', 'offer', invitePayload, 'rd_invite');

    void apiClient.sendCallPushNotification(
      targetUserWhiteId || '',
      adminAlias || 'Admin',
      callerWhiteId || '',
      ticketId,
      'remote_desktop'
    );

    if (targetUserWhiteId) {
      try {
        const targetBlind = targetUserWhiteId.startsWith('blind_')
          ? targetUserWhiteId
          : WhiteDeskCrypto.generateBlindId(targetUserWhiteId);
        const senderBlind = callerWhiteId
          ? callerWhiteId.startsWith('blind_')
            ? callerWhiteId
            : WhiteDeskCrypto.generateBlindId(callerWhiteId)
          : 'admin_rd';
        void apiClient.sendRelayMessage({
          ticket_id: ticketId,
          recipient_blind_id: targetBlind,
          sender_blind_id: senderBlind,
          encrypted_payload: JSON.stringify({
            type: 'rd_invite_signal',
            ticket_id: ticketId,
            admin_alias: adminAlias || 'Destek Uzmanı',
            timestamp: Date.now(),
          }),
        });
      } catch {}
    }

    this.pollTimer = setInterval(async () => {
      if (!this.currentSession || this.currentSession.roomName !== roomName) {
        this.stopPolling();
        return;
      }
      if (this.isP2pOpen) return;

      try {
        const sig = await apiClient.fetchFastSignal(roomName, 'caller');
        if (!sig || !sig.found) return;

        if (sig.signalType === 'reject') {
          const isDisabled = sig.targetMode === 'rd_disabled_by_user';
          this.currentSession = {
            ...this.currentSession,
            status: isDisabled ? 'disabled_by_user' : 'rejected',
          };
          this.notify();
          this.stopPolling();
          void apiClient.deleteFastSignal(roomName);
          return;
        }

        if (sig.signalType === 'hangup') {
          void this.endSession(false);
          return;
        }

        if (sig.answerSdp) {
          let parsed: any = null;
          try {
            parsed = JSON.parse(sig.answerSdp);
          } catch {}

          if (parsed && (parsed.type === 'rd_p2p_offer' || parsed.type === 'rd_live_frame')) {
            if (this.currentSession && this.currentSession.status === 'offering') {
              this.currentSession = {
                ...this.currentSession,
                status: 'active',
                liveFrameUri: parsed.firstFrame || parsed.frame || this.currentSession.liveFrameUri,
              };
              this.notify();
            } else if (parsed.frame && this.currentSession) {
              this.currentSession = {
                ...this.currentSession,
                liveFrameUri: parsed.frame,
              };
              this.notify();
            }

            if (parsed.type === 'rd_p2p_offer' && parsed.sdp && !this.handledOfferSdp) {
              this.handledOfferSdp = true;
              await this.acceptP2pOfferOnAdmin(roomName, parsed.sdp);
              return;
            }
          }
        }
      } catch {}
    }, 350);
  }

  private async acceptP2pOfferOnAdmin(roomName: string, offerSdp: string): Promise<void> {
    try {
      const iceServers = await this.getIceServers();
      const pc: any = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
      } as any);
      this.pc = pc;

      pc.ondatachannel = (event: any) => {
        if (event?.channel) {
          this.wireDataChannel(event.channel);
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.waitForIceGathering(pc, 600);

      const finalAnswerSdp = pc.localDescription?.sdp || answer.sdp;
      await apiClient.publishFastSignal(
        roomName,
        'caller',
        'offer',
        JSON.stringify({
          type: 'rd_p2p_answer',
          sdp: finalAnswerSdp,
          timestamp: Date.now(),
        }),
        'rd_p2p_answer'
      );
    } catch (e) {
      console.warn('[RemoteDesktopService] Admin P2P answer error:', e);
    }
  }

  /**
   * 2. USER: Gelen Uzak Masaüstü davetini karşılar ve onay penceresini açar
   */
  public async receiveIncomingInvite(
    ticketId: string,
    adminAlias: string,
    userRemoteDesktopEnabled: boolean = true
  ): Promise<void> {
    if (!ticketId) return;
    if (
      this.currentSession &&
      this.currentSession.ticketId === ticketId &&
      (this.currentSession.status === 'incoming_offer' ||
        this.currentSession.status === 'connecting' ||
        this.currentSession.status === 'active')
    ) {
      return;
    }

    const roomName = this.getRoomName(ticketId);

    if (!userRemoteDesktopEnabled) {
      await apiClient.publishFastSignal(roomName, 'callee', 'reject', '', 'rd_disabled_by_user');
      return;
    }

    const hasAccess = await this.isNativeAccessibilityEnabled();
    this.handledAnswerSdp = false;
    this.currentSession = {
      ticketId,
      roomName,
      role: 'user',
      status: 'incoming_offer',
      peerAlias: adminAlias || 'Destek Uzmanı',
      remoteControlGranted: hasAccess,
    };
    this.notify();
  }

  private async pollUserSignalOnce(): Promise<void> {
    if (
      !this.currentSession ||
      this.currentSession.role !== 'user' ||
      this.currentSession.status !== 'active'
    ) {
      return;
    }
    const { roomName } = this.currentSession;
    try {
      const sig = await apiClient.fetchFastSignal(roomName, 'callee');
      if (!sig || !sig.found) return;

      if (sig.signalType === 'hangup') {
        void this.endSession(false);
        return;
      }

      if (!sig.offerSdp) return;
      let parsed: any = null;
      try {
        parsed = JSON.parse(sig.offerSdp);
      } catch {
        return;
      }

      if (parsed.type === 'rd_p2p_answer' && parsed.sdp && this.pc && !this.handledAnswerSdp) {
        this.handledAnswerSdp = true;
        try {
          await this.pc.setRemoteDescription(
            new RTCSessionDescription({ type: 'answer', sdp: parsed.sdp })
          );
        } catch {}
        return;
      }

      if (parsed.type === 'rd_input' && parsed.timestamp && parsed.timestamp > this.lastProcessedCmdTs) {
        this.lastProcessedCmdTs = parsed.timestamp;
        void this.executeIncomingRemoteCommand(parsed);
      }
    } catch {}
  }

  public startUserWatcher(
    _ticketId: string,
    _isAdmin: boolean,
    _userRemoteDesktopEnabled: boolean
  ): () => void {
    return () => {};
  }

  /**
   * 3. USER: "Onayla" butonuna bastığında ÖNCE P2P Offer SDP hazırlar,
   * Native Accessibility ekran akışı döngüsünü başlatır ve ardından WhiteDesk'i masaüstüne küçültür.
   */
  public async acceptOffer(): Promise<void> {
    if (!this.currentSession) return;
    const { roomName, ticketId } = this.currentSession;

    this.currentSession = {
      ...this.currentSession,
      status: 'active',
    };
    this.notify();

    diagnosticRecorder.recordAction(`Uzak Masaüstü Onaylandı (#${ticketId})`, {
      kapsam: 'Sistem Geneli',
    });

    try {
      const iceServers = await this.getIceServers();
      const pc: any = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
      } as any);
      this.pc = pc;

      const dc = pc.createDataChannel('rd_fast', { ordered: true });
      this.wireDataChannel(dc);

      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      } as any);
      await pc.setLocalDescription(offer);
      await this.waitForIceGathering(pc, 550);

      const firstFrame = await this.captureSystemScreenFrame();
      const finalOfferSdp = pc.localDescription?.sdp || offer.sdp;

      await apiClient.publishFastSignal(
        roomName,
        'callee',
        'answer',
        JSON.stringify({
          type: 'rd_p2p_offer',
          sdp: finalOfferSdp,
          firstFrame: firstFrame || undefined,
          timestamp: Date.now(),
        }),
        'rd_p2p_offer'
      );
    } catch (e) {
      console.warn('[RemoteDesktopService] User P2P init error:', e);
    }

    // Native Kotlin zamanlayıcısını başlat (Uygulama masaüstüne küçüldüğünde ASLA durmaz!)
    this.startNativeStreamLoop();
  }

  public async rejectOffer(): Promise<void> {
    if (!this.currentSession) return;
    const { roomName } = this.currentSession;
    await apiClient.publishFastSignal(roomName, 'callee', 'reject', '', 'rd_rejected');
    this.cleanupP2p();
    this.stopPolling();
    this.currentSession = null;
    this.notify();
  }

  /**
   * 4. ADMIN: Canlı ekran üzerinde dokunma (tap) veya sürükleme (swipe) gönderir (<5ms P2P)
   */
  public async sendRemoteTap(normX: number, normY: number): Promise<void> {
    if (!this.currentSession || this.currentSession.role !== 'admin') return;
    const clampedX = Math.max(0.01, Math.min(0.99, normX));
    const clampedY = Math.max(0.01, Math.min(0.99, normY));

    const cmd = {
      type: 'rd_input',
      action: 'tap',
      x: clampedX,
      y: clampedY,
      timestamp: Date.now(),
    };

    if (this.isP2pOpen && this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(cmd));
        return;
      } catch {}
    }

    await apiClient.publishFastSignal(
      this.currentSession.roomName,
      'caller',
      'offer',
      JSON.stringify(cmd),
      'rd_input'
    );
  }

  public async sendRemoteSwipe(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    durationMs: number = 220
  ): Promise<void> {
    if (!this.currentSession || this.currentSession.role !== 'admin') return;
    const sx = Math.max(0.01, Math.min(0.99, startX));
    const sy = Math.max(0.01, Math.min(0.99, startY));
    const ex = Math.max(0.01, Math.min(0.99, endX));
    const ey = Math.max(0.01, Math.min(0.99, endY));

    const cmd = {
      type: 'rd_input',
      action: 'swipe',
      x: sx,
      y: sy,
      endX: ex,
      endY: ey,
      durationMs,
      timestamp: Date.now(),
    };

    if (this.isP2pOpen && this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(cmd));
        return;
      } catch {}
    }

    await apiClient.publishFastSignal(
      this.currentSession.roomName,
      'caller',
      'offer',
      JSON.stringify(cmd),
      'rd_input'
    );
  }

  private async executeIncomingRemoteCommand(cmd: any): Promise<void> {
    if (Platform.OS !== 'android') return;
    const mod = NativeModules.WhiteDeskNotificationModule;
    if (!mod) return;

    try {
      if (cmd.action === 'tap' && typeof mod.injectRemoteTap === 'function') {
        await mod.injectRemoteTap(Number(cmd.x || 0.5), Number(cmd.y || 0.5));
      } else if (cmd.action === 'swipe' && typeof mod.injectRemoteSwipe === 'function') {
        await mod.injectRemoteSwipe(
          Number(cmd.x || 0.5),
          Number(cmd.y || 0.5),
          Number(cmd.endX || 0.5),
          Number(cmd.endY || 0.5),
          Number(cmd.durationMs || 220)
        );
      }
    } catch {}
  }

  public async endSession(publishHangup: boolean = true): Promise<void> {
    const sess = this.currentSession;
    if (publishHangup && this.isP2pOpen && this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'rd_hangup' }));
      } catch {}
    }
    this.cleanupP2p();
    this.stopPolling();
    this.currentSession = null;
    this.notify();

    if (sess && publishHangup) {
      const role = sess.role === 'admin' ? 'caller' : 'callee';
      await apiClient.publishFastSignal(sess.roomName, role, 'hangup', '', 'rd_ended');
      setTimeout(() => {
        void apiClient.deleteFastSignal(sess.roomName);
      }, 1500);

      // Admin vazgeçtiğinde kullanıcıya anlık tekil iptal sinyali & push gönder
      if (sess.role === 'admin' && sess.targetUserWhiteId) {
        try {
          const targetBlind = sess.targetUserWhiteId.startsWith('blind_')
            ? sess.targetUserWhiteId
            : WhiteDeskCrypto.generateBlindId(sess.targetUserWhiteId);
          const senderBlind = sess.callerWhiteId
            ? sess.callerWhiteId.startsWith('blind_')
              ? sess.callerWhiteId
              : WhiteDeskCrypto.generateBlindId(sess.callerWhiteId)
            : 'admin_rd';

          void apiClient.sendRelayMessage({
            ticket_id: sess.ticketId,
            recipient_blind_id: targetBlind,
            sender_blind_id: senderBlind,
            encrypted_payload: JSON.stringify({
              type: 'rd_cancel_signal',
              ticket_id: sess.ticketId,
              timestamp: Date.now(),
            }),
          });

          void apiClient.sendCancelCallPushNotification(
            sess.targetUserWhiteId,
            sess.callerWhiteId || '',
            sess.ticketId
          );
        } catch {}
      }
    }
  }

  /**
   * Karşı taraf vazgeçtiğinde gelen tekil iptal sinyaliyle kullanıcının açık onay modalını anında kapatır.
   */
  public dismissIncomingOffer(ticketId?: string): void {
    if (
      this.currentSession &&
      this.currentSession.role === 'user' &&
      this.currentSession.status === 'incoming_offer'
    ) {
      if (ticketId) {
        const cleanCurrent = (this.currentSession.ticketId || '').replace(/^#/, '').toLowerCase().trim();
        const cleanIncoming = ticketId.replace(/^#/, '').toLowerCase().trim();
        if (cleanCurrent !== cleanIncoming) {
          return;
        }
      }
      this.cleanupP2p();
      this.stopPolling();
      this.currentSession = null;
      this.notify();
    }
  }

  private cleanupP2p(): void {
    this.isP2pOpen = false;
    this.incomingFrameChunks.clear();
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.stopNativeStreamLoop();
    this.isUploadingFallbackFrame = false;
  }
}

export const remoteDesktopService = new RemoteDesktopService();
export default remoteDesktopService;
