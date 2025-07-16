import { z } from 'zod';
import { TrackedOpenAIClient } from './ai/tracked-openai';
import { OPENAI_MODEL, OPENAI_TEMPERATURE, OPENAI_MIN_CONFIDENCE } from '@/lib/config';
import { PrismaClient } from '@prisma/client';

// 添加重试配置
const RETRY_ATTEMPTS = 3;
const TIMEOUT_MS = 60000; // 增加到 60 秒
const RETRY_DELAY_MS = 1000; // 重试间隔时间

// Re-export schemas from original llm.ts
export { EmailSchema } from './llm';
export type { EmailStructure } from './llm';

// Schema for LLM analysis output
const jobAnalysisSchema = z.object({
  skills: z.array(z.object({
    name: z.string(),
    category: z.enum(['language', 'framework', 'tool', 'concept', 'other']),
    confidence: z.number().min(0).max(1),
    explanation: z.string().optional(),
  })),
  context: z.object({
    seniority: z.string().optional(),
    yearsOfExperience: z.number().optional().nullable(),
    roleType: z.string().optional(),
    industry: z.string().optional(),
    notes: z.string().optional(),
  }),
});

type JobAnalysisResult = z.infer<typeof jobAnalysisSchema>;

// Create a singleton instance of tracked client
let trackedClient: TrackedOpenAIClient | null = null;

function getTrackedClient(prisma?: PrismaClient): TrackedOpenAIClient {
  if (!trackedClient) {
    trackedClient = new TrackedOpenAIClient(prisma);
  }
  return trackedClient;
}

/**
 * Call OpenAI SDK to analyze job descriptions with usage tracking
 */
export async function parseJobAnalyaisTracked(
  description: string,
  apiKey: string,
  model = 'gpt-4o-mini',
  options?: { userId?: string; prisma?: PrismaClient }
): Promise<JobAnalysisResult> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required for LLM analysis');
  }

  const client = getTrackedClient(options?.prisma);

  try {
    // Call OpenAI API with tracking
    const response = await client.createChatCompletion({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a technical recruiter analyzing job descriptions. Extract technical skills, tools, concepts, and context from job descriptions. Format your response as a JSON object with this structure:
{
  "skills": [
    {
      "name": "skill name",
      "category": "language|framework|tool|concept|other",
      "confidence": 0.0-1.0,
      "explanation": "optional explanation"
    }
  ],
  "context": {
    "seniority": "optional seniority level",
    "yearsOfExperience": optional number or null if not specified,
    "roleType": "optional role type",
    "industry": "optional industry",
    "notes": "optional additional notes"
  }
}`
        },
        {
          role: 'user',
          content: `Analyze this job description and extract all relevant information:

${description}`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    }, {
      userId: options?.userId,
      metadata: {
        operation: 'job_analysis',
        descriptionLength: description.length
      }
    });

    // Get response content
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // Parse the JSON response
    const result = JSON.parse(content);
    
    // Validate the response against our schema
    const parsed = jobAnalysisSchema.safeParse(result);
    if (!parsed.success) {
      console.error('Invalid LLM response format:', parsed.error);
      throw new Error('Invalid LLM response format');
    }
    
    return parsed.data;
  } catch (error) {
    console.error('Failed to parse LLM response:', error);
    throw new Error('Invalid LLM response format');
  }
}

/**
 * Generate a response using LLM with tracking
 */
export async function generateLLMResponseTracked(
  prompt: string, 
  model: string = 'gpt-4o-mini',
  options?: { userId?: string; prisma?: PrismaClient }
): Promise<string> {
  const client = getTrackedClient(options?.prisma);

  try {
    // Call OpenAI API with tracking
    const response = await client.createChatCompletion({
      model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.9,
    }, {
      userId: options?.userId,
      metadata: {
        operation: 'general_generation',
        promptLength: prompt.length
      }
    });

    // Get response content
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    return content;
  } catch (error) {
    console.error('Failed to generate LLM response:', error);
    throw error;
  }
}

/**
 * Generic function to get structured output from OpenAI with tracking
 */
export async function getStructuredOutputTracked<T extends z.ZodType>(
  schema: T,
  prompt: string,
  systemPrompt?: string,
  model: string = 'gpt-4o-mini',
  options?: { userId?: string; prisma?: PrismaClient }
): Promise<z.infer<T>> {
  const client = getTrackedClient(options?.prisma);

  try {
    const messages = [
      ...(systemPrompt ? [{
        role: 'system' as const,
        content: systemPrompt
      }] : []),
      {
        role: 'user' as const,
        content: prompt
      }
    ];

    const response = await client.createChatCompletion({
      model,
      messages,
      temperature: 0.7,
      response_format: { type: "json_object" }
    }, {
      userId: options?.userId,
      metadata: {
        operation: 'structured_output',
        schemaName: schema.description || 'unknown',
        promptLength: prompt.length
      }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // Parse the JSON response
    const result = JSON.parse(content);
    
    // Validate the response against the provided schema
    const parsed = schema.safeParse(result);
    if (!parsed.success) {
      console.error('Invalid LLM response format:', parsed.error);
      throw new Error('Invalid LLM response format');
    }
    
    return parsed.data;
  } catch (error) {
    console.error('Failed to get structured output:', error);
    throw error;
  }
}

/**
 * Generate a cold reach email with structured output and tracking
 */
export async function generateStructuredEmailTracked(
  prompt: string,
  model: string = 'gpt-4o',
  options?: { userId?: string; prisma?: PrismaClient }
): Promise<z.infer<typeof EmailSchema>> {
  const { EmailSchema } = await import('./llm');
  
  const systemPrompt = `You are an expert at writing professional emails. 
Generate an email with a subject line and body content.
Your response must be a JSON object with 'subject' and 'body' fields.
Keep the subject line concise and attention-grabbing.
The body should be professional, engaging, and well-structured.`;

  return getStructuredOutputTracked(EmailSchema, prompt, systemPrompt, model, options);
}

// Re-export utility functions that don't need tracking
export { processJobLLMResults } from './llm';

// Export tracking utilities for direct access
export async function getAPIUsageStats(
  startDate: Date, 
  endDate: Date, 
  prisma?: PrismaClient
) {
  const client = getTrackedClient(prisma);
  return client.getUsageStats(startDate, endDate);
}

export async function getAPIRateLimitStatus(model?: string, prisma?: PrismaClient) {
  const client = getTrackedClient(prisma);
  return client.getRateLimitStatus(model);
}

export async function getAPIActiveAlerts(prisma?: PrismaClient) {
  const client = getTrackedClient(prisma);
  return client.getActiveAlerts();
}