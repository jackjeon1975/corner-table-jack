import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { one, run, now, newId } from '@/lib/db';
import { githubConfigured, safeNext, startSession, freeHandle } from '@/lib/auth';

function bad(req: NextRequest, msg: string) {
  const res = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, req.url));
  res.cookies.delete({ name: 'ct_oauth', path: '/auth/github' });
  return res;
}

function sameString(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function GET(req: NextRequest) {
  if (!githubConfigured()) return bad(req, 'GitHub sign-in is not configured.');
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  let saved: { state: string; verifier: string; next: string } | null = null;
  try {
    saved = JSON.parse(req.cookies.get('ct_oauth')?.value || 'null');
  } catch {
    saved = null;
  }
  if (!code || !state || !saved || !sameString(state, saved.state)) {
    return bad(req, 'Sign-in expired or was tampered with. Please try again.');
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.APP_URL}/auth/github/callback`,
      code_verifier: saved.verifier,
    }),
    cache: 'no-store',
  });
  const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
  if (!token.access_token) return bad(req, 'GitHub did not accept the sign-in. Please try again.');

  const ghRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'corner-table' },
    cache: 'no-store',
  });
  const gh = (await ghRes.json().catch(() => ({}))) as { id?: number; login?: string; name?: string; avatar_url?: string };
  if (!gh.id || !gh.login) return bad(req, 'Could not read your GitHub profile.');

  // Accounts are keyed by GitHub's numeric id; the login name is display data and may change.
  let user = one<{ id: string; status: string }>('SELECT id, status FROM users WHERE github_user_id = ?', gh.id);
  if (user && user.status !== 'active') return bad(req, 'This account is not active.');
  if (user) {
    run('UPDATE users SET handle = ?, name = ?, avatar_url = ? WHERE id = ?',
      freeHandle(gh.login, user.id), gh.name ?? null, gh.avatar_url ?? null, user.id);
  } else {
    const id = newId();
    run(
      'INSERT INTO users (id, github_user_id, handle, name, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      id, gh.id, freeHandle(gh.login), gh.name ?? null, gh.avatar_url ?? null, now(),
    );
    user = { id, status: 'active' };
  }

  await startSession(user.id);
  const res = NextResponse.redirect(new URL(safeNext(saved.next), req.url));
  res.cookies.delete({ name: 'ct_oauth', path: '/auth/github' });
  return res;
}
