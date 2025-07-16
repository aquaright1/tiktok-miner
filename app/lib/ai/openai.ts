import OpenAI from 'openai';
import {
  OPENAI_API_KEY,
  OPENAI_MODEL,
  OPENAI_TEMPERATURE,
  OPENAI_MIN_CONFIDENCE,
} from '../config';

export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export const openaiConfig = {
  model: OPENAI_MODEL,
  temperature: OPENAI_TEMPERATURE,
  minConfidence: OPENAI_MIN_CONFIDENCE,
}; 