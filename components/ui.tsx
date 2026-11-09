import Link from 'next/link';
import type { User } from '@/lib/auth';
import type { PostRow } from '@/lib/queries';
import { createPost, toggleCheer, reportContent } from '@/app/actions';
import { timeAgo, domainOf, KIND_LABEL, STAGE_LABEL, QUIET_DAYS, daysSince } from '@/lib/format';

export function Notice({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const error = typeof sp.error === 'string' ? sp.error : null;
  const ok = typeof sp.ok === 'string' ? sp.ok : null;
  if (!error && !ok) return null;
  return (
    <div className={`notice ${error ? 'error' : 'ok'}`} role={error ? 'alert' : 'status'}>
      {error ?? ok}
    </div>
  );
}

export function KindBadge({ kind }: { kind: string }) {
  return <span className={`badge k-${kind}`}>{KIND_LABEL[kind] ?? kind}</span>;
}

export function StageBadge({ stage }: { stage: string }) {
  return <span className={`badge s-${stage}`}>{STAGE_LABEL[stage] ?? stage}</span>;
}

export function QuietBadge({ stage, last }: { stage: string; last: string | null }) {
  const d = daysSince(last);
  if (!['concept', 'design', 'building'].includes(stage) || d === null || d < QUIET_DAYS) return null;
  return <span className="badge quiet" title={`No update for ${d} days`}>Quiet · {d}d</span>;
}

const TAG = /(#[\p{L}\p{N}_-]{2,30})/u;

/** Plain-text body where #topics link to a search. Everything else stays plain text. */
export function BodyText({ text }: { text: string }) {
  return (
    <>
      {text.split(TAG).map((part, i) =>
        i % 2 === 1 ? (
          <Link key={i} className="tag" href={`/explore?q=${encodeURIComponent(part)}`}>{part}</Link>
        ) : (
          part
        ),
      )}
    </>
  );
}

function isLong(body: string) {
  return body.length > 700 || body.split('\n').length > 8;
}

export function PostCard({ post, me, back, full = false, inProject = false }: { post: PostRow; me: User | null; back: string; full?: boolean; inProject?: boolean }) {
  const long = !full && isLong(post.body);
  const showKind = post.kind !== 'note';
  return (
    <article className="post">
      <div className="meta">
        {post.avatar_url && <img className="avatar" src={post.avatar_url} alt="" />}
        <Link className="who" href={`/u/${post.handle}`}>@{post.handle}</Link>
        {showKind && <KindBadge kind={post.kind} />}
        {!inProject && post.project_id && post.project_title && (
          <span className="chip">in <Link href={`/projects/${post.project_id}`}>{post.project_title}</Link></span>
        )}
        <span>·</span>
        <Link href={`/p/${post.id}`} className="muted" title={new Date(post.created_at).toUTCString()}>
          {timeAgo(post.created_at)}
        </Link>
        {post.updated_at !== post.created_at && full && <span className="small">(edited)</span>}
      </div>
      <div className={`body${long ? ' clamp' : ''}`}><BodyText text={post.body} /></div>
      {long && <Link className="more" href={`/p/${post.id}`}>Show more</Link>}
      {post.link_url && (
        <div>
          <a className="link" href={post.link_url} target="_blank" rel="noopener noreferrer nofollow ugc">
            ↗ {domainOf(post.link_url)}
          </a>
        </div>
      )}
      <div className="actions">
        <Link href={`/p/${post.id}`}>Reply{post.reply_count ? ` · ${post.reply_count}` : ''}</Link>
        <form action={toggleCheer}>
          <input type="hidden" name="post_id" value={post.id} />
          <input type="hidden" name="back" value={back} />
          <button className={`plain${post.cheered ? ' on' : ''}`} aria-pressed={Boolean(post.cheered)} disabled={!me} title={me ? 'Cheer' : 'Sign in to cheer'}>
            ☕ Cheer{post.cheer_count ? ` · ${post.cheer_count}` : ''}
          </button>
        </form>
        {post.kind === 'idea' && !post.started_project_id && me?.id === post.author_id && (
          <Link href={`/p/${post.id}/start`}>Start a project →</Link>
        )}
        {post.started_project_id && !inProject && (
          <Link href={`/projects/${post.started_project_id}`}>Project →</Link>
        )}
      </div>
    </article>
  );
}

type ComposerProps = {
  me: User;
  back: string;
  projectId?: string;
  canUpdate?: boolean;
  placeholder?: string;
};

const AI_PROMPT = `Help me post a side-project idea on Corner Table (a community where people share ideas before building them).
Ask me short questions one at a time, then write the post in under 150 words:
1. What it is (one line)
2. Who it's for and the problem it solves
3. What I'm unsure about (a real question others can answer)
4. Who I'm looking for (skills or roles)
End with 2-3 #topics, e.g. #ai #saas #local.`;

export function Composer({ me, back, projectId, canUpdate, placeholder }: ComposerProps) {
  const kinds = projectId
    ? [
        ['note', 'Note'],
        ['question', 'Question — a design decision to make'],
        ['risk', 'Risk — something that could go wrong'],
        ['help', 'Help — offer or ask for help'],
        ...(canUpdate ? [['update', 'Update — progress from the team']] : []),
      ]
    : [
        ['note', 'Note'],
        ['idea', 'Idea — a project you want to start'],
      ];
  return (
    <form action={createPost} className="composer">
      <input type="hidden" name="back" value={back} />
      {projectId && <input type="hidden" name="project_id" value={projectId} />}
      <label htmlFor="composer-body" className="muted" style={{ fontWeight: 500, marginTop: 0 }}>
        {projectId ? 'Say something at this table' : `What's on your mind, @${me.handle}?`}
      </label>
      <textarea id="composer-body" name="body" required placeholder={placeholder ?? (projectId ? 'Share a question, a risk, or where you are.' : 'An idea? Say what it is, who it\'s for, what you\'re unsure about, and who you\'re looking for.')} />
      {!projectId && (
        <details className="small ai-help">
          <summary>Draft it with AI</summary>
          <p className="muted">Paste this into ChatGPT, Claude or any assistant, answer its questions, then paste the result here.</p>
          <pre className="prompt">{AI_PROMPT}</pre>
        </details>
      )}
      <div className="row">
        <select name="kind" aria-label="Post type" defaultValue={projectId && canUpdate ? 'update' : 'note'}>
          {kinds.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <input className="grow" type="url" name="link_url" placeholder="https:// link (optional)" aria-label="Link (optional)" />
        <button type="submit">Post</button>
      </div>
    </form>
  );
}

export function ReportButton({ type, id, back }: { type: 'post' | 'reply' | 'project'; id: string; back: string }) {
  return (
    <details className="small">
      <summary>Report</summary>
      <form action={reportContent} className="row">
        <input type="hidden" name="target_type" value={type} />
        <input type="hidden" name="target_id" value={id} />
        <input type="hidden" name="back" value={back} />
        <select name="reason" aria-label="Reason" required defaultValue="">
          <option value="" disabled>Reason…</option>
          <option value="spam">Spam</option>
          <option value="rights">Uses someone else&apos;s rights (IP)</option>
          <option value="dangerous">Dangerous link or personal info</option>
          <option value="other">Other</option>
        </select>
        <input className="grow" type="text" name="details" placeholder="Details (optional)" aria-label="Details" />
        <button className="ghost" type="submit">Send</button>
      </form>
    </details>
  );
}
