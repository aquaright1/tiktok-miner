"use server"

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { checkAuth } from '@/lib/auth'
import { APP_URL } from '@/lib/config'

export async function signInAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    console.log('data===', data)
    if (error) {
      return { success: false, error: error.message }
    }

    // TODO: Re-enable when database tables are set up
    // Create or update user record
    // await prisma.user.upsert({
    //   where: { id: data.user.id },
    //   create: {
    //     id: data.user.id,
    //     email: data.user.email!
    //   },
    //   update: {
    //     email: data.user.email!
    //   }
    // })

    return { success: true }
  } catch (error) {
    console.error('Login error:', error)
    return { success: false, error: 'Login failed' }
  }
}

export async function signUpAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${APP_URL}/auth/callback`
      }
    })

    if (error) {
      return { success: false, error: error.message }
    }

    // TODO: Re-enable when database tables are set up
    // if (data.user) {
    //   // Create or update user record
    //   await prisma.user.upsert({
    //     where: { email: data.user.email! },
    //     create: {
    //       id: data.user.id,
    //       email: data.user.email!
    //     },
    //     update: {
    //       id: data.user.id
    //     }
    //   })
    // }

    return { success: true }
  } catch (error) {
    console.error('Signup error:', error)
    return { success: false, error: 'Registration failed' }
  }
}

export async function forgotPasswordAction(formData: FormData) {
  const email = formData.get('email') as string

  const supabase = createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}/auth/callback?redirect_to=/protected/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true, message: 'Password reset link has been sent to your email' }
}

export async function signOutAction() {
  const supabase = createClient()
  await supabase.auth.signOut()
  return { success: true }
}



export async function resetPasswordAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  
  // TODO: Implement password reset logic
}

export async function getGithubRepos() {
  'use server'
  await checkAuth()
  
  const supabase = createClient()

  const { data: repos, error } = await supabase
    .from('github_repositories')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return repos
}