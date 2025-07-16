// Performance test setup

// Enable manual garbage collection for memory tests
if (!global.gc) {
  console.warn('Garbage collection is not exposed. Run Node with --expose-gc flag for accurate memory tests.')
}

// Set longer timeout for performance tests
jest.setTimeout(120000)

// Mock environment for consistent performance testing
process.env.NODE_ENV = 'test'
process.env.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

// Performance test utilities
global.measureMemory = () => {
  if (global.gc) {
    global.gc()
  }
  return process.memoryUsage()
}

global.formatBytes = (bytes) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

// Warm up functions to avoid JIT compilation affecting benchmarks
global.warmUp = async (fn, iterations = 100) => {
  for (let i = 0; i < iterations; i++) {
    await fn()
  }
}

// Statistical helpers
global.calculateStats = (numbers) => {
  const sorted = numbers.slice().sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  const mean = sum / sorted.length
  const median = sorted[Math.floor(sorted.length / 2)]
  const p95 = sorted[Math.floor(sorted.length * 0.95)]
  const p99 = sorted[Math.floor(sorted.length * 0.99)]
  
  return { mean, median, p95, p99, min: sorted[0], max: sorted[sorted.length - 1] }
}