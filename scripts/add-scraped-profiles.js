#!/usr/bin/env node

// Sample profiles from the previous scrape
const profiles = [
  {
    id: "7182984440548754478",
    username: "remotejobfinder",
    name: "Remote Job Finder",
    bio: "#1 Page for Remote Jobs 🌐\nWant to get hired? 👀\nUse our resume services 👇",
    platform: "tiktok",
    followerCount: 323900,
    followingCount: 3,
    profileUrl: "https://www.tiktok.com/@remotejobfinder",
    profileImageUrl: "https://p16-sign.tiktokcdn-us.com/tos-useast5-avt-0068-tx/7345451511654121518~tplv-tiktokx-cropcenter:720:720.jpeg",
    isVerified: false,
    videoCount: 525,
    avgLikesPerPost: 1732,
    avgLikesPerVideo: 1732,
    engagementRate: 0.5347329422661316,
    tags: []
  },
  {
    id: "6904759169720894470",
    username: "ziprecruiter",
    name: "ZipRecruiter",
    bio: "We make finding a job easier and faster.\nPut ZipRecruiter to work for you 🙌",
    platform: "tiktok",
    followerCount: 22900,
    followingCount: 76,
    profileUrl: "https://www.tiktok.com/@ziprecruiter",
    profileImageUrl: "https://p16-sign.tiktokcdn-us.com/tos-useast5-avt-0068-tx/3c979251f99465094f9dd46cc5e9a664~tplv-tiktokx-cropcenter:720:720.jpeg",
    isVerified: true,
    videoCount: 84,
    avgLikesPerPost: 9581,
    avgLikesPerVideo: 9581,
    engagementRate: 41.83822000415887,
    tags: []
  },
  {
    id: "124416329800962048",
    username: "workfromhomediva",
    name: "Workfromhomediva",
    bio: "THIS IS MY ONLY ACCOUNT DON'T GET SCAMMED! FOLLOW ME ON YOUTUBE!!",
    platform: "tiktok",
    followerCount: 106400,
    followingCount: 1337,
    profileUrl: "https://www.tiktok.com/@workfromhomediva",
    profileImageUrl: "https://p19-pu-sign-useast8.tiktokcdn-us.com/tos-useast8-avt-0068-tx2/d250e720387e6229c65c1bd3fad5bba9~tplv-tiktokx-cropcenter:720:720.jpeg",
    isVerified: false,
    videoCount: 398,
    avgLikesPerPost: 1414,
    avgLikesPerVideo: 1414,
    engagementRate: 1.3285412022518606,
    tags: []
  },
  {
    id: "6812266309851890693",
    username: "adriannacrawf0rd",
    name: "adri remote jobs",
    bio: "WFH jobs & food 🍲 \n⬇️remote job newsletter &\nwfh job board⬇️",
    platform: "tiktok",
    followerCount: 139100,
    followingCount: 244,
    profileUrl: "https://www.tiktok.com/@adriannacrawf0rd",
    profileImageUrl: "https://p16-common-sign-va.tiktokcdn-us.com/tos-maliva-avt-0068/4b4a400cc24577aa594a855b5d4d0281~tplv-tiktokx-cropcenter:720:720.jpeg",
    isVerified: false,
    videoCount: 1072,
    avgLikesPerPost: 1213,
    avgLikesPerVideo: 1213,
    engagementRate: 0.8718091784070302,
    tags: []
  },
  {
    id: "7290987510963029035",
    username: "_wfhwithjenny_",
    name: "WFH with Jenny 👩🏻‍💻🏡",
    bio: "WFH Recommendations 👩🏻‍💻🩷 \nNo Telegram‼️",
    platform: "tiktok",
    followerCount: 39700,
    followingCount: 33,
    profileUrl: "https://www.tiktok.com/@_wfhwithjenny_",
    profileImageUrl: "https://p19-pu-sign-useast8.tiktokcdn-us.com/tos-useast5-avt-0068-tx/069b87d4a564cc98f2c61b66163552c1~tplv-tiktokx-cropcenter:720:720.jpeg",
    isVerified: false,
    videoCount: 422,
    avgLikesPerPost: 848,
    avgLikesPerVideo: 848,
    engagementRate: 2.1362827843900343,
    tags: []
  }
];

async function addProfilesToDatabase() {
  try {
    console.log(`Adding ${profiles.length} profiles to database...`);
    
    const response = await fetch('http://localhost:3000/api/scraper/add-selected', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ profiles })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to add profiles: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Success!');
    console.log(`Added: ${result.added} profiles`);
    console.log(`Errors: ${result.errors}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the script
addProfilesToDatabase();