import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface RankingBadgeProps {
  score: number
  trend?: 'up' | 'down' | 'stable'
  explanation?: string
}

export default function RankingBadge({ score, trend, explanation }: RankingBadgeProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200"
    if (score >= 60) return "text-blue-600 bg-blue-50 border-blue-200"
    if (score >= 40) return "text-yellow-600 bg-yellow-50 border-yellow-200"
    return "text-gray-600 bg-gray-50 border-gray-200"
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-500" />
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-500" />
      case 'stable':
        return <Minus className="h-3 w-3 text-gray-500" />
      default:
        return null
    }
  }

  const badge = (
    <Badge 
      variant="outline" 
      className={`font-semibold ${getScoreColor(score)}`}
    >
      <span className="mr-1">{score}</span>
      {getTrendIcon()}
    </Badge>
  )

  if (explanation) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">{explanation}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
}