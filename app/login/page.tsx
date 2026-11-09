import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser, devLoginAllowed, githubConfigured, safeNext } from '@/lib/auth';
import { devLogin } from '@/app/actions';
import { Notice } from '@/components/ui';

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Login({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await currentUser()) redirect(next);
  const gh = githubConfigured();
  const dev = devLoginAllowed();

  return (
    <>
      <h1>Pull up a chair</h1>
      <p className="muted">Reading is open to everyone. Sign in to post, follow, cheer and join projects.</p>
      <Notice sp={sp} />

      <div className="card">
        {gh ? (
          <a className="btn" href={`/auth/github?next=${encodeURIComponent(next)}`}>Continue with GitHub</a>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            GitHub sign-in is not configured on this server yet (set <code>GITHUB_CLIENT_ID</code>,{' '}
            <code>GITHUB_CLIENT_SECRET</code> and <code>APP_URL</code>).
          </p>
        )}
        <p className="hint">We only read your public GitHub profile. No repository access is requested.</p>
      </div>

      {dev && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Dev login</h2>
          <p className="small muted">For local testing only. Pick any handle — no password.</p>
          <form action={devLogin} className="row">
            <input type="hidden" name="next" value={next} />
            <input className="grow" type="text" name="handle" required placeholder="handle" aria-label="Handle" pattern="[A-Za-z0-9][A-Za-z0-9-]{0,38}" />
            <button type="submit">Sign in</button>
          </form>
        </div>
      )}
      <p className="small"><Link href="/">← Back to the table</Link></p>
    </>
  );
}
