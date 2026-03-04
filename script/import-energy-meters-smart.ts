/**
 * Import Energy Meters Only from METRO_BHAWAN BMS
 * 
 * Uses discovered-energy-meters.json to import only Modbus energy meter data
 * Filters out DDC controllers, HVAC, and other non-energy meter devices
 * 
 * Usage:
 *   npm run import-energy-meters -- --source ./exported-data
 */

import dotenv from "dotenv";
dotenv.config();

import { db } from "../server/db";
import { devices, readings } from "@shared/schema";
import { parse } from "csv-parse/sync";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface DiscoveredMeter {
  name: string;
  fullPath: string;
  parameterCount: number;
  parameters: Array<{
    logId: string;
    itemIndex: string;
    name: string;
    unit: string;
    path: string;
  }>;
}

interface BMSTrendLogRecord {
  SourceTable: string;
  LogId: string;
  SeqNum: string;
  RecordType: string;
  ItemIndex: string;
  Value: string;
  Timestamp: string;
}

// Parameter name mapping to device fields
const PARAMETER_MAP: Record<string, string> = {
  // Energy
  "WH": "energy",
  "MAIN_WH": "energy",
  
  // Power
  "Run _W": "power",
  "Run_W": "power",
  "MAIN_Run _W": "power",
  "MAIN_Run_W": "power",
  "W": "power",
  
  // Current
  "Total_Amp": "current",
  "TAmp": "current",
  "MAIN_TAmp": "current",
  "Am": "current",
  
  // Voltage
  "VLL": "voltage",
  "VLN": "voltage",
  "V": "voltage"
};

function loadDiscoveredMeters(sourceFolder: string): DiscoveredMeter[] {
  const filePath = join(sourceFolder, "discovered-energy-meters.json");
  
  if (!existsSync(filePath)) {
    console.error(`❌ Discovery file not found: ${filePath}`);
    console.error("   Please run: npm run discover-meters -- --source ./exported-data");
    process.exit(1);
  }

  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

function loadTrendLogReadings(sourceFolder: string): BMSTrendLogRecord[] {
  const filePath = join(sourceFolder, "trendlog_readings.csv");
  
  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const csvContent = readFileSync(filePath, "utf-8");
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records;
}

function unixToDate(unixTimestamp: string): Date {
  return new Date(parseInt(unixTimestamp) * 1000);
}

function getMeterLocation(meterName: string): string {
  // Extract location from meter name
  // Examples: "EM/MAIN" → "Main Incoming", "EM/AHU_LC" → "AHU LC", "FB10/MAIN6" → "Floor B10 Main 6"
  
  const parts = meterName.split("/");
  if (parts.length >= 2) {
    const location = parts[1]
      .replace(/_/g, " ")
      .replace(/([A-Z])/g, " $1")
      .trim();
    return location.charAt(0).toUpperCase() + location.slice(1);
  }
  
  return meterName;
}

async function importEnergyMeters(discoveredMeters: DiscoveredMeter[], trendLogRecords: BMSTrendLogRecord[]) {
  if (!db) {
    console.error("❌ Database not connected");
    console.error("Please set DATABASE_URL environment variable");
    process.exit(1);
  }

  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║     Energy Meter Import                                ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(`\n📊 Discovered Meters: ${discoveredMeters.length}`);
  console.log(`📊 Total Trend Records: ${trendLogRecords.length.toLocaleString()}\n`);

  // Create LogId to Meter/Parameter mapping
  const logIdMap = new Map<string, { meterName: string; parameterName: string; fieldName: string }>();
  
  for (const meter of discoveredMeters) {
    for (const param of meter.parameters) {
      const fieldName = PARAMETER_MAP[param.name] || "unknown";
      if (fieldName !== "unknown") {
        logIdMap.set(param.logId, {
          meterName: meter.name,
          parameterName: param.name,
          fieldName: fieldName
        });
      }
    }
  }

  console.log(`🔍 Mapped ${logIdMap.size} parameters to ${discoveredMeters.length} meters\n`);

  // Create devices
  const deviceMap = new Map<string, number>();
 const createdDevices: any[] = [];
  
  for (const meter of discoveredMeters) {
    const hasEnergyParams = meter.parameters.some(p => PARAMETER_MAP[p.name]);
    
    if (!hasEnergyParams) {
      continue; // Skip meters without mapped parameters
    }

    const location = getMeterLocation(meter.name);
    
    createdDevices.push({
      name: meter.name.replace(/\//g, " - "),
      type: "energy_meter",
      location: location,
      ipAddress: "N/A",
      status: "active"
    });
  }

  console.log(`\n📦 Creating ${createdDevices.length} devices...`);
  const insertedDevices = await db.insert(devices).values(createdDevices).returning();
  
  for (let i = 0; i < insertedDevices.length; i++) {
    const meterName = discoveredMeters[i].name;
    deviceMap.set(meterName, insertedDevices[i].id);
    console.log(`  ✓ ${insertedDevices[i].name} (ID: ${insertedDevices[i].id})`);
  }

  // Filter and group readings by device + timestamp
  console.log(`\n📊 Processing ${trendLogRecords.length.toLocaleString()} trend records...`);
  
  const readingGroups = new Map<string, any>();
  let matchedRecords = 0;
  let skippedRecords = 0;

  for (const record of trendLogRecords) {
    const mapping = logIdMap.get(record.LogId);
    
    if (!mapping) {
      skippedRecords++;
      continue; // Skip records not in our energy meter mapping
    }

    matchedRecords++;
    const deviceId = deviceMap.get(mapping.meterName);
    
    if (!deviceId) {
      continue;
    }

    const timestamp = unixToDate(record.Timestamp);
    const key = `${deviceId}-${record.Timestamp}`;

    if (!readingGroups.has(key)) {
      readingGroups.set(key, {
        deviceId: deviceId,
        timestamp: timestamp,
        power: null,
        voltage: null,
        current: null,
        energy: null,
        frequency: null,
        powerFactor: null
      });
    }

    const reading = readingGroups.get(key)!;
    const value = parseFloat(record.Value);

    if (!isNaN(value)) {
      reading[mapping.fieldName] = value;
    }
  }

  console.log(`  ✓ Matched: ${matchedRecords.toLocaleString()} records`);
  console.log(`  ✓ Skipped: ${skippedRecords.toLocaleString()} records (non-energy meter data)`);
  console.log(`  ✓ Consolidated: ${readingGroups.size.toLocaleString()} readings\n`);

  // Insert readings in batches
  const readingsArray = Array.from(readingGroups.values());
  const BATCH_SIZE = 500;
  let insertedCount = 0;

  console.log(`📥 Importing ${readingsArray.length.toLocaleString()} readings...`);
  
  for (let i = 0; i < readingsArray.length; i += BATCH_SIZE) {
    const batch = readingsArray.slice(i, i + BATCH_SIZE);
    await db.insert(readings).values(batch);
    insertedCount += batch.length;
    
    if (insertedCount % 5000 === 0) {
      console.log(`  ✓ Imported ${insertedCount.toLocaleString()} readings...`);
    }
  }

  console.log(`✅ Imported ${insertedCount.toLocaleString()} readings\n`);
}

async function main() {
  const startTime = Date.now();
  
  const args = process.argv.slice(2);
  const sourceIndex = args.indexOf("--source");
  const sourceFolder = sourceIndex >= 0 && args[sourceIndex + 1] 
    ? args[sourceIndex + 1] 
    : "./exported-data";

  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  METRO_BHAWAN Energy Meter Import Tool                ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(`\nConfiguration:`);
  console.log(`  Source Folder: ${sourceFolder}`);

  // Load discovered meters
  console.log("\n🔍 Loading discovered meters...");
  const discoveredMeters = loadDiscoveredMeters(sourceFolder);
  console.log(`   Found: ${discoveredMeters.length} meters`);

  // Load trend log data
  console.log("\n🔍 Loading trend log data...");
  const trendLogRecords = loadTrendLogReadings(sourceFolder);
  console.log(`   Found: ${trendLogRecords.length.toLocaleString()} records`);

  // Import
  await importEnergyMeters(discoveredMeters, trendLogRecords);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║         Import Summary                                 ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(`  Energy Meters: ${discoveredMeters.length}`);
  console.log(`  Duration: ${duration}s`);
  console.log("\n✅ Energy meter import completed!");
  console.log("\n🎉 Your METRO_BHAWAN energy meter data is ready!");
  console.log("\nNext step:");
  console.log("  npm run dev\n");

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Import failed:", error);
  process.exit(1);
});
