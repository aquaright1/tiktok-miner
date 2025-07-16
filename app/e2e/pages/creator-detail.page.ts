import { Page, Locator } from '@playwright/test'

export class CreatorDetailPage {
  readonly page: Page
  readonly creatorName: Locator
  readonly followerCount: Locator
  readonly engagementRate: Locator
  readonly rankingScore: Locator
  readonly platform: Locator
  readonly location: Locator
  readonly niche: Locator
  readonly lastSyncTime: Locator
  readonly syncBtn: Locator
  readonly addToPipelineBtn: Locator
  readonly convertToCandidateBtn: Locator
  readonly postsTab: Locator
  readonly analyticsTab: Locator
  readonly creatorPosts: Locator

  constructor(page: Page) {
    this.page = page
    this.creatorName = page.getByRole('heading', { level: 1 })
    this.followerCount = page.getByTestId('follower-count')
    this.engagementRate = page.getByTestId('engagement-rate')
    this.rankingScore = page.getByTestId('ranking-score')
    this.platform = page.getByTestId('platform-info')
    this.location = page.getByTestId('location-info')
    this.niche = page.getByTestId('niche-info')
    this.lastSyncTime = page.getByTestId('last-sync-time')
    this.syncBtn = page.getByTestId('sync-creator-btn')
    this.addToPipelineBtn = page.getByTestId('add-to-pipeline-btn')
    this.convertToCandidateBtn = page.getByTestId('convert-to-candidate-btn')
    this.postsTab = page.getByTestId('posts-tab')
    this.analyticsTab = page.getByTestId('analytics-tab')
    this.creatorPosts = page.getByTestId('creator-post')
  }

  async waitForPageLoad() {
    await this.page.waitForSelector('[data-testid="creator-detail-loaded"]')
  }

  async syncCreator() {
    await this.syncBtn.click()
    await this.page.waitForSelector('text=Syncing...', { state: 'visible' })
    await this.page.waitForSelector('text=Sync complete', { state: 'visible', timeout: 10000 })
  }

  async addToPipeline(pipelineIndex: number = 0) {
    await this.addToPipelineBtn.click()
    await this.page.waitForSelector('[data-testid="pipeline-modal"]')
    await this.page.getByTestId('pipeline-select').selectOption({ index: pipelineIndex })
    await this.page.getByTestId('confirm-add-btn').click()
    await this.page.waitForSelector('text=Creator added to pipeline')
  }

  async convertToCandidate(jobIndex: number = 0, notes?: string) {
    await this.convertToCandidateBtn.click()
    await this.page.waitForSelector('[data-testid="conversion-modal"]')
    await this.page.getByTestId('job-select').selectOption({ index: jobIndex })
    
    if (notes) {
      await this.page.getByTestId('conversion-notes').fill(notes)
    }
    
    await this.page.getByTestId('confirm-convert-btn').click()
    await this.page.waitForURL(/\/candidates\//)
    await this.page.waitForSelector('text=Successfully converted to candidate')
  }

  async switchToPostsTab() {
    await this.postsTab.click()
    await this.page.waitForSelector('[data-testid="creator-post"]')
  }

  async switchToAnalyticsTab() {
    await this.analyticsTab.click()
    await this.page.waitForSelector('[data-testid="analytics-chart"]')
  }

  async getPostByIndex(index: number) {
    const post = this.creatorPosts.nth(index)
    return {
      post,
      image: post.getByTestId('post-image'),
      likes: post.getByTestId('post-likes'),
      comments: post.getByTestId('post-comments'),
      engagement: post.getByTestId('post-engagement'),
      caption: post.getByTestId('post-caption')
    }
  }

  async getScoreBreakdown() {
    return {
      engagement: await this.page.getByTestId('score-engagement').textContent(),
      followers: await this.page.getByTestId('score-followers').textContent(),
      growth: await this.page.getByTestId('score-growth').textContent(),
      consistency: await this.page.getByTestId('score-consistency').textContent()
    }
  }
}