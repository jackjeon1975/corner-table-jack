-- Corner Table schema (PostgreSQL). Idempotent: safe to run more than once.
-- Timestamps are ISO-8601 UTC strings (from Date#toISOString), which sort correctly as text.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  github_user_id BIGINT UNIQUE,
  handle TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  bio TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',          -- active | suspended | deleted
  is_dev BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_handle_ci ON users (lower(handle));

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
  recruiting BOOLEAN NOT NULL DEFAULT FALSE,
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
CREATE INDEX IF NOT EXISTS posts_feed ON posts (visibility, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS posts_project ON posts (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_author ON posts (author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS replies_post ON replies (post_id, created_at);
CREATE INDEX IF NOT EXISTS replies_author ON replies (author_id, created_at);

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
CREATE INDEX IF NOT EXISTS follows_user ON follows (user_id);

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
  ON memberships (project_id, user_id) WHERE status IN ('pending', 'approved');

CREATE TABLE IF NOT EXISTS needs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',            -- open | met
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,                      -- post | reply | project | url
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

-- Added 2026-11: "I'd use this" votes, what people can help with, email notifications.
-- lib/db.ts applies these same statements automatically on first use (see ADDITIVE_SCHEMA).
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_help TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_sent_at TEXT;
-- Added 2026-11: Google sign-in and two-step verification for /ops.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub ON users (google_sub) WHERE google_sub IS NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step BIGINT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mfa_at TEXT;

CREATE TABLE IF NOT EXISTS interests (
  post_id TEXT NOT NULL REFERENCES posts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS interests_recent ON interests (created_at);

-- The app connects server-side as the database owner, which bypasses RLS.
-- Enabling RLS with no policies blocks Supabase's public REST API (anon key)
-- from reading or writing any of these tables.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheers ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
