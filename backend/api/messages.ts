import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: Biletin mesajlarını getir
  if (req.method === 'GET') {
    try {
      const sql = getDb();
      const ticketId = req.query.ticket_id;
      if (!ticketId) {
        return res.status(400).json({ success: false, error: 'ticket_id is required' });
      }

      // Mesajları ve gönderen adminlerin rollerini getir (AdminBadge için sender_role dahil)
      const messages = await sql`
        SELECT 
          m.id,
          m.ticket_id,
          m.app_id,
          m.sender_alias,
          m.sender_blind_id,
          m.is_admin,
          m.message,
          m.attachment_data,
          m.attachment_name,
          m.attachment_type,
          m.created_at,
          a.role AS sender_role
        FROM whitedesk_ticket_messages m
        LEFT JOIN whitedesk_admins a 
          ON m.sender_white_id = a.white_id 
          AND a.is_active = true
        WHERE m.ticket_id = ${Number(ticketId)}
        ORDER BY m.created_at ASC
      `;

      return res.status(200).json({ success: true, messages });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST: Bilete yeni mesaj yaz
  if (req.method === 'POST') {
    try {
      const sql = getDb();
      const {
        ticketId,
        appId = 'inwhite',
        senderWhiteId,
        senderAlias,
        senderBlindId,
        isAdmin = false,
        message,
        attachmentData,
        attachmentName,
        attachmentType
      } = req.body;

      if (!ticketId || !message) {
        return res.status(400).json({ success: false, error: 'ticketId and message are required' });
      }

      const now = Date.now();
      const insertResult = await sql`
        INSERT INTO whitedesk_ticket_messages (
          ticket_id, app_id, sender_white_id, sender_alias, sender_blind_id,
          is_admin, message, attachment_data, attachment_name, attachment_type, created_at
        ) VALUES (
          ${Number(ticketId)}, ${appId}, ${senderWhiteId || null}, ${senderAlias || null},
          ${senderBlindId || 'anonymous'}, ${Boolean(isAdmin)}, ${message},
          ${attachmentData || null}, ${attachmentName || null}, ${attachmentType || null}, ${now}
        )
        RETURNING id
      `;

      // Biletin updated_at tarihini güncelle
      await sql`
        UPDATE whitedesk_tickets 
        SET updated_at = ${now}, status = CASE WHEN ${Boolean(isAdmin)} THEN 'answered' ELSE 'open' END
        WHERE id = ${Number(ticketId)}
      `;

      return res.status(201).json({ success: true, messageId: insertResult[0]?.id });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
