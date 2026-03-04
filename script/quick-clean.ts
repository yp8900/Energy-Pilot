import { config } from 'dotenv';
config();

import { db } from '../server/db';
import { devices, readings, alerts } from '@shared/schema';

async function quickClean() {
  try {
    if (!db) {
      console.error('❌ Database not connected');
      process.exit(1);
    }

    console.log('🗑️  Cleaning database...');
    
    // Delete all data
    await db.delete(readings);
    console.log('✅ Cleared readings table');
    
    await db.delete(devices);
    console.log('✅ Cleared devices table');
    
    await db.delete(alerts);
    console.log('✅ Cleared alerts table');
    
    console.log('\n✨ Database cleaned successfully!');
    console.log('You can now discover and select energy meters from the Energy Meters page.');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error cleaning database:', error.message);
    process.exit(1);
  }
}

quickClean();
