import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { currentUser, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Corner Table',
  description: 'Ideas get a table before they get built.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="wrap">
            <Link href="/" className="brand"><span className="dot" aria-hidden />Corner Table</Link>
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
      </body>
    </html>
  );
}
