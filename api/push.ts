import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/db.js';
import { sendFcmPush } from './_lib/fcm.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-white-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sql = getDb();
  const now = Date.now();

  try {
    // 1. Cihaz FCM Token Kaydı
    if (req.method === 'POST') {
      const { action, whiteId, pushToken, platform, targetWhiteId, ticketId, callerAlias, callerWhiteId, callType, type } = req.body || {};

      if (action === 'register') {
        if (!whiteId || !pushToken) {
          return res.status(400).json({ error: 'whiteId and pushToken required' });
        }
        const cleanWhiteId = whiteId.toLowerCase().trim();
        await sql`
          INSERT INTO whitedesk_user_devices (white_id, push_token, platform, updated_at)
          VALUES (${cleanWhiteId}, ${pushToken}, ${platform || 'android'}, ${now})
          ON CONFLICT (white_id) DO UPDATE SET
            push_token = EXCLUDED.push_token,
            platform = EXCLUDED.platform,
            updated_at = EXCLUDED.updated_at
        `;
        return res.status(200).json({ success: true, message: 'Device token registered' });
      }

      // 2. Çağrı / Bas-Konuş Push Bildirimi Gönder
      if (action === 'send_call' || action === 'send_call_push') {
        if (!targetWhiteId) {
          return res.status(400).json({ error: 'targetWhiteId required' });
        }

        const cleanTargetId = targetWhiteId.toLowerCase().trim();
        const devices = await sql`
          SELECT push_token FROM whitedesk_user_devices
          WHERE white_id = ${cleanTargetId}
          LIMIT 1
        `;

        if (!devices || devices.length === 0) {
          return res.status(200).json({ success: false, reason: 'No registered device found for user' });
        }

        const token = devices[0].push_token;
        const pushCallType = callType || (type === 'direct_ptt' ? 'ptt' : 'call');
        const alias = callerAlias || 'Operatör';

        const title = pushCallType === 'ptt'
          ? 'Gelen Bas-Konuş Çağrısı'
          : 'Gelen Sesli Görüşme';

        const body = pushCallType === 'ptt'
          ? `${alias} bas-konuş telsiz bağlantısı kurmak istiyor.`
          : `${alias} sizi arıyor...`;

        const sent = await sendFcmPush(token, {
          title,
          body,
          data: {
            type: pushCallType === 'ptt' ? 'direct_ptt' : 'incoming_call',
            ticketId: ticketId || '',
            callerAlias: alias,
            callerWhiteId: callerWhiteId || '',
            callType: pushCallType,
          },
        });

        return res.status(200).json({ success: sent });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[PUSH ERROR]:', err);
    return res.status(500).json({ error: err.message || 'Push service error' });
  }
}
