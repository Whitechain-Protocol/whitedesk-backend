/**
 * WhiteDesk Sovereign Unified Edge Gateway (https://api.whitedesk.one)
 * Powered 100% by Cloudflare Workers, Durable Objects, D1 SQLite & R2 Object Storage
 *
 * Characteristics:
 * - Single Edge Origin: All REST, WebSocket, Push, Buharlaşma Havuzu, D1 Sovereign DB & Calls under one roof.
 * - Zero External DB Dependency: Neon PostgreSQL & separate admin_roster table completely decommissioned.
 * - Unified `whitedesk_admins` table handles both RBAC identity and fair load-balancing (counter, open_tickets, snooze_until, date_time).
 */

import { sendFcmPushNotification } from './fcm';

const WORKER_LOCALES: Record<string, Record<string, Record<string, string>>> = {
  tr: {
    push_notifications: {
      default_support_title: 'WhiteDesk Destek',
      default_operator_alias: 'Operatör',
      default_field_officer: 'Saha Görevlisi',
      default_corp_radio: 'Kurumsal Telsiz',
      default_field_radio: 'Kurumsal Saha Telsizi',
      default_user_alias: 'Kullanıcı',
      default_admin_alias: 'Yönetici',
      remote_desktop_title_with_alias: 'Uzak Masaüstü İsteği: {alias}',
      remote_desktop_title: 'Uzak Masaüstü İsteği',
      remote_desktop_body: '{alias} cihaz ekranınıza bağlanmak için onayınızı bekliyor.',
      ptt_title_with_alias: 'Bas-Konuş İsteği: {alias}',
      ptt_title: 'Gelen Bas-Konuş Çağrısı',
      ptt_body: '{alias} bas-konuş çağrısı başlattı.',
      ptt_body_connect: '{alias} bas-konuş telsiz bağlantısı kurmak istiyor.',
      voice_call_title_with_alias: 'Gelen Çağrı: {alias}',
      voice_call_title: 'Gelen Sesli Görüşme',
      voice_call_body: '{alias} arıyor...',
      voice_call_body_you: '{alias} sizi arıyor...',
      org_radio_title: 'Telsiz Anonsu: {groupName}',
      org_radio_body: '{alias} canlı telsiz yayını başlattı. Dinlemek için dokunun.',
      new_support_message_body: 'Yeni destek mesajınız var.',
      claim_root_granted: 'TheWhite Kök Erişimi Verildi',
      claim_admin_restored: 'Yönetici oturumu geri yüklendi',
      claim_user_restored: 'Kiracı için kullanıcı oturumu geri yüklendi',
      claim_code_not_recognized: 'Kod tanınmadı. Lütfen yöneticinizden geçerli bir hash isteyin.',
    },
    helpdesk: {
      admin_role_short: 'Admin',
    },
  },
  en: {
    push_notifications: {
      default_support_title: 'WhiteDesk Support',
      default_operator_alias: 'Operator',
      default_field_officer: 'Field Officer',
      default_corp_radio: 'Corporate Radio',
      default_field_radio: 'Corporate Field Radio',
      default_user_alias: 'User',
      default_admin_alias: 'Admin',
      remote_desktop_title_with_alias: 'Remote Desktop Request: {alias}',
      remote_desktop_title: 'Remote Desktop Request',
      remote_desktop_body: '{alias} is waiting for your approval to connect to your screen.',
      ptt_title_with_alias: 'Push-to-Talk Request: {alias}',
      ptt_title: 'Incoming Push-to-Talk Call',
      ptt_body: '{alias} started a push-to-talk call.',
      ptt_body_connect: '{alias} wants to establish a push-to-talk radio connection.',
      voice_call_title_with_alias: 'Incoming Call: {alias}',
      voice_call_title: 'Incoming Voice Call',
      voice_call_body: '{alias} is calling...',
      voice_call_body_you: '{alias} is calling you...',
      org_radio_title: 'Radio Broadcast: {groupName}',
      org_radio_body: '{alias} started a live radio broadcast. Tap to listen.',
      new_support_message_body: 'You have a new support message.',
      claim_root_granted: 'TheWhite Root Access Granted',
      claim_admin_restored: 'Admin session restored',
      claim_user_restored: 'User session restored for tenant',
      claim_code_not_recognized: 'Code not recognized. Please ask your administrator for a valid hash.',
    },
    helpdesk: {
      admin_role_short: 'Admin',
    },
  },
};

function workerI18n(key: string, params?: Record<string, string | number>, lang: string = 'tr'): string {
  const normalizedLang = lang && WORKER_LOCALES[lang] ? lang : 'tr';
  const [section, subKey] = key.split('.');
  const template =
    WORKER_LOCALES[normalizedLang]?.[section]?.[subKey] ??
    WORKER_LOCALES.tr?.[section]?.[subKey] ??
    key;
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v ?? '')),
    template
  );
}

export interface Env {
  AUTH_RELAY: DurableObjectNamespace;
  DB?: D1Database;
  BUCKET?: R2Bucket;
  FOUNDER_CLAIM_HASH?: string;
  CLOUDFLARE_CALLS_APP_ID?: string;
  CLOUDFLARE_CALLS_APP_SECRET?: string;
  FIREBASE_SERVICE_ACCOUNT?: string;
  CLOUDFLARE_CALLS_TURN_KEY_ID?: string;
  CLOUDFLARE_CALLS_TURN_KEY_SECRET?: string;
  METERED_APP_NAME?: string;
  METERED_API_KEY?: string;
}

export type AuthActionType = 'PROMOTE' | 'REVOKE';

export interface AuthActionPayload {
  action: AuthActionType;
  targetWhiteId: string;
  targetRole?: 'admin' | 'global_admin' | 'none';
  tenantBlindId: string;
  enterpriseName?: string;
  initiatorWhiteId: string;
  initiatorRole: 'founder' | 'global_admin' | 'admin';
  signature?: string;
  timestamp: number;
}

export interface ClientSessionInfo {
  whiteId: string;
  role: string;
  tenantBlindId: string;
  connectedAt: number;
}

/**
 * Transient Message Model for D1 Relay Havuzu
 */
export interface TransientMessageRecord {
  id: string;
  ticket_id: string;
  recipient_blind_id: string;
  sender_blind_id: string;
  encrypted_payload: string;
  attachment_r2_key?: string | null;
  created_at: number;
  expires_at: number;
}

/**
 * Durable Object: WhiteDeskAuthDO
 * Manages tenant-specific or global ephemeral signaling and real-time revocations.
 */
export class WhiteDeskAuthDO {
  private state: DurableObjectState;
  private sessions = new Map<WebSocket, ClientSessionInfo>();
  private pendingActions = new Map<string, Array<{ payload: AuthActionPayload; expiry: number }>>();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    setInterval(() => this.purgeExpiredActions(), 60_000);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 1. WebSocket Upgrade for Client Listening
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const whiteId = (url.searchParams.get('whiteId') || '').trim().toLowerCase();
      const tenantBlindId = (url.searchParams.get('tenant') || 'default').trim();
      const role = (url.searchParams.get('role') || 'user').trim();

      if (!whiteId) {
        return new Response('Missing whiteId parameter', { status: 400 });
      }

      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      if (typeof (this.state as any).acceptWebSocket === 'function') {
        (this.state as any).acceptWebSocket(server, [whiteId]);
      } else {
        server.accept();
      }

      const sessionInfo: ClientSessionInfo = {
        whiteId,
        role,
        tenantBlindId,
        connectedAt: Date.now(),
      };
      this.sessions.set(server, sessionInfo);

      server.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data?.type === 'PING') {
            server.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          }
        } catch {}
      });

      server.addEventListener('close', () => {
        this.sessions.delete(server);
      });

      server.addEventListener('error', () => {
        this.sessions.delete(server);
      });

      this.flushPendingForClient(server, whiteId);
      return new Response(null, { status: 101, webSocket: client });
    }

    // 2. Dispatch Action (PROMOTE / REVOKE)
    if (request.method === 'POST' && url.pathname === '/dispatch-action') {
      try {
        const payload = (await request.json()) as AuthActionPayload;
        if (!payload || !payload.action || !payload.targetWhiteId) {
          return new Response(JSON.stringify({ error: 'Invalid payload' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const targetId = payload.targetWhiteId.trim().toLowerCase();
        let deliveredOnline = false;

        for (const [ws, info] of this.sessions.entries()) {
          if (info.whiteId === targetId) {
            try {
              ws.send(JSON.stringify({ type: 'AUTH_ACTION', payload }));
              deliveredOnline = true;
            } catch {
              this.sessions.delete(ws);
            }
          }
        }

        if (!deliveredOnline) {
          const list = this.pendingActions.get(targetId) || [];
          list.push({ payload, expiry: Date.now() + 24 * 3600 * 1000 });
          this.pendingActions.set(targetId, list);
        }

        return new Response(
          JSON.stringify({ success: true, deliveredOnline, queuedInMemory: !deliveredOnline }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 3. Status Check
    if (url.pathname === '/status') {
      const whiteId = (url.searchParams.get('whiteId') || '').trim().toLowerCase();
      let isOnline = false;
      for (const [, info] of this.sessions.entries()) {
        if (info.whiteId === whiteId) {
          isOnline = true;
          break;
        }
      }
      const pendingCount = this.pendingActions.get(whiteId)?.length || 0;

      return new Response(
        JSON.stringify({
          whiteId,
          isOnline,
          pendingActionsCount: pendingCount,
          activeTotalConnections: this.sessions.size,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not Found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const str = typeof message === 'string' ? message : new TextDecoder().decode(message);
      const data = JSON.parse(str);
      if (data?.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
    } catch {}
  }

  async webSocketClose(ws: WebSocket) {
    this.sessions.delete(ws);
  }

  private flushPendingForClient(ws: WebSocket, whiteId: string) {
    const list = this.pendingActions.get(whiteId);
    if (!list || list.length === 0) return;

    for (const item of list) {
      if (item.expiry > Date.now()) {
        try {
          ws.send(JSON.stringify({ type: 'AUTH_ACTION', payload: item.payload }));
        } catch {
          return;
        }
      }
    }
    this.pendingActions.delete(whiteId);
  }

  private purgeExpiredActions() {
    const now = Date.now();
    for (const [id, list] of this.pendingActions.entries()) {
      const valid = list.filter((i) => i.expiry > now);
      if (valid.length === 0) {
        this.pendingActions.delete(id);
      } else {
        this.pendingActions.set(id, valid);
      }
    }
  }
}

/**
 * Ensures D1 core tables exist (Automatic Self-Healing Schema)
 */
let schemaVerifiedInIsolate = false;
async function ensureD1Schema(db: D1Database): Promise<void> {
  if (schemaVerifiedInIsolate) return;
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS transient_messages (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL,
        recipient_blind_id TEXT NOT NULL,
        sender_blind_id TEXT NOT NULL,
        encrypted_payload TEXT NOT NULL,
        attachment_r2_key TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS ephemeral_signals (
        room_name TEXT PRIMARY KEY,
        offer_sdp TEXT,
        answer_sdp TEXT,
        signal_type TEXT,
        target_mode TEXT,
        caller_candidates TEXT DEFAULT '[]',
        callee_candidates TEXT DEFAULT '[]',
        updated_at INTEGER NOT NULL
      )
    `).run();

    // Auto-clean whitedesk_tenant_licenses and redundant columns on whitedesk_enterprises
    try { await db.prepare(`DROP VIEW IF EXISTS whitedesk_tenant_licenses`).run(); } catch {}
    try { await db.prepare(`DROP TABLE IF EXISTS whitedesk_tenant_licenses`).run(); } catch {}
    try { await db.prepare(`ALTER TABLE whitedesk_enterprises DROP COLUMN grace_period_days`).run(); } catch {}
    try { await db.prepare(`ALTER TABLE whitedesk_enterprises DROP COLUMN warning_intervals`).run(); } catch {}
    try { await db.prepare(`ALTER TABLE whitedesk_enterprises DROP COLUMN grace_ends_at`).run(); } catch {}
    try { await db.prepare(`ALTER TABLE whitedesk_enterprises DROP COLUMN license_status`).run(); } catch {}
    try { await db.prepare(`ALTER TABLE whitedesk_enterprises DROP COLUMN trial_start_at`).run(); } catch {}
    try { await db.prepare(`ALTER TABLE whitedesk_enterprises DROP COLUMN trial_end_at`).run(); } catch {}
    try { await db.prepare(`ALTER TABLE whitedesk_enterprises DROP COLUMN license_hash`).run(); } catch {}
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS whitedesk_license_plans (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          tier_level INTEGER NOT NULL DEFAULT 0,
          monthly_price REAL DEFAULT 0,
          annual_price REAL DEFAULT 0,
          features TEXT DEFAULT '[]',
          grace_period TEXT DEFAULT '3',
          grace_period_warning_interval TEXT DEFAULT '12',
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `).run();
    } catch {}

    schemaVerifiedInIsolate = true;
  } catch {}
}

/**
 * Known boolean and JSON columns for transparent PostgreSQL <-> D1 row normalization
 */
const BOOLEAN_COLUMNS = new Set([
  'is_active',
  'is_founder_tenant',
  'used',
  'claimed',
  'is_custom_alias',
  'is_recommended',
  'has_remote_desktop',
  'has_audit_logs',
  'is_discussion',
  'is_admin',
]);

const JSON_COLUMNS = new Set([
  'categories',
  'target_categories',
  'custom_fields',
  'catalog',
  'advanced_features_config',
  'features',
  'prefs',
  'value',
]);

function normalizeD1Row(row: Record<string, any>): Record<string, any> {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (BOOLEAN_COLUMNS.has(k) && (v === 0 || v === 1)) {
      out[k] = v === 1;
    } else if (JSON_COLUMNS.has(k) && typeof v === 'string') {
      const trimmed = v.trim();
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try {
          out[k] = JSON.parse(trimmed);
        } catch {
          out[k] = v;
        }
      } else {
        out[k] = v;
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Translates PostgreSQL-flavored SQL into SQLite/D1 SQL and executes it on `env.DB`
 */
async function executeNormalizedD1Sql(db: D1Database, rawQuery: string): Promise<any[]> {
  const trimmed = (rawQuery || '').trim();
  if (!trimmed) return [];

  // Fast-path for legacy station initialization probe
  if (/to_regclass/i.test(trimmed)) {
    return [{ tbl: 'whitedesk_enterprises' }];
  }

  // Ignore legacy ALTER TABLE DROP/ADD COLUMN IF NOT EXISTS from old Postgres init
  if (/^ALTER\s+TABLE\s+/i.test(trimmed)) {
    return [];
  }

  let sql = trimmed
    // Remove Postgres type casts
    .replace(/::jsonb/gi, '')
    .replace(/::text/gi, '')
    .replace(/::varchar(\(\d+\))?/gi, '')
    .replace(/::bigint/gi, '')
    .replace(/::integer/gi, '')
    .replace(/::boolean/gi, '')
    // Replace ILIKE with LIKE
    .replace(/\bILIKE\b/gi, 'LIKE')
    // Replace NOW() with datetime('now')
    .replace(/\bNOW\s*\(\s*\)/gi, "datetime('now')")
    // Replace TO_TIMESTAMP(sec) with datetime(sec, 'unixepoch')
    .replace(/\bTO_TIMESTAMP\s*\(\s*([^)]+)\s*\)/gi, "datetime($1, 'unixepoch')")
    // Replace EXTRACT(EPOCH FROM created_at)*1000 with created_at
    .replace(/EXTRACT\s*\(\s*EPOCH\s+FROM\s+([a-zA-Z0-9_.]+)\s*\)\s*\*\s*1000/gi, '$1')
    // Replace SERIAL PRIMARY KEY
    .replace(/\bSERIAL\s+PRIMARY\s+KEY\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    // Replace CREATE OR REPLACE VIEW
    .replace(/\bCREATE\s+OR\s+REPLACE\s+VIEW\b/gi, 'CREATE VIEW IF NOT EXISTS');

  const isSelectOrReturning = /^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql) || /\bRETURNING\b/i.test(sql);

  if (isSelectOrReturning) {
    const { results } = await db.prepare(sql).all<Record<string, any>>();
    return (results || []).map(normalizeD1Row);
  } else {
    await db.prepare(sql).run();
    return [];
  }
}

/**
 * Compute Sovereign Blind ID using Edge Web Crypto HMAC-SHA256 (100% identical to WhiteDeskCrypto.generateBlindId)
 */
const SYSTEM_SALT = 'WhiteDesk_ZeroKnowledge_Salt_2026_Secure';
async function computeBlindId(id: string): Promise<string> {
  if (!id) return '';
  const trimmed = id.toLowerCase().trim();
  if (trimmed.startsWith('blind_') || trimmed.startsWith('ent_')) return trimmed;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SYSTEM_SALT),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(trimmed));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return 'blind_' + hex.slice(0, 32);
}

/**
 * Main Worker Entry Point
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Blind-ID, x-white-id',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // =========================================================================
    // 0. HEALTH CHECK & PING
    // =========================================================================
    if (url.pathname === '/api/health' || url.pathname === '/health' || url.pathname === '/ping') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'whitedesk-edge-gateway',
          domain: url.hostname,
          db_engine: 'cloudflare-d1-sqlite',
          edge_region: (request as any).cf?.colo || 'EDGE',
          timestamp: Date.now(),
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // =========================================================================
    // 0.5 SOVEREIGN D1 SQL GATEWAY (/api/d1/query & /api/sql)
    // =========================================================================
    if (request.method === 'POST' && (url.pathname === '/api/d1/query' || url.pathname === '/api/sql')) {
      try {
        if (!env.DB) {
          return new Response(JSON.stringify({ error: 'D1 database binding (DB) is unavailable' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        await ensureD1Schema(env.DB);
        const body = (await request.json()) as { query?: string };
        if (!body || typeof body.query !== 'string') {
          return new Response(JSON.stringify({ error: 'SQL query string is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const rows = await executeNormalizedD1Sql(env.DB, body.query);
        return new Response(JSON.stringify({ success: true, rows }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message, rows: [] }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // =========================================================================
    // 1. CLAIM API: SuperAdmin Root & Admin/Tenant Verification (D1 Native)
    // =========================================================================
    if (request.method === 'POST' && url.pathname === '/api/claim') {
      try {
        if (!env.DB) throw new Error('D1 DB binding unavailable');
        const body = (await request.json()) as { code?: string; whiteId?: string };
        if (!body.code) {
          return new Response(JSON.stringify({ success: false, error: 'Code or Hash required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const cleanCode = String(body.code).trim();
        const founderHash = env.FOUNDER_CLAIM_HASH || 'whitedesk_founder_root_key_2026';

        // 1. TheWhite Root Check
        if (cleanCode === founderHash) {
          return new Response(
            JSON.stringify({
              success: true,
              role: 'founder',
              enterpriseBlindId: 'thewhite',
              alias: 'TheWhite',
              message: workerI18n('push_notifications.claim_root_granted'),
            }),
            { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // 2. D1 Database Check (whitedesk_admins & whitedesk_enterprises)
        const adm = await env.DB.prepare(`
          SELECT white_id, enterprise_blind_id, alias, role, is_active
          FROM whitedesk_admins
          WHERE (white_id = ? OR blind_id = ? OR enterprise_blind_id = ?) AND is_active = 1
          LIMIT 1
        `).bind(cleanCode, cleanCode, cleanCode).first<any>();

        if (adm) {
          return new Response(
            JSON.stringify({
              success: true,
              role: adm.role || 'admin',
              enterpriseBlindId: adm.enterprise_blind_id,
              alias: adm.alias,
              message: workerI18n('push_notifications.claim_admin_restored'),
            }),
            { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        const tenant = await env.DB.prepare(`
          SELECT enterprise_blind_id, name
          FROM whitedesk_enterprises
          WHERE enterprise_blind_id = ?
          LIMIT 1
        `).bind(cleanCode).first<any>();

        if (tenant) {
          return new Response(
            JSON.stringify({
              success: true,
              role: 'user',
              enterpriseBlindId: tenant.enterprise_blind_id,
              tenantName: tenant.name,
              message: workerI18n('push_notifications.claim_user_restored'),
            }),
            { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: workerI18n('push_notifications.claim_code_not_recognized'),
          }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // =========================================================================
    // 2. CLOUDFLARE CALLS SFU WEBRTC SESSIONS (/api/calls)
    // =========================================================================
    if (request.method === 'POST' && url.pathname === '/api/calls') {
      try {
        const appId = env.CLOUDFLARE_CALLS_APP_ID || 'e81173f440f51e9dfd0bebc66362b7bf';
        const appSecret = env.CLOUDFLARE_CALLS_APP_SECRET || 'd0b678434102304cb306039a44f5a8ac2f3232b3a7f9a0bd26d9ac3c77b979dd';
        const apiBase = 'https://rtc.live.cloudflare.com/v1';

        const body = (await request.json()) as any;
        const { action, sessionId, sessionDescription, tracks } = body || {};

        if (action === 'new-session') {
          const payload: any = { sessionDescription };
          if (tracks) payload.tracks = tracks;

          const cfRes = await fetch(`${apiBase}/apps/${appId}/sessions/new`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${appSecret}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const cfData = await cfRes.json();
          return new Response(JSON.stringify(cfData), {
            status: cfRes.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (action === 'new-track' || action === 'new-tracks') {
          const cfRes = await fetch(`${apiBase}/apps/${appId}/sessions/${sessionId}/tracks/new`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${appSecret}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionDescription, tracks }),
          });
          const cfData = await cfRes.json();
          return new Response(JSON.stringify(cfData), {
            status: cfRes.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (action === 'renegotiate') {
          const cfRes = await fetch(`${apiBase}/apps/${appId}/sessions/${sessionId}/renegotiate`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${appSecret}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionDescription }),
          });
          const cfData = await cfRes.json();
          return new Response(JSON.stringify(cfData), {
            status: cfRes.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (action === 'close-track' || action === 'close-tracks') {
          const cfRes = await fetch(`${apiBase}/apps/${appId}/sessions/${sessionId}/tracks/close`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${appSecret}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ tracks }),
          });
          const cfData = await cfRes.json();
          return new Response(JSON.stringify(cfData), {
            status: cfRes.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // =========================================================================
    // 3. TURN CREDENTIALS API (/api/get-turn-credentials)
    // =========================================================================
    if (url.pathname === '/api/get-turn-credentials') {
      const iceServers: any[] = [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ];

      const cfTurnKey = env.CLOUDFLARE_CALLS_TURN_KEY_ID;
      const cfTurnSecret = env.CLOUDFLARE_CALLS_TURN_KEY_SECRET;

      if (cfTurnKey && cfTurnSecret) {
        try {
          const cfRes = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${cfTurnKey}/credentials/generate-ice-servers`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${cfTurnSecret}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ttl: 86400 }),
          });
          if (cfRes.ok) {
            const data: any = await cfRes.json();
            if (data?.iceServers) {
              const incoming = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
              iceServers.push(...incoming);
              return new Response(JSON.stringify({ provider: 'cloudflare_calls_turn', iceServers }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              });
            }
          }
        } catch {}
      }

      return new Response(JSON.stringify({ provider: 'p2p_stun', iceServers }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // =========================================================================
    // 4. PUSH NOTIFICATIONS & DEVICE REGISTRATION (D1 Native)
    // =========================================================================
    if (url.pathname === '/api/register-push' || url.pathname === '/api/push' || url.pathname === '/api/push-notify') {
      try {
        if (!env.DB) throw new Error('D1 DB binding unavailable');
        await ensureD1Schema(env.DB);

        const body = (await request.json()) as any;
        const action = body?.action;
        const now = Date.now();

        // 4.1 Cihaz Token Kaydı (action: 'register' or /api/register-push) — %100 Blind ID
        if (action === 'register' || url.pathname === '/api/register-push') {
          const whiteId = body?.whiteId;
          const pushToken = body?.pushToken;
          const platform = body?.platform || 'android';

          if (!whiteId || !pushToken) {
            return new Response(JSON.stringify({ error: 'whiteId and pushToken required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          const blindId = await computeBlindId(String(whiteId));
          await env.DB.prepare('DELETE FROM whitedesk_user_devices WHERE push_token = ? AND white_id != ?')
            .bind(pushToken, blindId)
            .run();

          await env.DB.prepare(`
            INSERT INTO whitedesk_user_devices (white_id, blind_id, fcm_token, push_token, platform, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (white_id) DO UPDATE SET
              blind_id = EXCLUDED.blind_id,
              fcm_token = EXCLUDED.fcm_token,
              push_token = EXCLUDED.push_token,
              platform = EXCLUDED.platform,
              updated_at = EXCLUDED.updated_at
          `).bind(blindId, blindId, pushToken, pushToken, platform, now).run();

          return new Response(JSON.stringify({ success: true, message: 'Blind device token registered', blindId }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // 4.2 1-e-1 Sesli Çağrı / Bas-Konuş Push Bildirimi (action: 'send_call' / 'send_call_push')
        if (action === 'send_call' || action === 'send_call_push') {
          const { targetWhiteId, ticketId, callerWhiteId, callerAlias, callType = 'audio', type: bodyType, tenantId } = body;
          const cleanTarget = (targetWhiteId || '').toLowerCase().trim();
          const cleanCaller = (callerWhiteId || '').toLowerCase().trim();
          const callerBlind = await computeBlindId(cleanCaller);
          const targetBlind = await computeBlindId(cleanTarget);

          const { results: callerRows } = await env.DB.prepare(`
            SELECT COALESCE(push_token, fcm_token) as push_token FROM whitedesk_user_devices
            WHERE LOWER(white_id) IN (?, ?) OR LOWER(blind_id) IN (?, ?)
          `).bind(cleanCaller, callerBlind, cleanCaller, callerBlind).all<any>();
          const callerTokens = new Set((callerRows || []).map((r: any) => r.push_token).filter(Boolean));

          const { results: targetRowsRaw } = await env.DB.prepare(`
            SELECT COALESCE(push_token, fcm_token) as push_token FROM whitedesk_user_devices
            WHERE LOWER(white_id) IN (?, ?) OR LOWER(blind_id) IN (?, ?)
          `).bind(cleanTarget, targetBlind, cleanTarget, targetBlind).all<any>();

          let targetTokens = (targetRowsRaw || []).map((r: any) => r.push_token).filter((t: string) => t && !callerTokens.has(t));

          // Aktif Saha/Operatör Fallback (D1 whitedesk_admins + whitedesk_user_devices)
          if (targetTokens.length === 0) {
            try {
              const { results: onlineAdmins } = await env.DB.prepare(`
                SELECT COALESCE(d.push_token, d.fcm_token) as push_token, d.white_id, d.blind_id
                FROM whitedesk_user_devices d
                JOIN whitedesk_admins a ON (LOWER(d.white_id) = LOWER(a.white_id) OR LOWER(d.blind_id) = LOWER(a.white_id) OR LOWER(d.blind_id) = LOWER(a.blind_id) OR LOWER(d.white_id) = LOWER(a.blind_id))
                WHERE a.is_active = 1
                  AND LOWER(d.white_id) NOT IN (?, ?) AND LOWER(COALESCE(d.blind_id, '')) NOT IN (?, ?)
                ORDER BY d.updated_at DESC
                LIMIT 2
              `).bind(cleanCaller, callerBlind, cleanCaller, callerBlind).all<any>();

              for (const adm of onlineAdmins || []) {
                if (adm.push_token && !callerTokens.has(adm.push_token) && !targetTokens.includes(adm.push_token)) {
                  targetTokens.push(adm.push_token);
                }
              }

              if (targetTokens.length === 0) {
                const { results: recentDevices } = await env.DB.prepare(`
                  SELECT COALESCE(push_token, fcm_token) as push_token FROM whitedesk_user_devices
                  WHERE COALESCE(push_token, fcm_token) IS NOT NULL
                    AND LOWER(white_id) NOT IN (?, ?) AND LOWER(COALESCE(blind_id, '')) NOT IN (?, ?)
                  ORDER BY updated_at DESC
                  LIMIT 2
                `).bind(cleanCaller, callerBlind, cleanCaller, callerBlind).all<any>();
                for (const dev of recentDevices || []) {
                  if (dev.push_token && !callerTokens.has(dev.push_token) && !targetTokens.includes(dev.push_token)) {
                    targetTokens.push(dev.push_token);
                  }
                }
              }
            } catch (adminErr) {
              console.warn('[PUSH] Error finding online admin fallback:', adminErr);
            }
          }

          if (targetTokens.length === 0) {
            return new Response(JSON.stringify({ success: true, sentCount: 0, message: 'No registered target token' }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          const isRemoteDesktop = callType === 'remote_desktop' || bodyType === 'remote_desktop_offer';
          const isPtt = !isRemoteDesktop && (callType === 'ptt' || bodyType === 'direct_ptt');
          const alias = callerAlias || workerI18n('push_notifications.default_support_title');
          const resolvedType = bodyType || (isRemoteDesktop ? 'remote_desktop_offer' : (isPtt ? 'direct_ptt' : 'incoming_call'));
          const resolvedCallType = isRemoteDesktop ? 'remote_desktop' : (isPtt ? 'ptt' : 'call');

          const pushTitle = isRemoteDesktop
            ? workerI18n('push_notifications.remote_desktop_title_with_alias', { alias })
            : (isPtt
                ? workerI18n('push_notifications.ptt_title_with_alias', { alias })
                : workerI18n('push_notifications.voice_call_title_with_alias', { alias }));
          const pushBody = isRemoteDesktop
            ? workerI18n('push_notifications.remote_desktop_body', { alias })
            : (isPtt
                ? workerI18n('push_notifications.ptt_body', { alias })
                : workerI18n('push_notifications.voice_call_body', { alias }));

          const result = await sendFcmPushNotification(env.FIREBASE_SERVICE_ACCOUNT, targetTokens, {
            title: pushTitle,
            body: pushBody,
            priority: 'high',
            ttl: '30s',
            isCall: true,
            data: {
              type: resolvedType,
              ticketId: ticketId ? String(ticketId) : '',
              callerWhiteId: callerBlind,
              callerAlias: alias,
              callType: resolvedCallType,
              tenantId: tenantId || '',
            },
          });

          return new Response(JSON.stringify({ success: result.success, sentCount: result.sentCount }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // 4.3 Çağrı İptal Bildirimi (action: 'cancel_call' / 'cancel_call_push')
        if (action === 'cancel_call' || action === 'cancel_call_push') {
          const { targetWhiteId, ticketId, callerWhiteId } = body;
          const cleanTarget = (targetWhiteId || '').toLowerCase().trim();
          const targetBlind = await computeBlindId(cleanTarget);
          const callerBlind = await computeBlindId((callerWhiteId || '').toLowerCase().trim());

          const { results: targetRows } = await env.DB.prepare(`
            SELECT COALESCE(push_token, fcm_token) as push_token FROM whitedesk_user_devices
            WHERE LOWER(white_id) IN (?, ?) OR LOWER(blind_id) IN (?, ?)
          `).bind(cleanTarget, targetBlind, cleanTarget, targetBlind).all<any>();
          const targetTokens = (targetRows || []).map((r: any) => r.push_token).filter(Boolean);

          if (targetTokens.length > 0) {
            await sendFcmPushNotification(env.FIREBASE_SERVICE_ACCOUNT, targetTokens, {
              priority: 'high',
              ttl: '30s',
              data: {
                type: 'cancel_call',
                ticketId: ticketId ? String(ticketId) : '',
                callerWhiteId: callerBlind,
              },
            });
          }

          return new Response(JSON.stringify({ success: true, cancelled: true }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // 4.4 Kurumsal Saha / Birim Grubu Telsiz Yayını (action: 'broadcast_org')
        // KURAL: whitedesk_user_bindings tablosuna bakılmaz; bilet kartlarındaki blind_id'ler ve aktif yöneticiler esas alınır!
        // KURAL 3 (SEÇİCİ DAVET ZİLİ): Havuzda zaten bağlı olan cihazlarda (activePeers) davet zili çalmaz; yalnızca bağlı olmayanlarda çalar!
        if (action === 'broadcast_org') {
          const { callerWhiteId, callerAlias, orgName, orgId, ticketId, tenantId, targetMembers } = body;
          const cleanCaller = (callerWhiteId || '').toLowerCase().trim();
          const callerBlind = await computeBlindId(cleanCaller);
          const cleanTenant = (tenantId || '').toLowerCase().trim();
          const canonicalTenant = (!cleanTenant || cleanTenant === 'default' || cleanTenant === 'unassigned' || cleanTenant.startsWith('ent_1fc4c76b722c'))
            ? 'ent_1fc4c76b722c'
            : cleanTenant.replace(/[^a-z0-9_-]/g, '_');
          const isSpecificOrg = orgId && orgId !== 'all' && orgId !== '*' && orgId !== 'global';
          const cleanOrg = isSpecificOrg ? String(orgId).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') : 'all';
          const pttRoomName = `wd_ptt_t_${canonicalTenant}_org_${cleanOrg}`;

          // Aktif havuzda (activePeers) zaten bağlı olan cihazları tespit et ve davet zilinden muaf tut
          const connectedPeerIds = new Set<string>();
          try {
            const roomRow = await env.DB.prepare('SELECT offer_sdp, updated_at FROM ephemeral_signals WHERE room_name = ?').bind(pttRoomName).first<any>();
            if (roomRow && roomRow.offer_sdp && typeof roomRow.offer_sdp === 'string' && roomRow.offer_sdp.trim().startsWith('{')) {
              const parsedOffer = JSON.parse(roomRow.offer_sdp);
              const peers = Array.isArray(parsedOffer.activePeers) ? parsedOffer.activePeers : [];
              const nowTs = Date.now();
              for (const p of peers) {
                const pid = String(p?.whiteId || '').toLowerCase().trim();
                const pts = Number(p?.ts || roomRow.updated_at || 0);
                if (pid && nowTs - pts < 600_000) {
                  connectedPeerIds.add(pid);
                  connectedPeerIds.add(await computeBlindId(pid));
                }
              }
            }
          } catch {}

          const excludedIds = new Set<string>([cleanCaller, callerBlind, ...Array.from(connectedPeerIds)].filter(Boolean));
          let excludedTokens = new Set<string>();
          if (excludedIds.size > 0) {
            const exList = Array.from(excludedIds);
            const exPlaceholders = exList.map(() => '?').join(',');
            const { results: exRows } = await env.DB.prepare(`
              SELECT COALESCE(push_token, fcm_token) as push_token FROM whitedesk_user_devices
              WHERE LOWER(white_id) IN (${exPlaceholders}) OR LOWER(blind_id) IN (${exPlaceholders})
            `).bind(...exList, ...exList).all<any>();
            excludedTokens = new Set((exRows || []).map((r: any) => r.push_token).filter(Boolean));
          }

          const targetIdSet = new Set<string>();

          // 1. İstemciden (bilet kartlarındaki blind_id'lerden) gelen hedefleri doğrudan ekle
          if (Array.isArray(targetMembers) && targetMembers.length > 0) {
            for (const m of targetMembers) {
              const rawM = String(m || '').toLowerCase().trim();
              if (rawM) {
                targetIdSet.add(rawM);
                targetIdSet.add(await computeBlindId(rawM));
              }
            }
          }

          // 2. Kurumdaki aktif yöneticileri ekle
          const { results: tenantAdminsRaw } = await env.DB.prepare(`
            SELECT white_id, blind_id, org_id FROM whitedesk_admins
            WHERE is_active = 1 AND (LOWER(enterprise_blind_id) = ? OR LOWER(enterprise_blind_id) = ? OR ? = '' OR ? = 'default')
          `).bind(cleanTenant, canonicalTenant, cleanTenant, cleanTenant).all<any>();

          let tenantAdmins = tenantAdminsRaw || [];
          if (isSpecificOrg) {
            tenantAdmins = tenantAdmins.filter((a: any) => !a.org_id || a.org_id === 'all' || a.org_id === 'default' || String(a.org_id).toLowerCase() === cleanOrg);
          }

          for (const a of tenantAdmins) {
            if (a.white_id) {
              const w = String(a.white_id).toLowerCase().trim();
              targetIdSet.add(w);
              targetIdSet.add(await computeBlindId(w));
            }
            if (a.blind_id) {
              targetIdSet.add(String(a.blind_id).toLowerCase().trim());
            }
          }

          // Arayanı ve havuzda zaten bağlı olanları davet zili listesinden çıkar
          for (const exId of excludedIds) {
            targetIdSet.delete(exId);
          }

          const targetIds = Array.from(targetIdSet).filter(Boolean);
          let tokensToSend: string[] = [];

          if (targetIds.length > 0) {
            const placeholders = targetIds.map(() => '?').join(',');
            const { results: devices } = await env.DB.prepare(`
              SELECT DISTINCT COALESCE(push_token, fcm_token) as push_token FROM whitedesk_user_devices
              WHERE (LOWER(white_id) IN (${placeholders}) OR LOWER(blind_id) IN (${placeholders}))
            `).bind(...targetIds, ...targetIds).all<any>();

            tokensToSend = (devices || [])
              .map((d: any) => d.push_token)
              .filter((t: string) => t && !excludedTokens.has(t));
          }

          // Eğer hedef listedeki blind_id'ler henüz eşleşmediyse VE havuzda başka bağlı cihaz yoksa, arayan ve bağlı olanlar hariç kayıtlı aktif cihazlara gönder
          const otherConnectedCount = Array.from(connectedPeerIds).filter((id) => id !== cleanCaller && id !== callerBlind).length;
          if (tokensToSend.length === 0 && otherConnectedCount === 0) {
            const { results: fallbackDevices } = await env.DB.prepare(`
              SELECT DISTINCT COALESCE(push_token, fcm_token) as push_token FROM whitedesk_user_devices
              WHERE COALESCE(push_token, fcm_token) IS NOT NULL
                AND LOWER(white_id) NOT IN (?, ?) AND LOWER(COALESCE(blind_id, '')) NOT IN (?, ?)
            `).bind(cleanCaller, callerBlind, cleanCaller, callerBlind).all<any>();
            tokensToSend = (fallbackDevices || [])
              .map((d: any) => d.push_token)
              .filter((t: string) => t && !excludedTokens.has(t));
          }

          if (tokensToSend.length === 0) {
            return new Response(JSON.stringify({
              success: true,
              sentCount: 0,
              activePeerCount: otherConnectedCount,
              reason: otherConnectedCount > 0 ? 'All target devices already connected in pool' : 'No registered target devices',
            }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          const groupName = orgName || workerI18n('push_notifications.default_corp_radio');
          const alias = callerAlias || workerI18n('push_notifications.default_field_officer');

          const result = await sendFcmPushNotification(env.FIREBASE_SERVICE_ACCOUNT, tokensToSend, {
            title: workerI18n('push_notifications.org_radio_title', { groupName }),
            body: workerI18n('push_notifications.org_radio_body', { alias }),
            priority: 'high',
            ttl: '30s',
            isCall: true,
            data: {
              type: 'org_ptt',
              orgId: orgId || '',
              orgName: groupName,
              callerAlias: alias,
              callerWhiteId: callerBlind,
              ticketId: ticketId ? String(ticketId) : '',
              tenantId: canonicalTenant,
              callType: 'ptt',
            },
          });

          return new Response(JSON.stringify({
            success: result.success,
            sentCount: result.sentCount,
            total: tokensToSend.length,
            activePeerCount: otherConnectedCount,
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // 4.5 Genel Bildirim Gönderimi Fallback (Yeni Bilet & Bilet Yanıtı Push)
        const {
          targetWhiteId,
          targetBlindId,
          senderWhiteId,
          title,
          title_tr,
          body: rawBody,
          bodyText,
          body_tr,
          messageText,
          message,
          ticketId,
        } = body;
        const targetSet = new Set<string>();
        if (targetWhiteId) {
          const t = String(targetWhiteId).toLowerCase().trim();
          targetSet.add(t);
          targetSet.add(await computeBlindId(t));
        }
        if (targetBlindId) {
          const b = String(targetBlindId).toLowerCase().trim();
          targetSet.add(b);
          targetSet.add(await computeBlindId(b));
        }
        const cleanSender = senderWhiteId ? String(senderWhiteId).toLowerCase().trim() : '';
        const senderBlind = cleanSender ? await computeBlindId(cleanSender) : '';

        // Gönderenin kendi cihaz tokenlarını hariç tut
        let senderTokens = new Set<string>();
        if (cleanSender) {
          const { results: sRows } = await env.DB.prepare(`
            SELECT COALESCE(push_token, fcm_token) as push_token FROM whitedesk_user_devices
            WHERE LOWER(white_id) IN (?, ?) OR LOWER(blind_id) IN (?, ?)
          `).bind(cleanSender, senderBlind, cleanSender, senderBlind).all<any>();
          senderTokens = new Set((sRows || []).map((r: any) => r.push_token).filter(Boolean));
        }

        // Eğer hedef bir kurum havuzuysa (ent_... veya blind_thewhite_root), o kurumdaki aktif yöneticileri de hedefe ekle
        for (const tid of Array.from(targetSet)) {
          if (tid.startsWith('ent_') || tid === 'blind_thewhite_root' || tid === 'default') {
            const { results: entAdmins } = await env.DB.prepare(`
              SELECT white_id, blind_id FROM whitedesk_admins
              WHERE is_active = 1 AND (LOWER(enterprise_blind_id) = ? OR role = 'founder')
            `).bind(tid).all<any>();
            for (const adm of entAdmins || []) {
              if (adm.white_id) targetSet.add(String(adm.white_id).toLowerCase().trim());
              if (adm.blind_id) targetSet.add(String(adm.blind_id).toLowerCase().trim());
            }
          }
        }

        if (cleanSender) targetSet.delete(cleanSender);
        if (senderBlind) targetSet.delete(senderBlind);

        const targetIds = Array.from(targetSet).filter(Boolean);
        let tokens: string[] = [];
        if (targetIds.length > 0) {
          const placeholders = targetIds.map(() => '?').join(',');
          const { results: rows } = await env.DB.prepare(`
            SELECT DISTINCT COALESCE(push_token, fcm_token) as push_token FROM whitedesk_user_devices
            WHERE LOWER(white_id) IN (${placeholders}) OR LOWER(blind_id) IN (${placeholders})
          `).bind(...targetIds, ...targetIds).all<any>();
          tokens = (rows || []).map((r: any) => r.push_token).filter((t: string) => t && !senderTokens.has(t));
        }

        if (tokens.length === 0 && cleanSender) {
          const { results: fallbackRows } = await env.DB.prepare(`
            SELECT DISTINCT COALESCE(push_token, fcm_token) as push_token FROM whitedesk_user_devices
            WHERE COALESCE(push_token, fcm_token) IS NOT NULL
              AND LOWER(white_id) NOT IN (?, ?) AND LOWER(COALESCE(blind_id, '')) NOT IN (?, ?)
            ORDER BY updated_at DESC LIMIT 2
          `).bind(cleanSender, senderBlind, cleanSender, senderBlind).all<any>();
          tokens = (fallbackRows || []).map((r: any) => r.push_token).filter((t: string) => t && !senderTokens.has(t));
        }

        const resolvedTitle = title || title_tr || workerI18n('push_notifications.default_support_title');
        const resolvedBody = rawBody || bodyText || body_tr || messageText || message || workerI18n('push_notifications.new_support_message_body');

        const res = await sendFcmPushNotification(env.FIREBASE_SERVICE_ACCOUNT, tokens, {
          title: resolvedTitle,
          body: resolvedBody,
          priority: 'high',
          ttl: '86400s',
          isCall: false,
          data: {
            ...(body.data || {}),
            type: 'helpdesk_message',
            isHelpDesk: 'true',
            ticketId: ticketId ? String(ticketId) : '',
            callerWhiteId: senderBlind,
            title: String(resolvedTitle),
            body: String(resolvedBody),
          },
        });

        return new Response(JSON.stringify({ success: res.success, sentCount: res.sentCount }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // =========================================================================
    // 5. WEBRTC FAST REST SIGNALING (/api/signal) - D1 Anycast Database
    // =========================================================================
    if (url.pathname === '/api/signal') {
      try {
        if (!env.DB) throw new Error('D1 DB binding unavailable');
        await ensureD1Schema(env.DB);

        let body: any = null;
        if (request.method === 'POST') {
          try {
            body = await request.json();
          } catch {}
        }

        let roomName = (body?.roomName || url.searchParams.get('roomName') || '').toLowerCase().trim();
        if (!roomName) {
          return new Response(JSON.stringify({ error: 'roomName parameter is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (roomName.startsWith('wd_ptt_t_default_')) {
          roomName = roomName.replace('wd_ptt_t_default_', 'wd_ptt_t_ent_1fc4c76b722c_');
        } else if (roomName.startsWith('wd_ptt_t_unassigned_')) {
          roomName = roomName.replace('wd_ptt_t_unassigned_', 'wd_ptt_t_ent_1fc4c76b722c_');
        }

        if (roomName === 'net_ping') {
          return new Response(JSON.stringify({ found: false, ping: 'ok' }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const now = Date.now();

        // 5.1 DELETE: Oda Sinyalini Temizle
        if (request.method === 'DELETE') {
          await env.DB.prepare('DELETE FROM ephemeral_signals WHERE room_name = ?').bind(roomName).run();
          return new Response(JSON.stringify({ success: true, message: 'Room cleared' }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // 5.2 GET: Sinyal Durumunu Çek
        if (request.method === 'GET') {
          const role = (url.searchParams.get('role') || 'callee').trim();
          const record = await env.DB.prepare('SELECT * FROM ephemeral_signals WHERE room_name = ?').bind(roomName).first<any>();

          if (!record) {
            return new Response(JSON.stringify({ found: false, activePeers: [] }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          let callerCandidates: string[] = [];
          let calleeCandidates: string[] = [];
          try {
            callerCandidates = JSON.parse(record.caller_candidates || '[]');
          } catch {}
          try {
            calleeCandidates = JSON.parse(record.callee_candidates || '[]');
          } catch {}

          let activePeers: Array<{ whiteId: string; alias: string; ts: number }> = [];
          if (record.offer_sdp && typeof record.offer_sdp === 'string' && record.offer_sdp.trim().startsWith('{')) {
            try {
              const parsedOffer = JSON.parse(record.offer_sdp);
              if (Array.isArray(parsedOffer.activePeers)) {
                activePeers = parsedOffer.activePeers.filter((p: any) => p?.whiteId && now - Number(p.ts || record.updated_at || 0) < 600_000);
              }
            } catch {}
          }

          const candidates = role === 'caller' ? calleeCandidates : callerCandidates;

          return new Response(
            JSON.stringify({
              found: true,
              offerSdp: record.offer_sdp || undefined,
              answerSdp: record.answer_sdp || undefined,
              signalType: record.signal_type || undefined,
              targetMode: record.target_mode || undefined,
              candidates,
              activePeers,
              updatedAt: Number(record.updated_at),
            }),
            { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // 5.3 POST: Sinyal Gönder / Güncelle
        if (request.method === 'POST') {
          const { role, signalType, sdp, targetMode, candidate } = body || {};

          if (signalType === 'offer') {
            await env.DB.prepare('DELETE FROM ephemeral_signals WHERE updated_at < ?').bind(now - 600_000).run();
          }

          if (candidate) {
            const candStr = typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
            const existing = await env.DB.prepare('SELECT * FROM ephemeral_signals WHERE room_name = ?').bind(roomName).first<any>();

            if (existing) {
              const col = role === 'caller' ? 'caller_candidates' : 'callee_candidates';
              let list: string[] = [];
              try {
                list = JSON.parse(existing[col] || '[]');
              } catch {}
              list.push(candStr);
              await env.DB.prepare(`UPDATE ephemeral_signals SET ${col} = ?, updated_at = ? WHERE room_name = ?`)
                .bind(JSON.stringify(list), now, roomName)
                .run();
            } else {
              const callerJson = role === 'caller' ? JSON.stringify([candStr]) : '[]';
              const calleeJson = role === 'callee' ? JSON.stringify([candStr]) : '[]';
              await env.DB.prepare(`
                INSERT OR REPLACE INTO ephemeral_signals (room_name, caller_candidates, callee_candidates, updated_at)
                VALUES (?, ?, ?, ?)
              `).bind(roomName, callerJson, calleeJson, now).run();
            }

            return new Response(JSON.stringify({ success: true, iceAdded: true }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          const isCaller = role === 'caller';
          const isCallee = role === 'callee';

          const isRealOfferSdp = isCaller && (signalType === 'offer' || (typeof sdp === 'string' && (sdp.includes('v=') || sdp.includes('org_ptt_broadcast') || sdp.includes('pttMode'))));
          const isRealAnswerSdp = isCallee && (signalType === 'answer' || (typeof sdp === 'string' && sdp.includes('v=') && sdp.includes('m=')));

          const existing = await env.DB.prepare('SELECT * FROM ephemeral_signals WHERE room_name = ?').bind(roomName).first<any>();

          // Mevcut aktif havuz katılımcılarını oku
          let activePeers: Array<{ whiteId: string; alias: string; ts: number }> = [];
          if (existing?.offer_sdp && typeof existing.offer_sdp === 'string' && existing.offer_sdp.trim().startsWith('{')) {
            try {
              const parsedExisting = JSON.parse(existing.offer_sdp);
              if (Array.isArray(parsedExisting.activePeers)) {
                activePeers = parsedExisting.activePeers.filter((p: any) => p?.whiteId && now - Number(p.ts || existing.updated_at || 0) < 600_000);
              }
            } catch {}
          }

          const upsertPeer = async (rawId?: string, alias?: string) => {
            if (!rawId) return;
            const blind = await computeBlindId(String(rawId).toLowerCase().trim());
            if (!blind) return;
            const idx = activePeers.findIndex((p) => p.whiteId.toLowerCase() === blind.toLowerCase());
            if (idx >= 0) {
              activePeers[idx] = { whiteId: blind, alias: alias || activePeers[idx].alias || workerI18n('push_notifications.default_user_alias'), ts: now };
            } else {
              activePeers.push({ whiteId: blind, alias: alias || workerI18n('push_notifications.default_user_alias'), ts: now });
            }
          };

          const removePeer = async (rawId?: string) => {
            if (!rawId) return;
            const clean = String(rawId).toLowerCase().trim();
            const blind = await computeBlindId(clean);
            activePeers = activePeers.filter(
              (p) => p.whiteId.toLowerCase() !== clean && p.whiteId.toLowerCase() !== blind.toLowerCase()
            );
          };

          // Yeni offer_sdp JSON ise arayanı activePeers içine ekle ve mevcut bağlıları koru
          let finalOfferSdp = sdp;
          if (isRealOfferSdp && typeof sdp === 'string' && sdp.trim().startsWith('{')) {
            try {
              const offerObj = JSON.parse(sdp);
              if (offerObj.callerWhiteId) {
                await upsertPeer(offerObj.callerWhiteId, offerObj.callerAlias || workerI18n('push_notifications.default_admin_alias'));
              }
              offerObj.activePeers = activePeers;
              finalOfferSdp = JSON.stringify(offerObj);
            } catch {}
          }

          if (existing) {
            let updateQuery = 'UPDATE ephemeral_signals SET updated_at = ?';
            const params: any[] = [now];

            if (isRealOfferSdp && finalOfferSdp) {
              updateQuery += ', offer_sdp = ?, answer_sdp = NULL, caller_candidates = \'[]\', callee_candidates = \'[]\'';
              params.push(finalOfferSdp);
            } else if (signalType === 'mode-switch' && typeof sdp === 'string' && sdp.trim().startsWith('{')) {
              if (existing.offer_sdp && existing.offer_sdp.trim().startsWith('{')) {
                try {
                  const currentJson = JSON.parse(existing.offer_sdp);
                  const patchJson = JSON.parse(sdp);

                  if (targetMode === 'peer_join' || patchJson.action === 'joined') {
                    await upsertPeer(patchJson.whiteId, patchJson.alias);
                    currentJson.lastPeerEvent = { action: 'joined', alias: patchJson.alias, whiteId: patchJson.whiteId, ts: now };
                  } else if (targetMode === 'peer_leave' || patchJson.action === 'left') {
                    await removePeer(patchJson.whiteId);
                    currentJson.lastPeerEvent = { action: 'left', alias: patchJson.alias, whiteId: patchJson.whiteId, ts: now };
                    if (roomName.startsWith('wd_ptt_t_') && activePeers.length === 0) {
                      await env.DB.prepare('DELETE FROM ephemeral_signals WHERE room_name = ?').bind(roomName).run();
                      return new Response(JSON.stringify({ success: true, roomCleared: true, activePeers: [] }), {
                        headers: { 'Content-Type': 'application/json', ...corsHeaders },
                      });
                    }
                  } else if (targetMode === 'speaker_start' || targetMode === 'speaker_stop') {
                    if (patchJson.whiteId) {
                      await upsertPeer(patchJson.whiteId, patchJson.alias);
                    }
                    currentJson.isSpeaking = patchJson.isSpeaking;
                    currentJson.activeSpeakerAlias = patchJson.isSpeaking ? patchJson.alias : '';
                    currentJson.activeSpeakerWhiteId = patchJson.isSpeaking ? patchJson.whiteId : '';
                  }

                  const merged = JSON.stringify({
                    ...currentJson,
                    ...patchJson,
                    // Ana WebRTC Offer SDP ve oda kimliği kesinlikle ezilmez!
                    sdp: currentJson.sdp,
                    type: currentJson.type,
                    tenantId: currentJson.tenantId,
                    orgId: currentJson.orgId,
                    orgName: currentJson.orgName,
                    callerWhiteId: currentJson.callerWhiteId,
                    callerAlias: currentJson.callerAlias,
                    ts: currentJson.ts,
                    activePeers,
                  });
                  updateQuery += ', offer_sdp = ?';
                  params.push(merged);
                  // KRİTİK: existing.answer_sdp gerçek bir WebRTC SDP içeriyorsa ASLA mode-switch ile ezilmez!
                  const hasExistingRealAnswer = typeof existing.answer_sdp === 'string' && existing.answer_sdp.includes('v=');
                  if (!hasExistingRealAnswer) {
                    updateQuery += ', answer_sdp = ?';
                    params.push(sdp);
                  }
                } catch {
                  const hasExistingRealAnswer = typeof existing.answer_sdp === 'string' && existing.answer_sdp.includes('v=');
                  if (!hasExistingRealAnswer) {
                    updateQuery += ', answer_sdp = ?';
                    params.push(sdp);
                  }
                }
              } else {
                const hasExistingRealAnswer = typeof existing.answer_sdp === 'string' && existing.answer_sdp.includes('v=');
                if (!hasExistingRealAnswer) {
                  updateQuery += ', answer_sdp = ?';
                  params.push(sdp);
                }
              }
            }
            if (isRealAnswerSdp && sdp) {
              updateQuery += ', answer_sdp = ?';
              params.push(sdp);
            }
            if (signalType) {
              updateQuery += ', signal_type = ?';
              params.push(signalType);
            }
            if (targetMode) {
              updateQuery += ', target_mode = ?';
              params.push(targetMode);
            }

            updateQuery += ' WHERE room_name = ?';
            params.push(roomName);

            await env.DB.prepare(updateQuery).bind(...params).run();
          } else {
            await env.DB.prepare(`
              INSERT OR REPLACE INTO ephemeral_signals (room_name, offer_sdp, answer_sdp, signal_type, target_mode, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(
              roomName,
              (isRealOfferSdp || signalType === 'mode-switch') ? (finalOfferSdp || null) : null,
              isRealAnswerSdp ? (sdp || null) : null,
              signalType || null,
              targetMode || null,
              now
            ).run();
          }

          return new Response(JSON.stringify({ success: true, updated: true, activePeers }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // =========================================================================
    // 6. SOVEREIGN CLOUDFLARE D1 + R2 RELAY API (Buharlaşma Havuzu)
    // =========================================================================
    if (request.method === 'POST' && url.pathname === '/api/relay/send') {
      try {
        if (!env.DB) throw new Error('D1 binding unavailable');
        await ensureD1Schema(env.DB);

        const body = (await request.json()) as Partial<TransientMessageRecord>;
        if (!body.ticket_id || !body.recipient_blind_id || !body.sender_blind_id || !body.encrypted_payload) {
          return new Response(JSON.stringify({ error: 'Missing required transient fields' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const id = body.id || 'msg_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
        const now = Date.now();
        const ttlHours = 72;
        const expiresAt = now + ttlHours * 3600 * 1000;

        await env.DB.prepare(`
          INSERT INTO transient_messages (id, ticket_id, recipient_blind_id, sender_blind_id, encrypted_payload, attachment_r2_key, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          body.ticket_id,
          body.recipient_blind_id,
          body.sender_blind_id,
          body.encrypted_payload,
          body.attachment_r2_key || null,
          now,
          expiresAt
        ).run();

        return new Response(JSON.stringify({ success: true, id, expiresAt }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/relay/inbox') {
      try {
        if (!env.DB) return new Response(JSON.stringify({ messages: [] }), { headers: corsHeaders });
        await ensureD1Schema(env.DB);

        const recipientBlindId = url.searchParams.get('recipient_blind_id');
        const ticketId = url.searchParams.get('ticket_id');
        const isFounder = url.searchParams.get('is_founder') === 'true' || url.searchParams.get('all') === 'true';

        let query = 'SELECT * FROM transient_messages';
        const params: any[] = [];
        if (isFounder) {
          query += ' ORDER BY created_at ASC LIMIT 100;';
        } else if (recipientBlindId && ticketId) {
          query += ' WHERE recipient_blind_id = ? AND ticket_id = ? ORDER BY created_at ASC LIMIT 100;';
          params.push(recipientBlindId, ticketId);
        } else if (recipientBlindId) {
          if (recipientBlindId.includes(',')) {
            const ids = recipientBlindId.split(',').map((s) => s.trim()).filter(Boolean);
            const placeholders = ids.map(() => '?').join(',');
            query += ` WHERE recipient_blind_id IN (${placeholders}) ORDER BY created_at ASC LIMIT 100;`;
            params.push(...ids);
          } else {
            query += ' WHERE recipient_blind_id = ? ORDER BY created_at ASC LIMIT 100;';
            params.push(recipientBlindId);
          }
        } else if (ticketId) {
          query += ' WHERE ticket_id = ? ORDER BY created_at ASC LIMIT 100;';
          params.push(ticketId);
        }

        const { results } = await env.DB.prepare(query).bind(...params).all();
        return new Response(JSON.stringify({ success: true, messages: results || [] }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message, messages: [] }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/relay/ack') {
      try {
        if (!env.DB) return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        const { id, r2_key } = (await request.json()) as { id?: string; r2_key?: string };
        if (id) {
          await env.DB.prepare('DELETE FROM transient_messages WHERE id = ?').bind(id).run();
        }
        if (r2_key && env.BUCKET) {
          try {
            await env.BUCKET.delete(r2_key);
          } catch {}
        }
        return new Response(JSON.stringify({ success: true, vaporized: true, id }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/relay/upload-attachment') {
      try {
        if (!env.BUCKET) throw new Error('R2 Bucket binding unavailable');
        const key = 'att_' + crypto.randomUUID().replace(/-/g, '') + '.bin';
        const contentTypeHeader = request.headers.get('content-type') || 'application/octet-stream';

        if (contentTypeHeader.includes('application/json')) {
          const jsonBody = (await request.json()) as { base64?: string; data?: string; content_type?: string };
          const base64Data = (jsonBody.base64 || jsonBody.data || '').trim();
          const targetMime = jsonBody.content_type || 'application/octet-stream';

          let bytes: Uint8Array;
          if (targetMime === 'application/json' || base64Data.startsWith('[') || base64Data.startsWith('{')) {
            bytes = new TextEncoder().encode(base64Data);
          } else {
            try {
              const clean = base64Data.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
              const binaryStr = atob(clean);
              bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
            } catch {
              bytes = new TextEncoder().encode(base64Data);
            }
          }

          await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: targetMime } });
        } else {
          const arrayBuffer = await request.arrayBuffer();
          await env.BUCKET.put(key, arrayBuffer, { httpMetadata: { contentType: contentTypeHeader } });
        }

        return new Response(JSON.stringify({ success: true, r2_key: key }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/relay/attachment/')) {
      try {
        if (!env.BUCKET) return new Response('R2 Bucket unavailable', { status: 503, headers: corsHeaders });
        const key = url.pathname.replace('/api/relay/attachment/', '');
        const object = await env.BUCKET.get(key);
        if (!object) {
          return new Response('Attachment already vaporized or not found', { status: 404, headers: corsHeaders });
        }

        const format = url.searchParams.get('format');
        const accept = request.headers.get('accept') || '';

        if (format === 'base64' || accept.includes('application/json')) {
          const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
          if (contentType === 'application/json') {
            const text = await object.text();
            return new Response(JSON.stringify({ success: true, base64: text, content_type: 'application/json' }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          const arrayBuffer = await object.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
          }
          const base64 = btoa(binary);
          return new Response(JSON.stringify({ success: true, base64, content_type: contentType }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const headers = new Headers(corsHeaders);
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        return new Response(object.body, { headers });
      } catch (err: any) {
        return new Response('Error retrieving attachment', { status: 500, headers: corsHeaders });
      }
    }

    // =========================================================================
    // 7. UNIFIED ADMIN ROSTER & FAIR LOAD-BALANCING (Consolidated in whitedesk_admins)
    // =========================================================================
    if (request.method === 'POST' && url.pathname === '/api/roster/heartbeat') {
      try {
        if (!env.DB) throw new Error('D1 DB binding unavailable');
        await ensureD1Schema(env.DB);

        const body = (await request.json()) as any;
        const now = Date.now();
        const rawId = body.blind_id?.trim() || '';
        const blindId = await computeBlindId(rawId);
        const entBlindId = body.enterprise_blind_id?.trim() || 'default';
        const orgId = body.org_id || 'default';
        const appId = body.app_id || 'whitedesk';
        const name = body.name || '';
        const cats = typeof body.categories === 'string' ? body.categories : JSON.stringify(body.categories || ['general']);
        const openTickets = typeof body.open_tickets === 'number' ? body.open_tickets : 0;
        let isActive = typeof body.is_active === 'number' ? body.is_active : 1;
        let snoozeUntil = typeof body.snooze_until === 'number' ? body.snooze_until : 0;

        if (snoozeUntil > 0 && now >= snoozeUntil) {
          isActive = 1;
          snoozeUntil = 0;
        }

        const existing = await env.DB.prepare(
          'SELECT white_id, counter, is_active, alias, role FROM whitedesk_admins WHERE white_id = ? OR blind_id = ? OR white_id = ? LIMIT 1'
        ).bind(blindId, blindId, rawId).first<{ white_id: string; counter: number; is_active: number; alias: string; role: string }>();

        let counter = existing?.counter ?? 0;

        if (existing && existing.is_active === 0 && isActive === 1) {
          const minRes = await env.DB.prepare(`
            SELECT MIN(counter) as min_counter FROM whitedesk_admins
            WHERE enterprise_blind_id = ? AND is_active = 1 AND date_time > ?
          `).bind(entBlindId, now - 180_000).first<{ min_counter: number | null }>();

          if (minRes && minRes.min_counter !== null && typeof minRes.min_counter === 'number') {
            const minC = minRes.min_counter;
            if (counter < minC) counter = minC + Math.floor(0.20 * minC);
          }
        }

        const targetKey = existing?.white_id || blindId;
        const resolvedAlias = name || existing?.alias || workerI18n('helpdesk.admin_role_short');
        const resolvedRole = existing?.role || 'admin';

        await env.DB.prepare(`
          INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, org_id, app_id, categories, alias, role, open_tickets, counter, is_active, snooze_until, date_time, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(white_id) DO UPDATE SET
            blind_id = EXCLUDED.blind_id,
            enterprise_blind_id = CASE WHEN EXCLUDED.enterprise_blind_id != 'default' THEN EXCLUDED.enterprise_blind_id ELSE whitedesk_admins.enterprise_blind_id END,
            org_id = CASE WHEN EXCLUDED.org_id != 'default' THEN EXCLUDED.org_id ELSE whitedesk_admins.org_id END,
            app_id = CASE WHEN EXCLUDED.app_id != 'whitedesk' THEN EXCLUDED.app_id ELSE whitedesk_admins.app_id END,
            categories = EXCLUDED.categories,
            alias = CASE WHEN EXCLUDED.alias != '' AND EXCLUDED.alias != 'Admin' THEN EXCLUDED.alias ELSE whitedesk_admins.alias END,
            open_tickets = EXCLUDED.open_tickets,
            counter = EXCLUDED.counter,
            is_active = EXCLUDED.is_active,
            snooze_until = EXCLUDED.snooze_until,
            date_time = EXCLUDED.date_time
        `).bind(targetKey, blindId, entBlindId, orgId, appId, cats, resolvedAlias, resolvedRole, openTickets, counter, isActive, snoozeUntil, now, now).run();

        return new Response(JSON.stringify({ success: true, blind_id: blindId, is_active: isActive, counter, snooze_until: snoozeUntil }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/tickets/allocate') {
      try {
        if (!env.DB) return new Response(JSON.stringify({ success: true, assigned_admin_blind_id: 'unassigned' }), { headers: corsHeaders });
        await ensureD1Schema(env.DB);

        const body = (await request.json()) as any;
        const now = Date.now();
        const onlineThreshold = now - 120_000;
        const entBlindId = body.enterprise_blind_id?.trim();
        const targetOrg = body.org_id && body.org_id !== 'all' && body.org_id !== 'global' ? body.org_id.trim() : null;
        const targetCategory = (body.category || '').toLowerCase().trim();

        let query = `
          SELECT COALESCE(blind_id, white_id) AS blind_id, white_id, alias AS name, enterprise_blind_id, org_id, app_id, categories, open_tickets, counter, is_active, snooze_until, date_time
          FROM whitedesk_admins
          WHERE enterprise_blind_id = ?
            AND is_active = 1
            AND (snooze_until = 0 OR snooze_until <= ?)
        `;
        const params: any[] = [entBlindId, now];
        if (targetOrg) {
          query += ` AND (org_id = ? OR org_id = 'default' OR org_id = 'all')`;
          params.push(targetOrg);
        }
        query += ` ORDER BY counter ASC, open_tickets ASC, date_time DESC`;

        const { results } = await env.DB.prepare(query).bind(...params).all<any>();
        let candidate: any = null;
        if (results && results.length > 0) {
          if (targetCategory && targetCategory !== 'general') {
            candidate = results.find((adm: any) => {
              try {
                const arr = JSON.parse(adm.categories || '[]');
                return Array.isArray(arr) && (arr.includes(targetCategory) || arr.includes('general') || arr.includes('all'));
              } catch {
                return true;
              }
            }) || results[0];
          } else {
            candidate = results[0];
          }
        }

        if (candidate) {
          const normalizedAdminBlindId = await computeBlindId(candidate.blind_id || candidate.white_id);
          const nextCounter = (candidate.counter || 0) + 1;
          const nextOpen = (candidate.open_tickets || 0) + 1;
          await env.DB.prepare(`
            UPDATE whitedesk_admins
            SET counter = ?, open_tickets = ?, blind_id = ?
            WHERE white_id = ? OR blind_id = ?
          `).bind(nextCounter, nextOpen, normalizedAdminBlindId, candidate.white_id || candidate.blind_id, normalizedAdminBlindId).run();

          return new Response(JSON.stringify({
            success: true,
            assigned_admin_blind_id: normalizedAdminBlindId,
            name: candidate.name,
            counter: nextCounter,
            open_tickets: nextOpen,
          }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        return new Response(JSON.stringify({ success: true, assigned_admin_blind_id: 'unassigned', name: null }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/tickets/reissue-twin') {
      try {
        if (!env.DB) throw new Error('D1 DB binding unavailable');
        await ensureD1Schema(env.DB);

        const body = (await request.json()) as any;
        const now = Date.now();
        const expiresAt = now + 72 * 3600 * 1000;
        const twinAId = body.twin_a.id || 'msg_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
        const twinBId = body.twin_b.id || 'msg_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);

        await env.DB.batch([
          env.DB.prepare(`
            INSERT INTO transient_messages (id, ticket_id, recipient_blind_id, sender_blind_id, encrypted_payload, attachment_r2_key, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(twinAId, body.twin_a.ticket_id, body.twin_a.recipient_blind_id, body.twin_a.sender_blind_id, body.twin_a.encrypted_payload, body.twin_a.attachment_r2_key || null, now, expiresAt),
          env.DB.prepare(`
            INSERT INTO transient_messages (id, ticket_id, recipient_blind_id, sender_blind_id, encrypted_payload, attachment_r2_key, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(twinBId, body.twin_b.ticket_id, body.twin_b.recipient_blind_id, body.twin_b.sender_blind_id, body.twin_b.encrypted_payload, body.twin_b.attachment_r2_key || null, now, expiresAt),
        ]);

        if (body.old_admin_blind_id) {
          await env.DB.prepare('UPDATE whitedesk_admins SET counter = MAX(0, counter - 1), open_tickets = MAX(0, open_tickets - 1) WHERE white_id = ? OR blind_id = ?')
            .bind(body.old_admin_blind_id, body.old_admin_blind_id)
            .run();
        }
        if (body.new_admin_blind_id && body.new_admin_blind_id !== 'unassigned') {
          await env.DB.prepare('UPDATE whitedesk_admins SET counter = counter + 1, open_tickets = open_tickets + 1 WHERE white_id = ? OR blind_id = ?')
            .bind(body.new_admin_blind_id, body.new_admin_blind_id)
            .run();
        }

        return new Response(JSON.stringify({ success: true, twin_a_id: twinAId, twin_b_id: twinBId }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/roster/list') {
      try {
        if (!env.DB) return new Response(JSON.stringify({ roster: [] }), { headers: corsHeaders });
        await ensureD1Schema(env.DB);
        const entBlindId = url.searchParams.get('enterprise_blind_id');
        const now = Date.now();

        const { results } = await env.DB.prepare(`
          SELECT COALESCE(blind_id, white_id) AS blind_id, alias AS name, enterprise_blind_id, org_id, app_id, categories, open_tickets, counter, is_active, snooze_until, date_time, role
          FROM whitedesk_admins
          WHERE enterprise_blind_id = ?
          ORDER BY counter ASC, alias ASC
        `).bind(entBlindId?.trim()).all<any>();

        const roster = await Promise.all((results || []).map(async (adm: any) => ({
          ...adm,
          blind_id: await computeBlindId(adm.blind_id),
          is_online: adm.date_time >= now - 120_000 && adm.is_active === 1,
        })));

        return new Response(JSON.stringify({ success: true, roster }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message, roster: [] }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/tickets/claim-next-pool') {
      try {
        if (!env.DB) return new Response(JSON.stringify({ error: 'DB not available' }), { status: 500, headers: corsHeaders });
        await ensureD1Schema(env.DB);

        const body = (await request.json()) as any;
        const entBlindId = (body.enterprise_blind_id || 'default').trim();
        const adminBlindId = (body.admin_blind_id || '').trim();
        const adminName = body.admin_name || null;

        const candidate = await env.DB.prepare(`
          SELECT * FROM transient_messages
          WHERE recipient_blind_id = ? AND encrypted_payload LIKE '%"assigned_admin_blind_id":"unassigned"%'
          ORDER BY created_at ASC LIMIT 1
        `).bind(entBlindId).first<any>();

        if (!candidate) {
          return new Response(JSON.stringify({ success: true, claimed: false, message: 'Pool is empty' }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        let payload: any = {};
        try {
          payload = JSON.parse(candidate.encrypted_payload);
          if (payload.ticket) {
            payload.ticket.assigned_admin_blind_id = adminBlindId;
            if (adminName) payload.ticket.assigned_admin_name = adminName;
            payload.ticket.assigned_at = Date.now();
          }
        } catch {
          payload = { raw: candidate.encrypted_payload };
        }

        const updatedPayloadStr = JSON.stringify(payload);
        await env.DB.prepare('UPDATE transient_messages SET recipient_blind_id = ?, encrypted_payload = ? WHERE id = ?').bind(adminBlindId, updatedPayloadStr, candidate.id).run();
        await env.DB.prepare('UPDATE whitedesk_admins SET counter = counter + 1, open_tickets = open_tickets + 1 WHERE white_id = ? OR blind_id = ?').bind(adminBlindId, adminBlindId).run();

        return new Response(JSON.stringify({
          success: true,
          claimed: true,
          ticket_id: candidate.ticket_id,
          item: { ...candidate, recipient_blind_id: adminBlindId, encrypted_payload: updatedPayloadStr },
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // =========================================================================
    // 8. DURABLE OBJECT ROUTING (Auth & Real-Time Ephemeral Signaling)
    // =========================================================================
    const tenantBlindId = url.searchParams.get('tenant') || 'whitedesk_global_cluster';
    const doId = env.AUTH_RELAY.idFromName(tenantBlindId);
    const stub = env.AUTH_RELAY.get(doId);

    const response = await stub.fetch(request);
    const modifiedHeaders = new Headers(response.headers);
    modifiedHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: modifiedHeaders,
    });
  },

  /**
   * Scheduled Cron Trigger (Hourly Vaporization of Expired Ephemeral Items)
   */
  async scheduled(event: any, env: Env): Promise<void> {
    if (env.DB) {
      try {
        const now = Date.now();
        await env.DB.prepare('DELETE FROM transient_messages WHERE expires_at < ?').bind(now).run();
        await env.DB.prepare('DELETE FROM ephemeral_signals WHERE updated_at < ?').bind(now - 120_000).run();
      } catch {}
    }
  },
};
