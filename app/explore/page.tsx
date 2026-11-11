import type { Metadata } from 'next';
import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { listProjects, searchPosts, popularTopics, mostWanted, postsOfKind } from '@/lib/queries';
import { STAGES, STAGE_LABEL, timeAgo } from '@/lib/format';
import { PostCard, QuietBadge, StageBadge } from '@/components/ui';

type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = ['q', 'stage', 'recruiting', 'help', 'kind'].some((k) => sp[k]);
  return {
    title: 'Explore startup ideas and projects · Corner Table',
    description: 'Browse ideas and side projects being built in public. Find teams that are recruiting or need help.',
    alternates: { canonical: '/explore' },
    // Search and filter result pages are thin duplicates; keep them out of the index but follow links.
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function Explore({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const me = await currentUser();
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 200) : '';
  const stage = typeof sp.stage === 'string' && (STAGES as readonly string[]).includes(sp.stage) ? sp.stage : '';
  const recruiting = sp.recruiting === '1';
  const help = sp.help === '1';
  const projects = await listProjects({ q, stage, recruiting, help });
  const posts = q ? await searchPosts(q, me) : [];
  const topics = await popularTopics();
  const KINDS: Record<string, string> = { partner: 'Looking for a partner', ask: 'Founder questions', idea: 'Ideas' };
  const kind = typeof sp.kind === 'string' && KINDS[sp.kind] ? sp.kind : '';
  const wanted = q || kind ? [] : await mostWanted(me);
  const kindPosts = kind ? await postsOfKind(kind, me) : [];

  return (
    <>
      <h1>Explore tables</h1>
      <form className="card" role="search">
        <div className="row">
          <input className="grow" type="text" name="q" defaultValue={q} placeholder="Search ideas and projects" aria-label="Search" />
          <select name="stage" defaultValue={stage} aria-label="Stage">
            <option value="">Any stage</option>
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select>
        </div>
        <div className="row small" style={{ marginTop: 8, gap: 16 }}>
          <label style={{ margin: 0, fontWeight: 500 }}><input type="checkbox" name="recruiting" value="1" defaultChecked={recruiting} /> Recruiting</label>
          <label style={{ margin: 0, fontWeight: 500 }}><input type="checkbox" name="help" value="1" defaultChecked={help} /> Needs help</label>
          <button type="submit" style={{ marginLeft: 'auto' }}>Search</button>
        </div>
      </form>

      {topics.length > 0 && (
        <nav className="topics" aria-label="Popular topics">
          {topics.map((t) => (
            <Link key={t.tag} href={`/explore?q=${encodeURIComponent('#' + t.tag)}`} className={q.toLowerCase() === '#' + t.tag ? 'on' : ''}>
              #{t.tag} <span className="muted">{t.uses}</span>
            </Link>
          ))}
        </nav>
      )}

      <nav className="tabs" aria-label="Post types">
        <Link href="/explore" className={!kind ? 'on' : ''}>Projects</Link>
        {Object.entries(KINDS).map(([k, label]) => (
          <Link key={k} href={`/explore?kind=${k}`} className={kind === k ? 'on' : ''} aria-current={kind === k ? 'page' : undefined}>{label}</Link>
        ))}
      </nav>

      {kind && (
        <>
          <div className="section-title">{KINDS[kind]} · {kindPosts.length}</div>
          {kind === 'partner' && <p className="small muted">Builders who need marketers, marketers who need builders. Say hi in the replies.</p>}
          {kindPosts.length === 0 ? <p className="muted small">Nothing here yet — be the first.</p> : kindPosts.map((p) => <PostCard key={p.id} post={p} me={me} back={`/explore?kind=${kind}`} />)}
        </>
      )}

      {wanted.length > 0 && (
        <>
          <div className="section-title">Ideas people want · last 30 days</div>
          {wanted.map((p) => <PostCard key={p.id} post={p} me={me} back="/explore" />)}
        </>
      )}

      {!kind && <div className="section-title">Projects · {projects.length}</div>}
      {!kind && projects.length === 0 && <p className="muted small">No projects match yet. Maybe yours is the first.</p>}
      {!kind && projects.map((p) => (
        <div className="card project-card" key={p.id}>
          <div className="row" style={{ gap: 6 }}>
            <StageBadge stage={p.stage} />
            <QuietBadge stage={p.stage} last={p.last_update_at} />
            {p.recruiting ? <span className="badge k-question">Recruiting</span> : null}
            {p.open_needs ? <span className="badge k-help">Needs help · {p.open_needs}</span> : null}
          </div>
          <h3><Link href={`/projects/${p.id}`}>{p.title}</Link></h3>
          <div className="body clamp small" style={{ WebkitLineClamp: 3 }}>{p.concept}</div>
          <div className="meta">
            @{p.leader_handle} · {p.member_count + 1} at the table · {p.follower_count} following · updated {timeAgo(p.last_update_at ?? p.created_at)}
          </div>
        </div>
      ))}

      {q && (
        <>
          <div className="section-title">Posts mentioning “{q}”</div>
          {posts.length === 0 ? <p className="muted small">No posts found.</p> : posts.map((p) => <PostCard key={p.id} post={p} me={me} back={`/explore?q=${encodeURIComponent(q)}`} />)}
        </>
      )}
    </>
  );
}
