/**
 * Cloudflare Worker Native Google FCM v1 Client
 * Powered by Edge Web Crypto (RS256 JWT) - Zero Node.js dependencies
 */

interface ServiceAccountConfig {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Resolves Service Account configuration from string or defaults.
 */
function resolveServiceAccount(rawEnv?: string): ServiceAccountConfig | null {
  if (!rawEnv) return null;
  const trimmed = rawEnv.trim();

  // If the secret is a full JSON string
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        project_id: parsed.project_id || 'whitedesk-23e02',
        client_email: parsed.client_email || 'firebase-adminsdk-fbsvc@whitedesk-23e02.iam.gserviceaccount.com',
        private_key: parsed.private_key,
      };
    } catch {
      return null;
    }
  }

  // If the secret is directly the PEM private key
  if (trimmed.includes('BEGIN PRIVATE KEY')) {
    return {
      project_id: 'whitedesk-23e02',
      client_email: 'firebase-adminsdk-fbsvc@whitedesk-23e02.iam.gserviceaccount.com',
      private_key: trimmed,
    };
  }

  return null;
}

/**
 * Converts a PEM RSA private key to a Web Crypto CryptoKey using RSASSA-PKCS1-v1_5.
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleanPem = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/[\r\n\s]/g, '');

  const binaryString = atob(cleanPem);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return await crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

/**
 * URL-safe Base64 encoder for JWT segments.
 */
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}

/**
 * Generates Google OAuth2 Access Token for Firebase Cloud Messaging HTTP v1.
 */
async function getGoogleAccessToken(sa: ServiceAccountConfig): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && tokenExpiresAt > now + 60) {
    return cachedAccessToken;
  }

  try {
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${headerB64}.${payloadB64}`;

    const key = await importPrivateKey(sa.private_key);
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      encoder.encode(signingInput)
    );

    const jwt = `${signingInput}.${bufferToBase64Url(signature)}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.warn('[FCM] OAuth2 token exchange failed:', err);
      return null;
    }

    const data = (await tokenRes.json()) as { access_token: string; expires_in: number };
    cachedAccessToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in || 3600);
    return cachedAccessToken;
  } catch (err) {
    console.warn('[FCM] Error generating access token:', err);
    return null;
  }
}

export interface FcmPayloadOptions {
  title?: string;
  body?: string;
  data?: Record<string, string>;
  priority?: 'high' | 'normal';
  ttl?: string;
  isCall?: boolean;
}

/**
 * Sends FCM push notification to target push tokens via Firebase HTTP v1.
 */
export async function sendFcmPushNotification(
  rawEnvServiceAccount: string | undefined,
  tokens: string[],
  options: FcmPayloadOptions
): Promise<{ success: boolean; sentCount: number; errors: string[] }> {
  const sa = resolveServiceAccount(rawEnvServiceAccount);
  if (!sa) {
    return { success: false, sentCount: 0, errors: ['Service account not configured'] };
  }

  const token = await getGoogleAccessToken(sa);
  if (!token) {
    return { success: false, sentCount: 0, errors: ['Could not obtain Google Access Token'] };
  }

  let sentCount = 0;
  const errors: string[] = [];

  for (const pushToken of tokens) {
    if (!pushToken || typeof pushToken !== 'string') continue;

    const message: any = {
      token: pushToken.trim(),
      data: options.data || {},
      android: {
        priority: options.priority || 'high',
        ttl: options.ttl || '60s',
      },
    };

    // Çağrı ve Telsiz (PTT) push bildirimlerinde üst düzey `notification` alanı OLMAMALIDIR!
    // Eğer `notification` eklenirse Android işletim sistemi arkaplanda bildirimi ele geçirip
    // WhiteDeskMessagingService'i uyandırmadan düz, butonsuz sistem bildirimi gösterir.
    // Data-only yapıldığında Android bildirimi WhiteDeskMessagingService'e teslim eder;
    // böylece "Cevapla/Katıl" ve "Reddet" butonlu CallStyle arama bildirimi eksiksiz çıkar!
    // Tüm bildirimler (Çağrı, Telsiz ve Destek Mesajları) data-only olarak WhiteDeskMessagingService'e iletilir:
    // - Çağrılar: CallStyle + inwhite_ringtone
    // - Telsiz: CallStyle + radio_incoming
    // - Destek Bilet/Mesajları: Standart Android Bildirimi + Android Native Varsayılan Bildirim Sesi + Anlık D1 Inbox Senkronizasyonu
    if (options.title) message.data.title = String(options.title);
    if (options.body) message.data.body = String(options.body);
    if (!options.isCall && !message.data.type) {
      message.data.type = 'helpdesk_message';
    }
    message.android.direct_boot_ok = true;

    try {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (res.ok) {
        sentCount++;
      } else {
        const errText = await res.text();
        errors.push(`Token ${pushToken.slice(0, 10)}... failed: ${errText}`);
      }
    } catch (e: any) {
      errors.push(e.message);
    }
  }

  return { success: sentCount > 0, sentCount, errors };
}
