/** @type {import('tailwindcss').Config} */

/** Every color reads from the canonical CSS vars in app/globals.css so the two cannot drift. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: token('ink'),
          panel: token('ink-panel'),
          raised: token('ink-raised'),
          overlay: token('ink-overlay'),
          strong: token('ink-strong'),
          'strong-muted': token('ink-strong-muted'),
        },
        sidebar: token('sidebar'),
        mushroom: token('mushroom'),
        'on-chrome': token('on-chrome'),
        felt: {
          DEFAULT: token('felt'),
          deep: token('felt-deep'),
          rim: token('felt-rim'),
          edge: token('felt-rim-edge'),
          /** Legacy alias — the old neon green now reads as the positive state. */
          neon: token('positive'),
        },
        brass: {
          DEFAULT: token('brass'),
          light: token('brass-light'),
          dim: token('brass-dim'),
        },
        /** Legacy alias for `brass`, kept until components migrate. */
        gold: {
          DEFAULT: token('brass'),
          light: token('brass-light'),
          dim: token('brass-dim'),
        },
        cream: {
          DEFAULT: token('cream'),
          muted: token('cream-muted'),
        },
        patina: {
          DEFAULT: token('patina'),
          dim: token('patina-dim'),
        },
        /** Legacy alias — the old cyan accent becomes patina. */
        cyan: {
          DEFAULT: token('patina'),
          dim: token('patina-dim'),
        },
        danger: token('danger'),
        positive: token('positive'),
        card: {
          face: token('card-face'),
          red: token('card-red'),
          ink: token('card-ink'),
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'RF Tone', 'Segoe UI', 'sans-serif'],
        body: ['var(--font-body)', 'Segoe UI', 'sans-serif'],
        serif: ['var(--font-serif)', 'RF Tone', 'Segoe UI', 'sans-serif'],
        heading: ['var(--font-heading)', 'RF Tone', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        raised: 'var(--shadow-raised)',
        glow: 'var(--shadow-glow)',
        card: 'var(--shadow-card)',
        felt: 'inset 0 0 120px rgb(8 2 16 / 0.5), 0 12px 36px rgb(29 4 50 / 0.2)',
        /** Legacy aliases. */
        hud: 'var(--shadow-panel)',
        'glow-neon': 'var(--shadow-glow)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        slow: 'var(--dur-slow)',
      },
      keyframes: {
        'hud-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(var(--mushroom) / 0.45)' },
          '50%': { boxShadow: '0 0 0 8px rgb(var(--mushroom) / 0)' },
        },
        'live-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'hud-pulse': 'hud-pulse 1.6s var(--ease-out) infinite',
        'live-blink': 'live-blink 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
