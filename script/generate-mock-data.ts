/**
 * Generate Realistic Mock Data for Demo
 * 
 * Creates 15 days of realistic meter readings based on typical patterns
 * for demonstration purposes.
 * 
 * Usage:
 *   tsx script/generate-mock-data.ts
 */

import { db, pool } from "../server/db";
import { devices, readings, alerts, thresholds, users } from "@shared/schema";

const DAYS_TO_GENERATE = 15;
const READINGS_PER_DAY = 288; // Every 5 minutes

interface DeviceConfig {
  name: string;
  type: string;
  location: string;
  ipAddress: string;
  status: string;
  baselinePower: {
    min: number;
    max: number;
    peak: number; // Hour of day for peak (0-23)
  };
  voltage: { nominal: number; variation: number };
  phases: boolean; // Three-phase support
}

const MOCK_DEVICES: DeviceConfig[] = [
  {
    name: "Main Building Meter",
    type: "Smart Meter",
    location: "Building A - Ground Floor",
    ipAddress: "192.168.1.100",
    status: "online",
    baselinePower: { min: 120, max: 180, peak: 14 }, // Peak at 2 PM
    voltage: { nominal: 230, variation: 5 },
    phases: true,
  },
  {
    name: "HVAC VFD Panel",
    type: "PLC",
    location: "Building A - Rooftop",
    ipAddress: "192.168.1.101",
    status: "online",
    baselinePower: { min: 280, max: 380, peak: 15 }, // Peak at 3 PM
    voltage: { nominal: 228, variation: 7 },
    phases: true,
  },
  {
    name: "Lighting Controller",
    type: "Smart Meter",
    location: "Building B - 2nd Floor",
    ipAddress: "192.168.1.102",
    status: "online",
    baselinePower: { min: 45, max: 95, peak: 18 }, // Peak at 6 PM
    voltage: { nominal: 231, variation: 4 },
    phases: true,
  },
  {
    name: "Production Line 1",
    type: "Smart Meter",
    location: "Factory - Zone 1",
    ipAddress: "192.168.1.103",
    status: "online",
    baselinePower: { min: 380, max: 520, peak: 10 }, // Peak at 10 AM
    voltage: { nominal: 227, variation: 6 },
    phases: true,
  },
  {
    name: "Emergency Generator",
    type: "Sensor",
    location: "Building C - Basement",
    ipAddress: "192.168.1.104",
    status: "offline",
    baselinePower: { min: 0, max: 5, peak: 12 },
    voltage: { nominal: 0, variation: 0 },
    phases: false,
  },
  {
    name: "Data Center UPS",
    type: "Smart Meter",
    location: "Building A - Server Room",
    ipAddress: "192.168.1.105",
    status: "online",
    baselinePower: { min: 200, max: 250, peak: 16 }, // Consistent load
    voltage: { nominal: 230, variation: 2 },
    phases: true,
  },
];

// Helper functions
function randomVariation(base: number, variation: number): number {
  return base + (Math.random() - 0.5) * variation * 2;
}

function getPowerForHour(config: DeviceConfig, hour: number, dayOfWeek: number): number {
  // Lower power on weekends
  const weekendFactor = dayOfWeek >= 5 ? 0.6 : 1.0;
  
  // Calculate power based on time of day (sine wave pattern)  
  const hourDiff = Math.abs(hour - config.baselinePower.peak);
  const powerFactor = 1 - (hourDiff / 24) * 0.5;
  
  const basePower = config.baselinePower.min + 
    (config.baselinePower.max - config.baselinePower.min) * powerFactor;
  
  // Add some randomness
  return randomVariation(basePower * weekendFactor, basePower * 0.1);
}

function calculateCurrent(power: number, voltage: number, powerFactor: number = 0.93): number {
  // P = V * I * PF * sqrt(3) for three-phase
  // I = P / (V * PF * sqrt(3))
  return power / (voltage * powerFactor * Math.sqrt(3));
}

async function generateData() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║   Mock Data Generator for Demo        ║");
  console.log("╚════════════════════════════════════════╝");
  console.log("");

  if (!db) {
    console.log("❌ Error: Database not connected");
    console.log("Please set DATABASE_URL environment variable");
    process.exit(1);
  }

  console.log("📊 Configuration:");
  console.log(`  Days to generate: ${DAYS_TO_GENERATE}`);
  console.log(`  Readings per day: ${READINGS_PER_DAY}`);
  console.log(`  Total readings: ${DAYS_TO_GENERATE * READINGS_PER_DAY * MOCK_DEVICES.filter(d => d.status === 'online').length}`);
  console.log("");

  // Clear existing data
  console.log("🗑️  Clearing existing data...");
  await db.delete(readings);
  await db.delete(alerts);
  await db.delete(thresholds);
  await db.delete(devices);
  await db.delete(users);
  console.log("✅ Cleared");
  console.log("");

  // Create demo user
  console.log("👤 Creating demo users...");
  await db.insert(users).values([
    {
      username: "admin",
      email: "admin@energypilot.demo",
      role: "admin",
      firstName: "Admin",
      lastName: "User",
    },
    {
      username: "operator",
      email: "operator@energypilot.demo",
      role: "operator",
      firstName: "Operator",
      lastName: "User",
    },
  ]);
  console.log("✅ Created 2 users (admin, operator)");
  console.log("");

  // Create devices
  console.log("🔌 Creating devices...");
  const deviceIds: number[] = [];
  
  for (const config of MOCK_DEVICES) {
    const [inserted] = await db
      .insert(devices)
      .values({
        name: config.name,
        type: config.type,
        location: config.location,
        ipAddress: config.ipAddress,
        status: config.status,
        lastSeen: config.status === 'online' ? new Date() : null,
      })
      .returning();
    
    deviceIds.push(inserted.id);
    console.log(`  ✓ ${config.name} (ID: ${inserted.id})`);
  }
  console.log("");

  // Create thresholds
  console.log("⚠️  Creating alert thresholds...");
  await db.insert(thresholds).values([
    {
      deviceType: "Smart Meter",
      parameter: "power",
      operator: "greater_than",
      value: 500,
      unit: "kW",
      severity: "warning",
      message: "Power consumption exceeds 500kW",
    },
    {
      deviceType: "Smart Meter",
      parameter: "voltage",
      operator: "less_than",
      value: 220,
      unit: "V",
      severity: "critical",
      message: "Voltage dropped below 220V",
    },
    {
      deviceType: "Smart Meter",
      parameter: "power_factor",
      operator: "less_than",
      value: 0.85,
      unit: "",
      severity: "warning",
      message: "Power factor below 0.85",
    },
  ]);
  console.log("✅ Created 3 alert thresholds");
  console.log("");

  // Generate readings
  console.log("📈 Generating meter readings...");
  const now = new Date();
  const startDate = new Date(now.getTime() - DAYS_TO_GENERATE * 24 * 60 * 60 * 1000);
  
  let totalReadings = 0;
  let alertsGenerated = 0;
  const readingsBatch = [];
  const alertsBatch = [];

  for (let day = 0; day < DAYS_TO_GENERATE; day++) {
    const currentDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
    const dayOfWeek = currentDate.getDay();
    
    for (let reading = 0; reading < READINGS_PER_DAY; reading++) {
      const timestamp = new Date(
        currentDate.getTime() + reading * (24 * 60 / READINGS_PER_DAY) * 60 * 1000
      );
      const hour = timestamp.getHours();

      for (let i = 0; i < MOCK_DEVICES.length; i++) {
        const config = MOCK_DEVICES[i];
        if (config.status !== 'online') continue;

        const deviceId = deviceIds[i];
        const power = getPowerForHour(config, hour, dayOfWeek);
        const voltage = randomVariation(config.voltage.nominal, config.voltage.variation);
        const powerFactor = randomVariation(0.93, 0.05);
        const current = calculateCurrent(power, voltage, powerFactor);
        const frequency = randomVariation(50, 0.2);

        // Calculate three-phase values
        const voltageL1L2 = config.phases ? randomVariation(voltage * Math.sqrt(3), 2) : undefined;
        const voltageL2L3 = config.phases ? randomVariation(voltage * Math.sqrt(3), 2) : undefined;
        const voltageL3L1 = config.phases ? randomVariation(voltage * Math.sqrt(3), 2) : undefined;
        
        const currentL1 = config.phases ? randomVariation(current, current * 0.05) : undefined;
        const currentL2 = config.phases ? randomVariation(current, current * 0.05) : undefined;
        const currentL3 = config.phases ? randomVariation(current, current * 0.05) : undefined;

        // Accumulate energy (kWh)
        const energyIncrement = power * (5 / 60); // 5-minute reading
        const energy = totalReadings * energyIncrement * 0.1; // Rough cumulative

        readingsBatch.push({
          deviceId,
          power,
          voltage,
          voltageL1L2,
          voltageL2L3,
          voltageL3L1,
          current,
          currentL1,
          currentL2,
          currentL3,
          energy,
          frequency,
          powerFactor,
          timestamp,
        });

        // Generate occasional alerts
        if (power > 500 && Math.random() < 0.02) {
          alertsBatch.push({
            deviceId,
            severity: "warning",
            message: `High power consumption: ${power.toFixed(1)}kW detected`,
            timestamp,
            acknowledged: Math.random() < 0.5,
          });
          alertsGenerated++;
        }

        if (voltage < 220 && Math.random() < 0.01) {
          alertsBatch.push({
            deviceId,
            severity: "critical",
            message: `Low voltage alert: ${voltage.toFixed(1)}V`,
            timestamp,
            acknowledged: Math.random() < 0.3,
          });
          alertsGenerated++;
        }

        if (powerFactor < 0.85 && Math.random() < 0.015) {
          alertsBatch.push({
            deviceId,
            severity: "warning",
            message: `Poor power factor: ${powerFactor.toFixed(2)}`,
            timestamp,
            acknowledged: Math.random() < 0.6,
          });
          alertsGenerated++;
        }

        totalReadings++;
      }

      // Insert in batches
      if (readingsBatch.length >= 500) {
        await db.insert(readings).values(readingsBatch);
        readingsBatch.length = 0;
      }

      if (alertsBatch.length >= 50) {
        await db.insert(alerts).values(alertsBatch);
        alertsBatch.length = 0;
      }
    }

    const progress = ((day + 1) / DAYS_TO_GENERATE * 100).toFixed(0);
    console.log(`  Day ${day + 1}/${DAYS_TO_GENERATE} (${progress}%) - ${currentDate.toDateString()}`);
  }

  // Insert remaining batches
  if (readingsBatch.length > 0) {
    await db.insert(readings).values(readingsBatch);
  }
  if (alertsBatch.length > 0) {
    await db.insert(alerts).values(alertsBatch);
  }

  console.log("");
  console.log("╔════════════════════════════════════════╗");
  console.log("║         Generation Complete!           ║");
  console.log("╚════════════════════════════════════════╝");
  console.log("");
  console.log("📊 Summary:");
  console.log(`  Devices: ${MOCK_DEVICES.length}`);
  console.log(`  Readings: ${totalReadings.toLocaleString()}`);
  console.log(`  Alerts: ${alertsGenerated}`);
  console.log(`  Date Range: ${startDate.toLocaleDateString()} - ${now.toLocaleDateString()}`);
  console.log("");
  console.log("✅ Your demo database is ready!");
  console.log("");
  console.log("Next step:");
  console.log("  npm run dev");
  console.log("");
}

main();

async function main() {
  try {
    await generateData();
  } catch (error) {
    console.error("\n❌ Error generating data:", error);
    process.exit(1);
  } finally {
    await pool?.end();
  }
}
