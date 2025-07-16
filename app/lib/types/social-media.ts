// Enhanced social media data types

export interface TwitterProfile {
  handle: string;
  url?: string;
  bio?: string;
  followersCount?: number;
  followingCount?: number;
  tweetsCount?: number;
  verified?: boolean;
  profileImageUrl?: string;
  bannerImageUrl?: string;
  location?: string;
  website?: string;
  joinedDate?: string;
  lastActivityDate?: string;
}




export interface WebsiteProfile {
  url: string;
  title?: string;
  description?: string;
  techStack?: string[];
  lastUpdated?: string;
}

export interface EnrichedSocialMedia {
  twitter?: TwitterProfile;
  website?: WebsiteProfile;
  youtube?: {
    handle: string;
    url?: string;
    channelName?: string;
    subscriberCount?: number;
  };
  bluesky?: {
    handle: string;
    url?: string;
    displayName?: string;
    bio?: string;
  };
  email?: {
    address: string;
    verified?: boolean;
    source?: 'website' | 'social';
  };
  lastEnrichedAt?: string;
  enrichmentVersion?: string;
}

export interface SocialMediaEnrichmentResult {
  success: boolean;
  data?: EnrichedSocialMedia;
  errors?: Array<{
    platform: string;
    error: string;
  }>;
  timestamp: string;
}