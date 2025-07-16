'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Youtube, Twitter, Instagram, Linkedin } from 'lucide-react';
import { TbBrandTiktok } from 'react-icons/tb';

interface CreatorCardProps {
  creator: {
    id: string;
    name: string;
    bio?: string;
    profileImageUrl?: string;
    category?: string;
    tags?: string[];
    isVerified?: boolean;
    metrics?: {
      totalReach?: number;
      engagementScore?: number;
      engagementRate?: number;
    };
    platforms?: any;
    external?: boolean;
    source?: string;
  };
}

export function CreatorCard({ creator }: CreatorCardProps) {
  const platformIcons = {
    youtube: <Youtube className="h-4 w-4" />,
    twitter: <Twitter className="h-4 w-4" />,
    instagram: <Instagram className="h-4 w-4" />,
    tiktok: <TbBrandTiktok className="h-4 w-4" />,
    linkedin: <Linkedin className="h-4 w-4" />
  };

  const formatNumber = (num?: number): string => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const cardContent = (
    <>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={creator.profileImageUrl} alt={creator.name} />
            <AvatarFallback>
              {creator.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate flex items-center gap-1">
              {creator.name}
              {creator.isVerified && (
                <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
              )}
            </h3>
            {creator.category && (
              <p className="text-sm text-gray-600">{creator.category}</p>
            )}
          </div>
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

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
          <div>
            <span className="text-gray-500">Reach:</span>
            <span className="ml-1 font-medium">
              {formatNumber(creator.metrics?.totalReach)}
            </span>
          </div>
          {creator.metrics?.engagementRate !== undefined && (
            <div>
              <span className="text-gray-500">Engagement:</span>
              <span className="ml-1 font-medium">
                {creator.metrics.engagementRate.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Platforms */}
        <div className="flex items-center gap-2 mb-3">
          {creator.platforms && Object.entries(creator.platforms).map(([platform, data]: [string, any]) => {
            if (!data) return null;
            return (
              <div
                key={platform}
                className="flex items-center gap-1 text-gray-600"
                title={`${platform}: ${formatNumber(data.followers || data.subscribers)} followers`}
              >
                {platformIcons[platform as keyof typeof platformIcons]}
                <span className="text-xs">
                  {formatNumber(data.followers || data.subscribers)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Tags */}
        {creator.tags && creator.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {creator.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {creator.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{creator.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </>
  );

  // If external creator, don't wrap in Link
  if (creator.external) {
    return (
      <Card className="hover:shadow-lg transition-shadow cursor-default">
        {cardContent}
      </Card>
    );
  }

  return (
    <Link href={`/creators/${creator.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        {cardContent}
      </Card>
    </Link>
  );
}