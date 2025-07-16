import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nfdqhheortctkyqqmjfe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mZHFoaGVvcnRjdGt5cXFtamZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMDI0NzQsImV4cCI6MjA2NzU3ODQ3NH0.rPxfe1-IvGWRP0XieHiKC8P2pUFIj7ohPABGo8gTSmU';

export const createSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
};

// 导出一个默认的客户端实例
export const supabase = createSupabaseClient();

// 导出一个用于客户端组件的客户端实例
export const createClientComponentClient = () => {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
};