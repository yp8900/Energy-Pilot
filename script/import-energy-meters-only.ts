/**
 * Import ONLY Energy Meters from METRO_BHAWAN BMS
 * 
 * This script:
 * 1. Uses discovered-energy-meters.json to identify real energy meters
 * 2. Only imports EM_* parameters (power, voltage, current, energy, etc.)
 * 3. Creates proper device hierarchy
 * 4. Stores discovery metadata for BMS Integration page display
 * 
 * Usage:
 *   npm run import-energy-meters -- --source ./exported-data
 */

import dotenv from "dotenv";
dotenv.config();

import { db, pool } from "../server/db";
import { devices, readings } from "@shared/schema";
import { parse } from "csv-parse/sync";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { eq } from "drizzle-orm";

interface DiscoveredMeter {
  Name: string;
  Type: string;
  LogIds: number[];
  Parameters: string[];
  ParameterDetails: Record<string, Array<{
    LogId: string;
    Path: string;
    Unit: string;
  }>>;
}

interface Discovery {
  DiscoveredAt: string;
  TotalMeters: number;
  TotalParameters: number;
  Meters: DiscoveredMeter[];
}

interface TrendLogRecord {
  SourceTable: string;
  LogId: string;
  SeqNum: string;
  RecordType: string;
  ItemIndex: string;
  Value: string;
  Timestamp: string;
}

// Parse command line arguments
const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source');
const sourceFolder = sourceIndex >= 0 ? args[sourceIndex + 1] : './exported-data';

console.log('\n╔════════════════════════════════════════╗');
console.log('║  Energy Meter Import Tool (Clean)    ║');
console.log('╚════════════════════════════════════════╝\n');
console.log('Configuration:');
console.log(`  Source Folder: ${sourceFolder}\n`);

// Check database connection
if (!db || !pool) {
  console.log('\n❌ Error: Database not connected');
  console.log('Please set DATABASE_URL environment variable\n');
  process.exit(1);
}

// Load discovered energy meters
const discoveryPath = join(sourceFolder, 'discovered-energy-meters.json');
if (!existsSync(discoveryPath)) {
  console.log('\n❌ Error: discovered-energy-meters.json not found');
  console.log('Please run: .\\script\\discover-energy-meters.ps1 first\n');
  process.exit(1);
}

const discovery: Discovery = JSON.parse(readFileSync(discoveryPath, 'utf-8'));

console.log(`✅ Loaded discovery data:`);
console.log(`   Meters: ${discovery.TotalMeters}`);
console.log(`   Parameters: ${discovery.TotalParameters}`);
console.log(`   Discovered: ${discovery.DiscoveredAt}\n`);

// Load trend log readings
const trendLogPath = join(sourceFolder, 'trendlog_readings.csv');
if (!existsSync(trendLogPath)) {
  console.log('\n❌ Error: trendlog_readings.csv not found\n');
  process.exit(1);
}

console.log('📂 Loading trendlog readings...');
const csvContent = readFileSync(trendLogPath, 'utf-8');
const allRecords = parse(csvContent, {
  columns: ['SourceTable', 'LogId', 'SeqNum', 'RecordType', 'ItemIndex', 'Value', 'Timestamp'],
  skip_empty_lines: true,
  from_line: 2 // Skip header
}) as TrendLogRecord[];

console.log(`   Total records in CSV: ${allRecords.toLocaleString()}`);
console.log(`   Sample record LogId: ${allRecords[0]?.LogId}`);
console.log(`   Sample record type: ${typeof allRecords[0]?.LogId}\n`);

// Filter records to only include energy meter LogIds
const energyMeterLogIds = new Set<string>();
for (const meter of discovery.Meters) {
  for (const logId of meter.LogIds) {
    energyMeterLogIds.add(logId.toString());
  }
}

console.log(`🔍 Energy Meter LogIds to filter: ${Array.from(energyMeterLogIds).slice(0, 10).join(', ')}...\n`);

// Sample some LogIds from records to debug
const sampleLogIds = new Set(allRecords.slice(0, 100).map(r => r.LogId));
console.log(`📋 Sample LogIds from readings: ${Array.from(sampleLogIds).slice(0, 10).join(', ')}...\n`);

console.log('🔧 Filtering energy meter data only...');
const energyRecords = allRecords.filter(r => energyMeterLogIds.has(r.LogId));
console.log(`   ✅ Filtered: ${energyRecords.toLocaleString()} energy meter readings\n`);
console.log(`   ⚠️  Excluded: ${(allRecords.length - energyRecords.length).toLocaleString()} non-energy records\n`);

// Convert Unix timestamp to Date
function unixToDate(unixTimestamp: string): Date {
  const seconds = parseInt(unixTimestamp);
  return new Date(seconds * 1000);
}

// Map parameter to field name
function mapParameterToField(parameter: string): string {
  const mapping: Record<string, string> = {
    'EM_CURRENT': 'current',
    'EM_VOLTAGE': 'voltage',
    'EM_POWER': 'power',
    'EM_ENERGY': 'energy',
    'EM_FREQUENCY': 'frequency',
    'EM_PF': 'powerFactor',
    'EM_APPARENT_POWER': 'apparentPower',
    'EM_REACTIVE_POWER': 'reactivePower'
  };
  return mapping[parameter] || 'current';
}

async function importEnergyMeters() {
  console.log('📊 Importing Energy Meters...\n');
  
  const deviceMap = new Map<string, number>(); // name -> device.id
  let devicesCreated = 0;
  
  // Create devices from discovered meters
  for (const meter of discovery.Meters) {
    try {
      const [device] = await db.insert(devices).values({
        name: meter.Name === 'Unknown' ? `Meter ${meter.LogIds[0]}` : meter.Name,
        type: 'energy-meter',
        location: 'METRO_BHAWAN',
        ipAddress: '0.0.0.0', // BMS data source
        modbusAddress: meter.LogIds[0], // Use LogId as identifier
        protocol: 'bacnet',
        manufacturer: 'Loytec',
        model: 'BMS Integration',
        status: 'active',
        metadata: {
          source: 'metro_bhawan_bms',
          logIds: meter.LogIds,
          parameters: meter.Parameters,
          discoveredAt: discovery.DiscoveredAt
        }
      }).returning();
      
      deviceMap.set(meter.Name, device.id);
      devicesCreated++;
      console.log(`  ✓ ${meter.Name} (LogIds: ${meter.LogIds.join(', ')} → Device ID: ${device.id})`);
    } catch (error) {
      console.error(`  ✗ Failed to create device ${meter.Name}:`, error);
    }
  }
  
  console.log(`\n✅ Created ${devicesCreated} energy meter devices\n`);
  
  // Import readings with consolidation
  console.log('📊 Importing meter readings...\n');
  
  // Group readings by device + timestamp
  const readingsByKey = new Map<string, Record<string, any>>();
  
  for (const record of energyRecords) {
    // Find which meter this LogId belongs to
    const meter = discovery.Meters.find(m => m.LogIds.includes(parseInt(record.LogId)));
    if (!meter) continue;
    
    const deviceId = deviceMap.get(meter.Name);
    if (!deviceId) continue;
    
    // Find the parameter for this LogId
    let parameter = 'EM_CURRENT';
    for (const [param, details] of Object.entries(meter.ParameterDetails)) {
      if (details.some(d => d.LogId === record.LogId)) {
        parameter = param;
        break;
      }
    }
    
    const timestamp = unixToDate(record.Timestamp);
    const key = `${deviceId}-${timestamp.toISOString()}`;
    
    if (!readingsByKey.has(key)) {
      readingsByKey.set(key, {
        deviceId,
        timestamp,
        power: null,
        voltage: null,
        current: null,
        energy: null,
        frequency: null,
        powerFactor: null,
        apparentPower: null,
        reactivePower: null
      });
    }
    
    const reading = readingsByKey.get(key)!;
    const field = mapParameterToField(parameter);
    reading[field] = parseFloat(record.Value);
  }
  
  console.log(`   Consolidated to ${readingsByKey.size.toLocaleString()} unique readings\n`);
  
  // Insert readings in batches
  const batchSize = 500;
  const readingsArray = Array.from(readingsByKey.values());
  let imported = 0;
  
  for (let i = 0; i < readingsArray.length; i += batchSize) {
    const batch = readingsArray.slice(i, i + batchSize);
    try {
      await db.insert(readings).values(batch);
      imported += batch.length;
      if (imported % 5000 === 0 || imported === readingsArray.length) {
        console.log(`  ✓ Imported ${imported.toLocaleString()} readings...`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to import batch at ${i}:`, error);
    }
  }
  
  console.log(`\n✅ Imported ${imported.toLocaleString()} energy meter readings\n`);
}

// Main execution
const startTime = Date.now();

importEnergyMeters()
  .then(() => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('╔════════════════════════════════════════╗');
    console.log('║         Import Summary                 ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`  Energy Meters: ${discovery.TotalMeters}`);
    console.log(`  Duration: ${duration}s\n`);
    console.log('✅ Energy meter import completed!\n');
    console.log('🎉 Your METRO_BHAWAN energy meters are ready!\n');
    console.log('Next step:');
    console.log('  npm run dev\n');
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
