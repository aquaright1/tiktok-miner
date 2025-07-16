import { NextResponse } from 'next/server'

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  details?: any
  timestamp: string
  metadata?: {
    total?: number
    hasMore?: boolean
    page?: number
    limit?: number
    [key: string]: any
  }
}

export function successResponse<T>(
  data: T,
  metadata?: APIResponse['metadata']
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
    metadata
  })
}

export function errorResponse(
  error: string,
  statusCode: number = 500,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
      details,
      timestamp: new Date().toISOString()
    },
    { status: statusCode }
  )
}

// Convenience methods for common responses
export const notFound = (message = 'Resource not found') => 
  errorResponse(message, 404)

export const badRequest = (message = 'Bad request', details?: any) => 
  errorResponse(message, 400, details)

export const unauthorized = (message = 'Unauthorized') => 
  errorResponse(message, 401)

export const forbidden = (message = 'Forbidden') => 
  errorResponse(message, 403)

export const conflict = (message = 'Conflict', details?: any) => 
  errorResponse(message, 409, details)