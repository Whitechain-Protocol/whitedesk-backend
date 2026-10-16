import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Base Anycast STUN servers (Fastest public candidate discovery)
  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  let provider = 'p2p_stun';

  // 1. Dynamic Cloudflare Calls TURN Key (if configured)
  const cfTurnKeyId = process.env.CLOUDFLARE_CALLS_TURN_KEY_ID;
  const cfTurnApiToken = process.env.CLOUDFLARE_CALLS_TURN_KEY_SECRET || process.env.CLOUDFLARE_API_TOKEN;

  if (cfTurnKeyId && cfTurnApiToken) {
    try {
      const cfRes = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${cfTurnKeyId}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfTurnApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 86400 }),
      });
      if (cfRes.ok) {
        const cfData: any = await cfRes.json();
        if (cfData?.iceServers) {
          const incoming = Array.isArray(cfData.iceServers) ? cfData.iceServers : [cfData.iceServers];
          for (const s of incoming) {
            if (s?.urls) iceServers.push(s);
          }
          provider = 'cloudflare_calls_turn';
          return res.status(200).json({ provider, iceServers });
        }
      }
    } catch (e) {
      console.warn('[TURN] Cloudflare Calls fetch failed:', e);
    }
  }

  // 2. Dynamic Metered TURN (if configured)
  const meteredApp = process.env.METERED_APP_NAME;
  const meteredKey = process.env.METERED_API_KEY;
  if (meteredApp && meteredKey) {
    try {
      const mRes = await fetch(`https://${meteredApp}.metered.live/api/v1/turn/credentials?apiKey=${meteredKey}`);
      if (mRes.ok) {
        const mData: any = await mRes.json();
        if (Array.isArray(mData)) {
          for (const s of mData) {
            if (s?.urls) iceServers.push(s);
          }
          provider = 'metered_turn';
          return res.status(200).json({ provider, iceServers });
        }
      }
    } catch (e) {
      console.warn('[TURN] Metered fetch failed:', e);
    }
  }

  // 3. Static/Custom TURN server environment variables (Coturn / Enterprise)
  const rawTurnUrls = process.env.TURN_URLS;
  if (rawTurnUrls) {
    const urls = rawTurnUrls.split(',').map((u) => u.trim()).filter(Boolean);
    if (urls.length > 0) {
      iceServers.push({
        urls,
        username: process.env.TURN_USERNAME || '',
        credential: process.env.TURN_CREDENTIAL || '',
      });
      provider = 'custom_turn_relay';
    }
  }

  return res.status(200).json({
    provider,
    iceServers,
  });
}
