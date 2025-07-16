import { logger } from '@/lib/logger';

export interface ApifyUserData {
  id: string;
  username: string;
  email: string;
  profile: {
    name?: string;
    pictureUrl?: string;
  };
  createdAt: string;
  plan: {
    id: string;
    name: string;
    description?: string;
  };
}

export interface ApifyLimitsData {
  monthlyUsageCycle: {
    startAt: string;
    endAt: string;
  };
  limits: {
    maxMonthlyUsageUsd: number;
    maxMonthlyActorComputeUnits: number;
    maxMonthlyExternalDataTransferGbytes: number;
    maxMonthlyProxySerps: number;
    maxMonthlyResidentialProxyGbytes: number;
    maxActorMemoryGbytes: number;
    maxActorCount: number;
    maxActorTaskCount: number;
    maxScheduleCount: number;
    maxConcurrentActorJobs: number;
    maxTeamAccountSeatCount: number;
    dataRetentionDays: number;
  };
  current: {
    monthlyUsageUsd: number;
    monthlyActorComputeUnits: number;
    monthlyExternalDataTransferGbytes: number;
    monthlyProxySerps: number;
    monthlyResidentialProxyGbytes: number;
    actorMemoryGbytes: number;
    actorCount: number;
    actorTaskCount: number;
    scheduleCount: number;
    concurrentActorJobs: number;
    teamAccountSeatCount: number;
  };
}

export interface ApifyMonthlyUsageData {
  usageCycle: {
    startAt: string;
    endAt: string;
  };
  monthlyServiceUsage: {
    [key: string]: {
      quantity: number;
      baseAmountUsd: number;
      baseUnitPriceUsd: number;
      amountAfterVolumeDiscountUsd: number;
      priceTiers: Array<{
        quantityAbove: number;
        discountPercent: number;
        tierQuantity: number;
        unitPriceUsd: number;
        priceUsd: number;
      }>;
    };
  };
  totalAmountUsd: number;
  totalAmountAfterVolumeDiscountUsd: number;
}

export interface ApifyUsageMetrics {
  currentUsage: {
    computeUnits: number;
    storageBytes: number;
    datasetOperations: number;
    proxyRequests: number;
  };
  limits: {
    computeUnits: number;
    storageBytes: number;
    datasetOperations: number;
    proxyRequests: number;
  };
  utilization: {
    computeUnits: number; // percentage
    storageBytes: number; // percentage
    datasetOperations: number; // percentage
    proxyRequests: number; // percentage
  };
  estimatedCost: {
    monthly: number;
    daily: number;
    projected: number;
  };
  plan: {
    name: string;
    resetDay: number;
    daysUntilReset: number;
  };
}

export class ApifyUserService {
  private readonly apifyToken: string;
  private readonly baseUrl = 'https://api.apify.com/v2';

  constructor() {
    this.apifyToken = process.env.APIFY_API_KEY || '';
    
    if (!this.apifyToken) {
      logger.warn('Apify API key not configured - user data monitoring will be limited');
    }
    
    logger.info('Apify User Service initialized', {
      hasToken: !!this.apifyToken
    });
  }

  /**
   * Get user account data
   */
  async getUserData(): Promise<ApifyUserData | null> {
    if (!this.apifyToken) {
      logger.warn('Apify API key not configured - cannot fetch user data');
      return null;
    }

    try {
      const url = `${this.baseUrl}/users/me`;
      logger.debug('Fetching Apify user data', { url });
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apifyToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Apify API error response', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText 
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      logger.debug('Apify user data fetched successfully');
      return data.data as ApifyUserData;
    } catch (error) {
      logger.error('Failed to fetch Apify user data:', error);
      return null;
    }
  }

  /**
   * Get user limits and current usage
   */
  async getLimits(): Promise<ApifyLimitsData | null> {
    if (!this.apifyToken) {
      logger.warn('Apify API key not configured - cannot fetch limits');
      return null;
    }

    try {
      const url = `${this.baseUrl}/users/me/limits`;
      logger.debug('Fetching Apify limits', { url });
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apifyToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Apify API error response', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText 
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      logger.debug('Apify limits fetched successfully');
      return data.data as ApifyLimitsData;
    } catch (error) {
      logger.error('Failed to fetch Apify limits:', error);
      return null;
    }
  }

  /**
   * Get monthly usage data
   */
  async getMonthlyUsage(): Promise<ApifyMonthlyUsageData | null> {
    if (!this.apifyToken) {
      logger.warn('Apify API key not configured - cannot fetch monthly usage');
      return null;
    }

    try {
      const url = `${this.baseUrl}/users/me/usage/monthly`;
      logger.debug('Fetching Apify monthly usage', { url });
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apifyToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Apify API error response', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText 
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      logger.debug('Apify monthly usage fetched successfully');
      return data.data as ApifyMonthlyUsageData;
    } catch (error) {
      logger.error('Failed to fetch Apify monthly usage:', error);
      return null;
    }
  }

  /**
   * Get processed usage metrics for monitoring dashboard
   */
  async getUsageMetrics(): Promise<ApifyUsageMetrics | null> {
    const [limitsData, monthlyUsage] = await Promise.all([
      this.getLimits(),
      this.getMonthlyUsage()
    ]);
    
    if (!limitsData || !monthlyUsage) return null;

    try {
      const { limits, current } = limitsData;
      
      // Calculate utilization percentages
      const computeUtilization = limits.maxMonthlyActorComputeUnits > 0 
        ? (current.monthlyActorComputeUnits / limits.maxMonthlyActorComputeUnits) * 100
        : 0;
      
      // Convert GB to bytes for storage
      const storageBytes = current.monthlyExternalDataTransferGbytes * 1024 * 1024 * 1024;
      const storageLimitBytes = limits.maxMonthlyExternalDataTransferGbytes * 1024 * 1024 * 1024;
      const storageUtilization = storageLimitBytes > 0
        ? (storageBytes / storageLimitBytes) * 100
        : 0;
      
      // Calculate dataset operations from monthly usage
      let datasetOps = 0;
      let datasetReads = 0;
      let datasetWrites = 0;
      if (monthlyUsage.monthlyServiceUsage) {
        datasetReads = monthlyUsage.monthlyServiceUsage.DATASET_READS?.quantity || 0;
        datasetWrites = monthlyUsage.monthlyServiceUsage.DATASET_WRITES?.quantity || 0;
        datasetOps = datasetReads + datasetWrites;
      }
      const datasetUtilization = 0; // No explicit limit in the API
      
      const proxyUtilization = limits.maxMonthlyProxySerps > 0
        ? (current.monthlyProxySerps / limits.maxMonthlyProxySerps) * 100
        : 0;

      // Calculate days until reset
      const now = new Date();
      const resetDate = new Date(limitsData.monthlyUsageCycle.endAt);
      const daysUntilReset = Math.ceil((resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        currentUsage: {
          computeUnits: current.monthlyActorComputeUnits,
          storageBytes: storageBytes,
          datasetOperations: datasetOps,
          proxyRequests: current.monthlyProxySerps + current.monthlyResidentialProxyGbytes,
        },
        limits: {
          computeUnits: limits.maxMonthlyActorComputeUnits,
          storageBytes: storageLimitBytes,
          datasetOperations: 999999, // No explicit limit
          proxyRequests: limits.maxMonthlyProxySerps,
        },
        utilization: {
          computeUnits: Math.round(computeUtilization * 100) / 100,
          storageBytes: Math.round(storageUtilization * 100) / 100,
          datasetOperations: Math.round(datasetUtilization * 100) / 100,
          proxyRequests: Math.round(proxyUtilization * 100) / 100,
        },
        estimatedCost: {
          monthly: current.monthlyUsageUsd,
          daily: current.monthlyUsageUsd / 30,
          projected: monthlyUsage.totalAmountAfterVolumeDiscountUsd || current.monthlyUsageUsd,
        },
        plan: {
          name: 'Free',
          resetDay: new Date(limitsData.monthlyUsageCycle.startAt).getDate(),
          daysUntilReset,
        },
      };
    } catch (error) {
      logger.error('Failed to process Apify usage metrics:', error);
      return null;
    }
  }


  /**
   * Get usage alerts based on thresholds
   */
  async getUsageAlerts(): Promise<Array<{
    type: 'warning' | 'critical';
    resource: string;
    message: string;
    utilization: number;
  }>> {
    const metrics = await this.getUsageMetrics();
    if (!metrics) return [];

    const alerts = [];
    const { utilization } = metrics;

    // Check each resource type
    const resources = [
      { key: 'computeUnits', name: 'Compute Units', value: utilization.computeUnits },
      { key: 'storageBytes', name: 'Storage', value: utilization.storageBytes },
      { key: 'datasetOperations', name: 'Dataset Operations', value: utilization.datasetOperations },
      { key: 'proxyRequests', name: 'Proxy Requests', value: utilization.proxyRequests },
    ];

    for (const resource of resources) {
      if (resource.value >= 90) {
        alerts.push({
          type: 'critical' as const,
          resource: resource.name,
          message: `${resource.name} usage is at ${resource.value.toFixed(1)}% of limit`,
          utilization: resource.value,
        });
      } else if (resource.value >= 75) {
        alerts.push({
          type: 'warning' as const,
          resource: resource.name,
          message: `${resource.name} usage is at ${resource.value.toFixed(1)}% of limit`,
          utilization: resource.value,
        });
      }
    }

    return alerts;
  }

  /**
   * Get user info - simplified wrapper for getUserData
   */
  async getUserInfo(): Promise<ApifyUserData | null> {
    return await this.getUserData();
  }
}

export const apifyUserService = new ApifyUserService();