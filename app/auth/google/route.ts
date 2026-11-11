import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { googleConfigured, safeNext } from '@/lib/auth';

// Step 1 of Google sign-in: one-time state + PKCE (S256), fixed redirect URI. Asks only for name, email and picture.
export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL('/login?error=Google+sign-in+is+not+configured+yet.', req.url));
  }
  const state = crypto.randomBytes(24).toString('base64url');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const next = safeNext(req.nextUrl.searchParams.get('next'));

  const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorize.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  authorize.searchParams.set('redirect_uri', `${process.env.APP_URL}/auth/google/callback`);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', 'openid email profile');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('prompt', 'select_account');

  const res = NextResponse.redirect(authorize);
  res.cookies.set('ct_oauth_g', JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/auth/google',
    maxAge: 600,
  });
  return res;
}
