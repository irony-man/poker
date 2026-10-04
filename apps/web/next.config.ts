import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

/** Next only auto-loads `apps/web/.env*`. Pull the repo-root `.env` so local `/api` rewrites match the Nest port. Later assignments in that file win. */
function applyRootEnv(): void {
  const file = resolve(__dirname, '../../.env');
  if (!existsSync(file)) return;
  const last = new Map<string, string>();
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key.startsWith('#')) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    last.set(key, val);
  }
  for (const [key, val] of last) {
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

applyRootEnv();

const securityHeaders = [
  // Browsers only honor HSTS over HTTPS (ignored on local http://).
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Voice chat needs microphone; keep camera/geo locked down.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=(self), interest-cohort=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

/** Upstream game server for `/api/*` rewrites (Docker: http://server:4000). */
const apiRewriteTarget = (
  process.env.API_REWRITE_TARGET ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  transpilePackages: ['@poker/protocol', '@poker/engine', '@letele/playing-cards'],
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
        pathname: '/**',
      },
    ],
    // Avoid Next 15 disk LRU errors from corrupt/empty entries under `.next/cache/images` in dev.
    ...(isDev ? { maximumDiskCacheSize: 0 } : {}),
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // Canonical host: apex (pokr.site), not www.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.pokr.site' }],
        destination: 'https://pokr.site/:path*',
        permanent: true,
      },
      // Host + join merged into /play.
      { source: '/host', destination: '/play', permanent: true },
      { source: '/join', destination: '/play?mode=join', permanent: true },
    ];
  },
  // Browser calls same-origin `/api/*`; Next proxies to the Nest server (no CORS).
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiRewriteTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
