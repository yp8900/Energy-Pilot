import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { readings, devices } from './shared/schema';
import { eq } from 'drizzle-orm';

const { Pool } = pg;

// Set up database connection
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/energy_pilot";
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool, { schema: { readings, devices } });

async function backfillHistoricalData() {
  console.log('🔄 Starting historical data backfill...');
  console.log('📡 Connecting to database...');
  
  // Get all smart meters
  const allDevices = await db.select().from(devices).where(eq(devices.type, 'Smart Meter'));
  
  if (allDevices.length === 0) {
    console.log('❌ No smart meters found');
    return;
  }
  
  console.log(`📊 Found ${allDevices.length} meters to backfill`);
  
  // Get current date at midnight
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  // Define days to backfill (Monday, Tuesday, Wednesday)
  const daysToBackfill = [
    { name: 'Monday', daysAgo: 3 },
    { name: 'Tuesday', daysAgo: 2 },
    { name: 'Wednesday', daysAgo: 1 }
  ];
  
  for (const device of allDevices) {
    console.log(`\n📍 Processing ${device.name}...`);
    
    // Starting cumulative energy (kWh) - simulating meter has been running
    let cumulativeEnergy = 1000 + (device.id * 100); // Different starting point per meter
    
    for (const day of daysToBackfill) {
      const dayDate = new Date(now);
      dayDate.setDate(now.getDate() - day.daysAgo);
      
      console.log(`  📅 ${day.name} (${dayDate.toDateString()})`);
      
      // Daily consumption: 8-15 kWh per meter per day (realistic for industrial meter)
      const dailyConsumption = 8 + Math.random() * 7;
      const hourlyConsumption = dailyConsumption / 24;
      
      // Create readings throughout the day (every 2 hours for backfill)
      const readingsToInsert = [];
      
      for (let hour = 0; hour < 24; hour += 2) {
        const timestamp = new Date(dayDate);
        timestamp.setHours(hour, 0, 0, 0);
        
        // Increment cumulative energy
        cumulativeEnergy += hourlyConsumption * 2;
        
        // Generate realistic values
        const power = 60 + Math.random() * 20; // 60-80 kW
        const voltage = 380 + Math.random() * 20; // 380-400 V average
        const voltageL1L2 = 345 + Math.random() * 10; // Phase voltages
        const voltageL2L3 = 355 + Math.random() * 10;
        const voltageL3L1 = 365 + Math.random() * 10;
        const current = power / (voltage * Math.sqrt(3)) * 1000; // Calculate current from power
        const currentL1 = current * (0.95 + Math.random() * 0.1); // Slight phase imbalance
        const currentL2 = current * (0.95 + Math.random() * 0.1);
        const currentL3 = current * (0.95 + Math.random() * 0.1);
        
        readingsToInsert.push({
          deviceId: device.id,
          power: power,
          energy: cumulativeEnergy,
          voltage: voltage,
          voltageL1L2: voltageL1L2,
          voltageL2L3: voltageL2L3,
          voltageL3L1: voltageL3L1,
          current: current,
          currentL1: currentL1,
          currentL2: currentL2,
          currentL3: currentL3,
          frequency: 49.9 + Math.random() * 0.2, // 49.9-50.1 Hz
          powerFactor: 0.85 + Math.random() * 0.1, // 0.85-0.95
          timestamp: timestamp
        });
      }
      
      // Insert all readings for this day
      await db.insert(readings).values(readingsToInsert);
      console.log(`    ✅ Inserted ${readingsToInsert.length} readings (${dailyConsumption.toFixed(2)} kWh consumed)`);
    }
  }
  
  console.log('\n✅ Historical data backfill complete!');
  await pool.end();
  process.exit(0);
}

backfillHistoricalData().catch(async (error) => {
  console.error('❌ Backfill failed:', error);
  await pool.end();
  process.exit(1);
});
