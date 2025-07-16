import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScoreBreakdown } from "@/lib/services/creator-ranking"
import { Users, Heart, TrendingUp, Calendar } from "lucide-react"

interface ScoreBreakdownCardProps {
  breakdown: ScoreBreakdown
}

export default function ScoreBreakdownCard({ breakdown }: ScoreBreakdownCardProps) {
  const components = [
    {
      name: "Engagement",
      icon: Heart,
      value: breakdown.components.engagement,
      weight: breakdown.weights.engagement,
      color: "text-pink-600"
    },
    {
      name: "Followers",
      icon: Users,
      value: breakdown.components.followers,
      weight: breakdown.weights.followers,
      color: "text-blue-600"
    },
    {
      name: "Growth",
      icon: TrendingUp,
      value: breakdown.components.growth,
      weight: breakdown.weights.growth,
      color: "text-green-600"
    },
    {
      name: "Consistency",
      icon: Calendar,
      value: breakdown.components.consistency,
      weight: breakdown.weights.consistency,
      color: "text-purple-600"
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Ranking Score Breakdown</span>
          <span className="text-3xl font-bold">{breakdown.totalScore}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{breakdown.explanation}</p>
        
        <div className="space-y-3">
          {components.map((component) => {
            const Icon = component.icon
            const percentage = component.value.normalized * 100
            const contribution = component.value.weighted * 100
            
            return (
              <div key={component.name} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${component.color}`} />
                    <span className="font-medium">{component.name}</span>
                    <span className="text-muted-foreground">
                      ({(component.weight * 100).toFixed(0)}% weight)
                    </span>
                  </div>
                  <span className="font-medium">
                    +{contribution.toFixed(1)} pts
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Raw: {formatRawValue(component.name, component.value.raw)}</span>
                  <span>Score: {percentage.toFixed(1)}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function formatRawValue(componentName: string, value: number): string {
  switch (componentName) {
    case "Engagement":
      return `${(value * 100).toFixed(2)}%`
    case "Followers":
      return value >= 1000000 
        ? `${(value / 1000000).toFixed(1)}M`
        : value >= 1000
        ? `${(value / 1000).toFixed(1)}K`
        : value.toString()
    case "Growth":
      return `${(value * 100).toFixed(1)}%`
    case "Consistency":
      return `${value} posts/week`
    default:
      return value.toString()
  }
}