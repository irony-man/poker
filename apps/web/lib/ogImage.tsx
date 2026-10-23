import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

export function ogImageResponse(title: string, subtitle: string) {
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
          background: 'linear-gradient(145deg, #3d1766 0%, #1e0536 55%, #13021f 100%)',
          color: '#e8dad8',
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
            {title}
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
            {subtitle}
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
    { ...OG_SIZE },
  );
}
