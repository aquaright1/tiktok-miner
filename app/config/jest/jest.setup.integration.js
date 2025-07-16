// Integration test setup
require('dotenv').config({ path: '.env.test' })

// Set test database URL if not already set
if (!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL) {
  // Use a test suffix for the database
  const dbUrl = new URL(process.env.DATABASE_URL)
  const dbName = dbUrl.pathname.split('/').pop()
  dbUrl.pathname = `/${dbName}_test`
  process.env.TEST_DATABASE_URL = dbUrl.toString()
}

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'

// Increase timeout for database operations
jest.setTimeout(30000)

// Global test utilities
global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))