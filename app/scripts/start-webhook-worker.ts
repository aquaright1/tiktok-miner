#!/usr/bin/env tsx

import { webhookWorker } from '@/lib/workers/webhook-worker';
import { logger } from '@/lib/logger';
import { webhookWorkerManager } from '@/lib/workers/webhook-worker-manager';

async function startWebhookWorker() {
  logger.info('🚀 Starting TikTok Miner Webhook Worker Process...');
  
  try {
    // Initialize the webhook worker manager first
    logger.info('📦 Initializing webhook worker manager...');
    await webhookWorkerManager.initialize();
    logger.info('✅ Webhook worker manager initialized');

    // Check worker health
    if (!webhookWorker.isHealthy()) {
      throw new Error('Webhook worker is not healthy');
    }

    // Get worker info
    const workerInfo = await webhookWorker.getWorkerInfo();
    logger.info('👷 Webhook worker started successfully', {
      pid: workerInfo.pid,
      concurrency: workerInfo.concurrency,
      isRunning: workerInfo.isRunning,
      uptime: workerInfo.uptime,
    });

    // Log startup configuration
    logger.info('🔧 Worker Configuration', {
      redisUrl: process.env.REDIS_URL ? 'configured' : 'not configured',
      concurrency: process.env.WEBHOOK_WORKER_CONCURRENCY || '5',
      environment: process.env.NODE_ENV || 'development',
      processId: process.pid,
      nodeVersion: process.version,
    });

    // Set up health check interval
    const healthCheckInterval = setInterval(async () => {
      try {
        if (webhookWorker.isHealthy()) {
          const stats = await webhookWorkerManager.getQueueStats();
          logger.info('💓 Worker Health Check', {
            isHealthy: true,
            queueStats: {
              waiting: stats.waiting,
              active: stats.active,
              completed: stats.completed,
              failed: stats.failed,
            },
          });
        } else {
          logger.warn('⚠️ Worker Health Check Failed', {
            isHealthy: false,
            pid: process.pid,
          });
        }
      } catch (error) {
        logger.error('❌ Health check error', {
          error: error.message,
        });
      }
    }, 30000); // Every 30 seconds

    // Graceful shutdown handling
    const shutdown = async () => {
      logger.info('🛑 Received shutdown signal, gracefully shutting down...');
      
      clearInterval(healthCheckInterval);
      
      try {
        await webhookWorker.shutdown();
        logger.info('✅ Webhook worker shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown', { error: error.message });
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGUSR2', shutdown); // For PM2

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
      process.exit(1);
    });

    logger.info('🎉 Webhook worker is now running and ready to process jobs!');
    logger.info('📊 Available Commands:');
    logger.info('   - Worker Status: curl http://localhost:3000/api/workers/webhook/status');
    logger.info('   - Pause Worker: curl -X POST http://localhost:3000/api/workers/webhook/status -d \'{"action":"pause"}\'');
    logger.info('   - Resume Worker: curl -X POST http://localhost:3000/api/workers/webhook/status -d \'{"action":"resume"}\'');
    logger.info('   - Queue Health: curl "http://localhost:3000/api/queue/control/?queue=webhook-processing"');

    // Keep the process alive
    process.stdin.resume();

  } catch (error) {
    logger.error('💥 Failed to start webhook worker', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Start the worker if this script is run directly
if (require.main === module) {
  startWebhookWorker().catch((error) => {
    console.error('Fatal error starting webhook worker:', error);
    process.exit(1);
  });
}

export { startWebhookWorker };