import { getProject, projectStreak } from '@/lib/queries';
import { STAGE_LABEL } from '@/lib/format';

export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
// Rough text width for an 11px sans font; good enough for a README badge.
const w = (s: string) => Math.ceil([...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 11 : 6.6), 0)) + 16;

// Embeddable "building in public" badge for READMEs and personal sites.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProject(id);
  const left = 'Corner Table';
  let right = 'not found';
  if (p) {
    const streak = await projectStreak(id);
    right = `${STAGE_LABEL[p.stage] ?? p.stage}${streak >= 2 ? ` · ${streak}-day streak` : ''}`;
  }
  const lw = w(left) + 14;
  const rw = w(right);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + rw}" height="20" role="img" aria-label="${esc(`${left}: ${right}`)}"><title>${esc(`${left}: ${right}`)}</title><rect width="${lw}" height="20" rx="3" fill="#2b2420"/><rect x="${lw}" width="${rw}" height="20" fill="#8a4b2a"/><rect x="${lw - 3}" width="6" height="20" fill="#8a4b2a"/><rect x="${lw + rw - 3}" width="3" height="20" rx="0" fill="#8a4b2a"/><rect x="${lw + rw - 6}" width="6" height="20" rx="3" fill="#8a4b2a"/><path d="M6 14.5V5.5H15" stroke="#faf7f2" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="12.5" cy="12" r="2.6" fill="#faf7f2"/><g fill="#faf7f2" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11"><text x="${lw / 2 + 7}" y="14" text-anchor="middle">${esc(left)}</text><text x="${lw + rw / 2}" y="14" text-anchor="middle">${esc(right)}</text></g></svg>`;
  return new Response(svg, {
    status: p ? 200 : 404,
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=900' },
  });
}
