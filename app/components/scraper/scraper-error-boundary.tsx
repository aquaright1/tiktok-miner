"use client"

import React, { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class FinderErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    console.error('Finder Error Boundary caught an error:', error, errorInfo)
    
    // Update state with error info
    this.setState({
      error,
      errorInfo,
    })

    // Show error toast
    toast.error('An error occurred in the finder. Please try refreshing the page.')

    // You could also send error to logging service here
    // logErrorToService(error, errorInfo)
  }

  handleRetry = () => {
    // Reset error state to retry rendering
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
    
    toast.info('Retrying...')
  }

  handleGoHome = () => {
    // Navigate to home page
    window.location.href = '/creators'
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="container mx-auto py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="h-16 w-16 text-red-500" />
              </div>
              <CardTitle className="text-2xl text-red-600">
                Something went wrong
              </CardTitle>
              <CardDescription className="text-lg">
                The finder encountered an unexpected error. This might be due to invalid data, network issues, or a temporary problem.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Error Details (only in development) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <h3 className="font-medium text-red-800 dark:text-red-200 mb-2">
                    Error Details (Development Only)
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300 font-mono">
                    {this.state.error.message}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="text-sm text-red-600 dark:text-red-400 cursor-pointer">
                        Component Stack
                      </summary>
                      <pre className="text-xs text-red-600 dark:text-red-400 mt-1 overflow-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* User-friendly error message */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  What can you do?
                </h3>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  <li>• Try refreshing the page or retrying the operation</li>
                  <li>• Check your internet connection</li>
                  <li>• If the problem persists, try going back to the creators page</li>
                  <li>• Clear your browser cache and cookies</li>
                </ul>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={this.handleRetry}
                  variant="default"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go to Creators
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Higher-order component for easy wrapping
export function withFinderErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
) {
  return function WrappedComponent(props: P) {
    return (
      <FinderErrorBoundary>
        <Component {...props} />
      </FinderErrorBoundary>
    )
  }
}

// Hook to manually trigger error boundary (for testing)
export function useErrorHandler() {
  return (error: Error, errorInfo?: React.ErrorInfo) => {
    // This will throw the error and trigger the error boundary
    throw error
  }
}