// Shared pieces for per-idea and per-project share images.
export const OG_SIZE = { width: 1200, height: 630 };
export const C = { bg: '#faf7f2', text: '#2b2420', muted: '#7a6e66', accent: '#8a4b2a', chip: '#f3e6dc' };

/** Loads only the glyphs we draw from Noto Sans KR, so Korean titles do not render as boxes. */
export async function ogFont(text: string): Promise<{ name: string; data: ArrayBuffer; weight: 700; style: 'normal' }[]> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' },
      })
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype|woff)'\)/)?.[1];
    if (!url) return [];
    const data = await (await fetch(url)).arrayBuffer();
    return [{ name: 'Noto Sans KR', data, weight: 700, style: 'normal' }];
  } catch {
    return [];
  }
}

export const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 34, fontWeight: 700 }}>
      <svg width='48' height='48' viewBox='0 0 32 32'>
        <rect width='32' height='32' rx='8' fill={C.accent} />
        <path d='M8.5 23V8.5H23' stroke={C.bg} strokeWidth='3' fill='none' strokeLinecap='round' strokeLinejoin='round' />
        <circle cx='19.5' cy='19.5' r='5' fill={C.bg} />
      </svg>
      Corner Table
    </div>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', background: C.chip, color: C.accent, padding: '8px 22px', borderRadius: 999 }}>{children}</div>;
}
