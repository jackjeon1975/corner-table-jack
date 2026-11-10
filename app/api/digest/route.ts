import { all, one, run, now } from '@/lib/db';
import { mailConfigured, sendMail } from '@/lib/mail';

export const dynamic = 'force-dynamic';

const WEEK = 7 * 86400_000;
const BATCH = 40; // stays well under Resend's free daily limit

// Weekly summary email, run by Vercel Cron (vercel.json). Each person gets at most one per ~week:
// digest_sent_at is claimed before sending, so retries or extra calls cannot double-send.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('unauthorized', { status: 401 });
  if (!mailConfigured()) return Response.json({ sent: 0, reason: 'email not configured' });

  const since = new Date(Date.now() - WEEK).toISOString();
  const due = new Date(Date.now() - WEEK + 3 * 3600_000).toISOString(); // a little slack for cron timing
  const users = await all<{ id: string; handle: string; email: string }>(
    `SELECT id, handle, email FROM users
     WHERE status = 'active' AND notify_email AND email IS NOT NULL AND (digest_sent_at IS NULL OR digest_sent_at < ?)
     ORDER BY digest_sent_at NULLS FIRST LIMIT ?`,
    due, BATCH,
  );

  const fresh = await all<{ id: string; body: string; handle: string; replies: number; wants: number }>(
    `SELECT p.id, p.body, u.handle,
       (SELECT COUNT(*)::int FROM replies r WHERE r.post_id = p.id AND r.visibility = 'public') AS replies,
       (SELECT COUNT(*)::int FROM interests i WHERE i.post_id = p.id) AS wants
     FROM posts p JOIN users u ON u.id = p.author_id
     WHERE p.kind = 'idea' AND p.visibility = 'public' AND p.created_at > ?
     ORDER BY wants DESC, replies ASC, p.created_at DESC LIMIT 5`,
    since,
  );
  const base = process.env.APP_URL || '';
  let sent = 0;

  for (const u of users) {
    const claimed = await run(
      `UPDATE users SET digest_sent_at = ? WHERE id = ? AND (digest_sent_at IS NULL OR digest_sent_at < ?)`, now(), u.id, due,
    );
    if (Number(claimed.changes) === 0) continue;

    const mine = await one<{ replies: number; wants: number; followers: number; requests: number }>(
      `SELECT
         (SELECT COUNT(*)::int FROM replies r JOIN posts p ON p.id = r.post_id
           WHERE p.author_id = ? AND r.author_id <> ? AND r.visibility = 'public' AND r.created_at > ?) AS replies,
         (SELECT COUNT(*)::int FROM interests i JOIN posts p ON p.id = i.post_id WHERE p.author_id = ? AND i.created_at > ?) AS wants,
         (SELECT COUNT(*)::int FROM follows f JOIN projects pr ON pr.id = f.project_id WHERE pr.leader_id = ? AND f.created_at > ?) AS followers,
         (SELECT COUNT(*)::int FROM memberships m JOIN projects pr ON pr.id = m.project_id WHERE pr.leader_id = ? AND m.status = 'pending') AS requests`,
      u.id, u.id, since, u.id, since, u.id, since, u.id,
    );
    const others = fresh.filter((f) => f.handle !== u.handle).slice(0, 3);
    const yours = [
      mine?.replies ? `${mine.replies} new ${mine.replies === 1 ? 'reply' : 'replies'} on your posts` : '',
      mine?.wants ? `${mine.wants} ${mine.wants === 1 ? 'person' : 'people'} said they'd use your idea` : '',
      mine?.followers ? `${mine.followers} new ${mine.followers === 1 ? 'follower' : 'followers'} on your tables` : '',
      mine?.requests ? `${mine.requests} join ${mine.requests === 1 ? 'request is' : 'requests are'} waiting for you` : '',
    ].filter(Boolean);
    if (yours.length === 0 && others.length === 0) continue; // nothing worth an email

    const lines = [
      `Hi @${u.handle}, here is your week at Corner Table.`,
      ...(yours.length ? ['Your tables:', ...yours.map((y) => `• ${y}`)] : []),
      ...(others.length
        ? ['New ideas this week — a question or a risk you spot helps more than a cheer:',
           ...others.map((o) => `• ${o.body.split('\n')[0].slice(0, 90)} (@${o.handle}${o.replies ? '' : ', no replies yet'}) ${base}/p/${o.id}`)]
        : []),
    ];
    if (await sendMail(u.email, 'Your week at Corner Table', lines, { label: 'Open Corner Table', path: '/' })) sent++;
  }
  return Response.json({ sent, checked: users.length });
}
