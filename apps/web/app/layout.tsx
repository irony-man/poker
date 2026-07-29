import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Felt — Texas Hold'em",
  description: 'Private No-Limit Texas Hold\'em for home games',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-dvh flex flex-col">
        <header className="shrink-0 relative border-b border-cyan/15 bg-ink-panel/80 backdrop-blur-md">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
          <div className="px-3 sm:px-8 py-2 sm:py-3.5 flex items-center justify-between gap-3">
            <a href="/" className="group flex items-center gap-2 sm:gap-3">
              <span className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded border border-gold/40 bg-ink-raised font-display text-base sm:text-lg font-bold text-gold shadow-glow">
                F
              </span>
              <span className="font-display text-xl sm:text-2xl font-bold tracking-[0.08em] text-gold uppercase group-hover:text-gold-light transition">
                Felt
              </span>
            </a>
            <span className="hidden sm:inline status-chip border-felt-neon/30 bg-felt-neon/10 text-felt-neon">
              <span className="h-1.5 w-1.5 rounded-full bg-felt-neon animate-live-blink" />
              Live tables
            </span>
          </div>
        </header>
        <main className="flex-1 min-h-0 px-3 sm:px-6 lg:px-8 py-2 sm:py-5">{children}</main>
      </body>
    </html>
  );
}
