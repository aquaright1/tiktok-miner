import { createClient } from '@/utils/supabase/server'
import { prisma } from './db'

export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Check if user is logged in
export async function checkAuth() {
  try {
    const supabase = createClient()
    
    // Get the current user
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('Auth error:', error)
      throw new Error('Unauthorized')
    }
    
    if (!user) {
      throw new Error('Unauthorized')
    }
    
    return user
  } catch (error) {
    console.error('Auth check error:', error)
    throw new Error('Unauthorized')
  }
}