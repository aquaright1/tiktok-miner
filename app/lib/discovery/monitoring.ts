import { QueueConfig } from './queue-config';
import { DiscoveryScheduler } from './scheduler';
import { QueueMetrics, ScheduledJob } from './types';
import { logger } from '../logger';

export interface PipelineStatus {
  isRunning: boolean;
  queues: QueueStatus[];
  scheduledJobs: ScheduledJob[];
  alerts: Alert[];
  performance: PerformanceMetrics;
}

export interface QueueStatus {
  name: string;
  metrics: QueueMetrics;
  health: 'healthy' | 'warning' | 'critical';
}

export interface Alert {
  id: string;
  type: 'queue_backlog' | 'high_error_rate' | 'slow_processing' | 'system';
  severity: 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
  details?: any;
}

export interface PerformanceMetrics {
  totalProcessed: number;
  successRate: number;
  averageProcessingTime: number;
  throughput: number; // jobs per hour
}

export class DiscoveryMonitoring {
  private queueConfig: QueueConfig;
  private alerts: Alert[] = [];
  private performanceHistory: Map<string, number[]> = new Map();

  constructor(queueConfig: QueueConfig) {
    this.queueConfig = queueConfig;
  }

  /**
   * Get comprehensive pipeline status
   */
  async getPipelineStatus(
    scheduler: DiscoveryScheduler,
    isRunning: boolean
  ): Promise<PipelineStatus> {
    // Get queue metrics
    const queueNames = ['creator-discovery', 'creator-evaluation', 'creator-aggregation'];
    const queues = await Promise.all(
      queueNames.map(async (name) => {
        const metrics = await this.queueConfig.getQueueMetrics(name);
        const health = this.assessQueueHealth(name, metrics);
        return { name, metrics, health };
      })
    );

    // Calculate performance metrics
    const performance = this.calculatePerformanceMetrics(queues);

    // Check for alerts
    this.checkForAlerts(queues, performance);

    return {
      isRunning,
      queues,
      scheduledJobs: scheduler.getStatus(),
      alerts: this.getRecentAlerts(),
      performance,
    };
  }

  /**
   * Assess queue health
   */
  private assessQueueHealth(name: string, metrics: QueueMetrics): 'healthy' | 'warning' | 'critical' {
    // Critical if error rate > 20% or queue backed up significantly
    if (metrics.errorRate > 20 || metrics.pending > 1000) {
      return 'critical';
    }

    // Warning if error rate > 10% or processing is slow
    if (metrics.errorRate > 10 || 
        metrics.pending > 500 || 
        metrics.averageProcessingTime > 30000) {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * Calculate overall performance metrics
   */
  private calculatePerformanceMetrics(queues: QueueStatus[]): PerformanceMetrics {
    let totalProcessed = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    let totalProcessingTime = 0;
    let processedCount = 0;

    for (const queue of queues) {
      totalCompleted += queue.metrics.completed;
      totalFailed += queue.metrics.failed;
      totalProcessed += queue.metrics.completed + queue.metrics.failed;
      
      if (queue.metrics.averageProcessingTime > 0) {
        totalProcessingTime += queue.metrics.averageProcessingTime;
        processedCount++;
      }
    }

    const successRate = totalProcessed > 0 
      ? (totalCompleted / totalProcessed) * 100 
      : 100;

    const averageProcessingTime = processedCount > 0 
      ? totalProcessingTime / processedCount 
      : 0;

    // Calculate throughput (jobs per hour)
    const throughput = queues.reduce(
      (sum, q) => sum + q.metrics.processingRate * 60,
      0
    );

    return {
      totalProcessed,
      successRate,
      averageProcessingTime,
      throughput,
    };
  }

  /**
   * Check for alerts
   */
  private checkForAlerts(queues: QueueStatus[], performance: PerformanceMetrics): void {
    const now = new Date();

    // Check queue backlogs
    for (const queue of queues) {
      if (queue.metrics.pending > 1000) {
        this.addAlert({
          id: `backlog-${queue.name}-${now.getTime()}`,
          type: 'queue_backlog',
          severity: 'error',
          message: `Queue ${queue.name} has ${queue.metrics.pending} pending jobs`,
          timestamp: now,
          details: { queueName: queue.name, pending: queue.metrics.pending },
        });
      } else if (queue.metrics.pending > 500) {
        this.addAlert({
          id: `backlog-${queue.name}-${now.getTime()}`,
          type: 'queue_backlog',
          severity: 'warning',
          message: `Queue ${queue.name} backlog growing: ${queue.metrics.pending} pending`,
          timestamp: now,
          details: { queueName: queue.name, pending: queue.metrics.pending },
        });
      }

      // Check error rates
      if (queue.metrics.errorRate > 20) {
        this.addAlert({
          id: `errors-${queue.name}-${now.getTime()}`,
          type: 'high_error_rate',
          severity: 'error',
          message: `Queue ${queue.name} error rate: ${queue.metrics.errorRate.toFixed(1)}%`,
          timestamp: now,
          details: { queueName: queue.name, errorRate: queue.metrics.errorRate },
        });
      }

      // Check processing speed
      if (queue.metrics.averageProcessingTime > 60000) {
        this.addAlert({
          id: `slow-${queue.name}-${now.getTime()}`,
          type: 'slow_processing',
          severity: 'warning',
          message: `Queue ${queue.name} slow processing: ${(queue.metrics.averageProcessingTime / 1000).toFixed(1)}s average`,
          timestamp: now,
          details: { 
            queueName: queue.name, 
            avgTime: queue.metrics.averageProcessingTime 
          },
        });
      }
    }

    // Check overall performance
    if (performance.successRate < 80) {
      this.addAlert({
        id: `success-rate-${now.getTime()}`,
        type: 'system',
        severity: 'error',
        message: `Low success rate: ${performance.successRate.toFixed(1)}%`,
        timestamp: now,
        details: { successRate: performance.successRate },
      });
    }
  }

  /**
   * Add alert with deduplication
   */
  private addAlert(alert: Alert): void {
    // Remove old alerts (keep last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.alerts = this.alerts.filter(a => a.timestamp > oneHourAgo);

    // Check for duplicate alerts in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isDuplicate = this.alerts.some(
      a => a.type === alert.type && 
           a.message === alert.message && 
           a.timestamp > fiveMinutesAgo
    );

    if (!isDuplicate) {
      this.alerts.push(alert);
      
      // Log alert
      const logMethod = alert.severity === 'error' ? 'error' : 
                       alert.severity === 'warning' ? 'warn' : 'info';
      logger[logMethod](`Discovery Pipeline Alert: ${alert.message}`, alert.details);
    }
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 10): Alert[] {
    return this.alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(metric: string, hours: number = 24): number[] {
    const key = `${metric}-${hours}`;
    return this.performanceHistory.get(key) || [];
  }

  /**
   * Record performance metric
   */
  recordPerformanceMetric(metric: string, value: number): void {
    const key = `${metric}-24`; // 24 hour history
    const history = this.performanceHistory.get(key) || [];
    
    history.push(value);
    
    // Keep last 24 hours (assuming recorded every hour)
    if (history.length > 24) {
      history.shift();
    }
    
    this.performanceHistory.set(key, history);
  }

  /**
   * Get health summary
   */
  getHealthSummary(): {
    overall: 'healthy' | 'warning' | 'critical';
    issues: string[];
  } {
    const recentAlerts = this.getRecentAlerts();
    const criticalAlerts = recentAlerts.filter(a => a.severity === 'error');
    const warningAlerts = recentAlerts.filter(a => a.severity === 'warning');

    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    const issues: string[] = [];

    if (criticalAlerts.length > 0) {
      overall = 'critical';
      issues.push(...criticalAlerts.map(a => a.message));
    } else if (warningAlerts.length > 0) {
      overall = 'warning';
      issues.push(...warningAlerts.map(a => a.message));
    }

    return { overall, issues };
  }
}