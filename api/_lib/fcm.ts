import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from './db.js';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri: string;
}

let cachedServiceAccount: ServiceAccount | null = null;
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

async function getServiceAccount(): Promise<ServiceAccount | null> {
  if (cachedServiceAccount) return cachedServiceAccount;

  // 1. Vercel Ortam Değişkeni (Production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      cachedServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      return cachedServiceAccount;
    } catch (e) {
      console.error('[FCM] Error parsing FIREBASE_SERVICE_ACCOUNT env:', e);
    }
  }

  // 2. Neon Veritabanı (whitedesk_system_config)
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT value FROM whitedesk_system_config 
      WHERE key = 'firebase_service_account' 
      LIMIT 1
    `;
    if (rows && rows.length > 0 && rows[0].value) {
      cachedServiceAccount = rows[0].value as ServiceAccount;
      return cachedServiceAccount;
    }
  } catch (err) {
    console.warn('[FCM] Error loading service account from DB:', err);
  }

  // 3. Lokal dosya (Development fallback)
  try {
    const filePath = path.join(process.cwd(), 'firebase-service-account.json');
    if (fs.existsSync(filePath)) {
      cachedServiceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return cachedServiceAccount;
    }
  } catch {}

  try {
    const parentPath = path.join(process.cwd(), 'backend', 'firebase-service-account.json');
    if (fs.existsSync(parentPath)) {
      cachedServiceAccount = JSON.parse(fs.readFileSync(parentPath, 'utf8'));
      return cachedServiceAccount;
    }
  } catch {}

  return null;
}

function base64Url(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && now < tokenExpiresAt - 60) {
    return cachedAccessToken;
  }

  try {
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = base64Url(
      JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: sa.token_uri,
        exp: now + 3600,
        iat: now,
      })
    );

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${claim}`);
    const signature = sign
      .sign(sa.private_key, 'base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const jwt = `${header}.${claim}.${signature}`;

    const res = await fetch(sa.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    const data: any = await res.json();
    if (data.access_token) {
      cachedAccessToken = data.access_token;
      tokenExpiresAt = now + (data.expires_in || 3600);
      return cachedAccessToken;
    } else {
      console.error('[FCM] OAuth2 token error:', data);
      return null;
    }
  } catch (err) {
    console.error('[FCM] Error generating access token:', err);
    return null;
  }
}

export interface FcmPayload {
  title: string;
  body: string;
  data: Record<string, string>;
}

export async function sendFcmPush(token: string, payload: FcmPayload): Promise<boolean> {
  const sa = await getServiceAccount();
  if (!sa) {
    console.warn('[FCM] Service account credentials not found. Push skipped.');
    return false;
  }

  const accessToken = await getAccessToken(sa);
  if (!accessToken) {
    console.error('[FCM] Failed to acquire access token.');
    return false;
  }

  try {
    const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
    const message = {
      message: {
        token,
        android: {
          priority: 'HIGH',
        },
        data: {
          ...payload.data,
          title: payload.title,
          body: payload.body,
        },
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(message),
    });

    if (res.ok) {
      return true;
    } else {
      const errText = await res.text();
      console.warn('[FCM] Push send error response:', res.status, errText);
      return false;
    }
  } catch (error) {
    console.error('[FCM] Push send request failed:', error);
    return false;
  }
}
