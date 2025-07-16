/**
 * Concrete implementation of ResultProcessor for webhook data
 */

import { UnifiedCreatorData, ValidationResult } from '@/lib/apify/schemas';
import { TransformerFactory } from '@/lib/apify/transformers';
import { prisma } from '@/lib/prisma';
import { ResultProcessor } from './result-processor';
import {
  ProcessingContext,
  DuplicateResult,
  NormalizedData,
  MergeOptions,
  ProcessingOptions,
} from './types';
import { ValidatorRegistry, ExtendedValidationResult } from './validators';
import { PlatformNormalizerFactory } from './normalizers';

/**
 * Webhook result processor for handling Apify webhook data
 */
export class WebhookResultProcessor extends ResultProcessor<UnifiedCreatorData> {
  constructor(options: Partial<ProcessingOptions> = {}) {
    super(options);
  }

  /**
   * Transform raw webhook data to UnifiedCreatorData
   */
  protected async transform(
    data: any,
    context: ProcessingContext
  ): Promise<UnifiedCreatorData> {
    const transformResult = TransformerFactory.transform(context.platform, data);
    
    if (!transformResult.validation.isValid) {
      throw new Error(
        `Transformation failed: ${transformResult.validation.errors.join(', ')}`
      );
    }

    if (!transformResult.data) {
      throw new Error('Transformation produced no data');
    }

    return transformResult.data;
  }

  /**
   * Validate input data using platform-specific schemas
   */
  async validate(data: any, context: ProcessingContext): Promise<ValidationResult> {
    // First use the basic validation from transformers
    const transformResult = TransformerFactory.transform(context.platform, data);
    
    // Then apply extended validation if available
    const validator = ValidatorRegistry.get(context.platform);
    if (validator) {
      const extendedResult = await validator.validate(data, {
        platform: context.platform,
        source: context.source,
        timestamp: new Date(),
        metadata: context.metadata,
      }) as ExtendedValidationResult;
      
      // Merge results
      return {
        isValid: transformResult.validation.isValid && extendedResult.isValid,
        errors: [...transformResult.validation.errors, ...extendedResult.errors],
        warnings: extendedResult.warnings,
        suggestions: extendedResult.suggestions,
        dataQualityScore: extendedResult.dataQualityScore,
      } as ValidationResult & Partial<ExtendedValidationResult>;
    }
    
    return transformResult.validation;
  }

  /**
   * Normalize the data
   */
  async normalize(
    data: UnifiedCreatorData,
    context: ProcessingContext
  ): Promise<NormalizedData<UnifiedCreatorData>> {
    try {
      // Use platform-specific normalizer
      const normalizer = PlatformNormalizerFactory.getNormalizer(context.platform);
      const result = await normalizer.normalize(data, context.platform);
      
      return {
        data: result.data,
        changes: result.changes,
        warnings: result.warnings,
      };
    } catch (error) {
      // Fallback to basic normalization if platform normalizer fails
      const changes: any[] = [];
      const warnings: string[] = [];
      const normalized = { ...data };

      warnings.push(`Platform normalizer failed, using basic normalization: ${error instanceof Error ? error.message : String(error)}`);

      // Basic normalization for platform identifiers
      if (normalized.platformIdentifiers) {
        Object.entries(normalized.platformIdentifiers).forEach(([key, value]) => {
          if (typeof value === 'string') {
            const trimmed = value.trim().toLowerCase();
            if (trimmed !== value) {
              changes.push({
                field: `platformIdentifiers.${key}`,
                oldValue: value,
                newValue: trimmed,
                reason: 'Normalized to lowercase and trimmed',
              });
              (normalized.platformIdentifiers as any)[key] = trimmed;
            }
          }
        });
      }

      // Basic normalization for tags
      if (normalized.tags && Array.isArray(normalized.tags)) {
        const originalTags = [...normalized.tags];
        normalized.tags = normalized.tags
          .map(tag => tag.toLowerCase().trim())
          .filter((tag, index, self) => tag && self.indexOf(tag) === index);

        if (JSON.stringify(originalTags) !== JSON.stringify(normalized.tags)) {
          changes.push({
            field: 'tags',
            oldValue: originalTags,
            newValue: normalized.tags,
            reason: 'Normalized tags: lowercase, trimmed, deduplicated',
          });
        }
      }
    }

    // Normalize category
    if (normalized.category) {
      const normalizedCategory = normalized.category.toLowerCase().trim();
      if (normalizedCategory !== normalized.category) {
        changes.push({
          field: 'category',
          oldValue: normalized.category,
          newValue: normalizedCategory,
          reason: 'Normalized to lowercase and trimmed',
        });
        normalized.category = normalizedCategory;
      }
    }

    // Ensure totalReach is non-negative
    if (normalized.totalReach < 0) {
      changes.push({
        field: 'totalReach',
        oldValue: normalized.totalReach,
        newValue: 0,
        reason: 'Negative reach normalized to 0',
      });
      normalized.totalReach = 0;
      warnings.push('Total reach was negative, normalized to 0');
    }

    // Ensure engagement metrics are within valid ranges
    if (normalized.averageEngagementRate) {
      if (normalized.averageEngagementRate < 0) {
        changes.push({
          field: 'averageEngagementRate',
          oldValue: normalized.averageEngagementRate,
          newValue: 0,
          reason: 'Negative engagement rate normalized to 0',
        });
        normalized.averageEngagementRate = 0;
      } else if (normalized.averageEngagementRate > 100) {
        changes.push({
          field: 'averageEngagementRate',
          oldValue: normalized.averageEngagementRate,
          newValue: 100,
          reason: 'Engagement rate capped at 100%',
        });
        normalized.averageEngagementRate = 100;
        warnings.push('Engagement rate exceeded 100%, capped at maximum');
      }
    }

    return { data: normalized, changes, warnings };
  }

  /**
   * Detect duplicates based on platform identifiers
   */
  async detectDuplicate(
    data: UnifiedCreatorData,
    context: ProcessingContext
  ): Promise<DuplicateResult> {
    // Check for exact matches on platform identifiers
    const platformIds = data.platformIdentifiers;
    const orConditions: any[] = [];

    // Build OR conditions for each platform identifier
    Object.entries(platformIds).forEach(([key, value]) => {
      if (value) {
        orConditions.push({
          platformIdentifiers: {
            path: [key],
            equals: value,
          },
        });
      }
    });

    if (orConditions.length === 0) {
      return {
        isDuplicate: false,
        confidence: 0,
        matchedFields: [],
        strategy: 'exact',
      };
    }

    try {
      // Query database for existing profiles with matching identifiers
      const existing = await prisma.creatorProfile.findFirst({
        where: {
          OR: orConditions,
        },
        select: {
          id: true,
          platformIdentifiers: true,
          name: true,
        },
      });

      if (existing) {
        // Determine which fields matched
        const matchedFields: string[] = [];
        Object.entries(platformIds).forEach(([key, value]) => {
          if (value && (existing.platformIdentifiers as any)[key] === value) {
            matchedFields.push(key);
          }
        });

        return {
          isDuplicate: true,
          matchingId: existing.id,
          confidence: matchedFields.length / Object.keys(platformIds).length,
          matchedFields,
          strategy: 'exact',
        };
      }

      // Check for fuzzy name matching as a fallback
      if (data.name) {
        const nameMatch = await prisma.creatorProfile.findFirst({
          where: {
            name: {
              equals: data.name,
              mode: 'insensitive',
            },
          },
          select: {
            id: true,
            name: true,
          },
        });

        if (nameMatch) {
          return {
            isDuplicate: true,
            matchingId: nameMatch.id,
            confidence: 0.5, // Lower confidence for name-only matches
            matchedFields: ['name'],
            strategy: 'fuzzy',
          };
        }
      }

      return {
        isDuplicate: false,
        confidence: 0,
        matchedFields: [],
        strategy: 'exact',
      };
    } catch (error) {
      console.error('Error detecting duplicate:', error);
      return {
        isDuplicate: false,
        confidence: 0,
        matchedFields: [],
        strategy: 'exact',
      };
    }
  }

  /**
   * Merge duplicate profiles
   */
  async merge(
    source: UnifiedCreatorData,
    target: UnifiedCreatorData,
    options: MergeOptions
  ): Promise<UnifiedCreatorData> {
    const merged = { ...target };

    switch (options.strategy) {
      case 'newest':
        // Source overwrites target
        return { ...source };

      case 'oldest':
        // Target is preserved
        return { ...target };

      case 'most-complete':
        // Merge fields, preferring non-null/non-empty values
        Object.entries(source).forEach(([key, value]) => {
          const targetValue = (target as any)[key];
          
          // Skip if field should be preserved
          if (options.preserveFields?.includes(key)) {
            return;
          }

          // Use source value if target is null/undefined/empty
          if (this.isMoreComplete(value, targetValue)) {
            (merged as any)[key] = value;
          }
        });

        // Merge platform identifiers
        if (source.platformIdentifiers && merged.platformIdentifiers) {
          merged.platformIdentifiers = {
            ...merged.platformIdentifiers,
            ...source.platformIdentifiers,
          };
        }

        // Merge tags
        if (source.tags && merged.tags) {
          const allTags = [...(merged.tags || []), ...(source.tags || [])];
          merged.tags = [...new Set(allTags)];
        }

        // Use higher metrics
        if (source.totalReach > merged.totalReach) {
          merged.totalReach = source.totalReach;
        }

        if (source.compositeEngagementScore && merged.compositeEngagementScore) {
          if (source.compositeEngagementScore > merged.compositeEngagementScore) {
            merged.compositeEngagementScore = source.compositeEngagementScore;
          }
        }

        break;

      case 'custom':
        // Custom merge logic can be implemented here
        break;
    }

    return merged;
  }

  /**
   * Fetch existing data from database
   */
  protected async fetchExisting(
    id: string,
    context: ProcessingContext
  ): Promise<UnifiedCreatorData | null> {
    try {
      const existing = await prisma.creatorProfile.findUnique({
        where: { id },
      });

      if (!existing) {
        return null;
      }

      // Convert database model to UnifiedCreatorData
      return {
        name: existing.name,
        email: existing.email,
        bio: existing.bio,
        profileImageUrl: existing.profileImageUrl,
        category: existing.category,
        tags: existing.tags,
        isVerified: existing.isVerified,
        platformIdentifiers: existing.platformIdentifiers as any,
        totalReach: existing.totalReach,
        compositeEngagementScore: existing.compositeEngagementScore,
        averageEngagementRate: existing.averageEngagementRate,
        contentFrequency: existing.contentFrequency,
        audienceQualityScore: existing.audienceQualityScore,
        platformData: existing.platformData as any,
        sourceActorId: existing.lastScrapedBy,
        scrapedAt: existing.lastScrapedAt || undefined,
      };
    } catch (error) {
      console.error('Error fetching existing data:', error);
      return null;
    }
  }

  /**
   * Helper to determine if a value is more complete than another
   */
  private isMoreComplete(sourceValue: any, targetValue: any): boolean {
    // Null/undefined check
    if (targetValue === null || targetValue === undefined) {
      return sourceValue !== null && sourceValue !== undefined;
    }

    // Empty string check
    if (typeof targetValue === 'string' && targetValue.trim() === '') {
      return typeof sourceValue === 'string' && sourceValue.trim() !== '';
    }

    // Empty array check
    if (Array.isArray(targetValue) && targetValue.length === 0) {
      return Array.isArray(sourceValue) && sourceValue.length > 0;
    }

    // Default: keep target value
    return false;
  }
}