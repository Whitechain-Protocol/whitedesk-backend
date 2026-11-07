import { Platform, NativeModules, DeviceEventEmitter } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import { apiClient } from './apiClient';
import { P2P_STUN_SERVERS } from './voice/types';
import { diagnosticRecorder } from './diagnosticRecorder';
import { WhiteDeskCrypto } from '../whitedesk-sdk';
import { InWhiteRingtone } from '../../modules/inwhite-ringtone';

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
  peerPlatform?: 'android' | 'ios';
  liveFrameUri?: string | null;
  remoteControlGranted?: boolean;
  targetUserWhiteId?: string;
  callerWhiteId?: string;
}

type SessionListener = (session: RemoteDesktopSession | null) => void;
type FrameListener = (frameUri: string) => void;

class RemoteDesktopService {
  private currentSession: RemoteDesktopSession | null = null;
  private listeners: Set<SessionListener> = new Set();
  private frameListeners: Set<FrameListener> = new Set();
  private lastRenderedSeq: number = 0;
  private lastRenderedFallbackTs: number = 0;
  private pollTimer: any = null;
  private userPollTimer: any = null;
  private nativeFrameSub: any = null;
  private lastProcessedCmdTs: number = 0;
  private isUploadingFallbackFrame: boolean = false;

  // P2P WebRTC DataChannel
  private pc: any = null;
  private dataChannel: any = null;
  private isP2pOpen: boolean = false;
  private handledOfferSdp: boolean = false;
  private handledAnswerSdp: boolean = false;
  private cachedOfferSdp: string | null = null;
  private frameSeq: number = 0;

  public subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSession);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onFrame(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    if (this.currentSession?.liveFrameUri) {
      listener(this.currentSession.liveFrameUri);
    }
    return () => {
      this.frameListeners.delete(listener);
    };
  }

  public notify(): void {
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
    return `whitedesk_rd_${String(ticketId || '').replace(/^#/, '').toLowerCase().trim()}`;
  }

  // Aynı davetin (reddedildikten sonra) tekrar tekrar modal açmasını engelleyen zaman damgası kilidi
  private lastHandledInviteTs: number = 0;

  /**
   * Fast-signal kaydından rd_invite davetini ayrıştırır.
   * Yalnızca aktif (signalType === 'offer') ve daha önce işlenmemiş davetleri döndürür.
   */
  private parseFreshInvite(sig: any): { ticketId?: string; adminAlias?: string; timestamp: number } | null {
    if (!sig || !sig.found || !sig.offerSdp) return null;
    if (sig.signalType && sig.signalType !== 'offer') return null;
    let data: any = null;
    try {
      data = JSON.parse(sig.offerSdp);
    } catch {
      return null;
    }
    if (!data || data.type !== 'rd_invite') return null;
    const ts = Number(data.timestamp) || 0;
    if (ts && ts <= this.lastHandledInviteTs) return null;
    if (ts && Date.now() - ts > 60_000) return null;
    return { ticketId: data.ticketId, adminAlias: data.adminAlias, timestamp: ts };
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

    // Native Kotlin Handler(Looper.getMainLooper()) her ~350ms'de ve pencere değişimlerinde
    // arka planda (Masaüstünde / diğer uygulamalarda) hiç donmadan bu olayı tetikler!
    this.nativeFrameSub = DeviceEventEmitter.addListener(
      'onNativeRemoteScreenFrame',
      (event: { frame?: string }) => {
        if (!this.currentSession || this.currentSession.status !== 'active') return;
        const frameUri = event?.frame;
        if (frameUri) {
          if (this.isP2pOpen) {
            this.sendFrameOverP2p(frameUri);
          } else if (!this.isUploadingFallbackFrame) {
            // P2P DataChannel el sıkışması tamamlanana kadar kareleri FastSignal üzerinden aktar.
            // KRİTİK: P2P Offer ve SDP bilgisini ASLA EZME! Admin P2P Offer'ı kaçırmasın diye
            // el sıkışma bitene kadar offer tipini ve sdp'yi taşımaya devam et!
            this.isUploadingFallbackFrame = true;
            const roomName = this.currentSession.roomName;
            const payload: any = {
              type: this.cachedOfferSdp ? 'rd_p2p_offer' : 'rd_live_frame',
              sdp: this.cachedOfferSdp || undefined,
              platform: Platform.OS,
              frame: frameUri,
              timestamp: Date.now(),
            };
            void apiClient
              .publishFastSignal(
                roomName,
                'callee',
                'answer',
                JSON.stringify(payload),
                payload.type
              )
              .finally(() => {
                this.isUploadingFallbackFrame = false;
              });
          }
        }
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
      this.stopPolling();
      try {
        InWhiteRingtone.stopRadioRingback();
      } catch {}
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

        if (msg.type === 'rd_frame') {
          this.stopPolling();
          if (msg.seq && msg.seq < this.lastRenderedSeq) return;
          this.lastRenderedSeq = msg.seq || 0;
          if (this.currentSession) {
            this.currentSession.liveFrameUri = msg.data;
          }
          for (const fl of this.frameListeners) {
            fl(msg.data);
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
      // Flow control / backpressure check: buffer doluysa kareyi atla (gecikmeyi ve donmayı sıfırlar)
      if (typeof this.dataChannel.bufferedAmount === 'number' && this.dataChannel.bufferedAmount > 64 * 1024) {
        return false;
      }
      const seq = ++this.frameSeq;
      this.dataChannel.send(
        JSON.stringify({
          type: 'rd_frame',
          seq,
          data: frameUri,
        })
      );
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
    const sTicketId = String(ticketId || '');
    if (!sTicketId) return;

    if (
      this.currentSession &&
      this.currentSession.status === 'active' &&
      this.currentSession.ticketId === sTicketId
    ) {
      this.notify();
      return;
    }

    this.cleanupP2p();
    this.stopPolling();
    const roomName = this.getRoomName(sTicketId);

    this.handledOfferSdp = false;
    this.handledAnswerSdp = false;

    // 1. Modalı ANINDA aç ve kullanıcıya hissettir (0ms gecikme)
    this.currentSession = {
      ticketId: sTicketId,
      roomName,
      role: 'admin',
      status: 'offering',
      peerAlias: adminAlias || 'Admin',
      liveFrameUri: null,
      targetUserWhiteId,
      callerWhiteId,
    };
    this.notify();

    // 2. Uzak masaüstünde arayan cihazda giden zil çalmaz (sessiz bağlantı)

    // 3. Eski sinyal temizliği KALDIRILDI: await edilmeyen DELETE, hemen ardından yazılan
    // rd_invite POST'undan sonra D1'e ulaşıp yeni daveti siliyordu (race condition).
    // publishFastSignal('offer') zaten offer_sdp'yi ezer, answer_sdp ve adayları sıfırlar.

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

    console.warn('[RemoteDesktop] Publishing rd_invite signal to room:', roomName, 'target:', targetUserWhiteId);
    await apiClient.publishFastSignal(roomName, 'caller', 'offer', invitePayload, 'rd_invite');

    if (targetUserWhiteId) {
      const cleanTarget = targetUserWhiteId.toLowerCase().trim();
      const userDirectRoom = `whitedesk_user_signal_${cleanTarget}`;
      void apiClient.publishFastSignal(userDirectRoom, 'caller', 'offer', invitePayload, 'rd_invite');

      try {
        const targetBlind = cleanTarget.startsWith('blind_')
          ? cleanTarget
          : WhiteDeskCrypto.generateBlindId(cleanTarget).toLowerCase().trim();
        if (targetBlind && targetBlind !== cleanTarget) {
          void apiClient.publishFastSignal(`whitedesk_user_signal_${targetBlind}`, 'caller', 'offer', invitePayload, 'rd_invite');
        }
      } catch {}
    }

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
      if (this.isP2pOpen) {
        this.stopPolling();
        return;
      }

      try {
        const sig = await apiClient.fetchFastSignal(roomName, 'caller');
        if (!sig || !sig.found) return;

        if (sig.signalType === 'reject') {
          try {
            InWhiteRingtone.stopRadioRingback();
          } catch {}
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
          try {
            InWhiteRingtone.stopRadioRingback();
          } catch {}
          void this.endSession(false);
          return;
        }

        if (sig.answerSdp) {
          let parsed: any = null;
          try {
            parsed = JSON.parse(sig.answerSdp);
          } catch {}

          if (parsed && (parsed.type === 'rd_p2p_offer' || parsed.type === 'rd_live_frame')) {
            try {
              InWhiteRingtone.stopRadioRingback();
            } catch {}
            if (this.currentSession && this.currentSession.status === 'offering') {
              this.currentSession = {
                ...this.currentSession,
                status: 'active',
                peerPlatform: parsed.platform || 'android',
                liveFrameUri: parsed.firstFrame || parsed.frame || this.currentSession.liveFrameUri,
              };
              const initFrame = parsed.firstFrame || parsed.frame;
              if (initFrame) {
                for (const fl of this.frameListeners) {
                  fl(initFrame);
                }
              }
              this.notify();
            } else if (parsed.frame && this.currentSession && !this.isP2pOpen) {
              const ts = Number(parsed.timestamp) || 0;
              if (!ts || ts > this.lastRenderedFallbackTs) {
                this.lastRenderedFallbackTs = ts;
                this.currentSession = {
                  ...this.currentSession,
                  liveFrameUri: parsed.frame,
                };
                for (const fl of this.frameListeners) {
                  fl(parsed.frame);
                }
                this.notify();
              }
            }

            if (parsed.type === 'rd_p2p_offer' && parsed.sdp && !this.handledOfferSdp) {
              this.handledOfferSdp = true;
              await this.acceptP2pOfferOnAdmin(roomName, parsed.sdp);
              return;
            }
          }
        }
      } catch {}
    }, 200);
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
      await this.waitForIceGathering(pc, 750);

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
      this.currentSession.status === 'incoming_offer'
    ) {
      // Zaten kullanıcıya bu bilet için onay penceresi açık durumda
      return;
    }

    // Önceki kapanmamış veya takılmış oturum varsa derhal temizle
    if (this.currentSession) {
      this.cleanupP2p();
      this.stopPolling();
    }

    const roomName = this.getRoomName(ticketId);

    if (!userRemoteDesktopEnabled) {
      await apiClient.publishFastSignal(roomName, 'callee', 'reject', '', 'rd_disabled_by_user');
      return;
    }

    const hasAccess = await this.isNativeAccessibilityEnabled();
    this.handledAnswerSdp = false;
    // Hangi kanaldan gelirse gelsin (push / relay / fast-signal) bu davet işlenmiş sayılır
    this.lastHandledInviteTs = Math.max(this.lastHandledInviteTs, Date.now());

    // Aranan kullanıcı cihazında SMS benzeri nezih bildirim akoru ("dınnn dınnnn dınnnn") çalar
    try {
      InWhiteRingtone.startNotificationChime();
    } catch {}

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

  private startUserPollTimer(): void {
    if (this.userPollTimer) {
      clearInterval(this.userPollTimer);
      this.userPollTimer = null;
    }
    this.userPollTimer = setInterval(() => {
      if (!this.currentSession || this.currentSession.status !== 'active') {
        if (this.userPollTimer) {
          clearInterval(this.userPollTimer);
          this.userPollTimer = null;
        }
        return;
      }
      if (this.isP2pOpen) return;
      void this.pollUserSignalOnce();
    }, 180);
  }

  public startUserWatcher(
    _ticketId: string,
    _isAdmin: boolean,
    _userRemoteDesktopEnabled: boolean
  ): () => void {
    // Sıfır-Polling Kuralı (KURAL 7): Boşta periyodik sorgulama yasaktır.
    // Uzak masaüstü davetleri FCM Push ve D1 Relay (rd_invite_signal) ile tetiklenir.
    return () => {};
  }

  /**
   * Bilet detay ekranından bağımsız GLOBAL davet dinleyicisi (Devre dışı - KURAL 7 Sıfır-Polling).
   */
  public startGlobalUserWatcher(
    _ownWhiteId: string,
    _userRemoteDesktopEnabled: boolean = true
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

    try {
      InWhiteRingtone.stopNotificationChime();
      InWhiteRingtone.stopRadioRingback();
      InWhiteRingtone.acquireVoipWakeLock();
    } catch {}

    const hasAccess = await this.isNativeAccessibilityEnabled();
    if (!hasAccess && Platform.OS === 'android') {
      this.openNativeAccessibilitySettings();
    }

    const firstFrame = await this.captureSystemScreenFrame();

    this.currentSession = {
      ...this.currentSession,
      status: 'active',
      remoteControlGranted: hasAccess,
      liveFrameUri: firstFrame || this.currentSession.liveFrameUri,
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
      await this.waitForIceGathering(pc, 750);

      const finalOfferSdp = pc.localDescription?.sdp || offer.sdp;
      this.cachedOfferSdp = finalOfferSdp;

      await apiClient.publishFastSignal(
        roomName,
        'callee',
        'answer',
        JSON.stringify({
          type: 'rd_p2p_offer',
          sdp: finalOfferSdp,
          platform: Platform.OS,
          firstFrame: firstFrame || undefined,
          timestamp: Date.now(),
        }),
        'rd_p2p_offer'
      );
    } catch (e) {
      console.warn('[RemoteDesktopService] User P2P init error:', e);
    }

    // Kullanıcı tarafında admin cevabını karşılamak için aktif polling döngüsü
    this.startUserPollTimer();

    // Native ekran yayını döngüsünü başlat
    setTimeout(() => {
      this.startNativeStreamLoop();
    }, 100);
  }

  public async rejectOffer(): Promise<void> {
    try {
      InWhiteRingtone.stopNotificationChime();
      InWhiteRingtone.stopRadioRingback();
    } catch {}
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

  public async sendRemoteLongPress(normX: number, normY: number): Promise<void> {
    if (!this.currentSession || this.currentSession.role !== 'admin') return;
    const cmd = {
      type: 'rd_input',
      action: 'long_press',
      x: normX,
      y: normY,
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

  public async sendRemoteText(text: string): Promise<void> {
    if (!this.currentSession || this.currentSession.role !== 'admin' || !text) return;
    const cmd = {
      type: 'rd_input',
      action: 'type_text',
      text,
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

  public async sendRemoteKey(key: string): Promise<void> {
    if (!this.currentSession || this.currentSession.role !== 'admin' || !key) return;
    const cmd = {
      type: 'rd_input',
      action: 'key',
      key,
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

  public async sendRemoteSystemKey(key: string): Promise<void> {
    if (!this.currentSession || this.currentSession.role !== 'admin') return;
    const cmd = {
      type: 'rd_input',
      action: 'system_key',
      key,
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
      } else if (cmd.action === 'long_press' && typeof mod.injectRemoteLongPress === 'function') {
        await mod.injectRemoteLongPress(Number(cmd.x || 0.5), Number(cmd.y || 0.5));
      } else if (cmd.action === 'swipe' && typeof mod.injectRemoteSwipe === 'function') {
        await mod.injectRemoteSwipe(
          Number(cmd.x || 0.5),
          Number(cmd.y || 0.5),
          Number(cmd.endX || 0.5),
          Number(cmd.endY || 0.5),
          Number(cmd.durationMs || 220)
        );
      } else if (
        (cmd.action === 'system_key' || cmd.action === 'key') &&
        cmd.key &&
        typeof mod.injectRemoteKey === 'function'
      ) {
        await mod.injectRemoteKey(String(cmd.key));
      } else if (cmd.action === 'type_text' && cmd.text && typeof mod.injectRemoteText === 'function') {
        await mod.injectRemoteText(String(cmd.text));
      }
    } catch {}
  }

  public async endSession(publishHangup: boolean = true): Promise<void> {
    try {
      InWhiteRingtone.stopNotificationChime();
      InWhiteRingtone.stopRadioRingback();
    } catch {}
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
    try {
      InWhiteRingtone.stopNotificationChime();
      InWhiteRingtone.stopRadioRingback();
    } catch {}
    if (
      this.currentSession &&
      this.currentSession.role === 'user'
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
    this.cachedOfferSdp = null;
    try {
      InWhiteRingtone.stopNotificationChime();
      InWhiteRingtone.stopRadioRingback();
      InWhiteRingtone.releaseVoipWakeLock();
    } catch {}
    this.stopNativeStreamLoop();
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
    if (this.userPollTimer) {
      clearInterval(this.userPollTimer);
      this.userPollTimer = null;
    }
    this.isUploadingFallbackFrame = false;
  }
}

export const remoteDesktopService = new RemoteDesktopService();
export default remoteDesktopService;
