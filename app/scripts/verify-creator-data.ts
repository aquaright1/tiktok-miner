import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nfdqhheortctkyqqmjfe.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mZHFoaGVvcnRjdGt5cXFtamZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMDI0NzQsImV4cCI6MjA2NzU3ODQ3NH0.rPxfe1-IvGWRP0XieHiKC8P2pUFIj7ohPABGo8gTSmU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyCreatorData() {
  console.log('📊 Verifying creator data in database...\n');
  
  try {
    // Get a few creators to check their data
    const { data: creators, error } = await supabase
      .from('CreatorProfile')
      .select('*')
      .eq('category', 'tiktok')
      .order('totalReach', { ascending: false })
      .limit(5);
      
    if (error) {
      console.error('Error fetching creators:', error);
      return;
    }
    
    console.log(`Found ${creators?.length || 0} creators\n`);
    
    creators?.forEach((creator, index) => {
      console.log(`\n${index + 1}. ${creator.name}`);
      console.log(`   Total Reach: ${creator.totalReach?.toLocaleString() || 0}`);
      
      const tiktokData = creator.platformIdentifiers?.tiktok;
      if (tiktokData) {
        console.log(`   TikTok Username: @${tiktokData.username}`);
        console.log(`   Total Hearts: ${tiktokData.totalHearts?.toLocaleString() || 0}`);
        console.log(`   Total Videos: ${tiktokData.totalVideos || 0}`);
        console.log(`   Following Count: ${tiktokData.followingCount || 0}`);
        
        // Calculate avg likes per video
        const avgLikes = tiktokData.totalVideos > 0 
          ? Math.round(tiktokData.totalHearts / tiktokData.totalVideos)
          : 0;
        console.log(`   Avg Likes/Video: ${avgLikes.toLocaleString()}`);
      } else {
        console.log('   ❌ No TikTok data found');
      }
      
      console.log(`   Raw platformIdentifiers:`, JSON.stringify(creator.platformIdentifiers, null, 2));
    });
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run verification
verifyCreatorData()
  .then(() => {
    console.log('\n✅ Verification completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });