import { MAX_RETRIES, RETRY_DELAY } from '../config';

export interface RetryOptions {
  maxRetries?: number;
  delay?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param options Retry options
 * @returns Promise that resolves with the function result
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = MAX_RETRIES,
    delay = RETRY_DELAY,
    onRetry
  } = options;

  let lastError: Error;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries) {
        break;
      }
      if (onRetry) {
        onRetry(lastError, attempt);
      }
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  throw lastError!;
}

/**
 * Check if an error should trigger a retry
 * @param error Error to check
 * @returns true if the error should trigger a retry
 */
export function isRetryableError(error: any): boolean {
  // Don't retry on 404 errors
  if (error?.response?.status === 404 || error?.message?.includes('Not Found')) {
    return false;
  }

  // Retry on network errors
  if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') {
    return true;
  }

  // Retry on rate limits and server errors
  if (error?.response?.status) {
    const status = error.response.status;
    return (
      status === 429 || // Rate limit
      status === 502 || // Bad Gateway
      status === 503 || // Service Unavailable
      status === 504    // Gateway Timeout
    );
  }

  return false;
}
