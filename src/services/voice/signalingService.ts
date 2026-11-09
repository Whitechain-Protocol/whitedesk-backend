import { Platform, PermissionsAndroid } from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import { apiClient } from '../apiClient';
import { i18nService } from '../i18nService';
import { InWhiteRingtone } from '../../../modules/inwhite-ringtone';
import { P2P_STUN_SERVERS } from './types';

export function optimizeOpusSdp(sdp: string): string {
  if (!sdp) return sdp;
  const opusMatch = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000/i);
  if (!opusMatch) return sdp;

  const pt = opusMatch[1];
  const fmtpRegex = new RegExp(`^a=fmtp:${pt}\\s+(.*)$`, 'm');
  const fmtpMatch = sdp.match(fmtpRegex);

  const desiredParams: Record<string, string> = {
    usedtx: '0',
    useinbandfec: '1',
    stereo: '0',
    'sprop-stereo': '0',
    cbr: '1',
    maxaveragebitrate: '20000',
    maxplaybackrate: '16000',
    'sprop-maxcapturerate': '16000',
    ptime: '20',
  };

  if (fmtpMatch) {
    const existingParams = fmtpMatch[1];
    const paramMap: Record<string, string> = {};
    existingParams.split(';').forEach((p) => {
      const [k, v] = p.trim().split('=');
      const lowerKey = k ? k.toLowerCase() : '';
      if (lowerKey && lowerKey !== 'minptime' && lowerKey !== 'maxptime') {
        paramMap[lowerKey] = v || '';
      }
    });
    Object.assign(paramMap, desiredParams);
    const serialized = Object.entries(paramMap)
      .map(([k, v]) => (v ? `${k}=${v}` : k))
      .join(';');
    return sdp.replace(fmtpRegex, `a=fmtp:${pt} ${serialized}`);
  } else {
    const serialized = Object.entries(desiredParams)
      .map(([k, v]) => `${k}=${v}`)
      .join(';');
    const rtpmapRegex = new RegExp(`(a=rtpmap:${pt}\\s+opus\\/48000[^\\r\\n]*)`, 'i');
    return sdp.replace(rtpmapRegex, `$1\r\na=fmtp:${pt} ${serialized}`);
  }
}

export interface SignalingCallbacks {
  onRemoteTrackConnected?: () => void;
  onConnectionConnected?: () => void;
  onTurnFallbackNeeded?: () => void;
}

export class SignalingService {
  private pc: any = null;
  private localStream: any = null;
  private remoteStream: any = null;
  private pendingRemoteCandidates: any[] = [];
  private gatheredLocalCandidates: string[] = [];
  private seenRemoteCandidates: Set<string> = new Set();
  private candidateSendChain: Promise<any> = Promise.resolve();
  private remoteDescriptionSet = false;
  private remoteOfferSdp: string | null = null;
  private pendingRoomDeletions: Map<string, any> = new Map();

  private embedGatheredCandidatesIntoSdp(sdp: string): string {
    if (!sdp || this.gatheredLocalCandidates.length === 0) return sdp;
    let out = sdp;
    for (const rawCand of this.gatheredLocalCandidates) {
      const clean = (rawCand || '').trim();
      if (!clean) continue;
      const line = clean.startsWith('a=') ? clean : `a=${clean}`;
      if (!out.includes(line)) {
        out = out.endsWith('\r\n') ? `${out}${line}\r\n` : `${out}\r\n${line}\r\n`;
      }
    }
    return out;
  }

  cancelPendingDeletion(roomName: string): void {
    const timer = this.pendingRoomDeletions.get(roomName);
    if (timer) {
      clearTimeout(timer);
      this.pendingRoomDeletions.delete(roomName);
    }
  }

  schedulePendingDeletion(roomName: string, delayMs = 3500): void {
    this.cancelPendingDeletion(roomName);
    const timer = setTimeout(() => {
      this.pendingRoomDeletions.delete(roomName);
      void apiClient.deleteFastSignal(roomName);
    }, delayMs);
    this.pendingRoomDeletions.set(roomName, timer);
  }

  clearPendingDeletions(): void {
    for (const [, timer] of this.pendingRoomDeletions.entries()) {
      clearTimeout(timer);
    }
    this.pendingRoomDeletions.clear();
  }

  getRemoteOfferSdp(): string | null {
    return this.remoteOfferSdp;
  }

  setRemoteOfferSdp(sdp: string | null): void {
    this.remoteOfferSdp = sdp;
  }

  async ensureAudioPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const audioAlreadyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (audioAlreadyGranted) return true;
      const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
        title: i18nService.t('voice.signaling.mic_permission_title'),
        message: i18nService.t('voice.signaling.mic_permission_message'),
        buttonPositive: i18nService.t('voice.signaling.mic_permission_allow'),
      });
      return res === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }

  async setupPeerConnection(
    role: 'caller' | 'callee',
    roomName: string,
    initialMuted: boolean = false,
    callbacks?: SignalingCallbacks
  ): Promise<boolean> {
    const hasPerm = await this.ensureAudioPermission();
    if (!hasPerm) {
      console.warn('[VOICE/SIGNALING] Microphone permission not granted');
      return false;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }
    this.remoteDescriptionSet = false;
    this.pendingRemoteCandidates = [];
    this.gatheredLocalCandidates = [];
    this.seenRemoteCandidates.clear();

    try {
      const hasLiveTrack =
        this.localStream &&
        typeof this.localStream.getAudioTracks === 'function' &&
        this.localStream.getAudioTracks().some((t: any) => t && t.readyState !== 'ended');
      if (!hasLiveTrack) {
        const audioConstraints = {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          googEchoCancellation: true,
          googEchoCancellation2: true,
          googAutoGainControl: true,
          googAutoGainControl2: true,
          googNoiseSuppression: true,
          googNoiseSuppression2: true,
          googHighpassFilter: true,
        };
        this.localStream = await mediaDevices.getUserMedia({ audio: audioConstraints as any, video: false });
        console.warn('[VOICE/SIGNALING] Local microphone stream acquired successfully.');
      }
    } catch (e) {
      console.warn('[VOICE/SIGNALING] Failed to acquire user media microphone:', e);
      return false;
    }

    const iceServers: any[] = [...P2P_STUN_SERVERS];
    try {
      const turn = await apiClient.fetchTurnCredentials();
      if (turn?.iceServers) {
        const raw = Array.isArray(turn.iceServers) ? turn.iceServers : [turn.iceServers];
        for (const s of raw) {
          if (s?.urls) iceServers.push(s);
        }
        console.warn('[VOICE/SIGNALING] TURN relay credentials injected (' + iceServers.length + ' servers)');
      }
    } catch (e) {
      console.warn('[VOICE/SIGNALING] TURN fetch optional warning:', e);
    }

    this.pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 2,
    });

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = !initialMuted;
        this.pc.addTrack(track, this.localStream);
      });
    }

    this.pc.onicecandidate = (event: any) => {
      if (event?.candidate) {
        const candText = event.candidate?.candidate;
        if (typeof candText === 'string' && candText.trim().length > 0) {
          this.gatheredLocalCandidates.push(candText.trim());
        }
        const serialized = JSON.stringify(event.candidate);
        this.candidateSendChain = this.candidateSendChain
          .then(() =>
            apiClient.publishFastSignal(
              roomName,
              role,
              'ice-candidate',
              undefined,
              undefined,
              serialized
            )
          )
          .catch(() => {});
      }
    };

    this.pc.ontrack = (event: any) => {
      console.warn('[VOICE/SIGNALING] Remote track received:', event.track?.kind);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        console.warn('[VOICE/SIGNALING] Remote audio stream attached to playback!');
        void InWhiteRingtone.routeAudio(true);
        callbacks?.onRemoteTrackConnected?.();
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.warn('[VOICE/SIGNALING] PeerConnection connectionState:', state);
      if (state === 'connected') {
        void InWhiteRingtone.routeAudio(true);
        callbacks?.onConnectionConnected?.();
      } else if (state === 'disconnected' || state === 'failed') {
        console.warn('[VOICE/SIGNALING] Connection lost/disconnected');
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState;
      console.warn('[VOICE/SIGNALING] PeerConnection iceConnectionState:', state);
      if (state === 'connected' || state === 'completed') {
        void InWhiteRingtone.routeAudio(true);
        callbacks?.onConnectionConnected?.();
      } else if (state === 'failed') {
        console.warn('[VOICE/SIGNALING] Direct ICE connection failed, triggering TURN relay fallback...');
        callbacks?.onTurnFallbackNeeded?.();
      }
    };

    return true;
  }

  async waitForIceGathering(maxWaitMs = 800): Promise<void> {
    if (!this.pc) return;
    if (this.pc.iceGatheringState === 'complete') return;
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, maxWaitMs);
      const prevHandler = this.pc.onicegatheringstatechange;
      this.pc.onicegatheringstatechange = () => {
        if (prevHandler) prevHandler();
        if (this.pc?.iceGatheringState === 'complete') {
          clearTimeout(timer);
          resolve();
        }
      };
    });
  }

  async createOfferSdp(): Promise<string> {
    if (!this.pc) return '';
    try {
      const offer = await this.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      const optimizedOfferSdp = optimizeOpusSdp(offer.sdp);
      await this.pc.setLocalDescription(new RTCSessionDescription({ type: 'offer', sdp: optimizedOfferSdp }));
      await this.waitForIceGathering(1000);
      const baseSdp = this.pc.localDescription?.sdp || optimizedOfferSdp;
      return this.embedGatheredCandidatesIntoSdp(baseSdp);
    } catch (err) {
      console.warn('[VOICE/SIGNALING] Error creating WebRTC offer:', err);
      return '';
    }
  }

  async setRemoteAnswerSdp(answerSdp: string): Promise<boolean> {
    if (!this.pc || !answerSdp) return false;
    if (this.pc.signalingState === 'stable') {
      return true;
    }

    let sdpText = answerSdp;
    try {
      if (typeof sdpText === 'string' && sdpText.trim().startsWith('{')) {
        const parsed = JSON.parse(sdpText);
        if (parsed?.sdp) sdpText = parsed.sdp;
      }
    } catch {}

    if (!sdpText || typeof sdpText !== 'string' || !sdpText.includes('v=') || !sdpText.includes('m=')) {
      console.warn('[VOICE/SIGNALING] Ignored invalid/non-SDP answer:', sdpText ? sdpText.slice(0, 50) : null);
      return false;
    }

    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: sdpText,
      }));
      this.remoteDescriptionSet = true;
      this.flushRemoteCandidates();
      console.warn('[VOICE/SIGNALING] Successfully set remote answer SDP!');
      return true;
    } catch (e) {
      console.warn('[VOICE/SIGNALING] Error setting remote description:', e);
      return false;
    }
  }

  async createAnswerSdp(offerSdp: string): Promise<string> {
    if (!this.pc || !offerSdp) return '';

    let sdpText = offerSdp;
    try {
      if (typeof sdpText === 'string' && sdpText.trim().startsWith('{')) {
        const parsed = JSON.parse(sdpText);
        if (parsed?.sdp) sdpText = parsed.sdp;
      }
    } catch {}

    if (!sdpText || typeof sdpText !== 'string' || !sdpText.includes('v=') || !sdpText.includes('m=')) {
      console.warn('[VOICE/SIGNALING] Ignored invalid/non-SDP offer:', sdpText ? sdpText.slice(0, 50) : null);
      return '';
    }

    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: sdpText,
      }));
      this.remoteDescriptionSet = true;
      this.flushRemoteCandidates();

      const answer = await this.pc.createAnswer();
      const optimizedAnswerSdp = optimizeOpusSdp(answer.sdp);
      await this.pc.setLocalDescription(new RTCSessionDescription({ type: 'answer', sdp: optimizedAnswerSdp }));
      await this.waitForIceGathering(1000);
      const baseAnswerSdp = this.pc.localDescription?.sdp || optimizedAnswerSdp;
      return this.embedGatheredCandidatesIntoSdp(baseAnswerSdp);
    } catch (err) {
      console.warn('[VOICE/SIGNALING] Error creating answer SDP:', err);
      return '';
    }
  }

  queueRemoteCandidate(cand: any): void {
    if (!cand) return;
    const dedupKey = typeof cand === 'string' ? cand : (cand.candidate || JSON.stringify(cand));
    if (!dedupKey || this.seenRemoteCandidates.has(dedupKey)) return;
    this.seenRemoteCandidates.add(dedupKey);

    if (!this.remoteDescriptionSet || !this.pc) {
      this.pendingRemoteCandidates.push(cand);
    } else {
      try {
        void this.pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn('[VOICE/SIGNALING] addIceCandidate error:', e);
      }
    }
  }

  flushRemoteCandidates(): void {
    if (!this.pc || !this.remoteDescriptionSet) return;
    const candidates = [...this.pendingRemoteCandidates];
    this.pendingRemoteCandidates = [];
    for (const cand of candidates) {
      try {
        void this.pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn('[VOICE/SIGNALING] flush addIceCandidate error:', e);
      }
    }
  }

  async fetchOfferSdpForRoom(roomName: string): Promise<string | null> {
    try {
      const signal = await apiClient.fetchFastSignal(roomName, 'callee');
      if (signal && signal.found && signal.offerSdp) {
        let offerText = signal.offerSdp;
        try {
          const parsed = JSON.parse(signal.offerSdp);
          if (parsed && typeof parsed === 'object' && parsed.sdp) {
            offerText = parsed.sdp;
          }
        } catch {}
        this.remoteOfferSdp = offerText;
        if (signal.candidates && signal.candidates.length > 0) {
          for (const candStr of signal.candidates) {
            try {
              const candObj = JSON.parse(candStr);
              this.queueRemoteCandidate(candObj);
            } catch {}
          }
        }
        return offerText;
      }
    } catch (e) {
      console.warn('[VOICE/SIGNALING] fetchOfferSdpForRoom warning:', e);
    }
    return null;
  }

  setMute(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = !muted;
      });
    }
  }

  toggleSpeaker(isSpeaker: boolean): void {
    void InWhiteRingtone.routeAudio(isSpeaker);
    if (!InWhiteRingtone.isTablet()) {
      InWhiteRingtone.acquireProximityLock();
    }
  }

  cleanupMedia(): void {
    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach((track: any) => track.stop());
      } catch {}
      this.localStream = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }
    this.remoteStream = null;
    this.pendingRemoteCandidates = [];
    this.gatheredLocalCandidates = [];
    this.seenRemoteCandidates.clear();
    this.remoteDescriptionSet = false;
    this.remoteOfferSdp = null;
  }
}

export const signalingService = new SignalingService();
