# Project Structure

This document outlines the organization and structure of the Shadow Bee codebase.

## Root Directory

- `/app` - Main application code
- `/docs` - Project documentation
- `/specs` - Specifications and requirements
- `/.github` - GitHub related configurations including workflows

## Application Directory (`/app`)

### Frontend

- `/app/app` - Next.js application pages and routes
  - `/app/app/api` - API routes
  - `/app/app/(auth-pages)` - Authentication pages
  - `/app/app/results` - Results and analytics pages
- `/app/components` - Reusable React components
  - `/app/components/ui` - UI components from shadcn/ui
  - `/app/components/layouts` - Layout components
  - `/app/components/forms` - Form components

### Backend

- `/app/lib` - Library code and utilities
  - `/app/lib/email` - Email client implementations
  - `/app/lib/github` - GitHub API integrations
  - `/app/lib/database` - Database operations
  - `/app/lib/ai` - AI integrations
- `/app/prisma` - Prisma ORM schema and migrations
- `/app/cli` - Command-line interface tools

### Configuration

- `/app/public` - Static assets
- `/app/.env.example` - Example environment variables
- `/app/tailwind.config.cjs` - Tailwind CSS configuration
- `/app/tsconfig.json` - TypeScript configuration
- `/app/next.config.js` - Next.js configuration

## Documentation Directory (`/docs`)

- `/docs/architecture.mmd` - Architecture diagram in Mermaid format
- `/docs/code-reference.md` - Code reference documentation
- `/docs/project-structure.md` - This document describing project structure

## CLI Tools

The CLI tools in the `/app/cli` directory provide various functionalities:

- GitHub repository and user analysis
- Trending developers and repositories tracking
- User profile enrichment
- Email operations
- Database operations

## Component Structure

Components follow a consistent structure:

```
ComponentName/
  ├── index.ts       # Re-exports for cleaner imports
  ├── ComponentName.tsx  # Main component implementation
  ├── ComponentName.test.tsx  # Component tests
  └── useComponentName.ts  # Component-specific hooks (if needed)
```

## API Routes

API routes follow RESTful conventions and are organized by resource:

- `/app/app/api/candidates/[...params].ts` - Candidate-related endpoints
- `/app/app/api/repositories/[...params].ts` - Repository-related endpoints
- `/app/app/api/users/[...params].ts` - User-related endpoints

## CI/CD Configuration

Continuous Integration and Continuous Deployment are configured using GitHub Actions:

- `/.github/workflows/test.yml` - Test workflow that runs Bun tests and reports coverage
- `/codecov.yml` - Codecov configuration for coverage reporting

The CI pipeline includes:
- Running tests on every push to main/master and pull requests
- Generating and uploading test coverage reports
- Storing coverage artifacts for 7 days

## Database Schema

The database schema is defined in `/app/prisma/schema.prisma` and includes models for:

- GitHub users
- GitHub repositories
- Repository contributions
- User profiles
- Job descriptions
- Candidate rankings 