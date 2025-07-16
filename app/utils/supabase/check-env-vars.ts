// This check can be removed
// it is just for tutorial purposes

export const checkSupabaseEnvVars = () => {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
};
