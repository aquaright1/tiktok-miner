'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/youtube-api/utils'
import { 
  Youtube, 
  Twitter, 
  Instagram, 
  Linkedin,
  MapPin,
  Calendar,
  TrendingUp
} from 'lucide-react'
import RankingBadge from './ranking-badge'

interface CreatorProfileHeaderProps {
  creator: any
  scoreBreakdown: any
}

const platformIcons: Record<string, any> = {
  youtube: Youtube,
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin
}

const platformColors: Record<string, string> = {
  youtube: 'text-red-600',
  twitter: 'text-blue-400',
  instagram: 'text-pink-600',
  linkedin: 'text-blue-700'
}

export default function CreatorProfileHeader({ 
  creator, 
  scoreBreakdown 
}: CreatorProfileHeaderProps) {
  const PlatformIcon = platformIcons[creator.platform.toLowerCase()] || TrendingUp
  const platformColor = platformColors[creator.platform.toLowerCase()] || 'text-gray-600'
  const initials = creator.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Avatar */}
        <Avatar className="h-24 w-24 md:h-32 md:w-32">
          <AvatarImage src={creator.avatarUrl} alt={creator.name} />
          <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{creator.name}</h1>
              <div className="flex items-center gap-3 mt-2 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <PlatformIcon className={`h-4 w-4 ${platformColor}`} />
                  <span>@{creator.username}</span>
                </div>
                {creator.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{creator.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Joined {new Date(creator.createdAt || Date.now()).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <RankingBadge 
              score={scoreBreakdown.totalScore} 
              explanation={scoreBreakdown.explanation}
            />
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="text-2xl font-bold">{formatNumber(creator.followerCount)}</div>
              <div className="text-sm text-muted-foreground">Followers</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{creator.engagementRate.toFixed(2)}%</div>
              <div className="text-sm text-muted-foreground">Engagement Rate</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatNumber(creator.avgLikes)}</div>
              <div className="text-sm text-muted-foreground">Avg. Likes</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{creator.postFrequency}/week</div>
              <div className="text-sm text-muted-foreground">Post Frequency</div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {creator.niche && (
              <Badge variant="secondary">{creator.niche}</Badge>
            )}
            {creator.isPipelined && (
              <Badge variant="default">In Pipeline</Badge>
            )}
            <Badge variant="outline" className={platformColor}>
              {creator.platform}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}