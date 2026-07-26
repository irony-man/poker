/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#146b42',
          deep: '#0a2f1d',
          rim: '#1c140a',
          neon: '#2aff9a',
        },
        gold: {
          DEFAULT: '#e0b43a',
          light: '#ffe29a',
          dim: '#8a6a18',
        },
        ink: {
          DEFAULT: '#07090d',
          panel: '#0d1218',
          raised: '#141b24',
        },
        cream: '#e8eef5',
        cyan: {
          DEFAULT: '#3de0ff',
          dim: '#1a7a8c',
        },
      },
      fontFamily: {
        display: ['"Oxanium"', 'Segoe UI', 'sans-serif'],
        body: ['"Rajdhani"', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        felt: 'inset 0 0 140px rgba(0,0,0,0.55), 0 0 40px rgba(20,107,66,0.25)',
        hud: '0 0 0 1px rgba(61,224,255,0.12), 0 12px 40px rgba(0,0,0,0.45)',
        glow: '0 0 24px rgba(224,180,58,0.35)',
        'glow-neon': '0 0 18px rgba(42,255,154,0.35)',
      },
      keyframes: {
        'hud-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(224,180,58,0.55)' },
          '50%': { boxShadow: '0 0 0 8px rgba(224,180,58,0)' },
        },
        'live-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'hud-pulse': 'hud-pulse 1.6s ease-out infinite',
        'live-blink': 'live-blink 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
