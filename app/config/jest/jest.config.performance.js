/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/__tests__/performance/**/*.test.ts',
    '**/__tests__/performance/**/*.test.tsx'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        allowJs: true,
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        moduleResolution: 'node',
        isolatedModules: true,
        noEmit: true,
        strict: true,
        forceConsistentCasingInFileNames: true
      }
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1'
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/build/',
    '/dist/'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.performance.js'],
  testTimeout: 120000, // 2 minutes for performance tests
  maxWorkers: 1, // Run performance tests sequentially
  globals: {
    // Enable gc() for memory tests
    'ts-jest': {
      tsconfig: {
        target: 'ES2020'
      }
    }
  }
};

module.exports = config;