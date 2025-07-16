/**
 * Type-safe data transformation pipeline for converting Apify responses to UnifiedCreatorData
 */

import { z } from 'zod';
import {
  UnifiedCreatorData,
  TransformationResult,
  ValidationResult,
  validateApifyResponse,
} from './schemas';
import { TransformerFactory } from './transformers';
import { sanitizeObject, SanitizationOptions } from './sanitizers';

/**
 * Pipeline step types
 */
export enum PipelineStep {
  INPUT_VALIDATION = 'input_validation',
  TRANSFORMATION = 'transformation',
  SANITIZATION = 'sanitization',
  OUTPUT_VALIDATION = 'output_validation',
}

/**
 * Pipeline error with context
 */
export interface PipelineError {
  step: PipelineStep;
  message: string;
  data?: any;
}

/**
 * Pipeline result with detailed information
 */
export interface PipelineResult {
  success: boolean;
  data?: UnifiedCreatorData;
  errors: PipelineError[];
  warnings: string[];
  metadata: {
    platform: string;
    processingTime: number;
    steps: {
      step: PipelineStep;
      status: 'success' | 'failure' | 'skipped';
      duration: number;
    }[];
  };
}

/**
 * Pipeline configuration options
 */
export interface PipelineOptions {
  /**
   * Whether to skip input validation
   */
  skipInputValidation?: boolean;
  
  /**
   * Whether to skip output validation
   */
  skipOutputValidation?: boolean;
  
  /**
   * Custom sanitization options
   */
  sanitizationOptions?: SanitizationOptions;
  
  /**
   * Whether to collect warnings
   */
  collectWarnings?: boolean;
  
  /**
   * Maximum processing time in milliseconds
   */
  timeout?: number;
}

/**
 * Default pipeline options
 */
const DEFAULT_OPTIONS: PipelineOptions = {
  skipInputValidation: false,
  skipOutputValidation: false,
  collectWarnings: true,
  timeout: 5000, // 5 seconds
};

/**
 * Type-safe data transformation pipeline
 */
export class DataTransformationPipeline {
  private options: PipelineOptions;

  constructor(options: PipelineOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Process a single creator profile through the pipeline
   */
  async process(
    platform: string,
    rawData: any
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const errors: PipelineError[] = [];
    const warnings: string[] = [];
    const steps: PipelineResult['metadata']['steps'] = [];
    
    // Timeout wrapper
    const timeoutPromise = new Promise<PipelineResult>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Pipeline timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);
    });

    const processingPromise = this.processInternal(
      platform,
      rawData,
      errors,
      warnings,
      steps
    );

    try {
      const result = await Promise.race([processingPromise, timeoutPromise]);
      return {
        ...result,
        metadata: {
          ...result.metadata,
          processingTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          ...errors,
          {
            step: PipelineStep.TRANSFORMATION,
            message: error.message || 'Pipeline processing failed',
          },
        ],
        warnings,
        metadata: {
          platform,
          processingTime: Date.now() - startTime,
          steps,
        },
      };
    }
  }

  /**
   * Process multiple creator profiles in batch
   */
  async processBatch(
    platform: string,
    rawDataArray: any[]
  ): Promise<PipelineResult[]> {
    return Promise.all(
      rawDataArray.map(data => this.process(platform, data))
    );
  }

  /**
   * Internal processing logic
   */
  private async processInternal(
    platform: string,
    rawData: any,
    errors: PipelineError[],
    warnings: string[],
    steps: PipelineResult['metadata']['steps']
  ): Promise<PipelineResult> {
    let transformedData: UnifiedCreatorData | null = null;

    // Step 1: Input Validation
    const inputValidationStart = Date.now();
    if (!this.options.skipInputValidation) {
      const inputValidation = this.validateInput(platform, rawData);
      steps.push({
        step: PipelineStep.INPUT_VALIDATION,
        status: inputValidation.isValid ? 'success' : 'failure',
        duration: Date.now() - inputValidationStart,
      });

      if (!inputValidation.isValid) {
        errors.push({
          step: PipelineStep.INPUT_VALIDATION,
          message: 'Input validation failed',
          data: inputValidation.errors,
        });
        // Continue with transformation even if input validation fails
        // as transformers may handle missing fields
      }

      if (this.options.collectWarnings && inputValidation.warnings.length > 0) {
        warnings.push(...inputValidation.warnings);
      }
    } else {
      steps.push({
        step: PipelineStep.INPUT_VALIDATION,
        status: 'skipped',
        duration: 0,
      });
    }

    // Step 2: Transformation
    const transformationStart = Date.now();
    try {
      const transformationResult = this.transform(platform, rawData);
      steps.push({
        step: PipelineStep.TRANSFORMATION,
        status: transformationResult.validation.isValid ? 'success' : 'failure',
        duration: Date.now() - transformationStart,
      });

      if (!transformationResult.validation.isValid) {
        errors.push({
          step: PipelineStep.TRANSFORMATION,
          message: 'Transformation failed',
          data: transformationResult.validation.errors,
        });
        return this.createFailureResult(platform, errors, warnings, steps);
      }

      transformedData = transformationResult.data;

      if (this.options.collectWarnings && transformationResult.validation.warnings.length > 0) {
        warnings.push(...transformationResult.validation.warnings);
      }
    } catch (error) {
      steps.push({
        step: PipelineStep.TRANSFORMATION,
        status: 'failure',
        duration: Date.now() - transformationStart,
      });
      errors.push({
        step: PipelineStep.TRANSFORMATION,
        message: error.message || 'Transformation error',
        data: error,
      });
      return this.createFailureResult(platform, errors, warnings, steps);
    }

    if (!transformedData) {
      return this.createFailureResult(platform, errors, warnings, steps);
    }

    // Step 3: Sanitization
    const sanitizationStart = Date.now();
    try {
      const sanitizedData = this.sanitize(transformedData);
      transformedData = sanitizedData;
      steps.push({
        step: PipelineStep.SANITIZATION,
        status: 'success',
        duration: Date.now() - sanitizationStart,
      });
    } catch (error) {
      steps.push({
        step: PipelineStep.SANITIZATION,
        status: 'failure',
        duration: Date.now() - sanitizationStart,
      });
      errors.push({
        step: PipelineStep.SANITIZATION,
        message: error.message || 'Sanitization error',
        data: error,
      });
      return this.createFailureResult(platform, errors, warnings, steps);
    }

    // Step 4: Output Validation
    const outputValidationStart = Date.now();
    if (!this.options.skipOutputValidation) {
      const outputValidation = this.validateOutput(transformedData);
      steps.push({
        step: PipelineStep.OUTPUT_VALIDATION,
        status: outputValidation.isValid ? 'success' : 'failure',
        duration: Date.now() - outputValidationStart,
      });

      if (!outputValidation.isValid) {
        errors.push({
          step: PipelineStep.OUTPUT_VALIDATION,
          message: 'Output validation failed',
          data: outputValidation.errors,
        });
        return this.createFailureResult(platform, errors, warnings, steps);
      }

      if (this.options.collectWarnings && outputValidation.warnings.length > 0) {
        warnings.push(...outputValidation.warnings);
      }
    } else {
      steps.push({
        step: PipelineStep.OUTPUT_VALIDATION,
        status: 'skipped',
        duration: 0,
      });
    }

    // Success!
    return {
      success: true,
      data: transformedData,
      errors: [],
      warnings,
      metadata: {
        platform,
        processingTime: 0, // Will be set by caller
        steps,
      },
    };
  }

  /**
   * Validate input data against platform schema
   */
  private validateInput(platform: string, data: any): ValidationResult {
    return validateApifyResponse(platform, data);
  }

  /**
   * Transform data using platform-specific transformer
   */
  private transform(platform: string, data: any): TransformationResult {
    return TransformerFactory.transform(platform, data);
  }

  /**
   * Sanitize transformed data
   */
  private sanitize(data: UnifiedCreatorData): UnifiedCreatorData {
    return sanitizeObject(data, this.options.sanitizationOptions);
  }

  /**
   * Validate output data
   */
  private validateOutput(data: UnifiedCreatorData): ValidationResult {
    try {
      // Additional business logic validation beyond schema
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check for suspicious metrics
      if (data.totalReach > 1000000000) {
        warnings.push('Unusually high follower count detected');
      }

      if (data.averageEngagementRate && data.averageEngagementRate > 50) {
        warnings.push('Unusually high engagement rate detected');
      }

      // Check for missing important data
      if (!data.profileImageUrl) {
        warnings.push('Profile image URL is missing');
      }

      if (!data.bio || data.bio.length < 10) {
        warnings.push('Bio is missing or too short');
      }

      // Ensure at least one platform identifier exists
      const hasPlatformId = Object.values(data.platformIdentifiers).some(id => id);
      if (!hasPlatformId) {
        errors.push('No platform identifiers found');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Output validation error: ${error.message}`],
        warnings: [],
      };
    }
  }

  /**
   * Create a failure result
   */
  private createFailureResult(
    platform: string,
    errors: PipelineError[],
    warnings: string[],
    steps: PipelineResult['metadata']['steps']
  ): PipelineResult {
    return {
      success: false,
      errors,
      warnings,
      metadata: {
        platform,
        processingTime: 0, // Will be set by caller
        steps,
      },
    };
  }
}

/**
 * Factory function to create a pipeline with custom options
 */
export function createPipeline(options?: PipelineOptions): DataTransformationPipeline {
  return new DataTransformationPipeline(options);
}

/**
 * Process a single profile with default pipeline
 */
export async function processCreatorProfile(
  platform: string,
  data: any,
  options?: PipelineOptions
): Promise<PipelineResult> {
  const pipeline = createPipeline(options);
  return pipeline.process(platform, data);
}

/**
 * Process multiple profiles with default pipeline
 */
export async function processCreatorProfiles(
  platform: string,
  dataArray: any[],
  options?: PipelineOptions
): Promise<PipelineResult[]> {
  const pipeline = createPipeline(options);
  return pipeline.processBatch(platform, dataArray);
}