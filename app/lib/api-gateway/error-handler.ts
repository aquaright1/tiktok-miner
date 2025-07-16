import { APIGatewayError } from './types';
import { logger } from '../logger';

export interface ErrorHandlerOptions {
  logErrors?: boolean;
  includeStackTrace?: boolean;
  customErrorMessages?: Record<string, string>;
}

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter?: boolean;
}

export class ErrorHandler {
  constructor(private options: ErrorHandlerOptions = {}) {
    this.options = {
      logErrors: true,
      includeStackTrace: process.env.NODE_ENV === 'development',
      ...options
    };
  }

  async handleWithRetry<T>(
    fn: () => Promise<T>,
    retryOptions: RetryOptions,
    context?: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry if it's not a retryable error
        if (!this.isRetryableError(error)) {
          throw this.transformError(error, context);
        }
        
        // Don't retry if we've exhausted attempts
        if (attempt === retryOptions.maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateBackoffDelay(
          attempt,
          retryOptions,
          error.retryAfter
        );
        
        if (this.options.logErrors) {
          logger.warn(
            `Retrying after error (attempt ${attempt + 1}/${retryOptions.maxRetries + 1}): ${error.message}`,
            { context, delay, error: error.code || error.statusCode }
          );
        }
        
        await this.sleep(delay);
      }
    }
    
    // All retries exhausted
    throw this.transformError(lastError, context);
  }

  isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNRESET') {
      return true;
    }
    
    // HTTP status codes that are retryable
    const statusCode = error.statusCode || error.response?.status;
    if (statusCode) {
      // Rate limiting
      if (statusCode === 429) return true;
      // Server errors
      if (statusCode >= 500 && statusCode < 600) return true;
      // Request timeout
      if (statusCode === 408) return true;
    }
    
    // API Gateway specific errors
    if (error instanceof APIGatewayError) {
      return error.code === 'RATE_LIMIT_EXCEEDED' || 
             error.code === 'SERVICE_UNAVAILABLE' ||
             error.code === 'TIMEOUT';
    }
    
    return false;
  }

  transformError(error: any, context?: string): APIGatewayError {
    if (error instanceof APIGatewayError) {
      return error;
    }
    
    // Extract useful information from different error types
    let message = error.message || 'Unknown error occurred';
    let code = error.code || 'UNKNOWN_ERROR';
    let statusCode = error.statusCode || error.response?.status || 500;
    let details = {};
    
    // Handle axios/fetch errors
    if (error.response) {
      message = error.response.data?.message || error.response.data?.error || message;
      code = error.response.data?.code || code;
      details = {
        ...error.response.data,
        headers: error.response.headers
      };
    }
    
    // Handle network errors
    if (error.code === 'ECONNREFUSED') {
      message = 'Service unavailable - connection refused';
      code = 'SERVICE_UNAVAILABLE';
      statusCode = 503;
    } else if (error.code === 'ETIMEDOUT') {
      message = 'Request timeout';
      code = 'TIMEOUT';
      statusCode = 408;
    }
    
    // Apply custom error messages if configured
    if (this.options.customErrorMessages?.[code]) {
      message = this.options.customErrorMessages[code];
    }
    
    // Log the error if configured
    if (this.options.logErrors) {
      logger.error(`Error in ${context || 'API Gateway'}:`, {
        code,
        statusCode,
        message,
        originalError: this.options.includeStackTrace ? error.stack : undefined
      });
    }
    
    return new APIGatewayError(
      message,
      code,
      statusCode,
      context,
      this.options.includeStackTrace ? { ...details, stack: error.stack } : details
    );
  }

  private calculateBackoffDelay(
    attempt: number,
    options: RetryOptions,
    retryAfter?: number
  ): number {
    // If server provided retry-after, use that
    if (retryAfter) {
      return retryAfter * 1000;
    }
    
    // Calculate exponential backoff
    const exponentialDelay = Math.min(
      options.initialDelay * Math.pow(options.backoffMultiplier, attempt),
      options.maxDelay
    );
    
    // Add jitter if enabled
    if (options.jitter) {
      const jitterRange = exponentialDelay * 0.1; // 10% jitter
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      return Math.round(exponentialDelay + jitter);
    }
    
    return Math.round(exponentialDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Circuit breaker implementation
  createCircuitBreaker(
    name: string,
    options: {
      failureThreshold: number;
      resetTimeout: number;
      monitoringPeriod: number;
    }
  ) {
    return new CircuitBreaker(name, options, this);
  }
}

export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: Date;
  private monitoringStart = new Date();

  constructor(
    private name: string,
    private options: {
      failureThreshold: number;
      resetTimeout: number;
      monitoringPeriod: number;
    },
    private errorHandler: ErrorHandler
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new APIGatewayError(
          `Circuit breaker is open for ${this.name}`,
          'CIRCUIT_BREAKER_OPEN',
          503,
          this.name
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= 3) { // Require 3 successes to fully close
        this.state = 'closed';
        this.successes = 0;
        logger.info(`Circuit breaker closed for ${this.name}`);
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.state === 'half-open') {
      this.state = 'open';
      this.successes = 0;
      logger.warn(`Circuit breaker reopened for ${this.name}`);
    } else if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
      logger.warn(`Circuit breaker opened for ${this.name} after ${this.failures} failures`);
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.options.resetTimeout;
  }

  getState(): {
    state: string;
    failures: number;
    lastFailureTime?: Date;
  } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}