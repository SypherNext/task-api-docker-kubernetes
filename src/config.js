import { readFileSync } from 'node:fs';

// Read a secret from NAME_FILE (a mounted file) first, then from NAME (an env var).
function readSecret(name) {
  const file = process.env[`${name}_FILE`];
  if (file) return readFileSync(file, 'utf8').trim();
  return process.env[name];
}

function dbConfig() {
  if (!process.env.DB_HOST) return null; // no database configured: use the in-memory store
  const password = readSecret('DB_PASSWORD');
  if (!password) throw new Error('DB_PASSWORD or DB_PASSWORD_FILE must be set when DB_HOST is set');
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'tasks',
    password,
    database: process.env.DB_NAME ?? 'tasks',
  };
}

export function loadConfig() {
  return {
    port: Number(process.env.PORT ?? 3000),
    version: process.env.APP_VERSION ?? '1.1.0',
    db: dbConfig(),
  };
}
