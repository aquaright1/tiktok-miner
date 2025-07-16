import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleAPIError } from './error-handler'
import { successResponse, errorResponse } from './responses'
import { logger } from '../logger'

interface HandlerConfig<TParams = any, TBody = any, TResponse = any> {
  params?: z.ZodSchema<TParams>
  body?: z.ZodSchema<TBody>
  query?: z.ZodSchema<any>
  response?: z.ZodSchema<TResponse>
  handler: (req: {
    params?: TParams
    body?: TBody
    query?: any
    searchParams: URLSearchParams
    request: NextRequest
  }) => Promise<TResponse>
}

export function createAPIHandler<TParams = any, TBody = any, TResponse = any>(
  config: HandlerConfig<TParams, TBody, TResponse>
) {
  return async (request: NextRequest, context?: { params?: any }) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const start = Date.now()
    
    try {
      logger.info('API Request', {
        requestId,
        method: request.method,
        path: request.url,
      })
      
      // Parse and validate params
      const params = context?.params && config.params
        ? config.params.parse(context.params)
        : undefined
      
      // Parse and validate body
      let body: TBody | undefined
      if (config.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const rawBody = await request.json()
        body = config.body.parse(rawBody)
      }
      
      // Parse query parameters
      const { searchParams } = new URL(request.url)
      const query = config.query
        ? config.query.parse(Object.fromEntries(searchParams))
        : undefined
      
      // Execute handler
      const result = await config.handler({
        params,
        body,
        query,
        searchParams,
        request
      })
      
      // Validate response if schema provided
      const validatedResult = config.response
        ? config.response.parse(result)
        : result
      
      const response = successResponse(validatedResult)
      
      logger.info('API Response', {
        requestId,
        statusCode: 200,
        duration: Date.now() - start,
      })
      
      return response
    } catch (error) {
      logger.error('API Error', error as Error, {
        requestId,
        duration: Date.now() - start,
      })
      
      if (error instanceof z.ZodError) {
        return errorResponse('Validation error', 400, error.errors)
      }
      
      return handleAPIError(error, `${request.method} ${request.url}`)
    }
  }
}

// Simplified handler for routes without params
export function createSimpleHandler<TBody = any, TResponse = any>(
  handler: (req: {
    body?: TBody
    searchParams: URLSearchParams
    request: NextRequest
  }) => Promise<TResponse>,
  options?: {
    body?: z.ZodSchema<TBody>
    query?: z.ZodSchema<any>
    response?: z.ZodSchema<TResponse>
  }
) {
  return createAPIHandler({
    ...options,
    handler
  })
}