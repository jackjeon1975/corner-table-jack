import { one } from '@/lib/db';

// Daily Vercel Cron target (see vercel.json). Runs a tiny query so the
// Supabase free-tier project sees database activity and is not auto-paused.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await one('SELECT 1 AS ok');
    return Response.json({ ok: true, at: new Date().toISOString() });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
