import { logger } from '../logger';
import { APIGatewayRequest, APIGatewayResponse } from './types';
import { createHash } from 'crypto';

export interface LogEntry {
  requestId: string;
  timestamp: Date;
  method: string;
  path: string;
  platform: string;
  apiKey: string;
  userId?: string;
  responseTime: number;
  statusCode: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface LoggingOptions {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logRequests: boolean;
  logResponses: boolean;
  logErrors: boolean;
  maskSensitiveData: boolean;
  correlationIdHeader?: string;
  auditLog?: boolean;
}

export class APIGatewayLogger {
  private auditLogs: LogEntry[] = [];
  
  constructor(private options: LoggingOptions) {
    this.options = {
      logLevel: 'info',
      logRequests: true,
      logResponses: true,
      logErrors: true,
      maskSensitiveData: true,
      correlationIdHeader: 'X-Correlation-ID',
      auditLog: false,
      ...options
    };
  }

  logRequest(
    request: APIGatewayRequest,
    requestId: string,
    correlationId?: string
  ): void {
    if (!this.options.logRequests) return;

    const sanitizedRequest = this.sanitizeRequest(request);
    
    logger.info('API Gateway Request', {
      requestId,
      correlationId,
      method: request.method,
      path: request.endpoint,
      platform: request.platform,
      apiKey: this.maskApiKey(request.apiKey),
      userId: request.userId,
      params: sanitizedRequest.params,
      headers: sanitizedRequest.headers
    });
  }

  logResponse(
    request: APIGatewayRequest,
    response: APIGatewayResponse,
    responseTime: number,
    correlationId?: string
  ): void {
    if (!this.options.logResponses) return;

    const logEntry: LogEntry = {
      requestId: response.requestId,
      timestamp: new Date(),
      method: request.method,
      path: request.endpoint,
      platform: request.platform,
      apiKey: this.maskApiKey(request.apiKey),
      userId: request.userId,
      responseTime,
      statusCode: response.status,
      metadata: {
        cached: response.cached,
        rateLimitRemaining: response.rateLimitInfo?.remaining
      }
    };

    logger.info('API Gateway Response', {
      ...logEntry,
      correlationId,
      dataSize: JSON.stringify(response.data).length
    });

    if (this.options.auditLog) {
      this.auditLogs.push(logEntry);
    }
  }

  logError(
    request: APIGatewayRequest,
    error: any,
    responseTime: number,
    requestId: string,
    correlationId?: string
  ): void {
    if (!this.options.logErrors) return;

    const logEntry: LogEntry = {
      requestId,
      timestamp: new Date(),
      method: request.method,
      path: request.endpoint,
      platform: request.platform,
      apiKey: this.maskApiKey(request.apiKey),
      userId: request.userId,
      responseTime,
      statusCode: error.statusCode || 500,
      error: error.message,
      metadata: {
        errorCode: error.code,
        errorDetails: error.details
      }
    };

    logger.error('API Gateway Error', {
      ...logEntry,
      correlationId,
      stack: this.options.logLevel === 'debug' ? error.stack : undefined
    });

    if (this.options.auditLog) {
      this.auditLogs.push(logEntry);
    }
  }

  logRateLimitExceeded(
    identifier: string,
    platform: string,
    limit: number,
    window: number
  ): void {
    logger.warn('Rate limit exceeded', {
      identifier: this.options.maskSensitiveData ? this.hashIdentifier(identifier) : identifier,
      platform,
      limit,
      windowMs: window,
      timestamp: new Date()
    });
  }

  logHealthCheck(results: any[]): void {
    const healthy = results.every(r => r.status === 'healthy');
    const level = healthy ? 'info' : 'warn';
    
    logger[level]('Health check completed', {
      overall: healthy ? 'healthy' : 'degraded',
      services: results,
      timestamp: new Date()
    });
  }

  generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getAuditLogs(filters?: {
    startTime?: Date;
    endTime?: Date;
    platform?: string;
    userId?: string;
    statusCode?: number;
  }): LogEntry[] {
    let logs = [...this.auditLogs];

    if (filters) {
      if (filters.startTime) {
        logs = logs.filter(log => log.timestamp >= filters.startTime!);
      }
      if (filters.endTime) {
        logs = logs.filter(log => log.timestamp <= filters.endTime!);
      }
      if (filters.platform) {
        logs = logs.filter(log => log.platform === filters.platform);
      }
      if (filters.userId) {
        logs = logs.filter(log => log.userId === filters.userId);
      }
      if (filters.statusCode) {
        logs = logs.filter(log => log.statusCode === filters.statusCode);
      }
    }

    return logs;
  }

  clearAuditLogs(): void {
    this.auditLogs = [];
  }

  exportAuditLogs(): string {
    return JSON.stringify(this.auditLogs, null, 2);
  }

  private sanitizeRequest(request: APIGatewayRequest): any {
    if (!this.options.maskSensitiveData) {
      return request;
    }

    const sanitized = { ...request };
    
    // Mask sensitive headers
    if (sanitized.headers) {
      const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];
      sanitized.headers = Object.keys(sanitized.headers).reduce((acc, key) => {
        if (sensitiveHeaders.includes(key.toLowerCase())) {
          acc[key] = '***MASKED***';
        } else {
          acc[key] = sanitized.headers![key];
        }
        return acc;
      }, {} as Record<string, string>);
    }

    // Mask sensitive parameters
    if (sanitized.params) {
      const sensitiveParams = ['password', 'token', 'secret', 'key'];
      sanitized.params = Object.keys(sanitized.params).reduce((acc, key) => {
        if (sensitiveParams.some(param => key.toLowerCase().includes(param))) {
          acc[key] = '***MASKED***';
        } else {
          acc[key] = sanitized.params![key];
        }
        return acc;
      }, {} as Record<string, any>);
    }

    // Don't log request body by default
    delete sanitized.body;

    return sanitized;
  }

  private maskApiKey(apiKey: string): string {
    if (!this.options.maskSensitiveData) {
      return apiKey;
    }
    
    if (apiKey.length <= 8) {
      return '***';
    }
    
    return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  }

  private hashIdentifier(identifier: string): string {
    return createHash('sha256').update(identifier).digest('hex').substring(0, 8);
  }

  // Structured logging methods for specific events
  logApiKeyCreated(keyName: string, permissions: string[]): void {
    logger.info('API key created', {
      event: 'api_key_created',
      keyName,
      permissions,
      timestamp: new Date()
    });
  }

  logApiKeyRevoked(keyId: string, reason?: string): void {
    logger.info('API key revoked', {
      event: 'api_key_revoked',
      keyId,
      reason,
      timestamp: new Date()
    });
  }

  logCircuitBreakerStateChange(
    serviceName: string,
    fromState: string,
    toState: string
  ): void {
    logger.warn('Circuit breaker state change', {
      event: 'circuit_breaker_state_change',
      service: serviceName,
      fromState,
      toState,
      timestamp: new Date()
    });
  }
}