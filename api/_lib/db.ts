import { neon, neonConfig } from '@neondatabase/serverless';

// Vercel serverless functions için optimize edilmiş Neon SQL istemcisi
neonConfig.fetchConnectionCache = true;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }
  return neon(connectionString);
}
