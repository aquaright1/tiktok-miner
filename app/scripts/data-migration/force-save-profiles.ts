import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function forceSaveProfiles() {
  console.log('📊 Force saving missing TikTok profiles...\n');
  
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
    }
  ];
  
  let savedCount = 0;
  let errorCount = 0;
  
  // Use a transaction to ensure both operations succeed or fail together
  for (const profile of missingProfiles) {
    try {
      await prisma.$transaction(async (tx) => {
        // Create candidate
        const candidate = await tx.candidate.create({
          data: {
            candidateType: 'CREATOR',
            status: 'new',
            notes: `TikTok creator: @${profile.username}`,
          }
        });
        
        // Create creator profile
        await tx.creatorProfile.create({
          data: {
            candidateId: candidate.id,
            name: profile.nickname,
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
            lastSync: new Date(),
            syncStatus: 'COMPLETED'
          }
        });
      });
      
      console.log(`✅ Saved @${profile.username} (${profile.followers.toLocaleString()} followers)`);
      savedCount++;
      
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`⏭️  Skipping @${profile.username} - already exists`);
      } else {
        console.error(`❌ Error saving @${profile.username}:`, error.message);
        errorCount++;
      }
    }
  }
  
  console.log('\n📈 Summary:');
  console.log(`   Successfully saved: ${savedCount}`);
  console.log(`   Errors: ${errorCount}`);
  
  await prisma.$disconnect();
}

function extractTags(bio: string): string[] {
  const tags = [];
  const keywords = ['recruiter', 'career', 'coach', 'AI', 'tech', 'hiring', 'talent', 'HR', 'jobs', 'consulting'];
  const lowerBio = bio.toLowerCase();
  
  keywords.forEach(keyword => {
    if (lowerBio.includes(keyword.toLowerCase())) {
      tags.push(keyword);
    }
  });
  
  return [...new Set(tags)];
}

// Run it
forceSaveProfiles()
  .then(() => {
    console.log('\n✅ Completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });