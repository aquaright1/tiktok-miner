import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

// Use connection string that avoids prepared statement issues
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['error'], // Only log errors to reduce noise
});

async function saveTikTokProfilesToSupabase() {
  console.log('📊 Loading TikTok profiles from file...\n');
  
  try {
    // Read the scraped data
    const data = JSON.parse(readFileSync('/home/azureuser/tiktok-miner/app/scripts/misc/tiktok-scraped-profiles-2025-07-09.json', 'utf-8'));
    const profiles = data.profiles;
    
    console.log(`Found ${profiles.length} profiles to save\n`);
    
    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Filter profiles with at least 1000 followers for quality
    const qualityProfiles = profiles.filter(p => p.followers >= 1000);
    console.log(`Filtering to ${qualityProfiles.length} profiles with 1000+ followers\n`);
    
    for (const profile of qualityProfiles) {
      try {
        // Check if profile already exists using a simpler query
        const existing = await prisma.creatorProfile.findFirst({
          where: {
            name: profile.nickname || profile.username,
            category: 'tiktok'
          }
        });
        
        if (existing) {
          console.log(`⏭️  Skipping @${profile.username} - already exists`);
          skippedCount++;
          continue;
        }
        
        // Create the creator profile
        const creatorProfile = await prisma.creatorProfile.create({
          data: {
            name: profile.nickname || profile.username,
            bio: profile.bio || '',
            profileImageUrl: profile.avatar || null,
            category: 'tiktok',
            totalReach: profile.followers,
            platformIdentifiers: {
              tiktok: {
                id: profile.id || '',
                username: profile.username,
                nickname: profile.nickname,
                bio: profile.bio || '',
                avatar: profile.avatar || '',
                verified: profile.verified || false,
                profileUrl: `https://www.tiktok.com/@${profile.username}`,
                totalHearts: profile.hearts || 0,
                totalVideos: profile.videoCount || 0,
                followingCount: profile.following || 0,
                engagementMetrics: profile.engagementMetrics || {}
              }
            },
            compositeEngagementScore: profile.hearts && profile.videoCount > 0 
              ? Math.min((profile.hearts / (profile.followers * profile.videoCount)) * 10, 100)
              : 0,
            averageEngagementRate: profile.hearts && profile.videoCount > 0 
              ? (profile.hearts / (profile.followers * profile.videoCount) * 100) 
              : 0,
            tags: extractTags(profile.bio || ''),
            isVerified: profile.verified || false,
            lastSync: new Date(profile.scrapedAt),
            syncStatus: 'COMPLETED'
          }
        });
        
        console.log(`✅ Saved @${profile.username} (${profile.followers.toLocaleString()} followers)`);
        savedCount++;
        
      } catch (error) {
        console.error(`❌ Error saving @${profile.username}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📈 Summary:');
    console.log(`   Total profiles processed: ${qualityProfiles.length}`);
    console.log(`   Successfully saved: ${savedCount}`);
    console.log(`   Skipped (already exists): ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);
    
    // Show top 5 saved profiles
    if (savedCount > 0) {
      console.log('\n🌟 Top saved profiles by followers:');
      const topProfiles = await prisma.creatorProfile.findMany({
        where: {
          category: 'tiktok',
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
          }
        },
        orderBy: {
          totalReach: 'desc'
        },
        take: 5
      });
      
      topProfiles.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} - ${p.totalReach.toLocaleString()} followers`);
      });
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to extract tags from bio
function extractTags(bio: string): string[] {
  const tags = [];
  
  // Common keywords in recruiting/career space
  const keywords = ['recruiter', 'career', 'coach', 'AI', 'tech', 'hiring', 'talent', 'HR', 'jobs'];
  const lowerBio = bio.toLowerCase();
  
  keywords.forEach(keyword => {
    if (lowerBio.includes(keyword.toLowerCase())) {
      tags.push(keyword);
    }
  });
  
  // Extract hashtags
  const hashtags = bio.match(/#\w+/g) || [];
  hashtags.forEach(tag => {
    tags.push(tag.replace('#', ''));
  });
  
  return [...new Set(tags)]; // Remove duplicates
}

// Run the import
saveTikTokProfilesToSupabase()
  .then(() => {
    console.log('\n✅ Import completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });