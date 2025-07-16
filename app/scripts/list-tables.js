#!/usr/bin/env node

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function listTables() {
  const client = await pool.connect();
  
  try {
    // List all tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tables in database:\n');
    result.rows.forEach(row => {
      console.log(`  • ${row.table_name}`);
    });
    
    // Check for TikTok-related tables
    console.log('\n🔍 TikTok-related tables:');
    result.rows.forEach(row => {
      if (row.table_name.toLowerCase().includes('tiktok') || 
          row.table_name.toLowerCase().includes('tik')) {
        console.log(`  ✓ ${row.table_name}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

listTables().catch(console.error);