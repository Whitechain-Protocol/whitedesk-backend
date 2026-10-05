import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/db.js';

/**
 * /api/claim
 * 12 kelimeyi unutan veya kod ile giriş yapanların tek giriş noktası.
 * Sistem girilen koda göre kullanıcının rolünü (founder, global_admin, admin, user) ve kiracısını otomatik tanır.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getDb();
    const { code, whiteId } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, error: 'Code or Hash is required' });
    }

    const cleanCode = String(code).trim();

    // 1. Durum: TheWhite Founder Hash kontrolü
    const founderHash = process.env.FOUNDER_CLAIM_HASH;
    if (founderHash && cleanCode === founderHash) {
      return res.status(200).json({
        success: true,
        role: 'founder',
        enterpriseBlindId: 'thewhite',
        alias: 'TheWhite',
        message: 'TheWhite Root Access Granted'
      });
    }

    // 2. Durum: whitedesk_admins tablosunda admin kaydı var mı?
    const adminRows = await sql`
      SELECT white_id, enterprise_blind_id, alias, role, is_active
      FROM whitedesk_admins
      WHERE (white_id = ${cleanCode} OR enterprise_blind_id = ${cleanCode}) AND is_active = true
      LIMIT 1
    `;

    if (adminRows.length > 0) {
      const admin = adminRows[0];
      return res.status(200).json({
        success: true,
        role: admin.role || 'admin',
        enterpriseBlindId: admin.enterprise_blind_id,
        alias: admin.alias,
        message: 'Admin session restored'
      });
    }

    // 3. Durum: Kiracı eşleşmesi (Tenant claim / User restore)
    const tenantRows = await sql`
      SELECT enterprise_blind_id, tenant_name
      FROM whitedesk_tenants
      WHERE enterprise_blind_id = ${cleanCode}
      LIMIT 1
    `;

    if (tenantRows.length > 0) {
      return res.status(200).json({
        success: true,
        role: 'user',
        enterpriseBlindId: tenantRows[0].enterprise_blind_id,
        tenantName: tenantRows[0].tenant_name,
        message: 'User session restored for tenant'
      });
    }

    return res.status(404).json({
      success: false,
      error: 'Code not recognized. Please ask your administrator for a valid hash.'
    });

  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
