/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  testMatch: [
    '**/__tests__/**/*.tsx',
    '**/*.test.tsx',
    '**/*.spec.tsx'
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
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js'
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/build/',
    '/dist/'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000
};

module.exports = config;