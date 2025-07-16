'use client'

import React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Youtube, Twitter, Instagram, Linkedin } from 'lucide-react'
import { TbBrandTiktok } from 'react-icons/tb'
import { cn } from '@/lib/utils'

// Types
interface PlatformData {
  followers?: number
  subscribers?: number
}

interface CreatorPlatforms {
  youtube?: PlatformData
  twitter?: PlatformData
  instagram?: PlatformData
  tiktok?: PlatformData
  linkedin?: PlatformData
}

interface CreatorMetrics {
  totalReach?: number
  engagementScore?: number
  engagementRate?: number
}

interface CreatorCardProps {
  creator: {
    id: string
    name: string
    bio?: string
    profileImageUrl?: string
    category?: string
    tags?: string[]
    isVerified?: boolean
    metrics?: CreatorMetrics
    platforms?: CreatorPlatforms
    external?: boolean
    source?: string
  }
}

// Utility functions
const formatNumber = (num?: number): string => {
  if (!num) return '0'
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

// Platform icon mapping
const PLATFORM_ICONS = {
  youtube: Youtube,
  twitter: Twitter,
  instagram: Instagram,
  tiktok: TbBrandTiktok,
  linkedin: Linkedin
} as const

// Sub-components
const CreatorAvatar: React.FC<{ name: string; profileImageUrl?: string }> = ({ 
  name, 
  profileImageUrl 
}) => (
  <Avatar className="h-12 w-12">
    <AvatarImage src={profileImageUrl} alt={name} />
    <AvatarFallback>
      {name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)}
    </AvatarFallback>
  </Avatar>
)

const CreatorHeader: React.FC<{
  name: string
  category?: string
  isVerified?: boolean
  external?: boolean
}> = ({ name, category, isVerified, external }) => (
  <div className="flex-1 min-w-0">
    <h3 className="font-semibold text-base truncate flex items-center gap-1">
      {name}
      {isVerified && (
        <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
      )}
    </h3>
    {category && (
      <p className="text-sm text-gray-600">{category}</p>
    )}
  </div>
)

const CreatorMetricsDisplay: React.FC<{ metrics?: CreatorMetrics }> = ({ metrics }) => {
  if (!metrics) return null
  
  return (
    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
      <div>
        <span className="text-gray-500">Reach:</span>
        <span className="ml-1 font-medium">
          {formatNumber(metrics.totalReach)}
        </span>
      </div>
      {metrics.engagementRate !== undefined && (
        <div>
          <span className="text-gray-500">Engagement:</span>
          <span className="ml-1 font-medium">
            {metrics.engagementRate.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  )
}

const PlatformBadges: React.FC<{ platforms?: CreatorPlatforms }> = ({ platforms }) => {
  if (!platforms) return null
  
  const entries = Object.entries(platforms).filter(([_, data]) => data !== null)
  if (entries.length === 0) return null
  
  return (
    <div className="flex items-center gap-2 mb-3">
      {entries.map(([platform, data]) => {
        const Icon = PLATFORM_ICONS[platform as keyof typeof PLATFORM_ICONS]
        const followerCount = data?.followers || data?.subscribers || 0
        
        if (!Icon || !followerCount) return null
        
        return (
          <div
            key={platform}
            className="flex items-center gap-1 text-gray-600"
            title={`${platform}: ${formatNumber(followerCount)} followers`}
          >
            <Icon className="h-4 w-4" />
            <span className="text-xs">{formatNumber(followerCount)}</span>
          </div>
        )
      })}
    </div>
  )
}

const TagList: React.FC<{ tags?: string[]; maxVisible?: number }> = ({ 
  tags, 
  maxVisible = 3 
}) => {
  if (!tags || tags.length === 0) return null
  
  const visibleTags = tags.slice(0, maxVisible)
  const remainingCount = tags.length - maxVisible
  
  return (
    <div className="flex flex-wrap gap-1">
      {visibleTags.map((tag, index) => (
        <Badge key={index} variant="secondary" className="text-xs">
          {tag}
        </Badge>
      ))}
      {remainingCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          +{remainingCount}
        </Badge>
      )}
    </div>
  )
}

// Main component
export function CreatorCard({ creator }: CreatorCardProps) {
  const CardWrapper = creator.external ? 'div' : Link
  const wrapperProps = creator.external 
    ? {} 
    : { href: `/creators/${creator.id}` }
  
  return (
    <CardWrapper {...wrapperProps}>
      <Card className={cn(
        "hover:shadow-lg transition-shadow",
        creator.external ? "cursor-default" : "cursor-pointer"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <CreatorAvatar 
              name={creator.name} 
              profileImageUrl={creator.profileImageUrl} 
            />
            <CreatorHeader
              name={creator.name}
              category={creator.category}
              isVerified={creator.isVerified}
              external={creator.external}
            />
            {creator.external && (
              <Badge variant="outline" className="text-xs">
                External
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {creator.bio && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-3">
              {creator.bio}
            </p>
          )}
          
          <CreatorMetricsDisplay metrics={creator.metrics} />
          <PlatformBadges platforms={creator.platforms} />
          <TagList tags={creator.tags} />
        </CardContent>
      </Card>
    </CardWrapper>
  )
}