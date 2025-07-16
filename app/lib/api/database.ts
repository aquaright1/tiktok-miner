import { createClient } from '@supabase/supabase-js'
import { prisma } from '../prisma'
import { config } from '../config'

// Singleton Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      config.supabase.url,
      config.supabase.anonKey
    )
  }
  return supabaseClient
}

// Type-safe database clients
export interface DatabaseClients {
  supabase: ReturnType<typeof createClient>
  prisma: typeof prisma
}

export function getDatabaseClients(): DatabaseClients {
  return {
    supabase: getSupabaseClient(),
    prisma
  }
}