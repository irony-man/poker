import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@poker/protocol', '@poker/engine', '@letele/playing-cards'],
};

export default nextConfig;
