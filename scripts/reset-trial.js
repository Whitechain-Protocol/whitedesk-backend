const endpoint = 'https://api.whitedesk.one/api/d1/query';

async function resetToTrial() {
  const now = Date.now();
  const trialEnd = now + 14 * 24 * 60 * 60 * 1000;
  const query = `
    UPDATE whitedesk_enterprises
    SET plan_id = 'trial',
        billing_cycle = 'monthly',
        subscription_start_at = '${new Date(now).toISOString()}',
        subscription_end_at = '${new Date(trialEnd).toISOString()}'
    WHERE enterprise_blind_id = 'ent_0886b59ce073';
  `;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  console.log('Reset result:', await res.json());
}

resetToTrial().catch(console.error);
