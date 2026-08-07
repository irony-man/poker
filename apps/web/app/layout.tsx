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
  title: "POKR — Texas Hold'em",
  description: 'Private No-Limit Texas Hold\'em for home games',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full ${body.variable} ${display.variable} ${serif.variable}`}
    >
      <body className="min-h-dvh flex flex-col">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
