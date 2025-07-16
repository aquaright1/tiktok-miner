# Product Requirements Document: Scraper Page

## Overview
Add a new "Scraper" page to the TikTok Miner dashboard that allows users to scrape Instagram and TikTok profiles using Apify APIs and selectively add them to the main creators dashboard.

## Navigation
- Add "Scraper" menu item to the right of "Creators" in the main navigation
- Route: `/scraper`

## Page Layout

### 1. Search Section
- **Input Field**: Multi-line textarea for entering keywords (one per line)
- **Scrape Button**: Triggers scraping of 100 profiles from each platform (Instagram and TikTok)
- **Platform Selection**: Fixed to scrape both Instagram and TikTok (100 each)

### 2. Results Table
- Display scraped profiles in a table identical to the creators table format
- Include all columns from creators table:
  - Profile (with platform-specific links)
  - Platform 
  - Followers
  - Engagement Rate
  - Average Likes
  - Posts
  - Tags
  - Selection checkbox (for adding to main dashboard)

### 3. Actions Section
- **Add Selected**: Button to add selected profiles to the main creators dashboard
- **Clear Results**: Button to clear the scraped results table

## Technical Requirements

### API Integration
- Use Apify Instagram Profile Scraper API
- Use Apify TikTok Profile Scraper API
- Scrape exactly 100 profiles per platform per search

### Data Flow
1. User enters keywords and clicks "Scrape"
2. System calls Apify APIs for both platforms with keywords
3. Results displayed in table below
4. User selects desired profiles
5. Selected profiles are added to main creators database

### State Management
- Scraped results stored in component state (not persisted)
- Selection state tracked per row
- Clear results removes all scraped data from state

## Constraints
- No additional features beyond specified requirements
- Use existing table component and styling from creators page
- No filtering or sorting of scraped results
- No persistence of scraped results between page loads