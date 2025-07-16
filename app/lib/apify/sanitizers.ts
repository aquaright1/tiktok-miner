/**
 * Data sanitization utilities for cleaning and normalizing creator data
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitization options
 */
export interface SanitizationOptions {
  stripHtml?: boolean;
  normalizeUrls?: boolean;
  removeEmojis?: boolean;
  trimWhitespace?: boolean;
  removeSensitiveData?: boolean;
  maxLength?: number;
}

/**
 * Default sanitization options
 */
const DEFAULT_OPTIONS: SanitizationOptions = {
  stripHtml: true,
  normalizeUrls: true,
  removeEmojis: false,
  trimWhitespace: true,
  removeSensitiveData: true,
  maxLength: 5000,
};

/**
 * HTML sanitization - removes potentially dangerous HTML while preserving safe content
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return '';
  
  // Use DOMPurify to sanitize HTML
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br', 'p'],
    ALLOWED_ATTR: ['href', 'target'],
  });
  
  return clean;
}

/**
 * Strip all HTML tags and return plain text
 */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return '';
  
  // Remove all HTML tags
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize URLs - ensure they have proper protocol and format
 */
export function normalizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  let normalized = url.trim();
  
  // Remove tracking parameters
  try {
    const urlObj = new URL(normalized);
    // Remove common tracking parameters
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 
     'fbclid', 'gclid', 'ref', 'source'].forEach(param => {
      urlObj.searchParams.delete(param);
    });
    normalized = urlObj.toString();
  } catch {
    // If not a valid URL, try to fix common issues
    if (!normalized.match(/^https?:\/\//)) {
      normalized = `https://${normalized}`;
    }
  }
  
  return normalized;
}

/**
 * Handle emoji removal or normalization
 */
export function handleEmojis(input: string | null | undefined, remove: boolean = false): string {
  if (!input) return '';
  
  if (remove) {
    // Remove all emojis
    return input.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
  }
  
  // Otherwise, just return the input with emojis intact
  return input;
}

/**
 * Format and validate phone numbers (basic implementation)
 */
export function sanitizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters except + at the beginning
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Ensure + is only at the beginning
  if (cleaned.includes('+') && !cleaned.startsWith('+')) {
    cleaned = cleaned.replace(/\+/g, '');
  }
  
  return cleaned;
}

/**
 * Remove potentially sensitive data (emails, phone numbers, etc.)
 */
export function removeSensitiveData(input: string | null | undefined): string {
  if (!input) return '';
  
  let cleaned = input;
  
  // Remove email addresses
  cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]');
  
  // Remove credit card numbers first (more specific pattern)
  cleaned = cleaned.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[card]');
  
  // Remove SSN-like patterns (specific pattern)
  cleaned = cleaned.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[ssn]');
  
  // Remove phone numbers last (more general pattern)
  cleaned = cleaned.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, '[phone]');
  
  return cleaned;
}

/**
 * Sanitize username - remove special characters that might cause issues
 */
export function sanitizeUsername(username: string | null | undefined): string {
  if (!username) return '';
  
  // Remove @ symbol if it's at the beginning (common in social media)
  let cleaned = username.trim();
  if (cleaned.startsWith('@')) {
    cleaned = cleaned.substring(1);
  }
  
  // Replace spaces with underscores
  cleaned = cleaned.replace(/\s+/g, '_');
  
  // Remove special characters except underscores, dots, and hyphens
  cleaned = cleaned.replace(/[^a-zA-Z0-9._-]/g, '');
  
  return cleaned;
}

/**
 * Trim and normalize whitespace
 */
export function normalizeWhitespace(input: string | null | undefined): string {
  if (!input) return '';
  
  return input
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\t/g, ' ')    // Replace tabs with spaces
    .replace(/ +/g, ' ')    // Replace multiple spaces with single space
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .trim();
}

/**
 * Truncate text to maximum length
 */
export function truncateText(input: string | null | undefined, maxLength: number): string {
  if (!input) return '';
  
  if (input.length <= maxLength) return input;
  
  // Try to truncate at a word boundary
  const truncated = input.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  // If we have a reasonable word boundary (not too far back), use it
  if (lastSpace > 0 && lastSpace > maxLength * 0.5) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Deduplicate array of strings (case-insensitive)
 */
export function deduplicateStrings(items: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  
  for (const item of items) {
    if (!item) continue;
    
    const normalized = item.toLowerCase().trim();
    if (!seen.has(normalized) && normalized) {
      seen.add(normalized);
      result.push(item.trim());
    }
  }
  
  return result;
}

/**
 * Sanitize an entire object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  options: SanitizationOptions = DEFAULT_OPTIONS
): T {
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      sanitized[key] = value;
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value, options);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'object' ? sanitizeObject(item, options) : 
        typeof item === 'string' ? sanitizeString(item, options) : 
        item
      );
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, options);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Main string sanitization function
 */
export function sanitizeString(
  input: string | null | undefined,
  options: SanitizationOptions = DEFAULT_OPTIONS
): string {
  if (!input) return '';
  
  let result = input;
  
  // Apply sanitization steps based on options
  if (options.stripHtml) {
    result = stripHtml(result);
  }
  
  if (options.removeSensitiveData) {
    result = removeSensitiveData(result);
  }
  
  if (options.removeEmojis) {
    result = handleEmojis(result, true);
  }
  
  if (options.trimWhitespace) {
    result = normalizeWhitespace(result);
  }
  
  if (options.maxLength) {
    result = truncateText(result, options.maxLength);
  }
  
  return result;
}

/**
 * Sanitize creator bio specifically
 */
export function sanitizeBio(bio: string | null | undefined): string {
  return sanitizeString(bio, {
    stripHtml: true,
    removeSensitiveData: true,
    removeEmojis: false, // Keep emojis in bios
    trimWhitespace: true,
    maxLength: 1000,
  });
}

/**
 * Sanitize tags array
 */
export function sanitizeTags(tags: (string | null | undefined)[]): string[] {
  const sanitized = tags
    .filter(tag => tag && typeof tag === 'string')
    .map(tag => tag!.toLowerCase().trim())
    .map(tag => tag.replace(/[^a-z0-9-]/g, ''))
    .filter(tag => tag.length > 0 && tag.length < 50);
  
  return deduplicateStrings(sanitized);
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  
  const trimmed = email.trim().toLowerCase();
  
  // Basic email validation regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (emailRegex.test(trimmed)) {
    return trimmed;
  }
  
  return '';
}