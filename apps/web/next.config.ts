import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@poker/protocol', '@poker/engine'],
};

export default nextConfig;
