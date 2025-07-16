import { PrismaClient } from '@prisma/client';

// Create a fresh Prisma client instance
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function saveMissingProfiles() {
  console.log('📊 Saving missing TikTok profiles...\n');
  
  // The two profiles that failed
  const missingProfiles = [
    {
      username: "managementconsulted",
      nickname: "Management Consulted",
      bio: "Resources to help you break into consulting ⬇️",
      followers: 34600,
      following: 20,
      hearts: 154600,
      videoCount: 862,
      verified: false,
      avatar: "https://p16-pu-sign-useast8.tiktokcdn-us.com/tos-useast8-avt-0068-tx2/a59c020bb26aaf866934f58d7819c67a~tplv-tiktokx-cropcenter:720:720.jpeg",
      scrapedAt: new Date().toISOString()
    },
    {
      username: "stephaniedchen",
      nickname: "Stephanie Chen",
      bio: "post-grad in NYC\nIG: @stephaniedchen \n📧 stephaniechencollabs@gmail.com",
      followers: 30800,
      following: 1091,
      hearts: 9100000,
      videoCount: 679,
      verified: false,
      avatar: "https://p16-pu-sign-useast8.tiktokcdn-us.com/tos-useast5-avt-0068-tx/d1ca6bbc2819d0a81dae70f645f5ef2f~tplv-tiktokx-cropcenter:720:720.jpeg",
      scrapedAt: new Date().toISOString()
    }
  ];
  
  let savedCount = 0;
  let errorCount = 0;
  
  for (const profile of missingProfiles) {
    try {
      // Check if already exists
      const existing = await prisma.creatorProfile.findFirst({
        where: {
          OR: [
            { name: profile.nickname },
            { name: profile.username }
          ],
          category: 'tiktok'
        }
      });
      
      if (existing) {
        console.log(`⏭️  Skipping @${profile.username} - already exists`);
        continue;
      }
      
      // Create candidate first
      const candidate = await prisma.candidate.create({
        data: {
          candidateType: 'CREATOR',
          status: 'new',
          notes: `TikTok creator: @${profile.username}`,
        }
      });
      
      // Create the creator profile
      await prisma.creatorProfile.create({
        data: {
          candidateId: candidate.id,
          name: profile.nickname || profile.username,
          bio: profile.bio || '',
          category: 'tiktok',
          totalReach: profile.followers,
          platformIdentifiers: {
            tiktok: profile.username
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
      
    } catch (error: any) {
      console.error(`❌ Error saving @${profile.username}:`, error.message);
      errorCount++;
    }
  }
  
  console.log('\n📈 Summary:');
  console.log(`   Successfully saved: ${savedCount}`);
  console.log(`   Errors: ${errorCount}`);
}

// Helper function to extract tags from bio
function extractTags(bio: string): string[] {
  const tags = [];
  
  // Common keywords in recruiting/career space
  const keywords = ['recruiter', 'career', 'coach', 'AI', 'tech', 'hiring', 'talent', 'HR', 'jobs', 'consulting'];
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
saveMissingProfiles()
  .then(() => {
    console.log('\n✅ Import completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });