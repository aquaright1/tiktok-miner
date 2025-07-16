import { NextResponse } from 'next/server'
import { logger } from '../logger'
import { config } from '../config'

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export function handleAPIError(error: unknown, context?: string): NextResponse {
  const timestamp = new Date().toISOString()
  
  if (error instanceof APIError) {
    logger.error(`${context || 'API Error'}:`, error, { 
      statusCode: error.statusCode,
      details: error.details 
    })
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.details,
        timestamp
      },
      { status: error.statusCode }
    )
  }
  
  logger.error(`${context || 'Unexpected Error'}:`, error as Error)
  
  return NextResponse.json(
    {
      success: false,
      error: 'Internal server error',
      details: config.app.nodeEnv === 'development' && error instanceof Error 
        ? error.message 
        : undefined,
      timestamp
    },
    { status: 500 }
  )
}