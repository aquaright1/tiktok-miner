'use client'

import { createSupabaseClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ModeToggle } from "@/components/mode-toggle"
import { Nav } from "@/components/nav"

export function Header() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createSupabaseClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setIsLoading(false)
    }

    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Nav />
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Search box can be placed here */}
          </div>
          <nav className="flex items-center space-x-2">
            <ModeToggle />
            {isLoading ? (
              <div className="ml-4 px-4 py-2 text-sm font-medium">
                Loading...
              </div>
            ) : user ? (
              <div className="flex items-center space-x-2">
                <span className="text-sm">Welcome, {user.email?.split('@')[0] || 'User'}</span>
                <button
                  onClick={handleSignOut}
                  className="ml-2 px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => router.push('/auth/login')}
                className="ml-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Sign In
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
