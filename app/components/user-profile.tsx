'use client'

import { createClientComponentClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { ChevronDownIcon, UserIcon, LogOutIcon, SettingsIcon } from 'lucide-react'

interface UserProfileProps {
  user: any
}

export function UserProfile({ user }: UserProfileProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClientComponentClient()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setIsOpen(false)
    router.push('/')
    router.refresh()
  }

  // Get user display name (try full_name, then name, then email)
  const displayName = user?.user_metadata?.full_name || 
                     user?.user_metadata?.name || 
                     user?.email?.split('@')[0] || 
                     'User'

  const userEmail = user?.email || ''
  const userAvatar = user?.user_metadata?.avatar_url

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <div className="flex items-center space-x-2">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt="Profile"
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <UserIcon className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
          <span className="hidden md:block">{displayName}</span>
        </div>
        <ChevronDownIcon 
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-background border border-border rounded-md shadow-lg z-50">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
          
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false)
                router.push('/profile')
              }}
              className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <UserIcon className="mr-2 h-4 w-4" />
              Profile
            </button>
            
            <button
              onClick={() => {
                setIsOpen(false)
                router.push('/settings')
              }}
              className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <SettingsIcon className="mr-2 h-4 w-4" />
              Settings
            </button>
            
            <div className="border-t border-border my-1"></div>
            
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <LogOutIcon className="mr-2 h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 