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
  is_dev: boolean;
  created_at: string;
  can_help: string;
  email: string | null;
  notify_email: boolean;
  google_sub: string | null;
  totp_enabled: boolean;
};

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = await one<User>(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'`,
    sha256(token), now(),
  );
  return user ?? null;
}

/** The signed-in session row (for step-up checks such as two-step verification). */
export async function currentSession(): Promise<{ token_hash: string; mfa_at: string | null } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return (await one<{ token_hash: string; mfa_at: string | null }>(
    'SELECT token_hash, mfa_at FROM sessions WHERE token_hash = ? AND expires_at > ?', sha256(token), now(),
  )) ?? null;
}

export const MFA_HOURS = 12;

/** True when this session passed two-step verification within MFA_HOURS. */
export async function mfaFresh(): Promise<boolean> {
  const s = await currentSession();
  return Boolean(s?.mfa_at && Date.now() - new Date(s.mfa_at).getTime() < MFA_HOURS * 3600_000);
}

export async function startSession(userId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await run(
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
  if (token) await run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  jar.delete(SESSION_COOKIE);
}

export function isAdmin(user: User | null): boolean {
  if (!user) return false;
  const list = (process.env.ADMIN_HANDLES || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!list.includes(user.handle.toLowerCase())) return false;
  // Admin handles only count for GitHub accounts (handles of other sign-in methods are self-derived),
  // or for dev-login accounts where dev login is enabled.
  return user.github_user_id != null || (user.is_dev && devLoginAllowed());
}

export const devLoginAllowed = () =>
  process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_LOGIN === '1';

export const googleConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.APP_URL);

/** A valid handle from free text (Google name or email): letters, digits, single hyphens, ≤ 30 chars. */
export function handleFrom(raw: string): string {
  const h = raw.toLowerCase().normalize('NFKD').replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30).replace(/-$/, '');
  return h.length >= 2 ? h : `member-${h || 'new'}`;
}

export const githubConfigured = () =>
  Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.APP_URL);

/** Only allow same-site relative paths as post-login destinations. */
export function safeNext(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : '';
  if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\')) return '/';
  return s;
}

/** Find a free handle, appending a suffix if someone already holds it. */
export async function freeHandle(base: string, exceptUserId?: string): Promise<string> {
  let candidate = base;
  for (let i = 2; i < 1000; i++) {
    const taken = await one<{ id: string }>('SELECT id FROM users WHERE lower(handle) = lower(?)', candidate);
    if (!taken || taken.id === exceptUserId) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${newId().slice(0, 6)}`;
}
