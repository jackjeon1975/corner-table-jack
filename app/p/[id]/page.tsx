import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { getPost } from '@/lib/queries';
import { timeAgo } from '@/lib/format';
import { Notice, PostCard, ReportButton } from '@/components/ui';
import { createReply, deletePost, deleteReply, editPost } from '@/app/actions';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id, null);
  if (!post) return {};
  const first = post.body.split('\n')[0].trim();
  const title = first.length > 70 ? `${first.slice(0, 69)}…` : first;
  const description = `${post.kind === 'idea' ? 'An idea' : 'A post'} by @${post.handle} on Corner Table — ${post.body.replace(/\s+/g, ' ').slice(0, 140)}`;
  return {
    title: `${title} · Corner Table`,
    description,
    openGraph: { title, description, url: `/p/${id}`, siteName: 'Corner Table', type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function PostPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await currentUser();
  const post = await getPost(id, me);
  if (!post) notFound();
  const back = `/p/${id}`;
  const replies = await all<{ id: string; author_id: string; body: string; created_at: string; handle: string }>(
    `SELECT r.id, r.author_id, r.body, r.created_at, u.handle FROM replies r JOIN users u ON u.id = r.author_id
     WHERE r.post_id = ? AND r.visibility = 'public' ORDER BY r.created_at`,
    id,
  );
  const mine = me?.id === post.author_id;

  return (
    <>
      <Notice sp={sp} />
      <PostCard post={post} me={me} back={back} full />

      <div className="row small" style={{ gap: 16 }}>
        {mine && (
          <details>
            <summary>Edit</summary>
            <form action={editPost}>
              <input type="hidden" name="post_id" value={post.id} />
              <textarea name="body" required defaultValue={post.body} aria-label="Post text" />
              <input type="url" name="link_url" defaultValue={post.link_url ?? ''} placeholder="https:// link (optional)" aria-label="Link" style={{ marginTop: 6 }} />
              <div className="row" style={{ marginTop: 6 }}><button type="submit">Save</button></div>
            </form>
          </details>
        )}
        {mine && !post.started_project_id && (
          <form action={deletePost}>
            <input type="hidden" name="post_id" value={post.id} />
            <button className="plain" type="submit">Delete</button>
          </form>
        )}
        {me && !mine && <ReportButton type="post" id={post.id} back={back} />}
      </div>

      <div className="section-title">Replies</div>
      {replies.length === 0 && <p className="muted small">No replies yet.</p>}
      {replies.map((r) => (
        <div className="reply" key={r.id}>
          <div className="meta">
            <Link className="who" href={`/u/${r.handle}`}>@{r.handle}</Link>
            <span>·</span>
            <span title={new Date(r.created_at).toUTCString()}>{timeAgo(r.created_at)}</span>
          </div>
          <div className="body">{r.body}</div>
          <div className="row small" style={{ gap: 14 }}>
            {me?.id === r.author_id && (
              <form action={deleteReply}>
                <input type="hidden" name="reply_id" value={r.id} />
                <button className="plain" type="submit">Delete</button>
              </form>
            )}
            {me && me.id !== r.author_id && <ReportButton type="reply" id={r.id} back={back} />}
          </div>
        </div>
      ))}

      {me ? (
        <form action={createReply} className="composer">
          <input type="hidden" name="post_id" value={post.id} />
          <label htmlFor="reply-body">Reply</label>
          <textarea id="reply-body" name="body" required placeholder="Add to the conversation" />
          <div className="row"><button type="submit">Reply</button></div>
        </form>
      ) : (
        <p className="small"><Link href={`/login?next=${encodeURIComponent(back)}`}>Sign in to reply</Link></p>
      )}
    </>
  );
}
