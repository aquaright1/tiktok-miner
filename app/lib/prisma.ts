import { PrismaClient } from '@prisma/client'
import { config } from './config'
import { logger } from './logger'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// Configure database URL with proper pgbouncer settings
function configureDatabaseUrl(urlString: string): string {
  try {
    const url = new URL(urlString)
    
    // Add pgbouncer settings for Supabase pooler connections
    if (url.hostname.includes('pooler.supabase.com')) {
      url.searchParams.set('pgbouncer', 'true')
      url.searchParams.set('statement_cache_size', '0')
    }
    
    return url.toString()
  } catch (error) {
    logger.error('Invalid DATABASE_URL format', error as Error)
    throw new Error(`Invalid DATABASE_URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Create singleton PrismaClient instance
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: config.app.nodeEnv === 'development' 
      ? ['error', 'warn'] 
      : ['error'],
    datasources: {
      db: {
        url: configureDatabaseUrl(config.database.url)
      }
    }
  })

  // Add middleware for query performance logging in development
  if (config.app.nodeEnv === 'development') {
    client.$use(async (params, next) => {
      const start = Date.now()
      const result = await next(params)
      const duration = Date.now() - start
      
      if (duration > 1000) { // Log slow queries (>1s)
        logger.warn('Slow database query', {
          model: params.model,
          action: params.action,
          duration,
        })
      }
      
      return result
    })
  }

  return client
}

// Export singleton instance
export const prisma = global.prisma || createPrismaClient()

// Prevent multiple instances in development
if (config.app.nodeEnv !== 'production') {
  global.prisma = prisma
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})