import { HealthCheckResult, PlatformClient } from './types';
import { logger } from '../logger';
import axios from 'axios';

export interface HealthMonitorOptions {
  checkInterval?: number; // milliseconds
  timeout?: number; // milliseconds
  enableAutoRecovery?: boolean;
  alertThreshold?: number; // number of consecutive failures before alerting
}

export interface ServiceHealthCheck {
  name: string;
  url?: string;
  checkFunction: () => Promise<boolean>;
  critical?: boolean;
}

export class HealthMonitor {
  private healthChecks: Map<string, ServiceHealthCheck> = new Map();
  private healthStatus: Map<string, HealthCheckResult> = new Map();
  private checkInterval?: NodeJS.Timer;
  private failureCounts: Map<string, number> = new Map();

  constructor(private options: HealthMonitorOptions = {}) {
    this.options = {
      checkInterval: 60000, // 1 minute default
      timeout: 5000, // 5 seconds default
      enableAutoRecovery: true,
      alertThreshold: 3,
      ...options
    };
  }

  registerHealthCheck(check: ServiceHealthCheck): void {
    this.healthChecks.set(check.name, check);
    this.failureCounts.set(check.name, 0);
    logger.info(`Registered health check: ${check.name}`);
  }

  async startMonitoring(): Promise<void> {
    // Run initial health check
    await this.checkAllServices();

    // Set up periodic checks
    this.checkInterval = setInterval(async () => {
      await this.checkAllServices();
    }, this.options.checkInterval!);

    logger.info('Health monitoring started');
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    logger.info('Health monitoring stopped');
  }

  async checkAllServices(): Promise<Map<string, HealthCheckResult>> {
    const checks = Array.from(this.healthChecks.entries()).map(
      async ([name, check]) => {
        const result = await this.checkService(name, check);
        this.healthStatus.set(name, result);
        return [name, result] as [string, HealthCheckResult];
      }
    );

    await Promise.all(checks);
    
    // Log overall health status
    const overallHealth = this.getOverallHealth();
    logger.info('Health check completed', { 
      status: overallHealth.status,
      services: overallHealth.services.length 
    });

    return this.healthStatus;
  }

  private async checkService(
    name: string,
    check: ServiceHealthCheck
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.options.timeout);
      });

      const healthy = await Promise.race([
        check.checkFunction(),
        timeoutPromise
      ]);

      const latency = Date.now() - startTime;

      if (healthy) {
        this.failureCounts.set(name, 0);
        return {
          service: name,
          status: 'healthy',
          latency,
          lastChecked: new Date()
        };
      } else {
        throw new Error('Health check returned false');
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      const failureCount = (this.failureCounts.get(name) || 0) + 1;
      this.failureCounts.set(name, failureCount);

      // Determine status based on failure count and criticality
      let status: 'degraded' | 'unhealthy' = 'degraded';
      if (failureCount >= this.options.alertThreshold! || check.critical) {
        status = 'unhealthy';
      }

      // Log warning or error based on severity
      const logLevel = status === 'unhealthy' ? 'error' : 'warn';
      logger[logLevel](`Health check failed for ${name}`, {
        error: error.message,
        failureCount,
        latency
      });

      // Attempt auto-recovery if enabled
      if (this.options.enableAutoRecovery && status === 'unhealthy') {
        this.attemptRecovery(name, check);
      }

      return {
        service: name,
        status,
        latency,
        error: error.message,
        lastChecked: new Date()
      };
    }
  }

  private async attemptRecovery(name: string, check: ServiceHealthCheck): Promise<void> {
    logger.info(`Attempting auto-recovery for ${name}`);
    
    // Basic recovery strategies could be implemented here
    // For example: clearing caches, resetting connections, etc.
    
    // For now, just log the attempt
    setTimeout(async () => {
      const result = await this.checkService(name, check);
      if (result.status === 'healthy') {
        logger.info(`Auto-recovery successful for ${name}`);
      }
    }, 5000); // Try again after 5 seconds
  }

  getServiceHealth(serviceName: string): HealthCheckResult | null {
    return this.healthStatus.get(serviceName) || null;
  }

  getOverallHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: HealthCheckResult[];
    summary: {
      total: number;
      healthy: number;
      degraded: number;
      unhealthy: number;
    };
  } {
    const services = Array.from(this.healthStatus.values());
    const summary = {
      total: services.length,
      healthy: services.filter(s => s.status === 'healthy').length,
      degraded: services.filter(s => s.status === 'degraded').length,
      unhealthy: services.filter(s => s.status === 'unhealthy').length
    };

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    // Check for critical services
    const criticalUnhealthy = Array.from(this.healthChecks.entries())
      .filter(([name, check]) => check.critical)
      .some(([name]) => this.healthStatus.get(name)?.status === 'unhealthy');

    if (criticalUnhealthy || summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      services,
      summary
    };
  }

  getMetrics(): {
    uptime: number;
    averageLatency: Record<string, number>;
    errorRates: Record<string, number>;
  } {
    const services = Array.from(this.healthStatus.entries());
    
    const averageLatency: Record<string, number> = {};
    const errorRates: Record<string, number> = {};

    services.forEach(([name, status]) => {
      averageLatency[name] = status.latency || 0;
      errorRates[name] = status.status === 'unhealthy' ? 100 : 
                        status.status === 'degraded' ? 50 : 0;
    });

    // Calculate uptime (percentage of services that are healthy)
    const healthyCount = services.filter(([_, s]) => s.status === 'healthy').length;
    const uptime = services.length > 0 ? (healthyCount / services.length) * 100 : 0;

    return {
      uptime,
      averageLatency,
      errorRates
    };
  }

  // Predefined health checks for common services
  static createDatabaseHealthCheck(prisma: any): ServiceHealthCheck {
    return {
      name: 'database',
      critical: true,
      checkFunction: async () => {
        try {
          await prisma.$queryRaw`SELECT 1`;
          return true;
        } catch {
          return false;
        }
      }
    };
  }

  static createRedisHealthCheck(redis: any): ServiceHealthCheck {
    return {
      name: 'redis',
      critical: false,
      checkFunction: async () => {
        try {
          await redis.ping();
          return true;
        } catch {
          return false;
        }
      }
    };
  }

  static createHttpHealthCheck(
    name: string,
    url: string,
    critical: boolean = false
  ): ServiceHealthCheck {
    return {
      name,
      url,
      critical,
      checkFunction: async () => {
        try {
          const response = await axios.get(url, { 
            timeout: 5000,
            validateStatus: (status) => status < 500 
          });
          return response.status < 400;
        } catch {
          return false;
        }
      }
    };
  }

  static createPlatformHealthCheck(
    platform: string,
    client: PlatformClient
  ): ServiceHealthCheck {
    return {
      name: `platform_${platform}`,
      critical: false,
      checkFunction: async () => {
        try {
          // Try to get rate limit info as a basic health check
          const rateLimitInfo = client.getRateLimitInfo();
          return rateLimitInfo !== null;
        } catch {
          return false;
        }
      }
    };
  }
}