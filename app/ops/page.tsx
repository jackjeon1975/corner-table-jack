import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser, isAdmin } from '@/lib/auth';
import { all } from '@/lib/db';
import { Notice } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { moderate, resolveReport } from '@/app/actions';

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Ops({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const me = await currentUser();
  if (!me || !isAdmin(me)) notFound();

  const reports = await all<{
    id: string; target_type: string; target_id: string; reason: string; details: string; contact_email: string | null;
    created_at: string; reporter: string | null;
  }>(
    `SELECT r.*, u.handle AS reporter FROM reports r LEFT JOIN users u ON u.id = r.reporter_id
     WHERE r.status = 'open' ORDER BY r.created_at`,
  );
  const hidden = await all<{ id: string; body: string; kind: string }>(
    `SELECT id, body, kind FROM posts WHERE visibility = 'hidden' ORDER BY updated_at DESC LIMIT 50`,
  );
  const log = await all<{ action: string; target_type: string; target_id: string; reason: string; created_at: string; actor: string | null }>(
    `SELECT a.*, u.handle AS actor FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT 30`,
  );
  const link = (type: string, id: string) => (type === 'post' ? `/p/${id}` : type === 'project' ? `/projects/${id}` : null);

  return (
    <>
      <h1>Moderation</h1>
      <Notice sp={sp} />
      <div className="section-title">Open reports · {reports.length}</div>
      {reports.length === 0 && <p className="muted small">Nothing to review.</p>}
      {reports.map((r) => {
        const href = link(r.target_type, r.target_id);
        return (
          <div className="card small" key={r.id}>
            <div className="meta">
              <span className="badge k-risk">{r.reason}</span> {r.target_type}
              {href ? <Link href={href}>{r.target_id.slice(0, 8)}</Link> : <span>{r.target_id.slice(0, 60)}</span>}
              · {timeAgo(r.created_at)} · {r.reporter ? `@${r.reporter}` : r.contact_email}
            </div>
            {r.details && <div className="prose" style={{ margin: '6px 0' }}>{r.details}</div>}
            <div className="row">
              {['post', 'reply', 'project'].includes(r.target_type) && (
                <form action={moderate} className="row">
                  <input type="hidden" name="target_type" value={r.target_type} />
                  <input type="hidden" name="target_id" value={r.target_id} />
                  <input type="hidden" name="op" value="hide" />
                  <input type="text" name="reason" placeholder="Reason" aria-label="Reason" style={{ width: 160 }} />
                  <button className="danger" type="submit">Hide</button>
                </form>
              )}
              <form action={resolveReport}><input type="hidden" name="report_id" value={r.id} /><input type="hidden" name="status" value="actioned" /><button className="ghost" type="submit">Mark actioned</button></form>
              <form action={resolveReport}><input type="hidden" name="report_id" value={r.id} /><input type="hidden" name="status" value="dismissed" /><button className="plain" type="submit">Dismiss</button></form>
            </div>
          </div>
        );
      })}

      <div className="section-title">Hidden posts</div>
      {hidden.length === 0 && <p className="muted small">None.</p>}
      <ul className="list small">
        {hidden.map((h) => (
          <li key={h.id}>
            <span className="grow">{h.body.slice(0, 120)}</span>
            <form action={moderate}>
              <input type="hidden" name="target_type" value="post" />
              <input type="hidden" name="target_id" value={h.id} />
              <input type="hidden" name="op" value="restore" />
              <button className="plain" type="submit">Restore</button>
            </form>
          </li>
        ))}
      </ul>

      <div className="section-title">Audit log</div>
      <ul className="list small">
        {log.map((a, i) => (
          <li key={i}>{timeAgo(a.created_at)} · {a.actor ? `@${a.actor}` : 'system'} · {a.action} {a.target_type} {a.target_id.slice(0, 8)} {a.reason && `— ${a.reason}`}</li>
        ))}
      </ul>
    </>
  );
}
