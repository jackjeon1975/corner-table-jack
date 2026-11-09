import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { all, one } from '@/lib/db';
import { userPosts, cursorOf, PAGE_SIZE } from '@/lib/queries';
import { StageBadge, PostCard } from '@/components/ui';

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Profile({ params, searchParams }: Props) {
  const { handle } = await params;
  const sp = await searchParams;
  const me = await currentUser();
  const user = one<{ id: string; handle: string; name: string | null; bio: string; avatar_url: string | null; github_user_id: number | null; created_at: string }>(
    `SELECT id, handle, name, bio, avatar_url, github_user_id, created_at FROM users WHERE handle = ? AND status = 'active'`,
    decodeURIComponent(handle),
  );
  if (!user) notFound();
  const self = me?.id === user.id;
  const before = typeof sp.before === 'string' ? sp.before : undefined;

  const leads = all<{ id: string; title: string; stage: string }>(
    `SELECT id, title, stage FROM projects WHERE leader_id = ? AND visibility = 'public' ORDER BY created_at DESC`, user.id,
  );
  const joined = all<{ id: string; title: string; stage: string; role: string }>(
    `SELECT pr.id, pr.title, pr.stage, m.role FROM memberships m JOIN projects pr ON pr.id = m.project_id
     WHERE m.user_id = ? AND m.status = 'approved' AND pr.visibility = 'public' ORDER BY m.decided_at DESC`, user.id,
  );
  const requests = self
    ? all<{ id: string; title: string; project_id: string; role: string; status: string }>(
        `SELECT m.id, pr.title, pr.id AS project_id, m.role, m.status FROM memberships m JOIN projects pr ON pr.id = m.project_id
         WHERE m.user_id = ? ORDER BY m.created_at DESC LIMIT 30`, user.id,
      )
    : [];
  const posts = userPosts(user.id, me, before);

  return (
    <>
      <div className="row" style={{ marginTop: 18 }}>
        {user.avatar_url && <img src={user.avatar_url} alt="" width={48} height={48} style={{ borderRadius: '50%' }} />}
        <div>
          <h1 style={{ margin: 0 }}>@{user.handle}</h1>
          {user.name && user.name !== user.handle && <div className="muted">{user.name}</div>}
        </div>
        {self && <Link className="btn ghost" href="/settings" style={{ marginLeft: 'auto' }}>Settings</Link>}
      </div>
      {user.bio && <p className="prose">{user.bio}</p>}
      {user.github_user_id && (
        <p className="small"><a href={`https://github.com/${user.handle}`} target="_blank" rel="noopener noreferrer">↗ github.com/{user.handle}</a></p>
      )}

      {leads.length > 0 && (
        <>
          <div className="section-title">Leads</div>
          <ul className="list">
            {leads.map((p) => <li key={p.id}><StageBadge stage={p.stage} /><Link href={`/projects/${p.id}`}>{p.title}</Link></li>)}
          </ul>
        </>
      )}
      {joined.length > 0 && (
        <>
          <div className="section-title">Sits at</div>
          <ul className="list">
            {joined.map((p) => <li key={p.id}><StageBadge stage={p.stage} /><Link href={`/projects/${p.id}`}>{p.title}</Link><span className="muted small">{p.role}</span></li>)}
          </ul>
        </>
      )}
      {self && requests.length > 0 && (
        <>
          <div className="section-title">My join requests (only you see this)</div>
          <ul className="list">
            {requests.map((r) => (
              <li key={r.id}><Link href={`/projects/${r.project_id}`}>{r.title}</Link><span className="muted small">{r.role}</span><span className="badge k-note">{r.status}</span></li>
            ))}
          </ul>
        </>
      )}

      <div className="section-title">Posts</div>
      {posts.length === 0 ? <p className="muted small">No posts yet.</p> : posts.map((p) => <PostCard key={p.id} post={p} me={me} back={`/u/${user.handle}`} />)}
      {posts.length === PAGE_SIZE && (
        <div className="pager"><Link className="btn ghost" href={`/u/${user.handle}?before=${encodeURIComponent(cursorOf(posts[posts.length - 1]))}`}>Older posts</Link></div>
      )}
    </>
  );
}
