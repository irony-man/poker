import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = "POKR — Play free Texas Hold'em online";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(145deg, #1d0432 0%, #3a0d5c 55%, #5c1a6e 100%)',
          color: '#e6d9d7',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            opacity: 0.9,
          }}
        >
          POKR
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              maxWidth: 900,
            }}
          >
            {"Play free Texas Hold'em online"}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              lineHeight: 1.35,
              opacity: 0.85,
              maxWidth: 820,
            }}
          >
            Private tables, contests, and offline practice — free on pokr.site
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 24,
            letterSpacing: '0.08em',
            opacity: 0.75,
          }}
        >
          pokr.site
        </div>
      </div>
    ),
    { ...size },
  );
}
