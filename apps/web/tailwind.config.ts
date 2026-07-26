/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#1a5c3a',
          deep: '#0f3d28',
          rim: '#1a1208',
        },
        gold: {
          DEFAULT: '#c9a227',
          light: '#e8d48b',
        },
        ink: '#0c0a08',
        cream: '#f3efe6',
      },
      fontFamily: {
        display: ['"Libre Baskerville"', 'Georgia', 'serif'],
        body: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        felt: 'inset 0 0 120px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
};
