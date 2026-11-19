const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const envPath = path.join(__dirname, '.env');
const env = { ...process.env };

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) env[key] = val;
  }
}

const wranglerBin = path.join(
  __dirname,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'
);

const args = process.argv.slice(2);
const result = spawnSync(wranglerBin, args, {
  cwd: __dirname,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 0);
