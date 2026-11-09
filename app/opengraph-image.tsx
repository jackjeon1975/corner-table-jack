import { ImageResponse } from 'next/og';

export const alt = 'Corner Table — Ideas get a table before they get built.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          background: '#faf7f2', padding: '72px 80px', fontFamily: 'sans-serif', color: '#2b2420',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 40, fontWeight: 700 }}>
          <svg width='56' height='56' viewBox='0 0 32 32'>
            <rect width='32' height='32' rx='8' fill='#8a4b2a' />
            <path d='M8.5 23V8.5H23' stroke='#faf7f2' strokeWidth='3' fill='none' strokeLinecap='round' strokeLinejoin='round' />
            <circle cx='19.5' cy='19.5' r='5' fill='#faf7f2' />
          </svg>
          Corner Table
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5 }}>
            Ideas get a table before they get built.
          </div>
          <div style={{ fontSize: 34, color: '#7a6e66' }}>
            Share it early · design it together · build in public
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 26, fontWeight: 700, color: '#8a4b2a' }}>
          {['Concept', 'Design', 'Building', 'Shared'].map((s) => (
            <div key={s} style={{ background: '#f3e6dc', padding: '8px 22px', borderRadius: 999 }}>{s}</div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
