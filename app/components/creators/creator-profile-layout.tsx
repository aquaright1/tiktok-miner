'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { RefreshCw, ExternalLink, TrendingUp, Video, BarChart3, Settings } from 'lucide-react'
import CreatorProfileHeader from './creator-profile-header'
import CreatorOverviewTab from './tabs/creator-overview-tab'
import CreatorAnalyticsTab from './tabs/creator-analytics-tab'
import CreatorVideosTab from './tabs/creator-videos-tab'
import { syncCreator } from '@/app/actions/creators'
import { toast } from 'sonner'

interface CreatorProfileLayoutProps {
  creator: any
  scoreBreakdown: any
  metricsHistory: any
  activeTab: string
}

export default function CreatorProfileLayout({
  creator,
  scoreBreakdown,
  metricsHistory,
  activeTab
}: CreatorProfileLayoutProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    router.push(`/creators/${creator.id}?${params.toString()}`)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await syncCreator(creator.id)
      toast.success('Creator data refresh initiated')
      // In a real app, we'd trigger a data refetch here
    } catch (error) {
      toast.error('Failed to refresh creator data')
    } finally {
      setIsRefreshing(false)
    }
  }

  const openPlatformProfile = () => {
    window.open(creator.profileUrl, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <CreatorProfileHeader 
        creator={creator}
        scoreBreakdown={scoreBreakdown}
      />

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
          <Button
            onClick={openPlatformProfile}
            variant="outline"
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            View on {creator.platform}
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          Last synced: {new Date(creator.lastSync).toLocaleString()}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full md:w-auto md:inline-flex">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="videos" className="gap-2">
            <Video className="h-4 w-4" />
            Videos
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <CreatorOverviewTab 
            creator={creator}
            scoreBreakdown={scoreBreakdown}
            metricsHistory={metricsHistory}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <CreatorAnalyticsTab 
            creator={creator}
            metricsHistory={metricsHistory}
          />
        </TabsContent>

        <TabsContent value="videos" className="space-y-6">
          <CreatorVideosTab 
            creator={creator}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="text-center py-12 text-muted-foreground">
            Settings tab coming soon...
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}