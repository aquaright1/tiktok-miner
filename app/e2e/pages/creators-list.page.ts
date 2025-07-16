import { Page, Locator } from '@playwright/test'

export class CreatorsListPage {
  readonly page: Page
  readonly platformFilter: Locator
  readonly followerRangeFilter: Locator
  readonly searchInput: Locator
  readonly sortSelect: Locator
  readonly creatorCards: Locator
  readonly pagination: Locator
  readonly nextPageBtn: Locator
  readonly prevPageBtn: Locator
  readonly exportBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.platformFilter = page.getByTestId('platform-filter')
    this.followerRangeFilter = page.getByTestId('follower-range-filter')
    this.searchInput = page.getByTestId('search-input')
    this.sortSelect = page.getByTestId('sort-select')
    this.creatorCards = page.getByTestId('creator-card')
    this.pagination = page.getByTestId('pagination')
    this.nextPageBtn = page.getByTestId('next-page-btn')
    this.prevPageBtn = page.getByTestId('prev-page-btn')
    this.exportBtn = page.getByTestId('export-creators-btn')
  }

  async goto() {
    await this.page.goto('/creators')
  }

  async filterByPlatform(platform: string) {
    await this.platformFilter.selectOption(platform)
    await this.waitForCreatorsLoad()
  }

  async searchCreators(searchTerm: string) {
    await this.searchInput.fill(searchTerm)
    await this.page.waitForTimeout(500) // Debounce delay
    await this.waitForCreatorsLoad()
  }

  async sortBy(sortOption: string) {
    await this.sortSelect.selectOption(sortOption)
    await this.waitForCreatorsLoad()
  }

  async getCreatorCount() {
    return await this.creatorCards.count()
  }

  async getCreatorByIndex(index: number) {
    const card = this.creatorCards.nth(index)
    return {
      card,
      name: card.getByTestId('creator-name'),
      platform: card.getByTestId('platform-badge'),
      followers: card.getByTestId('follower-count'),
      engagement: card.getByTestId('engagement-rate'),
      score: card.getByTestId('creator-score')
    }
  }

  async clickCreator(index: number = 0) {
    await this.creatorCards.nth(index).click()
  }

  async goToNextPage() {
    await this.nextPageBtn.click()
    await this.waitForCreatorsLoad()
  }

  async goToPrevPage() {
    await this.prevPageBtn.click()
    await this.waitForCreatorsLoad()
  }

  async exportCreators(format: 'csv' | 'json' = 'csv') {
    const downloadPromise = this.page.waitForEvent('download')
    await this.exportBtn.click()
    await this.page.getByTestId('export-format').selectOption(format)
    await this.page.getByTestId('confirm-export-btn').click()
    return await downloadPromise
  }

  private async waitForCreatorsLoad() {
    await this.page.waitForResponse(resp => 
      resp.url().includes('/api/creators') && resp.status() === 200
    )
  }
}