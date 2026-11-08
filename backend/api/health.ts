import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const sql = getDb();
    const result = await sql`SELECT NOW() as current_time, 1 as status`;
    return res.status(200).json({
      status: 'ok',
      service: 'whitedesk-backend',
      timestamp: new Date().toISOString(),
      database: 'connected',
      dbTime: result[0]?.current_time
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      service: 'whitedesk-backend',
      message: error.message || 'Database connection error'
    });
  }
}
