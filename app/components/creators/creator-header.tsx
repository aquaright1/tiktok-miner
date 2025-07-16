import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Creator } from "@/lib/types/creator"
import { Instagram, Youtube, Twitter, Globe } from "lucide-react"

interface CreatorHeaderProps {
  creator: Creator
}

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
  x: Twitter,
}

export default function CreatorHeader({ creator }: CreatorHeaderProps) {
  const PlatformIcon = platformIcons[creator.platform.toLowerCase()] || Globe

  return (
    <div className="flex items-center space-x-4">
      <Avatar className="h-24 w-24">
        <AvatarImage src={creator.avatarUrl} alt={creator.name} />
        <AvatarFallback className="text-2xl">
          {creator.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{creator.name}</h1>
          <Badge variant="secondary" className="flex items-center gap-1">
            <PlatformIcon className="h-3 w-3" />
            {creator.platform}
          </Badge>
        </div>
        
        <p className="text-muted-foreground">@{creator.username}</p>
        
        <div className="flex flex-wrap gap-2 text-sm">
          {creator.niche && (
            <Badge variant="outline">{creator.niche}</Badge>
          )}
          {creator.location && (
            <Badge variant="outline">{creator.location}</Badge>
          )}
        </div>
      </div>
    </div>
  )
}