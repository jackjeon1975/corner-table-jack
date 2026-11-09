import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { one, run, now, newId } from './db';

export const SESSION_COOKIE = 'ct_session';
const SESSION_DAYS = 30;

export type User = {
  id: string;
  github_user_id: number | null;
  handle: string;
  name: string | null;
  avatar_url: string | null;
  bio: string;
  status: string;
  is_dev: number;
  created_at: string;
};

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = one<User>(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'`,
    sha256(token), now(),
  );
  return user ?? null;
}

export async function startSession(userId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  run(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    sha256(token), userId, now(), expires.toISOString(),
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  jar.delete(SESSION_COOKIE);
}

export function isAdmin(user: User | null): boolean {
  if (!user) return false;
  const list = (process.env.ADMIN_HANDLES || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(user.handle.toLowerCase());
}

export const devLoginAllowed = () =>
  process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_LOGIN === '1';

export const githubConfigured = () =>
  Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.APP_URL);

/** Only allow same-site relative paths as post-login destinations. */
export function safeNext(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : '';
  if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\')) return '/';
  return s;
}

/** Find a free handle, appending a suffix if someone already holds it. */
export function freeHandle(base: string, exceptUserId?: string): string {
  let candidate = base;
  for (let i = 2; i < 1000; i++) {
    const taken = one<{ id: string }>('SELECT id FROM users WHERE handle = ?', candidate);
    if (!taken || taken.id === exceptUserId) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${newId().slice(0, 6)}`;
}
