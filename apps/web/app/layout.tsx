import type { Metadata } from 'next';
import { Inter, Inter_Tight, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { AppChrome } from '@/components/AppChrome';

const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const display = Inter_Tight({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Felt — Texas Hold'em",
  description: 'Private No-Limit Texas Hold\'em for home games',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full ${body.variable} ${display.variable} ${serif.variable}`}
    >
      <body className="min-h-dvh flex flex-col">
        <AppChrome
          header={
            <header className="shrink-0 relative border-b border-brass/15 bg-ink-panel/80 backdrop-blur-md">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brass/40 to-transparent" />
              <div className="px-3 sm:px-8 py-2 sm:py-3.5 flex items-center justify-between gap-3">
                <a href="/" className="group flex items-center gap-2 sm:gap-3">
                  <span className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-md border border-brass/40 bg-ink-raised font-serif text-base sm:text-lg text-brass shadow-glow">
                    F
                  </span>
                  <span className="font-serif text-xl sm:text-2xl tracking-[0.04em] text-brass-light group-hover:text-brass transition">
                    Felt
                  </span>
                </a>
                <span className="hidden sm:inline status-chip border-positive/30 bg-positive/10 text-positive">
                  <span className="h-1.5 w-1.5 rounded-full bg-positive animate-live-blink" />
                  Live tables
                </span>
              </div>
            </header>
          }
        >
          {children}
        </AppChrome>
      </body>
    </html>
  );
}
