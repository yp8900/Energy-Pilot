/**
 * Discover Energy Meters from METRO_BHAWAN BMS
 * 
 * Analyzes LogItemInfo.csv to find Modbus energy meters under:
 * Datapoints/Modbus Port RS485/Datapoints/PGM1/[MeterName]/[Parameters]
 * 
 * Usage:
 *   tsx script/discover-energy-meters.ts --source ./exported-data
 */

import dotenv from "dotenv";
dotenv.config();

import { parse } from "csv-parse/sync";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

interface BMSLogItemInfo {
  LogId: string;
  ItemId: string;
  ItemIndex: string;
  AbsolutePath: string;
  Unit: string;
}

interface EnergyMeterParameter {
  logId: string;
  itemIndex: string;
  parameterName: string; // WH, W, Am, VLL, VLN, etc.
  unit: string;
  absolutePath: string;
}

interface EnergyMeter {
  name: string; // e.g., "EM/MAIN", "EM/CHILLER"
  fullPath: string;
  parameters: EnergyMeterParameter[];
}

const MODBUS_PATH_PATTERN = "Modbus Port RS485/Datapoints/PGM1";

function parseLogItemInfo(sourceFolder: string): BMSLogItemInfo[] {
  const filePath = join(sourceFolder, "LogItemInfo.csv");
  
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

function discoverEnergyMeters(logItems: BMSLogItemInfo[]): Map<string, EnergyMeter> {
  const meters = new Map<string, EnergyMeter>();

  // Filter only Modbus energy meter paths
  const modbusItems = logItems.filter(item => 
    item.AbsolutePath && item.AbsolutePath.includes(MODBUS_PATH_PATTERN)
  );

  console.log(`\n📊 Found ${modbusItems.length} Modbus datapoints`);

  for (const item of modbusItems) {
    // Extract meter name from path
    // Example: Datapoints/Modbus Port RS485/Datapoints/PGM1/EM/MAIN/WH
    // Meter: EM/MAIN, Parameter: WH
    const pathParts = item.AbsolutePath.split("/");
    const pgmIndex = pathParts.findIndex(p => p === "PGM1");
    
    if (pgmIndex === -1 || pgmIndex + 2 >= pathParts.length) {
      continue; // Not a valid meter path
    }

    // Extract meter path (everything between PGM1 and last parameter)
    const meterParts = pathParts.slice(pgmIndex + 1, pathParts.length - 1);
    const meterName = meterParts.join("/");
    const parameterName = pathParts[pathParts.length - 1];

    if (!meterName || !parameterName) {
      continue;
    }

    // Create or update meter
    if (!meters.has(meterName)) {
      meters.set(meterName, {
        name: meterName,
        fullPath: pathParts.slice(0, pathParts.length - 1).join("/"),
        parameters: []
      });
    }

    const meter = meters.get(meterName)!;
    meter.parameters.push({
      logId: item.LogId,
      itemIndex: item.ItemIndex,
      parameterName: parameterName,
      unit: item.Unit || "",
      absolutePath: item.AbsolutePath
    });
  }

  return meters;
}

function printDiscoveryReport(meters: Map<string, EnergyMeter>) {
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║     METRO_BHAWAN Energy Meter Discovery Report        ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(`\n✅ Discovered ${meters.size} Energy Meters\n`);

  let totalParameters = 0;

  for (const [name, meter] of meters.entries()) {
    console.log(`\n📊 ${name}`);
    console.log(`   Path: ${meter.fullPath}`);
    console.log(`   Parameters (${meter.parameters.length}):`);
    
    // Group by parameter type
    const paramGroups = new Map<string, number>();
    for (const param of meter.parameters) {
      paramGroups.set(param.parameterName, (paramGroups.get(param.parameterName) || 0) + 1);
      totalParameters++;
    }

    for (const [paramName, count] of paramGroups) {
      const sample = meter.parameters.find(p => p.parameterName === paramName)!;
      console.log(`      • ${paramName.padEnd(15)} (${sample.unit || "no unit"}) - LogId: ${sample.logId}`);
    }
  }

  console.log(`\n📈 Total Parameters: ${totalParameters}`);
  console.log(`\n💾 Saving discovery results to: exported-data/discovered-energy-meters.json`);
}

async function main() {
  const args = process.argv.slice(2);
  const sourceIndex = args.indexOf("--source");
  const sourceFolder = sourceIndex >= 0 && args[sourceIndex + 1] 
    ? args[sourceIndex + 1] 
    : "./exported-data";

  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║     Energy Meter Discovery Tool                        ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(`\nConfiguration:`);
  console.log(`  Source Folder: ${sourceFolder}`);
  console.log(`  Path Pattern: ${MODBUS_PATH_PATTERN}`);

  // Load LogItemInfo
  console.log("\n🔍 Loading LogItemInfo...");
  const logItems = parseLogItemInfo(sourceFolder);
  console.log(`   Total items: ${logItems.length}`);

  // Discover energy meters
  console.log("\n🔍 Discovering energy meters...");
  const meters = discoverEnergyMeters(logItems);

  // Print report
  printDiscoveryReport(meters);

  // Save to JSON
  const outputPath = join(sourceFolder, "discovered-energy-meters.json");
  const meterArray = Array.from(meters.values()).map(meter => ({
    name: meter.name,
    fullPath: meter.fullPath,
    parameterCount: meter.parameters.length,
    parameters: meter.parameters.map(p => ({
      logId: p.logId,
      itemIndex: p.itemIndex,
      name: p.parameterName,
      unit: p.unit,
      path: p.absolutePath
    }))
  }));

  writeFileSync(outputPath, JSON.stringify(meterArray, null, 2));
  console.log(`✅ Discovery complete!\n`);
}

main().catch(console.error);
