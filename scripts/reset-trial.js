const endpoint = 'https://ep-red-river-b2xdk16j-pooler.c-6.eu-central-1.aws.neon.tech/sql';
const conn = 'postgresql://neondb_owner:npg_DbxBS3NtQK1c@ep-red-river-b2xdk16j-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function resetToTrial() {
  const now = Date.now();
  const trialEnd = now + 14 * 24 * 60 * 60 * 1000;
  const query = `
    UPDATE whitedesk_tenant_licenses 
    SET plan_id = 'trial', status = 'trialing', trial_start_at = TO_TIMESTAMP(${now / 1000}), trial_end_at = TO_TIMESTAMP(${trialEnd / 1000}), updated_at = NOW()
    WHERE enterprise_blind_id = 'ent_0886b59ce073';
  `;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': conn },
    body: JSON.stringify({ query })
  });
  console.log('Reset result:', await res.json());
}

resetToTrial().catch(console.error);
