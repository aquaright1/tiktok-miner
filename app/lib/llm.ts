import { z } from 'zod';
import OpenAI from 'openai';
import { OPENAI_API_KEY, OPENAI_MODEL, OPENAI_TEMPERATURE, OPENAI_MIN_CONFIDENCE } from '@/lib/config';

// 添加重试配置
const RETRY_ATTEMPTS = 3;
const TIMEOUT_MS = 60000; // 增加到 60 秒
const RETRY_DELAY_MS = 1000; // 重试间隔时间


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

// Schema for email structure
export const EmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type EmailStructure = z.infer<typeof EmailSchema>;

/**
 * Call OpenAI SDK to analyze job descriptions
 */
export async function parseJobAnalyais(
  description: string,
  apiKey: string,
  model = 'gpt-4o-mini'
): Promise<JobAnalysisResult> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required for LLM analysis');
  }

  // Initialize OpenAI client
  const openai = new OpenAI({ apiKey });

  try {
    // Call OpenAI API
    const response = await openai.chat.completions.create({
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
 * Process LLM analysis results into categorized terms
 */
/**
 * Generate a response using LLM
 */
export async function generateLLMResponse(prompt: string, model: string = 'gpt-4o-mini'): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found in environment');
  }

  // Initialize OpenAI client
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.9,
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


export function processJobLLMResults(analysis: JobAnalysisResult): {
  languages: string[];
  frameworks: string[];
  otherKeywords: string[];
  seniority?: string;
  yearsOfExperience?: number | null;
} {
  const languages: string[] = [];
  const frameworks: string[] = [];
  const otherKeywords: string[] = [];

  // Categorize skills based on confidence threshold
  const confidenceThreshold = 0.5;
  
  for (const skill of analysis.skills) {
    if (skill.confidence < confidenceThreshold) continue;

    const term = skill.name.toLowerCase();
    
    switch (skill.category) {
      case 'language':
        languages.push(term);
        break;
      case 'framework':
        frameworks.push(term);
        break;
      default:
        otherKeywords.push(term);
        break;
    }
  }

  return {
    languages,
    frameworks,
    otherKeywords,
    seniority: analysis.context.seniority,
    yearsOfExperience: analysis.context.yearsOfExperience,
  };
}

/**
 * Generic function to get structured output from OpenAI
 * @param schema Zod schema to validate the response
 * @param prompt The prompt to send to OpenAI
 * @param systemPrompt Optional system prompt to guide the response format
 * @param model The model to use, defaults to gpt-4o-mini
 * @returns Typed data based on the provided schema
 */
export async function getStructuredOutput<T extends z.ZodType>(
  schema: T,
  prompt: string,
  systemPrompt?: string,
  model: string = 'gpt-4o-mini'
): Promise<z.infer<T>> {
  const apiKey = OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is required for LLM analysis');
  }

  const openai = new OpenAI({ 
    apiKey,
    timeout: TIMEOUT_MS,
    maxRetries: RETRY_ATTEMPTS,
  });

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

    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      response_format: { type: "json_object" }
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
 * Generate a cold reach email with structured output
 */
export async function generateStructuredEmail(
  prompt: string,
  model: string = 'gpt-4o'
): Promise<EmailStructure> {
  const systemPrompt = `You are an expert at writing professional emails. 
Generate an email with a subject line and body content.
Your response must be a JSON object with 'subject' and 'body' fields.
Keep the subject line concise and attention-grabbing.
The body should be professional, engaging, and well-structured.`;

  return getStructuredOutput(EmailSchema, prompt, systemPrompt, model);
}

export interface LLMConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  minConfidence?: number;
}

export interface LLMResponse {
  text: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface LLMService {
  generate(prompt: string, config?: Partial<LLMConfig>): Promise<LLMResponse>;
  analyze(text: string, config?: Partial<LLMConfig>): Promise<LLMResponse>;
}

export function createLLMClient(config: Partial<LLMConfig> = {}): LLMService {
  const finalConfig: LLMConfig = {
    apiKey: config.apiKey || OPENAI_API_KEY,
    model: config.model || OPENAI_MODEL,
    temperature: config.temperature || OPENAI_TEMPERATURE,
    minConfidence: config.minConfidence || OPENAI_MIN_CONFIDENCE
  };

  return {
    async generate(prompt: string, config?: Partial<LLMConfig>): Promise<LLMResponse> {
      // Implementation
      throw new Error('Not implemented');
    },
    async analyze(text: string, config?: Partial<LLMConfig>): Promise<LLMResponse> {
      // Implementation
      throw new Error('Not implemented');
    }
  };
}

export function createLLMService(config: Partial<LLMConfig> = {}): LLMService {
  return createLLMClient(config);
}
