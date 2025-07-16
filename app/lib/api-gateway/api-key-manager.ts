import { createHash, randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { APIKeyData, APIGatewayError } from './types';
import { logger } from '../logger';

export interface APIKeyCreateOptions {
  name: string;
  permissions: string[];
  rateLimits?: {
    requestsPerHour?: number;
    requestsPerDay?: number;
    requestsPerMonth?: number;
  };
  expiresIn?: number; // days
  metadata?: Record<string, any>;
}

export class APIKeyManager {
  private prisma: PrismaClient;
  private cache: Map<string, APIKeyData> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  async createAPIKey(options: APIKeyCreateOptions): Promise<{
    key: string;
    keyData: APIKeyData;
  }> {
    const rawKey = this.generateAPIKey();
    const hashedKey = this.hashAPIKey(rawKey);
    
    const expiresAt = options.expiresIn
      ? new Date(Date.now() + options.expiresIn * 24 * 60 * 60 * 1000)
      : undefined;

    const keyData: APIKeyData = {
      id: randomBytes(16).toString('hex'),
      key: hashedKey,
      name: options.name,
      permissions: options.permissions,
      rateLimits: options.rateLimits || {},
      metadata: options.metadata,
      createdAt: new Date(),
      expiresAt,
      isActive: true
    };

    // Store in database (you would implement this based on your schema)
    // For now, we'll use a simple in-memory storage
    await this.storeAPIKey(keyData);

    return {
      key: rawKey,
      keyData: {
        ...keyData,
        key: rawKey // Return the raw key only on creation
      }
    };
  }

  async validateAPIKey(apiKey: string): Promise<APIKeyData> {
    const hashedKey = this.hashAPIKey(apiKey);
    
    // Check cache first
    const cached = this.cache.get(hashedKey);
    if (cached) {
      if (this.isKeyValid(cached)) {
        return cached;
      } else {
        this.cache.delete(hashedKey);
        throw new APIGatewayError(
          'API key is invalid or expired',
          'INVALID_API_KEY',
          401
        );
      }
    }

    // Fetch from database
    const keyData = await this.fetchAPIKey(hashedKey);
    
    if (!keyData) {
      throw new APIGatewayError(
        'Invalid API key',
        'INVALID_API_KEY',
        401
      );
    }

    if (!this.isKeyValid(keyData)) {
      throw new APIGatewayError(
        'API key is inactive or expired',
        'INVALID_API_KEY',
        401
      );
    }

    // Update last used timestamp
    await this.updateLastUsed(keyData.id);

    // Cache the key data
    this.cache.set(hashedKey, keyData);
    setTimeout(() => {
      this.cache.delete(hashedKey);
    }, this.cacheTimeout);

    return keyData;
  }

  async revokeAPIKey(keyId: string): Promise<void> {
    const keyData = await this.fetchAPIKeyById(keyId);
    
    if (!keyData) {
      throw new APIGatewayError(
        'API key not found',
        'KEY_NOT_FOUND',
        404
      );
    }

    keyData.isActive = false;
    await this.updateAPIKey(keyData);

    // Remove from cache
    this.cache.delete(keyData.key);

    logger.info(`API key ${keyData.name} (${keyId}) revoked`);
  }

  async updateAPIKeyPermissions(
    keyId: string,
    permissions: string[]
  ): Promise<APIKeyData> {
    const keyData = await this.fetchAPIKeyById(keyId);
    
    if (!keyData) {
      throw new APIGatewayError(
        'API key not found',
        'KEY_NOT_FOUND',
        404
      );
    }

    keyData.permissions = permissions;
    await this.updateAPIKey(keyData);

    // Remove from cache to force refresh
    this.cache.delete(keyData.key);

    return keyData;
  }

  async updateRateLimits(
    keyId: string,
    rateLimits: APIKeyData['rateLimits']
  ): Promise<APIKeyData> {
    const keyData = await this.fetchAPIKeyById(keyId);
    
    if (!keyData) {
      throw new APIGatewayError(
        'API key not found',
        'KEY_NOT_FOUND',
        404
      );
    }

    keyData.rateLimits = rateLimits;
    await this.updateAPIKey(keyData);

    // Remove from cache to force refresh
    this.cache.delete(keyData.key);

    return keyData;
  }

  async listAPIKeys(filters?: {
    isActive?: boolean;
    hasPermission?: string;
  }): Promise<APIKeyData[]> {
    // This would be implemented with proper database queries
    // For now, returning empty array
    return [];
  }

  async rotateAPIKey(keyId: string): Promise<{
    key: string;
    keyData: APIKeyData;
  }> {
    const oldKeyData = await this.fetchAPIKeyById(keyId);
    
    if (!oldKeyData) {
      throw new APIGatewayError(
        'API key not found',
        'KEY_NOT_FOUND',
        404
      );
    }

    // Revoke old key
    await this.revokeAPIKey(keyId);

    // Create new key with same permissions
    return this.createAPIKey({
      name: `${oldKeyData.name} (rotated)`,
      permissions: oldKeyData.permissions,
      rateLimits: oldKeyData.rateLimits,
      metadata: {
        ...oldKeyData.metadata,
        rotatedFrom: keyId,
        rotatedAt: new Date()
      }
    });
  }

  checkPermission(keyData: APIKeyData, requiredPermission: string): boolean {
    return keyData.permissions.includes('*') || 
           keyData.permissions.includes(requiredPermission);
  }

  private generateAPIKey(): string {
    const prefix = 'sk_';
    const randomPart = randomBytes(32).toString('base64url');
    return `${prefix}${randomPart}`;
  }

  private hashAPIKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  private isKeyValid(keyData: APIKeyData): boolean {
    if (!keyData.isActive) {
      return false;
    }

    if (keyData.expiresAt && keyData.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  // Database operations - these would be implemented with actual Prisma queries
  private async storeAPIKey(keyData: APIKeyData): Promise<void> {
    // TODO: Implement with Prisma
    logger.info(`Storing API key: ${keyData.name}`);
  }

  private async fetchAPIKey(hashedKey: string): Promise<APIKeyData | null> {
    // TODO: Implement with Prisma
    return null;
  }

  private async fetchAPIKeyById(keyId: string): Promise<APIKeyData | null> {
    // TODO: Implement with Prisma
    return null;
  }

  private async updateAPIKey(keyData: APIKeyData): Promise<void> {
    // TODO: Implement with Prisma
    logger.info(`Updating API key: ${keyData.name}`);
  }

  private async updateLastUsed(keyId: string): Promise<void> {
    // TODO: Implement with Prisma
    logger.debug(`Updating last used timestamp for key: ${keyId}`);
  }
}