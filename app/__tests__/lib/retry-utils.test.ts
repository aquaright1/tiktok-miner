import {
  retryWithBackoff,
  retryFetch,
  retryJsonFetch,
  CircuitBreaker,
  withTimeout,
  retryWithTimeout,
  RetryOptions,
} from '@/lib/retry/retry-utils'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should succeed on first try', async () => {
    const mockFn = jest.fn().mockResolvedValue('success')

    const promise = retryWithBackoff(mockFn)
    
    // Fast forward timers to allow the function to complete
    jest.runAllTimers()
    
    const result = await promise

    expect(result.success).toBe(true)
    expect(result.data).toBe('success')
    expect(result.attempts).toBe(1)
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should retry on retryable errors', async () => {
    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Another network error'))
      .mockResolvedValue('success')

    const promise = retryWithBackoff(mockFn, {
      maxRetries: 3,
      initialDelay: 100,
      retryCondition: () => true,
    })

    // Fast forward through all delays
    jest.runAllTimers()

    const result = await promise

    expect(result.success).toBe(true)
    expect(result.data).toBe('success')
    expect(result.attempts).toBe(3)
    expect(mockFn).toHaveBeenCalledTimes(3)
  })

  it('should not retry on non-retryable errors', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Validation error'))

    const promise = retryWithBackoff(mockFn, {
      maxRetries: 3,
      retryCondition: (error) => !error.message.includes('Validation'),
    })

    jest.runAllTimers()

    const result = await promise

    expect(result.success).toBe(false)
    expect(result.error.message).toBe('Validation error')
    expect(result.attempts).toBe(1)
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should respect max retries', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Always fails'))

    const promise = retryWithBackoff(mockFn, {
      maxRetries: 2,
      initialDelay: 10,
      retryCondition: () => true,
    })

    jest.runAllTimers()

    const result = await promise

    expect(result.success).toBe(false)
    expect(result.attempts).toBe(3) // Initial attempt + 2 retries
    expect(mockFn).toHaveBeenCalledTimes(3)
  })

  it('should call onRetry callback', async () => {
    const onRetry = jest.fn()
    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValue('success')

    const promise = retryWithBackoff(mockFn, {
      maxRetries: 2,
      initialDelay: 10,
      retryCondition: () => true,
      onRetry,
    })

    jest.runAllTimers()

    await promise

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'First error' }),
      1
    )
  })

  it('should use exponential backoff', async () => {
    const delays: number[] = []
    const originalSetTimeout = global.setTimeout
    
    global.setTimeout = jest.fn((callback, delay) => {
      delays.push(delay)
      return originalSetTimeout(callback, 0) // Execute immediately for test
    }) as any

    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockRejectedValueOnce(new Error('Error 2'))
      .mockResolvedValue('success')

    const promise = retryWithBackoff(mockFn, {
      maxRetries: 3,
      initialDelay: 100,
      backoffFactor: 2,
      retryCondition: () => true,
    })

    jest.runAllTimers()

    await promise

    expect(delays).toEqual([100, 200]) // 100ms, then 200ms
    
    global.setTimeout = originalSetTimeout
  })
})

describe('retryFetch', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should succeed on successful response', async () => {
    const mockResponse = new Response('success', { status: 200 })
    mockFetch.mockResolvedValue(mockResponse)

    const promise = retryFetch('https://api.test.com/data')
    jest.runAllTimers()
    const result = await promise

    expect(result.success).toBe(true)
    expect(result.data).toBe(mockResponse)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should retry on 500 errors', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue(new Response('success', { status: 200 }))

    const promise = retryFetch('https://api.test.com/data', {}, {
      maxRetries: 2,
      initialDelay: 10,
    })

    jest.runAllTimers()
    const result = await promise

    expect(result.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should not retry on 400 errors', async () => {
    const mockResponse = new Response('Bad Request', { status: 400 })
    mockFetch.mockResolvedValue(mockResponse)

    const promise = retryFetch('https://api.test.com/data', {}, {
      maxRetries: 2,
      initialDelay: 10,
    })

    jest.runAllTimers()
    const result = await promise

    expect(result.success).toBe(false)
    expect(result.attempts).toBe(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

describe('retryJsonFetch', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should parse JSON response', async () => {
    const jsonData = { message: 'success' }
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue(jsonData),
    }
    mockFetch.mockResolvedValue(mockResponse)

    const promise = retryJsonFetch('https://api.test.com/data')
    jest.runAllTimers()
    const result = await promise

    expect(result.success).toBe(true)
    expect(result.data).toEqual(jsonData)
    expect(mockResponse.json).toHaveBeenCalled()
  })

  it('should handle JSON parsing errors', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
    }
    mockFetch.mockResolvedValue(mockResponse)

    const promise = retryJsonFetch('https://api.test.com/data', {}, {
      maxRetries: 1,
      initialDelay: 10,
    })

    jest.runAllTimers()
    const result = await promise

    expect(result.success).toBe(false)
    expect(result.error.message).toBe('Invalid JSON')
  })
})

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(3, 1000, 5000) // 3 failures, 1s recovery, 5s monitoring
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should allow requests when closed', async () => {
    const mockFn = jest.fn().mockResolvedValue('success')

    const result = await circuitBreaker.execute(mockFn)

    expect(result).toBe('success')
    expect(circuitBreaker.getState()).toBe('CLOSED')
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should open after failure threshold', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Service down'))

    // Fail 3 times to open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(mockFn)
      } catch (error) {
        // Expected failures
      }
    }

    expect(circuitBreaker.getState()).toBe('OPEN')

    // Next request should be rejected immediately
    try {
      await circuitBreaker.execute(mockFn)
      expect.fail('Should have thrown circuit breaker error')
    } catch (error) {
      expect(error.message).toBe('Circuit breaker is OPEN')
    }

    // Should not call the function when circuit is open
    expect(mockFn).toHaveBeenCalledTimes(3)
  })

  it('should transition to half-open after recovery timeout', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Service down'))

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(mockFn)
      } catch (error) {
        // Expected failures
      }
    }

    expect(circuitBreaker.getState()).toBe('OPEN')

    // Advance time past recovery timeout
    jest.advanceTimersByTime(1001)

    // Mock function to succeed now
    mockFn.mockResolvedValue('recovered')

    const result = await circuitBreaker.execute(mockFn)

    expect(result).toBe('recovered')
    expect(circuitBreaker.getState()).toBe('CLOSED')
  })

  it('should reset failure count on success', async () => {
    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValue('success')

    // First failure
    try {
      await circuitBreaker.execute(mockFn)
    } catch (error) {
      // Expected
    }

    expect(circuitBreaker.getFailureCount()).toBe(1)

    // Then success
    const result = await circuitBreaker.execute(mockFn)

    expect(result).toBe('success')
    expect(circuitBreaker.getFailureCount()).toBe(0)
    expect(circuitBreaker.getState()).toBe('CLOSED')
  })
})

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should resolve if promise completes before timeout', async () => {
    const promise = new Promise(resolve => {
      setTimeout(() => resolve('success'), 500)
    })

    const timedPromise = withTimeout(promise, 1000)

    jest.advanceTimersByTime(500)

    const result = await timedPromise
    expect(result).toBe('success')
  })

  it('should reject if promise times out', async () => {
    const promise = new Promise(resolve => {
      setTimeout(() => resolve('success'), 2000)
    })

    const timedPromise = withTimeout(promise, 1000, 'Custom timeout message')

    jest.advanceTimersByTime(1000)

    try {
      await timedPromise
      expect.fail('Should have timed out')
    } catch (error) {
      expect(error.message).toBe('Custom timeout message')
      expect(error.name).toBe('TimeoutError')
    }
  })
})

describe('retryWithTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should succeed within timeout', async () => {
    const mockFn = jest.fn().mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => resolve('success'), 100)
      })
    })

    const promise = retryWithTimeout(mockFn, 1000, {
      maxRetries: 2,
      initialDelay: 50,
    })

    jest.runAllTimers()

    const result = await promise

    expect(result.success).toBe(true)
    expect(result.data).toBe('success')
  })

  it('should timeout and retry', async () => {
    let callCount = 0
    const mockFn = jest.fn().mockImplementation(() => {
      callCount++
      return new Promise(resolve => {
        // First call times out, second succeeds quickly
        const delay = callCount === 1 ? 2000 : 100
        setTimeout(() => resolve(`success-${callCount}`), delay)
      })
    })

    const promise = retryWithTimeout(mockFn, 500, {
      maxRetries: 2,
      initialDelay: 10,
      retryCondition: (error) => error.name === 'TimeoutError',
    })

    jest.runAllTimers()

    const result = await promise

    expect(result.success).toBe(true)
    expect(result.data).toBe('success-2')
    expect(result.attempts).toBe(2)
  })
})