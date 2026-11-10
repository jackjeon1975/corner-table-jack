import { ImageResponse } from 'next/og';
import { getPost } from '@/lib/queries';
import { KIND_LABEL } from '@/lib/format';
import { Brand, C, Chip, clip, ogFont, OG_SIZE } from '@/lib/og';

export const alt = 'An idea on Corner Table';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id, null);
  const title = post ? clip(post.body.split('\n')[0], 90) : 'Ideas get a table before they get built.';
  const rest = post ? clip(post.body.split('\n').slice(1).join(' '), 150) : '';
  const kind = post ? KIND_LABEL[post.kind] ?? post.kind : 'Idea';
  const by = post ? `@${post.handle}` : '';
  const stats = post ? `${post.reply_count} ${post.reply_count === 1 ? 'reply' : 'replies'} · ${post.cheer_count} cheers` : '';
  const ask = post?.kind === 'idea' ? 'What would you ask before this gets built?' : 'Join the conversation';
  const fonts = await ogFont(title + rest + by + stats + ask + kind + 'Corner Table');
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: C.bg, padding: '64px 80px', color: C.text, fontFamily: fonts.length ? 'Noto Sans KR' : 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 700 }}><Chip>{kind}</Chip></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: title.length > 50 ? 56 : 68, fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
          {rest && <div style={{ fontSize: 30, color: C.muted, lineHeight: 1.35 }}>{rest}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28, color: C.muted }}>
          <div style={{ display: 'flex' }}>{by}{stats ? ` · ${stats}` : ''}</div>
          <div style={{ display: 'flex', color: C.accent, fontWeight: 700 }}>{ask}</div>
        </div>
      </div>
    ),
    fonts.length ? { ...size, fonts } : size,
  );
}
