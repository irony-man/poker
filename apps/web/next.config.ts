import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@poker/protocol'],
};

export default nextConfig;
