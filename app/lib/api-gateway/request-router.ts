import { APIGatewayRequest, APIGatewayResponse, RouteDefinition, APIGatewayError } from './types';
import { logger } from '../logger';
import { pathToRegexp, match, parse } from 'path-to-regexp';

export interface RouterOptions {
  defaultTimeout?: number;
  transformErrors?: boolean;
  enableCORS?: boolean;
}

export class RequestRouter {
  private routes: Map<string, RouteDefinition[]> = new Map();
  private platformHandlers: Map<string, any> = new Map();

  constructor(private options: RouterOptions = {}) {
    this.options = {
      defaultTimeout: 30000,
      transformErrors: true,
      enableCORS: true,
      ...options
    };
  }

  registerRoute(route: RouteDefinition): void {
    const key = this.getRouteKey(route.path);
    const routes = this.routes.get(key) || [];
    routes.push(route);
    this.routes.set(key, routes);
    
    logger.info(`Registered route: ${route.methods.join(',')} ${route.path} -> ${route.platform}:${route.targetEndpoint}`);
  }

  registerPlatformHandler(platform: string, handler: any): void {
    this.platformHandlers.set(platform, handler);
    logger.info(`Registered platform handler: ${platform}`);
  }

  async route(request: APIGatewayRequest): Promise<APIGatewayResponse> {
    const route = this.findRoute(request);
    
    if (!route) {
      throw new APIGatewayError(
        'Route not found',
        'ROUTE_NOT_FOUND',
        404,
        undefined,
        { path: request.endpoint, method: request.method }
      );
    }

    // Apply request transformation if defined
    let transformedRequest = request;
    if (route.transform?.request) {
      transformedRequest = route.transform.request(request);
    }

    // Get platform handler
    const handler = this.platformHandlers.get(route.platform);
    if (!handler) {
      throw new APIGatewayError(
        'Platform handler not found',
        'HANDLER_NOT_FOUND',
        500,
        route.platform
      );
    }

    // Extract path parameters
    const pathMatch = match(route.path)(request.endpoint);
    const pathParams = pathMatch ? (pathMatch as any).params : {};

    // Make the request
    const requestOptions = {
      method: transformedRequest.method,
      params: { ...transformedRequest.params, ...pathParams },
      headers: transformedRequest.headers,
      body: transformedRequest.body,
      timeout: this.options.defaultTimeout
    };

    try {
      const response = await handler.makeRequest(
        route.targetEndpoint,
        requestOptions
      );

      // Apply response transformation if defined
      let transformedResponse = response;
      if (route.transform?.response) {
        transformedResponse = route.transform.response(response);
      }

      // Get rate limit info from handler
      const rateLimitInfo = handler.getRateLimitInfo?.();

      return {
        data: transformedResponse,
        headers: this.buildResponseHeaders(rateLimitInfo),
        status: 200,
        rateLimitInfo,
        requestId: this.generateRequestId()
      };
    } catch (error: any) {
      logger.error(`Route error for ${route.platform}:${route.targetEndpoint}:`, error);
      
      if (this.options.transformErrors) {
        throw this.transformError(error, route.platform);
      }
      throw error;
    }
  }

  private findRoute(request: APIGatewayRequest): RouteDefinition | null {
    // Try exact match first
    const exactKey = this.getRouteKey(request.endpoint);
    const exactRoutes = this.routes.get(exactKey) || [];
    
    for (const route of exactRoutes) {
      if (route.methods.includes(request.method)) {
        return route;
      }
    }

    // Try pattern matching
    for (const [_, routes] of this.routes) {
      for (const route of routes) {
        const pathMatch = match(route.path)(request.endpoint);
        if (pathMatch && route.methods.includes(request.method)) {
          return route;
        }
      }
    }

    return null;
  }

  private getRouteKey(path: string): string {
    // Normalize path for consistent lookup
    return path.toLowerCase().replace(/\/$/, '') || '/';
  }

  private buildResponseHeaders(rateLimitInfo?: any): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': this.generateRequestId()
    };

    if (this.options.enableCORS) {
      headers['Access-Control-Allow-Origin'] = '*';
      headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-API-Key';
    }

    if (rateLimitInfo) {
      headers['X-RateLimit-Limit'] = String(rateLimitInfo.limit);
      headers['X-RateLimit-Remaining'] = String(rateLimitInfo.remaining);
      headers['X-RateLimit-Reset'] = rateLimitInfo.reset.toISOString();
    }

    return headers;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private transformError(error: any, platform: string): APIGatewayError {
    if (error instanceof APIGatewayError) {
      return error;
    }

    // Handle platform-specific errors
    if (error.response) {
      const status = error.response.status || 500;
      const message = error.response.data?.message || error.message || 'Unknown error';
      const code = error.response.data?.code || 'PLATFORM_ERROR';
      
      return new APIGatewayError(message, code, status, platform, error.response.data);
    }

    // Handle network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return new APIGatewayError(
        'Platform service unavailable',
        'SERVICE_UNAVAILABLE',
        503,
        platform
      );
    }

    // Default error
    return new APIGatewayError(
      error.message || 'Internal server error',
      'INTERNAL_ERROR',
      500,
      platform
    );
  }

  getAllRoutes(): RouteDefinition[] {
    const allRoutes: RouteDefinition[] = [];
    this.routes.forEach(routes => {
      allRoutes.push(...routes);
    });
    return allRoutes;
  }

  removeRoute(path: string, method?: string): boolean {
    const key = this.getRouteKey(path);
    const routes = this.routes.get(key);
    
    if (!routes) {
      return false;
    }

    if (method) {
      const filteredRoutes = routes.filter(route => 
        !route.methods.includes(method)
      );
      
      if (filteredRoutes.length === 0) {
        this.routes.delete(key);
      } else {
        this.routes.set(key, filteredRoutes);
      }
    } else {
      this.routes.delete(key);
    }

    return true;
  }
}