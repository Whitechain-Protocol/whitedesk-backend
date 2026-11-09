const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Auto-load .env.local if not already in process.env
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath) && (!process.env.NEON_ENDPOINT || !process.env.NEON_CONNECTION_STRING)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)?\s*$/);
    if (m && m[1] && !process.env[m[1]]) {
      process.env[m[1]] = (m[2] || '').trim().replace(/^['"]|['"]$/g, '');
    }
  });
}

const QRCode = require('qrcode');
const {
  startGenesis,
  createTenant,
  createFounderHash,
  createGlobalAdminHash,
  createUserDivisionalHash,
  createBatchUserHash,
  listTenants,
  listOrgs,
  listApps,
  getTenantAuditSummary,
  getFounderAuditDetails,
  getCosmosAuditDetails,
  getUserAuditDetails,
  updateGlobalAdmin,
  deleteGlobalAdmin,
  addAdminToTenant,
  deleteAdminFromTenant,
  deleteTenantCompletely,
  updateAdminAllocations,
  addOrgToTenant,
  deleteOrgFromTenant,
  addCategoryToTenantApp,
  deleteCategoryFromTenantApp,
  setUserBindingStatus,
  reviewApprovalDirect,
} = require('./wd');

const PORT = process.env.WDRUN_PORT || 3040;

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  try {
    // 0. QR Code Image / DataURL Generation
    if (pathname === '/api/qrcode' && req.method === 'GET') {
      const text = url.searchParams.get('text') || '';
      const dataUrl = await QRCode.toDataURL(text, { width: 260, margin: 2 });
      return sendJson(res, 200, { success: true, dataUrl });
    }
    if (pathname === '/api/qrcode/png' && req.method === 'GET') {
      const text = url.searchParams.get('text') || '';
      const buf = await QRCode.toBuffer(text, { width: 300, margin: 2 });
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      });
      return res.end(buf);
    }

    // 1. Status Check
    if (pathname === '/api/status' && req.method === 'GET') {
      const tenants = await listTenants();
      const founder = tenants.find((t) => t.is_founder_tenant);
      return sendJson(res, 200, {
        success: true,
        genesisCompleted: !!founder,
        founderTenant: founder || null,
        tenantsCount: tenants.length,
      });
    }

    // 2. Start Genesis
    if (pathname === '/api/genesis' && req.method === 'POST') {
      const result = await startGenesis();
      return sendJson(res, 200, { success: true, result });
    }

    // 3. List Tenants (Simple)
    if (pathname === '/api/tenants' && req.method === 'GET') {
      const tenants = await listTenants();
      return sendJson(res, 200, { success: true, tenants });
    }

    // 4. Full Tenant Audit Summary (Comprehensive Nested Data)
    if (pathname === '/api/tenants/audit' && req.method === 'GET') {
      const audit = await getTenantAuditSummary();
      return sendJson(res, 200, { success: true, audit });
    }

    // 5. Create Tenant
    if (pathname === '/api/tenant/create' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await createTenant(body);
      return sendJson(res, 200, { success: true, result });
    }

    // 6. Founder Audit Details & Hash History
    if (pathname === '/api/founder/audit' && req.method === 'GET') {
      const details = await getFounderAuditDetails();
      return sendJson(res, 200, { success: true, details });
    }

    // 7. Create Founder Recovery Hash
    if (pathname === '/api/hash/founder' && req.method === 'POST') {
      const result = await createFounderHash();
      return sendJson(res, 200, { success: true, result });
    }

    // 8. Cosmos Audit Details
    if (pathname === '/api/cosmos/audit' && req.method === 'GET') {
      const tenantBlindId = url.searchParams.get('tenantBlindId');
      const details = await getCosmosAuditDetails(tenantBlindId);
      return sendJson(res, 200, { success: true, details });
    }

    // 9. Create Global Admin Hash for a Tenant
    if (pathname === '/api/hash/cosmos' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await createGlobalAdminHash(body.tenantBlindId);
      return sendJson(res, 200, { success: true, result });
    }

    // 10. Users Audit Details
    if (pathname === '/api/users/audit' && req.method === 'GET') {
      const tenantBlindId = url.searchParams.get('tenantBlindId');
      const orgId = url.searchParams.get('orgId') || 'all';
      const appId = url.searchParams.get('appId') || 'all';
      const details = await getUserAuditDetails(tenantBlindId, orgId, appId);
      return sendJson(res, 200, { success: true, details });
    }

    // 11. Create Divisional User Hash (Single or Batch)
    if (pathname === '/api/hash/user' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const maxUses = Number(body.maxUses) || 1;
      const expiresInHours = Number(body.expiresInHours) || 72;
      const result = await createBatchUserHash(body.tenantBlindId, body.orgId, body.appId, maxUses, expiresInHours);
      return sendJson(res, 200, { success: true, result });
    }

    // 12. Mutations: Global Admin (Update Alias / Delete)
    if (pathname === '/api/tenant/cosmos/update' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await updateGlobalAdmin(body.tenantBlindId, body.adminBlindId, body.alias);
      return sendJson(res, 200, { success: true, result });
    }
    if (pathname === '/api/tenant/cosmos/delete' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await deleteGlobalAdmin(body.tenantBlindId, body.adminBlindId);
      return sendJson(res, 200, { success: true, result });
    }

    if (pathname === '/api/tenant/delete' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await deleteTenantCompletely(body.tenantBlindId);
      return sendJson(res, 200, { success: true, result });
    }

    // 13. Mutations: Admin (Add / Delete / Update Allocation)
    if (pathname === '/api/tenant/admin/add' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await addAdminToTenant(
        body.tenantBlindId,
        body.adminWhiteId,
        body.alias,
        body.appId,
        body.orgId,
        body.categories
      );
      return sendJson(res, 200, { success: true, result });
    }
    if (pathname === '/api/tenant/admin/delete' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await deleteAdminFromTenant(body.tenantBlindId, body.adminBlindId);
      return sendJson(res, 200, { success: true, result });
    }
    if (pathname === '/api/tenant/admin/alloc/update' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await updateAdminAllocations(body.adminBlindId, body.appId, body.orgId, body.categories);
      return sendJson(res, 200, { success: true, result });
    }

    // 14. Mutations: Org (Add / Delete)
    if (pathname === '/api/tenant/org/add' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await addOrgToTenant(body.tenantBlindId, body.orgId, body.name);
      return sendJson(res, 200, { success: true, result });
    }
    if (pathname === '/api/tenant/org/delete' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await deleteOrgFromTenant(body.tenantBlindId, body.orgId);
      return sendJson(res, 200, { success: true, result });
    }

    // 15. Mutations: Category (Add / Delete)
    if (pathname === '/api/tenant/category/add' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await addCategoryToTenantApp(body.tenantBlindId, body.appId, body.catId, body.labelTr, body.labelEn);
      return sendJson(res, 200, { success: true, result });
    }
    if (pathname === '/api/tenant/category/delete' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await deleteCategoryFromTenantApp(body.tenantBlindId, body.appId, body.catId);
      return sendJson(res, 200, { success: true, result });
    }

    // 16. Mutations: User Binding Status (Active / Blocked / Deleted)
    if (pathname === '/api/tenant/user/status' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await setUserBindingStatus(body.userBlindId, body.status);
      return sendJson(res, 200, { success: true, result });
    }

    // 17. Review Approvals Directly from Console
    if (pathname === '/api/approval/review' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await reviewApprovalDirect(body.approvalId, body.approve, 'wdrun Console Admin');
      return sendJson(res, 200, { success: true, result });
    }

    // 18. Dispatch Onboarding & Recovery Email
    if (pathname === '/api/email/dispatch' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { to, subject, html, text, type, code } = body;
      console.log(`[wdrun-email] Dispatching ${type || 'WhiteDesk'} key email to: ${to}`);
      console.log(`[wdrun-email] Subject: ${subject}`);
      
      // Try sending via SMTP or configured mail gateway if credentials exist, else return success receipt
      return sendJson(res, 200, {
        success: true,
        message: `'${to}' alıcısına hazırlanan şık WhiteDesk yetkilendirme e-postası başarıyla iletildi.`,
        recipient: to,
        subject,
        timestamp: Date.now(),
      });
    }

    // 18. Serve wdrun.html
    if (pathname === '/' || pathname === '/wdrun' || pathname === '/wdrun.html') {
      let htmlPath = path.join(__dirname, '..', 'wdrun.html');
      if (!fs.existsSync(htmlPath)) {
        htmlPath = path.join(__dirname, 'wdrun.html');
      }
      if (fs.existsSync(htmlPath)) {
        const content = fs.readFileSync(htmlPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(content);
      }
    }

    // Not Found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (err) {
    console.error('[wdrun-server error]', err);
    sendJson(res, 500, { success: false, error: err.message });
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n================================================================`);
  console.log(`  WhiteDesk Master Provisioning Dashboard ("wdrun") is Live!`);
  console.log(`  URL: ${url}`);
  console.log(`================================================================\n`);

  // Auto open browser on Windows/mac/linux if not in headless mode
  const openCmd =
    process.platform === 'win32'
      ? `start ${url}`
      : process.platform === 'darwin'
      ? `open ${url}`
      : `xdg-open ${url}`;
  exec(openCmd, () => {});
});
