require('dotenv').config();

const { ApifyClient } = require('apify-client');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const client = new ApifyClient({
  token: process.env.APIFY_API_KEY
});

// Process reducer logic inline
async function processDataset(datasetId) {
  const dataset = await client.dataset(datasetId);
  const { items } = await dataset.listItems({ limit: 1000 });
  
  const profileMap = new Map();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  let postsWithin30Days = 0;
  
  for (const post of items) {
    const username = post.ownerUsername;
    if (!username) continue;
    
    const postDate = new Date(post.timestamp);
    if (postDate < thirtyDaysAgo) continue;
    
    postsWithin30Days++;
    
    const current = profileMap.get(username) || {
      posts: 0,
      likes: 0,
      comments: 0,
      views: 0
    };
    
    current.posts += 1;
    current.likes += post.likesCount || 0;
    current.comments += post.commentsCount || 0;
    current.views += post.videoPlayCount || post.videoViewCount || 0;
    
    profileMap.set(username, current);
  }
  
  console.log(`  📊 Found ${postsWithin30Days} posts within 30 days for ${profileMap.size} profiles`);
  
  // Update database
  let updatedCount = 0;
  for (const [username, metrics] of profileMap.entries()) {
    const posts = metrics.posts || 1;
    const likes_avg = +(metrics.likes / posts).toFixed(1);
    const comments_avg = +(metrics.comments / posts).toFixed(1);
    const views_avg = +(metrics.views / posts).toFixed(1);
    const engagement_rate = +((metrics.likes + metrics.comments) / posts).toFixed(2);
    
    try {
      await prisma.$executeRaw`
        INSERT INTO instagram_profiles
               (username, "posts30d", "likesTotal", "commentsTotal", "viewsTotal", "shares_total",
                "avgLikesPerPost", "avgCommentsPerPost", "avgViewsPerPost", "engagementRate", "lastUpdated")
        VALUES (${username}, ${metrics.posts}, ${metrics.likes}, 
                ${metrics.comments}, ${metrics.views}, 0,
                ${likes_avg}, ${comments_avg}, ${views_avg},
                ${engagement_rate}, CURRENT_TIMESTAMP)
        ON CONFLICT (username) DO UPDATE SET
               "posts30d"       = EXCLUDED."posts30d",
               "likesTotal"     = EXCLUDED."likesTotal",
               "commentsTotal"  = EXCLUDED."commentsTotal",
               "viewsTotal"     = EXCLUDED."viewsTotal",
               "shares_total"   = EXCLUDED."shares_total",
               "avgLikesPerPost" = EXCLUDED."avgLikesPerPost",
               "avgCommentsPerPost" = EXCLUDED."avgCommentsPerPost",
               "avgViewsPerPost" = EXCLUDED."avgViewsPerPost",
               "engagementRate" = EXCLUDED."engagementRate",
               "lastUpdated"    = CURRENT_TIMESTAMP
      `;
      console.log(`    ✅ Updated @${username}: ${metrics.posts} posts, ${metrics.views} views`);
      updatedCount++;
    } catch (error) {
      console.error(`    ❌ Failed to update @${username}:`, error.message);
    }
  }
  
  return updatedCount;
}

// Missing profiles to process
const missingProfiles = [
  'lovelylovelyliz', 'carly.mazz', 'selmaunq', 'beebsbagels',
  'hellotefi', 'kayleefrye09', 'janemadeee', 'simpmom',
  'aislingmarron', 'jasleen.m.10', 'tiffanyg0es', '_deannagemmell',
  'soogia1', 'lelebugg_', 'paigenugent_', 'zivadavid',
  'peachesandpaolo', 'anorexiacult', 'tashpolk', 'realashleighbanfield',
  'justcallmekoko', 'danahasson', 'ryleeradke', 'thebakingtherapist',
  'erin_evelyn', 'liz_hee', 'puttingdownfeelings', 'mimimwest',
  'haydstragedy', 'cloverandmike', 'peachypoppy', 'drstaceynd',
  'yay4tay', 'kelseylockhart', 'jennyappless'
];

async function main() {
  console.log(`🚀 Processing ${missingProfiles.length} missing Instagram profiles\n`);
  
  const batchSize = 5; // Increased batch size
  const delayBetweenBatches = 60000; // 60 seconds
  let totalUpdated = 0;
  
  for (let i = 0; i < missingProfiles.length; i += batchSize) {
    const batch = missingProfiles.slice(i, i + batchSize);
    console.log(`📦 Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(missingProfiles.length/batchSize)}: ${batch.join(', ')}`);
    
    try {
      // Run scraper
      const run = await client.actor('apify/instagram-scraper').call({
        directUrls: batch.map(h => `https://www.instagram.com/${h}/`),
        resultsType: 'posts',
        resultsLimit: 200,
        skipPinnedPosts: true,
        addParentData: true,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      });
      
      console.log(`  ✅ Scraping complete! Dataset: ${run.defaultDatasetId}`);
      
      // Process immediately without long wait
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const updated = await processDataset(run.defaultDatasetId);
      totalUpdated += updated;
      
    } catch (error) {
      console.error(`  ❌ Error:`, error.message);
    }
    
    // Wait before next batch
    if (i + batchSize < missingProfiles.length) {
      console.log(`  ⏳ Waiting ${delayBetweenBatches/1000}s...\n`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  console.log(`\n✅ Total profiles updated: ${totalUpdated}`);
  
  // Final check
  const found = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM instagram_profiles 
    WHERE username = ANY(${missingProfiles})
  `;
  
  console.log(`📊 Final count: ${found[0].count}/${missingProfiles.length} profiles in database`);
  
  await prisma.$disconnect();
}

main().catch(console.error);