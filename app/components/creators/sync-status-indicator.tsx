'use client'

import { useEffect, useState } from 'react'
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Check, AlertCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface SyncStatusIndicatorProps {
  creatorId: string
  lastSync?: Date | null
}

export default function SyncStatusIndicator({ 
  creatorId, 
  lastSync 
}: SyncStatusIndicatorProps) {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [lastSyncTime, setLastSyncTime] = useState(lastSync)

  // Simulate real-time sync status updates
  useEffect(() => {
    // In a real app, this would connect to a WebSocket or polling endpoint
    const checkSyncStatus = () => {
      // Mock implementation
      if (syncStatus === 'syncing') {
        setTimeout(() => {
          setSyncStatus('success')
          setLastSyncTime(new Date())
          setTimeout(() => setSyncStatus('idle'), 3000)
        }, 2000)
      }
    }

    checkSyncStatus()
  }, [syncStatus])

  const getStatusContent = () => {
    switch (syncStatus) {
      case 'syncing':
        return {
          icon: <RefreshCw className="h-3 w-3 animate-spin" />,
          text: 'Syncing...',
          variant: 'default' as const
        }
      case 'success':
        return {
          icon: <Check className="h-3 w-3" />,
          text: 'Synced',
          variant: 'success' as const
        }
      case 'error':
        return {
          icon: <AlertCircle className="h-3 w-3" />,
          text: 'Sync failed',
          variant: 'destructive' as const
        }
      default:
        if (lastSyncTime) {
          const timeSinceSync = formatDistanceToNow(lastSyncTime, { addSuffix: true })
          return {
            icon: null,
            text: `Last synced ${timeSinceSync}`,
            variant: 'secondary' as const
          }
        }
        return {
          icon: null,
          text: 'Never synced',
          variant: 'outline' as const
        }
    }
  }

  const { icon, text, variant } = getStatusContent()

  return (
    <Badge variant={variant} className="flex items-center gap-1.5">
      {icon}
      <span>{text}</span>
    </Badge>
  )
}