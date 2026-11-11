import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { all, one } from '@/lib/db';
import { getProject, membersOf, projectPosts, projectStreak, cursorOf, PAGE_SIZE } from '@/lib/queries';
import { domainOf, timeAgo, STAGES, STAGE_LABEL } from '@/lib/format';
import { Composer, Notice, PostCard, QuietBadge, ReportButton, StageBadge } from '@/components/ui';
import { ShareBar } from '@/components/share';
import {
  addNeed, applyToJoin, changeStage, decideMembership, editProject, setRecruiting, toggleFollow, updateNeed,
} from '@/app/actions';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return {};
  const title = project.title;
  const description = `${STAGE_LABEL[project.stage] ?? project.stage} · led by @${project.leader_handle}${project.recruiting ? ' · recruiting' : ''} — ${project.concept.replace(/\s+/g, ' ').slice(0, 140)}`;
  return {
    title: `${title} · Corner Table`,
    description,
    alternates: { canonical: `/projects/${id}` },
    openGraph: { title, description, url: `/projects/${id}`, siteName: 'Corner Table', type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

const VIEWS: Record<string, { label: string; kinds?: string[] }> = {
  all: { label: 'Everything' },
  progress: { label: 'Progress', kinds: ['update', 'retro'] },
  design: { label: 'Design talk', kinds: ['question', 'risk'] },
  help: { label: 'Help', kinds: ['help'] },
};

export default async function ProjectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await currentUser();
  const project = await getProject(id);
  if (!project) notFound();

  const view = typeof sp.view === 'string' && VIEWS[sp.view] ? sp.view : 'all';
  const before = typeof sp.before === 'string' ? sp.before : undefined;
  const back = `/projects/${id}${view !== 'all' ? `?view=${view}` : ''}`;
  const isLeader = me?.id === project.leader_id;
  const members = await membersOf(id);
  const isTeam = isLeader || members.some((m) => m.user_id === me?.id);
  const posts = await projectPosts(id, me, VIEWS[view].kinds, before);
  const needs = await all<{ id: string; label: string; status: string }>(
    `SELECT id, label, status FROM needs WHERE project_id = ? ORDER BY status = 'met', created_at`, id,
  );
  const following = me ? Boolean(await one('SELECT 1 FROM follows WHERE project_id = ? AND user_id = ?', id, me.id)) : false;
  const myMembership = me
    ? await one<{ id: string; status: string; role: string }>(
        `SELECT id, status, role FROM memberships WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1`, id, me.id,
      )
    : undefined;
  const pending = isLeader
    ? await all<{ id: string; role: string; intro: string; handle: string; created_at: string }>(
        `SELECT m.id, m.role, m.intro, u.handle, m.created_at FROM memberships m JOIN users u ON u.id = m.user_id
         WHERE m.project_id = ? AND m.status = 'pending' ORDER BY m.created_at`, id,
      )
    : [];
  const ended = project.stage === 'ended';
  const streak = await projectStreak(id);
  const base = process.env.APP_URL || '';
  const continuedFrom = project.continued_from
    ? await one<{ id: string; title: string }>(`SELECT id, title FROM projects WHERE id = ? AND visibility = 'public'`, project.continued_from)
    : undefined;

  return (
    <>
      <Notice sp={sp} />
      <div className="row" style={{ marginTop: 18, gap: 6 }}>
        <StageBadge stage={project.stage} />
        <QuietBadge stage={project.stage} last={project.last_update_at} />
        {project.recruiting ? <span className="badge k-question">Recruiting</span> : null}
      </div>
      <h1>{project.title}</h1>
      <div className="meta">
        Led by <Link className="who" href={`/u/${project.leader_handle}`}>@{project.leader_handle}</Link>
        <span>·</span> started {timeAgo(project.created_at)}
        {project.last_update_at && <><span>·</span> last update {timeAgo(project.last_update_at)}</>}
      </div>
      {continuedFrom && (
        <p className="small muted">Continues <Link href={`/projects/${continuedFrom.id}`}>{continuedFrom.title}</Link></p>
      )}

      <div className="stats">
        <span><b>{project.follower_count}</b> following</span>
        <span><b>{project.member_count + 1}</b> at the table</span>
        {streak >= 2 && <span className="streak">🔥 {streak}-day streak</span>}
        {project.repo_url && (
          <a href={project.repo_url} target="_blank" rel="noopener noreferrer nofollow">↗ {project.repo_url.replace('https://', '')}</a>
        )}
        {project.result_url && (
          <a href={project.result_url} target="_blank" rel="noopener noreferrer nofollow ugc">↗ Result · {domainOf(project.result_url)}</a>
        )}
      </div>

      <div className="row">
        {me ? (
          <form action={toggleFollow}>
            <input type="hidden" name="project_id" value={id} />
            <input type="hidden" name="back" value={back} />
            <button className={following ? 'ghost' : ''} type="submit" aria-pressed={following}>{following ? 'Following' : 'Follow'}</button>
          </form>
        ) : (
          <Link className="btn" href={`/login?next=${encodeURIComponent(back)}`}>Follow</Link>
        )}
        {me && !isLeader && <ReportButton type="project" id={id} back={back} />}
      </div>

      <ShareBar url={`${base}/projects/${id}`} text={`${project.title} — building in public on Corner Table`} />

      <div className="section-title">Concept</div>
      <div className="prose">{project.concept}</div>
      <div className="section-title">First goal</div>
      <div className="prose">{project.first_goal}</div>

      <div className="section-title">At the table</div>
      <ul className="list">
        <li><Link href={`/u/${project.leader_handle}`}>@{project.leader_handle}</Link> <span className="badge">Leader</span></li>
        {members.map((m) => (
          <li key={m.id}>
            <Link href={`/u/${m.handle}`}>@{m.handle}</Link> <span className="muted small">{m.role}</span>
            {isLeader && (
              <form action={decideMembership} style={{ marginLeft: 'auto' }}>
                <input type="hidden" name="membership_id" value={m.id} />
                <input type="hidden" name="op" value="remove" />
                <button className="plain" type="submit">Remove</button>
              </form>
            )}
            {me?.id === m.user_id && (
              <form action={decideMembership} style={{ marginLeft: 'auto' }}>
                <input type="hidden" name="membership_id" value={m.id} />
                <input type="hidden" name="op" value="leave" />
                <button className="plain" type="submit">Leave</button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {(needs.length > 0 || isLeader) && (
        <>
          <div className="section-title">Help wanted</div>
          {needs.length === 0 && <p className="small muted">List what you can&apos;t do alone — IP advice, servers, AI tokens, testers…</p>}
          <ul className="list">
            {needs.map((n) => (
              <li key={n.id}>
                <span style={n.status === 'met' ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{n.label}</span>
                {n.status === 'met' && <span className="badge k-question">Covered</span>}
                {isLeader && (
                  <span className="row" style={{ marginLeft: 'auto', gap: 10 }}>
                    <form action={updateNeed}>
                      <input type="hidden" name="need_id" value={n.id} />
                      <input type="hidden" name="op" value={n.status === 'met' ? 'open' : 'met'} />
                      <button className="plain" type="submit">{n.status === 'met' ? 'Reopen' : 'Mark covered'}</button>
                    </form>
                    <form action={updateNeed}>
                      <input type="hidden" name="need_id" value={n.id} />
                      <input type="hidden" name="op" value="delete" />
                      <button className="plain" type="submit">Delete</button>
                    </form>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!isLeader && needs.some((n) => n.status === 'open') && (
            <p className="small muted">Can help? Post a <b>Help</b> note below.</p>
          )}
          {isLeader && !ended && (
            <form action={addNeed} className="row" style={{ marginTop: 8 }}>
              <input type="hidden" name="project_id" value={id} />
              <input className="grow" type="text" name="label" maxLength={200} placeholder="e.g. Someone who knows game IP licensing" aria-label="Help needed" required />
              <button className="ghost" type="submit">Add</button>
            </form>
          )}
        </>
      )}

      {/* Join */}
      {!isLeader && !ended && (
        <>
          {myMembership?.status === 'pending' && (
            <div className="card small">
              You asked to join as <b>{myMembership.role}</b>. Waiting for the leader.
              <form action={decideMembership} style={{ display: 'inline', marginLeft: 8 }}>
                <input type="hidden" name="membership_id" value={myMembership.id} />
                <input type="hidden" name="op" value="withdraw" />
                <button className="plain" type="submit">Withdraw</button>
              </form>
            </div>
          )}
          {myMembership?.status === 'declined' && (
            <p className="small muted">The leader did not take your request this time. You can ask again with a different role or note.</p>
          )}
          {project.recruiting && myMembership?.status !== 'pending' && myMembership?.status !== 'approved' ? (
            me ? (
              <details className="card">
                <summary style={{ fontSize: 15, color: 'var(--text)', fontWeight: 600 }}>Ask to join this table</summary>
                <form action={applyToJoin}>
                  <input type="hidden" name="project_id" value={id} />
                  <label htmlFor="role">Role you would like</label>
                  <input id="role" type="text" name="role" required maxLength={60} placeholder="e.g. Developer, Artist, IP research" />
                  <label htmlFor="intro">About you and what you would do</label>
                  <textarea id="intro" name="intro" required />
                  <div className="hint">Only you and the leader can see this.</div>
                  <div className="row" style={{ marginTop: 10 }}><button type="submit">Send request</button></div>
                </form>
              </details>
            ) : (
              <p className="small"><Link href={`/login?next=${encodeURIComponent(back)}`}>Sign in to ask to join</Link></p>
            )
          ) : null}
        </>
      )}

      {/* Leader panel */}
      {isLeader && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Leader tools</h2>

          {pending.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 6 }}>Requests to join · {pending.length}</div>
              <ul className="list">
                {pending.map((r) => (
                  <li key={r.id} style={{ display: 'block' }}>
                    <div><Link href={`/u/${r.handle}`}>@{r.handle}</Link> <span className="muted small">wants: {r.role} · {timeAgo(r.created_at)}</span></div>
                    <div className="prose small" style={{ margin: '4px 0 6px' }}>{r.intro}</div>
                    <div className="row">
                      <form action={decideMembership} className="row">
                        <input type="hidden" name="membership_id" value={r.id} />
                        <input type="hidden" name="op" value="approve" />
                        <input type="text" name="role" defaultValue={r.role} maxLength={60} aria-label="Role to give" style={{ width: 180 }} />
                        <button type="submit">Approve</button>
                      </form>
                      <form action={decideMembership}>
                        <input type="hidden" name="membership_id" value={r.id} />
                        <input type="hidden" name="op" value="decline" />
                        <button className="ghost" type="submit">Decline</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {!ended && (
            <form action={setRecruiting} className="row" style={{ marginTop: 8 }}>
              <input type="hidden" name="project_id" value={id} />
              <input type="hidden" name="recruiting" value={project.recruiting ? '0' : '1'} />
              <span className="small">{project.recruiting ? 'Recruiting is open.' : 'Recruiting is closed.'}</span>
              <button className="ghost" type="submit">{project.recruiting ? 'Close recruiting' : 'Open recruiting'}</button>
            </form>
          )}

          {!ended && (
            <details style={{ marginTop: 12 }}>
              <summary>Change stage</summary>
              <form action={changeStage}>
                <input type="hidden" name="project_id" value={id} />
                <label htmlFor="stage">New stage</label>
                <select id="stage" name="stage" required defaultValue="">
                  <option value="" disabled>Choose…</option>
                  {STAGES.filter((s) => s !== project.stage).map((s) => (
                    <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                  ))}
                </select>
                <label htmlFor="repo_url">GitHub repository (needed for Building)</label>
                <input id="repo_url" type="url" name="repo_url" defaultValue={project.repo_url ?? ''} placeholder="https://github.com/owner/repo" />
                <label htmlFor="result_url">Result link (needed for Shared)</label>
                <input id="result_url" type="url" name="result_url" defaultValue={project.result_url ?? ''} placeholder="https://" />
                <label htmlFor="note">Note</label>
                <textarea id="note" name="note" placeholder="Shared: a summary. Paused: why. Ended: a retrospective — what you did, why it stopped, what you learned." />
                <div className="hint">Design needs at least one Question posted at this table. Ending is final and the retrospective stays public.</div>
                <div className="row" style={{ marginTop: 10 }}><button type="submit">Change stage</button></div>
              </form>
            </details>
          )}

          <details style={{ marginTop: 12 }}>
            <summary>Share your table</summary>
            <p className="small muted">Put this badge in your GitHub README or on your site. It shows your stage and streak and links back here.</p>
            <p><img src={`/projects/${id}/badge.svg`} alt="Corner Table badge" height={20} /></p>
            <textarea readOnly className="embed-code" aria-label="Badge Markdown" value={`[![Corner Table](${base}/projects/${id}/badge.svg)](${base}/projects/${id})`} />
          </details>

          <details style={{ marginTop: 12 }}>
            <summary>Edit project</summary>
            <form action={editProject}>
              <input type="hidden" name="project_id" value={id} />
              <label htmlFor="e-title">Name</label>
              <input id="e-title" type="text" name="title" required maxLength={120} defaultValue={project.title} />
              <label htmlFor="e-concept">Concept</label>
              <textarea id="e-concept" name="concept" required defaultValue={project.concept} />
              <label htmlFor="e-goal">First goal</label>
              <textarea id="e-goal" name="first_goal" required defaultValue={project.first_goal} />
              <div className="row" style={{ marginTop: 10 }}><button type="submit">Save</button></div>
            </form>
          </details>
        </div>
      )}

      <nav className="tabs" aria-label="Project posts" style={{ marginTop: 24 }}>
        {Object.entries(VIEWS).map(([k, v]) => (
          <Link key={k} href={`/projects/${id}${k === 'all' ? '' : `?view=${k}`}`} className={view === k ? 'on' : ''} aria-current={view === k ? 'page' : undefined}>
            {v.label}
          </Link>
        ))}
      </nav>

      {me && !ended && <Composer me={me} back={back} projectId={id} canUpdate={isTeam} placeholder={isTeam ? 'Share progress, ask a design question, or flag a risk.' : 'Ask a question, flag a risk, or offer help.'} />}

      {posts.length === 0 ? (
        <p className="muted small" style={{ padding: '16px 0' }}>Nothing here yet.</p>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} me={me} back={back} inProject />)
      )}
      {posts.length === PAGE_SIZE && (
        <div className="pager">
          <Link className="btn ghost" href={`/projects/${id}?${view !== 'all' ? `view=${view}&` : ''}before=${encodeURIComponent(cursorOf(posts[posts.length - 1]))}`}>Older posts</Link>
        </div>
      )}
    </>
  );
}
