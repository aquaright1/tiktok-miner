# Shadow Bee

A modern recruitment platform combining CLI tools and web interface for discovering and analyzing GitHub talent.

## Features

- 🔍 Search and analyze GitHub repositories and users
- 📈 Track trending developers and repositories
- 🤖 AI-powered job description analysis
- 💾 Efficient data caching with PostgreSQL
- 🏆 Advanced candidate ranking algorithms
- 🌐 Modern web interface with real-time updates
- 📊 Detailed developer analytics and insights

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Build the application
npm run build
```

## CLI Usage

### Gather Candidates

Find and rank potential candidates based on GitHub activity:

```bash
# Get Python candidates with specific ranking strategy
bun run cli gather-candidates python monthly -c 5 -t 5

# Get JavaScript candidates with custom parameters
bun run cli gather-candidates javascript -n 10 -r activity -s 5 -c 3
```

Options:
- `-n, --count <number>`: Number of candidates to return
- `-s, --sample <number>`: Number of repositories to sample
- `-r, --ranking <strategy>`: Ranking strategy (recent-activity, activity, productivity)
- `-c, --concurrency <number>`: Maximum concurrent requests
- `-t, --top <number>`: Number of top contributors to return
- `-p, --per-repo <number>`: Contributors to fetch per repository

### Trending Analysis

Track trending developers and repositories:

```bash
# Get trending developers
bun run cli trending-devs python daily -c 5 -s 10 -f json

# Get trending repositories
bun run cli trending-repos javascript weekly --api
```

### Repository Analysis

Analyze repositories and their contributors:

```bash
# Analyze a specific repository
bun run cli analyze-repo owner repo-name -s 10

# Get repository contributors
bun run cli get-contributors owner repo-name

# Get contributors from trending repos
bun run cli get-contributors-from-trending-repos python -s 5 -c 3
```

### User Analysis

Analyze and enrich user data:

```bash
# Get user profile
bun run cli get-user-profile username

# Get user email
bun run cli get-user-email username

# Enrich user data
bun run cli enrich-user username --force
```

### Database Operations

```bash
# Test database connection
bun run cli test-db

# Query the database
bun run cli query-db -u username --repos
bun run cli query-db -r repository-url --contributors
bun run cli query-db "SELECT * FROM GithubUser LIMIT 5"
```

## Web Application

The web interface provides a user-friendly way to:
- View and filter ranked candidates
- Analyze candidate profiles and repositories
- Track trending developers and repositories
- Manage candidate notes and status
- Generate outreach messages

### API Endpoints

```typescript
// Get ranked candidates
GET /api/candidates?strategy=recent-activity&limit=20

// Get candidate details
GET /api/candidates/{username}

// Update candidate notes
POST /api/candidates/{username}/notes
```

## Data Structures

### Candidate Profile

```typescript
interface RankedCandidate extends GithubUser {
  score: number;
  scoreBreakdown?: {
    recentActivity: number;
    overallActivity: number;
    codeQuality: number;
    projectImpact: number;
  };
  notes?: string;
}
```

### Repository Data

```typescript
interface GithubRepository {
  id: string;
  url: string;
  name: string;
  description: string | null;
  primaryLanguage: string | null;
  languages: string[];
  stars: number;
  forks: number;
  contributorUserIds: Array<{
    username: string;
    contributions: number;
  }>;
  topics: string[];
  source: string | null;
  sourceMeta: any;
  createdAt: Date;
  updatedAt: Date;
}
```

## Environment Variables

```bash
# Required
DATABASE_URL="postgresql://..."
GITHUB_TOKEN=your_github_token

# Optional
GITHUB_TOKENS=token1,token2,token3  # For load balancing
GITHUB_TOKEN_LB_STRATEGY=ROUND_ROBIN  # Load balancing strategy
LOG_LEVEL=info  # debug, info, warn, error
```

## Development

1. Start the development server:
```bash
npm run dev
```

2. Run the CLI in development mode:
```bash
npm run cli:dev
```

3. Run tests:
```bash
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

MIT License - see LICENSE for details
