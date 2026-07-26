import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Felt — Texas Hold\'em',
  description: 'Private No-Limit Texas Hold\'em for home games',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-dvh flex flex-col">
        <header className="shrink-0 px-4 sm:px-8 py-4 flex items-baseline justify-between border-b border-cream/10">
          <a href="/" className="font-display text-2xl tracking-tight text-gold">
            Felt
          </a>
          <span className="text-xs uppercase tracking-[0.2em] text-cream/40">No-Limit Hold&apos;em</span>
        </header>
        <main className="flex-1 min-h-0 px-4 sm:px-8 py-4">{children}</main>
      </body>
    </html>
  );
}
