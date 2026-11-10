// Outgoing email through Resend's HTTP API. Does nothing until RESEND_API_KEY and EMAIL_FROM are set,
// so the app works the same with or without email. Never throws: a failed email must not break a page.
import { one } from './db';

export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

const base = () => process.env.APP_URL || 'http://localhost:3000';

const escapeHtml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function sendMail(to: string, subject: string, lines: string[], link?: { label: string; path: string }): Promise<boolean> {
  if (!mailConfigured() || !to.includes('@')) return false;
  const url = link ? `${base()}${link.path}` : base();
  const footer = `You get this because email notifications are on. Turn them off: ${base()}/settings`;
  const text = [...lines, '', link ? `${link.label}: ${url}` : url, '', '— Corner Table', footer].join('\n');
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#2b2420;max-width:560px">
${lines.map((l) => `<p style="margin:0 0 10px;white-space:pre-wrap">${escapeHtml(l)}</p>`).join('\n')}
${link ? `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#8a4b2a;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none">${escapeHtml(link.label)}</a></p>` : ''}
<p style="color:#7a6e66;font-size:13px;margin-top:24px">— Corner Table<br>${escapeHtml(footer.split(': ')[0])}: <a href="${base()}/settings" style="color:#7a6e66">settings</a></p></div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, html }),
      cache: 'no-store',
    });
    if (!r.ok) console.error('mail failed', r.status, (await r.text()).slice(0, 300));
    return r.ok;
  } catch (e) {
    console.error('mail failed', e);
    return false;
  }
}

/** Email one user if they have an address and notifications on. Skips the actor themselves. */
export async function notifyUser(userId: string, actorId: string, subject: string, lines: string[], link: { label: string; path: string }) {
  if (!mailConfigured() || userId === actorId) return;
  const u = await one<{ email: string | null; notify_email: boolean; status: string }>(
    'SELECT email, notify_email, status FROM users WHERE id = ?', userId,
  );
  if (!u?.email || !u.notify_email || u.status !== 'active') return;
  await sendMail(u.email, subject, lines, link);
}
