import { ApifyClient } from 'apify-client'
import { ActorManager } from './actor-manager'
import { logger } from '../logger'
import { z } from 'zod'

export interface PipelineStep {
  id: string
  name: string
  actorId?: string
  type: 'actor' | 'transform' | 'filter'
  input?: any
  output?: {
    datasetId?: string
    data?: any[]
  }
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
}

export interface Pipeline {
  id: string
  name: string
  steps: PipelineStep[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
}

export class PipelineOrchestrator {
  private client: ApifyClient
  private actorManager: ActorManager
  private pipelines: Map<string, Pipeline> = new Map()

  constructor(actorManager: ActorManager) {
    this.actorManager = actorManager
    this.client = new ApifyClient({
      token: process.env.APIFY_API_KEY
    })
  }

  async createInstagramDiscoveryPipeline(keywords: string[]): Promise<Pipeline> {
    const pipelineId = `instagram-discovery-${Date.now()}`
    
    const pipeline: Pipeline = {
      id: pipelineId,
      name: 'Instagram Discovery Pipeline',
      steps: [
        {
          id: 'step1-google-search',
          name: 'Google Search for Instagram Profiles',
          type: 'actor',
          actorId: 'apify/google-search-scraper',
          input: {
            queries: keywords.map(k => `site:instagram.com ${k}`),
            resultsPerPage: 100,
            maxPagesPerQuery: 1
          },
          status: 'pending'
        },
        {
          id: 'step2-extract-handles',
          name: 'Extract Instagram Handles',
          type: 'transform',
          status: 'pending'
        },
        {
          id: 'step3-profile-scrape',
          name: 'Scrape Instagram Profiles',
          type: 'actor',
          actorId: process.env.APIFY_INSTAGRAM_SCRAPER_ID || 'apify/instagram-scraper',
          status: 'pending'
        },
        {
          id: 'step4-keyword-filter',
          name: 'Filter by Keywords',
          type: 'filter',
          input: { keywords },
          status: 'pending'
        }
      ],
      status: 'pending',
      createdAt: new Date()
    }

    this.pipelines.set(pipelineId, pipeline)
    return pipeline
  }

  async executePipeline(pipelineId: string): Promise<Pipeline> {
    const pipeline = this.pipelines.get(pipelineId)
    if (!pipeline) throw new Error('Pipeline not found')

    pipeline.status = 'running'

    try {
      // Step 1: Google Search
      const step1 = pipeline.steps[0]
      step1.status = 'running'
      
      const googleRun = await this.client.actor(step1.actorId!).call(step1.input)
      const googleDataset = await this.client.dataset(googleRun.defaultDatasetId).listItems()
      
      step1.output = {
        datasetId: googleRun.defaultDatasetId,
        data: googleDataset.items
      }
      step1.status = 'completed'

      // Step 2: Extract Handles
      const step2 = pipeline.steps[1]
      step2.status = 'running'
      
      const handles = this.extractInstagramHandles(googleDataset.items)
      step2.output = { data: handles }
      step2.status = 'completed'

      // Step 3: Profile Scraping
      const step3 = pipeline.steps[2]
      step3.status = 'running'
      
      const profileRun = await this.client.actor(step3.actorId!).call({
        directUrls: handles.map(h => `https://www.instagram.com/${h}/`),
        resultsType: 'details',
        resultsLimit: handles.length
      })
      
      const profileDataset = await this.client.dataset(profileRun.defaultDatasetId).listItems()
      step3.output = {
        datasetId: profileRun.defaultDatasetId,
        data: profileDataset.items
      }
      step3.status = 'completed'

      // Step 4: Keyword Filter
      const step4 = pipeline.steps[3]
      step4.status = 'running'
      
      const filteredProfiles = this.filterProfilesByKeywords(
        profileDataset.items,
        step4.input.keywords
      )
      
      step4.output = { data: filteredProfiles }
      step4.status = 'completed'

      pipeline.status = 'completed'
      pipeline.completedAt = new Date()
      
      return pipeline
      
    } catch (error) {
      pipeline.status = 'failed'
      const failedStep = pipeline.steps.find(s => s.status === 'running')
      if (failedStep) {
        failedStep.status = 'failed'
        failedStep.error = error instanceof Error ? error.message : 'Unknown error'
      }
      throw error
    }
  }

  private extractInstagramHandles(searchResults: any[]): string[] {
    const handles = new Set<string>()
    
    for (const result of searchResults) {
      // Extract from URL
      const url = result.url || result.link
      const match = url?.match(/instagram\.com\/([a-zA-Z0-9_.]+)/)
      if (match && match[1]) {
        handles.add(match[1])
      }
      
      // Extract from title/description
      const text = `${result.title || ''} ${result.description || ''}`
      const handleMatches = text.matchAll(/@([a-zA-Z0-9_.]+)/g)
      for (const [, handle] of handleMatches) {
        handles.add(handle)
      }
    }
    
    return Array.from(handles)
  }

  private filterProfilesByKeywords(profiles: any[], keywords: string[]): any[] {
    const lowerKeywords = keywords.map(k => k.toLowerCase())
    
    return profiles.filter(profile => {
      const searchableText = `
        ${profile.username || ''}
        ${profile.fullName || ''}
        ${profile.biography || ''}
        ${profile.businessCategoryName || ''}
      `.toLowerCase()
      
      return lowerKeywords.some(keyword => searchableText.includes(keyword))
    })
  }

  async getPipelineStatus(pipelineId: string): Promise<Pipeline | undefined> {
    return this.pipelines.get(pipelineId)
  }
}