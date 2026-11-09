import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { getPost } from '@/lib/queries';
import { Notice } from '@/components/ui';
import { startProject } from '@/app/actions';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function StartProject({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/p/${id}/start`)}`);
  const post = await getPost(id, me);
  if (!post || post.kind !== 'idea' || post.author_id !== me.id) notFound();
  if (post.started_project_id) redirect(`/projects/${post.started_project_id}`);
  const continued = typeof sp.continue === 'string' ? sp.continue : '';

  return (
    <>
      <h1>Give this idea a table</h1>
      <p className="muted">
        You will be the leader. You decide the scope, who joins and what each person does.
        Progress is shared in the open so people can follow along.
      </p>
      <Notice sp={sp} />
      <div className="card">
        <div className="small muted">Your idea</div>
        <div className="prose" style={{ marginTop: 4 }}>{post.body}</div>
      </div>
      <form action={startProject}>
        <input type="hidden" name="post_id" value={post.id} />
        {continued && <input type="hidden" name="continued_from" value={continued} />}
        <label htmlFor="title">Project name</label>
        <input id="title" type="text" name="title" required maxLength={120} />
        <label htmlFor="concept">Concept</label>
        <textarea id="concept" name="concept" required defaultValue={post.body} />
        <div className="hint">What is it, who is it for, and why does it matter to you?</div>
        <label htmlFor="first_goal">First goal</label>
        <textarea id="first_goal" name="first_goal" required placeholder="The smallest thing that would prove this is worth building." />
        <div className="row" style={{ marginTop: 14 }}>
          <button type="submit">Start the project</button>
          <Link href={`/p/${post.id}`} className="small">Cancel</Link>
        </div>
      </form>
    </>
  );
}
