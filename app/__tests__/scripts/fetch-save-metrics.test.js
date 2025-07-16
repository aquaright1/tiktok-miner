#!/usr/bin/env node

/**
 * Unit test for verifying 30-day metrics collection in fetch-and-save-apify-run.js
 */

const assert = require('assert');

// Mock fetch
global.fetch = jest.fn();

// Mock pg
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  
  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn(),
  };
  
  return {
    Pool: jest.fn().mockImplementation(() => mockPool),
  };
});

describe('fetch-and-save-apify-run.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should correctly aggregate 30-day metrics from video data', async () => {
    // Mock Apify response with correct data structure
    const mockVideos = [
      {
        authorMeta: {
          name: 'testuser',
          nickName: 'Test User',
          fans: 10000,
          following: 100,
          video: 50,
          heart: 100000,
          verified: true,
          signature: 'Test bio',
          avatar: 'https://example.com/avatar.jpg'
        },
        diggCount: 1000,      // likes at top level
        commentCount: 50,     // comments at top level
        playCount: 10000,     // views at top level
        shareCount: 100,      // shares at top level
        createTime: Math.floor(Date.now() / 1000) - (5 * 24 * 60 * 60), // 5 days ago
        createTimeISO: new Date(Date.now() - (5 * 24 * 60 * 60 * 1000)).toISOString()
      },
      {
        authorMeta: {
          name: 'testuser',
        },
        diggCount: 2000,
        commentCount: 100,
        playCount: 20000,
        shareCount: 200,
        createTime: Math.floor(Date.now() / 1000) - (10 * 24 * 60 * 60), // 10 days ago
        createTimeISO: new Date(Date.now() - (10 * 24 * 60 * 60 * 1000)).toISOString()
      },
      {
        authorMeta: {
          name: 'testuser',
        },
        diggCount: 1500,
        commentCount: 75,
        playCount: 15000,
        shareCount: 150,
        createTime: Math.floor(Date.now() / 1000) - (40 * 24 * 60 * 60), // 40 days ago (outside 30d window)
        createTimeISO: new Date(Date.now() - (40 * 24 * 60 * 60 * 1000)).toISOString()
      }
    ];
    
    // Load the aggregation function
    const { aggregateProfileData } = require('../../scripts/fetch-and-save-apify-run.js');
    
    // Run aggregation
    const profiles = await aggregateProfileData(mockVideos);
    
    // Verify results
    assert.strictEqual(profiles.length, 1, 'Should aggregate to 1 profile');
    
    const profile = profiles[0];
    
    // Check basic profile info
    assert.strictEqual(profile.username, 'testuser');
    assert.strictEqual(profile.fullName, 'Test User');
    assert.strictEqual(profile.verified, true);
    assert.strictEqual(profile.followerCount, 10000);
    
    // Check 30-day metrics (should include all 3 videos)
    assert.strictEqual(profile.viewsTotal, 45000, 'Total views should be 10000 + 20000 + 15000');
    assert.strictEqual(profile.likesTotal, 4500, 'Total likes should be 1000 + 2000 + 1500');
    assert.strictEqual(profile.commentsTotal, 225, 'Total comments should be 50 + 100 + 75');
    assert.strictEqual(profile.sharesTotal, 450, 'Total shares should be 100 + 200 + 150');
    
    // Check 30-day posts count (only videos within 30 days)
    assert.strictEqual(profile.posts30d, 2, 'Should only count videos from last 30 days');
    
    // Check engagement rate calculation
    const expectedEngagement = ((4500 + 225 + 450) / 45000) * 100;
    assert.strictEqual(
      profile.engagementRate.toFixed(2), 
      expectedEngagement.toFixed(2),
      'Engagement rate should be calculated correctly'
    );
    
    console.log('✅ All 30-day metrics tests passed!');
    console.log(`  - Views: ${profile.viewsTotal}`);
    console.log(`  - Likes: ${profile.likesTotal}`);
    console.log(`  - Comments: ${profile.commentsTotal}`);
    console.log(`  - Shares: ${profile.sharesTotal}`);
    console.log(`  - 30-day posts: ${profile.posts30d}`);
    console.log(`  - Engagement rate: ${profile.engagementRate.toFixed(2)}%`);
  });
  
  test('should handle missing video metrics gracefully', async () => {
    const mockVideos = [
      {
        authorMeta: {
          name: 'testuser2',
          fans: 5000
        },
        // Missing some metrics
        diggCount: 100,
        // commentCount missing
        playCount: 1000,
        // shareCount missing
        createTime: Math.floor(Date.now() / 1000)
      }
    ];
    
    const { aggregateProfileData } = require('../../scripts/fetch-and-save-apify-run.js');
    const profiles = await aggregateProfileData(mockVideos);
    
    const profile = profiles[0];
    
    // Should use 0 for missing values
    assert.strictEqual(profile.viewsTotal, 1000);
    assert.strictEqual(profile.likesTotal, 100);
    assert.strictEqual(profile.commentsTotal, 0, 'Missing comments should be 0');
    assert.strictEqual(profile.sharesTotal, 0, 'Missing shares should be 0');
    
    console.log('✅ Missing metrics handled correctly');
  });
});

// Run tests
if (require.main === module) {
  require('../../scripts/fetch-and-save-apify-run.js');
}