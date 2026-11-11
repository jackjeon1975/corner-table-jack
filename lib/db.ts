import { Pool, type PoolClient } from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

// All persistence goes through this module. Queries are written with `?`
// placeholders and converted to Postgres `$n` parameters here.
// Schema lives in db/schema.sql (`npm run db:migrate`); later additive changes also apply themselves (ADDITIVE_SCHEMA).

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

// Additive, idempotent schema changes added after launch. Applied once per server
// instance under an advisory lock, so a new feature never needs a manual SQL step.
// Keep in sync with db/schema.sql. Only ever ADD here (columns with defaults, new tables).
const ADDITIVE_SCHEMA = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS can_help TEXT NOT NULL DEFAULT '';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT TRUE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_sent_at TEXT;
  CREATE TABLE IF NOT EXISTS interests (
    post_id TEXT NOT NULL REFERENCES posts(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    PRIMARY KEY (post_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS interests_recent ON interests (created_at);
  ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub ON users (google_sub) WHERE google_sub IS NOT NULL;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step BIGINT;
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mfa_at TEXT;
  ALTER TABLE posts ADD COLUMN IF NOT EXISTS offer TEXT;
  ALTER TABLE posts ADD COLUMN IF NOT EXISTS seek TEXT;
  ALTER TABLE posts ADD COLUMN IF NOT EXISTS link_title TEXT;
  ALTER TABLE posts ADD COLUMN IF NOT EXISTS link_desc TEXT;
  ALTER TABLE posts ADD COLUMN IF NOT EXISTS link_site TEXT;
  CREATE INDEX IF NOT EXISTS posts_kind ON posts (kind, created_at DESC);
`;
// One marker per batch of ADDITIVE_SCHEMA changes; when all exist, nothing runs.
const SCHEMA_MARKERS: [string, string][] = [['users', 'digest_sent_at'], ['interests', 'post_id'], ['sessions', 'mfa_at'], ['posts', 'link_site']];
const SCHEMA_MARK = `SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = current_schema() AND (${SCHEMA_MARKERS.map(
  ([t, c]) => `(table_name = '${t}' AND column_name = '${c}')`,
).join(' OR ')})`;

const gs = globalThis as unknown as { __ctschema?: Promise<void> };

function ensureSchema(): Promise<void> {
  if (!gs.__ctschema) {
    gs.__ctschema = (async () => {
      const client = await pool().connect();
      try {
        const r = await client.query(SCHEMA_MARK);
        if (Number(r.rows[0]?.n) >= SCHEMA_MARKERS.length) return;
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(4207191)');
        await client.query(ADDITIVE_SCHEMA);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        gs.__ctschema = undefined; // retry on the next request
        throw e;
      } finally {
        client.release();
      }
    })();
  }
  return gs.__ctschema;
}

const txClient = new AsyncLocalStorage<PoolClient>();

/** Convert `?` placeholders to `$1, $2, …` (our SQL never uses `?` inside literals). */
function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function query(sql: string, params: Param[]) {
  const client = txClient.getStore();
  if (!client) await ensureSchema();
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
  await ensureSchema();
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
