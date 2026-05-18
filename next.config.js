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
  }
};

module.exports = nextConfig;
