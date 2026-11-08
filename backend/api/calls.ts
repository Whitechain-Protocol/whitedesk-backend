import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLOUDFLARE_CALLS_API_BASE = 'https://rtc.live.cloudflare.com/v1';

const APP_ID =
  process.env.CLOUDFLARE_CALLS_APP_ID ||
  'e81173f440f51e9dfd0bebc66362b7bf';

const APP_SECRET =
  process.env.CLOUDFLARE_CALLS_APP_SECRET ||
  'd0b678434102304cb306039a44f5a8ac2f3232b3a7f9a0bd26d9ac3c77b979dd';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-white-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { action, sessionId, sessionDescription, tracks } = req.body || {};

  if (!action) {
    return res.status(400).json({ error: 'Missing action parameter' });
  }

  if (!APP_ID || !APP_SECRET) {
    return res.status(500).json({ error: 'Cloudflare Calls credentials are not configured on server' });
  }

  try {
    // 1. NEW SESSION: Initializes WebRTC PeerConnection session on Cloudflare Calls SFU
    if (action === 'new-session') {
      if (!sessionDescription) {
        return res.status(400).json({ error: 'sessionDescription (Offer SDP) is required for new-session' });
      }

      const bodyPayload: any = { sessionDescription };
      if (tracks) bodyPayload.tracks = tracks;

      const cfRes = await fetch(`${CLOUDFLARE_CALLS_API_BASE}/apps/${APP_ID}/sessions/new`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${APP_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = await cfRes.json();
      return res.status(cfRes.status).json(data);
    }

    // 2. NEW TRACKS: Publishes local track (speaker) or requests remote track (listener)
    if (action === 'new-tracks') {
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required for new-tracks' });
      }

      const bodyPayload: any = {};
      if (sessionDescription) bodyPayload.sessionDescription = sessionDescription;
      if (tracks) bodyPayload.tracks = tracks;

      const cfRes = await fetch(`${CLOUDFLARE_CALLS_API_BASE}/apps/${APP_ID}/sessions/${sessionId}/tracks/new`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${APP_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = await cfRes.json();
      return res.status(cfRes.status).json(data);
    }

    // 3. RENEGOTIATE: Completes track pull answer SDP from listener
    if (action === 'renegotiate') {
      if (!sessionId || !sessionDescription) {
        return res.status(400).json({ error: 'sessionId and sessionDescription are required for renegotiate' });
      }

      const cfRes = await fetch(`${CLOUDFLARE_CALLS_API_BASE}/apps/${APP_ID}/sessions/${sessionId}/renegotiate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${APP_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionDescription }),
      });

      const data = await cfRes.json();
      return res.status(cfRes.status).json(data);
    }

    // 4. CLOSE TRACKS: Closes published track when user releases PTT
    if (action === 'close-tracks') {
      if (!sessionId || !tracks) {
        return res.status(400).json({ error: 'sessionId and tracks are required for close-tracks' });
      }

      const cfRes = await fetch(`${CLOUDFLARE_CALLS_API_BASE}/apps/${APP_ID}/sessions/${sessionId}/tracks/close`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${APP_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tracks }),
      });

      const data = await cfRes.json();
      return res.status(cfRes.status).json(data);
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    console.error('[Cloudflare Calls Handler Error]:', err);
    return res.status(500).json({ error: err.message || 'Internal server error processing Cloudflare Calls' });
  }
}
