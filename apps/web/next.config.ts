import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    cpus: 2,
  },
};
export default config;
