# Social Media API Setup Guide

This guide will help you obtain and configure API keys for all supported social media platforms in TikTok Miner.

## Table of Contents
1. [Instagram Basic Display API](#instagram-basic-display-api)
2. [TikTok API for Developers](#tiktok-api-for-developers)
3. [Twitter API v2](#twitter-api-v2)
4. [YouTube Data API v3](#youtube-data-api-v3)
5. [LinkedIn API](#linkedin-api)
6. [Third-Party APIs](#third-party-apis)

## Prerequisites
- A registered business entity (required for some platforms)
- Valid website URL for your application
- Privacy policy and terms of service URLs

## Instagram Basic Display API

### Setup Steps:
1. **Create Facebook Developer Account**
   - Go to https://developers.facebook.com
   - Sign up or log in with Facebook account
   - Complete business verification if required

2. **Create an App**
   - Click "My Apps" → "Create App"
   - Choose "Consumer" type
   - Enter app details

3. **Add Instagram Basic Display**
   - In your app dashboard, click "Add Product"
   - Find "Instagram Basic Display" and click "Set Up"
   - Create a new Instagram App ID

4. **Configure OAuth Redirect URIs**
   ```
   https://yourdomain.com/api/auth/instagram/callback
   http://localhost:3000/api/auth/instagram/callback (for development)
   ```

5. **Get Credentials**
   - Instagram App ID → `INSTAGRAM_CLIENT_ID`
   - Instagram App Secret → `INSTAGRAM_CLIENT_SECRET`
   - Generate long-lived access token for testing

### Rate Limits:
- 200 requests per hour per user
- 60 requests per hour for /media endpoint

## TikTok API for Developers

### Setup Steps:
1. **Apply for Developer Account**
   - Visit https://developers.tiktok.com
   - Click "Register" and create account
   - Complete developer application (may take 1-5 days)

2. **Create an App**
   - Once approved, go to "My Apps"
   - Click "Create an app"
   - Select "Web" platform
   - Fill in app details

3. **Request API Access**
   - Navigate to "API Products"
   - Request access to:
     - User Info
     - Video List
     - Share
   - Provide detailed use case

4. **Configure Settings**
   - Add redirect URIs:
     ```
     https://yourdomain.com/api/auth/tiktok/callback
     http://localhost:3000/api/auth/tiktok/callback
     ```

5. **Get Credentials**
   - Client Key → `TIKTOK_CLIENT_ID`
   - Client Secret → `TIKTOK_CLIENT_SECRET`

### Rate Limits:
- Varies by endpoint (100-1000 requests/day)
- Video list: 100 requests/day

## Twitter API v2

### Setup Steps:
1. **Create Developer Account**
   - Go to https://developer.twitter.com
   - Apply for developer access
   - Select appropriate use case

2. **Create a Project and App**
   - In developer portal, create new project
   - Create app within project
   - Choose appropriate environment (Development/Production)

3. **Configure Authentication**
   - Set up OAuth 2.0 settings
   - Add callback URLs:
     ```
     https://yourdomain.com/api/auth/twitter/callback
     http://localhost:3000/api/auth/twitter/callback
     ```

4. **Get Credentials**
   - API Key → `TWITTER_API_KEY`
   - API Secret → `TWITTER_API_SECRET`
   - Bearer Token → `TWITTER_BEARER_TOKEN`

5. **Select Access Level**
   - Free: 1,500 tweets/month
   - Basic: $100/month - 10,000 tweets
   - Pro: $5,000/month - 1M tweets

### Rate Limits:
- User lookup: 300 requests/15min
- Tweets: 300 requests/15min
- Search: 180 requests/15min

## YouTube Data API v3

### Setup Steps:
1. **Create Google Cloud Project**
   - Go to https://console.cloud.google.com
   - Create new project or select existing
   - Enable billing (free tier available)

2. **Enable YouTube Data API**
   - In APIs & Services → Library
   - Search for "YouTube Data API v3"
   - Click "Enable"

3. **Create Credentials**
   - Go to APIs & Services → Credentials
   - Click "Create Credentials" → "API Key"
   - Restrict key to YouTube Data API v3

4. **Set Up OAuth 2.0 (Optional)**
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URIs:
     ```
     https://yourdomain.com/api/auth/youtube/callback
     http://localhost:3000/api/auth/youtube/callback
     ```

5. **Get Credentials**
   - API Key → `YOUTUBE_API_KEY`
   - Client ID → `YOUTUBE_CLIENT_ID`
   - Client Secret → `YOUTUBE_CLIENT_SECRET`

### Quotas:
- 10,000 units per day (free)
- Different actions cost different units:
  - Search: 100 units
  - Video details: 1 unit
  - Channel details: 1 unit

## LinkedIn API

### Official API (Limited):
1. **Create LinkedIn App**
   - Go to https://www.linkedin.com/developers/
   - Click "Create app"
   - Complete company verification

2. **Limited Access**
   - Marketing Developer Platform only
   - Requires LinkedIn Marketing Solutions partner status
   - Not suitable for individual creator data

### Alternative: Proxycurl API
1. **Sign Up**
   - Visit https://proxycurl.com
   - Create account
   - Add payment method

2. **Get API Key**
   - Dashboard → API Keys
   - Copy key → `PROXYCURL_API_KEY`

3. **Pricing**
   - $0.01 per profile lookup
   - Bulk discounts available

## Third-Party APIs

### RapidAPI Setup
1. **Create Account**
   - Visit https://rapidapi.com
   - Sign up for free account

2. **Subscribe to APIs**
   - Search for social media scrapers:
     - Instagram Scraper API
     - TikTok Scraper API
     - YouTube Data API
   - Subscribe to free or paid tiers

3. **Get API Key**
   - Dashboard → Security → API Keys
   - Copy key → `RAPIDAPI_KEY`

### Apify Setup
1. **Create Account**
   - Visit https://apify.com
   - Sign up for account

2. **Get API Token**
   - Settings → Integrations → API
   - Copy token → `APIFY_TOKEN`

3. **Install Actors**
   - Browse Apify Store
   - Install social media scrapers
   - Note actor IDs for configuration

## Environment Configuration

Update your `.env` file with obtained credentials:

```bash
# Official Platform APIs
INSTAGRAM_CLIENT_ID="your_instagram_app_id"
INSTAGRAM_CLIENT_SECRET="your_instagram_app_secret"
INSTAGRAM_ACCESS_TOKEN="your_long_lived_token"

TIKTOK_CLIENT_ID="your_tiktok_client_key"
TIKTOK_CLIENT_SECRET="your_tiktok_client_secret"

TWITTER_API_KEY="your_twitter_api_key"
TWITTER_API_SECRET="your_twitter_api_secret"
TWITTER_BEARER_TOKEN="your_twitter_bearer_token"

YOUTUBE_API_KEY="your_youtube_api_key"
YOUTUBE_CLIENT_ID="your_youtube_client_id"
YOUTUBE_CLIENT_SECRET="your_youtube_client_secret"

# Third-Party APIs
PROXYCURL_API_KEY="your_proxycurl_api_key"
RAPIDAPI_KEY="your_rapidapi_key"
APIFY_TOKEN="your_apify_token"

# Optional: Specific RapidAPI Services
INSTAGRAM_SCRAPER_API_KEY="your_instagram_scraper_key"
TIKTOK_SCRAPER_API_KEY="your_tiktok_scraper_key"
```

## API Key Security Best Practices

1. **Never commit API keys to version control**
   - Use `.env` files
   - Add `.env` to `.gitignore`

2. **Use environment-specific keys**
   - Separate development and production keys
   - Rotate keys regularly

3. **Implement rate limiting**
   - Use the built-in APIUsageTracker
   - Set up alerts for unusual activity

4. **Monitor usage**
   - Check `/api-monitoring` dashboard regularly
   - Set up cost alerts

5. **Restrict API key access**
   - Use IP allowlists where possible
   - Limit scope to required permissions only

## Testing Your Setup

Run the API validation script:

```bash
npm run validate-apis
```

This will test each configured API and report:
- ✅ Successfully configured APIs
- ❌ Missing or invalid credentials
- ⚠️ APIs with limited access

## Troubleshooting

### Instagram API Issues
- Ensure app is in Live mode
- Check OAuth redirect URIs match exactly
- Verify user has authorized required permissions

### TikTok API Issues
- Application approval can take several days
- Ensure use case aligns with TikTok's policies
- Check API product access is approved

### Twitter API Issues
- Verify correct API version (v2)
- Check rate limit tier matches usage
- Ensure bearer token is properly formatted

### YouTube API Issues
- Enable billing even for free tier
- Check daily quota hasn't been exceeded
- Verify API key restrictions

## Next Steps

1. Configure APIs based on your needs
2. Run validation script
3. Set up monitoring alerts
4. Test with sample creators
5. Monitor usage via dashboard

For support, check the platform-specific documentation or open an issue in the repository.