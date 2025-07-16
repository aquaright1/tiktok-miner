import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCreatorPosts } from "@/app/actions/creators"
import { CreatorPost } from "@/lib/types/creator"
import { formatDistanceToNow } from "date-fns"
import { Heart, MessageCircle, Share2, ExternalLink } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface RecentContentProps {
  creatorId: string
}

export default async function RecentContent({ creatorId }: RecentContentProps) {
  const posts = await getCreatorPosts(creatorId)

  if (!posts || posts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Content</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No recent posts available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Recent Content</h2>
      
      <div className="grid gap-4 md:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}

function PostCard({ post }: { post: CreatorPost }) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-shadow">
      <div className="relative aspect-square">
        {post.thumbnailUrl && (
          <Image
            src={post.thumbnailUrl}
            alt={post.caption || "Post thumbnail"}
            fill
            className="object-cover"
          />
        )}
        <Link
          href={post.postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center"
        >
          <ExternalLink className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
        </Link>
      </div>
      
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground mb-2">
          {formatDistanceToNow(post.createdAt, { addSuffix: true })}
        </p>
        
        {post.caption && (
          <p className="text-sm line-clamp-2 mb-3">{post.caption}</p>
        )}
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Heart className="h-4 w-4" />
            <span>{formatNumber(post.likes)}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="h-4 w-4" />
            <span>{formatNumber(post.comments)}</span>
          </div>
          {post.shares !== undefined && (
            <div className="flex items-center gap-1">
              <Share2 className="h-4 w-4" />
              <span>{formatNumber(post.shares)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}