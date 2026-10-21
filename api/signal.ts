import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/db.js';

interface CachedSignalRecord {
  found: boolean;
  offerSdp?: string;
  answerSdp?: string;
  signalType?: string;
  targetMode?: string;
  callerCandidates: string[];
  calleeCandidates: string[];
  updatedAt: number;
  cachedAt: number;
}

// Warm-instance in-memory signal cache to avoid redundant Neon DB queries
const memorySignalCache = new Map<string, CachedSignalRecord>();
let lastCleanupAt = 0;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-white-id');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const roomName = (req.query.roomName as string) || req.body?.roomName;
  if (!roomName) {
    return res.status(400).json({ error: 'roomName parameter is required' });
  }

  const normalizedRoom = roomName.toLowerCase().trim();

  // Zero-DB instant response for health check pings
  if (normalizedRoom === 'net_ping') {
    return res.status(200).json({ found: false, ping: 'ok' });
  }

  const sql = getDb();
  const now = Date.now();

  try {
    // 1. DELETE: Görüşme bittiğinde odayı anında temizle
    if (req.method === 'DELETE') {
      memorySignalCache.delete(normalizedRoom);
      await sql`DELETE FROM whitedesk_ephemeral_signals WHERE room_name = ${normalizedRoom}`;
      return res.status(200).json({ success: true, message: 'Room cleared' });
    }

    // 2. GET: WebRTC sinyal durumunu çek (Önce RAM önbelleğine bak, gereksiz DELETE çalıştırma)
    if (req.method === 'GET') {
      const role = (req.query.role as string) || 'callee';
      const cached = memorySignalCache.get(normalizedRoom);

      // Negatif önbellek (boş oda) için 2 saniye boyunca DB'ye tekrar gitme
      if (cached && !cached.found && now - cached.cachedAt < 2000) {
        return res.status(200).json({ found: false });
      }

      const rows = await sql`
        SELECT * FROM whitedesk_ephemeral_signals 
        WHERE room_name = ${normalizedRoom}
        LIMIT 1
      `;

      if (!rows || rows.length === 0) {
        memorySignalCache.set(normalizedRoom, {
          found: false,
          callerCandidates: [],
          calleeCandidates: [],
          updatedAt: now,
          cachedAt: now,
        });
        return res.status(200).json({ found: false });
      }

      const record = rows[0];
      const callerCandidates = Array.isArray(record.caller_candidates) ? record.caller_candidates : [];
      const calleeCandidates = Array.isArray(record.callee_candidates) ? record.callee_candidates : [];

      memorySignalCache.set(normalizedRoom, {
        found: true,
        offerSdp: record.offer_sdp || undefined,
        answerSdp: record.answer_sdp || undefined,
        signalType: record.signal_type || undefined,
        targetMode: record.target_mode || undefined,
        callerCandidates,
        calleeCandidates,
        updatedAt: Number(record.updated_at),
        cachedAt: now,
      });

      const candidates = role === 'caller' ? calleeCandidates : callerCandidates;

      return res.status(200).json({
        found: true,
        offerSdp: record.offer_sdp || undefined,
        answerSdp: record.answer_sdp || undefined,
        signalType: record.signal_type || undefined,
        targetMode: record.target_mode || undefined,
        candidates,
        updatedAt: Number(record.updated_at),
      });
    }

    // 3. POST: WebRTC sinyali yayınla
    if (req.method === 'POST') {
      const { role, signalType, sdp, targetMode, candidate } = req.body || {};

      // Bayat sinyalleri yalnızca yeni bir 'offer' geldiğinde ve en fazla dakikada 1 kez temizle (await ile Fluid konteyner sızıntısını önle)
      if (signalType === 'offer' && now - lastCleanupAt > 60_000) {
        lastCleanupAt = now;
        try {
          await sql`DELETE FROM whitedesk_ephemeral_signals WHERE updated_at < ${now - 120_000}`;
        } catch {}
      }

      // 3.1 ICE Candidate ekleme (Trickle ICE)
      if (candidate) {
        const candidateStr = typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
        const candJsonArray = JSON.stringify([candidateStr]);
        if (role === 'caller') {
          await sql`
            INSERT INTO whitedesk_ephemeral_signals (room_name, caller_candidates, callee_candidates, updated_at)
            VALUES (${normalizedRoom}, ${candJsonArray}::jsonb, '[]'::jsonb, ${now})
            ON CONFLICT (room_name) DO UPDATE SET
              caller_candidates = COALESCE(whitedesk_ephemeral_signals.caller_candidates, '[]'::jsonb) || ${candJsonArray}::jsonb,
              updated_at = EXCLUDED.updated_at
          `;
        } else {
          await sql`
            INSERT INTO whitedesk_ephemeral_signals (room_name, caller_candidates, callee_candidates, updated_at)
            VALUES (${normalizedRoom}, '[]'::jsonb, ${candJsonArray}::jsonb, ${now})
            ON CONFLICT (room_name) DO UPDATE SET
              callee_candidates = COALESCE(whitedesk_ephemeral_signals.callee_candidates, '[]'::jsonb) || ${candJsonArray}::jsonb,
              updated_at = EXCLUDED.updated_at
          `;
        }
        memorySignalCache.delete(normalizedRoom);
        return res.status(200).json({ success: true, candidateAdded: true });
      }

      // 3.2 Offer yayınlama
      if (signalType === 'offer') {
        await sql`
          INSERT INTO whitedesk_ephemeral_signals (room_name, offer_sdp, signal_type, target_mode, caller_candidates, callee_candidates, answer_sdp, updated_at)
          VALUES (${normalizedRoom}, ${sdp || null}, 'offer', ${targetMode || null}, '[]'::jsonb, '[]'::jsonb, NULL, ${now})
          ON CONFLICT (room_name) DO UPDATE SET
            offer_sdp = EXCLUDED.offer_sdp,
            signal_type = 'offer',
            target_mode = COALESCE(EXCLUDED.target_mode, whitedesk_ephemeral_signals.target_mode),
            caller_candidates = '[]'::jsonb,
            callee_candidates = '[]'::jsonb,
            answer_sdp = NULL,
            updated_at = EXCLUDED.updated_at
        `;
        memorySignalCache.set(normalizedRoom, {
          found: true,
          offerSdp: sdp || undefined,
          signalType: 'offer',
          targetMode: targetMode || undefined,
          callerCandidates: [],
          calleeCandidates: [],
          updatedAt: now,
          cachedAt: now,
        });
        return res.status(200).json({ success: true, signalType: 'offer' });
      }

      // 3.3 Answer yanıtı
      if (signalType === 'answer' || signalType === 'answered') {
        await sql`
          UPDATE whitedesk_ephemeral_signals
          SET answer_sdp = ${sdp || null},
              signal_type = 'answer',
              target_mode = COALESCE(${targetMode || null}, target_mode),
              updated_at = ${now}
          WHERE room_name = ${normalizedRoom}
        `;
        memorySignalCache.delete(normalizedRoom);
        return res.status(200).json({ success: true, signalType: 'answer' });
      }

      // 3.4 Hangup / Reject
      if (signalType === 'hangup' || signalType === 'reject') {
        await sql`
          UPDATE whitedesk_ephemeral_signals
          SET signal_type = ${signalType},
              target_mode = COALESCE(${targetMode || null}, target_mode),
              answer_sdp = NULL,
              updated_at = ${now}
          WHERE room_name = ${normalizedRoom}
        `;
        memorySignalCache.delete(normalizedRoom);
        return res.status(200).json({ success: true, signalType });
      }

      // 3.5 Telsiz mod değişimi (speaker_start, speaker_stop, peer_join, peer_leave)
      if (signalType === 'mode-switch') {
        await sql`
          INSERT INTO whitedesk_ephemeral_signals (room_name, offer_sdp, signal_type, target_mode, caller_candidates, callee_candidates, answer_sdp, updated_at)
          VALUES (${normalizedRoom}, ${sdp || null}, 'mode-switch', ${targetMode || null}, '[]'::jsonb, '[]'::jsonb, NULL, ${now})
          ON CONFLICT (room_name) DO UPDATE SET
            offer_sdp = EXCLUDED.offer_sdp,
            signal_type = 'mode-switch',
            target_mode = EXCLUDED.target_mode,
            updated_at = EXCLUDED.updated_at
        `;
        memorySignalCache.delete(normalizedRoom);
        return res.status(200).json({ success: true, signalType: 'mode-switch' });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[SIGNAL ERROR]:', error);
    return res.status(500).json({ error: error.message || 'Signal processing error' });
  }
}
