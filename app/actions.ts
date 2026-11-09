'use server';

import { redirect } from 'next/navigation';
import { one, run, tx, now, newId, audit } from '@/lib/db';
import {
  currentUser, startSession, endSession, isAdmin, devLoginAllowed, safeNext, freeHandle, type User,
} from '@/lib/auth';
import { safeHttpsUrl, githubRepoUrl, MAX_TEXT, STAGES } from '@/lib/format';
import { isMember } from '@/lib/queries';

// ---------- helpers ----------

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const backOf = (fd: FormData) => safeNext(fd.get('back'));

function withMsg(path: string, key: 'error' | 'ok', msg: string): string {
  const u = new URL(path, 'http://local');
  u.searchParams.set(key, msg);
  return u.pathname + u.search + u.hash;
}

function fail(path: string, msg: string): never {
  redirect(withMsg(path, 'error', msg));
}

async function requireUser(back: string): Promise<User> {
  const u = await currentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(back)}`);
  return u;
}

async function rateLimited(table: string, col: string, userId: string, max: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const r = await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${table} WHERE ${col} = ? AND created_at > ?`, userId, since);
  return (r?.n ?? 0) >= max;
}

function text(fd: FormData, k: string, back: string, label: string, required = true): string {
  const v = str(fd, k);
  if (required && !v) fail(back, `${label} is empty.`);
  if (v.length > MAX_TEXT) fail(back, `${label} is too long.`);
  return v;
}

function optionalLink(fd: FormData, back: string): string | null {
  const raw = str(fd, 'link_url');
  if (!raw) return null;
  const u = safeHttpsUrl(raw);
  if (!u) fail(back, 'Links must start with https://');
  return u;
}

async function leaderProject(projectId: string, user: User, back: string) {
  const p = await one<{ id: string; leader_id: string; stage: string; repo_url: string | null }>(
    `SELECT id, leader_id, stage, repo_url FROM projects WHERE id = ? AND visibility = 'public'`, projectId,
  );
  if (!p) fail(back, 'Project not found.');
  if (p.leader_id !== user.id) fail(back, 'Only the leader can do that.');
  return p;
}

async function touchProject(projectId: string) {
  const t = now();
  await run('UPDATE projects SET last_update_at = ?, updated_at = ? WHERE id = ?', t, t, projectId);
}

// ---------- auth ----------

export async function devLogin(fd: FormData) {
  const next = safeNext(fd.get('next'));
  if (!devLoginAllowed()) fail('/login', 'Dev login is disabled.');
  const handle = str(fd, 'handle');
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(handle)) {
    fail(`/login?next=${encodeURIComponent(next)}`, 'Use letters, numbers and dashes (max 39).');
  }
  let user = await one<{ id: string; status: string }>('SELECT id, status FROM users WHERE lower(handle) = lower(?)', handle);
  if (user && user.status !== 'active') fail('/login', 'That account is not active.');
  if (!user) {
    const id = newId();
    await run(
      `INSERT INTO users (id, handle, name, is_dev, created_at) VALUES (?, ?, ?, TRUE, ?)`,
      id, handle, handle, now(),
    );
    user = { id, status: 'active' };
  }
  await startSession(user.id);
  redirect(next);
}

export async function logout() {
  await endSession();
  redirect('/');
}

// ---------- posts ----------

const HOME_KINDS = ['note', 'idea'];
const PROJECT_KINDS = ['note', 'question', 'risk', 'update', 'help'];

export async function createPost(fd: FormData) {
  const back = backOf(fd);
  const user = await requireUser(back);
  const kind = str(fd, 'kind') || 'note';
  const projectId = str(fd, 'project_id') || null;
  const body = text(fd, 'body', back, 'Post');
  const link = optionalLink(fd, back);

  if (projectId) {
    if (!PROJECT_KINDS.includes(kind)) fail(back, 'Unknown post type.');
    const p = await one<{ stage: string }>(`SELECT stage FROM projects WHERE id = ? AND visibility = 'public'`, projectId);
    if (!p) fail(back, 'Project not found.');
    if (kind === 'update' && !await isMember(projectId, user.id)) fail(back, 'Only the team can post updates.');
  } else if (!HOME_KINDS.includes(kind)) {
    fail(back, 'Unknown post type.');
  }
  if (await rateLimited('posts', 'author_id', user.id, 20, 3600_000)) fail(back, 'Slow down a little — try again later.');

  const t = now();
  await run(
    `INSERT INTO posts (id, author_id, project_id, kind, body, link_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(), user.id, projectId, kind, body, link, t, t,
  );
  if (projectId && kind === 'update') await touchProject(projectId);
  redirect(back);
}

export async function editPost(fd: FormData) {
  const id = str(fd, 'post_id');
  const back = `/p/${id}`;
  const user = await requireUser(back);
  const post = await one<{ author_id: string; visibility: string }>('SELECT author_id, visibility FROM posts WHERE id = ?', id);
  if (!post || post.visibility !== 'public' || post.author_id !== user.id) fail(back, 'You can only edit your own posts.');
  const body = text(fd, 'body', back, 'Post');
  const link = optionalLink(fd, back);
  await run('UPDATE posts SET body = ?, link_url = ?, updated_at = ? WHERE id = ?', body, link, now(), id);
  redirect(back);
}

export async function deletePost(fd: FormData) {
  const id = str(fd, 'post_id');
  const user = await requireUser(`/p/${id}`);
  const post = await one<{ author_id: string }>('SELECT author_id FROM posts WHERE id = ?', id);
  if (!post || post.author_id !== user.id) fail(`/p/${id}`, 'You can only delete your own posts.');
  const project = await one<{ id: string }>('SELECT id FROM projects WHERE origin_post_id = ?', id);
  if (project) fail(`/p/${id}`, 'This idea started a project. End the project instead of deleting the idea.');
  await run(`UPDATE posts SET visibility = 'deleted', updated_at = ? WHERE id = ?`, now(), id);
  redirect('/');
}

export async function createReply(fd: FormData) {
  const postId = str(fd, 'post_id');
  const back = `/p/${postId}`;
  const user = await requireUser(back);
  const ok = await one(
    `SELECT 1 FROM posts p LEFT JOIN projects pr ON pr.id = p.project_id
     WHERE p.id = ? AND p.visibility = 'public' AND (p.project_id IS NULL OR pr.visibility = 'public')`,
    postId,
  );
  if (!ok) fail('/', 'Post not found.');
  const body = text(fd, 'body', back, 'Reply');
  if (await rateLimited('replies', 'author_id', user.id, 60, 3600_000)) fail(back, 'Slow down a little — try again later.');
  await run('INSERT INTO replies (id, post_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)', newId(), postId, user.id, body, now());
  redirect(back);
}

export async function deleteReply(fd: FormData) {
  const id = str(fd, 'reply_id');
  const r = await one<{ post_id: string; author_id: string }>('SELECT post_id, author_id FROM replies WHERE id = ?', id);
  const back = r ? `/p/${r.post_id}` : '/';
  const user = await requireUser(back);
  if (!r || r.author_id !== user.id) fail(back, 'You can only delete your own replies.');
  await run(`UPDATE replies SET visibility = 'deleted' WHERE id = ?`, id);
  redirect(back);
}

export async function toggleCheer(fd: FormData) {
  const back = backOf(fd);
  const user = await requireUser(back);
  const postId = str(fd, 'post_id');
  const exists = await one('SELECT 1 FROM cheers WHERE post_id = ? AND user_id = ?', postId, user.id);
  if (exists) await run('DELETE FROM cheers WHERE post_id = ? AND user_id = ?', postId, user.id);
  else {
    const ok = await one(`SELECT 1 FROM posts WHERE id = ? AND visibility = 'public'`, postId);
    if (ok) await run('INSERT INTO cheers (post_id, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', postId, user.id, now());
  }
  redirect(back);
}

// ---------- projects ----------

export async function startProject(fd: FormData) {
  const postId = str(fd, 'post_id');
  const back = `/p/${postId}/start`;
  const user = await requireUser(back);
  const post = await one<{ author_id: string; kind: string; visibility: string; project_id: string | null }>(
    'SELECT author_id, kind, visibility, project_id FROM posts WHERE id = ?', postId,
  );
  if (!post || post.visibility !== 'public' || post.kind !== 'idea') fail('/', 'Only Idea posts can become projects.');
  if (post.author_id !== user.id) fail(`/p/${postId}`, 'Only the person who shared the idea can start it.');
  const existing = await one<{ id: string }>('SELECT id FROM projects WHERE origin_post_id = ?', postId);
  if (existing) redirect(`/projects/${existing.id}`);

  const title = str(fd, 'title');
  if (!title) fail(back, 'Give the project a name.');
  if (title.length > 120) fail(back, 'Name is too long (120 max).');
  const concept = text(fd, 'concept', back, 'Concept');
  const goal = text(fd, 'first_goal', back, 'First goal');
  const continued = str(fd, 'continued_from') || null;

  const id = newId();
  try {
    await tx(async () => {
      const t = now();
      await run(
        `INSERT INTO projects (id, origin_post_id, leader_id, title, concept, first_goal, continued_from, last_update_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, postId, user.id, title, concept, goal, continued, t, t, t,
      );
      await run('UPDATE posts SET project_id = ? WHERE id = ?', id, postId);
      await run('INSERT INTO follows (project_id, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', id, user.id, t);
    });
  } catch {
    const again = await one<{ id: string }>('SELECT id FROM projects WHERE origin_post_id = ?', postId);
    if (again) redirect(`/projects/${again.id}`);
    fail(back, 'Could not start the project. Try again.');
  }
  redirect(`/projects/${id}`);
}

export async function editProject(fd: FormData) {
  const projectId = str(fd, 'project_id');
  const back = `/projects/${projectId}`;
  const user = await requireUser(back);
  await leaderProject(projectId, user, back);
  const title = str(fd, 'title');
  if (!title || title.length > 120) fail(back, 'Name must be 1–120 characters.');
  const concept = text(fd, 'concept', back, 'Concept');
  const goal = text(fd, 'first_goal', back, 'First goal');
  await run('UPDATE projects SET title = ?, concept = ?, first_goal = ?, updated_at = ? WHERE id = ?', title, concept, goal, now(), projectId);
  redirect(withMsg(back, 'ok', 'Saved.'));
}

export async function setRecruiting(fd: FormData) {
  const projectId = str(fd, 'project_id');
  const back = `/projects/${projectId}`;
  const user = await requireUser(back);
  const p = await leaderProject(projectId, user, back);
  if (p.stage === 'ended') fail(back, 'This project has ended.');
  await run('UPDATE projects SET recruiting = ?, updated_at = ? WHERE id = ?', str(fd, 'recruiting') === '1', now(), projectId);
  redirect(back);
}

const STAGE_MESSAGE: Record<string, string> = {
  concept: 'Back to Concept.',
  design: 'Moved to Design — designing this together in the open.',
  building: 'Moved to Building.',
  shared: 'Shared the result.',
  paused: 'Paused.',
  ended: 'Ended.',
};

export async function changeStage(fd: FormData) {
  const projectId = str(fd, 'project_id');
  const back = `/projects/${projectId}`;
  const user = await requireUser(back);
  const p = await leaderProject(projectId, user, back);
  const target = str(fd, 'stage');
  if (!STAGES.includes(target as (typeof STAGES)[number]) || target === p.stage) fail(back, 'Pick a different stage.');
  if (p.stage === 'ended') fail(back, 'An ended project cannot change stage. Start a new one that continues it.');
  const note = text(fd, 'note', back, 'Note', false);

  let repo = p.repo_url;
  let result: string | null = null;
  if (target === 'design') {
    const q = await one(`SELECT 1 FROM posts WHERE project_id = ? AND kind = 'question' AND visibility = 'public'`, projectId);
    if (!q) fail(back, 'Post at least one design Question before moving to Design.');
  }
  if (target === 'building') {
    repo = githubRepoUrl(str(fd, 'repo_url') || p.repo_url);
    if (!repo) fail(back, 'Building needs a GitHub repository link (https://github.com/owner/repo).');
  }
  if (target === 'shared') {
    result = safeHttpsUrl(str(fd, 'result_url'));
    if (!result) fail(back, 'Shared needs a result link (https://…).');
    if (!note) fail(back, 'Write a short summary of what you are sharing.');
  }
  if (target === 'paused' && !note) fail(back, 'Say in a line why the project is pausing.');
  if (target === 'ended' && !note) fail(back, 'Ending needs a retrospective: what you did, why it stopped, what you learned.');

  await tx(async () => {
    const t = now();
    await run(
      `UPDATE projects SET stage = ?, repo_url = ?, result_url = COALESCE(?, result_url),
         recruiting = CASE WHEN ? = 'ended' THEN FALSE ELSE recruiting END, updated_at = ? WHERE id = ?`,
      target, repo, result, target, t, projectId,
    );
    const body = target === 'ended' ? note : [STAGE_MESSAGE[target], note].filter(Boolean).join('\n\n');
    await run(
      `INSERT INTO posts (id, author_id, project_id, kind, body, link_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(), user.id, projectId, target === 'ended' ? 'retro' : 'update', body,
      target === 'shared' ? result : target === 'building' ? repo : null, t, t,
    );
    await touchProject(projectId);
  });
  redirect(back);
}

export async function addNeed(fd: FormData) {
  const projectId = str(fd, 'project_id');
  const back = `/projects/${projectId}`;
  const user = await requireUser(back);
  await leaderProject(projectId, user, back);
  const label = str(fd, 'label');
  if (!label || label.length > 200) fail(back, 'Describe the help in 1–200 characters.');
  await run('INSERT INTO needs (id, project_id, label, created_at) VALUES (?, ?, ?, ?)', newId(), projectId, label, now());
  redirect(back);
}

export async function updateNeed(fd: FormData) {
  const needId = str(fd, 'need_id');
  const n = await one<{ project_id: string }>('SELECT project_id FROM needs WHERE id = ?', needId);
  const back = n ? `/projects/${n.project_id}` : '/';
  const user = await requireUser(back);
  if (!n) fail(back, 'Not found.');
  await leaderProject(n.project_id, user, back);
  const op = str(fd, 'op');
  if (op === 'delete') await run('DELETE FROM needs WHERE id = ?', needId);
  else await run('UPDATE needs SET status = ? WHERE id = ?', op === 'met' ? 'met' : 'open', needId);
  redirect(back);
}

export async function toggleFollow(fd: FormData) {
  const projectId = str(fd, 'project_id');
  const back = backOf(fd);
  const user = await requireUser(back);
  const exists = await one('SELECT 1 FROM follows WHERE project_id = ? AND user_id = ?', projectId, user.id);
  if (exists) await run('DELETE FROM follows WHERE project_id = ? AND user_id = ?', projectId, user.id);
  else if (await one(`SELECT 1 FROM projects WHERE id = ? AND visibility = 'public'`, projectId)) {
    await run('INSERT INTO follows (project_id, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', projectId, user.id, now());
  }
  redirect(back);
}

// ---------- membership ----------

export async function applyToJoin(fd: FormData) {
  const projectId = str(fd, 'project_id');
  const back = `/projects/${projectId}`;
  const user = await requireUser(back);
  const p = await one<{ leader_id: string; recruiting: boolean; stage: string }>(
    `SELECT leader_id, recruiting, stage FROM projects WHERE id = ? AND visibility = 'public'`, projectId,
  );
  if (!p) fail('/', 'Project not found.');
  if (p.leader_id === user.id) fail(back, 'You lead this project.');
  if (!p.recruiting || p.stage === 'ended') fail(back, 'This project is not recruiting right now.');
  const role = str(fd, 'role');
  if (!role || role.length > 60) fail(back, 'Name the role you want (60 characters max).');
  const intro = text(fd, 'intro', back, 'Intro');
  if (await rateLimited('memberships', 'user_id', user.id, 10, 86400_000)) fail(back, 'Too many requests today.');
  try {
    await run(
      `INSERT INTO memberships (id, project_id, user_id, role, intro, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      newId(), projectId, user.id, role, intro, now(),
    );
  } catch {
    fail(back, 'You already have a request or a seat on this project.');
  }
  redirect(withMsg(back, 'ok', 'Request sent. The leader will decide.'));
}

export async function decideMembership(fd: FormData) {
  const id = str(fd, 'membership_id');
  const m = await one<{ project_id: string; user_id: string; status: string }>(
    'SELECT project_id, user_id, status FROM memberships WHERE id = ?', id,
  );
  const back = m ? `/projects/${m.project_id}` : '/';
  const user = await requireUser(back);
  if (!m) fail(back, 'Request not found.');
  const op = str(fd, 'op');
  const leader = (await one<{ leader_id: string }>('SELECT leader_id FROM projects WHERE id = ?', m.project_id))?.leader_id;
  const isLeader = leader === user.id;
  const isSelf = m.user_id === user.id;

  // Allowed transitions: pending→approved/declined (leader), pending→withdrawn (self),
  // approved→removed (leader), approved→left (self). Conditional update so only one wins.
  const plan: Record<string, { from: string; to: string; who: boolean }> = {
    approve: { from: 'pending', to: 'approved', who: isLeader },
    decline: { from: 'pending', to: 'declined', who: isLeader },
    withdraw: { from: 'pending', to: 'withdrawn', who: isSelf },
    remove: { from: 'approved', to: 'removed', who: isLeader },
    leave: { from: 'approved', to: 'left', who: isSelf },
  };
  const step = plan[op];
  if (!step || !step.who) fail(back, 'Not allowed.');
  const role = str(fd, 'role');
  if (op === 'approve' && role.length > 60) fail(back, 'Role is too long.');
  const res = await run(
    `UPDATE memberships SET status = ?, role = CASE WHEN ? <> '' THEN ? ELSE role END, decided_at = ?
     WHERE id = ? AND status = ?`,
    step.to, op === 'approve' ? role : '', role, now(), id, step.from,
  );
  if (Number(res.changes) === 0) fail(back, 'That request already changed. Refresh and try again.');
  redirect(back);
}

// ---------- reports & moderation ----------

export async function reportContent(fd: FormData) {
  const back = backOf(fd);
  const user = await requireUser(back);
  const type = str(fd, 'target_type');
  const id = str(fd, 'target_id');
  const reason = str(fd, 'reason');
  if (!['post', 'reply', 'project'].includes(type) || !id) fail(back, 'Nothing to report.');
  if (!['spam', 'rights', 'dangerous', 'other'].includes(reason)) fail(back, 'Pick a reason.');
  if (await rateLimited('reports', 'reporter_id', user.id, 10, 86400_000)) fail(back, 'Too many reports today.');
  await run(
    `INSERT INTO reports (id, target_type, target_id, reason, details, reporter_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    newId(), type, id, reason, str(fd, 'details').slice(0, 5000), user.id, now(),
  );
  redirect(withMsg(back, 'ok', 'Thanks — the report was received.'));
}

export async function rightsReport(fd: FormData) {
  const url = str(fd, 'target_url');
  const email = str(fd, 'contact_email');
  const details = str(fd, 'details');
  if (!url || !email.includes('@') || !details) fail('/report', 'Please fill in every field.');
  const m = url.match(/\/(p|projects)\/([0-9a-f-]{36})/i);
  await run(
    `INSERT INTO reports (id, target_type, target_id, reason, details, contact_email, created_at) VALUES (?, ?, ?, 'rights', ?, ?, ?)`,
    newId(), m ? (m[1] === 'p' ? 'post' : 'project') : 'url', m ? m[2] : url.slice(0, 500),
    `${details.slice(0, 10000)}\n\nURL: ${url.slice(0, 500)}`, email.slice(0, 320), now(),
  );
  redirect(withMsg('/report', 'ok', 'Received. We will reply to the email you gave within one business day.'));
}

async function requireAdmin(): Promise<User> {
  const u = await requireUser('/ops');
  if (!isAdmin(u)) redirect('/');
  return u;
}

export async function moderate(fd: FormData) {
  const admin = await requireAdmin();
  const type = str(fd, 'target_type');
  const id = str(fd, 'target_id');
  const op = str(fd, 'op'); // hide | restore
  const reason = str(fd, 'reason');
  const vis = op === 'hide' ? 'hidden' : 'public';
  if (type === 'post') await run(`UPDATE posts SET visibility = ? WHERE id = ? AND visibility <> 'deleted'`, vis, id);
  else if (type === 'reply') await run(`UPDATE replies SET visibility = ? WHERE id = ? AND visibility <> 'deleted'`, vis, id);
  else if (type === 'project') await run('UPDATE projects SET visibility = ? WHERE id = ?', vis, id);
  else fail('/ops', 'Unknown target.');
  await audit(admin.id, op, type, id, reason);
  redirect('/ops');
}

export async function resolveReport(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, 'report_id');
  const status = str(fd, 'status') === 'actioned' ? 'actioned' : 'dismissed';
  await run('UPDATE reports SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?', status, now(), admin.id, id);
  await audit(admin.id, `report_${status}`, 'report', id);
  redirect('/ops');
}

// ---------- profile ----------

export async function updateProfile(fd: FormData) {
  const user = await requireUser('/settings');
  const bio = str(fd, 'bio');
  if (bio.length > 500) fail('/settings', 'Keep the intro under 500 characters.');
  await run('UPDATE users SET bio = ? WHERE id = ?', bio, user.id);
  redirect(withMsg('/settings', 'ok', 'Saved.'));
}

export async function deleteAccount(fd: FormData) {
  const user = await requireUser('/settings');
  if (str(fd, 'confirm') !== user.handle) fail('/settings', 'Type your handle to confirm.');
  await tx(async () => {
    const t = now();
    const ghost = await freeHandle(`deleted-${user.id.slice(0, 8)}`);
    await run(
      `UPDATE users SET status = 'deleted', handle = ?, name = NULL, avatar_url = NULL, bio = '', github_user_id = NULL WHERE id = ?`,
      ghost, user.id,
    );
    await run(`UPDATE posts SET visibility = 'deleted', updated_at = ? WHERE author_id = ? AND visibility = 'public'`, t, user.id);
    await run(`UPDATE replies SET visibility = 'deleted' WHERE author_id = ?`, user.id);
    await run(`UPDATE memberships SET status = 'left', decided_at = ? WHERE user_id = ? AND status = 'approved'`, t, user.id);
    await run(`UPDATE memberships SET status = 'withdrawn', decided_at = ? WHERE user_id = ? AND status = 'pending'`, t, user.id);
    await run(`UPDATE projects SET stage = 'ended', recruiting = FALSE, updated_at = ? WHERE leader_id = ? AND stage <> 'ended'`, t, user.id);
    await run('DELETE FROM follows WHERE user_id = ?', user.id);
    await run('DELETE FROM cheers WHERE user_id = ?', user.id);
    await run('DELETE FROM sessions WHERE user_id = ?', user.id);
    await audit(user.id, 'account_deleted', 'user', user.id);
  });
  await endSession();
  redirect('/');
}

