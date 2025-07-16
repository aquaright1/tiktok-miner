#!/usr/bin/env node

// Simple script to verify column order
const fs = require('fs');
const path = require('path');

const columnsFile = path.join(__dirname, '../components/creators/tiktok-columns.tsx');
const content = fs.readFileSync(columnsFile, 'utf8');

// Extract accessorKey values in order
const accessorKeyRegex = /accessorKey: "([^"]+)"/g;
const matches = [];
let match;

while ((match = accessorKeyRegex.exec(content)) !== null) {
  matches.push(match[1]);
}

console.log('Column order in tiktok-columns.tsx:');
matches.forEach((key, index) => {
  const columnNames = {
    'profileUrl': 'Profile',
    'engagementRate': 'Gem Score',
    'followerCount': 'Followers',
    'posts30d': 'Posts',
    'likesTotal': 'Likes',
    'commentsTotal': 'Comments',
    'viewsTotal': 'Views',
    'sharesTotal': 'Shares',
    'category': 'Category',
    'lastSync': 'Last Updated'
  };
  
  console.log(`${index + 1}. ${columnNames[key] || key} (${key})`);
});

// Verify the expected order
const expectedOrder = [
  'profileUrl',
  'engagementRate', 
  'followerCount',
  'posts30d',
  'likesTotal',
  'commentsTotal',
  'viewsTotal',
  'sharesTotal',
  'category',
  'lastSync'
];

console.log('\nVerification:');
const isCorrect = JSON.stringify(matches) === JSON.stringify(expectedOrder);
console.log(`✅ Column order is ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);

if (!isCorrect) {
  console.log('Expected:', expectedOrder);
  console.log('Actual:', matches);
}