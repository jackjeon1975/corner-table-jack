import { all, one } from './db';
import type { User } from './auth';

export type PostRow = {
  id: string;
  author_id: string;
  project_id: string | null;
  kind: string;
  body: string;
  link_url: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
  handle: string;
  avatar_url: string | null;
  project_title: string | null;
  project_stage: string | null;
  reply_count: number;
  cheer_count: number;
  cheered: boolean;
  started_project_id: string | null;
};

const POST_SELECT = `
  SELECT p.*, u.handle, u.avatar_url,
    pr.title AS project_title, pr.stage AS project_stage,
    (SELECT COUNT(*)::int FROM replies r WHERE r.post_id = p.id AND r.visibility = 'public') AS reply_count,
    (SELECT COUNT(*)::int FROM cheers c WHERE c.post_id = p.id) AS cheer_count,
    EXISTS (SELECT 1 FROM cheers c WHERE c.post_id = p.id AND c.user_id = ?) AS cheered,
    (SELECT id FROM projects sp WHERE sp.origin_post_id = p.id) AS started_project_id
  FROM posts p
  JOIN users u ON u.id = p.author_id
  LEFT JOIN projects pr ON pr.id = p.project_id
`;

// One public rule for feed, search, project pages and direct links.
const PUBLIC = `p.visibility = 'public' AND (p.project_id IS NULL OR pr.visibility = 'public')`;

export const PAGE_SIZE = 20;

function cursorClause(before?: string) {
  if (!before) return { sql: '', params: [] as string[] };
  const i = before.lastIndexOf('_');
  if (i < 0) return { sql: '', params: [] as string[] };
  const t = before.slice(0, i);
  const id = before.slice(i + 1);
  return { sql: ' AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))', params: [t, t, id] };
}

export const cursorOf = (p: { created_at: string; id: string }) => `${p.created_at}_${p.id}`;

export async function feed(opts: { me: User | null; tab: 'latest' | 'following'; before?: string }): Promise<PostRow[]> {
  const c = cursorClause(opts.before);
  const me = opts.me?.id ?? '';
  if (opts.tab === 'following') {
    return all<PostRow>(
      `${POST_SELECT} WHERE ${PUBLIC}
        AND p.project_id IN (SELECT project_id FROM follows WHERE user_id = ?)${c.sql}
       ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
      me, me, ...c.params, PAGE_SIZE,
    );
  }
  return all<PostRow>(
    `${POST_SELECT} WHERE ${PUBLIC}${c.sql} ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
    me, ...c.params, PAGE_SIZE,
  );
}

export async function projectPosts(projectId: string, me: User | null, kinds?: string[], before?: string): Promise<PostRow[]> {
  const c = cursorClause(before);
  const kindSql = kinds?.length ? ` AND p.kind IN (${kinds.map(() => '?').join(',')})` : '';
  return all<PostRow>(
    `${POST_SELECT} WHERE ${PUBLIC} AND (p.project_id = ? OR p.id = (SELECT origin_post_id FROM projects WHERE id = ?))${kindSql}${c.sql}
     ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
    me?.id ?? '', projectId, projectId, ...(kinds ?? []), ...c.params, PAGE_SIZE,
  );
}

export async function userPosts(userId: string, me: User | null, before?: string): Promise<PostRow[]> {
  const c = cursorClause(before);
  return all<PostRow>(
    `${POST_SELECT} WHERE ${PUBLIC} AND p.author_id = ?${c.sql} ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
    me?.id ?? '', userId, ...c.params, PAGE_SIZE,
  );
}

export async function searchPosts(q: string, me: User | null): Promise<PostRow[]> {
  const like = `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
  return all<PostRow>(
    `${POST_SELECT} WHERE ${PUBLIC} AND p.body ILIKE ? ESCAPE '\\'
     ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
    me?.id ?? '', like, PAGE_SIZE,
  );
}

export async function getPost(id: string, me: User | null, includeHidden = false): Promise<PostRow | undefined> {
  return one<PostRow>(
    `${POST_SELECT} WHERE p.id = ?${includeHidden ? '' : ` AND ${PUBLIC}`}`,
    me?.id ?? '', id,
  );
}

export type ProjectRow = {
  id: string;
  origin_post_id: string;
  leader_id: string;
  title: string;
  concept: string;
  first_goal: string;
  stage: string;
  recruiting: boolean;
  repo_url: string | null;
  result_url: string | null;
  continued_from: string | null;
  visibility: string;
  last_update_at: string | null;
  created_at: string;
  updated_at: string;
  leader_handle: string;
  follower_count: number;
  member_count: number;
  open_needs: number;
};

const PROJECT_SELECT = `
  SELECT pr.*, u.handle AS leader_handle,
    (SELECT COUNT(*)::int FROM follows f WHERE f.project_id = pr.id) AS follower_count,
    (SELECT COUNT(*)::int FROM memberships m WHERE m.project_id = pr.id AND m.status = 'approved') AS member_count,
    (SELECT COUNT(*)::int FROM needs n WHERE n.project_id = pr.id AND n.status = 'open') AS open_needs
  FROM projects pr JOIN users u ON u.id = pr.leader_id
`;

export async function getProject(id: string, includeHidden = false): Promise<ProjectRow | undefined> {
  return one<ProjectRow>(
    `${PROJECT_SELECT} WHERE pr.id = ?${includeHidden ? '' : ` AND pr.visibility = 'public'`}`,
    id,
  );
}

export async function listProjects(f: { q?: string; stage?: string; recruiting?: boolean; help?: boolean }): Promise<ProjectRow[]> {
  const where: string[] = [`pr.visibility = 'public'`];
  const params: (string | number)[] = [];
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
    where.push(`(pr.title ILIKE ? ESCAPE '\\' OR pr.concept ILIKE ? ESCAPE '\\' OR pr.first_goal ILIKE ? ESCAPE '\\')`);
    params.push(like, like, like);
  }
  if (f.stage) {
    where.push('pr.stage = ?');
    params.push(f.stage);
  }
  if (f.recruiting) where.push('pr.recruiting');
  if (f.help) where.push(`EXISTS (SELECT 1 FROM needs n WHERE n.project_id = pr.id AND n.status = 'open')`);
  return all<ProjectRow>(
    `${PROJECT_SELECT} WHERE ${where.join(' AND ')}
     ORDER BY COALESCE(pr.last_update_at, pr.created_at) DESC LIMIT 50`,
    ...params,
  );
}

export async function membersOf(projectId: string) {
  return all<{ id: string; user_id: string; handle: string; role: string }>(
    `SELECT m.id, m.user_id, u.handle, m.role FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.project_id = ? AND m.status = 'approved' ORDER BY m.decided_at`,
    projectId,
  );
}

export async function isMember(projectId: string, userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const p = await one<{ leader_id: string }>('SELECT leader_id FROM projects WHERE id = ?', projectId);
  if (p?.leader_id === userId) return true;
  return Boolean(
    await one(`SELECT 1 FROM memberships WHERE project_id = ? AND user_id = ? AND status = 'approved'`, projectId, userId),
  );
}

/** Ideas nobody has answered yet, newest first — shown on the home page so no idea is left in the void. */
export async function awaitingReply(me: User | null, limit = 3): Promise<PostRow[]> {
  return all<PostRow>(
    `${POST_SELECT} WHERE ${PUBLIC} AND p.kind = 'idea'
       AND NOT EXISTS (SELECT 1 FROM replies r WHERE r.post_id = p.id AND r.visibility = 'public')
       AND NOT EXISTS (SELECT 1 FROM projects sp WHERE sp.origin_post_id = p.id)
     ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
    me?.id ?? '', limit,
  );
}

export type ActiveTable = { id: string; title: string; stage: string; updates: number; days: string[] };

/** Tables with the most team Updates in the last 7 days, plus the days they posted (for a streak). */
export async function activeTables(limit = 3): Promise<(ActiveTable & { streak: number })[]> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const week = new Date(Date.now() - 7 * 86400_000).toISOString();
  const rows = await all<ActiveTable>(
    `SELECT pr.id, pr.title, pr.stage,
        COUNT(*) FILTER (WHERE p.created_at > ?)::int AS updates,
        ARRAY_AGG(DISTINCT SUBSTR(p.created_at, 1, 10)) AS days
     FROM projects pr JOIN posts p ON p.project_id = pr.id
     WHERE pr.visibility = 'public' AND p.kind = 'update' AND p.visibility = 'public' AND p.created_at > ?
     GROUP BY pr.id, pr.title, pr.stage
     HAVING COUNT(*) FILTER (WHERE p.created_at > ?) > 0
     ORDER BY updates DESC, MAX(p.created_at) DESC LIMIT ?`,
    week, since, week, limit,
  );
  return rows.map((r) => ({ ...r, streak: streakOf(r.days) }));
}

/** Consecutive UTC days with at least one Update, counting back from today (or yesterday). */
export function streakOf(days: string[]): number {
  const set = new Set(days);
  const day = (offset: number) => new Date(Date.now() - offset * 86400_000).toISOString().slice(0, 10);
  let start = set.has(day(0)) ? 0 : set.has(day(1)) ? 1 : -1;
  if (start < 0) return 0;
  let n = 0;
  while (set.has(day(start + n))) n++;
  return n;
}

/** Most used #topics in public posts from the last 60 days. */
export async function popularTopics(limit = 12): Promise<{ tag: string; uses: number }[]> {
  const since = new Date(Date.now() - 60 * 86400_000).toISOString();
  return all<{ tag: string; uses: number }>(
    `SELECT LOWER(m[1]) AS tag, COUNT(*)::int AS uses
     FROM posts p, REGEXP_MATCHES(p.body, '#([[:alnum:]_-]{2,30})', 'g') AS m
     WHERE p.visibility = 'public' AND p.created_at > ?
     GROUP BY 1 ORDER BY uses DESC, tag LIMIT ?`,
    since, limit,
  );
}
