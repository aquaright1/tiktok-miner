#!/usr/bin/env node

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkCategoryColumn() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking category column in tiktok_profiles table\n');
    
    // 1. Check if category column exists
    const columnCheck = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'tiktok_profiles' 
      AND column_name = 'category'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('❌ Category column does not exist in tiktok_profiles table');
      console.log('   Need to add it with: ALTER TABLE tiktok_profiles ADD COLUMN category TEXT;');
      return;
    }
    
    console.log('✅ Category column exists:');
    console.log(`   Type: ${columnCheck.rows[0].data_type}`);
    console.log(`   Nullable: ${columnCheck.rows[0].is_nullable}`);
    console.log('');
    
    // 2. Check current category values
    const categoryData = await client.query(`
      SELECT 
        category,
        COUNT(*) as count
      FROM tiktok_profiles
      GROUP BY category
      ORDER BY count DESC
    `);
    
    console.log('📊 Current category distribution:');
    if (categoryData.rows.length === 0) {
      console.log('   No data found');
    } else {
      categoryData.rows.forEach(row => {
        const category = row.category || 'NULL';
        console.log(`   ${category}: ${row.count} profiles`);
      });
    }
    console.log('');
    
    // 3. Show sample records
    const sampleData = await client.query(`
      SELECT username, category, "lastUpdated"
      FROM tiktok_profiles
      ORDER BY "lastUpdated" DESC
      LIMIT 5
    `);
    
    console.log('📋 Sample records:');
    sampleData.rows.forEach(row => {
      console.log(`   @${row.username}: category = ${row.category || 'NULL'} (${row.lastUpdated})`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkCategoryColumn().catch(console.error);