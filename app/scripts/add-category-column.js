#!/usr/bin/env node

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addCategoryColumn() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Adding category column to tiktok_profiles table\n');
    
    // Add the category column
    await client.query(`
      ALTER TABLE tiktok_profiles 
      ADD COLUMN IF NOT EXISTS category TEXT
    `);
    
    console.log('✅ Category column added successfully');
    
    // Verify the column was added
    const columnCheck = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'tiktok_profiles' 
      AND column_name = 'category'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ Verification successful:');
      console.log(`   Type: ${columnCheck.rows[0].data_type}`);
      console.log(`   Nullable: ${columnCheck.rows[0].is_nullable}`);
    }
    
    console.log('\n✅ Category column is now ready for use!');
    
  } catch (error) {
    console.error('❌ Error adding category column:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addCategoryColumn().catch(console.error);