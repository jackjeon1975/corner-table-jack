import { Pool, type PoolClient } from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

// All persistence goes through this module. Queries are written with `?`
// placeholders and converted to Postgres `$n` parameters here.
// Schema lives in db/schema.sql and is applied with `npm run db:migrate`.

type Param = string | number | boolean | null;

/** Supabase root CA from DATABASE_CA_CERT (PEM, PEM with literal "\\n", or base64). */
function caCert(): string | undefined {
  const raw = process.env.DATABASE_CA_CERT?.trim();
  if (!raw) return undefined;
  const text = raw.startsWith('-----BEGIN') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  return text.replace(/\\n/g, '\n').trim();
}

function sslOption(url: string) {
  const mode = process.env.DATABASE_SSL;
  if (mode === 'disable') return false;
  if (mode === 'no-verify') return { rejectUnauthorized: false };
  const ca = caCert();
  if (ca) return { ca, rejectUnauthorized: true };
  try {
    const host = new URL(url).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return false;
  } catch {}
  return true;
}

const g = globalThis as unknown as { __ctpool?: Pool };

function pool(): Pool {
  if (!g.__ctpool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    g.__ctpool = new Pool({
      connectionString: url,
      ssl: sslOption(url),
      max: Number(process.env.DATABASE_POOL_MAX || 5),
      idleTimeoutMillis: 10_000,
    });
  }
  return g.__ctpool;
}

const txClient = new AsyncLocalStorage<PoolClient>();

/** Convert `?` placeholders to `$1, $2, …` (our SQL never uses `?` inside literals). */
function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function query(sql: string, params: Param[]) {
  const client = txClient.getStore();
  return (client ?? pool()).query(toPg(sql), params);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function one<T = any>(sql: string, ...params: Param[]): Promise<T | undefined> {
  const r = await query(sql, params);
  return r.rows[0] as T | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function all<T = any>(sql: string, ...params: Param[]): Promise<T[]> {
  const r = await query(sql, params);
  return r.rows as T[];
}

export async function run(sql: string, ...params: Param[]): Promise<{ changes: number }> {
  const r = await query(sql, params);
  return { changes: r.rowCount ?? 0 };
}

/** Run fn inside a transaction. one/all/run called within fn use the same connection. Never call redirect() inside fn. */
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const result = await txClient.run(client, fn);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();

export async function audit(actorId: string | null, action: string, targetType: string, targetId: string, reason = '') {
  await run(
    'INSERT INTO audit_log (id, actor_id, action, target_type, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    newId(), actorId, action, targetType, targetId, reason, now(),
  );
}
