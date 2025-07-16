#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearCreatorsTable() {
  try {
    console.log('⚠️  WARNING: This will delete ALL creators from the database!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    
    // Give user time to cancel
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🗑️  Deleting all creators...');
    
    const result = await prisma.creator.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.count} creators from the database.`);
  } catch (error) {
    console.error('❌ Error clearing creators table:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearCreatorsTable();