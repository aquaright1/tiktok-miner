import { config } from '../config';

export const SUPABASE_URL = config.supabase.url;
export const SUPABASE_ANON_KEY = config.supabase.anonKey;

// Validate that required environment variables are set
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing required Supabase environment variables. ' +
    'Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}