import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProfiles() {
  try {
    // Count total creator profiles
    const totalCount = await prisma.creatorProfile.count();
    console.log(`Total CreatorProfiles in database: ${totalCount}`);
    
    // Check for specific profiles
    const names = ['Management Consulted', 'Stephanie Chen', 'managementconsulted', 'stephaniedchen'];
    
    for (const name of names) {
      const profile = await prisma.creatorProfile.findFirst({
        where: {
          OR: [
            { name: { contains: name, mode: 'insensitive' } },
            { 
              platformIdentifiers: {
                path: ['tiktok'],
                string_contains: name.toLowerCase()
              }
            }
          ]
        }
      });
      
      if (profile) {
        console.log(`Found profile: ${profile.name} (ID: ${profile.id})`);
      } else {
        console.log(`Not found: ${name}`);
      }
    }
    
    // List first 5 TikTok profiles
    console.log('\nFirst 5 TikTok profiles:');
    const tiktokProfiles = await prisma.creatorProfile.findMany({
      where: { category: 'tiktok' },
      take: 5,
      orderBy: { totalReach: 'desc' }
    });
    
    tiktokProfiles.forEach(p => {
      console.log(`- ${p.name}: ${p.totalReach} followers`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProfiles();