/**
 * Import Real BMS Data from METRO_BHAWAN
 * 
 * This script transforms Loytec/BACnet BMS data (TrendLogs and AlarmLogs)
 * into the Energy Pilot EMS schema.
 * 
 * Usage:
 *   tsx script/import-bms-data.ts --source ./exported-data
 */

import dotenv from "dotenv";
dotenv.config();

import { db, pool } from "../server/db";
import { devices, readings, alerts } from "@shared/schema";
import { parse } from "csv-parse/sync";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface BMSTrendLogRecord {
  SourceTable: string;
  LogId: string;
  SeqNum: string;
  RecordType: string;
  ItemIndex: string;
  Value: string;
  Timestamp: string; // Unix timestamp in seconds
}

interface BMSAlarmLogRecord {
  SourceTable: string;
  LogId: string;
  SeqNum: string;
  State: string;
  Priority: string;
  Message: string;
  Timestamp: string;
  [key: string]: any;
}

interface BMSLogItemInfo {
  LogId: string;
  ItemId: string;
  ItemIndex: string;
  AbsolutePath: string;
  Unit: string;
}

interface DeviceMapping {
  sourceId: string; // LogId or TrendLog table name
  name: string;
  type: string;
  location: string;
  parameters: Map<number, ParameterInfo>; // ItemIndex -> parameter info
}

interface ParameterInfo {
  name: string;
  unit: string;
  mappedField: string; // 'power', 'voltage', 'current', etc.
}

// Helper: Convert Unix timestamp to Date
function unixToDate(timestamp: string | number): Date {
  const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
  return new Date(ts * 1000);
}

// Helper: Parse parameter from BMS path
function parseParameter(absolutePath: string): { param: string; location: string } {
  // Example: Network/Devices/DDC44/Datapoints/User Registers/PGM1/EM/EM_CURRENT
  const parts = absolutePath.split('/');
  
  let location = 'Unknown';
  let param = 'Unknown';
  
  // Extract device location (DDC number, LIOB, etc.)
  const deviceMatch = parts.find(p => p.startsWith('DDC') || p.startsWith('LIOB'));
  if (deviceMatch) {
    location = deviceMatch;
  }
  
  // Extract parameter name (last meaningful part)
  if (parts.length > 0) {
    param = parts[parts.length - 1];
  }
  
  return { param, location };
}

// Helper: Map BMS parameter to EMS field
function mapParameterToField(paramName: string): string | null {
  const name = paramName.toUpperCase();
  
  if (name.includes('POWER') || name.includes('KW')) return 'power';
  if (name.includes('VOLTAGE') || name.includes('VOLT')) return 'voltage';
  if (name.includes('CURRENT') || name.includes('AMP')) return 'current';
  if (name.includes('ENERGY') || name.includes('KWH')) return 'energy';
  if (name.includes('FREQUENCY') || name.includes('FREQ') || name.includes('HZ')) return 'frequency';
  if (name.includes('POWER_FACTOR') || name.includes('PF') || name.includes('COS')) return 'powerFactor';
  if (name.includes('TEMP')) return null; // Temperature - not a power meter reading
  
  // Default to generic value if it seems numeric
  return null;
}

async function loadDeviceMappings(sourceFolder: string): Promise<Map<string, DeviceMapping>> {
  console.log("📋 Loading device mappings from LogItemInfo...");
  
  const logItemPath = join(sourceFolder, "LogItemInfo.csv");
  if (!existsSync(logItemPath)) {
    console.log("  ⚠️  LogItemInfo.csv not found - using auto-mapping");
    return new Map();
  }

  const csvContent = readFileSync(logItemPath, "utf-8");
  const records: BMSLogItemInfo[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`  Found ${records.length} log items`);

  const mappings = new Map<string, DeviceMapping>();

  for (const record of records) {
    const logId = record.LogId;
    const { param, location } = parseParameter(record.AbsolutePath);
    const mappedField = mapParameterToField(param);

    if (!mappings.has(logId)) {
      mappings.set(logId, {
        sourceId: logId,
        name: `${location} Meter`,
        type: param.includes('CURRENT') || param.includes('POWER') ? 'Smart Meter' : 'Sensor',
        location: location,
        parameters: new Map(),
      });
    }

    const mapping = mappings.get(logId)!;
    const itemIndex = parseInt(record.ItemIndex);
    
    mapping.parameters.set(itemIndex, {
      name: param,
      unit: record.Unit || '',
      mappedField: mappedField || 'value',
    });
  }

  console.log(`  ✅ Created mappings for ${mappings.size} devices`);
  console.log("");

  return mappings;
}

async function importDevices(mappings: Map<string, DeviceMapping>): Promise<Map<string, number>> {
  console.log("📦 Creating devices...");

  if (!db) {
    console.log("  ⚠️  Database not connected");
    return new Map();
  }

  // Clear existing data
  await db.delete(readings);
  await db.delete(alerts);
  await db.delete(devices);

  const deviceIdMap = new Map<string, number>(); // LogId -> new device ID

  // Create unique devices (one per LogId)
  for (const [logId, mapping] of mappings) {
    const [inserted] = await db
      .insert(devices)
      .values({
        name: mapping.name,
        type: mapping.type,
        location: mapping.location,
        ipAddress: `192.168.1.${100 + deviceIdMap.size}`, // Mock IP
        status: 'online',
        lastSeen: new Date(),
      })
      .returning();

    deviceIdMap.set(logId, inserted.id);
    console.log(`  ✓ ${mapping.name} (LogId: ${logId} → ID: ${inserted.id})`);
  }

  console.log(`✅ Created ${deviceIdMap.size} devices`);
  console.log("");

  return deviceIdMap;
}

async function importTrendLogReadings(
  sourceFolder: string,
  deviceIdMap: Map<string, number>,
  mappings: Map<string, DeviceMapping>
): Promise<number> {
  console.log("📊 Importing TrendLog readings...");

  const csvPath = join(sourceFolder, "trendlog_readings.csv");
  if (!existsSync(csvPath)) {
    console.log("  ⚠️  trendlog_readings.csv not found");
    return 0;
  }

  const csvContent = readFileSync(csvPath, "utf-8");
  const records: BMSTrendLogRecord[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`  Found ${records.length.toLocaleString()} BMS trend records`);
  console.log("  Transforming to EMS format...");
  console.log("");

  if (!db) {
    console.log("  ⚠️  Database not connected");
    return 0;
  }

  let imported = 0;
  let skipped = 0;
  const batch: any[] = [];
  const batchSize = 1000;

  // Group by LogId and Timestamp to create consolidated readings
  const readingsByTimestamp = new Map<string, Map<string, any>>();

  for (const record of records) {
    const logId = record.LogId;
    const timestamp = record.Timestamp;
    const itemIndex = parseInt(record.ItemIndex);
    const value = parseFloat(record.Value);

    if (isNaN(value)) continue;

    const deviceId = deviceIdMap.get(logId);
    if (!deviceId) {
      skipped++;
      continue;
    }

    const mapping = mappings.get(logId);
    const paramInfo = mapping?.parameters.get(itemIndex);

    if (!paramInfo) continue;

    // Create unique key for this device + timestamp
    const key = `${deviceId}_${timestamp}`;
    
    if (!readingsByTimestamp.has(key)) {
      readingsByTimestamp.set(key, {
        deviceId,
        timestamp: unixToDate(timestamp),
      });
    }

    const reading = readingsByTimestamp.get(key)!;

    // Map value to appropriate field
    switch (paramInfo.mappedField) {
      case 'power':
        reading.power = value;
        break;
      case 'voltage':
        reading.voltage = value;
        break;
      case 'current':
        reading.current = value;
        break;
      case 'energy':
        reading.energy = value;
        break;
      case 'frequency':
        reading.frequency = value;
        break;
      case 'powerFactor':
        reading.powerFactor = value;
        break;
      default:
        // Store as generic power if numeric
        if (!reading.power) {
          reading.power = value;
        }
    }
  }

  console.log(`  Consolidated into ${readingsByTimestamp.size.toLocaleString()} unique readings`);
  console.log("");

  // Insert consolidated readings
  for (const reading of readingsByTimestamp.values()) {
    batch.push(reading);

    if (batch.length >= batchSize) {
      await db.insert(readings).values(batch);
      imported += batch.length;
      console.log(`  ✓ Imported ${imported.toLocaleString()} readings...`);
      batch.length = 0;
    }
  }

  // Insert remaining
  if (batch.length > 0) {
    await db.insert(readings).values(batch);
    imported += batch.length;
  }

  console.log("");
  console.log(`✅ Imported ${imported.toLocaleString()} readings`);
  console.log(`  (Skipped ${skipped.toLocaleString()} unmapped values)`);
  console.log("");

  return imported;
}

async function importAlarmLogs(
  sourceFolder: string,
  deviceIdMap: Map<string, number>
): Promise<number> {
  console.log("🚨 Importing AlarmLog alerts...");

  const csvPath = join(sourceFolder, "alarmlog_alerts.csv");
  if (!existsSync(csvPath)) {
    console.log("  ⚠️  alarmlog_alerts.csv not found");
    return 0;
  }

  const csvContent = readFileSync(csvPath, "utf-8");
  const records: BMSAlarmLogRecord[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`  Found ${records.length.toLocaleString()} BMS alarm records`);

  if (!db) {
    console.log("  ⚠️  Database not connected");
    return 0;
  }

  let imported = 0;
  const batch: any[] = [];

  for (const record of records) {
    const logId = record.LogId;
    const deviceId = deviceIdMap.get(logId);

    if (!deviceId) continue;

    // Map BMS alarm to EMS alert
    const severity = record.Priority === '0' ? 'critical' : 
                     record.Priority === '1' ? 'warning' : 'info';
    
    const message = record.Message || `Alarm from ${record.SourceTable}`;
    const timestamp = unixToDate(record.Timestamp);

    batch.push({
      deviceId,
      severity,
      message,
      timestamp,
      acknowledged: record.State === '0', // State 0 = cleared/acknowledged
    });

    if (batch.length >= 500) {
      await db.insert(alerts).values(batch);
      imported += batch.length;
      console.log(`  ✓ Imported ${imported.toLocaleString()} alerts...`);
      batch.length = 0;
    }
  }

  // Insert remaining
  if (batch.length > 0) {
    await db.insert(alerts).values(batch);
    imported += batch.length;
  }

  console.log(`✅ Imported ${imported.toLocaleString()} alerts`);
  console.log("");

  return imported;
}

async function main() {
  const args = process.argv.slice(2);
  let sourceFolder = "./exported-data";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      sourceFolder = args[i + 1];
      i++;
    }
  }

  console.log("╔════════════════════════════════════════╗");
  console.log("║  METRO_BHAWAN BMS → EMS Import Tool   ║");
  console.log("╚════════════════════════════════════════╝");
  console.log("");
  console.log("Configuration:");
  console.log(`  Source Folder: ${sourceFolder}`);
  console.log("");

  if (!db) {
    console.log("❌ Error: Database not connected");
    console.log("Please set DATABASE_URL environment  variable");
    process.exit(1);
  }

  if (!existsSync(sourceFolder)) {
    console.log(`❌ Error: Source folder not found: ${sourceFolder}`);
    console.log("");
    console.log("First, export BMS data:");
    console.log("  .\\script\\export-bms-data.ps1");
    process.exit(1);
  }

  try {
    const startTime = Date.now();

    // Step 1: Load device mappings from metadata
    const mappings = await loadDeviceMappings(sourceFolder);

    // Step 2: Create devices in database
    const deviceIdMap = await importDevices(mappings);

    // Step 3: Import trend log readings
    const readingsCount = await importTrendLogReadings(sourceFolder, deviceIdMap, mappings);

    // Step 4: Import alarm logs
    const alertsCount = await importAlarmLogs(sourceFolder, deviceIdMap);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("╔════════════════════════════════════════╗");
    console.log("║         Import Summary                 ║");
    console.log("╚════════════════════════════════════════╝");
    console.log(`  Devices: ${deviceIdMap.size}`);
    console.log(`  Readings: ${readingsCount.toLocaleString()}`);
    console.log(`  Alerts: ${alertsCount.toLocaleString()}`);
    console.log(`  Duration: ${duration}s`);
    console.log("");
    console.log("✅ Real BMS data import completed!");
    console.log("");
    console.log("🎉 Your METRO_BHAWAN building data is now in the EMS!");
    console.log("");
    console.log("Next step:");
    console.log("  npm run dev");
    console.log("");

  } catch (error) {
    console.error("\n❌ Import failed:", error);
    process.exit(1);
  } finally {
    await pool?.end();
  }
}

main();
