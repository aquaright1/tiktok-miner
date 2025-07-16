// Jest setup file
require('@testing-library/jest-dom');

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    query: {},
    pathname: '/',
  }),
}));

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Global test utilities
global.fetch = jest.fn();

// Silence console warnings in tests
const originalConsoleWarn = console.warn;
console.warn = (message, ...args) => {
  if (typeof message === 'string' && message.includes('Warning: ReactDOM.render is no longer supported')) {
    return;
  }
  originalConsoleWarn(message, ...args);
};