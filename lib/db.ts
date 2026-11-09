import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// All persistence goes through this module so the store can later be swapped
// for Postgres (e.g. Supabase) without touching pages or actions.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  github_user_id INTEGER UNIQUE,
  handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT,
  avatar_url TEXT,
  bio TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',          -- active | suspended | deleted
  is_dev INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  origin_post_id TEXT NOT NULL UNIQUE,
  leader_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  concept TEXT NOT NULL,
  first_goal TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'concept',          -- concept | design | building | shared | paused | ended
  recruiting INTEGER NOT NULL DEFAULT 0,
  repo_url TEXT,
  result_url TEXT,
  continued_from TEXT REFERENCES projects(id),
  visibility TEXT NOT NULL DEFAULT 'public',     -- public | hidden
  last_update_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  kind TEXT NOT NULL,                             -- note | idea | question | risk | update | help | retro
  body TEXT NOT NULL,
  link_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',     -- public | deleted | hidden
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_feed ON posts(visibility, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS posts_project ON posts(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_author ON posts(author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS replies_post ON replies(post_id, created_at);

CREATE TABLE IF NOT EXISTS cheers (
  post_id TEXT NOT NULL REFERENCES posts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS follows (
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,                           -- pending | approved | declined | withdrawn | left | removed
  decided_at TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_active
  ON memberships(project_id, user_id) WHERE status IN ('pending', 'approved');

CREATE TABLE IF NOT EXISTS needs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',            -- open | met
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,                      -- post | reply | project
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,                           -- spam | rights | dangerous | other
  details TEXT NOT NULL DEFAULT '',
  reporter_id TEXT REFERENCES users(id),
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'open',            -- open | actioned | dismissed
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
`;

const g = globalThis as unknown as { __ctdb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__ctdb) {
    const file = process.env.DB_PATH || path.join(process.cwd(), 'data', 'corner-table.db');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const d = new DatabaseSync(file);
    d.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    d.exec(SCHEMA);
    g.__ctdb = d;
  }
  return g.__ctdb;
}

type Param = string | number | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function one<T = any>(sql: string, ...params: Param[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function all<T = any>(sql: string, ...params: Param[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}

export function run(sql: string, ...params: Param[]) {
  return db().prepare(sql).run(...params);
}

/** Run fn inside a write transaction. Never call redirect() inside fn. */
export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    d.exec('COMMIT');
    return result;
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}

export const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();

export function audit(actorId: string | null, action: string, targetType: string, targetId: string, reason = '') {
  run(
    'INSERT INTO audit_log (id, actor_id, action, target_type, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    newId(), actorId, action, targetType, targetId, reason, now(),
  );
}
