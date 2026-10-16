import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getDb } from './_lib/db.js';
import { sendFcmPush } from './_lib/fcm.js';

const SYSTEM_SALT = 'WhiteDesk_ZeroKnowledge_Salt_2026_Secure';

function computeBlindId(id: string): string {
  if (!id) return '';
  if (id.startsWith('blind_')) return id.toLowerCase().trim();
  const hmac = crypto.createHmac('sha256', SYSTEM_SALT);
  hmac.update(id.trim().toLowerCase());
  return 'blind_' + hmac.digest('hex').slice(0, 32);
}

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
    if (req.method === 'POST') {
      const {
        action,
        whiteId,
        pushToken,
        platform,
        targetWhiteId,
        ticketId,
        callerAlias,
        callerWhiteId,
        callType,
        type,
        orgName,
        orgId
      } = req.body || {};

      // 1. Cihaz FCM Token Kaydı (Hem ham White ID hem de türetilen Blind ID kaydedilir)
      if (action === 'register') {
        if (!whiteId || !pushToken) {
          return res.status(400).json({ error: 'whiteId and pushToken required' });
        }
        const cleanWhiteId = whiteId.toLowerCase().trim();
        const blindId = computeBlindId(cleanWhiteId);

        await sql`
          INSERT INTO whitedesk_user_devices (white_id, blind_id, push_token, platform, updated_at)
          VALUES (${cleanWhiteId}, ${blindId}, ${pushToken}, ${platform || 'android'}, ${now})
          ON CONFLICT (white_id) DO UPDATE SET
            blind_id = EXCLUDED.blind_id,
            push_token = EXCLUDED.push_token,
            platform = EXCLUDED.platform,
            updated_at = EXCLUDED.updated_at
        `;

        return res.status(200).json({ success: true, message: 'Device token registered', blindId });
      }

      // 2. Çağrı / Bas-Konuş Push Bildirimi Gönder (1-e-1)
      if (action === 'send_call' || action === 'send_call_push') {
        if (!targetWhiteId && !ticketId) {
          return res.status(400).json({ error: 'targetWhiteId or ticketId required' });
        }

        const cleanTargetId = (targetWhiteId || '').toLowerCase().trim();
        let targetTokens: string[] = [];

        if (cleanTargetId) {
          const directMatch = await sql`
            SELECT push_token FROM whitedesk_user_devices
            WHERE white_id = ${cleanTargetId} OR blind_id = ${cleanTargetId}
            LIMIT 1
          `;
          if (directMatch && directMatch.length > 0 && directMatch[0].push_token) {
            targetTokens.push(directMatch[0].push_token);
          }
        }

        // Bilet bazlı fallback: Eğer doğrudan eşleşme bulunamadıysa biletin taraflarından cihaz token'ını çöz
        if (targetTokens.length === 0 && ticketId) {
          const tkt = await sql`
            SELECT user_white_id, user_blind_id, assigned_admin_blind_id
            FROM whitedesk_tickets
            WHERE id = ${ticketId}
            LIMIT 1
          `;

          if (tkt && tkt.length > 0) {
            const row = tkt[0];
            const candidateIds = [
              row.user_white_id,
              row.user_blind_id,
              row.assigned_admin_blind_id,
            ]
              .filter(Boolean)
              .map((s: any) => String(s).toLowerCase().trim())
              .filter((s: string) => s !== (callerWhiteId || '').toLowerCase().trim());

            for (const cId of candidateIds) {
              const matched = await sql`
                SELECT push_token FROM whitedesk_user_devices
                WHERE white_id = ${cId} OR blind_id = ${cId}
                LIMIT 1
              `;
              if (matched && matched.length > 0 && matched[0].push_token) {
                targetTokens.push(matched[0].push_token);
                break;
              }
            }
          }
        }

        if (targetTokens.length === 0) {
          return res.status(200).json({ success: false, reason: 'No registered device found for target' });
        }

        const token = targetTokens[0];
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

      // 3. Saha Grubu Telsiz Yayını (Kurumsal Broadcast PTT)
      if (action === 'broadcast_org') {
        const cleanCaller = (callerWhiteId || '').toLowerCase().trim();
        const devices = await sql`
          SELECT push_token, white_id FROM whitedesk_user_devices
          WHERE white_id != ${cleanCaller}
        `;

        if (!devices || devices.length === 0) {
          return res.status(200).json({ success: true, sentCount: 0, reason: 'No other devices registered' });
        }

        const alias = callerAlias || 'Saha Görevlisi';
        const groupName = orgName || 'Kurumsal Saha Telsizi';

        let sentCount = 0;
        for (const dev of devices) {
          if (!dev.push_token) continue;
          const sent = await sendFcmPush(dev.push_token, {
            title: `Telsiz Anonsu: ${groupName}`,
            body: `${alias} canlı telsiz yayını başlattı. Dinlemek için dokunun.`,
            data: {
              type: 'org_ptt',
              orgId: orgId || '',
              orgName: groupName,
              callerAlias: alias,
              callerWhiteId: cleanCaller,
              ticketId: ticketId || '',
              callType: 'ptt',
            },
          });
          if (sent) sentCount++;
        }

        return res.status(200).json({ success: true, sentCount, total: devices.length });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[PUSH ERROR]:', err);
    return res.status(500).json({ error: err.message || 'Push service error' });
  }
}
