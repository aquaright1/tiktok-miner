import { test, expect } from '@playwright/test'
import { CreatorsListPage } from './pages/creators-list.page'
import { CreatorDetailPage } from './pages/creator-detail.page'
import { testCreators } from './fixtures/test-data'

test.describe('Creator Discovery with Page Objects', () => {
  let creatorsPage: CreatorsListPage
  let creatorDetailPage: CreatorDetailPage

  test.beforeEach(async ({ page }) => {
    creatorsPage = new CreatorsListPage(page)
    creatorDetailPage = new CreatorDetailPage(page)
    await creatorsPage.goto()
  })

  test('complete creator discovery workflow', async ({ page }) => {
    // Step 1: Filter by Instagram
    await creatorsPage.filterByPlatform('instagram')
    
    // Verify filtered results
    const creatorCount = await creatorsPage.getCreatorCount()
    expect(creatorCount).toBeGreaterThan(0)
    
    const firstCreator = await creatorsPage.getCreatorByIndex(0)
    await expect(firstCreator.platform).toContainText('Instagram')
    
    // Step 2: Search for fashion creators
    await creatorsPage.searchCreators('fashion')
    
    // Step 3: Sort by ranking score
    await creatorsPage.sortBy('ranking_desc')
    
    // Step 4: Navigate to creator detail
    await creatorsPage.clickCreator(0)
    await creatorDetailPage.waitForPageLoad()
    
    // Verify creator detail page
    await expect(creatorDetailPage.followerCount).toBeVisible()
    await expect(creatorDetailPage.engagementRate).toBeVisible()
    await expect(creatorDetailPage.rankingScore).toBeVisible()
    
    // Step 5: Check score breakdown
    const scoreBreakdown = await creatorDetailPage.getScoreBreakdown()
    expect(scoreBreakdown.engagement).toBeTruthy()
    expect(scoreBreakdown.followers).toBeTruthy()
    expect(scoreBreakdown.growth).toBeTruthy()
    expect(scoreBreakdown.consistency).toBeTruthy()
    
    // Step 6: View creator posts
    await creatorDetailPage.switchToPostsTab()
    const postCount = await creatorDetailPage.creatorPosts.count()
    expect(postCount).toBeGreaterThan(0)
    
    // Step 7: Add to pipeline
    await creatorDetailPage.addToPipeline(0)
    
    // Verify success
    await expect(page.getByText('Creator added to pipeline')).toBeVisible()
  })

  test('creator conversion flow', async ({ page }) => {
    // Navigate to a specific creator
    await creatorsPage.clickCreator(0)
    await creatorDetailPage.waitForPageLoad()
    
    // Convert to candidate
    await creatorDetailPage.convertToCandidate(0, 'Perfect fit for our brand ambassador role')
    
    // Verify redirect to candidate page
    await expect(page).toHaveURL(/\/candidates\//)
    await expect(page.getByText('Successfully converted to candidate')).toBeVisible()
  })

  test('pagination workflow', async ({ page }) => {
    // Get first page creators
    const firstPageCreator = await creatorsPage.getCreatorByIndex(0)
    const firstPageName = await firstPageCreator.name.textContent()
    
    // Navigate to next page
    await creatorsPage.goToNextPage()
    
    // Verify different creators
    const secondPageCreator = await creatorsPage.getCreatorByIndex(0)
    const secondPageName = await secondPageCreator.name.textContent()
    
    expect(firstPageName).not.toBe(secondPageName)
    
    // Navigate back
    await creatorsPage.goToPrevPage()
    
    // Verify we're back to first page
    const backToFirstCreator = await creatorsPage.getCreatorByIndex(0)
    const backToFirstName = await backToFirstCreator.name.textContent()
    
    expect(backToFirstName).toBe(firstPageName)
  })

  test('export creators workflow', async ({ page }) => {
    // Filter to get specific results
    await creatorsPage.filterByPlatform('instagram')
    await creatorsPage.searchCreators('fashion')
    
    // Export as CSV
    const download = await creatorsPage.exportCreators('csv')
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/creators.*\.csv/)
    
    // Save for inspection if needed
    const path = await download.path()
    expect(path).toBeTruthy()
  })

  test('creator sync workflow', async ({ page }) => {
    // Navigate to creator detail
    await creatorsPage.clickCreator(0)
    await creatorDetailPage.waitForPageLoad()
    
    // Get current sync time
    const oldSyncTime = await creatorDetailPage.lastSyncTime.textContent()
    
    // Perform sync
    await creatorDetailPage.syncCreator()
    
    // Verify sync time updated
    const newSyncTime = await creatorDetailPage.lastSyncTime.textContent()
    expect(newSyncTime).not.toBe(oldSyncTime)
  })

  test('multi-platform creator comparison', async ({ page }) => {
    const platforms = ['instagram', 'tiktok', 'youtube', 'twitter']
    const creatorsByPlatform: Record<string, any> = {}
    
    for (const platform of platforms) {
      await creatorsPage.goto()
      await creatorsPage.filterByPlatform(platform)
      
      const count = await creatorsPage.getCreatorCount()
      if (count > 0) {
        const creator = await creatorsPage.getCreatorByIndex(0)
        const score = await creator.score.textContent()
        creatorsByPlatform[platform] = {
          count,
          topScore: parseFloat(score || '0')
        }
      }
    }
    
    // Verify we have creators from multiple platforms
    expect(Object.keys(creatorsByPlatform).length).toBeGreaterThan(1)
  })
})

test.describe('Creator Discovery - Error Handling', () => {
  let creatorsPage: CreatorsListPage

  test.beforeEach(async ({ page }) => {
    creatorsPage = new CreatorsListPage(page)
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Intercept API calls to simulate error
    await page.route('**/api/creators*', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' })
      })
    })
    
    await creatorsPage.goto()
    
    // Should show error message
    await expect(page.getByText(/error|failed/i)).toBeVisible()
  })

  test('should handle empty search results', async ({ page }) => {
    await creatorsPage.goto()
    await creatorsPage.searchCreators('xyznonexistentcreator123')
    
    // Should show no results message
    await expect(page.getByText(/no creators found/i)).toBeVisible()
  })
})