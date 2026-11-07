const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const NEON_ENDPOINT = process.env.EXPO_PUBLIC_NEON_ENDPOINT || process.env.NEON_ENDPOINT;
const NEON_CONNECTION_STRING = process.env.EXPO_PUBLIC_NEON_CONNECTION_STRING || process.env.NEON_CONNECTION_STRING;

if (!NEON_ENDPOINT || !NEON_CONNECTION_STRING) {
  console.error('Missing NEON env vars');
  process.exit(1);
}

function escapeSqlString(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function executeSql(query) {
  const res = await fetch(NEON_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': NEON_CONNECTION_STRING,
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`[Neon SQL HTTP ${res.status}] ${txt}`);
  }
  const data = await res.json();
  return Array.isArray(data.rows) ? data.rows : [];
}

async function main() {
  const targetDir = path.join(__dirname, '..', 'admin_qr');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 1. Fetch tenants
  const enterprises = await executeSql(
    `SELECT enterprise_blind_id, name FROM whitedesk_enterprises ORDER BY created_at ASC;`
  );

  const nexusTenant = enterprises.find(e => e.name && e.name.toLowerCase().includes('nexus')) || {
    enterprise_blind_id: 'ent_0886b59ce073',
    name: 'Nexus',
  };

  const whitechainTenant = enterprises.find(e => e.name && e.name.toLowerCase() === 'whitechain') || {
    enterprise_blind_id: 'ent_1fc4c76b722c',
    name: 'Whitechain',
  };

  console.log('Nexus Tenant ID:', nexusTenant.enterprise_blind_id);
  console.log('Whitechain Tenant ID:', whitechainTenant.enterprise_blind_id);

  const targets = [
    {
      name: 'Nexus',
      filenamePrefix: 'NEXUS_GLOBAL_ADMIN',
      tenantId: nexusTenant.enterprise_blind_id,
      passkey: 'wd_prof_nexus_cosmos_8294f41df521235d198ce4a0635b9e12',
      color: '#4f46e5',
      badge: 'NEXUS COSMOS'
    },
    {
      name: 'Whitechain',
      filenamePrefix: 'WHITECHAIN_GLOBAL_ADMIN',
      tenantId: whitechainTenant.enterprise_blind_id,
      passkey: 'wd_prof_whitechain_cosmos_5970c1e82847a92b347fd01b7a2d48c9',
      color: '#059669',
      badge: 'WHITECHAIN COSMOS'
    }
  ];

  const now = Date.now();

  for (const t of targets) {
    // Upsert into whitedesk_recovery_hashes with unlimited usage (999999) & no expiration
    await executeSql(`
      INSERT INTO whitedesk_recovery_hashes (
        hash, type, tenant_blind_id, org_id, app_id, max_uses, uses_count, used, created_at, expires_at
      ) VALUES (
        ${escapeSqlString(t.passkey)},
        'global_admin',
        ${escapeSqlString(t.tenantId)},
        'merkez',
        'whitedesk',
        999999,
        0,
        FALSE,
        ${now},
        NULL
      )
      ON CONFLICT (hash) DO UPDATE SET 
        type = 'global_admin',
        tenant_blind_id = EXCLUDED.tenant_blind_id,
        max_uses = 999999,
        used = FALSE,
        expires_at = NULL;
    `);

    // Generate PNG QR
    const pngPath = path.join(targetDir, `${t.filenamePrefix}_QR.png`);
    await QRCode.toFile(pngPath, t.passkey, {
      type: 'png',
      width: 600,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H'
    });

    console.log(`Saved: ${pngPath}`);
  }

  // Generate README.txt
  const readmeContent = `========================================================================
WHITEDESK - KALICI KÜRESEL YÖNETİCİ (GLOBAL ADMIN) SOVEREIGN PASSKEY'LER
========================================================================

Bu klasördeki QR kodlar ve claim kodları SÜRESİZDİR ve 999.999 KEZ kullanılabilir.
Dilediğiniz zaman telefonunuzdan (S24, Tablet vb.) okutarak veya bilet kutusuna
yazarak firmalar arasında ANINDA ve SIFIR ONAYLA geçiş yapabilirsiniz.

------------------------------------------------------------------------
1. NEXUS KÜRESEL YÖNETİCİSİ (GLOBAL ADMIN)
------------------------------------------------------------------------
* Şirket Adı        : Nexus
* Şirket Blind ID   : ${nexusTenant.enterprise_blind_id}
* QR Kod Dosyası    : NEXUS_GLOBAL_ADMIN_QR.png
* Kalıcı Kod        : ${targets[0].passkey}
* Bilet Kutusu Komutu:
  admin ${targets[0].passkey}

------------------------------------------------------------------------
2. WHITECHAIN KÜRESEL YÖNETİCİSİ (GLOBAL ADMIN)
------------------------------------------------------------------------
* Şirket Adı        : Whitechain
* Şirket Blind ID   : ${whitechainTenant.enterprise_blind_id}
* QR Kod Dosyası    : WHITECHAIN_GLOBAL_ADMIN_QR.png
* Kalıcı Kod        : ${targets[1].passkey}
* Bilet Kutusu Komutu:
  admin ${targets[1].passkey}

------------------------------------------------------------------------
KULLANIM YÖNTEMLERİ:
------------------------------------------------------------------------
Yöntem A (Kamera / QR ile):
  1. WhiteDesk uygulamasında sağ üst menüden 'Tara' (Scanner) simgesine basın.
  2. Bu klasördeki 'NEXUS_GLOBAL_ADMIN_QR.png' veya 'WHITECHAIN_GLOBAL_ADMIN_QR.png'
     görselini (veya index.html sayfasını açarak) telefon kamerasıyla okutun.
  3. 'Destek Masasına Geç' butonuna bastığınız anda tek tıkla yetkilenirsiniz.

Yöntem B (Bilet / Arama Kutusundan):
  1. WhiteDesk uygulamasında bilet yazma veya mesaj kutusuna şunu yazıp gönderin:
     admin wd_prof_nexus_cosmos_8294f41df521235d198ce4a0635b9e12
     (Whitechain için: admin wd_prof_whitechain_cosmos_5970c1e82847a92b347fd01b7a2d48c9)
  2. Sistem anında sizi ilgili şirketin Küresel Yöneticisi yapar.

İzolasyon Güvencesi:
  * Nexus'a geçtiğinizde telsiz ve bildirim kanalları Nexus'a kilitlenir.
  * Whitechain'e geçtiğinizde Whitechain'e kilitlenir.
  * Şirketler arası ses veya bildirim sızıntısı asla gerçekleşmez.
========================================================================
`;
  fs.writeFileSync(path.join(targetDir, 'README.txt'), readmeContent, 'utf8');

  // Also generate an HTML file for convenient viewing/scanning
  const nexusDataUrl = await QRCode.toDataURL(targets[0].passkey, { width: 380, margin: 2, errorCorrectionLevel: 'H' });
  const whitechainDataUrl = await QRCode.toDataURL(targets[1].passkey, { width: 380, margin: 2, errorCorrectionLevel: 'H' });

  const htmlContent = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhiteDesk - Kalıcı Küresel Yönetici QR Kartları</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      padding: 30px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
      color: #ffffff;
    }
    p.subtitle {
      font-size: 14px;
      color: #94a3b8;
      margin-bottom: 28px;
      text-align: center;
      max-width: 600px;
    }
    .grid {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      justify-content: center;
      max-width: 900px;
      width: 100%;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 400px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4);
    }
    .badge {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 12px;
      text-transform: uppercase;
    }
    .badge-nexus { background: #312e81; color: #a5b4fc; border: 1px solid #4338ca; }
    .badge-whitechain { background: #064e3b; color: #6ee7b7; border: 1px solid #047857; }
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 4px;
    }
    .tenant-id {
      font-family: monospace;
      font-size: 11px;
      color: #64748b;
      margin-bottom: 18px;
    }
    .qr-container {
      background: #ffffff;
      padding: 14px;
      border-radius: 14px;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 18px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .qr-container img {
      display: block;
      width: 280px;
      height: 280px;
    }
    .code-box {
      width: 100%;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 10px 12px;
      font-family: monospace;
      font-size: 11px;
      color: #cbd5e1;
      word-break: break-all;
      margin-bottom: 12px;
      line-height: 1.4;
      user-select: all;
    }
    .btn {
      width: 100%;
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 10px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn:hover { background: #1d4ed8; }
    .footer-note {
      margin-top: 32px;
      font-size: 12px;
      color: #64748b;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <h1>WhiteDesk Kalıcı Küresel Yönetici Anahtarları</h1>
  <p class="subtitle">Bu QR kodları süresiz ve sınırsız kullanımlıdır. Telefonunuzun kamerası veya bilet kutusu ile anında ve onaysız olarak firmalar arasında geçiş yapabilirsiniz.</p>

  <div class="grid">
    <!-- Nexus Card -->
    <div class="card">
      <span class="badge badge-nexus">KÜRESEL YÖNETİCİ</span>
      <div class="title">Nexus</div>
      <div class="tenant-id">${nexusTenant.enterprise_blind_id}</div>
      <div class="qr-container">
        <img src="${nexusDataUrl}" alt="Nexus Global Admin QR">
      </div>
      <div class="code-box" id="nexus-code">${targets[0].passkey}</div>
      <button class="btn" onclick="navigator.clipboard.writeText('admin ${targets[0].passkey}'); alert('Nexus bilet komutu kopyalandı! Bilet kutusuna yapıştırabilirsiniz.');">Kodu Kopyala (admin ...)</button>
    </div>

    <!-- Whitechain Card -->
    <div class="card">
      <span class="badge badge-whitechain">KÜRESEL YÖNETİCİ</span>
      <div class="title">Whitechain</div>
      <div class="tenant-id">${whitechainTenant.enterprise_blind_id}</div>
      <div class="qr-container">
        <img src="${whitechainDataUrl}" alt="Whitechain Global Admin QR">
      </div>
      <div class="code-box" id="whitechain-code">${targets[1].passkey}</div>
      <button class="btn" onclick="navigator.clipboard.writeText('admin ${targets[1].passkey}'); alert('Whitechain bilet komutu kopyalandı! Bilet kutusuna yapıştırabilirsiniz.');">Kodu Kopyala (admin ...)</button>
    </div>
  </div>

  <div class="footer-note">
    ⚡ <b>Sıfır Onay & Anında Yetkilendirme:</b> Her okutmada otomatik olarak Global Admin rolü aktif edilir ve PTT telsiz / push bildirim frekansı tamamen ilgili şirkete izole edilir.
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(targetDir, 'index.html'), htmlContent, 'utf8');
  console.log('Generated index.html and README.txt successfully in admin_qr folder!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
