import { Octokit } from '@octokit/rest';
import { GitHubTokenManager } from '../../lib/utils/token-manager';
import { logInfo, logWarn } from '../../lib/utils/logger';
import chalk from 'chalk';
import { GITHUB_TOKEN, GITHUB_TOKENS } from '@/lib/config';

interface RateLimitResource {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

interface RateLimitResponse {
  resources: {
    core: RateLimitResource;
    search: RateLimitResource;
    graphql: RateLimitResource;
    [key: string]: RateLimitResource;
  };
}

/**
 * Format timestamp to human readable format
 */
function formatResetTime(timestamp: number): string {
  const resetDate = new Date(timestamp * 1000);
  const now = new Date();
  const diffMinutes = Math.round((resetDate.getTime() - now.getTime()) / (1000 * 60));
  
  return `${resetDate.toLocaleTimeString()} (in ${diffMinutes} minutes)`;
}

/**
 * Format rate limit info with colors based on remaining percentage
 */
function formatRateLimit(resource: RateLimitResource, name: string): string {
  const remainingPercentage = (resource.remaining / resource.limit) * 100;
  const resetTime = new Date(resource.reset * 1000).toLocaleTimeString();
  const color = remainingPercentage > 20 ? 'green' : remainingPercentage > 10 ? 'yellow' : 'red';

  return `${name}:
    ${chalk[color](`${resource.remaining}/${resource.limit} remaining (${remainingPercentage.toFixed(1)}%)`)}
    Reset at: ${resetTime}
    Used: ${resource.used}`;
}

/**
 * Check GitHub API rate limits for all tokens
 */
export async function checkRateLimit(options: { json?: boolean } = {}): Promise<void> {
  try {
    const tokenManager = GitHubTokenManager.getInstance();
    tokenManager.reset();

    const tokenStatus = tokenManager.getTokensStatus();
    if (!tokenStatus.length) {
      throw new Error('No GitHub tokens available');
    }

    // Show load balancing configuration
    logInfo('\nLoad Balancing Configuration:');
    logInfo(`Total Tokens: ${chalk.blue(tokenStatus.length)}`);

    // Show current token rotation status
    logInfo('\nToken Rotation Status:');
    tokenStatus.forEach(status => {
      const remainingPercentage = (status.remaining / 5000) * 100; // 5000 is default limit
      const remainingColor = remainingPercentage > 20 ? 'green' : remainingPercentage > 5 ? 'yellow' : 'red';
      
      logInfo(`\n${chalk.bold(`Token ${status.index + 1} (${status.token.slice(0, 8)}...)`)}:`);
      logInfo(`- Remaining: ${chalk[remainingColor](`${status.remaining}`)} requests (${remainingPercentage.toFixed(1)}%)`);
      logInfo(`- Reset Time: ${new Date(status.resetTime).toLocaleTimeString()}`);
      logInfo(`- Last Used: ${new Date(status.lastUsed).toLocaleTimeString()}`);
    });

    // Check actual rate limits for each token
    logInfo('\nDetailed Rate Limits:');
    for (let i = 0; i < tokenStatus.length; i++) {
      const token = tokenManager.getNextToken();
      const octokit = new Octokit({ auth: token });
      const response = await octokit.rest.rateLimit.get();
      const data = response.data as RateLimitResponse;

      if (options.json) {
        console.log(`\nToken ${i + 1} (${token.slice(0, 8)}...):`, JSON.stringify(data, null, 2));
        continue;
      }

      logInfo(`\n${chalk.bold.blue(`Token ${i + 1} (${token.slice(0, 8)}...)`)}`);
      
      // Core API limits
      logInfo(formatRateLimit(data.resources.core, 'Core API'));

      // Search API limits
      logInfo(formatRateLimit(data.resources.search, 'Search API'));

      // GraphQL API limits
      logInfo(formatRateLimit(data.resources.graphql, 'GraphQL API'));

      // Update token status in manager
      tokenManager.updateTokenStatus(token, {
        'x-ratelimit-remaining': data.resources.core.remaining.toString(),
        'x-ratelimit-reset': data.resources.core.reset.toString()
      });

      // Show warning if any limit is close to being exhausted
      const WARNING_THRESHOLD = 0.1; // 10% remaining
      for (const [resource, limits] of Object.entries(data.resources)) {
        const remainingPercentage = limits.remaining / limits.limit;
        if (remainingPercentage <= WARNING_THRESHOLD) {
          logWarn(`⚠️  Warning: ${resource} API has only ${limits.remaining} requests remaining (${(remainingPercentage * 100).toFixed(1)}%)`);
        }
      }
    }

  } catch (error) {
    if (error instanceof Error) {
      logWarn(`Error checking rate limits: ${error.message}`);
    } else {
      logWarn('Error checking rate limits');
    }
  }
} 