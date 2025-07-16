# Scripts Directory

Organized utility scripts for the TikTok Miner platform.

## Structure

- `data-migration/` - Database migration utilities
- `instagram/` - Instagram data scraping scripts
- `tiktok/` - TikTok data collection scripts
- `youtube/` - YouTube channel scraping scripts
- `sync-apify-pricing.ts` - Sync Apify pricing data
- `verify-creator-data.ts` - Data validation utility
- `fix-creator-engagement-metrics.ts` - Engagement metrics repair
- `setup-creator-database.sh` - Database setup script

## Usage

All scripts should be run from the app directory:

```bash
cd /home/azureuser/tiktok-miner/app
npm run ts-node scripts/[script-name].ts
```