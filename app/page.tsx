import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { feed, cursorOf, PAGE_SIZE } from '@/lib/queries';
import { Composer, Notice, PostCard } from '@/components/ui';

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const me = await currentUser();
  const tab = sp.tab === 'following' && me ? 'following' : 'latest';
  const before = typeof sp.before === 'string' ? sp.before : undefined;
  const posts = feed({ me, tab, before });
  const back = tab === 'following' ? '/?tab=following' : '/';

  return (
    <>
      <Notice sp={sp} />
      {me ? (
        <Composer me={me} back={back} />
      ) : (
        <div className="card">
          <b>Ideas get a table before they get built.</b>
          <p className="muted small" style={{ margin: '6px 0 10px' }}>
            Share an idea before you build it. Design it in the open with people who care, find teammates,
            and let fans watch it grow.
          </p>
          <Link className="btn" href="/login">Pull up a chair</Link>
        </div>
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
            Be the first to sit down — post an <b>Idea</b> you have been holding onto.
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
