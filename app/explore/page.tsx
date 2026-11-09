import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { listProjects, searchPosts } from '@/lib/queries';
import { STAGES, STAGE_LABEL, timeAgo } from '@/lib/format';
import { PostCard, QuietBadge, StageBadge } from '@/components/ui';

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Explore({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const me = await currentUser();
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 200) : '';
  const stage = typeof sp.stage === 'string' && (STAGES as readonly string[]).includes(sp.stage) ? sp.stage : '';
  const recruiting = sp.recruiting === '1';
  const help = sp.help === '1';
  const projects = await listProjects({ q, stage, recruiting, help });
  const posts = q ? await searchPosts(q, me) : [];

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

      <div className="section-title">Projects · {projects.length}</div>
      {projects.length === 0 && <p className="muted small">No projects match yet. Maybe yours is the first.</p>}
      {projects.map((p) => (
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
