import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Heart, MessageCircle, Calendar } from "lucide-react"

interface MetricsCardProps {
  followers: number
  engagement: number
  avgLikes?: number
  avgComments?: number
  postFrequency?: number
}

export default function MetricsCard({
  followers,
  engagement,
  avgLikes = 0,
  avgComments = 0,
  postFrequency = 0
}: MetricsCardProps) {
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
    <Card>
      <CardHeader>
        <CardTitle>Metrics Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Followers</span>
            </div>
            <p className="text-2xl font-bold">{formatNumber(followers)}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Heart className="h-4 w-4" />
              <span>Engagement Rate</span>
            </div>
            <p className="text-2xl font-bold">{(engagement * 100).toFixed(2)}%</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Heart className="h-4 w-4" />
              <span>Avg. Likes</span>
            </div>
            <p className="text-xl font-semibold">{formatNumber(avgLikes)}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageCircle className="h-4 w-4" />
              <span>Avg. Comments</span>
            </div>
            <p className="text-xl font-semibold">{formatNumber(avgComments)}</p>
          </div>
        </div>

        {postFrequency > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Posts per week</span>
            </div>
            <p className="text-xl font-semibold">{postFrequency}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}