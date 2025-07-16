"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Eye, Heart, MessageCircle, Video } from 'lucide-react'

interface RecentMetrics {
  creatorId: string
  creatorName?: string
  platform: string
  totalPosts: number
  totalLikes: number
  totalViews: number
  totalComments: number
  avgLikes: number
  avgViews: number
  avgComments: number
  avgEngagementRate: number
  estimated?: boolean
}

interface RecentMetricsResponse {
  success: boolean
  platform: string
  days: number
  metrics: RecentMetrics | RecentMetrics[]
  isEstimated: boolean
  message?: string
}

export function RecentMetricsComponent() {
  const [platform, setPlatform] = useState<'instagram' | 'tiktok'>('tiktok')
  const [days, setDays] = useState<number>(30)
  const [metrics, setMetrics] = useState<RecentMetrics[]>([])
  const [loading, setLoading] = useState(false)
  const [isEstimated, setIsEstimated] = useState(false)

  const fetchMetrics = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/creators/recent-metrics?platform=${platform}&days=${days}`)
      const data: RecentMetricsResponse = await response.json()
      
      if (data.success) {
        // Handle both single creator and multiple creators response
        const metricsArray = Array.isArray(data.metrics) ? data.metrics : [data.metrics]
        setMetrics(metricsArray)
        setIsEstimated(data.isEstimated)
      } else {
        console.error('Failed to fetch metrics:', data.error)
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [platform, days])

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getEngagementColor = (rate: number) => {
    if (rate >= 5) return 'text-green-600'
    if (rate >= 2) return 'text-yellow-600'
    return 'text-red-600'
  }

  const totalMetrics = metrics.reduce((acc, m) => ({
    totalPosts: acc.totalPosts + m.totalPosts,
    totalLikes: acc.totalLikes + m.totalLikes,
    totalViews: acc.totalViews + m.totalViews,
    totalComments: acc.totalComments + m.totalComments,
  }), { totalPosts: 0, totalLikes: 0, totalViews: 0, totalComments: 0 })

  const avgEngagementRate = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + m.avgEngagementRate, 0) / metrics.length 
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Recent Post Metrics</h2>
          <p className="text-muted-foreground">
            Analytics for posts from the last {days} days • View Engineers Dashboard
            {isEstimated && (
              <Badge variant="outline" className="ml-2">Estimated</Badge>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={platform} onValueChange={(value: 'instagram' | 'tiktok') => setPlatform(value)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={days.toString()} onValueChange={(value) => setDays(parseInt(value))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={fetchMetrics} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalMetrics.totalPosts)}</div>
            <p className="text-xs text-muted-foreground">
              Across {metrics.length} creators
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalMetrics.totalViews)}</div>
            <p className="text-xs text-muted-foreground">
              {totalMetrics.totalPosts > 0 
                ? `${formatNumber(Math.round(totalMetrics.totalViews / totalMetrics.totalPosts))} avg/post`
                : 'No posts'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Likes</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalMetrics.totalLikes)}</div>
            <p className="text-xs text-muted-foreground">
              {totalMetrics.totalPosts > 0 
                ? `${formatNumber(Math.round(totalMetrics.totalLikes / totalMetrics.totalPosts))} avg/post`
                : 'No posts'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getEngagementColor(avgEngagementRate)}`}>
              {avgEngagementRate.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Average across all creators
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Individual Creator Metrics */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Creator Breakdown</h3>
        <div className="grid gap-4">
          {metrics.slice(0, 10).map((creator, index) => (
            <Card key={creator.creatorId || index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {creator.creatorName || `Creator ${creator.creatorId}`}
                  </CardTitle>
                  <Badge variant={creator.estimated ? "outline" : "default"}>
                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Posts</div>
                    <div className="font-medium">{creator.totalPosts}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Avg Views</div>
                    <div className="font-medium">{formatNumber(creator.avgViews)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Avg Likes</div>
                    <div className="font-medium">{formatNumber(creator.avgLikes)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Engagement</div>
                    <div className={`font-medium ${getEngagementColor(creator.avgEngagementRate)}`}>
                      {creator.avgEngagementRate.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {metrics.length > 10 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing top 10 creators. Total: {metrics.length} creators
          </p>
        )}
        
        {metrics.length === 0 && !loading && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">No recent metrics found for {platform}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Try selecting a different platform or time period
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}