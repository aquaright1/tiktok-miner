# Location Inference Implementation Summary

## Overview

I've implemented a comprehensive location inference system that automatically determines candidate locations based on multiple signals from their GitHub profile and activity.

## Key Features

### 1. Location Inference Service (`/lib/location/location-inference.ts`)

The service analyzes multiple signals to infer location:

- **GitHub Profile Location**: Direct location from profile (highest confidence)
- **Company Mapping**: Maps known tech companies to their office locations
- **Bio Analysis**: Extracts location hints from bio text (e.g., "Based in Beijing", "Living in Shanghai")
- **Repository Analysis**: Checks repo names/descriptions for location indicators
- **Language Detection**: Detects Chinese, Japanese, Korean, etc. characters to infer regions
- **Timezone Inference**: Maps timezone abbreviations to regions

### 2. Database Schema Updates

Added three new fields to `GithubUser` table:
- `inferredLocation`: The inferred location string
- `locationConfidence`: Confidence score (0-1)
- `locationSignals`: JSON field storing the signals used for inference

### 3. Automatic Enrichment

Location inference happens automatically when:
- Fetching new GitHub users
- Updating existing users (with overwrite flag)
- User has no explicit location set

### 4. Enhanced Filtering

Both the candidates and ATS pages now filter by:
- Original GitHub profile location
- Inferred location
- Supports partial matching (e.g., "China" matches "Beijing, China")

### 5. UI Updates

- Shows inferred locations with "(inferred)" label
- Displays location with map pin icon in candidate tables
- Location filter input on both candidates and ATS pages

## How It Works

1. **Signal Collection**: When fetching a GitHub user, the system collects:
   - Profile location
   - Company from bio/socials
   - Repository names and descriptions
   - Bio text analysis
   - Language usage in repos

2. **Scoring Algorithm**: Each signal contributes a weighted score:
   - Explicit location: 1.0 (highest)
   - Bio mentions: 0.5
   - Company location: 0.3
   - Repository patterns: 0.2
   - Language indicators: 0.15

3. **Location Normalization**: 
   - Converts abbreviations (e.g., "CN" → "China", "SF" → "San Francisco")
   - Handles common aliases
   - Capitalizes properly

4. **Confidence Calculation**: Based on signal strength and consistency

## Examples of Inference

- User with "Tencent" in company → Infers "Shenzhen, China"
- Bio contains "基于北京" → Infers "Beijing, China"
- Repos named "shanghai-metro-app" → Infers "Shanghai, China"
- Multiple Chinese language repos → Infers "China"
- Bio says "Based in Bay Area" → Infers "San Francisco"

## Testing the Feature

1. **View Inferred Locations**:
   - Navigate to `/candidates` or `/ats`
   - Look for locations marked with "(inferred)"

2. **Filter by Location**:
   - Enter "China" in location filter to find all Chinese candidates
   - Try city names like "Beijing", "Shanghai", "Shenzhen"
   - Use "Remote" to find remote workers

3. **Refresh User Data**:
   - Use the GitHub sync tools to fetch/update users
   - The system will automatically infer locations for users without explicit locations

## Benefits

- **Better Coverage**: Many GitHub users don't fill in their location
- **Standardization**: Normalizes various location formats
- **Flexibility**: Supports filtering by country, city, or region
- **Transparency**: Shows confidence and marks inferred locations clearly

The system is designed to be extensible - you can easily add more companies, location patterns, or inference signals as needed.