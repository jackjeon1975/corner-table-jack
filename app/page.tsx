import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { feed, awaitingReply, activeTables, cursorOf, PAGE_SIZE } from '@/lib/queries';
import { timeAgo, STAGE_LABEL } from '@/lib/format';
import { Composer, Notice, PostCard } from '@/components/ui';
import { Landing } from '@/components/landing';

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const me = await currentUser();
  const tab = sp.tab === 'following' && me ? 'following' : 'latest';
  const before = typeof sp.before === 'string' ? sp.before : undefined;
  const posts = await feed({ me, tab, before });
  const back = tab === 'following' ? '/?tab=following' : '/';
  const waiting = tab === 'latest' && !before ? await awaitingReply(me) : [];
  const rolling = tab === 'latest' && !before ? await activeTables() : [];

  const base = process.env.APP_URL || '';
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: 'Corner Table', url: `${base}/`, description: 'Share startup ideas before you build them, find teammates, and build in public.',
        potentialAction: { '@type': 'SearchAction', target: `${base}/explore?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
      { '@type': 'Organization', name: 'Corner Table', url: `${base}/`, logo: `${base}/icon.svg` },
    ],
  };

  return (
    <>
      {!before && tab === 'latest' && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      )}
      <Notice sp={sp} />
      {me ? (
        <Composer me={me} back={back} />
      ) : (
        <Landing />
      )}

      {waiting.length > 0 && (
        <section className="waiting" aria-labelledby="waiting-title">
          <div className="section-title" id="waiting-title">Waiting for a first reply</div>
          <ul className="list">
            {waiting.map((w) => (
              <li key={w.id}>
                <Link href={`/p/${w.id}`} className="waiting-body">{w.body.split('\n')[0].slice(0, 90)}</Link>
                <span className="small muted">@{w.handle} · {timeAgo(w.created_at)}</span>
              </li>
            ))}
          </ul>
          <p className="small muted waiting-note">A question or a risk you spot helps more than a cheer.</p>
        </section>
      )}

      {rolling.length > 0 && (
        <section className="waiting rolling" aria-labelledby="rolling-title">
          <div className="section-title" id="rolling-title">On a roll this week</div>
          <ul className="list">
            {rolling.map((t) => (
              <li key={t.id}>
                <Link href={`/projects/${t.id}`} className="waiting-body">{t.title}</Link>
                <span className="small muted">
                  {STAGE_LABEL[t.stage] ?? t.stage} · {t.updates} update{t.updates === 1 ? '' : 's'}
                  {t.streak >= 2 && <> · <b className="streak">🔥 {t.streak}-day streak</b></>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="tabs" aria-label="Feed">
        <Link href="/" className={tab === 'latest' ? 'on' : ''} aria-current={tab === 'latest' ? 'page' : undefined}>Latest</Link>
        {me && (
          <Link href="/?tab=following" className={tab === 'following' ? 'on' : ''} aria-current={tab === 'following' ? 'page' : undefined}>
            Following
          </Link>
        )}
      </nav>

      {posts.length === 0 && !before ? (
        tab === 'following' ? (
          <div className="empty">
            <div className="big">Nothing here yet</div>
            Follow a project to see its updates here. <Link href="/explore">Explore tables →</Link>
          </div>
        ) : (
          <div className="empty">
            <div className="big">The table is empty.</div>
            Be the first to sit down — post an <b>Idea</b> you have been holding onto.{' '}
            {!me && <Link href="/login">Sign in to post&nbsp;→</Link>}
          </div>
        )
      ) : (
        <section aria-label="Posts">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} me={me} back={back} />
          ))}
        </section>
      )}

      {posts.length === PAGE_SIZE && (
        <div className="pager">
          <Link className="btn ghost" href={`/?${tab === 'following' ? 'tab=following&' : ''}before=${encodeURIComponent(cursorOf(posts[posts.length - 1]))}`}>
            Older posts
          </Link>
        </div>
      )}
    </>
  );
}
