import type { NextConfig } from 'next';

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
    ];
  },
};

export default nextConfig;
