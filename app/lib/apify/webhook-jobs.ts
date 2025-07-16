import { WebhookHandler } from './webhook-handler';
import { processRetryQueue, monitorDeadLetterQueue } from './webhook-queue';
import { prisma } from '@/lib/prisma';

/**
 * Background job configuration for webhook processing
 */
export const WEBHOOK_JOB_CONFIG = {
  retryInterval: 60000, // 1 minute
  deadLetterCheckInterval: 300000, // 5 minutes
  cleanupInterval: 3600000, // 1 hour
  maxWebhookAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

/**
 * Start all webhook background jobs
 */
export function startWebhookJobs(): void {
  console.log('Starting webhook background jobs...');

  // Retry failed webhooks
  const retryInterval = setInterval(async () => {
    try {
      await processRetryQueue();
    } catch (error) {
      console.error('Error processing retry queue:', error);
    }
  }, WEBHOOK_JOB_CONFIG.retryInterval);

  // Monitor dead letter queue
  const deadLetterInterval = setInterval(async () => {
    try {
      const deadLetterInfo = await monitorDeadLetterQueue();
      
      if (deadLetterInfo.count > 0) {
        console.warn(`Dead letter queue has ${deadLetterInfo.count} webhooks`);
        
        // Send alert if too many webhooks in dead letter queue
        if (deadLetterInfo.count > 10) {
          await sendDeadLetterAlert(deadLetterInfo.count);
        }
      }
    } catch (error) {
      console.error('Error monitoring dead letter queue:', error);
    }
  }, WEBHOOK_JOB_CONFIG.deadLetterCheckInterval);

  // Cleanup old webhooks
  const cleanupInterval = setInterval(async () => {
    try {
      await cleanupOldWebhooks();
    } catch (error) {
      console.error('Error cleaning up old webhooks:', error);
    }
  }, WEBHOOK_JOB_CONFIG.cleanupInterval);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Stopping webhook background jobs...');
    clearInterval(retryInterval);
    clearInterval(deadLetterInterval);
    clearInterval(cleanupInterval);
  });
}

/**
 * Process webhooks that need immediate retry
 * This can be called manually or by a cron job
 */
export async function processImmediateRetries(): Promise<void> {
  const handler = new WebhookHandler();
  await handler.retryFailedWebhooks();
}

/**
 * Process dead letter queue webhooks
 * This should be called manually after investigating the failures
 */
export async function processDeadLetterWebhooks(): Promise<void> {
  const handler = new WebhookHandler();
  await handler.processDeadLetterQueue();
}

/**
 * Clean up old webhook records
 */
async function cleanupOldWebhooks(): Promise<void> {
  const cutoffDate = new Date(Date.now() - WEBHOOK_JOB_CONFIG.maxWebhookAge);
  
  const deleted = await prisma.webhookEvent.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
      status: { in: ['completed', 'dead_letter'] }
    }
  });

  if (deleted.count > 0) {
    console.log(`Cleaned up ${deleted.count} old webhook records`);
  }
}

/**
 * Send alert for dead letter queue
 */
async function sendDeadLetterAlert(count: number): Promise<void> {
  console.error(`ALERT: ${count} webhooks in dead letter queue require attention`);
  
  // TODO: Implement actual alerting mechanism
  // This could send an email, Slack message, or create an incident
  
  // Log to monitoring system
  await prisma.apiAlert.create({
    data: {
      platform: 'apify',
      alertType: 'ERROR_RATE_HIGH',
      threshold: 10,
      message: `${count} webhooks in dead letter queue require manual intervention`,
      metadata: {
        webhookCount: count,
        type: 'dead_letter_queue'
      }
    }
  });
}

/**
 * Get webhook processing statistics
 */
export async function getWebhookStats(): Promise<{
  total: number;
  successful: number;
  failed: number;
  pending: number;
  averageProcessingTime: number;
  successRate: number;
}> {
  const [total, successful, failed, pending] = await Promise.all([
    prisma.webhookEvent.count({ where: { provider: 'apify' } }),
    prisma.webhookEvent.count({ where: { provider: 'apify', status: 'completed' } }),
    prisma.webhookEvent.count({ where: { provider: 'apify', status: { in: ['failed', 'dead_letter'] } } }),
    prisma.webhookEvent.count({ where: { provider: 'apify', status: { in: ['pending', 'processing'] } } })
  ]);

  // Calculate average processing time for completed webhooks
  const processingTimes = await prisma.$queryRaw<Array<{ avg_time: number }>>`
    SELECT AVG(EXTRACT(EPOCH FROM ("processedAt" - "receivedAt"))) as avg_time
    FROM "WebhookEvent"
    WHERE provider = 'apify' 
    AND status = 'completed' 
    AND "processedAt" IS NOT NULL
  `;

  const averageProcessingTime = processingTimes[0]?.avg_time || 0;
  const successRate = total > 0 ? (successful / total) * 100 : 0;

  return {
    total,
    successful,
    failed,
    pending,
    averageProcessingTime: Math.round(averageProcessingTime * 1000), // Convert to ms
    successRate: Math.round(successRate * 100) / 100
  };
}

/**
 * Initialize webhook system
 * This should be called on application startup
 */
export async function initializeWebhookSystem(): Promise<void> {
  console.log('Initializing webhook system...');

  // Start background jobs
  startWebhookJobs();

  // Process any pending webhooks on startup
  await processRetryQueue();

  // Log initial stats
  const stats = await getWebhookStats();
  console.log('Webhook system initialized:', stats);
}