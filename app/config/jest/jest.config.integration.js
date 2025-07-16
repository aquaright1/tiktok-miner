/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/__tests__/integration/**/*.test.ts',
    '**/__tests__/integration/**/*.test.tsx'
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
  globalSetup: '<rootDir>/__tests__/integration/setup.ts',
  globalTeardown: '<rootDir>/__tests__/integration/teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.integration.js'],
  testTimeout: 30000, // Integration tests need more time
  maxWorkers: 1, // Run integration tests sequentially
};

module.exports = config;