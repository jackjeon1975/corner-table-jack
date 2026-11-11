import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { currentUser, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.APP_URL || 'http://localhost:3000';
const DESCRIPTION =
  'Share an idea before you build it. Design it in the open, find teammates, and let fans watch it grow.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Corner Table — Ideas get a table before they get built.',
  description: DESCRIPTION,
  alternates: { types: { 'application/rss+xml': [{ url: '/feed.xml', title: 'Corner Table · Latest' }] } },
  openGraph: {
    title: 'Corner Table',
    description: DESCRIPTION,
    url: '/',
    siteName: 'Corner Table',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Corner Table — Ideas get a table before they get built.',
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="wrap">
            <Link href="/" className="brand"><svg className="logo" viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--accent)" /><path d="M8.5 23V8.5H23" stroke="var(--bg)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="19.5" cy="19.5" r="5" fill="var(--bg)" /></svg>Corner Table</Link>
            <nav className="nav" aria-label="Main">
              <Link href="/">Home</Link>
              <Link href="/explore">Explore</Link>
              {me ? (
                <>
                  {isAdmin(me) && <Link href="/ops">Ops</Link>}
                  <Link href={`/u/${me.handle}`}>@{me.handle}</Link>
                </>
              ) : (
                <Link href="/login">Sign in</Link>
              )}
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="wrap footer">
          Ideas get a table before they get built. · <Link href="/about">About</Link> · <Link href="/report">Report a rights issue</Link>
        </footer>
        {/* Vercel Web Analytics (cookie-free page views). Active once Analytics is enabled for the project. */}
        {process.env.VERCEL && <script defer src="/_vercel/insights/script.js" />}
      </body>
    </html>
  );
}
