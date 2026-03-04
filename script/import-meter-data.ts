/**
 * Import Meter Data from SQL Server Export
 * 
 * This script imports meter data from CSV files exported from SQL Server
 * into the PostgreSQL database.
 * 
 * Usage:
 *   tsx script/import-meter-data.ts --source ./exported-data
 */

import { db, pool } from "../server/db";
import { devices, readings, alerts } from "@shared/schema";
import { parse } from "csv-parse/sync";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface ImportOptions {
  sourceFolder: string;
  clearExisting: boolean;
  batchSize: number;
}

interface SQLServerDevice {
  Id?: string;
  Name: string;
  Type: string;
  Location?: string;
  IpAddress?: string;
  Status?: string;
}

interface SQLServerReading {
  Id?: string;
  DeviceId: string;
  Power?: number;
  Voltage?: number;
  VoltageL1L2?: number;
  VoltageL2L3?: number;
  VoltageL3L1?: number;
  Current?: number;
  CurrentL1?: number;
  CurrentL2?: number;
  CurrentL3?: number;
  Energy?: number;
  Frequency?: number;
  PowerFactor?: number;
  Timestamp: string;
}

interface SQLServerAlert {
  Id?: string;
  DeviceId: string;
  Severity: string;
  Message: string;
  Timestamp: string;
  Acknowledged?: boolean;
}

async function importDevices(sourceFolder: string, clearExisting: boolean): Promise<Map<string, number>> {
  const csvPath = join(sourceFolder, "devices.csv");
  
  if (!existsSync(csvPath)) {
    console.log("⚠️  devices.csv not found, skipping device import");
    return new Map();
  }

  console.log("\n📦 Importing Devices...");
  
  if (clearExisting && db) {
    console.log("  Clearing existing devices...");
    await db.delete(devices);
  }

  const csvContent = readFileSync(csvPath, "utf-8");
  const records: SQLServerDevice[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`  Found ${records.length} devices to import`);

  if (!db) {
    console.log("  ⚠️  Database not connected - skipping import");
    return new Map();
  }

  const deviceIdMap = new Map<string, number>(); // Old ID -> New ID

  for (const record of records) {
    const [inserted] = await db
      .insert(devices)
      .values({
        name: record.Name,
        type: record.Type || "Smart Meter",
        location: record.Location || "Unknown",
        ipAddress: record.IpAddress,
        status: record.Status?.toLowerCase() || "online",
        lastSeen: new Date(),
      })
      .returning();

    if (record.Id) {
      deviceIdMap.set(record.Id, inserted.id);
    }
    
    console.log(`  ✓ Imported device: ${record.Name} (ID: ${inserted.id})`);
  }

  console.log(`✅ Imported ${deviceIdMap.size} devices`);
  return deviceIdMap;
}

async function importReadings(
  sourceFolder: string,
  deviceIdMap: Map<string, number>,
  batchSize: number
): Promise<number> {
  const csvPath = join(sourceFolder, "readings.csv");
  
  if (!existsSync(csvPath)) {
    console.log("⚠️  readings.csv not found, skipping readings import");
    return 0;
  }

  console.log("\n📊 Importing Meter Readings...");

  const csvContent = readFileSync(csvPath, "utf-8");
  const records: SQLServerReading[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`  Found ${records.length} readings to import`);

  if (!db) {
    console.log("  ⚠️  Database not connected - skipping import");
    return 0;
  }

  let imported = 0;
  let batch = [];

  for (const record of records) {
    const newDeviceId = deviceIdMap.get(record.DeviceId);
    
    if (!newDeviceId) {
      console.log(`  ⚠️  Skipping reading - device ID ${record.DeviceId} not found`);
      continue;
    }

    batch.push({
      deviceId: newDeviceId,
      power: record.Power ? Number(record.Power) : undefined,
      voltage: record.Voltage ? Number(record.Voltage) : undefined,
      voltageL1L2: record.VoltageL1L2 ? Number(record.VoltageL1L2) : undefined,
      voltageL2L3: record.VoltageL2L3 ? Number(record.VoltageL2L3) : undefined,
      voltageL3L1: record.VoltageL3L1 ? Number(record.VoltageL3L1) : undefined,
      current: record.Current ? Number(record.Current) : undefined,
      currentL1: record.CurrentL1 ? Number(record.CurrentL1) : undefined,
      currentL2: record.CurrentL2 ? Number(record.CurrentL2) : undefined,
      currentL3: record.CurrentL3 ? Number(record.CurrentL3) : undefined,
      energy: record.Energy ? Number(record.Energy) : undefined,
      frequency: record.Frequency ? Number(record.Frequency) : undefined,
      powerFactor: record.PowerFactor ? Number(record.PowerFactor) : undefined,
      timestamp: new Date(record.Timestamp),
    });

    if (batch.length >= batchSize) {
      await db.insert(readings).values(batch);
      imported += batch.length;
      console.log(`  ✓ Imported ${imported} readings...`);
      batch = [];
    }
  }

  // Insert remaining batch
  if (batch.length > 0) {
    await db.insert(readings).values(batch);
    imported += batch.length;
  }

  console.log(`✅ Imported ${imported} readings`);
  return imported;
}

async function importAlerts(
  sourceFolder: string,
  deviceIdMap: Map<string, number>
): Promise<number> {
  const csvPath = join(sourceFolder, "alerts.csv");
  
  if (!existsSync(csvPath)) {
    console.log("⚠️  alerts.csv not found, skipping alerts import");
    return 0;
  }

  console.log("\n🚨 Importing Alerts...");

  const csvContent = readFileSync(csvPath, "utf-8");
  const records: SQLServerAlert[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`  Found ${records.length} alerts to import`);

  if (!db) {
    console.log("  ⚠️  Database not connected - skipping import");
    return 0;
  }

  let imported = 0;

  for (const record of records) {
    const newDeviceId = deviceIdMap.get(record.DeviceId);
    
    if (!newDeviceId) {
      console.log(`  ⚠️  Skipping alert - device ID ${record.DeviceId} not found`);
      continue;
    }

    await db.insert(alerts).values({
      deviceId: newDeviceId,
      severity: record.Severity.toLowerCase(),
      message: record.Message,
      timestamp: new Date(record.Timestamp),
      acknowledged: record.Acknowledged === true || record.Acknowledged === 'true',
    });

    imported++;
  }

  console.log(`✅ Imported ${imported} alerts`);
  return imported;
}

async function main() {
  const args = process.argv.slice(2);
  const options: ImportOptions = {
    sourceFolder: "./exported-data",
    clearExisting: false,
    batchSize: 1000,
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      options.sourceFolder = args[i + 1];
      i++;
    } else if (args[i] === "--clear") {
      options.clearExisting = true;
    } else if (args[i] === "--batch-size" && args[i + 1]) {
      options.batchSize = parseInt(args[i + 1]);
      i++;
    }
  }

  console.log("╔════════════════════════════════════════╗");
  console.log("║   Energy Pilot - Data Import Tool     ║");
  console.log("╚════════════════════════════════════════╝");
  console.log("");
  console.log("Configuration:");
  console.log(`  Source Folder: ${options.sourceFolder}`);
  console.log(`  Clear Existing: ${options.clearExisting}`);
  console.log(`  Batch Size: ${options.batchSize}`);

  if (!db) {
    console.log("\n❌ Error: Database not connected");
    console.log("Please set DATABASE_URL environment variable");
    process.exit(1);
  }

  if (!existsSync(options.sourceFolder)) {
    console.log(`\n❌ Error: Source folder not found: ${options.sourceFolder}`);
    console.log("\nFirst, export data from SQL Server using:");
    console.log("  powershell .\\script\\sql-server-export.ps1 -BackupFile <path-to-bak-file>");
    process.exit(1);
  }

  try {
    const startTime = Date.now();

    // Import in order: devices -> readings -> alerts
    const deviceIdMap = await importDevices(options.sourceFolder, options.clearExisting);
    const readingsCount = await importReadings(options.sourceFolder, deviceIdMap, options.batchSize);
    const alertsCount = await importAlerts(options.sourceFolder, deviceIdMap);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n╔════════════════════════════════════════╗");
    console.log("║         Import Summary                 ║");
    console.log("╚════════════════════════════════════════╝");
    console.log(`  Devices: ${deviceIdMap.size}`);
    console.log(`  Readings: ${readingsCount}`);
    console.log(`  Alerts: ${alertsCount}`);
    console.log(`  Duration: ${duration}s`);
    console.log("");
    console.log("✅ Import completed successfully!");

  } catch (error) {
    console.error("\n❌ Import failed:", error);
    process.exit(1);
  } finally {
    await pool?.end();
  }
}

main();
