export interface APIGatewayConfig {
  rateLimiting: {
    youtube: {
      windowMs: number;
      maxRequests: number;
    };
    twitter: {
      windowMs: number;
      maxRequests: number;
    };
    instagram: {
      windowMs: number;
      maxRequests: number;
    };
  };
  encryption: {
    algorithm: string;
    secretKey: string;
  };
  monitoring: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  retry: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
}

export interface APIKeyData {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  rateLimits: {
    requestsPerHour?: number;
    requestsPerDay?: number;
    requestsPerMonth?: number;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface RateLimitState {
  requests: number;
  windowStart: Date;
  windowEnd: Date;
}

export interface APIGatewayRequest {
  platform: 'youtube' | 'twitter' | 'instagram';
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
  apiKey: string;
  userId?: string;
}

export interface APIGatewayResponse<T = any> {
  data: T;
  headers: Record<string, string>;
  status: number;
  rateLimitInfo?: {
    limit: number;
    remaining: number;
    reset: Date;
  };
  cached?: boolean;
  requestId: string;
}

export interface PlatformClient {
  makeRequest<T>(
    endpoint: string,
    options: {
      method?: string;
      params?: Record<string, any>;
      headers?: Record<string, string>;
      body?: any;
    }
  ): Promise<T>;
  getRateLimitInfo(): {
    limit: number;
    remaining: number;
    reset: Date;
  } | null;
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  lastChecked: Date;
}

export interface GatewayMetrics {
  requestCount: number;
  errorCount: number;
  averageLatency: number;
  activeConnections: number;
  rateLimitHits: number;
  cacheHitRate: number;
}

export interface RouteDefinition {
  path: string;
  methods: string[];
  platform: 'youtube' | 'twitter' | 'instagram';
  targetEndpoint: string;
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
  cache?: {
    ttl: number;
    key: (req: APIGatewayRequest) => string;
  };
  transform?: {
    request?: (req: APIGatewayRequest) => APIGatewayRequest;
    response?: (res: any) => any;
  };
}

export class APIGatewayError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public platform?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIGatewayError';
  }
}