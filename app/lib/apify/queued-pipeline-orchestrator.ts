import { Queue, Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { ApifyClient } from 'apify-client'
import { logger } from '../logger'
import { PipelineOrchestrator, Pipeline, PipelineStep } from './pipeline-orchestrator'

interface PipelineJobData {
  pipelineId: string
  stepIndex: number
  input?: any
}

export class QueuedPipelineOrchestrator extends PipelineOrchestrator {
  private redis: Redis
  private pipelineQueue: Queue<PipelineJobData>
  private worker?: Worker<PipelineJobData>

  constructor(actorManager: any) {
    super(actorManager)
    
    // Initialize Redis connection
    this.redis = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
    })

    // Initialize queue
    this.pipelineQueue = new Queue('instagram-pipeline', {
      connection: this.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    })

    // Initialize worker
    this.initializeWorker()
  }

  private initializeWorker() {
    this.worker = new Worker<PipelineJobData>(
      'instagram-pipeline',
      async (job: Job<PipelineJobData>) => {
        const { pipelineId, stepIndex, input } = job.data
        
        logger.info('Processing pipeline step', { pipelineId, stepIndex })
        
        const pipeline = await this.getPipelineStatus(pipelineId)
        if (!pipeline) {
          throw new Error('Pipeline not found')
        }

        const step = pipeline.steps[stepIndex]
        if (!step) {
          throw new Error('Step not found')
        }

        // Update step status
        step.status = 'running'
        await this.updatePipelineStatus(pipeline)

        try {
          // Execute the step based on its type
          let output: any

          switch (step.type) {
            case 'actor':
              output = await this.executeActorStep(step, input)
              break
            case 'transform':
              output = await this.executeTransformStep(step, input)
              break
            case 'filter':
              output = await this.executeFilterStep(step, input)
              break
            default:
              throw new Error(`Unknown step type: ${step.type}`)
          }

          // Update step with output
          step.output = output
          step.status = 'completed'
          await this.updatePipelineStatus(pipeline)

          // Queue next step if exists
          if (stepIndex < pipeline.steps.length - 1) {
            await this.pipelineQueue.add(
              `step-${stepIndex + 1}`,
              {
                pipelineId,
                stepIndex: stepIndex + 1,
                input: output
              }
            )
          } else {
            // Pipeline completed
            pipeline.status = 'completed'
            pipeline.completedAt = new Date()
            await this.updatePipelineStatus(pipeline)
          }

          return output
        } catch (error) {
          step.status = 'failed'
          step.error = error instanceof Error ? error.message : 'Unknown error'
          pipeline.status = 'failed'
          await this.updatePipelineStatus(pipeline)
          throw error
        }
      },
      {
        connection: this.redis,
        concurrency: 5,
      }
    )

    this.worker.on('completed', job => {
      logger.info('Pipeline step completed', { jobId: job.id })
    })

    this.worker.on('failed', (job, err) => {
      logger.error('Pipeline step failed', { jobId: job?.id, error: err })
    })
  }

  async executePipeline(pipelineId: string): Promise<Pipeline> {
    const pipeline = await this.getPipelineStatus(pipelineId)
    if (!pipeline) throw new Error('Pipeline not found')

    pipeline.status = 'running'
    await this.updatePipelineStatus(pipeline)

    // Queue the first step
    await this.pipelineQueue.add(
      'step-0',
      {
        pipelineId,
        stepIndex: 0,
        input: pipeline.steps[0].input
      }
    )

    return pipeline
  }

  private async executeActorStep(step: PipelineStep, input: any) {
    const client = new ApifyClient({ token: process.env.APIFY_API_KEY })
    
    const run = await client.actor(step.actorId!).call(input || step.input)
    const dataset = await client.dataset(run.defaultDatasetId).listItems()
    
    return {
      datasetId: run.defaultDatasetId,
      data: dataset.items
    }
  }

  private async executeTransformStep(step: PipelineStep, input: any) {
    // Extract Instagram handles from search results
    if (step.id === 'step2-extract-handles') {
      const handles = this.extractInstagramHandles(input.data || [])
      return { data: handles }
    }
    
    throw new Error(`Unknown transform step: ${step.id}`)
  }

  private async executeFilterStep(step: PipelineStep, input: any) {
    // Filter profiles by keywords
    if (step.id === 'step4-keyword-filter') {
      const filtered = this.filterProfilesByKeywords(
        input.data || [],
        step.input.keywords
      )
      return { data: filtered }
    }
    
    throw new Error(`Unknown filter step: ${step.id}`)
  }

  private async updatePipelineStatus(pipeline: Pipeline) {
    // In a real implementation, this would persist to a database
    // For now, we'll keep it in memory
    this.pipelines.set(pipeline.id, pipeline)
  }

  async cleanup() {
    await this.worker?.close()
    await this.pipelineQueue.close()
    await this.redis.quit()
  }
}