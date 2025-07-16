import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

const PLATFORMS = ['youtube', 'twitter', 'instagram', 'tiktok', 'linkedin'];
const CATEGORIES = ['tech', 'lifestyle', 'gaming', 'fashion', 'fitness', 'food', 'travel', 'education', 'business', 'entertainment'];
const TAGS = ['influencer', 'micro-influencer', 'content-creator', 'thought-leader', 'brand-ambassador', 'verified', 'rising-star', 'established'];

interface SeedCreatorData {
  name: string;
  email: string;
  bio: string;
  category: string;
  tags: string[];
  platforms: {
    youtube?: { channelId: string; subscribers: number };
    twitter?: { username: string; followers: number };
    instagram?: { username: string; followers: number };
    tiktok?: { username: string; followers: number };
    linkedin?: { publicId: string; followers: number };
  };
}

// Generate realistic creator data
function generateCreatorData(index: number): SeedCreatorData {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const username = faker.internet.userName({ firstName, lastName }).toLowerCase();
  const category = faker.helpers.arrayElement(CATEGORIES);
  const tags = faker.helpers.arrayElements(TAGS, { min: 2, max: 4 });
  
  // Determine which platforms this creator is active on
  const activePlatforms = faker.helpers.arrayElements(PLATFORMS, { min: 2, max: 4 });
  const platforms: any = {};
  
  // Generate follower counts with some correlation (popular on one platform likely popular on others)
  const popularityFactor = faker.number.float({ min: 0.1, max: 10 });
  
  if (activePlatforms.includes('youtube')) {
    platforms.youtube = {
      channelId: `UC${faker.string.alphanumeric(22)}`,
      subscribers: Math.floor(faker.number.int({ min: 1000, max: 100000 }) * popularityFactor)
    };
  }
  
  if (activePlatforms.includes('twitter')) {
    platforms.twitter = {
      username: username,
      followers: Math.floor(faker.number.int({ min: 500, max: 50000 }) * popularityFactor)
    };
  }
  
  if (activePlatforms.includes('instagram')) {
    platforms.instagram = {
      username: username,
      followers: Math.floor(faker.number.int({ min: 1000, max: 80000 }) * popularityFactor)
    };
  }
  
  if (activePlatforms.includes('tiktok')) {
    platforms.tiktok = {
      username: username,
      followers: Math.floor(faker.number.int({ min: 2000, max: 150000 }) * popularityFactor)
    };
  }
  
  if (activePlatforms.includes('linkedin')) {
    platforms.linkedin = {
      publicId: `${firstName}-${lastName}-${faker.string.alphanumeric(8)}`.toLowerCase(),
      followers: Math.floor(faker.number.int({ min: 200, max: 20000 }) * popularityFactor)
    };
  }
  
  return {
    name: `${firstName} ${lastName}`,
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    bio: faker.lorem.paragraph(3),
    category,
    tags,
    platforms
  };
}

// Generate platform metrics
function generatePlatformMetrics(followerCount: number, platform: string) {
  // Engagement rates vary by platform
  const engagementRanges = {
    youtube: { min: 0.02, max: 0.08 },
    twitter: { min: 0.01, max: 0.05 },
    instagram: { min: 0.03, max: 0.10 },
    tiktok: { min: 0.05, max: 0.15 },
    linkedin: { min: 0.02, max: 0.06 }
  };
  
  const range = engagementRanges[platform as keyof typeof engagementRanges] || { min: 0.01, max: 0.05 };
  const engagementRate = faker.number.float({ min: range.min, max: range.max });
  
  // Calculate other metrics based on followers and engagement
  const avgEngagement = Math.floor(followerCount * engagementRate);
  
  return {
    engagementRate: engagementRate * 100, // Convert to percentage
    avgLikes: Math.floor(avgEngagement * 0.7),
    avgComments: Math.floor(avgEngagement * 0.2),
    avgShares: Math.floor(avgEngagement * 0.1),
    avgViews: Math.floor(avgEngagement * faker.number.float({ min: 10, max: 50 }))
  };
}

async function seedCreators() {
  console.log('🌱 Starting creator seed...');
  
  try {
    // Clean existing data
    await prisma.creatorMetricsHistory.deleteMany();
    await prisma.engagementAnalytics.deleteMany();
    await prisma.youtubeMetrics.deleteMany();
    await prisma.twitterMetrics.deleteMany();
    await prisma.instagramMetrics.deleteMany();
    await prisma.tiktokMetrics.deleteMany();
    await prisma.linkedinMetrics.deleteMany();
    await prisma.creatorProfile.deleteMany();
    await prisma.candidate.deleteMany({ where: { candidateType: 'CREATOR' } });
    
    console.log('✅ Cleaned existing creator data');
    
    // Create sample creators
    const NUM_CREATORS = 50;
    const createdCreators = [];
    
    for (let i = 0; i < NUM_CREATORS; i++) {
      const creatorData = generateCreatorData(i);
      
      // Create candidate
      const candidate = await prisma.candidate.create({
        data: {
          candidateType: 'CREATOR',
          status: faker.helpers.arrayElement(['new', 'contacted', 'responded', 'in_progress']),
          matchScore: faker.number.float({ min: 0.5, max: 1.0 })
        }
      });
      
      // Build platform identifiers
      const platformIdentifiers: any = {};
      if (creatorData.platforms.youtube) {
        platformIdentifiers.youtube_channel_id = creatorData.platforms.youtube.channelId;
      }
      if (creatorData.platforms.twitter) {
        platformIdentifiers.twitter_handle = creatorData.platforms.twitter.username;
      }
      if (creatorData.platforms.instagram) {
        platformIdentifiers.instagram_username = creatorData.platforms.instagram.username;
      }
      if (creatorData.platforms.tiktok) {
        platformIdentifiers.tiktok_username = creatorData.platforms.tiktok.username;
      }
      if (creatorData.platforms.linkedin) {
        platformIdentifiers.linkedin_url = `https://linkedin.com/in/${creatorData.platforms.linkedin.publicId}`;
      }
      
      // Create creator profile
      const creatorProfile = await prisma.creatorProfile.create({
        data: {
          candidateId: candidate.id,
          name: creatorData.name,
          email: creatorData.email,
          bio: creatorData.bio,
          profileImageUrl: faker.image.avatar(),
          category: creatorData.category,
          tags: creatorData.tags,
          isVerified: faker.datatype.boolean({ probability: 0.2 }),
          platformIdentifiers,
          audienceQualityScore: faker.number.float({ min: 60, max: 98 }),
          contentFrequency: faker.number.float({ min: 0.5, max: 7 }), // posts per week
          syncStatus: 'COMPLETED'
        }
      });
      
      // Create platform-specific metrics
      if (creatorData.platforms.youtube) {
        const metrics = generatePlatformMetrics(creatorData.platforms.youtube.subscribers, 'youtube');
        await prisma.youtubeMetrics.create({
          data: {
            creatorProfileId: creatorProfile.id,
            channelId: creatorData.platforms.youtube.channelId,
            channelName: `${creatorData.name} Channel`,
            channelUrl: `https://youtube.com/channel/${creatorData.platforms.youtube.channelId}`,
            subscriberCount: creatorData.platforms.youtube.subscribers,
            videoCount: faker.number.int({ min: 50, max: 500 }),
            viewCount: BigInt(creatorData.platforms.youtube.subscribers * faker.number.int({ min: 100, max: 1000 })),
            ...metrics,
            description: faker.lorem.paragraph(),
            country: faker.location.countryCode(),
            publishedAt: faker.date.past({ years: 5 })
          }
        });
      }
      
      if (creatorData.platforms.twitter) {
        const metrics = generatePlatformMetrics(creatorData.platforms.twitter.followers, 'twitter');
        await prisma.twitterMetrics.create({
          data: {
            creatorProfileId: creatorProfile.id,
            userId: faker.string.numeric(18),
            username: creatorData.platforms.twitter.username,
            displayName: creatorData.name,
            profileUrl: `https://twitter.com/${creatorData.platforms.twitter.username}`,
            followerCount: creatorData.platforms.twitter.followers,
            followingCount: faker.number.int({ min: 100, max: 5000 }),
            tweetCount: faker.number.int({ min: 500, max: 10000 }),
            listedCount: faker.number.int({ min: 0, max: 100 }),
            ...metrics,
            bio: faker.lorem.sentence(),
            location: faker.location.city(),
            isVerified: faker.datatype.boolean({ probability: 0.1 }),
            joinedAt: faker.date.past({ years: 8 })
          }
        });
      }
      
      if (creatorData.platforms.instagram) {
        const metrics = generatePlatformMetrics(creatorData.platforms.instagram.followers, 'instagram');
        await prisma.instagramMetrics.create({
          data: {
            creatorProfileId: creatorProfile.id,
            accountId: faker.string.numeric(10),
            username: creatorData.platforms.instagram.username,
            fullName: creatorData.name,
            profileUrl: `https://instagram.com/${creatorData.platforms.instagram.username}`,
            followerCount: creatorData.platforms.instagram.followers,
            followingCount: faker.number.int({ min: 100, max: 2000 }),
            mediaCount: faker.number.int({ min: 50, max: 1000 }),
            ...metrics,
            bio: faker.lorem.sentence(),
            isVerified: faker.datatype.boolean({ probability: 0.15 }),
            isBusinessAccount: faker.datatype.boolean({ probability: 0.7 }),
            businessCategory: creatorData.category
          }
        });
      }
      
      if (creatorData.platforms.tiktok) {
        const metrics = generatePlatformMetrics(creatorData.platforms.tiktok.followers, 'tiktok');
        await prisma.tiktokMetrics.create({
          data: {
            creatorProfileId: creatorProfile.id,
            userId: faker.string.numeric(10),
            username: creatorData.platforms.tiktok.username,
            nickname: creatorData.name,
            profileUrl: `https://tiktok.com/@${creatorData.platforms.tiktok.username}`,
            followerCount: creatorData.platforms.tiktok.followers,
            followingCount: faker.number.int({ min: 50, max: 1000 }),
            videoCount: faker.number.int({ min: 20, max: 500 }),
            heartCount: BigInt(creatorData.platforms.tiktok.followers * faker.number.int({ min: 50, max: 500 })),
            ...metrics,
            bio: faker.lorem.sentence(),
            isVerified: faker.datatype.boolean({ probability: 0.1 }),
            totalViews: BigInt(creatorData.platforms.tiktok.followers * faker.number.int({ min: 100, max: 2000 }))
          }
        });
      }
      
      if (creatorData.platforms.linkedin) {
        const metrics = generatePlatformMetrics(creatorData.platforms.linkedin.followers, 'linkedin');
        await prisma.linkedinMetrics.create({
          data: {
            creatorProfileId: creatorProfile.id,
            profileId: faker.string.uuid(),
            publicId: creatorData.platforms.linkedin.publicId,
            fullName: creatorData.name,
            headline: faker.person.jobTitle(),
            profileUrl: `https://linkedin.com/in/${creatorData.platforms.linkedin.publicId}`,
            followerCount: creatorData.platforms.linkedin.followers,
            connectionCount: faker.number.int({ min: 200, max: 5000 }),
            postCount: faker.number.int({ min: 10, max: 200 }),
            ...metrics,
            summary: faker.lorem.paragraph(),
            location: faker.location.city(),
            industry: faker.helpers.arrayElement(['Technology', 'Marketing', 'Finance', 'Healthcare', 'Education'])
          }
        });
      }
      
      // Generate historical metrics for trending analysis
      const platforms = Object.keys(creatorData.platforms);
      for (const platform of platforms) {
        const followerCount = creatorData.platforms[platform as keyof typeof creatorData.platforms]?.followers || 0;
        
        // Generate 30 days of historical data
        for (let day = 30; day >= 0; day--) {
          const date = new Date();
          date.setDate(date.getDate() - day);
          
          // Simulate growth/decline
          const growthFactor = 1 + (faker.number.float({ min: -0.01, max: 0.02 }) * (30 - day) / 30);
          const historicalFollowers = Math.floor(followerCount / growthFactor);
          const metrics = generatePlatformMetrics(historicalFollowers, platform);
          
          await prisma.creatorMetricsHistory.create({
            data: {
              creatorProfileId: creatorProfile.id,
              platform,
              timestamp: date,
              followerCount: historicalFollowers,
              ...metrics,
              totalPosts: faker.number.int({ min: 10, max: 200 }),
              followerGrowth: day === 30 ? 0 : faker.number.int({ min: -100, max: 500 }),
              engagementGrowth: day === 30 ? 0 : faker.number.float({ min: -0.5, max: 0.5 })
            }
          });
        }
      }
      
      createdCreators.push({ candidate, creatorProfile });
      
      if ((i + 1) % 10 === 0) {
        console.log(`✅ Created ${i + 1}/${NUM_CREATORS} creators`);
      }
    }
    
    console.log(`🎉 Successfully seeded ${NUM_CREATORS} creators with metrics!`);
    
    // Log some statistics
    const totalCreators = await prisma.creatorProfile.count();
    const platformCounts = {
      youtube: await prisma.youtubeMetrics.count(),
      twitter: await prisma.twitterMetrics.count(),
      instagram: await prisma.instagramMetrics.count(),
      tiktok: await prisma.tiktokMetrics.count(),
      linkedin: await prisma.linkedinMetrics.count()
    };
    
    console.log('\n📊 Seed Statistics:');
    console.log(`Total Creators: ${totalCreators}`);
    console.log('Platform Distribution:');
    Object.entries(platformCounts).forEach(([platform, count]) => {
      console.log(`  ${platform}: ${count} creators`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding creators:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed
seedCreators()
  .catch(error => {
    console.error(error);
    process.exit(1);
  });