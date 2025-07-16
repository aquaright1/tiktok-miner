import { PrismaClient } from '@prisma/client';
import { 
  APIGatewayConfig, 
  APIGatewayRequest, 
  APIGatewayResponse,
  RouteDefinition,
  GatewayMetrics,
  APIGatewayError
} from './types';
import { RateLimiter, TokenBucketRateLimiter } from './rate-limiter';
import { APIKeyManager } from './api-key-manager';
import { RequestRouter } from './request-router';
import { ErrorHandler } from './error-handler';
import { APIGatewayLogger } from './logging';
import { HealthMonitor } from './health-monitor';
import { ConfigManager } from './config';
import { APITrackingMiddleware } from '../middleware/api-tracking';
import { logger } from '../logger';

export interface APIGatewayOptions {
  prisma?: PrismaClient;
  config?: Partial<APIGatewayConfig>;
  enableHealthChecks?: boolean;
  enableMetrics?: boolean;
}

export class APIGateway {
  private prisma: PrismaClient;
  private configManager: ConfigManager;
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private apiKeyManager: APIKeyManager;
  private router: RequestRouter;
  private errorHandler: ErrorHandler;
  private logger: APIGatewayLogger;
  private healthMonitor: HealthMonitor;
  private trackingMiddleware: APITrackingMiddleware;
  private metrics: GatewayMetrics = {
    requestCount: 0,
    errorCount: 0,
    averageLatency: 0,
    activeConnections: 0,
    rateLimitHits: 0,
    cacheHitRate: 0
  };
  private requestTimings: number[] = [];

  constructor(options: APIGatewayOptions = {}) {
    this.prisma = options.prisma || new PrismaClient();
    this.configManager = new ConfigManager();
    
    if (options.config) {
      this.configManager.updateConfig(options.config);
    }

    const config = this.configManager.getConfig();

    // Initialize components
    this.apiKeyManager = new APIKeyManager(this.prisma);
    this.router = new RequestRouter({
      defaultTimeout: 30000,
      transformErrors: true,
      enableCORS: true
    });
    this.errorHandler = new ErrorHandler({
      logErrors: config.monitoring.enabled,
      includeStackTrace: this.configManager.isDevelopment()
    });
    this.logger = new APIGatewayLogger({
      logLevel: config.monitoring.logLevel,
      logRequests: true,
      logResponses: true,
      logErrors: true,
      maskSensitiveData: !this.configManager.isDevelopment(),
      auditLog: true
    });
    this.healthMonitor = new HealthMonitor({
      checkInterval: 60000,
      timeout: 5000,
      enableAutoRecovery: true,
      alertThreshold: 3
    });
    this.trackingMiddleware = new APITrackingMiddleware(this.prisma);

    // Initialize rate limiters for each platform
    this.initializeRateLimiters(config);

    // Set up health checks if enabled
    if (options.enableHealthChecks !== false) {
      this.setupHealthChecks();
    }

    logger.info('API Gateway initialized');
  }

  private initializeRateLimiters(config: APIGatewayConfig): void {
    // TikTok rate limiter 
    this.rateLimiters.set('tiktok', new RateLimiter({
      windowMs: 60000,
      maxRequests: 30,
      keyGenerator: (id) => `tiktok:${id}`,
      onLimitReached: (id) => {
        this.logger.logRateLimitExceeded(id, 'tiktok', 30, 60000);
        this.metrics.rateLimitHits++;
      }
    }));
  }

  private setupHealthChecks(): void {
    // Database health check
    this.healthMonitor.registerHealthCheck(
      HealthMonitor.createDatabaseHealthCheck(this.prisma)
    );

    // Platform API health checks would go here
    // TODO: Implement platform-specific health checks for supported platforms
  }

  async handleRequest(request: APIGatewayRequest): Promise<APIGatewayResponse> {
    const startTime = Date.now();
    const requestId = this.logger.generateCorrelationId();
    this.metrics.requestCount++;
    this.metrics.activeConnections++;

    try {
      // Log incoming request
      this.logger.logRequest(request, requestId);

      // Validate API key
      const apiKeyData = await this.apiKeyManager.validateAPIKey(request.apiKey);
      
      // Check permissions
      const requiredPermission = `${request.platform}:${request.method.toLowerCase()}`;
      if (!this.apiKeyManager.checkPermission(apiKeyData, requiredPermission)) {
        throw new APIGatewayError(
          'Insufficient permissions',
          'FORBIDDEN',
          403,
          request.platform,
          { required: requiredPermission }
        );
      }

      // Apply rate limiting
      const rateLimiter = this.rateLimiters.get(request.platform);
      if (rateLimiter) {
        await rateLimiter.checkLimit(apiKeyData.id);
      }

      // Route the request
      const response = await this.errorHandler.handleWithRetry(
        () => this.router.route(request),
        this.configManager.getConfig().retry,
        request.platform
      );

      // Track API usage
      await this.trackingMiddleware.trackAPICall({
        platform: request.platform,
        endpoint: request.endpoint,
        execute: async () => response,
        userId: request.userId,
        metadata: {
          apiKeyId: apiKeyData.id,
          method: request.method
        }
      });

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, false);

      // Log response
      this.logger.logResponse(request, response, responseTime, requestId);

      return {
        ...response,
        headers: {
          ...response.headers,
          'X-Request-ID': requestId,
          'X-Response-Time': `${responseTime}ms`
        }
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, true);
      this.metrics.errorCount++;

      // Log error
      this.logger.logError(request, error, responseTime, requestId);

      // Transform and throw error
      throw this.errorHandler.transformError(error, request.platform);
    } finally {
      this.metrics.activeConnections--;
    }
  }

  private updateMetrics(responseTime: number, isError: boolean): void {
    this.requestTimings.push(responseTime);
    
    // Keep only last 1000 timings
    if (this.requestTimings.length > 1000) {
      this.requestTimings = this.requestTimings.slice(-1000);
    }

    // Calculate average latency
    this.metrics.averageLatency = this.requestTimings.reduce((a, b) => a + b, 0) / 
      this.requestTimings.length;
  }

  // Route registration methods
  registerRoute(route: RouteDefinition): void {
    this.router.registerRoute(route);
  }

  registerPlatformHandler(platform: string, handler: any): void {
    this.router.registerPlatformHandler(platform, handler);
  }

  // API Key management methods
  async createAPIKey(options: any): Promise<any> {
    const result = await this.apiKeyManager.createAPIKey(options);
    this.logger.logApiKeyCreated(options.name, options.permissions);
    return result;
  }

  async revokeAPIKey(keyId: string, reason?: string): Promise<void> {
    await this.apiKeyManager.revokeAPIKey(keyId);
    this.logger.logApiKeyRevoked(keyId, reason);
  }

  async rotateAPIKey(keyId: string): Promise<any> {
    return this.apiKeyManager.rotateAPIKey(keyId);
  }

  // Health and monitoring methods
  async getHealth(): Promise<any> {
    return this.healthMonitor.getOverallHealth();
  }

  async getDetailedHealth(): Promise<any> {
    const health = await this.healthMonitor.checkAllServices();
    return {
      timestamp: new Date(),
      services: Array.from(health.values()),
      metrics: this.healthMonitor.getMetrics()
    };
  }

  getMetrics(): GatewayMetrics & { uptime: number } {
    const processUptime = process.uptime();
    return {
      ...this.metrics,
      uptime: Math.floor(processUptime)
    };
  }

  getAuditLogs(filters?: any): any[] {
    return this.logger.getAuditLogs(filters);
  }

  // Lifecycle methods
  async start(): Promise<void> {
    await this.healthMonitor.startMonitoring();
    logger.info('API Gateway started');
  }

  async stop(): Promise<void> {
    this.healthMonitor.stopMonitoring();
    
    // Clean up rate limiters
    this.rateLimiters.forEach(limiter => {
      if (limiter instanceof RateLimiter) {
        limiter.destroy();
      }
    });

    await this.prisma.$disconnect();
    logger.info('API Gateway stopped');
  }

  // Configuration methods
  updateConfiguration(updates: Partial<APIGatewayConfig>): void {
    this.configManager.updateConfig(updates);
    
    // Reinitialize rate limiters with new config
    const config = this.configManager.getConfig();
    this.initializeRateLimiters(config);
  }

  getConfiguration(): APIGatewayConfig {
    return this.configManager.getConfig();
  }

  // Utility methods
  async warmup(): Promise<void> {
    logger.info('Warming up API Gateway...');
    
    // Pre-connect to database
    await this.prisma.$connect();
    
    // Run initial health checks
    await this.healthMonitor.checkAllServices();
    
    logger.info('API Gateway warmup complete');
  }
}