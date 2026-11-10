import { feed } from '@/lib/queries';
import { KIND_LABEL } from '@/lib/format';

export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

// Latest public posts as RSS, so people can follow the table from a reader, Slack or a bot.
export async function GET() {
  const base = process.env.APP_URL || 'http://localhost:3000';
  const posts = await feed({ me: null, tab: 'latest' });
  const items = posts.map((p) => {
    const first = p.body.split('\n')[0].trim().slice(0, 120);
    const title = `${KIND_LABEL[p.kind] ?? p.kind}${p.project_title ? ` · ${p.project_title}` : ''}: ${first}`;
    return `<item><title>${esc(title)}</title><link>${base}/p/${p.id}</link><guid isPermaLink="true">${base}/p/${p.id}</guid><pubDate>${new Date(p.created_at).toUTCString()}</pubDate><dc:creator>@${esc(p.handle)}</dc:creator><description>${esc(p.body.slice(0, 1000))}</description></item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Corner Table · Latest</title><link>${base}/</link><atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml"/><description>Ideas get a table before they get built.</description>${items.join('')}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });
}
