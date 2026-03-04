import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { Pool } = pg;

async function resetDatabase() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  console.log('🔌 Connecting to database...');
  const pool = new Pool({ connectionString });

  try {
    // Delete all data from tables
    console.log('🗑️  Deleting all readings...');
    const readingsResult = await pool.query('DELETE FROM readings');
    console.log(`   ✅ Deleted ${readingsResult.rowCount} readings`);

    console.log('🗑️  Deleting all devices...');
    const devicesResult = await pool.query('DELETE FROM devices');
    console.log(`   ✅ Deleted ${devicesResult.rowCount} devices`);

    console.log('🗑️  Deleting all alerts...');
    const alertsResult = await pool.query('DELETE FROM alerts');
    console.log(`   ✅ Deleted ${alertsResult.rowCount} alerts`);

    // Reset sequences (auto-increment IDs)
    console.log('🔄 Resetting ID sequences...');
    await pool.query('ALTER SEQUENCE readings_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE devices_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE alerts_id_seq RESTART WITH 1');
    console.log('   ✅ Sequences reset');

    console.log('\n✨ Database reset complete!');
    console.log('You can now discover and import fresh energy meters.');
    
  } catch (error) {
    console.error('❌ Error resetting database:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetDatabase();
