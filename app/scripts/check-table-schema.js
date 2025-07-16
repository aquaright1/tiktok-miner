#\!/usr/bin/env node

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkSchema() {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tiktok_profiles'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 TikTok Profiles Table Schema:');
    console.log('================================');
    result.rows.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema();
EOF < /dev/null
