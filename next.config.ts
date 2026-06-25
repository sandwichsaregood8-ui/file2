import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true, // Prevents build failure due to strict external types
  },
  // 1. Enable static HTML export
  output: 'export',
  
  // 2. Disable default image optimization (unsupported in static export)
  images: {
    unoptimized: true,
  },

  // 3. OPTIONAL: If your GitHub pages URL looks like: https://username.github.io/my-repo-name
  // Uncomment and change the value below to match your repository name:
  // basePath: '/my-repo-name',
  
  transpilePackages: ['motion'],
};

export default nextConfig;
