import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScraperErrorBoundary, withScraperErrorBoundary } from '@/components/scraper/scraper-error-boundary'

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    info: jest.fn(),
  },
}))

// Mock window.location for testing
const mockGoHome = jest.fn()

// Mock the error boundary's handleGoHome method
jest.mock('@/components/scraper/scraper-error-boundary', () => {
  const originalModule = jest.requireActual('@/components/scraper/scraper-error-boundary')
  
  return {
    ...originalModule,
    ScraperErrorBoundary: class MockScraperErrorBoundary extends originalModule.ScraperErrorBoundary {
      handleGoHome = () => {
        mockGoHome()
      }
    }
  }
})

// Mock components that throw errors
const ThrowingComponent = ({ shouldThrow = false, errorMessage = 'Test error' }) => {
  if (shouldThrow) {
    throw new Error(errorMessage)
  }
  return <div data-testid="working-component">Component is working</div>
}

const ScraperDataComponent = ({ data }: { data: any }) => {
  // This simulates common scraper data access patterns that might fail
  return (
    <div data-testid="scraper-data">
      <span>{data.profiles.length} profiles</span>
      <span>{data.cacheInfo.age} seconds old</span>
      <span>{data.results.map((r: any) => r.username).join(', ')}</span>
    </div>
  )
}

describe('ScraperErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGoHome.mockClear()
    
    // Suppress console.error for error boundary tests
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders children when there is no error', () => {
    render(
      <ScraperErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ScraperErrorBoundary>
    )

    expect(screen.getByTestId('working-component')).toBeInTheDocument()
    expect(screen.getByText('Component is working')).toBeInTheDocument()
  })

  it('renders error UI when component throws', () => {
    render(
      <ScraperErrorBoundary>
        <ThrowingComponent shouldThrow={true} errorMessage="Scraper failed" />
      </ScraperErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/The scraper encountered an unexpected error/)).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
    expect(screen.getByText('Go to Creators')).toBeInTheDocument()
  })

  it('displays error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(
      <ScraperErrorBoundary>
        <ThrowingComponent shouldThrow={true} errorMessage="Development error" />
      </ScraperErrorBoundary>
    )

    expect(screen.getByText('Error Details (Development Only)')).toBeInTheDocument()
    expect(screen.getByText('Development error')).toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })

  it('hides error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    render(
      <ScraperErrorBoundary>
        <ThrowingComponent shouldThrow={true} errorMessage="Production error" />
      </ScraperErrorBoundary>
    )

    expect(screen.queryByText('Error Details (Development Only)')).not.toBeInTheDocument()
    expect(screen.queryByText('Production error')).not.toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })

  it('handles retry functionality', () => {
    let shouldThrow = true
    const TestComponent = () => <ThrowingComponent shouldThrow={shouldThrow} />
    
    const { rerender } = render(
      <ScraperErrorBoundary>
        <TestComponent />
      </ScraperErrorBoundary>
    )

    // Error boundary should be showing
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Click retry button - this should reset the error boundary state
    fireEvent.click(screen.getByText('Try Again'))

    // Change the component to not throw
    shouldThrow = false

    // Rerender - the error boundary should try rendering again
    rerender(
      <ScraperErrorBoundary>
        <TestComponent />
      </ScraperErrorBoundary>
    )

    // After retry click and rerender, should show working component
    expect(screen.getByTestId('working-component')).toBeInTheDocument()
  })

  it('handles go home functionality', () => {
    render(
      <ScraperErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ScraperErrorBoundary>
    )

    fireEvent.click(screen.getByText('Go to Creators'))

    expect(mockGoHome).toHaveBeenCalled()
  })

  it('renders custom fallback when provided', () => {
    const customFallback = <div data-testid="custom-fallback">Custom error UI</div>

    render(
      <ScraperErrorBoundary fallback={customFallback}>
        <ThrowingComponent shouldThrow={true} />
      </ScraperErrorBoundary>
    )

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
    expect(screen.getByText('Custom error UI')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('handles common scraper data errors', () => {
    const invalidData = {
      profiles: null, // This will cause an error
      cacheInfo: { age: 100 },
      results: [],
    }

    render(
      <ScraperErrorBoundary>
        <ScraperDataComponent data={invalidData} />
      </ScraperErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('handles undefined cache info errors', () => {
    const invalidData = {
      profiles: [],
      cacheInfo: null, // This will cause an error
      results: [],
    }

    render(
      <ScraperErrorBoundary>
        <ScraperDataComponent data={invalidData} />
      </ScraperErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('handles array mapping errors', () => {
    const invalidData = {
      profiles: [],
      cacheInfo: { age: 100 },
      results: null, // This will cause an error when mapping
    }

    render(
      <ScraperErrorBoundary>
        <ScraperDataComponent data={invalidData} />
      </ScraperErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })
})

describe('withScraperErrorBoundary HOC', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('wraps component with error boundary', () => {
    const TestComponent = ({ message }: { message: string }) => (
      <div data-testid="test-component">{message}</div>
    )

    const WrappedComponent = withScraperErrorBoundary(TestComponent)

    render(<WrappedComponent message="Hello World" />)

    expect(screen.getByTestId('test-component')).toBeInTheDocument()
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('catches errors in wrapped component', () => {
    const BrokenComponent = () => {
      throw new Error('HOC test error')
    }

    const WrappedComponent = withScraperErrorBoundary(BrokenComponent)

    render(<WrappedComponent />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })
})

describe('ScraperErrorBoundary Edge Cases', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('handles multiple consecutive errors', () => {
    const { rerender } = render(
      <ScraperErrorBoundary>
        <ThrowingComponent shouldThrow={true} errorMessage="First error" />
      </ScraperErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Click retry
    fireEvent.click(screen.getByText('Try Again'))

    // Rerender with another error
    rerender(
      <ScraperErrorBoundary>
        <ThrowingComponent shouldThrow={true} errorMessage="Second error" />
      </ScraperErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('handles errors during state updates', () => {
    const StateErrorComponent = () => {
      const [count, setCount] = React.useState(0)
      
      React.useEffect(() => {
        if (count > 0) {
          throw new Error('State update error')
        }
      }, [count])

      return (
        <button onClick={() => setCount(1)}>
          Trigger Error
        </button>
      )
    }

    render(
      <ScraperErrorBoundary>
        <StateErrorComponent />
      </ScraperErrorBoundary>
    )

    fireEvent.click(screen.getByText('Trigger Error'))

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })
})