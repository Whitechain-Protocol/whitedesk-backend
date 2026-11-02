/**
 * WhiteDesk Sovereign Voice & PTT Service (Unified Facade)
 * Delegating to specialized modular sub-services under src/services/voice/:
 * - callService: 1-on-1 E2EE Voice Call Engine (Klasik 1-1 Sesli Görüşme)
 * - pttService: PTT Radio Facade (Bas-Konuş Telsiz Motoru)
 *   - pttP2pService: PTT_P2P (Bilet İçi 1-e-1 Bas-Konuş)
 *   - pttBroadcastService: PTT_broadcast (Kurumsal Saha / Birim Grubu Telsizi)
 * - signalingService: Native C++ WebRTC PeerConnection, Opus 48kHz SDP & FastSignal REST Relay
 */

export * from './voice';
import { voiceCallService } from './voice';

export { voiceCallService };
export default voiceCallService;
