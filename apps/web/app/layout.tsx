import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppChrome } from '@/components/AppChrome';

const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: "POKR — Texas Hold'em",
  description: 'Private No-Limit Texas Hold\'em for home games',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${body.variable}`}>
      <body className="flex h-dvh flex-col overflow-hidden">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
