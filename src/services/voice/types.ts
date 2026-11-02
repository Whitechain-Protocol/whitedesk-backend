export type VoiceCallState =
  | 'idle'
  | 'request_sent'
  | 'request_received'
  | 'request_accepted'
  | 'outgoing_ringing'
  | 'incoming_ringing'
  | 'connecting'
  | 'connected'
  | 'ended';

export type VoiceCallConnectionMode = 'p2p_direct' | 'cloudflare_turn_relay';

export type VoiceCallType = 'call' | 'ptt';

export type PttMode = 'PTT_P2P' | 'PTT_broadcast';

export interface VoiceCallSession {
  ticketId: string;
  roomName: string;
  callerWhiteId: string;
  callerAlias: string;
  calleeWhiteId: string;
  calleeAlias: string;
  state: VoiceCallState;
  connectionMode: VoiceCallConnectionMode;
  startTime?: number;
  durationSeconds: number;
  isMuted: boolean;
  isSpeaker: boolean;
  role: 'caller' | 'callee';
  failureReason?: string;
  requestTs?: number;
  callType?: VoiceCallType; // 'call' (normal sesli çağrı) veya 'ptt' (bas-konuş canlı telsiz)
  scope?: 'direct' | 'org_group'; // 1-e-1 bilet içi veya organizasyonel saha grubu telsizi
  pttMode?: PttMode; // 'PTT_P2P' (bilet içi 1-1 bas-konuş) veya 'PTT_broadcast' (kurumsal saha grubu telsizi)
  targetOrgId?: string;
  targetOrgName?: string;
  activeSpeakerAlias?: string;
  activeSpeakerWhiteId?: string;
  isStandby?: boolean;
  lastPeerEvent?: { text: string; ts: number; type?: 'join' | 'leave'; alias?: string };
  publisherCallsSessionId?: string;
  publisherTrackName?: string;
}

export type CallStateListener = (session: VoiceCallSession | null) => void;

export const P2P_STUN_SERVERS = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];
