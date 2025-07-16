import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface PipelineStep {
  id: string
  name: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
  outputCount?: number
}

interface Pipeline {
  id: string
  name?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'scraping_posts' | 'reducing_metrics' | 'saving_profiles'
  createdAt: string
  completedAt?: string
  steps: PipelineStep[]
  handles?: string[]
  keywords?: string[]
  error?: string
}

interface MetricsPipeline {
  id: string
  status: 'pending' | 'scraping_posts' | 'reducing_metrics' | 'saving_profiles' | 'completed' | 'failed'
  handles: string[]
  keywords: string[]
  steps: {
    scrapePostsDatasetId?: string
    reducedMetricsDatasetId?: string
    profilesCreated?: number
  }
  error?: string
  createdAt: string
  completedAt?: string
}

interface PipelineStatusProps {
  pipelineId: string
  onComplete?: (results: any[]) => void
}

export function PipelineStatus({ pipelineId, onComplete }: PipelineStatusProps) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pipelineType, setPipelineType] = useState<'discovery' | 'metrics'>('discovery')

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/scraper/pipeline?pipelineId=${pipelineId}`)
        const data = await response.json()
        
        if (data.success) {
          setPipelineType(data.pipelineType || 'discovery')
          setPipeline(data.pipeline)
          setResults(data.results)
          
          if (data.pipeline.status === 'completed' && onComplete) {
            onComplete(data.results)
          }
        }
      } catch (error) {
        console.error('Failed to fetch pipeline status:', error)
      } finally {
        setLoading(false)
      }
    }

    // Poll for status updates
    const interval = setInterval(fetchStatus, 2000)
    fetchStatus()

    return () => clearInterval(interval)
  }, [pipelineId, onComplete])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (!pipeline) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Pipeline not found</p>
        </CardContent>
      </Card>
    )
  }

  // Calculate progress differently for metrics pipeline
  const getProgress = () => {
    if (pipelineType === 'metrics') {
      const statusMap = {
        'pending': 0,
        'scraping_posts': 25,
        'reducing_metrics': 50,
        'saving_profiles': 75,
        'completed': 100,
        'failed': 0
      }
      return statusMap[pipeline.status] || 0
    } else {
      const completedSteps = pipeline.steps.filter(s => s.status === 'completed').length
      return (completedSteps / pipeline.steps.length) * 100
    }
  }
  
  const progress = getProgress()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">
            {pipelineType === 'metrics' 
              ? 'Instagram 30-Day Metrics Analysis' 
              : pipeline.name || 'Instagram Discovery Pipeline'}
          </CardTitle>
          <Badge variant={
            pipeline.status === 'completed' ? 'success' :
            pipeline.status === 'failed' ? 'destructive' :
            pipeline.status === 'running' ? 'default' : 'secondary'
          }>
            {pipeline.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progress</span>
            <span>
              {pipelineType === 'metrics' 
                ? getMetricsStatusText(pipeline.status)
                : `${pipeline.steps.filter(s => s.status === 'completed').length} / ${pipeline.steps.length} steps`}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Pipeline Steps */}
        <div className="space-y-4">
          {pipelineType === 'metrics' ? (
            // Metrics pipeline steps
            <>
              <MetricsStep 
                name="Scraping Instagram Posts" 
                status={getMetricsStepStatus(pipeline.status, 'scraping_posts')}
                description="Collecting posts from the last 30 days"
              />
              <MetricsStep 
                name="Analyzing Engagement Metrics" 
                status={getMetricsStepStatus(pipeline.status, 'reducing_metrics')}
                description="Calculating likes, comments, and views averages"
              />
              <MetricsStep 
                name="Saving Profile Data" 
                status={getMetricsStepStatus(pipeline.status, 'saving_profiles')}
                description="Storing profiles with 30-day metrics in database"
              />
            </>
          ) : (
            // Discovery pipeline steps
            pipeline.steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-3">
              <div className="mt-0.5">
                {step.status === 'completed' && (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
                {step.status === 'running' && (
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                )}
                {step.status === 'failed' && (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                {step.status === 'pending' && (
                  <Circle className="h-5 w-5 text-gray-400" />
                )}
              </div>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    Step {index + 1}: {step.name}
                  </h4>
                  {step.outputCount !== undefined && step.outputCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {step.outputCount} results
                    </span>
                  )}
                </div>
                
                {step.error && (
                  <p className="text-xs text-red-600">{step.error}</p>
                )}
                
                {step.status === 'running' && (
                  <p className="text-xs text-muted-foreground">Processing...</p>
                )}
              </div>
            </div>
            ))
          )}
        </div>

        {/* Results Summary */}
        {pipeline.status === 'completed' && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium">
              {pipelineType === 'metrics' 
                ? `Successfully analyzed ${results.length} Instagram profiles with 30-day metrics`
                : `Found ${results.length} profiles matching your criteria`}
            </p>
          </div>
        )}
        
        {/* Error Message */}
        {pipeline.error && (
          <div className="pt-4 border-t">
            <p className="text-sm text-red-600">
              Error: {pipeline.error}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Helper component for metrics pipeline steps
function MetricsStep({ name, status, description }: { 
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  description: string 
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">
        {status === 'completed' && (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        )}
        {status === 'running' && (
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
        )}
        {status === 'failed' && (
          <XCircle className="h-5 w-5 text-red-600" />
        )}
        {status === 'pending' && (
          <Circle className="h-5 w-5 text-gray-400" />
        )}
      </div>
      
      <div className="flex-1 space-y-1">
        <h4 className="text-sm font-medium">{name}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

// Helper functions
function getMetricsStepStatus(
  pipelineStatus: string, 
  stepName: 'scraping_posts' | 'reducing_metrics' | 'saving_profiles'
): 'pending' | 'running' | 'completed' | 'failed' {
  const statusOrder = ['pending', 'scraping_posts', 'reducing_metrics', 'saving_profiles', 'completed']
  const currentIndex = statusOrder.indexOf(pipelineStatus)
  const stepIndex = statusOrder.indexOf(stepName)
  
  if (pipelineStatus === 'failed') return 'failed'
  if (currentIndex > stepIndex) return 'completed'
  if (currentIndex === stepIndex) return 'running'
  return 'pending'
}

function getMetricsStatusText(status: string): string {
  switch (status) {
    case 'pending': return 'Starting pipeline...'
    case 'scraping_posts': return 'Scraping posts (1/3)'
    case 'reducing_metrics': return 'Analyzing metrics (2/3)'
    case 'saving_profiles': return 'Saving data (3/3)'
    case 'completed': return 'Pipeline completed'
    case 'failed': return 'Pipeline failed'
    default: return status
  }
}