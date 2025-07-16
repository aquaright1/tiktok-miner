# Code Reference

This document provides an overview of the key components, utilities, and common patterns used throughout the Shadow Bee codebase.

## Email Functionality

The application includes comprehensive email client functionality supporting SMTP, IMAP, and POP3 protocols.

### Email Clients

#### SMTP Client
Located in `lib/email/smtp-client.ts`, the SMTP client provides email sending capabilities:
- Connection management with TLS support
- Email sending with attachments
- HTML and plain text content support

#### IMAP Client
Located in `lib/email/imap-client.ts`, the IMAP client provides email retrieval and management:
- Folder listing and management
- Message searching with various criteria
- Full message retrieval with attachments
- Connection state management

#### POP3 Client
Located in `lib/email/pop3-client.ts`, the POP3 client provides basic email retrieval:
- Message listing
- Message retrieval
- Message deletion
- Basic message parsing

## GitHub API Integration

Located in `lib/github/`, these modules handle all GitHub API interactions:

### Repository Service
- Fetching repository details and metadata
- Analyzing repository contributors
- Tracking trending repositories
- Calculating repository statistics

### User Service
- Fetching user profiles and activity
- Enriching user data with additional information
- Ranking users based on various metrics
- Finding user contact information

## AI Integration

Located in `lib/ai/`, these modules provide AI capabilities:

### Job Description Analysis
- Parsing job descriptions to extract key requirements
- Matching job requirements with candidate skills
- Generating candidate summaries based on requirements

### Candidate Ranking
- Scoring candidates based on GitHub activity
- Applying various ranking algorithms
- Custom ranking strategies based on requirements

## UI Components

### Data Display Components
- `DataTable` - Advanced table component with sorting, filtering, and pagination
- `UserCard` - Compact display of user information
- `RepoCard` - Repository information display
- `ActivityChart` - Visualizing user activity over time

### Form Components
- `SearchForm` - Advanced search functionality with filters
- `FilterPanel` - UI for applying and managing filters
- `RankingControls` - Controls for adjusting ranking parameters

## Utilities

### GitHub Utilities
- Token management and rate limiting
- Result caching
- Error handling and retries

### Date and Time Utilities
- Relative time formatting
- Activity period calculations
- Date range utilities

### Data Processing
- Pagination helpers
- Sorting and filtering utilities
- Data transformation helpers

## Common Patterns

### Data Fetching
```typescript
// Server component data fetching
async function fetchData() {
  const data = await githubService.fetchRepositories({
    language: 'typescript',
    stars: '>100',
    limit: 10
  });
  return data;
}

// Client component data fetching
function useRepositoryData(owner: string, repo: string) {
  const [data, setData] = useState<Repository | null>(null);
  const [loading, isLoading] = useState(true);
  
  useEffect(() => {
    async function loadData() {
      try {
        const result = await fetch(`/api/repositories/${owner}/${repo}`);
        const data = await result.json();
        setData(data);
      } catch (error) {
        console.error("Failed to fetch repository data", error);
      } finally {
        isLoading(false);
      }
    }
    
    loadData();
  }, [owner, repo]);
  
  return { data, loading };
}
```

### Error Handling
```typescript
// Early returns pattern
async function getUserData(username: string) {
  if (!username) {
    return { error: "Username is required" };
  }
  
  try {
    const userData = await githubService.fetchUser(username);
    if (!userData) {
      return { error: "User not found" };
    }
    
    return { data: userData };
  } catch (error) {
    console.error(`Error fetching user ${username}:`, error);
    return { error: "Failed to fetch user data" };
  }
}
```

### Component Structure
```typescript
// Common component pattern
interface UserProfileProps {
  username: string;
  showDetails?: boolean;
}

export function UserProfile({ username, showDetails = false }: UserProfileProps) {
  const { data, loading, error } = useUserData(username);
  
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorDisplay message={error} />;
  if (!data) return <EmptyState message="No user data available" />;
  
  return (
    <div className="user-profile">
      <UserHeader user={data} />
      {showDetails && <UserDetails user={data} />}
    </div>
  );
}
``` 