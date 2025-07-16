import { useState, useCallback, useEffect, useRef } from 'react'

interface AsyncState<T> {
  data: T | null
  error: Error | null
  loading: boolean
}

interface UseAsyncOptions {
  immediate?: boolean
}

export function useAsync<T = any>(
  asyncFunction: () => Promise<T>,
  options: UseAsyncOptions = {}
) {
  const { immediate = true } = options
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: false,
  })

  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const execute = useCallback(async () => {
    setState({ data: null, error: null, loading: true })

    try {
      const data = await asyncFunction()
      if (mountedRef.current) {
        setState({ data, error: null, loading: false })
      }
      return data
    } catch (error) {
      if (mountedRef.current) {
        setState({ data: null, error: error as Error, loading: false })
      }
      throw error
    }
  }, [asyncFunction])

  useEffect(() => {
    if (immediate) {
      execute()
    }
  }, [execute, immediate])

  return { ...state, execute }
}

// Hook for managing async operations with abort support
export function useAsyncWithAbort<T = any>(
  asyncFunction: (signal: AbortSignal) => Promise<T>
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: false,
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  const execute = useCallback(async () => {
    // Abort any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setState({ data: null, error: null, loading: true })

    try {
      const data = await asyncFunction(abortController.signal)
      setState({ data, error: null, loading: false })
      return data
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setState({ data: null, error, loading: false })
      }
      throw error
    }
  }, [asyncFunction])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return { ...state, execute }
}