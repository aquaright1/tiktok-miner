# Testing Guide

This document outlines the testing practices and setup for the Shadow Bee project.

## Testing Strategy

Shadow Bee uses Bun's integrated test runner for unit and integration tests. The testing approach focuses on:

1. **Unit Tests**: Testing individual components and functions in isolation
2. **Integration Tests**: Testing interactions between components
3. **API Tests**: Testing the API endpoints
4. **Test Coverage**: Tracking code coverage metrics to identify untested code paths

## Running Tests Locally

### Basic Test Run

To run tests in the project:

```bash
# Navigate to the app directory
cd app

# Run all tests
bun test
```

### Test Coverage

To generate a test coverage report:

```bash
# Run tests with coverage
bun test --coverage
```

This will generate a coverage report in the `app/coverage` directory, which includes:
- HTML reports in `app/coverage/lcov-report/index.html`
- JSON coverage data in `app/coverage/coverage-final.json`
- LCOV format in `app/coverage/lcov.info`

## Continuous Integration

### GitHub Actions

The project uses GitHub Actions for continuous integration. The test workflow is defined in `.github/workflows/test.yml` and includes the following steps:

1. Checkout the repository
2. Set up Bun runtime
3. Install dependencies
4. Run tests with coverage
5. Upload coverage reports to Codecov
6. Store coverage artifacts

The workflow is triggered on:
- Every push to the main/master branches
- Pull requests targeting main/master branches
- Manual triggers via the GitHub Actions interface

### Coverage Reporting with Codecov

[Codecov](https://codecov.io) is used to track and visualize test coverage over time.

#### Setting Up Codecov

To set up Codecov for your fork or repository:

1. Sign up for a Codecov account at https://codecov.io/ (free for open source projects)
2. Connect your GitHub repository to Codecov
3. Add the Codecov token to your GitHub repository secrets:
   - Go to your repository's Settings > Secrets and variables > Actions
   - Add a new repository secret named `CODECOV_TOKEN` with your Codecov token

The GitHub Actions workflow will automatically upload coverage reports to Codecov after each test run.

#### Codecov Configuration

The Codecov configuration is defined in `codecov.yml` in the root directory. This configuration:
- Sets precision and formatting for coverage reports
- Configures the coverage status checks for pull requests
- Defines coverage thresholds and targets
- Configures Codecov comments on pull requests

## Writing Tests

### File Structure

Tests should be placed in the same directory as the code they test, using the naming convention `*.test.ts` or `*.test.tsx`.

Example:
```
components/
  ├── Button/
  │   ├── Button.tsx
  │   ├── Button.test.tsx
  │   └── index.ts
```

### Test Structure

Tests should follow this general structure:

```typescript
import { test, expect, describe } from "bun:test";

describe("Component or function name", () => {
  test("should behave as expected", () => {
    // Arrange
    // Act
    // Assert
    expect(result).toBe(expected);
  });
});
```

### Mocking

For mocking dependencies, use Bun's built-in mocking capabilities:

```typescript
import { test, expect, mock } from "bun:test";

const mockFunction = mock(() => "mocked value");
```

## Best Practices

1. **Test Coverage**: Aim for 80% or higher test coverage
2. **Test Isolation**: Ensure tests don't depend on each other
3. **Fast Tests**: Keep tests fast to enable quick feedback
4. **Readable Tests**: Write clear and maintainable tests that serve as documentation
5. **Test Edge Cases**: Include tests for edge cases and error conditions
6. **Use Test-Driven Development**: When appropriate, write tests before implementing features 