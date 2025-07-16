import crypto from 'crypto';

/**
 * Validates Apify webhook signatures to ensure the request is authentic
 * 
 * Apify uses HMAC-SHA256 signatures to sign webhook payloads
 * The signature is sent in the 'apify-webhook-signature' header
 * 
 * @param payload - The raw request body as a string
 * @param signature - The signature from the webhook header
 * @param secret - The webhook secret (optional, uses env var if not provided)
 * @returns true if the signature is valid, false otherwise
 */
export function validateWebhookSignature(
  payload: string,
  signature: string | null,
  secret?: string
): boolean {
  try {
    // Get the webhook secret from environment or parameter
    const webhookSecret = secret || process.env.APIFY_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.warn('APIFY_WEBHOOK_SECRET not configured, skipping signature validation');
      // In production, you should always validate signatures
      // Return true only in development when secret is not set
      return process.env.NODE_ENV === 'development';
    }
    
    if (!signature) {
      console.error('No webhook signature provided in request');
      return false;
    }
    
    // Calculate the expected signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');
    
    // Compare signatures using timing-safe comparison
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    // Check if buffers are the same length first
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    
  } catch (error) {
    console.error('Error validating webhook signature:', error);
    return false;
  }
}

/**
 * Generates a webhook signature for testing purposes
 * This is useful for testing webhook handlers locally
 * 
 * @param payload - The webhook payload as a string or object
 * @param secret - The webhook secret
 * @returns The generated signature
 */
export function generateWebhookSignature(
  payload: string | object,
  secret: string
): string {
  const payloadString = typeof payload === 'string' 
    ? payload 
    : JSON.stringify(payload);
  
  return crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');
}

/**
 * Webhook validation middleware for use in other contexts
 * Returns a validation result with details about the validation process
 */
export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
  details?: {
    hasSignature: boolean;
    hasSecret: boolean;
    signatureFormat: 'valid' | 'invalid';
  };
}

export function validateWebhookRequest(
  payload: string,
  headers: Record<string, string | string[] | undefined>
): WebhookValidationResult {
  const signature = headers['apify-webhook-signature'] as string | undefined;
  const webhookSecret = process.env.APIFY_WEBHOOK_SECRET;
  
  const result: WebhookValidationResult = {
    isValid: false,
    details: {
      hasSignature: !!signature,
      hasSecret: !!webhookSecret,
      signatureFormat: 'invalid'
    }
  };
  
  if (!webhookSecret) {
    result.error = 'Webhook secret not configured';
    if (process.env.NODE_ENV === 'development') {
      // Allow in development without secret
      result.isValid = true;
      result.error = 'Webhook secret not configured (allowed in development)';
    }
    return result;
  }
  
  if (!signature) {
    result.error = 'No webhook signature provided';
    return result;
  }
  
  // Check if signature is valid hex format
  if (!/^[a-f0-9]+$/i.test(signature)) {
    result.error = 'Invalid signature format';
    return result;
  }
  
  result.details.signatureFormat = 'valid';
  
  // Validate the signature
  const isValid = validateWebhookSignature(payload, signature, webhookSecret);
  result.isValid = isValid;
  
  if (!isValid) {
    result.error = 'Signature verification failed';
  }
  
  return result;
}

/**
 * Extract webhook metadata from Apify webhook headers
 */
export interface ApifyWebhookHeaders {
  webhookId?: string;
  eventType?: string;
  signature?: string;
  timestamp?: string;
  actorId?: string;
  actorRunId?: string;
}

export function extractApifyWebhookHeaders(
  headers: Record<string, string | string[] | undefined>
): ApifyWebhookHeaders {
  return {
    webhookId: headers['apify-webhook-id'] as string | undefined,
    eventType: headers['apify-webhook-event-type'] as string | undefined,
    signature: headers['apify-webhook-signature'] as string | undefined,
    timestamp: headers['apify-webhook-timestamp'] as string | undefined,
    actorId: headers['apify-actor-id'] as string | undefined,
    actorRunId: headers['apify-actor-run-id'] as string | undefined,
  };
}