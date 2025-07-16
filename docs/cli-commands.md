# CLI Commands Reference

This document provides detailed information about Shadow Bee's command-line interface (CLI) tools.

## Overview

Shadow Bee's CLI provides a comprehensive set of tools for GitHub talent discovery, analysis, and communication. The CLI is built with a modular structure, organized by functionality.

To run any command, use the format:

```bash
bun run cli <command> [subcommand] [arguments] [options]
```

## Command Categories

- [GitHub Trending](#github-trending)
- [Repository Analysis](#repository-analysis)
- [User Analysis](#user-analysis)
- [Job Description Analysis](#job-description-analysis)
- [Candidate Operations](#candidate-operations)
- [Email Operations](#email-operations)
- [GitHub API Management](#github-api-management)
- [Database Operations](#database-operations)

## GitHub Trending

Commands for tracking trending repositories and developers on GitHub.

### trending-repos

Get trending repositories from GitHub.

```bash
bun run cli trending-repos [language] [since] [options]
```

Arguments:
- `language` - Programming language filter (optional)
- `since` - Time period: daily, weekly, monthly (default: daily)

Options:
- `-s, --sample <number>` - Number of repositories to sample (default: 0)
- `-c, --concurrency <number>` - Maximum number of concurrent fetches (default: 5)
- `-f, --force` - Force refresh even if data exists in database
- `--api` - Use GitHub API instead of scraping
- `--overwrite` - Overwrite existing cache entries

Examples:
```bash
# Get trending JavaScript repositories using the GitHub API
bun run cli trending-repos javascript --api

# Get weekly trending TypeScript repositories with concurrency of 3
bun run cli trending-repos typescript weekly -s 10 -c 3

# Get monthly trending Python repositories, force refresh cache
bun run cli trending-repos python monthly --force
```

### trending-devs

Get trending developers from GitHub.

```bash
bun run cli trending-devs [language] [since] [options]
```

Arguments:
- `language` - Programming language filter (optional)
- `since` - Time period: daily, weekly, monthly (default: daily)

Options:
- `-c, --concurrency <number>` - Maximum number of concurrent profile fetches (default: 5)
- `-s, --sample <number>` - Number of developers to sample (default: 0)
- `-f, --format <type>` - Output format: json or csv (default: json)
- `-o, --output <dir>` - Output directory (default: results)
- `-t, --top <number>` - Number of top developers to return (default: 50)
- `-r, --ranking <strategy>` - Ranking strategy: recent-activity, activity, productivity (default: recent-activity)
- `--api` - Use GitHub API instead of scraping
- `--force` - Force refresh even if data exists in database
- `--add-to-ats <jobDescriptionId>` - Add trending developers to ATS pipeline with specified job description ID

Examples:
```bash
# Get top 20 trending JavaScript developers with sample size of 10
bun run cli trending-devs javascript -s 10 -t 20 -c 3

# Get weekly trending TypeScript developers, output as CSV
bun run cli trending-devs typescript weekly --format csv

# Get Python developers and add them to ATS pipeline
bun run cli trending-devs python -s 5 --add-to-ats job123
```

## Repository Analysis

Commands for analyzing GitHub repositories and their contributors.

### analyze-repo

Analyze a GitHub repository for contributor activity and other metrics.

```bash
bun run cli analyze-repo <owner> <repo> [options]
```

Arguments:
- `owner` - Repository owner (username or organization)
- `repo` - Repository name

Options:
- `-s, --sample <number>` - Number of commits to sample (default: 100)
- `-c, --concurrency <number>` - Maximum number of concurrent fetches (default: 5)
- `-f, --force` - Force refresh even if data exists in database
- `--output <dir>` - Output directory for analysis results (default: results)

### get-contributors

Get contributors for a specific GitHub repository.

```bash
bun run cli get-contributors <owner> <repo> [options]
```

Arguments:
- `owner` - Repository owner (username or organization)
- `repo` - Repository name

Options:
- `-t, --top <number>` - Number of top contributors to return (default: 10)
- `-p, --per-repo <number>` - Contributors to fetch per repository (default: 10)
- `--force` - Force refresh even if data exists in database
- `--output <dir>` - Output directory for results (default: results)

### get-contributors-from-trending-repos

Get contributors from trending repositories.

```bash
bun run cli get-contributors-from-trending-repos [language] [since] [options]
```

Arguments:
- `language` - Programming language filter (optional)
- `since` - Time period: daily, weekly, monthly (default: daily)

Options:
- `-c, --concurrency <number>` - Maximum concurrent requests (default: 5)
- `-s, --sample <number>` - Number of repositories to sample (default: 10)
- `-t, --top <number>` - Number of top contributors to return per repo (default: 10)
- `-o, --output <dir>` - Output directory for results (default: results)

## User Analysis

Commands for analyzing GitHub users and their activity.

### get-user-profile

Get a GitHub user's profile.

```bash
bun run cli get-user-profile <username> [options]
```

Arguments:
- `username` - GitHub username

Options:
- `--force` - Force refresh even if data exists in database
- `--output <dir>` - Output directory for results (default: results)

### get-user-email

Attempt to discover a GitHub user's email address.

```bash
bun run cli get-user-email <username> [options]
```

Arguments:
- `username` - GitHub username

Options:
- `--force` - Force refresh even if data exists in database
- `--output <dir>` - Output directory for results (default: results)

### enrich-user

Enrich a GitHub user's data with additional information.

```bash
bun run cli enrich-user <username> [options]
```

Arguments:
- `username` - GitHub username

Options:
- `--force` - Force refresh even if data exists in database
- `--output <dir>` - Output directory for results (default: results)
- `--add-to-ats <jobDescriptionId>` - Add user to ATS pipeline with specified job description ID

## Job Description Analysis

Commands for analyzing job descriptions and matching candidates.

### parse-jd

Parse a job description to extract skills, requirements, and other information.

```bash
bun run cli parse-jd <file> [options]
```

Arguments:
- `file` - Path to job description file or text content

Options:
- `--save` - Save parsed job description to database
- `--output <dir>` - Output directory for results (default: results)

### match-candidates

Match candidates with a job description.

```bash
bun run cli match-candidates <jobDescriptionId> [options]
```

Arguments:
- `jobDescriptionId` - ID of the job description to match against

Options:
- `--top <number>` - Number of top matches to return (default: 20)
- `--min-score <number>` - Minimum match score (0-100, default: 60)
- `--output <dir>` - Output directory for results (default: results)

### generate-outreach

Generate personalized outreach message for a candidate based on job description.

```bash
bun run cli generate-outreach <username> <jobDescriptionId> [options]
```

Arguments:
- `username` - GitHub username of the candidate
- `jobDescriptionId` - ID of the job description

Options:
- `--template <string>` - Path to outreach template file
- `--output <dir>` - Output directory for results (default: results)

## Candidate Operations

Commands for managing candidates in the ATS pipeline.

### gather-candidates

Find and rank potential candidates based on GitHub activity.

```bash
bun run cli gather-candidates [language] [timeframe] [options]
```

Arguments:
- `language` - Programming language filter (optional)
- `timeframe` - Time period: daily, weekly, monthly (default: monthly)

Options:
- `-n, --count <number>` - Number of candidates to return (default: 20)
- `-s, --sample <number>` - Number of repositories to sample (default: 10)
- `-r, --ranking <strategy>` - Ranking strategy: recent-activity, activity, productivity (default: recent-activity)
- `-c, --concurrency <number>` - Maximum concurrent requests (default: 5)
- `-t, --top <number>` - Number of top contributors to return (default: 5)
- `-p, --per-repo <number>` - Contributors to fetch per repository (default: 5)

## Email Operations

Commands for email operations using various protocols.

### email send

Send an email using SMTP.

```bash
bun run cli email send [options]
```

Required Options:
- `--host <string>` - SMTP server host
- `--port <number>` - SMTP server port
- `--username <string>` - SMTP username
- `--password <string>` - SMTP password
- `--from <string>` - Sender email address
- `--to <string...>` - Recipient email address(es)
- `--subject <string>` - Email subject

Optional Options:
- `--tls` - Use TLS (default: true)
- `--text <string>` - Plain text content
- `--html <string>` - HTML content

### email list-imap

List emails using IMAP.

```bash
bun run cli email list-imap [options]
```

Required Options:
- `--host <string>` - IMAP server host
- `--port <number>` - IMAP server port
- `--username <string>` - IMAP username
- `--password <string>` - IMAP password

Optional Options:
- `--tls` - Use TLS (default: true)
- `--folder <string>` - Folder to list (default: INBOX)
- `--search <string>` - Search criteria in JSON format

### email list-pop3

List emails using POP3.

```bash
bun run cli email list-pop3 [options]
```

Required Options:
- `--host <string>` - POP3 server host
- `--port <number>` - POP3 server port
- `--username <string>` - POP3 username
- `--password <string>` - POP3 password

Optional Options:
- `--tls` - Use TLS (default: true)

### email azure-send

Send an email using Azure Communication Services.

```bash
bun run cli email azure-send [options]
```

Required Options:
- `--sender <string>` - Sender email address
- `--to <string...>` - Recipient email address(es)
- `--subject <string>` - Email subject

Optional Options:
- `--connection-string <string>` - Azure Communication Services connection string (can be set in .env)
- `--cc <string...>` - CC recipient email address(es)
- `--bcc <string...>` - BCC recipient email address(es)
- `--text <string>` - Plain text content
- `--html <string>` - HTML content

### email azure-status

Check the status of a sent email.

```bash
bun run cli email azure-status [options]
```

Required Options:
- `--connection-string <string>` - Azure Communication Services connection string
- `--sender <string>` - Sender email address
- `--message-id <string>` - Message ID to check

## GitHub API Management

Commands for managing GitHub API tokens and rate limits.

### rate-limit

Check GitHub API rate limits.

```bash
bun run cli rate-limit [options]
```

Options:
- `--token <string>` - GitHub token to check (defaults to token from .env)
- `--all` - Check all configured tokens

### tokens list

List all configured GitHub tokens.

```bash
bun run cli tokens list
```

### tokens rotate

Rotate to the next GitHub token.

```bash
bun run cli tokens rotate
```

## Database Operations

Commands for database operations.

### test-db

Test the database connection.

```bash
bun run cli test-db
```

### query-db

Run a query against the database.

```bash
bun run cli query-db [query] [options]
```

Arguments:
- `query` - SQL query to execute (optional)

Options:
- `-u, --username <string>` - Get data for a specific GitHub username
- `-r, --repo <string>` - Get data for a specific repository URL
- `--repos` - Include repository data for users
- `--contributors` - Include contributor data for repositories
- `--output <string>` - Output format: json, csv, table (default: table)

### backup-db

Create a backup of the database.

```bash
bun run cli backup-db [options]
```

Options:
- `--output <dir>` - Output directory for backup (default: backups)
- `--format <type>` - Backup format: json, sql (default: json)
- `--tables <string...>` - Specific tables to backup (default: all tables) 