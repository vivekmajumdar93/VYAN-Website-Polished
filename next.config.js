/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: 'github.com' }
    ]
  },
  experimental: {
    optimizePackageImports: ['three', 'gsap']
  },
  turbopack: { root: '/home/user/VYAN-Website-Polished' },
  webpack(config) {
    config.module.rules.push({ test: /\.glsl$/, type: 'asset/source' });
    return config;
  },
};

module.exports = nextConfig;
