/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Configuração para resolver problemas com xlsx
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
    
    // Otimização para chunks
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          xlsx: {
            name: 'xlsx',
            chunks: 'all',
            test: /[\/\\]node_modules[\/\\]xlsx[\/\\]/,
            priority: 30,
            reuseExistingChunk: true,
          },
        },
      }
    }
    
    return config
  },
}

export default nextConfig
