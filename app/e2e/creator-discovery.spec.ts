import { test, expect } from '@playwright/test'

test.describe('Creator Discovery Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/creators')
  })

  test('should display creator list page with filters', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Creator Discovery/)
    
    // Check main elements are visible
    await expect(page.getByRole('heading', { name: /Creator Discovery/i })).toBeVisible()
    
    // Check filter elements
    await expect(page.getByTestId('platform-filter')).toBeVisible()
    await expect(page.getByTestId('follower-range-filter')).toBeVisible()
    await expect(page.getByTestId('search-input')).toBeVisible()
  })

  test('should filter creators by platform', async ({ page }) => {
    // Select Instagram filter
    await page.getByTestId('platform-filter').selectOption('instagram')
    
    // Wait for results to update
    await page.waitForResponse('**/api/creators*')
    
    // Check that all displayed creators are from Instagram
    const creatorCards = page.getByTestId('creator-card')
    const count = await creatorCards.count()
    
    for (let i = 0; i < count; i++) {
      const platformBadge = creatorCards.nth(i).getByTestId('platform-badge')
      await expect(platformBadge).toContainText('Instagram')
    }
  })

  test('should search creators by name', async ({ page }) => {
    // Type in search box
    await page.getByTestId('search-input').fill('fashion')
    
    // Wait for debounced search
    await page.waitForTimeout(500)
    await page.waitForResponse('**/api/creators*')
    
    // Check that results contain search term
    const creatorCards = page.getByTestId('creator-card')
    const firstCreator = creatorCards.first()
    
    await expect(firstCreator).toBeVisible()
    const creatorText = await firstCreator.textContent()
    expect(creatorText?.toLowerCase()).toContain('fashion')
  })

  test('should navigate to creator detail page', async ({ page }) => {
    // Click on first creator
    const firstCreator = page.getByTestId('creator-card').first()
    const creatorName = await firstCreator.getByTestId('creator-name').textContent()
    
    await firstCreator.click()
    
    // Check navigation
    await expect(page).toHaveURL(/\/creators\/[a-zA-Z0-9-]+/)
    
    // Check detail page elements
    await expect(page.getByRole('heading', { name: creatorName || '' })).toBeVisible()
    await expect(page.getByTestId('follower-count')).toBeVisible()
    await expect(page.getByTestId('engagement-rate')).toBeVisible()
    await expect(page.getByTestId('ranking-score')).toBeVisible()
  })

  test('should add creator to pipeline', async ({ page }) => {
    // Navigate to creator detail
    await page.getByTestId('creator-card').first().click()
    
    // Click add to pipeline button
    await page.getByTestId('add-to-pipeline-btn').click()
    
    // Select pipeline from modal
    await expect(page.getByTestId('pipeline-modal')).toBeVisible()
    await page.getByTestId('pipeline-select').selectOption({ index: 0 })
    await page.getByTestId('confirm-add-btn').click()
    
    // Check success toast
    await expect(page.getByText('Creator added to pipeline')).toBeVisible()
  })

  test('should convert creator to candidate', async ({ page }) => {
    // Navigate to creator detail
    await page.getByTestId('creator-card').first().click()
    
    // Click convert to candidate button
    await page.getByTestId('convert-to-candidate-btn').click()
    
    // Fill conversion form
    await expect(page.getByTestId('conversion-modal')).toBeVisible()
    await page.getByTestId('job-select').selectOption({ index: 0 })
    await page.getByTestId('conversion-notes').fill('Great fit for brand ambassador role')
    await page.getByTestId('confirm-convert-btn').click()
    
    // Check success and redirect
    await expect(page).toHaveURL(/\/candidates\/[a-zA-Z0-9-]+/)
    await expect(page.getByText('Successfully converted to candidate')).toBeVisible()
  })

  test('should sort creators by ranking score', async ({ page }) => {
    // Click on sort dropdown
    await page.getByTestId('sort-select').selectOption('ranking_desc')
    
    // Wait for results to update
    await page.waitForResponse('**/api/creators*')
    
    // Get all ranking scores
    const scoreElements = page.getByTestId('creator-score')
    const scores: number[] = []
    
    const count = await scoreElements.count()
    for (let i = 0; i < count; i++) {
      const scoreText = await scoreElements.nth(i).textContent()
      scores.push(parseFloat(scoreText || '0'))
    }
    
    // Check that scores are in descending order
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
    }
  })

  test('should paginate through creators', async ({ page }) => {
    // Check pagination exists
    const pagination = page.getByTestId('pagination')
    await expect(pagination).toBeVisible()
    
    // Click next page
    await page.getByTestId('next-page-btn').click()
    
    // Wait for new results
    await page.waitForResponse('**/api/creators*')
    
    // Check URL updated
    await expect(page).toHaveURL(/page=2/)
    
    // Check that new creators are displayed
    const firstCreatorPage2 = await page.getByTestId('creator-card').first().textContent()
    
    // Go back to page 1
    await page.getByTestId('prev-page-btn').click()
    await page.waitForResponse('**/api/creators*')
    
    const firstCreatorPage1 = await page.getByTestId('creator-card').first().textContent()
    
    // Verify different content
    expect(firstCreatorPage1).not.toBe(firstCreatorPage2)
  })

  test('should sync creator data', async ({ page }) => {
    // Navigate to creator detail
    await page.getByTestId('creator-card').first().click()
    
    // Check last sync time is displayed
    const lastSyncText = await page.getByTestId('last-sync-time').textContent()
    
    // Click sync button
    await page.getByTestId('sync-creator-btn').click()
    
    // Wait for sync to complete
    await expect(page.getByText('Syncing...')).toBeVisible()
    await expect(page.getByText('Sync complete')).toBeVisible({ timeout: 10000 })
    
    // Check that last sync time updated
    const newLastSyncText = await page.getByTestId('last-sync-time').textContent()
    expect(newLastSyncText).not.toBe(lastSyncText)
  })

  test('should show creator posts', async ({ page }) => {
    // Navigate to creator detail
    await page.getByTestId('creator-card').first().click()
    
    // Click on posts tab
    await page.getByTestId('posts-tab').click()
    
    // Check posts are displayed
    await expect(page.getByTestId('creator-post')).toHaveCount(3, { timeout: 5000 })
    
    // Check post elements
    const firstPost = page.getByTestId('creator-post').first()
    await expect(firstPost.getByTestId('post-image')).toBeVisible()
    await expect(firstPost.getByTestId('post-likes')).toBeVisible()
    await expect(firstPost.getByTestId('post-comments')).toBeVisible()
    await expect(firstPost.getByTestId('post-engagement')).toBeVisible()
  })

  test('should export creator list', async ({ page }) => {
    // Set up download promise before clicking
    const downloadPromise = page.waitForEvent('download')
    
    // Click export button
    await page.getByTestId('export-creators-btn').click()
    
    // Select export format
    await page.getByTestId('export-format').selectOption('csv')
    await page.getByTestId('confirm-export-btn').click()
    
    // Wait for download
    const download = await downloadPromise
    
    // Verify download
    expect(download.suggestedFilename()).toContain('creators')
    expect(download.suggestedFilename()).toContain('.csv')
  })
})

test.describe('Creator Discovery - Mobile View', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('should be responsive on mobile', async ({ page }) => {
    await page.goto('/creators')
    
    // Check mobile menu toggle
    await expect(page.getByTestId('mobile-menu-toggle')).toBeVisible()
    
    // Open mobile filters
    await page.getByTestId('mobile-filter-toggle').click()
    await expect(page.getByTestId('mobile-filter-drawer')).toBeVisible()
    
    // Check creator cards stack vertically
    const creatorCards = page.getByTestId('creator-card')
    const firstCard = creatorCards.first()
    const secondCard = creatorCards.nth(1)
    
    const firstBox = await firstCard.boundingBox()
    const secondBox = await secondCard.boundingBox()
    
    expect(firstBox?.y).toBeLessThan(secondBox?.y || 0)
    expect(firstBox?.x).toBe(secondBox?.x)
  })
})