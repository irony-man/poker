/** @type {import('tailwindcss').Config} */

/** Every color reads from the canonical CSS vars in app/theme.css so the two cannot drift. */
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
        /** Semantic roles — stable across Classic / Arcade / Glass */
        page: token('bg-page'),
        panel: token('bg-panel'),
        raised: token('bg-raised'),
        overlay: token('bg-overlay'),
        chrome: token('bg-chrome'),
        primary: token('text-primary'),
        muted: token('text-muted'),
        /** Border pigment — `border-subtle/15`, `border-strong`. */
        subtle: token('border-subtle'),
        strong: token('border-strong'),

        /** Brand / domain (felt, money, status, cards) + migration aliases */
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
          back: token('card-back'),
          red: token('card-red'),
          ink: token('card-ink'),
        },
        /**
         * Designer roles with no legacy slot (§5.2). Unused by components except
         * where a hard-coded theme colour was replaced by the same pigment.
         */
        ds: {
          raised: token('ds-raised'),
          placeholder: token('ds-text-placeholder'),
          caption: token('ds-text-muted'),
          'on-accent': token('ds-on-accent'),
          'success-text': token('ds-success-text'),
          'new-badge': token('ds-new-badge'),
          'cp-team-a': token('ds-cp-team-a'),
          'cp-team-a-bg': token('ds-cp-team-a-bg'),
          'cp-team-b': token('ds-cp-team-b'),
          'cp-team-b-bg': token('ds-cp-team-b-bg'),
          'tp-hero': token('ds-tp-hero'),
          'tp-win': token('ds-tp-win'),
          'tp-pack': token('ds-tp-pack'),
          chip: token('ds-chip'),
          whuffie: token('ds-whuffie'),
          gold: token('ds-gold'),
          'gold-light': token('ds-gold-light'),
          'gold-dim': token('ds-gold-dim'),
          'brand-ink': token('ds-brand-ink'),
          'felt-center': token('ds-felt-center'),
          'felt-mid': token('ds-felt-mid'),
          'felt-edge': token('ds-felt-edge'),
          rim: token('ds-rim'),
          paper: token('ds-paper'),
          card: token('ds-card'),
        },
      },
      fontFamily: {
        'pk-display': ['var(--font-pk-display)', 'Outfit', 'sans-serif'],
        'pk-body': ['var(--font-pk-body)', 'Inter', 'sans-serif'],
        display: ['var(--font-display)', 'RF Tone', 'Segoe UI', 'sans-serif'],
        body: ['var(--font-body)', 'Segoe UI', 'sans-serif'],
        serif: ['var(--font-serif)', 'RF Tone', 'Segoe UI', 'sans-serif'],
        heading: ['var(--font-heading)', 'RF Tone', 'Segoe UI', 'sans-serif'],
      },
      spacing: {
        'pk-1': 'var(--pk-space-1)',
        'pk-2': 'var(--pk-space-2)',
        'pk-3': 'var(--pk-space-3)',
        'pk-4': 'var(--pk-space-4)',
        'pk-5': 'var(--pk-space-5)',
        'pk-6': 'var(--pk-space-6)',
        'pk-7': 'var(--pk-space-7)',
        'pk-8': 'var(--pk-space-8)',
        'pk-9': 'var(--pk-space-9)',
        'pk-10': 'var(--pk-space-10)',
      },
      borderRadius: {
        'pk-sm': 'var(--pk-radius-sm)',
        'pk-md': 'var(--pk-radius-md)',
        'pk-lg': 'var(--pk-radius-lg)',
        'pk-xl': 'var(--pk-radius-xl)',
        'pk-2xl': 'var(--pk-radius-2xl)',
        'pk-full': 'var(--pk-radius-full)',
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      fontSize: {
        'pk-display-xl': ['54px', { lineHeight: '58px', fontWeight: '700' }],
        'pk-display-lg': ['34px', { lineHeight: '40px', fontWeight: '700' }],
        'pk-h3': ['22px', { lineHeight: '28px', fontWeight: '600' }],
        'pk-h4': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'pk-body-lg': ['16px', { lineHeight: '24px' }],
        'pk-body-md': ['15px', { lineHeight: '22px' }],
        'pk-label': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        'pk-caption': ['13px', { lineHeight: '18px' }],
        'pk-overline': ['12px', { lineHeight: '16px', letterSpacing: '0.07em', fontWeight: '600' }],
      },
      boxShadow: {
        'pk-sm': 'var(--pk-shadow-sm)',
        'pk-md': 'var(--pk-shadow-md)',
        'pk-lg': 'var(--pk-shadow-lg)',
        /** Prefixed to avoid clashing with semantic colors `panel` / `raised`. */
        'elev-panel': 'var(--shadow-panel)',
        'elev-raised': 'var(--shadow-raised)',
        glow: 'var(--shadow-glow)',
        card: 'var(--shadow-card)',
        felt: 'inset 0 0 120px rgb(8 2 16 / 0.5), 0 12px 36px rgb(var(--ds-brand-ink) / 0.2)',
        /** Legacy aliases → elev-* (prefer elev-panel / elev-raised in new code). */
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(var(--on-chrome) / 0.45)' },
          '50%': { boxShadow: '0 0 0 8px rgb(var(--on-chrome) / 0)' },
        },
        'live-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        'select-menu-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'chart-draw': {
          from: { strokeDashoffset: '1' },
          to: { strokeDashoffset: '0' },
        },
        'chart-fade': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'hud-pulse': 'hud-pulse 1.6s var(--ease-out) infinite',
        'live-blink': 'live-blink 1.4s ease-in-out infinite',
        'select-menu-in': 'select-menu-in 120ms var(--ease-out)',
        'chart-draw': 'chart-draw 700ms var(--ease-out) both',
        'chart-fade': 'chart-fade 500ms ease-out 200ms both',
      },
    },
  },
  plugins: [],
};
