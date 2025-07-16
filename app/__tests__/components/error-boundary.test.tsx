import React from 'react';
import { render, screen } from '@testing-library/react';

// Simple error boundary implementation for testing
class TestErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ComponentType<{ error: Error }> },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback;
      return <FallbackComponent error={this.state.error} />;
    }

    return this.props.children;
  }
}

// Mock component that throws an error
const ThrowError = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Component rendered successfully</div>;
};

// Mock component that throws during render due to null/undefined data
const NullDataComponent = ({ data }: { data: any }) => {
  // This will throw if data is null/undefined and we try to access properties
  return (
    <div>
      {data.username.toString()} - {data.followers.toString()}
    </div>
  );
};

// Error fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <div role="alert">
    <h2>Something went wrong:</h2>
    <pre>{error.message}</pre>
  </div>
);

describe('Error Boundary Tests', () => {
  beforeEach(() => {
    // Suppress console.error for these tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render children when there is no error', () => {
    render(
      <TestErrorBoundary fallback={ErrorFallback}>
        <ThrowError shouldThrow={false} />
      </TestErrorBoundary>
    );

    expect(screen.getByText('Component rendered successfully')).toBeInTheDocument();
  });

  it('should catch and display error when component throws', () => {
    render(
      <TestErrorBoundary fallback={ErrorFallback}>
        <ThrowError shouldThrow={true} />
      </TestErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong:')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should catch TypeError from null/undefined data access', () => {
    render(
      <TestErrorBoundary fallback={ErrorFallback}>
        <NullDataComponent data={null} />
      </TestErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong:')).toBeInTheDocument();
  });

  it('should catch TypeError from undefined property access', () => {
    render(
      <TestErrorBoundary fallback={ErrorFallback}>
        <NullDataComponent data={{}} />
      </TestErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong:')).toBeInTheDocument();
  });

  it('should render successfully with valid data', () => {
    render(
      <TestErrorBoundary fallback={ErrorFallback}>
        <NullDataComponent data={{ username: 'testuser', followers: 1000 }} />
      </TestErrorBoundary>
    );

    expect(screen.getByText('testuser - 1000')).toBeInTheDocument();
  });
});

describe('Creator Table Error Scenarios', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Mock component similar to the creator table cell
  const CreatorTableCell = ({ creator }: { creator: any }) => {
    return (
      <div>
        <span>{creator.username}</span>
        <span>{creator.videoCount.toString()}</span>
        <span>{creator.followers.toLocaleString()}</span>
      </div>
    );
  };

  it('should handle creator data with null videoCount', () => {
    const creator = {
      username: 'testuser',
      videoCount: null,
      followers: 1000
    };

    render(
      <TestErrorBoundary fallback={ErrorFallback}>
        <CreatorTableCell creator={creator} />
      </TestErrorBoundary>
    );

    // This should catch the error from null.toString()
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should handle creator data with undefined followers', () => {
    const creator = {
      username: 'testuser',
      videoCount: 10,
      followers: undefined
    };

    render(
      <TestErrorBoundary fallback={ErrorFallback}>
        <CreatorTableCell creator={creator} />
      </TestErrorBoundary>
    );

    // This should catch the error from undefined.toLocaleString()
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should render successfully with all valid data', () => {
    const creator = {
      username: 'testuser',
      videoCount: 10,
      followers: 1000
    };

    render(
      <TestErrorBoundary fallback={ErrorFallback}>
        <CreatorTableCell creator={creator} />
      </TestErrorBoundary>
    );

    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });
});