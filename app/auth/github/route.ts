import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { githubConfigured, safeNext } from '@/lib/auth';

// Step 1 of GitHub sign-in: one-time state + PKCE (S256), fixed redirect URI.
export async function GET(req: NextRequest) {
  if (!githubConfigured()) {
    return NextResponse.redirect(new URL('/login?error=GitHub+sign-in+is+not+configured+yet.', req.url));
  }
  const state = crypto.randomBytes(24).toString('base64url');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const next = safeNext(req.nextUrl.searchParams.get('next'));

  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID!);
  authorize.searchParams.set('redirect_uri', `${process.env.APP_URL}/auth/github/callback`);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('allow_signup', 'true');
  authorize.searchParams.set('scope', 'user:email'); // read-only: the primary verified address, for opt-out notifications

  const res = NextResponse.redirect(authorize);
  res.cookies.set('ct_oauth', JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/auth/github',
    maxAge: 600,
  });
  return res;
}
