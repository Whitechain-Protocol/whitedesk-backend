import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getDb();

  // GET: Biletleri listele (Role ve filtreye göre)
  if (req.method === 'GET') {
    try {
      const enterpriseBlindId = req.query.enterprise_blind_id as string | undefined;
      const role = (req.query.role as string) || 'user';
      const userBlindId = req.query.user_blind_id as string | undefined;

      let tickets;
      if (role === 'founder') {
        // TheWhite: Tüm kiracıların tartışmalarını ve root destek biletlerini görür
        tickets = await sql`
          SELECT * FROM whitedesk_tickets 
          WHERE is_discussion = true OR category IN ('root_support', 'internal_admin_ticket', 'thewhite_support')
          ORDER BY updated_at DESC, created_at DESC 
          LIMIT 100
        `;
      } else if (role === 'global_admin' || role === 'admin') {
        // Tenant Adminleri: Kendi kiracısının biletlerini görür
        tickets = await sql`
          SELECT * FROM whitedesk_tickets 
          WHERE enterprise_blind_id = ${enterpriseBlindId}
          ORDER BY updated_at DESC, created_at DESC 
          LIMIT 100
        `;
      } else {
        // Normal Kullanıcı: Sadece kendi açtığı biletleri görür
        tickets = await sql`
          SELECT * FROM whitedesk_tickets 
          WHERE enterprise_blind_id = ${enterpriseBlindId} AND user_blind_id = ${userBlindId}
          ORDER BY updated_at DESC, created_at DESC 
          LIMIT 50
        `;
      }

      return res.status(200).json({ success: true, tickets });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST: Yeni bilet / tartışma oluştur
  if (req.method === 'POST') {
    try {
      const {
        subject,
        message,
        appId = 'inwhite',
        category = 'general',
        isDiscussion = false,
        enterpriseBlindId,
        userBlindId,
        orgId = 'default',
        customFieldsJson
      } = req.body;

      if (!subject || !message) {
        return res.status(400).json({ success: false, error: 'Subject and message are required' });
      }

      const now = Date.now();
      const insertResult = await sql`
        INSERT INTO whitedesk_tickets (
          app_id, subject, message, status, priority, category,
          is_discussion, enterprise_blind_id, user_blind_id, org_id,
          custom_fields, created_at, updated_at
        ) VALUES (
          ${appId}, ${subject}, ${message}, 'open', 'normal', ${category},
          ${Boolean(isDiscussion)}, ${enterpriseBlindId || 'default'}, ${userBlindId || 'anonymous'}, ${orgId},
          ${customFieldsJson || null}, ${now}, ${now}
        )
        RETURNING id
      `;

      const ticketId = insertResult[0]?.id;

      // İlk mesajı da ekle
      if (ticketId) {
        await sql`
          INSERT INTO whitedesk_ticket_messages (
            ticket_id, app_id, sender_blind_id, is_admin, message, created_at
          ) VALUES (
            ${ticketId}, ${appId}, ${userBlindId || 'anonymous'}, false, ${message}, ${now}
          )
        `;
      }

      return res.status(201).json({ success: true, ticketId });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
