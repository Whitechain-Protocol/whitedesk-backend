#!/usr/bin/env node

/**
 * inWhite / WhiteDesk Ecosystem Master CLI ("wd")
 * Sovereign Multi-Tenant & Genesis Engine
 *
 * Capabilities:
 *   1. Start Genesis (TheWhite Enterprises + Master Schema)
 *   2. Create Tenant (Atlas Global, etc. + Org + App + Categories + Schema.sql)
 *   3. Create TWhite Founder Hash (Single-use zero-approval founder recovery)
 *   4. Create Global Admin Hash for a Tenant (WhiteCosmos approval flow)
 *   5. Create Divisional User Hash (Department binding with E2EE capability)
 */

const { generateKeyPairSync, createHmac, randomBytes } = require('crypto');
const fs = require('fs');
const path = require('path');

// Auto-load .env.local if not already in process.env
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)?\s*$/);
    if (m && m[1] && !process.env[m[1]]) {
      process.env[m[1]] = (m[2] || '').trim().replace(/^['"]|['"]$/g, '');
    }
  });
}

const SYSTEM_SALT = 'WhiteDesk_ZeroKnowledge_Salt_2026_Secure';
const BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.whitedesk.one').replace(/\/$/, '');
const D1_SQL_ENDPOINT = `${BACKEND_URL}/api/d1/query`;

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  white: '\x1b[37m',
  magenta: '\x1b[35m',
};

function generateBlindId(whiteId, salt = SYSTEM_SALT) {
  if (!whiteId) return '';
  const clean = whiteId.trim().toLowerCase();
  if (clean.startsWith('blind_') || clean.startsWith('ent_')) return clean;
  const hash = createHmac('sha256', salt).update(clean).digest('hex');
  return 'blind_' + hash.slice(0, 32);
}

function escapeSqlString(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function executeSql(query) {
  const res = await fetch(D1_SQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[Cloudflare D1 SQL HTTP ${res.status}] ${errText}`);
  }

  const data = await res.json();
  return Array.isArray(data.rows) ? data.rows : [];
}

function getMasterSchemaSql() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    return fs.readFileSync(schemaPath, 'utf8');
  }
  return '';
}

function saveTenantFiles(tenantName, keysData) {
  const slug = tenantName
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  const tenantDir = path.join(__dirname, '..', 'tenants', slug);
  if (!fs.existsSync(tenantDir)) {
    fs.mkdirSync(tenantDir, { recursive: true });
  }

  const keysPath = path.join(tenantDir, 'keys.json');
  fs.writeFileSync(keysPath, JSON.stringify(keysData, null, 2), 'utf8');

  const schemaPath = path.join(tenantDir, 'schema.sql');
  const masterSchema = getMasterSchemaSql();
  if (masterSchema) {
    fs.writeFileSync(schemaPath, masterSchema, 'utf8');
  }

  return { tenantDir, keysPath, schemaPath, slug };
}

// ─── 1. START GENESIS ────────────────────────────────────────────────────────
async function startGenesis() {
  console.log(`\n${C.bold}${C.cyan}╔════════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.white}║             WhiteDesk Sovereign Root Genesis                   ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚════════════════════════════════════════════════════════════════╝${C.reset}`);

  // Check if Genesis already exists
  const existing = await executeSql(
    `SELECT * FROM whitedesk_enterprises WHERE is_founder_tenant = TRUE LIMIT 1;`
  );

  if (existing.length > 0) {
    const ent = existing[0];
    console.log(`\n${C.yellow}[BİLGİ] Genesis zaten tamamlanmış ve mühürlenmiştir.${C.reset}`);
    console.log(`Kuruluş Adı    : ${C.bold}${ent.name}${C.reset}`);
    console.log(`Enterprise Blind: ${C.cyan}${ent.enterprise_blind_id}${C.reset}`);
    console.log(`Org Public Key  : ${C.dim}${ent.org_pub}${C.reset}\n`);
    return {
      alreadyExists: true,
      enterprise_name: ent.name,
      enterprise_blind_id: ent.enterprise_blind_id,
      org_pub: ent.org_pub,
    };
  }

  const now = Date.now();
  const founderOrg = 'TheWhite Enterprises';
  const founderApp = 'inwhite';

  // 1. Generate Ed25519 Keypair
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const orgPubHex = publicKey.export({ type: 'spki', format: 'der' }).slice(-32).toString('hex');
  const orgPrivHex = privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32).toString('hex');

  // 2. Generate WhiteID and Blind-ID
  const enterpriseWhiteId = 'bod_' + randomBytes(16).toString('hex');
  const enterpriseBlindId = generateBlindId(enterpriseWhiteId);

  // 3. Save to Neon whitedesk_genesis_vault & whitedesk_enterprises
  await executeSql(`
    INSERT INTO whitedesk_genesis_vault (
      enterprise_blind_id, enterprise_name, app_name, org_pub, claimed, created_at
    ) VALUES (
      ${escapeSqlString(enterpriseBlindId)},
      ${escapeSqlString(founderOrg)},
      ${escapeSqlString(founderApp)},
      ${escapeSqlString(orgPubHex)},
      FALSE,
      ${now}
    ) ON CONFLICT (enterprise_blind_id) DO NOTHING;
  `);

  await executeSql(`
    INSERT INTO whitedesk_enterprises (
      enterprise_blind_id, name, org_pub, is_founder_tenant, created_at
    ) VALUES (
      ${escapeSqlString(enterpriseBlindId)},
      ${escapeSqlString(founderOrg)},
      ${escapeSqlString(orgPubHex)},
      TRUE,
      ${now}
    ) ON CONFLICT (enterprise_blind_id) DO NOTHING;
  `);

  // Default org for founder
  await executeSql(`
    INSERT INTO whitedesk_orgs (org_id, enterprise_blind_id, name, created_at)
    VALUES ('merkez_thewhite', ${escapeSqlString(enterpriseBlindId)}, 'TheWhite HQ', ${now})
    ON CONFLICT (org_id) DO NOTHING;
  `);

  // 4. Save local folder tenants/TheWhite-Enterprises/
  const keysData = {
    enterprise_name: founderOrg,
    app_name: founderApp,
    enterprise_white_id: enterpriseWhiteId,
    enterprise_blind_id: enterpriseBlindId,
    org_pub: orgPubHex,
    org_priv: orgPrivHex,
    is_founder_tenant: true,
    created_at: now,
    created_at_iso: new Date(now).toISOString(),
    licensor: 'TheWhite Root Authority',
  };

  const files = saveTenantFiles(founderOrg, keysData);

  console.log(`${C.green}${C.bold}[BAŞARILI] Root Genesis Başarıyla Mühürlendi!${C.reset}\n`);
  console.log(`${C.bold}Klasör          :${C.reset} ${C.yellow}${files.tenantDir}${C.reset}`);
  console.log(`${C.bold}Keys Dosyası    :${C.reset} ${C.yellow}${files.keysPath}${C.reset}`);
  console.log(`${C.bold}Schema SQL      :${C.reset} ${C.yellow}${files.schemaPath}${C.reset}`);
  console.log(`\n${C.bold}${C.magenta}--- [KURUCU (THEWHITE) GİRİŞ ANAHTARI] ---${C.reset}`);
  console.log(`${C.bold}TheWhite WhiteID :${C.reset} ${C.green}${C.bold}${enterpriseWhiteId}${C.reset}`);
  console.log(`${C.bold}Org Public Key   :${C.reset} ${C.dim}${orgPubHex}${C.reset}`);
  console.log(`${C.bold}${C.magenta}------------------------------------------${C.reset}`);
  console.log(`\n${C.yellow}Aktivasyon Talimatı:${C.reset}`);
  console.log(`Kurucu TheWhite, bilet mesaj kutusuna şu komutu yazar:`);
  console.log(`  ${C.cyan}${C.bold}admin ${enterpriseWhiteId}${C.reset}`);
  console.log(`Doğrudan 'TheWhite the Founder (**)' yetkisi tescil edilir.\n`);

  return {
    alreadyExists: false,
    ...keysData,
    ...files,
  };
}

// ─── 2. CREATE TENANT ────────────────────────────────────────────────────────
async function createTenant({
  tenantName,
  orgName = 'Merkez',
  appName = 'SupportDesk',
  categories = null,
}) {
  if (!tenantName || !tenantName.trim()) {
    throw new Error('Tenant (Kiracı) adı zorunludur.');
  }

  const cleanTenant = tenantName.trim();
  const cleanOrg = (orgName || 'Merkez').trim();
  const cleanApp = (appName || 'SupportDesk').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

  console.log(`\n${C.bold}${C.cyan}╔════════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.white}║               WhiteDesk Tenant (Kiracı) Oluşturma              ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚════════════════════════════════════════════════════════════════╝${C.reset}`);
  console.log(`${C.dim}Kiracı Adı (Tenant) :${C.reset} ${C.bold}${cleanTenant}${C.reset}`);
  console.log(`${C.dim}Alt Birim (Org)     :${C.reset} ${C.bold}${cleanOrg}${C.reset}`);
  console.log(`${C.dim}Uygulama (App)      :${C.reset} ${C.bold}${cleanApp}${C.reset}`);

  const now = Date.now();

  // 1. Generate Ed25519 Keypair
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const orgPubHex = publicKey.export({ type: 'spki', format: 'der' }).slice(-32).toString('hex');
  const orgPrivHex = privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32).toString('hex');

  // 2. Generate WhiteID & Blind-ID
  const tenantWhiteId = 'bod_' + randomBytes(16).toString('hex');
  const tenantBlindId = generateBlindId(tenantWhiteId);
  const orgId = cleanOrg.toLowerCase().replace(/[^a-z0-9_-]/g, '_') + '_' + tenantBlindId.slice(-6);

  // Default Categories if not specified
  const cats = categories || [
    { id: 'all', key: 'all', icon: 'Layers', labelTr: 'Tümü', labelEn: 'All' },
    { id: 'genel', key: 'genel', icon: 'HelpCircle', labelTr: 'Genel Destek', labelEn: 'General Support' },
    { id: 'operasyon', key: 'operasyon', icon: 'Shield', labelTr: 'Operasyon', labelEn: 'Operations' },
    { id: 'finans', key: 'finans', icon: 'CreditCard', labelTr: 'Mali İşler & Finans', labelEn: 'Finance & Billing' },
  ];
  const categoriesJson = JSON.stringify(cats).replace(/'/g, "''");

  // 3. Save to Neon
  await executeSql(`
    INSERT INTO whitedesk_genesis_vault (
      enterprise_blind_id, enterprise_name, app_name, org_pub, claimed, created_at
    ) VALUES (
      ${escapeSqlString(tenantBlindId)},
      ${escapeSqlString(cleanTenant)},
      ${escapeSqlString(cleanApp)},
      ${escapeSqlString(orgPubHex)},
      FALSE,
      ${now}
    ) ON CONFLICT (enterprise_blind_id) DO UPDATE SET
      enterprise_name = EXCLUDED.enterprise_name,
      app_name = EXCLUDED.app_name,
      org_pub = EXCLUDED.org_pub;
  `);

  await executeSql(`
    INSERT INTO whitedesk_enterprises (
      enterprise_blind_id, name, org_pub, is_founder_tenant, created_at
    ) VALUES (
      ${escapeSqlString(tenantBlindId)},
      ${escapeSqlString(cleanTenant)},
      ${escapeSqlString(orgPubHex)},
      FALSE,
      ${now}
    ) ON CONFLICT (enterprise_blind_id) DO UPDATE SET name = EXCLUDED.name, org_pub = EXCLUDED.org_pub;
  `);

  await executeSql(`
    INSERT INTO whitedesk_orgs (org_id, enterprise_blind_id, name, created_at)
    VALUES (${escapeSqlString(orgId)}, ${escapeSqlString(tenantBlindId)}, ${escapeSqlString(cleanOrg)}, ${now})
    ON CONFLICT (org_id) DO NOTHING;
  `);

  await executeSql(`
    INSERT INTO whitedesk_apps (app_id, enterprise_blind_id, name, is_active, created_at)
    VALUES (${escapeSqlString(cleanApp)}, ${escapeSqlString(tenantBlindId)}, ${escapeSqlString(cleanApp)}, TRUE, NOW())
    ON CONFLICT (app_id) DO UPDATE SET enterprise_blind_id = EXCLUDED.enterprise_blind_id, is_active = TRUE;
  `);

  const catList = Array.isArray(categories) ? categories : ['general', 'technical', 'billing'];
  for (const c of catList) {
    const cId = typeof c === 'string' ? c.toLowerCase().trim() : c.id;
    const cTr = typeof c === 'string' ? c : (c.labelTr || c.name || cId);
    const cEn = typeof c === 'string' ? c : (c.labelEn || c.name || cId);
    const catPayload = [{
      id: cId,
      key: cId,
      labelTr: cTr,
      labelEn: cEn,
      icon: 'HelpCircle',
    }];
    await executeSql(`
      INSERT INTO whitedesk_categories (category_id, enterprise_blind_id, org_id, app_id, scope_type, categories, is_active, created_at, updated_at)
      VALUES (
        ${escapeSqlString(cId)}, 
        ${escapeSqlString(tenantBlindId)}, 
        ${escapeSqlString(orgId)}, 
        ${escapeSqlString(cleanApp)}, 
        'app', 
        ${escapeSqlString(JSON.stringify(catPayload))}::jsonb, 
        TRUE, 
        NOW(), 
        NOW()
      )
      ON CONFLICT (category_id) DO UPDATE SET 
        enterprise_blind_id = EXCLUDED.enterprise_blind_id,
        org_id = EXCLUDED.org_id,
        app_id = EXCLUDED.app_id,
        categories = EXCLUDED.categories,
        updated_at = NOW(),
        is_active = TRUE;
    `);
  }

  // 4. Save local folder tenants/<Tenant-Slug>/
  const keysData = {
    tenant_name: cleanTenant,
    app_name: cleanApp,
    org_name: cleanOrg,
    org_id: orgId,
    tenant_white_id: tenantWhiteId,
    tenant_blind_id: tenantBlindId,
    org_pub: orgPubHex,
    org_priv: orgPrivHex,
    categories: cats,
    created_at: now,
    created_at_iso: new Date(now).toISOString(),
    licensor: 'TheWhite Root Authority',
  };

  const files = saveTenantFiles(cleanTenant, keysData);

  console.log(`${C.green}${C.bold}[BAŞARILI] Tenant Başarıyla Oluşturuldu!${C.reset}\n`);
  console.log(`${C.bold}Klasör          :${C.reset} ${C.yellow}${files.tenantDir}${C.reset}`);
  console.log(`${C.bold}Keys Dosyası    :${C.reset} ${C.yellow}${files.keysPath}${C.reset}`);
  console.log(`${C.bold}Disaster Schema :${C.reset} ${C.yellow}${files.schemaPath}${C.reset}`);
  console.log(`\n${C.bold}${C.magenta}--- [TENANT BİLGİLERİ] ---${C.reset}`);
  console.log(`${C.bold}Tenant WhiteID :${C.reset} ${C.green}${C.bold}${tenantWhiteId}${C.reset}`);
  console.log(`${C.bold}Org Public Key :${C.reset} ${C.dim}${orgPubHex}${C.reset}`);
  console.log(`${C.bold}${C.magenta}--------------------------${C.reset}`);
  console.log(`\n${C.yellow}Global Admin Kurulum Talimatı:${C.reset}`);
  console.log(`Tenant yetkilisi bilet kutusuna şunu yazar:`);
  console.log(`  ${C.cyan}${C.bold}admin ${tenantWhiteId}${C.reset}`);
  console.log(`TheWhite onayına düşer. Onaylandığında WhiteCosmos Global Admin (*) olur.\n`);

  return {
    ...keysData,
    ...files,
  };
}

// ─── 3. CREATE TWHITE FOUNDER HASH ──────────────────────────────────────────
async function createFounderHash() {
  const hash = 'tw_founder_' + randomBytes(24).toString('hex');
  const now = Date.now();

  // Find founder tenant blind id
  const founderRows = await executeSql(
    `SELECT enterprise_blind_id FROM whitedesk_enterprises WHERE is_founder_tenant = TRUE LIMIT 1;`
  );
  const founderBlindId = founderRows.length > 0 ? founderRows[0].enterprise_blind_id : 'blind_thewhite_root';

  await executeSql(`
    INSERT INTO whitedesk_recovery_hashes (hash, type, tenant_blind_id, used, created_at)
    VALUES (${escapeSqlString(hash)}, 'founder', ${escapeSqlString(founderBlindId)}, FALSE, ${now});
  `);

  console.log(`\n${C.bold}${C.green}[BAŞARILI] Tek Kullanımlık TheWhite Founder Hash Üretildi:${C.reset}`);
  console.log(`${C.bold}${C.yellow}${hash}${C.reset}\n`);
  console.log(`Kullanım: Kurucu yeni cihazında bilet kutusuna şunu yazar:`);
  console.log(`  ${C.cyan}${C.bold}admin ${hash}${C.reset}`);
  console.log(`Sıfır onay ile anında 'TheWhite the Founder (**)' yetkisi tescil edilir.\n`);

  return { hash, type: 'founder', created_at: now };
}

// ─── 4. CREATE GLOBAL ADMIN HASH FOR A TENANT ───────────────────────────────
async function createGlobalAdminHash(tenantBlindId) {
  if (!tenantBlindId) {
    throw new Error('Tenant Blind ID zorunludur.');
  }

  const hash = 'ga_cosmos_' + randomBytes(24).toString('hex');
  const now = Date.now();

  await executeSql(`
    INSERT INTO whitedesk_recovery_hashes (hash, type, tenant_blind_id, used, created_at)
    VALUES (${escapeSqlString(hash)}, 'global_admin', ${escapeSqlString(tenantBlindId)}, FALSE, ${now});
  `);

  console.log(`\n${C.bold}${C.green}[BAŞARILI] Global Admin Claim Hash Üretildi:${C.reset}`);
  console.log(`${C.bold}${C.yellow}${hash}${C.reset}\n`);
  console.log(`Kullanım: Kiracı yöneticisi bilet kutusuna şunu yazar:`);
  console.log(`  ${C.cyan}${C.bold}admin ${hash}${C.reset}`);
  console.log(`TheWhite'ın onayına düşer. Onaylandığında WhiteCosmos Global Admin (*) olur.\n`);

  return { hash, type: 'global_admin', tenantBlindId, created_at: now };
}

// ─── 5. CREATE DIVISIONAL USER HASH ─────────────────────────────────────────
async function createUserDivisionalHash(tenantBlindId, orgNameOrId = 'Merkez', appId = 'whitedesk', tenantName = '') {
  if (!tenantBlindId) {
    throw new Error('Tenant Blind ID zorunludur.');
  }

  const rawOrg = (orgNameOrId || 'Merkez').trim();
  const slugOrg = rawOrg
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '') || 'merkez';
  const orgId = slugOrg;

  const now = Date.now();

  // 1. Alt birim (org) whitedesk_orgs tablosunda yoksa otomatik ekle
  try {
    await executeSql(`
      INSERT INTO whitedesk_orgs (org_id, enterprise_blind_id, name, created_at)
      VALUES (${escapeSqlString(orgId)}, ${escapeSqlString(tenantBlindId)}, ${escapeSqlString(rawOrg)}, ${now})
      ON CONFLICT (org_id) DO NOTHING;
    `);
  } catch (err) {
    // console.warn('[wd] org insert notice:', err.message);
  }

  const hash = 'usr_div_' + randomBytes(24).toString('hex');

  await executeSql(`
    INSERT INTO whitedesk_recovery_hashes (hash, type, tenant_blind_id, org_id, app_id, used, created_at)
    VALUES (
      ${escapeSqlString(hash)},
      'user',
      ${escapeSqlString(tenantBlindId)},
      ${escapeSqlString(orgId)},
      ${escapeSqlString(appId || 'whitedesk')},
      FALSE,
      ${now}
    );
  `);

  console.log(`\n${C.bold}${C.green}[BAŞARILI] Şirket ve Alt Birim (Org) Kullanıcı Hash'i Üretildi:${C.reset}`);
  if (tenantName) console.log(`${C.dim}Şirket (Tenant) :${C.reset} ${C.bold}${tenantName}${C.reset} (${tenantBlindId})`);
  console.log(`${C.dim}Alt Birim (Org) :${C.reset} ${C.bold}${rawOrg}${C.reset} (org_id: ${orgId})`);
  console.log(`${C.dim}Uygulama (App)  :${C.reset} ${C.bold}${appId || 'whitedesk'}${C.reset}`);
  console.log(`\n${C.bold}${C.yellow}${hash}${C.reset}\n`);
  console.log(`Kullanım:`);
  console.log(`  - İlk kurulum ekranında "Hash / Kurtarma Kodum Var" kutusuna yapıştırarak`);
  console.log(`  - Veya ana ekrandaki QR tarayıcıya girerek/okutarak`);
  console.log(`Kullanıcı doğrudan ${tenantName || tenantBlindId} şirketinin "${rawOrg}" birimine bağlanır.\n`);

  return { hash, type: 'user', tenantBlindId, orgId, appId, created_at: now };
}

// ─── HELPERS FOR UI / API ───────────────────────────────────────────────────
async function listTenants() {
  const rows = await executeSql(
    `SELECT enterprise_blind_id, name, org_pub, is_founder_tenant, created_at 
     FROM whitedesk_enterprises ORDER BY created_at ASC;`
  );
  return rows;
}

async function listOrgs(tenantBlindId) {
  const where = tenantBlindId ? `WHERE enterprise_blind_id = ${escapeSqlString(tenantBlindId)}` : '';
  const rows = await executeSql(`SELECT org_id, enterprise_blind_id, name, created_at FROM whitedesk_orgs ${where};`);
  return rows;
}

async function listApps(tenantBlindId) {
  const where = tenantBlindId ? `WHERE enterprise_blind_id = ${escapeSqlString(tenantBlindId)}` : '';
  const apps = await executeSql(`SELECT app_id, enterprise_blind_id, name, description, is_active FROM whitedesk_apps ${where};`);
  const catRows = await executeSql(`SELECT category_id, enterprise_blind_id, org_id, app_id, scope_type, categories FROM whitedesk_categories WHERE is_active = TRUE;`);
  
  return apps.map((ap) => {
    const matchingRows = catRows.filter(c => c.app_id === ap.app_id || c.app_id === 'all');
    let cats = [];
    matchingRows.forEach(r => {
      const parsed = typeof r.categories === 'string' ? JSON.parse(r.categories) : (r.categories || []);
      if (Array.isArray(parsed)) cats.push(...parsed);
    });
    return {
      ...ap,
      categories: cats,
    };
  });
}

// ─── AUDIT & SERVICE MANAGEMENT ─────────────────────────────────────────────

async function getTenantAuditSummary() {
  const tenants = await listTenants();
  const allAdmins = await executeSql(`SELECT white_id, enterprise_blind_id, alias, role, org_id, app_id, categories, is_active, created_at FROM whitedesk_admins;`);
  const allOrgs = await executeSql(`SELECT org_id, enterprise_blind_id, name, created_at FROM whitedesk_orgs;`);
  const allApps = await executeSql(`SELECT app_id, enterprise_blind_id, name, description, is_active FROM whitedesk_apps;`);
  const allCatRows = await executeSql(`SELECT category_id, enterprise_blind_id, org_id, app_id, scope_type, categories FROM whitedesk_categories WHERE is_active = TRUE;`);
  const allUsers = await executeSql(`SELECT user_blind_id, tenant_blind_id, org_id, app_id, alias, status, created_at FROM whitedesk_user_bindings;`);
  const allApprovals = await executeSql(`SELECT id, type, tenant_blind_id, tenant_name, candidate_white_id, candidate_blind_id, candidate_alias, target_org_id, target_app_id, target_categories, status, requested_at FROM whitedesk_approvals WHERE status = 'pending' ORDER BY requested_at DESC;`);

  const summary = tenants.map((t) => {
    const tBlind = t.enterprise_blind_id;

    // Cosmos admin
    const cosmos = allAdmins.find(
      (a) =>
        a.enterprise_blind_id === tBlind &&
        (a.role === 'global_admin' || (t.is_founder_tenant && a.role === 'founder'))
    ) || null;

    // Admins for this tenant
    const tenantAdmins = allAdmins
      .filter((a) => a.enterprise_blind_id === tBlind && a.role === 'admin')
      .map((adm) => {
        let cats = [];
        try {
          cats = typeof adm.categories === 'string' ? JSON.parse(adm.categories) : (adm.categories || []);
        } catch (e) {
          cats = [];
        }
        return {
          ...adm,
          allocations: [{
            admin_white_id: adm.white_id,
            org_id: adm.org_id || 'default',
            app_id: adm.app_id || 'all',
            categories: Array.isArray(cats) ? cats : [cats],
          }],
        };
      });

    // Orgs
    const tenantOrgs = allOrgs.filter((o) => o.enterprise_blind_id === tBlind);

    // Apps & Categories
    const tenantApps = allApps
      .filter((ap) => ap.enterprise_blind_id === tBlind)
      .map((ap) => {
        const matchingCatRows = allCatRows.filter(
          (c) => (c.enterprise_blind_id === tBlind || c.enterprise_blind_id === 'default') && (c.app_id === ap.app_id || c.app_id === 'all')
        );
        let parsedCats = [];
        matchingCatRows.forEach((r) => {
          let list = [];
          try {
            list = typeof r.categories === 'string' ? JSON.parse(r.categories) : (r.categories || []);
          } catch (e) {
            list = [];
          }
          if (Array.isArray(list)) parsedCats.push(...list);
        });
        return {
          ...ap,
          parsed_categories: parsedCats,
        };
      });

    // Users
    const tenantUsers = allUsers.filter((u) => u.tenant_blind_id === tBlind);

    // Approvals
    const tenantApprovals = allApprovals.filter((ap) => ap.tenant_blind_id === tBlind);

    // Total categories count
    let totalCats = 0;
    tenantApps.forEach((ap) => {
      totalCats += ap.parsed_categories.length;
    });

    return {
      enterprise_blind_id: t.enterprise_blind_id,
      name: t.name,
      org_pub: t.org_pub,
      is_founder_tenant: !!t.is_founder_tenant,
      created_at: Number(t.created_at),
      cosmos,
      admins: tenantAdmins,
      adminsCount: tenantAdmins.length,
      orgs: tenantOrgs,
      apps: tenantApps,
      categoriesCount: totalCats,
      users: tenantUsers,
      usersCount: tenantUsers.length,
      pendingApprovals: tenantApprovals,
      pendingApprovalsCount: tenantApprovals.length,
    };
  });

  return summary;
}

async function getFounderAuditDetails() {
  const founderRows = await executeSql(
    `SELECT white_id, enterprise_blind_id, alias, role, is_active, created_at 
     FROM whitedesk_admins WHERE role = 'founder' LIMIT 1;`
  );
  const founderTenantRows = await executeSql(
    `SELECT enterprise_blind_id, name, org_pub, is_founder_tenant, created_at 
     FROM whitedesk_enterprises WHERE is_founder_tenant = TRUE LIMIT 1;`
  );
  const hashHistory = await executeSql(
    `SELECT hash, type, tenant_blind_id, used, used_at, used_by_blind_id, created_at 
     FROM whitedesk_recovery_hashes WHERE type = 'founder' ORDER BY created_at DESC LIMIT 15;`
  );

  return {
    founder: founderRows.length > 0 ? founderRows[0] : null,
    founderTenant: founderTenantRows.length > 0 ? founderTenantRows[0] : null,
    hashHistory,
  };
}

async function getCosmosAuditDetails(tenantBlindId) {
  if (!tenantBlindId) throw new Error('tenantBlindId required');

  const cosmosRows = await executeSql(
    `SELECT white_id, enterprise_blind_id, alias, role, is_active, created_at 
     FROM whitedesk_admins WHERE enterprise_blind_id = ${escapeSqlString(tenantBlindId)} AND role = 'global_admin' LIMIT 1;`
  );
  const hashHistory = await executeSql(
    `SELECT hash, type, tenant_blind_id, used, used_at, used_by_blind_id, created_at 
     FROM whitedesk_recovery_hashes WHERE tenant_blind_id = ${escapeSqlString(tenantBlindId)} AND type = 'global_admin' ORDER BY created_at DESC LIMIT 15;`
  );

  return {
    cosmos: cosmosRows.length > 0 ? cosmosRows[0] : null,
    hashHistory,
  };
}

async function getUserAuditDetails(tenantBlindId, orgId, appId) {
  if (!tenantBlindId) throw new Error('tenantBlindId required');

  let filter = `tenant_blind_id = ${escapeSqlString(tenantBlindId)}`;
  if (orgId && orgId !== 'all') filter += ` AND org_id = ${escapeSqlString(orgId)}`;
  if (appId && appId !== 'all') filter += ` AND app_id = ${escapeSqlString(appId)}`;

  const users = await executeSql(
    `SELECT user_blind_id, tenant_blind_id, org_id, app_id, alias, status, created_at 
     FROM whitedesk_user_bindings WHERE ${filter} ORDER BY created_at DESC;`
  );

  const hashHistory = await executeSql(
    `SELECT hash, type, tenant_blind_id, org_id, app_id, max_uses, uses_count, expires_at, used, used_at, created_at 
     FROM whitedesk_recovery_hashes WHERE tenant_blind_id = ${escapeSqlString(tenantBlindId)} AND type = 'user' ORDER BY created_at DESC LIMIT 20;`
  );

  return {
    users,
    hashHistory,
  };
}

// ─── MUTATIONS ───────────────────────────────────────────────────────────────

async function updateGlobalAdmin(tenantBlindId, adminBlindId, newAlias) {
  if (!tenantBlindId || !adminBlindId) throw new Error('tenantBlindId and adminBlindId required');
  const normId = generateBlindId(adminBlindId);
  await executeSql(`
    UPDATE whitedesk_admins 
    SET alias = ${escapeSqlString(newAlias || 'WhiteCosmos')} 
    WHERE enterprise_blind_id = ${escapeSqlString(tenantBlindId)} AND (white_id = ${escapeSqlString(normId)} OR blind_id = ${escapeSqlString(normId)});
  `);
  return { success: true };
}

async function deleteGlobalAdmin(tenantBlindId, adminBlindId) {
  if (!tenantBlindId || !adminBlindId) throw new Error('tenantBlindId and adminBlindId required');
  const normId = generateBlindId(adminBlindId);
  await executeSql(`
    DELETE FROM whitedesk_admins 
    WHERE enterprise_blind_id = ${escapeSqlString(tenantBlindId)} AND (white_id = ${escapeSqlString(normId)} OR blind_id = ${escapeSqlString(normId)});
  `);
  return { success: true };
}

async function addAdminToTenant(tenantBlindId, adminWhiteId, alias, appId = '*', orgId = 'default', categories = ['all']) {
  if (!tenantBlindId || !adminWhiteId) throw new Error('tenantBlindId and adminWhiteId required');
  const blindId = generateBlindId(adminWhiteId);
  const now = Date.now();
  const cleanAlias = alias || 'Admin';
  const catsJson = JSON.stringify(Array.isArray(categories) ? categories : ['all']);

  await executeSql(`
    INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, org_id, app_id, categories, is_active, created_at)
    VALUES (${escapeSqlString(blindId)}, ${escapeSqlString(blindId)}, ${escapeSqlString(tenantBlindId)}, ${escapeSqlString(cleanAlias)}, 'admin', ${escapeSqlString(orgId)}, ${escapeSqlString(appId)}, '${catsJson}'::jsonb, TRUE, ${now})
    ON CONFLICT (white_id) DO UPDATE SET 
      blind_id = EXCLUDED.blind_id,
      enterprise_blind_id = EXCLUDED.enterprise_blind_id, 
      alias = EXCLUDED.alias, 
      role = 'admin', 
      org_id = EXCLUDED.org_id, 
      app_id = EXCLUDED.app_id, 
      categories = EXCLUDED.categories, 
      is_active = TRUE;
  `);

  return { success: true, blindId };
}

async function deleteAdminFromTenant(tenantBlindId, adminBlindId) {
  if (!adminBlindId) throw new Error('adminBlindId required');
  const normId = generateBlindId(adminBlindId);
  await executeSql(`DELETE FROM whitedesk_admins WHERE white_id = ${escapeSqlString(normId)} OR blind_id = ${escapeSqlString(normId)};`);
  return { success: true };
}

async function updateAdminAllocations(adminBlindId, appId, orgId, categories) {
  if (!adminBlindId || !appId) throw new Error('adminBlindId and appId required');
  const normId = generateBlindId(adminBlindId);
  const catsJson = JSON.stringify(Array.isArray(categories) ? categories : ['all']);

  await executeSql(`
    UPDATE whitedesk_admins 
    SET org_id = ${escapeSqlString(orgId || 'default')}, 
        app_id = ${escapeSqlString(appId)}, 
        categories = '${catsJson}'::jsonb 
    WHERE white_id = ${escapeSqlString(normId)} OR blind_id = ${escapeSqlString(normId)};
  `);
  return { success: true };
}

async function addOrgToTenant(tenantBlindId, orgId, name) {
  if (!tenantBlindId || !orgId) throw new Error('tenantBlindId and orgId required');
  const now = Date.now();
  await executeSql(`
    INSERT INTO whitedesk_orgs (org_id, enterprise_blind_id, name, created_at)
    VALUES (${escapeSqlString(orgId.toLowerCase().trim())}, ${escapeSqlString(tenantBlindId)}, ${escapeSqlString(name || orgId)}, ${now})
    ON CONFLICT (org_id) DO NOTHING;
  `);
  return { success: true };
}

async function deleteOrgFromTenant(tenantBlindId, orgId) {
  if (!orgId) throw new Error('orgId required');
  await executeSql(`DELETE FROM whitedesk_orgs WHERE org_id = ${escapeSqlString(orgId)};`);
  return { success: true };
}

async function addCategoryToTenantApp(tenantBlindId, appId, catId, labelTr, labelEn) {
  if (!tenantBlindId || !appId || !catId) throw new Error('tenantBlindId, appId and catId required');
  const cleanCat = catId.toLowerCase().trim();
  const cleanApp = appId.toLowerCase().trim();

  await executeSql(`
    INSERT INTO whitedesk_categories (category_id, enterprise_blind_id, org_id, app_id, name_tr, name_en, is_active)
    VALUES (${escapeSqlString(cleanCat)}, ${escapeSqlString(tenantBlindId)}, 'default', ${escapeSqlString(cleanApp)}, ${escapeSqlString(labelTr || cleanCat)}, ${escapeSqlString(labelEn || cleanCat)}, TRUE)
    ON CONFLICT (category_id) DO UPDATE SET 
      enterprise_blind_id = EXCLUDED.enterprise_blind_id, 
      app_id = EXCLUDED.app_id, 
      name_tr = EXCLUDED.name_tr, 
      name_en = EXCLUDED.name_en, 
      is_active = TRUE;
  `);

  const rows = await executeSql(`SELECT category_id as id, category_id as key, name_tr as "labelTr", name_en as "labelEn" FROM whitedesk_categories WHERE app_id = ${escapeSqlString(cleanApp)} AND is_active = TRUE;`);
  return { success: true, categories: rows };
}

async function deleteCategoryFromTenantApp(tenantBlindId, appId, catId) {
  if (!appId || !catId) throw new Error('appId and catId required');
  const cleanCat = catId.toLowerCase().trim();
  const cleanApp = appId.toLowerCase().trim();

  await executeSql(`
    DELETE FROM whitedesk_categories WHERE category_id = ${escapeSqlString(cleanCat)} AND app_id = ${escapeSqlString(cleanApp)};
  `);

  const rows = await executeSql(`SELECT category_id as id, category_id as key, name_tr as "labelTr", name_en as "labelEn" FROM whitedesk_categories WHERE app_id = ${escapeSqlString(cleanApp)} AND is_active = TRUE;`);
  return { success: true, categories: rows };
}

async function setUserBindingStatus(userBlindId, status) {
  if (!userBlindId) throw new Error('userBlindId required');
  if (status === 'deleted') {
    await executeSql(`DELETE FROM whitedesk_user_bindings WHERE user_blind_id = ${escapeSqlString(userBlindId)};`);
  } else {
    await executeSql(`UPDATE whitedesk_user_bindings SET status = ${escapeSqlString(status)} WHERE user_blind_id = ${escapeSqlString(userBlindId)};`);
  }
  return { success: true };
}

async function createBatchUserHash(tenantBlindId, orgId, appId, maxUses = 1, expiresInHours = 72) {
  if (!tenantBlindId) throw new Error('tenantBlindId required');
  const hash = 'usr_div_' + randomBytes(24).toString('hex');
  const now = Date.now();
  const expiresAt = expiresInHours > 0 ? now + expiresInHours * 3600 * 1000 : null;

  await executeSql(`
    INSERT INTO whitedesk_recovery_hashes (
      hash, type, tenant_blind_id, org_id, app_id, used, max_uses, uses_count, expires_at, created_at
    ) VALUES (
      ${escapeSqlString(hash)},
      'user',
      ${escapeSqlString(tenantBlindId)},
      ${escapeSqlString(orgId || 'default')},
      ${escapeSqlString(appId || 'inwhite')},
      FALSE,
      ${Number(maxUses) || 1},
      0,
      ${expiresAt ? expiresAt : 'NULL'},
      ${now}
    );
  `);

  return {
    hash,
    type: 'user',
    tenantBlindId,
    orgId,
    appId,
    maxUses: Number(maxUses) || 1,
    expiresAt,
    created_at: now,
  };
}

async function reviewApprovalDirect(approvalId, approve, reviewer = 'Console Admin') {
  if (!approvalId) throw new Error('approvalId required');
  const now = Date.now();
  const status = approve ? 'approved' : 'rejected';

  const rows = await executeSql(`SELECT * FROM whitedesk_approvals WHERE id = ${Number(approvalId)} LIMIT 1;`);
  if (rows.length === 0) throw new Error('Approval not found');
  const appr = rows[0];

  await executeSql(`
    UPDATE whitedesk_approvals 
    SET status = ${escapeSqlString(status)}, reviewed_at = ${now}, reviewed_by = ${escapeSqlString(reviewer)}
    WHERE id = ${Number(approvalId)};
  `);

  if (approve) {
    const candBlindId = generateBlindId(appr.candidate_blind_id);
    if (appr.type === 'global_admin') {
      await executeSql(`
        INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, is_active, created_at)
        VALUES (${escapeSqlString(candBlindId)}, ${escapeSqlString(candBlindId)}, ${escapeSqlString(appr.tenant_blind_id)}, 'WhiteCosmos', 'global_admin', TRUE, ${now})
        ON CONFLICT (white_id) DO UPDATE SET blind_id = EXCLUDED.blind_id, role = 'global_admin', alias = 'WhiteCosmos', is_active = TRUE;
      `);
    } else if (appr.type === 'admin') {
      const alias = appr.candidate_alias || 'Admin';
      const orgId = appr.target_org_id || 'default';
      const appId = appr.target_app_id || 'all';
      const catsJson = JSON.stringify(appr.target_categories || ['all']);
      await executeSql(`
        INSERT INTO whitedesk_admins (white_id, blind_id, enterprise_blind_id, alias, role, org_id, app_id, categories, is_active, created_at)
        VALUES (${escapeSqlString(candBlindId)}, ${escapeSqlString(candBlindId)}, ${escapeSqlString(appr.tenant_blind_id)}, ${escapeSqlString(alias)}, 'admin', ${escapeSqlString(orgId)}, ${escapeSqlString(appId)}, '${catsJson}'::jsonb, TRUE, ${now})
        ON CONFLICT (white_id) DO UPDATE SET 
          blind_id = EXCLUDED.blind_id,
          role = 'admin', 
          alias = ${escapeSqlString(alias)}, 
          org_id = EXCLUDED.org_id, 
          app_id = EXCLUDED.app_id, 
          categories = EXCLUDED.categories, 
          is_active = TRUE;
      `);
    } else if (appr.type === 'user') {
      await executeSql(`
        INSERT INTO whitedesk_user_bindings (user_blind_id, tenant_blind_id, org_id, app_id, status, created_at)
        VALUES (${escapeSqlString(candBlindId)}, ${escapeSqlString(appr.tenant_blind_id)}, ${escapeSqlString(appr.target_org_id || 'default')}, ${escapeSqlString(appr.target_app_id || 'inwhite')}, 'approved', ${now})
        ON CONFLICT (user_blind_id) DO UPDATE SET status = 'approved', org_id = EXCLUDED.org_id, app_id = EXCLUDED.app_id;
      `);
    }
  }

  return { success: true, status };
}

function extractCliParam(args, rawStr, paramNames) {
  // 1. Check process.argv elements first (preserves quotes handled by shell)
  if (Array.isArray(args)) {
    for (const arg of args) {
      for (const name of paramNames) {
        const p1 = `${name}:`.toLowerCase();
        const p2 = `${name}=`.toLowerCase();
        const p3 = `--${name}=`.toLowerCase();
        const lower = arg.toLowerCase();
        if (lower.startsWith(p1)) return arg.slice(p1.length).replace(/^["']|["']$/g, '').trim();
        if (lower.startsWith(p2)) return arg.slice(p2.length).replace(/^["']|["']$/g, '').trim();
        if (lower.startsWith(p3)) return arg.slice(p3.length).replace(/^["']|["']$/g, '').trim();
      }
    }
  }

  // 2. Check raw string with strict boundaries
  for (const name of paramNames) {
    // Quoted value: (?:^|\s)(?:--)?name[:=]\s*["']([^"']+)["']
    const quotedMatch = rawStr.match(new RegExp(`(?:^|\\s)(?:--)?${name}[:=]\\s*["']([^"']+)["']`, 'i'));
    if (quotedMatch && quotedMatch[1]) return quotedMatch[1].trim();

    // Space-separated with flag: (?:^|\s)(?:--|-)${name}\\s+["']([^"']+)["']
    const flagQuotedMatch = rawStr.match(new RegExp(`(?:^|\\s)(?:--|-)${name}\\s+["']([^"']+)["']`, 'i'));
    if (flagQuotedMatch && flagQuotedMatch[1]) return flagQuotedMatch[1].trim();

    // Unquoted value: matches up to the next known flag or end of string
    // e.g. tenant:Whitechain org:Saha Ekibi -> captures "Saha Ekibi" if nothing follows, or up to next " xxx:"
    const unquotedMatch = rawStr.match(new RegExp(`(?:^|\\s)(?:--)?${name}[:=]\\s*([^"':]+?)(?=\\s+[a-z_]+:|$)`, 'i'));
    if (unquotedMatch && unquotedMatch[1]) return unquotedMatch[1].trim();
  }
  return null;
}

// ─── CLI PARSER ─────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const rawCmd = args.join(' ');
  const cmd = rawCmd.toLowerCase();

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`\n${C.bold}inWhite / WhiteDesk Sovereign CLI ("wd")${C.reset}`);
    console.log(`Kullanım:`);
    console.log(`  ${C.cyan}npm run wd run gen create${C.reset}                (Root Genesis başlat)`);
    console.log(`  ${C.cyan}npm run wd run tenant create org:"Atlas Global" app:"SupportDesk"${C.reset}`);
    console.log(`  ${C.cyan}npm run wd run hash founder${C.reset}              (TheWhite kurtarma hash'i)`);
    console.log(`  ${C.cyan}npm run wd run hash cosmos tenant:"Whitechain"${C.reset} (Global Admin hash'i)`);
    console.log(`  ${C.cyan}npm run wd run hash user tenant:"Whitechain" org:"Saha Ekibi"${C.reset} (Birim kullanıcısı)`);
    console.log(`  ${C.cyan}npm run wd blind <WHITE_ID>${C.reset}             (Blind ID hesapla)\n`);
    return;
  }

  if (cmd.includes('blind')) {
    const targetId = args[args.length - 1];
    if (!targetId || targetId === 'blind') {
      console.log('Lütfen bir White ID belirtin: npm run wd blind <WHITE_ID>');
      return;
    }
    console.log(`\n${C.dim}White ID :${C.reset} ${targetId}`);
    console.log(`${C.bold}Blind ID :${C.reset} ${C.green}${C.bold}${generateBlindId(targetId)}${C.reset}\n`);
    return;
  }

  if (cmd.includes('gen create') || cmd.includes('genesis')) {
    await startGenesis();
    return;
  }

  if (cmd.includes('tenant create')) {
    const tenantName = extractCliParam(args, rawCmd, ['org', 'tenant', 'name']) || 'Atlas Global Inc.';
    const appName = extractCliParam(args, rawCmd, ['app']) || 'SupportDesk';
    await createTenant({ tenantName, appName });
    return;
  }

  if (cmd.includes('hash founder') || cmd.includes('hash owner')) {
    await createFounderHash();
    return;
  }

  if (cmd.includes('hash cosmos')) {
    const tenants = await listTenants();
    if (tenants.length === 0) {
      console.error(`${C.red}[HATA] Sistemde kayıtlı tenant bulunamadı.${C.reset}`);
      return;
    }
    const tenantParam = extractCliParam(args, rawCmd, ['tenant', 't']);
    let tenant = tenants[0];
    if (tenantParam) {
      const searchName = tenantParam.trim().toLowerCase();
      const found = tenants.find(t => t.name.toLowerCase().includes(searchName) || t.enterprise_blind_id.toLowerCase().includes(searchName));
      if (found) tenant = found;
    }
    await createGlobalAdminHash(tenant.enterprise_blind_id);
    return;
  }

  if (cmd.includes('hash user')) {
    const tenants = await listTenants();
    if (tenants.length === 0) {
      console.error(`${C.red}[HATA] Sistemde kayıtlı tenant bulunamadı.${C.reset}`);
      return;
    }

    const tenantParam = extractCliParam(args, rawCmd, ['tenant', 't']);
    const orgParam = extractCliParam(args, rawCmd, ['org']);
    const appParam = extractCliParam(args, rawCmd, ['app']);

    let tenant = null;
    if (tenantParam) {
      const search = tenantParam.toLowerCase();
      tenant = tenants.find(t => t.name.toLowerCase().includes(search) || t.enterprise_blind_id.toLowerCase().includes(search));
    }
    if (!tenant) tenant = tenants[0];

    // Organizasyon (org): Verildiyse o organizasyon, verilmediyse varsayılan "Merkez"
    const rawOrg = orgParam || 'Merkez';
    const cleanApp = appParam ? appParam.toLowerCase() : 'whitedesk';

    await createUserDivisionalHash(tenant.enterprise_blind_id, rawOrg, cleanApp, tenant.name);
    return;
  }

  console.log(`Bilinmeyen komut. 'npm run wd --help' yazarak kılavuzu görebilirsiniz.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n${C.red}[HATA]${C.reset}`, err.message);
    process.exit(1);
  });
}

module.exports = {
  startGenesis,
  createTenant,
  createFounderHash,
  createGlobalAdminHash,
  createUserDivisionalHash,
  listTenants,
  listOrgs,
  listApps,
  generateBlindId,
  executeSql,
  getTenantAuditSummary,
  getFounderAuditDetails,
  getCosmosAuditDetails,
  getUserAuditDetails,
  updateGlobalAdmin,
  deleteGlobalAdmin,
  addAdminToTenant,
  deleteAdminFromTenant,
  updateAdminAllocations,
  addOrgToTenant,
  deleteOrgFromTenant,
  addCategoryToTenantApp,
  deleteCategoryFromTenantApp,
  setUserBindingStatus,
  createBatchUserHash,
  reviewApprovalDirect,
};
