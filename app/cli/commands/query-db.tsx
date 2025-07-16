import { Command } from 'commander';
import { queryDb } from '../handlers/query-db';

export const queryDbCommand = new Command('query-db')
  .description('Query GitHub users, repositories, and job descriptions from the database')
  .argument('[sql]', 'Raw SQL query to execute')
  .option('-u, --username <username>', 'GitHub username to search for')
  .option('-r, --repo <repo>', 'Repository URL or ID to search for')
  .option('-j, --jd <id>', 'Job Description ID to search for')
  .option('-t, --tag <tag>', 'Search Job Descriptions by tag')
  .option('-l, --limit <number>', 'Limit number of results', parseInt)
  .option('--repos', 'Include owned repositories for users')
  .option('--contributions', 'Include contributed repositories for users')
  .option('--contributors', 'Include contributors for repositories')
  .action(async (sql, options) => {
    try {
      if (sql) {
        // Handle raw SQL query
        await queryDb(sql);
      } else {
        // Handle structured query with options
        await queryDb({
          username: options.username,
          repoUrl: options.repo,
          limit: options.limit,
          includeRepos: options.repos,
          includeContributions: options.contributions,
          includeContributors: options.contributors,
          jdId: options.jd,
          jdTag: options.tag
        });
      }
    } catch (error) {
      console.error('Error executing query:', error);
    }
  });
