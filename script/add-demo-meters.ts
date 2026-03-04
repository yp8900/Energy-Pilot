/**
 * Add 5 Demo Energy Meters with Full Configuration
 * Generates 15 days of realistic mock data for client demonstration
 */

import { db } from "../server/db";
import { devices, readings } from "../shared/schema";
import { eq, and, gte } from "drizzle-orm";

interface MeterConfig {
  name: string;
  location: string;
  basePower: number;      // Base load in kW
  peakPower: number;      // Peak load in kW
  baseVoltage: number;    // Base voltage in V
  baseCurrent: number;    // Base current in A
  powerProfile: 'constant' | 'office' | 'industrial' | '24x7' | 'seasonal';
}

const DEMO_METERS: MeterConfig[] = [
  {
    name: "EM-MAIN-INCOMER",
    location: "Main Electrical Room - Incomer",
    basePower: 450,
    peakPower: 650,
    baseVoltage: 400,
    baseCurrent: 800,
    powerProfile: 'office'
  },
  {
    name: "EM-HVAC-SYSTEM",
    location: "Mechanical Floor - HVAC",
    basePower: 120,
    peakPower: 280,
    baseVoltage: 400,
    baseCurrent: 350,
    powerProfile: 'seasonal'
  },
  {
    name: "EM-LIGHTING-CIRCUIT",
    location: "Distribution Board - Lighting",
    basePower: 45,
    peakPower: 95,
    baseVoltage: 400,
    baseCurrent: 120,
    powerProfile: 'office'
  },
  {
    name: "EM-DATA-CENTER",
    location: "Server Room - UPS Output",
    basePower: 180,
    peakPower: 220,
    baseVoltage: 400,
    baseCurrent: 320,
    powerProfile: '24x7'
  },
  {
    name: "EM-PRODUCTION-LINE",
    location: "Factory Floor - Production",
    basePower: 250,
    peakPower: 480,
    baseVoltage: 400,
    baseCurrent: 600,
    powerProfile: 'industrial'
  }
];

// Generate realistic power based on time and profile
function generatePower(config: MeterConfig, timestamp: Date): number {
  const hour = timestamp.getHours();
  const dayOfWeek = timestamp.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  let loadFactor = 0.5; // Default 50% load
  
  switch (config.powerProfile) {
    case 'office':
      if (isWeekend) {
        loadFactor = 0.15; // 15% on weekends
      } else if (hour >= 8 && hour <= 18) {
        loadFactor = 0.75 + Math.random() * 0.15; // 75-90% during office hours
      } else if (hour >= 6 && hour <= 21) {
        loadFactor = 0.35 + Math.random() * 0.15; // 35-50% extended hours
      } else {
        loadFactor = 0.10 + Math.random() * 0.05; // 10-15% night
      }
      break;
      
    case 'industrial':
      if (isWeekend) {
        loadFactor = 0.20; // 20% on weekends
      } else if (hour >= 6 && hour <= 22) {
        loadFactor = 0.80 + Math.random() * 0.15; // 80-95% production hours
      } else {
        loadFactor = 0.25 + Math.random() * 0.10; // 25-35% night shift
      }
      break;
      
    case '24x7':
      loadFactor = 0.75 + Math.random() * 0.15; // Consistent 75-90% load
      break;
      
    case 'seasonal':
      // HVAC varies by time of day
      if (hour >= 10 && hour <= 16) {
        loadFactor = 0.85 + Math.random() * 0.10; // Peak cooling hours
      } else if (hour >= 8 && hour <= 19) {
        loadFactor = 0.55 + Math.random() * 0.15; // Medium load
      } else {
        loadFactor = 0.20 + Math.random() * 0.10; // Night setback
      }
      break;
      
    case 'constant':
      loadFactor = 0.60 + Math.random() * 0.10; // 60-70% constant
      break;
  }
  
  const power = config.basePower + (config.peakPower - config.basePower) * loadFactor;
  return Math.round(power * 100) / 100; // Round to 2 decimals
}

// Generate realistic 3-phase voltage with small variations
function generateVoltages(baseVoltage: number) {
  const variation = () => baseVoltage + (Math.random() - 0.5) * 8; // ±4V variation
  return {
    voltageAvg: Math.round(baseVoltage * 10) / 10,
    voltageL1L2: Math.round(variation() * 10) / 10,
    voltageL2L3: Math.round(variation() * 10) / 10,
    voltageL3L1: Math.round(variation() * 10) / 10,
  };
}

// Generate realistic 3-phase current based on power
function generateCurrents(power: number, voltage: number) {
  const totalCurrent = (power * 1000) / (Math.sqrt(3) * voltage * 0.92); // 3-phase, 92% PF
  const variation = () => totalCurrent / 3 + (Math.random() - 0.5) * totalCurrent * 0.1;
  
  return {
    currentAvg: Math.round(totalCurrent * 10) / 10,
    currentL1: Math.round(variation() * 10) / 10,
    currentL2: Math.round(variation() * 10) / 10,
    currentL3: Math.round(variation() * 10) / 10,
  };
}

// Generate frequency with small variations
function generateFrequency(): number {
  return Math.round((50 + (Math.random() - 0.5) * 0.2) * 100) / 100; // 49.9-50.1 Hz
}

// Generate power factor
function generatePowerFactor(): number {
  return Math.round((0.88 + Math.random() * 0.08) * 1000) / 1000; // 0.88-0.96
}

async function createDemoMeters() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Demo Energy Meters Setup Tool       ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // Delete existing demo meters
    console.log('🗑️  Cleaning up existing demo meters...');
    const existingMeters = await db.select().from(devices).where(
      eq(devices.type, 'energy_meter')
    );
    
    for (const meter of existingMeters) {
      if (meter.name.startsWith('EM-')) {
        await db.delete(readings).where(eq(readings.deviceId, meter.id));
        await db.delete(devices).where(eq(devices.id, meter.id));
        console.log(`   ✅ Deleted: ${meter.name}`);
      }
    }

    // Create 5 demo meters
    console.log('\n📊 Creating demo energy meters...\n');
    const createdMeters: { id: number; config: MeterConfig }[] = [];

    for (const config of DEMO_METERS) {
      const [meter] = await db.insert(devices).values({
        name: config.name,
        type: 'energy_meter',
        location: config.location,
        ipAddress: `192.168.1.${100 + createdMeters.length}`,
        status: 'online',
        lastSeen: new Date(),
        config: {
          manufacturer: 'Schneider Electric',
          model: 'PM5340',
          modbusAddress: 10 + createdMeters.length,
          phases: 3,
          ratedVoltage: config.baseVoltage,
          ratedCurrent: config.baseCurrent
        }
      }).returning();

      createdMeters.push({ id: meter.id, config });
      
      console.log(`✅ Created: ${config.name}`);
      console.log(`   Location: ${config.location}`);
      console.log(`   Power Range: ${config.basePower}-${config.peakPower} kW`);
      console.log(`   Profile: ${config.powerProfile}`);
      console.log('');
    }

    // Generate 15 days of hourly readings
    console.log('📈 Generating 15 days of historical data...\n');
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 15); // 15 days ago

    let totalReadings = 0;
    const readingsPerMeter = 15 * 24; // 15 days * 24 hours

    for (const meter of createdMeters) {
      console.log(`   Processing: ${meter.config.name}...`);
      
      const meterReadings = [];
      let cumulativeEnergy = Math.random() * 1000; // Start with random base energy

      for (let i = 0; i < readingsPerMeter; i++) {
        const timestamp = new Date(startDate);
        timestamp.setHours(timestamp.getHours() + i);

        const power = generatePower(meter.config, timestamp);
        const voltages = generateVoltages(meter.config.baseVoltage);
        const currents = generateCurrents(power, meter.config.baseVoltage);
        const frequency = generateFrequency();
        const powerFactor = generatePowerFactor();

        // Accumulate energy (kWh = kW * hours)
        cumulativeEnergy += power * 1; // 1 hour interval

        meterReadings.push({
          deviceId: meter.id,
          power: power,
          voltage: voltages.voltageAvg,
          voltageL1L2: voltages.voltageL1L2,
          voltageL2L3: voltages.voltageL2L3,
          voltageL3L1: voltages.voltageL3L1,
          current: currents.currentAvg,
          currentL1: currents.currentL1,
          currentL2: currents.currentL2,
          currentL3: currents.currentL3,
          energy: Math.round(cumulativeEnergy * 100) / 100,
          frequency: frequency,
          powerFactor: powerFactor,
          timestamp: timestamp
        });
      }

      // Insert in batches of 100
      for (let i = 0; i < meterReadings.length; i += 100) {
        const batch = meterReadings.slice(i, i + 100);
        await db.insert(readings).values(batch);
      }

      totalReadings += meterReadings.length;
      console.log(`      ✅ ${meterReadings.length} readings generated`);
    }

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║          Setup Complete! ✨            ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`📊 Summary:`);
    console.log(`   • Energy Meters: ${createdMeters.length}`);
    console.log(`   • Total Readings: ${totalReadings.toLocaleString()}`);
    console.log(`   • Time Range: ${startDate.toLocaleDateString()} - ${now.toLocaleDateString()}`);
    console.log(`   • Data Points per Meter: ${readingsPerMeter}`);
    console.log('\n✅ Demo meters are ready for client presentation!\n');
    console.log('🌐 Open http://localhost:5000/meters to view the dashboard\n');

  } catch (error) {
    console.error('❌ Error creating demo meters:', error);
    throw error;
  }
}

// Run the setup
createDemoMeters()
  .then(() => {
    console.log('✅ Process completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Process failed:', error);
    process.exit(1);
  });
