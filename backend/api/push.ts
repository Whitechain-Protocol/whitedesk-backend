import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getDb } from './_lib/db.js';
import { sendFcmPush } from './_lib/fcm.js';
import trLocale from '../../src/locales/tr.json';

const SYSTEM_SALT = 'WhiteDesk_ZeroKnowledge_Salt_2026_Secure';

function tPush(key: string, params?: Record<string, string | number>): string {
  const cleanKey = key.startsWith('push_notifications.') ? key.slice('push_notifications.'.length) : key;
  const dict = ((trLocale as any)?.push_notifications || {}) as Record<string, string>;
  const template = dict[cleanKey] ?? key;
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v ?? '')),
    template
  );
}

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
        orgId,
        tenantId,
        targetMembers,
      } = req.body || {};

      // 1. Cihaz FCM Token Kaydı
      if (action === 'register') {
        if (!whiteId || !pushToken) {
          return res.status(400).json({ error: 'whiteId and pushToken required' });
        }
        const cleanWhiteId = whiteId.toLowerCase().trim();

        // Eğer ID zaten blind_ ise ana tabloya ayrı bir satır olarak basma (White ID'ye ait satırın blind_id kolonunda tutulur)
        if (cleanWhiteId.startsWith('blind_')) {
          await sql`
            UPDATE whitedesk_user_devices 
            SET push_token = ${pushToken}, updated_at = ${now}
            WHERE blind_id = ${cleanWhiteId}
          `;
          return res.status(200).json({ success: true, message: 'Blind device token updated' });
        }

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
        const cleanCaller = (callerWhiteId || '').toLowerCase().trim();
        const callerBlind = computeBlindId(cleanCaller);

        // Arayanın kendi cihaz tokenlarını tespit et (kendi kendine bildirim atılmasını engelle)
        let callerTokens: Set<string> = new Set();
        if (cleanCaller) {
          const cRows = await sql`
            SELECT push_token FROM whitedesk_user_devices
            WHERE white_id = ${cleanCaller} OR blind_id = ${cleanCaller}
               OR white_id = ${callerBlind} OR blind_id = ${callerBlind}
          `;
          cRows.forEach((r: any) => callerTokens.add(r.push_token));
        }

        let targetTokens: string[] = [];

        if (cleanTargetId && cleanTargetId !== cleanCaller && cleanTargetId !== callerBlind) {
          const directMatch = await sql`
            SELECT push_token FROM whitedesk_user_devices
            WHERE white_id = ${cleanTargetId} OR blind_id = ${cleanTargetId}
            LIMIT 1
          `;
          if (directMatch && directMatch.length > 0 && directMatch[0].push_token) {
            targetTokens.push(directMatch[0].push_token);
          }
        }

        // Bilet bazlı fallback: Eğer doğrudan eşleşme bulunamadıysa biletin taraflarından karşı tarafı çöz
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
              .filter((s: string) => s !== cleanCaller && s !== callerBlind);

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

        // Kendi kendine bildirim göndermeyi KESİN OLARAK filtrele
        targetTokens = targetTokens.filter(tok => !callerTokens.has(tok));

        if (targetTokens.length === 0) {
          return res.status(200).json({ success: false, reason: 'No remote recipient device found' });
        }

        const token = targetTokens[0];
        const pushCallType = callType || (type === 'direct_ptt' ? 'ptt' : type === 'remote_desktop_offer' ? 'remote_desktop' : 'call');
        const alias = callerAlias || tPush('push_notifications.default_operator_alias');

        const title = pushCallType === 'remote_desktop'
          ? tPush('push_notifications.remote_desktop_title')
          : pushCallType === 'ptt'
            ? tPush('push_notifications.ptt_title')
            : tPush('push_notifications.voice_call_title');

        const body = pushCallType === 'remote_desktop'
          ? tPush('push_notifications.remote_desktop_body', { alias })
          : pushCallType === 'ptt'
            ? tPush('push_notifications.ptt_body_connect', { alias })
            : tPush('push_notifications.voice_call_body_you', { alias });

        const sent = await sendFcmPush(token, {
          title,
          body,
          data: {
            type: pushCallType === 'remote_desktop' ? 'remote_desktop_offer' : pushCallType === 'ptt' ? 'direct_ptt' : 'incoming_call',
            ticketId: ticketId || '',
            callerAlias: alias,
            callerWhiteId: callerWhiteId || '',
            callType: pushCallType,
          },
        });

        return res.status(200).json({ success: sent });
      }

      // 2.1 Çağrı İptal Bildirimi (Arayan vazgeçtiğinde veya kırmızı butona bastığında arananın zili ve bildirimini derhal susturur)
      if (action === 'cancel_call' || action === 'cancel_call_push') {
        const cleanTargetId = (targetWhiteId || '').toLowerCase().trim();
        const targetBlind = computeBlindId(cleanTargetId);

        const rows = await sql`
          SELECT push_token FROM whitedesk_user_devices
          WHERE white_id = ${cleanTargetId} OR blind_id = ${cleanTargetId}
             OR white_id = ${targetBlind} OR blind_id = ${targetBlind}
        `;

        for (const r of rows) {
          if (r.push_token) {
            await sendFcmPush(r.push_token, {
              title: '',
              body: '',
              data: {
                type: 'cancel_call',
                ticketId: ticketId || '',
                callerWhiteId: callerWhiteId || '',
              },
            });
          }
        }
        return res.status(200).json({ success: true, cancelled: true });
      }

      // 3. Saha Grubu Telsiz Yayını (Kurumsal Broadcast PTT) - Kırılmaz Çift Katmanlı İzolasyon
      if (action === 'broadcast_org') {
        const cleanCaller = (callerWhiteId || '').toLowerCase().trim();
        const callerBlind = computeBlindId(cleanCaller);
        const cleanTenant = (tenantId || '').toLowerCase().trim();
        const isSpecificOrg = orgId && orgId !== 'all' && orgId !== '*' && orgId !== 'global';
        const cleanOrg = isSpecificOrg ? String(orgId).trim() : 'all';

        if (!cleanTenant || cleanTenant === 'default' || cleanTenant === 'all') {
          return res.status(400).json({ error: 'A specific valid tenantId is strictly required for tenant radio isolation' });
        }

        // Arayanın token'larını al ve kesinlikle hariç tut
        const callerRows = await sql`
          SELECT push_token FROM whitedesk_user_devices
          WHERE white_id = ${cleanCaller} OR blind_id = ${cleanCaller}
             OR white_id = ${callerBlind} OR blind_id = ${callerBlind}
        `;
        const callerTokens = new Set(callerRows.map((r: any) => r.push_token));

        // 1. KESİN FİRMA İZOLASYONU: Veritabanından YALNIZCA bu tenant'a ait admin ve kullanıcıları çek
        let tenantAdmins = await sql`
          SELECT white_id, blind_id, org_id FROM whitedesk_admins
          WHERE is_active = true AND LOWER(enterprise_blind_id) = ${cleanTenant}
        `;
        let tenantUsers = await sql`
          SELECT user_blind_id, org_id FROM whitedesk_user_bindings
          WHERE status IN ('approved', 'active') AND LOWER(tenant_blind_id) = ${cleanTenant}
        `;

        // 2. TENANT İÇİ BİRİM / GRUP İZOLASYONU: Eğer birim seçilmişse KESİNLİKLE sadece o birime ait üyeler kalır!
        if (isSpecificOrg) {
          tenantAdmins = tenantAdmins.filter((a: any) => a.org_id === cleanOrg);
          tenantUsers = tenantUsers.filter((u: any) => u.org_id === cleanOrg);
        }

        const legitimateCompanyMemberSet = new Set<string>();
        for (const a of tenantAdmins) {
          if (a.white_id) legitimateCompanyMemberSet.add(String(a.white_id).toLowerCase().trim());
          if (a.blind_id) legitimateCompanyMemberSet.add(String(a.blind_id).toLowerCase().trim());
        }
        for (const u of tenantUsers) {
          if (u.user_blind_id) legitimateCompanyMemberSet.add(String(u.user_blind_id).toLowerCase().trim());
        }

        // targetMembers gelmişse doğrulanmış şirket üyeleri ile KESİŞİMİNİ al (yabancı ID'ler silinir)
        let targetWhiteOrBlindIds: string[] = [];
        if (Array.isArray(targetMembers) && targetMembers.length > 0) {
          targetWhiteOrBlindIds = targetMembers
            .map((m: any) => String(m).toLowerCase().trim())
            .filter(id => id && legitimateCompanyMemberSet.has(id));
        } else {
          targetWhiteOrBlindIds = Array.from(legitimateCompanyMemberSet);
        }

        // Arayanı hedef listeden çıkar
        targetWhiteOrBlindIds = targetWhiteOrBlindIds.filter(
          id => id !== cleanCaller && id !== callerBlind
        );

        if (targetWhiteOrBlindIds.length === 0) {
          return res.status(200).json({ success: true, sentCount: 0, reason: 'No verified company members found' });
        }

        // YALNIZCA bu şirketin doğrulanmış hedef üyelerinin cihazlarını çek (Kırılmaz İzolasyon)
        const devices = await sql`
          SELECT DISTINCT push_token, white_id, blind_id FROM whitedesk_user_devices
          WHERE (white_id = ANY(${targetWhiteOrBlindIds}) OR blind_id = ANY(${targetWhiteOrBlindIds}))
            AND white_id != ${cleanCaller} AND blind_id != ${cleanCaller}
            AND white_id != ${callerBlind} AND blind_id != ${callerBlind}
        `;

        if (!devices || devices.length === 0) {
          return res.status(200).json({ success: true, sentCount: 0, reason: 'No registered company devices online' });
        }

        const alias = callerAlias || tPush('push_notifications.default_field_officer');
        const groupName = orgName || tPush('push_notifications.default_field_radio');

        let sentCount = 0;
        const sentTokens = new Set<string>();

        for (const dev of devices) {
          const token = dev.push_token;
          if (!token || callerTokens.has(token) || sentTokens.has(token)) {
            continue;
          }
          sentTokens.add(token);

          const sent = await sendFcmPush(token, {
            title: tPush('push_notifications.org_radio_title', { groupName }),
            body: tPush('push_notifications.org_radio_body', { alias }),
            data: {
              type: 'org_ptt',
              orgId: orgId || '',
              orgName: groupName,
              callerAlias: alias,
              callerWhiteId: cleanCaller,
              ticketId: ticketId || '',
              tenantId: cleanTenant,
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
