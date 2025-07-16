/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  images: {
    domains: ['avatars.githubusercontent.com'],
  },
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
      bodySizeLimit: '2mb'
    }
  },
  // Allow dynamic routes with slashes
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  async rewrites() {
    return [
      {
        source: '/repos/:owner/:repo',
        destination: '/repos/:owner/:repo',
        has: [
          {
            type: 'query',
            key: 'owner',
            value: undefined
          }
        ]
      }
    ]
  }
}
