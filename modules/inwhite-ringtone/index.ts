import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const nativeModule =
  Platform.OS === 'android' ? requireNativeModule('InWhiteRingtone') : null;

let webChimeInterval: any = null;
let webAudioCtx: any = null;

function playWebChimeOnce(): void {
  if (Platform.OS !== 'web') return;
  try {
    const AudioCtx =
      typeof window !== 'undefined' &&
      ((window as any).AudioContext || (window as any).webkitAudioContext);
    if (!AudioCtx) return;
    if (!webAudioCtx || webAudioCtx.state === 'closed') {
      webAudioCtx = new AudioCtx();
    }
    if (webAudioCtx.state === 'suspended') {
      void webAudioCtx.resume();
    }
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5: Dınnn-Dınnnn-Dınnnn
    notes.forEach((freq, idx) => {
      const osc = webAudioCtx.createOscillator();
      const gain = webAudioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const startTime = webAudioCtx.currentTime + idx * 0.18;
      const duration = 0.35;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(webAudioCtx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  } catch {}
}

export const InWhiteRingtone = {
  startNotificationChime(): void {
    if (Platform.OS === 'web') {
      if (webChimeInterval) return;
      playWebChimeOnce();
      webChimeInterval = setInterval(() => {
        playWebChimeOnce();
      }, 3500);
      return;
    }
    nativeModule?.startNotificationChime();
  },
  stopNotificationChime(): void {
    if (Platform.OS === 'web') {
      if (webChimeInterval) {
        clearInterval(webChimeInterval);
        webChimeInterval = null;
      }
      return;
    }
    nativeModule?.stopNotificationChime();
  },
  startRingtone(): void {
    nativeModule?.startRingtone();
  },
  stopRingtone(): void {
    nativeModule?.stopRingtone();
  },
  getRingbackPath(): string {
    return nativeModule?.getRingbackPath() ?? '';
  },
  async routeAudio(toSpeaker: boolean): Promise<boolean> {
    if (!nativeModule?.routeAudio) {
      nativeModule?.setSpeakerphoneOn(toSpeaker);
      return toSpeaker;
    }
    return await nativeModule.routeAudio(toSpeaker);
  },
  startRingback(): void {
    nativeModule?.startRingback();
  },
  stopRingback(): void {
    nativeModule?.stopRingback();
  },
  startRadioRingtone(): void {
    nativeModule?.startRadioRingtone();
  },
  stopRadioRingtone(): void {
    nativeModule?.stopRadioRingtone();
  },
  startRadioRingback(): void {
    nativeModule?.startRadioRingback();
  },
  stopRadioRingback(): void {
    nativeModule?.stopRadioRingback();
  },
  playRadioTone(type: 'open' | 'close'): void {
    nativeModule?.playRadioTone(type);
  },
  playTelecomTone(type: 'reject' | 'busy' | 'offline' | 'end'): void {
    nativeModule?.playTelecomTone(type);
  },
  openSamsungBatterySettings(): void {
    nativeModule?.openSamsungBatterySettings();
  },
  copyToClipboard(text: string): boolean {
    if (Platform.OS === 'web') {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(text);
          return true;
        }
      } catch (_) {}
      return false;
    }
    return nativeModule?.copyToClipboard(text) ?? false;
  },
  hideIncomingCallSplash(): void {
    nativeModule?.hideIncomingCallSplash();
  },
  setSpeakerphoneOn(enabled: boolean): void {
    nativeModule?.setSpeakerphoneOn(enabled);
  },
  setBluetoothScoOn(enabled: boolean): void {
    nativeModule?.setBluetoothScoOn(enabled);
  },
  isTablet(): boolean {
    return nativeModule?.isTablet() ?? false;
  },
  resetAudioMode(): void {
    nativeModule?.resetAudioMode();
  },
  getPendingWebRtcOffer(): string | null {
    return nativeModule?.getPendingWebRtcOffer() ?? null;
  },
  acquireVoipWakeLock(): boolean {
    return nativeModule?.acquireVoipWakeLock() ?? false;
  },
  releaseVoipWakeLock(): boolean {
    return nativeModule?.releaseVoipWakeLock() ?? false;
  },
  acquireProximityLock(): boolean {
    return nativeModule?.acquireProximityLock() ?? false;
  },
  releaseProximityLock(): boolean {
    return nativeModule?.releaseProximityLock() ?? false;
  },
};
