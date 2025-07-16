'use client'

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatNumber, formatDuration } from '@/lib/youtube-api/utils'
import { Play, ThumbsUp, MessageSquare, TrendingUp } from 'lucide-react'
import Image from 'next/image'

interface VideoPerformanceTableProps {
  videos: any[]
}

export default function VideoPerformanceTable({ videos }: VideoPerformanceTableProps) {
  const getPerformanceBadge = (views: number) => {
    if (views > 500000) return { label: 'Viral', variant: 'default' as const }
    if (views > 100000) return { label: 'High', variant: 'secondary' as const }
    if (views > 50000) return { label: 'Good', variant: 'outline' as const }
    return { label: 'Average', variant: 'outline' as const }
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Video</TableHead>
            <TableHead>Views</TableHead>
            <TableHead>Engagement</TableHead>
            <TableHead>Performance</TableHead>
            <TableHead>Published</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {videos.map((video) => {
            const performance = getPerformanceBadge(video.views)
            const daysAgo = Math.floor((Date.now() - new Date(video.publishedAt).getTime()) / (1000 * 60 * 60 * 24))
            
            return (
              <TableRow key={video.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative w-24 h-14 flex-shrink-0">
                      <Image
                        src={video.thumbnail}
                        alt={video.title}
                        fill
                        className="object-cover rounded"
                      />
                      <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                        {formatDuration(video.duration)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{video.title}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Play className="h-3 w-3" />
                          {formatNumber(video.views)}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {formatNumber(video.likes)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {formatNumber(video.comments)}
                        </span>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-right">
                    <div className="font-medium">{video.views.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">views</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-right">
                    <div className="font-medium">{video.engagementRate.toFixed(2)}%</div>
                    <div className="text-xs text-muted-foreground">rate</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={performance.variant}>
                    {performance.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-muted-foreground">
                    {daysAgo === 0 ? 'Today' : 
                     daysAgo === 1 ? 'Yesterday' : 
                     daysAgo < 7 ? `${daysAgo} days ago` :
                     daysAgo < 30 ? `${Math.floor(daysAgo / 7)} weeks ago` :
                     `${Math.floor(daysAgo / 30)} months ago`}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}