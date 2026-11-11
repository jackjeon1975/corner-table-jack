import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { one, run, now, newId } from '@/lib/db';
import { googleConfigured, safeNext, startSession, freeHandle, handleFrom } from '@/lib/auth';

function bad(req: NextRequest, msg: string) {
  const res = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, req.url));
  res.cookies.delete({ name: 'ct_oauth_g', path: '/auth/google' });
  return res;
}

function sameString(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function GET(req: NextRequest) {
  if (!googleConfigured()) return bad(req, 'Google sign-in is not configured.');
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  let saved: { state: string; verifier: string; next: string } | null = null;
  try {
    saved = JSON.parse(req.cookies.get('ct_oauth_g')?.value || 'null');
  } catch {
    saved = null;
  }
  if (!code || !state || !saved || !sameString(state, saved.state)) {
    return bad(req, 'Sign-in expired or was tampered with. Please try again.');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      code_verifier: saved.verifier,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.APP_URL}/auth/google/callback`,
    }),
    cache: 'no-store',
  });
  const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
  if (!token.access_token) return bad(req, 'Google did not accept the sign-in. Please try again.');

  // Profile straight from Google over TLS with the fresh access token.
  const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: 'no-store',
  });
  const g = (await infoRes.json().catch(() => ({}))) as {
    sub?: string; email?: string; email_verified?: boolean; name?: string; given_name?: string; picture?: string;
  };
  if (!g.sub) return bad(req, 'Could not read your Google profile.');
  const email = g.email && g.email_verified ? g.email.toLowerCase() : null;

  // Accounts are keyed by Google's stable subject id. A Google account is never merged into an
  // existing GitHub account by email, so nobody can take over another sign-in.
  let user = await one<{ id: string; status: string }>('SELECT id, status FROM users WHERE google_sub = ?', g.sub);
  if (user && user.status !== 'active') return bad(req, 'This account is not active.');
  if (user) {
    await run('UPDATE users SET name = ?, avatar_url = ?, email = COALESCE(email, ?) WHERE id = ?',
      g.name ?? null, g.picture ?? null, email, user.id);
  } else {
    const id = newId();
    // Names in Korean or other scripts give no Latin handle, so fall back to the email's local part.
    const tries = [g.given_name, g.name, email?.split('@')[0]].filter(Boolean).map((x) => handleFrom(x!));
    const base = tries.find((h) => !h.startsWith('member-')) ?? tries[0] ?? 'member';
    await run(
      'INSERT INTO users (id, google_sub, handle, name, avatar_url, email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, g.sub, await freeHandle(base), g.name ?? null, g.picture ?? null, email, now(),
    );
    user = { id, status: 'active' };
  }

  await startSession(user.id);
  const res = NextResponse.redirect(new URL(safeNext(saved.next), req.url));
  res.cookies.delete({ name: 'ct_oauth_g', path: '/auth/google' });
  return res;
}
