import { JobDescription } from '../../lib/types/job-description';
import { analyzeJobDescription as analyze } from '../../lib/jd-analyzer/index';
import { OPENAI_API_KEY, OPENAI_MODEL, OPENAI_TEMPERATURE, OPENAI_MIN_CONFIDENCE } from '@/lib/config';

/**
 * Analyzes a job description to extract skills and requirements
 * @param description The raw job description text
 * @returns Processed job description with extracted tags
 */
export async function analyzeJobDescription(description: string, useLLM = false): Promise<Partial<JobDescription>> {
  // Get LLM config from environment if enabled
  const config = useLLM ? {
    useLLM: true,
    llmApiKey: OPENAI_API_KEY,
    model: OPENAI_MODEL,
    temperature: OPENAI_TEMPERATURE,
    minConfidence: OPENAI_MIN_CONFIDENCE
  } : { useLLM: false };

  const analysis = await analyze(description, config);
  
  // Combine all technical terms into tags
  const tags = [
    ...analysis.languages,
    ...analysis.frameworks,
    ...analysis.otherKeywords
  ];
  
  if (analysis.seniority) {
    tags.push(analysis.seniority);
  }
  
  return {
    rawDescription: description,
    tags: tags.join(','),
    languages: analysis.languages,
    frameworks: analysis.frameworks,
    otherKeywords: analysis.otherKeywords,
    seniority: analysis.seniority,
    yearsOfExperience: analysis.yearsOfExperience,
    parsingMethod: useLLM ? 'llm' : 'traditional',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}
