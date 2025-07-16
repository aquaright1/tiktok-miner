#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTikTokProfiles() {
  try {
    console.log('🔍 Checking TikTok profiles in database...\n');
    
    // Get total count
    const count = await prisma.tiktokProfile.count();
    console.log(`📊 Total TikTok profiles: ${count}\n`);
    
    if (count > 0) {
      // Get recent profiles
      const profiles = await prisma.tiktokProfile.findMany({
        take: 10,
        orderBy: {
          lastUpdated: 'desc'
        },
        select: {
          username: true,
          nickName: true,
          followerCount: true,
          posts30d: true,
          likesTotal: true,
          commentsTotal: true,
          viewsTotal: true,
          engagementRate: true,
          lastUpdated: true
        }
      });
      
      console.log('📋 Recent TikTok profiles:');
      console.log('='.repeat(80));
      
      profiles.forEach((profile, i) => {
        console.log(`${i + 1}. @${profile.username} (${profile.nickName})`);
        console.log(`   Followers: ${profile.followerCount?.toLocaleString() || 0}`);
        console.log(`   Posts (30d): ${profile.posts30d || 0}`);
        console.log(`   Likes: ${profile.likesTotal?.toLocaleString() || 0}`);
        console.log(`   Views: ${profile.viewsTotal?.toString() || 0}`);
        console.log(`   Engagement Rate: ${profile.engagementRate?.toFixed(2) || 0}%`);
        console.log(`   Last Updated: ${profile.lastUpdated}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No TikTok profiles found in database');
    }
    
  } catch (error) {
    console.error('❌ Error checking profiles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTikTokProfiles();