import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Ephemeral In-Memory Signal Store for Low-Latency (<20ms) WebRTC Signaling
 */
interface SignalRecord {
  roomName: string;
  offerSdp?: string;
  answerSdp?: string;
  signalType?: string;
  targetMode?: string;
  candidates: string[];
  callerCandidate?: string;
  calleeCandidate?: string;
  callerActive?: boolean;
  calleeActive?: boolean;
  updatedAt: number;
}

// In-memory store persistent across warm lambda invocations
const signalRooms = new Map<string, SignalRecord>();

// Periodic garbage collection for signals older than 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [room, record] of signalRooms.entries()) {
    if (now - record.updatedAt > 120_000) {
      signalRooms.delete(room);
    }
  }
}, 30_000);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-white-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const roomName = (req.query.roomName as string) || req.body?.roomName;
  if (!roomName) {
    return res.status(400).json({ error: 'roomName parameter is required' });
  }

  const normalizedRoom = roomName.toLowerCase().trim();

  // 1. DELETE: Room cleanup when call finishes
  if (req.method === 'DELETE') {
    signalRooms.delete(normalizedRoom);
    return res.status(200).json({ success: true, message: 'Room cleared' });
  }

  // 2. GET: Fast poll of WebRTC signal (Offer, Answer, Candidates)
  if (req.method === 'GET') {
    const role = (req.query.role as string) || 'callee';
    const record = signalRooms.get(normalizedRoom);

    if (!record) {
      return res.status(200).json({ found: false });
    }

    // Role perspective:
    // If 'caller' is polling: Caller wants to see Callee's Answer SDP, candidates or reject/hangup
    // If 'callee' is polling: Callee wants to see Caller's Offer SDP, candidates or hangup
    return res.status(200).json({
      found: true,
      offerSdp: record.offerSdp,
      answerSdp: record.answerSdp,
      signalType: record.signalType,
      targetMode: record.targetMode,
      candidates: record.candidates,
      updatedAt: record.updatedAt,
    });
  }

  // 3. POST: Publish fast WebRTC signal
  if (req.method === 'POST') {
    const { role, signalType, sdp, targetMode, candidate } = req.body || {};
    const now = Date.now();

    let record = signalRooms.get(normalizedRoom);
    if (!record) {
      record = {
        roomName: normalizedRoom,
        candidates: [],
        updatedAt: now,
      };
      signalRooms.set(normalizedRoom, record);
    }

    record.updatedAt = now;

    if (candidate) {
      record.candidates.push(candidate);
      return res.status(200).json({ success: true, candidateAdded: true });
    }

    if (signalType === 'offer') {
      record.offerSdp = sdp;
      record.signalType = 'offer';
      record.targetMode = targetMode || record.targetMode;
      record.candidates = []; // reset candidates for new offer
    } else if (signalType === 'answer' || signalType === 'answered') {
      record.answerSdp = sdp;
      record.signalType = 'answer';
      record.targetMode = targetMode || record.targetMode;
    } else if (signalType === 'hangup' || signalType === 'reject') {
      record.signalType = signalType;
      record.targetMode = targetMode || record.targetMode;
    } else if (signalType === 'mode-switch') {
      // Used for speaker_start, speaker_stop, peer_join, peer_leave
      record.offerSdp = sdp;
      record.targetMode = targetMode;
      record.signalType = 'mode-switch';
    }

    return res.status(200).json({ success: true, signalType: record.signalType });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
