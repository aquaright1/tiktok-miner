'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserPlus, RefreshCw, ExternalLink, Check } from "lucide-react"
import { syncCreator, addCreatorToPipeline } from "@/app/actions/creators"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface CreatorActionsProps {
  creatorId: string
  isPipelined: boolean
  platforms: string[]
}

export default function CreatorActions({ 
  creatorId, 
  isPipelined,
  platforms 
}: CreatorActionsProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isAddingToPipeline, setIsAddingToPipeline] = useState(false)
  const [pipelined, setPipelined] = useState(isPipelined)
  const router = useRouter()

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await syncCreator(creatorId)
      toast.success("Creator sync initiated successfully")
      router.refresh()
    } catch (error) {
      toast.error("Failed to sync creator")
      console.error("Sync error:", error)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleAddToPipeline = async () => {
    setIsAddingToPipeline(true)
    try {
      // In a real app, you would select a pipeline first
      await addCreatorToPipeline(creatorId, "default-pipeline-id")
      setPipelined(true)
      toast.success("Creator added to pipeline")
      router.refresh()
    } catch (error) {
      toast.error("Failed to add creator to pipeline")
      console.error("Pipeline error:", error)
    } finally {
      setIsAddingToPipeline(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={handleAddToPipeline}
          disabled={pipelined || isAddingToPipeline}
          className="w-full"
          variant={pipelined ? "secondary" : "default"}
        >
          {pipelined ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              In Pipeline
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              Add to Pipeline
            </>
          )}
        </Button>

        <Button
          onClick={handleSync}
          disabled={isSyncing}
          variant="outline"
          className="w-full"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>

        <div className="pt-3 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">View on Platform</p>
          {platforms.map((platform) => (
            <Button
              key={platform}
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              asChild
            >
              <a
                href={getCreatorUrl(platform, creatorId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View on {platform}
              </a>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function getCreatorUrl(platform: string, username: string): string {
  // This would be replaced with actual platform URLs
  const platformUrls: Record<string, string> = {
    instagram: `https://instagram.com/${username}`,
    tiktok: `https://tiktok.com/@${username}`,
    twitter: `https://twitter.com/${username}`,
    youtube: `https://youtube.com/@${username}`,
  }
  
  return platformUrls[platform.toLowerCase()] || '#'
}