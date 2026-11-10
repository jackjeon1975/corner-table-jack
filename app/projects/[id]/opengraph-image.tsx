import { ImageResponse } from 'next/og';
import { getProject, projectStreak } from '@/lib/queries';
import { STAGE_LABEL } from '@/lib/format';
import { Brand, C, Chip, clip, ogFont, OG_SIZE } from '@/lib/og';

export const alt = 'A project on Corner Table';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProject(id);
  const title = p ? clip(p.title, 70) : 'Corner Table';
  const concept = p ? clip(p.concept, 160) : '';
  const stage = p ? STAGE_LABEL[p.stage] ?? p.stage : '';
  const streak = p ? await projectStreak(id) : 0;
  const by = p ? `Led by @${p.leader_handle} · ${p.follower_count} following · ${p.member_count + 1} at the table` : '';
  const chips = [stage, p?.recruiting ? 'Recruiting' : '', streak >= 2 ? `${streak}-day streak` : ''].filter(Boolean);
  const fonts = await ogFont(title + concept + by + chips.join('') + 'Corner Table Building in public Follow the build →');
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: C.bg, padding: '64px 80px', color: C.text, fontFamily: fonts.length ? 'Noto Sans KR' : 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <div style={{ display: 'flex', fontSize: 26, color: C.muted }}>Building in public</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
          {concept && <div style={{ fontSize: 30, color: C.muted, lineHeight: 1.35 }}>{concept}</div>}
          {by && <div style={{ fontSize: 26, color: C.muted }}>{by}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 26 }}>
          <div style={{ display: 'flex', gap: 12, fontWeight: 700 }}>{chips.map((c) => <Chip key={c}>{c}</Chip>)}</div>
          <div style={{ display: 'flex', color: C.accent, fontWeight: 700 }}>Follow the build →</div>
        </div>
      </div>
    ),
    fonts.length ? { ...size, fonts } : size,
  );
}
