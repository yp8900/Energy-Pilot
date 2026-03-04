/**
 * Automatic BMS Database Schema Detector and Mapper
 * 
 * This script connects to SQL Server, analyzes the BMS database schema,
 * and creates a mapping strategy to import into PostgreSQL.
 * 
 * Usage:
 *   tsx script/analyze-bms-database.ts --instance "localhost\SQLEXPRESS" --database "METRO_BHAWAN"
 */

import pg from "pg";
import mssql from "mssql";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

interface TableInfo {
  schema: string;
  table: string;
  rowCount: number;
  columns: ColumnInfo[];
}

interface ColumnInfo {
  name: string;
  dataType: string;
  maxLength: number | null;
  isNullable: boolean;
  isPrimaryKey: boolean;
}

interface MappingStrategy {
  sourceTable: string;
  targetTable: string;
  columnMappings: { source: string; target: string; transform?: string }[];
}

const args = process.argv.slice(2);
let sqlServerInstance = "localhost\\SQLEXPRESS";
let databaseName = "METRO_BHAWAN";

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--instance" && args[i + 1]) {
    sqlServerInstance = args[i + 1];
    i++;
  } else if (args[i] === "--database" && args[i + 1]) {
    databaseName = args[i + 1];
    i++;
  }
}

async function analyzeSqlServerDatabase(): Promise<TableInfo[]> {
  console.log("🔍 Connecting to SQL Server...");
  console.log(`   Instance: ${sqlServerInstance}`);
  console.log(`   Database: ${databaseName}`);
  console.log("");

  const config: mssql.config = {
    server: sqlServerInstance,
    database: databaseName,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
      instanceName: sqlServerInstance.includes("\\") ? sqlServerInstance.split("\\")[1] : undefined,
    },
    authentication: {
      type: "ntlm",
      options: {
        domain: "",
        userName: "",
        password: "",
      },
    },
    connectionTimeout: 30000,
    requestTimeout: 30000,
  };

  // Try to connect
  let pool;
  try {
    pool = await mssql.connect(config);
  } catch (error: any) {
    console.log("❌ Failed with NTLM, trying default authentication...");
    
    // Try with default auth (Windows Authentication)
    const defaultConfig: mssql.config = {
      server: sqlServerInstance,
      database: databaseName,
      options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        trustedConnection: true,
      },
      connectionTimeout: 30000,
      requestTimeout: 30000,
    };
    
    pool = await mssql.connect(defaultConfig);
  }
  
  console.log("✅ Connected to SQL Server");
  console.log("");

  // Get all tables
  console.log("📋 Discovering tables...");
  const tablesResult = await pool.request().query(`
    SELECT 
      TABLE_SCHEMA,
      TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);

  const tables: TableInfo[] = [];

  for (const table of tablesResult.recordset) {
    const fullTableName = `[${table.TABLE_SCHEMA}].[${table.TABLE_NAME}]`;

    // Get row count
    const countResult = await pool.request().query(`
      SELECT COUNT(*) as RowCount FROM ${fullTableName}
    `);
    const rowCount = countResult.recordset[0].RowCount;

    // Get columns
    const columnsResult = await pool.request().query(`
      SELECT 
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.IS_NULLABLE,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PRIMARY_KEY
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN (
        SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
          ON tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          AND tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
          AND tc.TABLE_NAME = ku.TABLE_NAME
      ) pk
        ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA
        AND c.TABLE_NAME = pk.TABLE_NAME
        AND c.COLUMN_NAME = pk.COLUMN_NAME
      WHERE c.TABLE_SCHEMA = '${table.TABLE_SCHEMA}'
        AND c.TABLE_NAME = '${table.TABLE_NAME}'
      ORDER BY c.ORDINAL_POSITION
    `);

    const columns: ColumnInfo[] = columnsResult.recordset.map((col: any) => ({
      name: col.COLUMN_NAME,
      dataType: col.DATA_TYPE,
      maxLength: col.CHARACTER_MAXIMUM_LENGTH,
      isNullable: col.IS_NULLABLE === "YES",
      isPrimaryKey: col.IS_PRIMARY_KEY === 1,
    }));

    tables.push({
      schema: table.TABLE_SCHEMA,
      table: table.TABLE_NAME,
      rowCount,
      columns,
    });

    console.log(`  ✓ ${table.TABLE_NAME} (${rowCount.toLocaleString()} rows, ${columns.length} columns)`);
  }

  await pool.close();
  console.log("");
  console.log(`✅ Found ${tables.length} tables`);
  console.log("");

  return tables;
}

function createMappingStrategy(tables: TableInfo[]): MappingStrategy[] {
  console.log("🗺️  Creating mapping strategy...");
  console.log("");

  const mappings: MappingStrategy[] = [];

  // Define common BMS/EMS table patterns
  const patterns = {
    devices: /^(device|meter|equipment|point|sensor|controller)s?$/i,
    readings: /^(reading|measurement|data|value|trend|history|log)s?$/i,
    alerts: /^(alert|alarm|event|notification)s?$/i,
    users: /^(user|account|person|operator)s?$/i,
  };

  for (const table of tables) {
    const tableName = table.table;
    let targetTable = "";
    const columnMappings: { source: string; target: string; transform?: string }[] = [];

    // Detect target table by pattern matching
    if (patterns.devices.test(tableName)) {
      targetTable = "devices";
      console.log(`  📍 ${tableName} → devices`);

      // Map columns
      for (const col of table.columns) {
        const colLower = col.name.toLowerCase();
        
        if (/^(id|device_?id|meter_?id)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "id" });
        } else if (/^(name|device_?name|meter_?name|description)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "name" });
        } else if (/^(type|device_?type|category)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "type" });
        } else if (/^(location|site|building|area)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "location" });
        } else if (/^(ip|ip_?address|network_?address)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "ipAddress" });
        } else if (/^(status|state|online)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "status" });
        }
      }
    } else if (patterns.readings.test(tableName)) {
      targetTable = "readings";
      console.log(`  📊 ${tableName} → readings`);

      for (const col of table.columns) {
        const colLower = col.name.toLowerCase();
        
        if (/^(device_?id|meter_?id|point_?id)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "deviceId" });
        } else if (/^(power|active_?power|kw|real_?power)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "power" });
        } else if (/^(voltage|volt|v)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "voltage" });
        } else if (/^(current|amp|a)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "current" });
        } else if (/^(energy|kwh|total_?energy)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "energy" });
        } else if (/^(frequency|freq|hz)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "frequency" });
        } else if (/^(power_?factor|pf|cos_?phi)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "powerFactor" });
        } else if (/^(timestamp|datetime|time|date|recorded_?at)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "timestamp" });
        }
      }
    } else if (patterns.alerts.test(tableName)) {
      targetTable = "alerts";
      console.log(`  🚨 ${tableName} → alerts`);

      for (const col of table.columns) {
        if (/^(device_?id|meter_?id|point_?id)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "deviceId" });
        } else if (/^(severity|priority|level)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "severity" });
        } else if (/^(message|description|text|details)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "message" });
        } else if (/^(timestamp|datetime|time|date|created_?at)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "timestamp" });
        } else if (/^(acknowledged|ack|is_?acknowledged)$/i.test(col.name)) {
          columnMappings.push({ source: col.name, target: "acknowledged" });
        }
      }
    } else {
      console.log(`  ⚠️  ${tableName} → (unmapped - will be available for custom export)`);
    }

    if (targetTable && columnMappings.length > 0) {
      mappings.push({
        sourceTable: `${table.schema}.${table.table}`,
        targetTable,
        columnMappings,
      });
    }
  }

  console.log("");
  console.log(`✅ Created ${mappings.length} table mappings`);
  console.log("");

  return mappings;
}

function generateExportScript(
  tables: TableInfo[],
  mappings: MappingStrategy[],
  instance: string,
  database: string
): string {
  const script = `# BMS Database Export Script
# Auto-generated by analyze-bms-database.ts
# Database: ${database}
# Instance: ${instance}

param(
    [Parameter(Mandatory=$false)]
    [string]$OutputFolder = ".\\exported-data",
    
    [Parameter(Mandatory=$false)]
    [int]$DaysOfHistory = 15
)

$SqlServerInstance = "${instance}"
$DatabaseName = "${database}"

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   BMS Data Export Tool                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Import-Module SqlServer -ErrorAction Stop

if (-not (Test-Path $OutputFolder)) {
    New-Item -ItemType Directory -Path $OutputFolder | Out-Null
}

Write-Host "📊 Export Configuration:" -ForegroundColor Yellow
Write-Host "  Database: $DatabaseName" -ForegroundColor Gray
Write-Host "  Instance: $SqlServerInstance" -ForegroundColor Gray
Write-Host "  Output: $OutputFolder" -ForegroundColor Gray
Write-Host "  History: Last $DaysOfHistory days" -ForegroundColor Gray
Write-Host ""

`;

  let exportCommands = "";

  for (const mapping of mappings) {
    const table = tables.find((t) => `${t.schema}.${t.table}` === mapping.sourceTable);
    if (!table) continue;

    const sourceColumns = mapping.columnMappings.map((m) => `[${m.source}]`).join(", ");
    const hasTimestamp = mapping.columnMappings.some((m) => 
      /timestamp|datetime|date|time/i.test(m.source)
    );

    exportCommands += `# Export ${table.table} → ${mapping.targetTable}\n`;
    exportCommands += `Write-Host "📤 Exporting ${table.table}..." -ForegroundColor Cyan\n`;

    let query = `SELECT ${sourceColumns} FROM [${table.schema}].[${table.table}]`;
    
    if (hasTimestamp && mapping.targetTable === "readings") {
      const timestampCol = mapping.columnMappings.find((m) => 
        /timestamp|datetime|date|time/i.test(m.source)
      )?.source;
      query += ` WHERE [${timestampCol}] >= DATEADD(day, -$DaysOfHistory, GETDATE())`;
      query += ` ORDER BY [${timestampCol}]`;
    }

    exportCommands += `$data = Invoke-Sqlcmd -ServerInstance $SqlServerInstance -Database $DatabaseName -TrustServerCertificate -Query "${query}"\n`;
    exportCommands += `$data | Export-Csv -Path "$OutputFolder\\${mapping.targetTable}.csv" -NoTypeInformation\n`;
    exportCommands += `Write-Host "  ✓ Exported $($data.Count) rows" -ForegroundColor Green\n`;
    exportCommands += `Write-Host ""\n\n`;
  }

  // Export all tables for reference
  exportCommands += `# Export full schema documentation\n`;
  exportCommands += `Write-Host "📝 Exporting schema documentation..." -ForegroundColor Cyan\n`;
  exportCommands += `$allTables = @()\n`;
  
  for (const table of tables) {
    exportCommands += `$allTables += Invoke-Sqlcmd -ServerInstance $SqlServerInstance -Database $DatabaseName -TrustServerCertificate -Query "SELECT TOP 1000 * FROM [${table.schema}].[${table.table}]"\n`;
  }
  
  exportCommands += `\nWrite-Host "✅ Export complete!" -ForegroundColor Green\n`;
  exportCommands += `Write-Host ""\n`;
  exportCommands += `Write-Host "Next step: Import into PostgreSQL" -ForegroundColor Yellow\n`;
  exportCommands += `Write-Host "  npm run import-data -- --source $OutputFolder" -ForegroundColor Gray\n`;

  return script + exportCommands;
}

async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║  BMS Database Schema Analyzer          ║");
  console.log("╚════════════════════════════════════════╝");
  console.log("");

  try {
    // Analyze SQL Server database
    const tables = await analyzeSqlServerDatabase();

    // Display detailed table information
    console.log("📋 Detailed Table Information:");
    console.log("");
    
    for (const table of tables) {
      console.log(`  📊 ${table.table} (${table.rowCount.toLocaleString()} rows)`);
      console.log(`     Schema: ${table.schema}`);
      console.log(`     Columns:`);
      
      for (const col of table.columns) {
        const pkFlag = col.isPrimaryKey ? " [PK]" : "";
        const nullFlag = col.isNullable ? " NULL" : " NOT NULL";
        const length = col.maxLength ? `(${col.maxLength})` : "";
        console.log(`       - ${col.name}: ${col.dataType}${length}${nullFlag}${pkFlag}`);
      }
      console.log("");
    }

    // Create mapping strategy
    const mappings = createMappingStrategy(tables);

    // Generate export script
    console.log("📝 Generating custom export script...");
    const exportScript = generateExportScript(tables, mappings, sqlServerInstance, databaseName);
    
    const outputDir = "./exported-data";
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const scriptPath = join(outputDir, "custom-export.ps1");
    writeFileSync(scriptPath, exportScript, "utf-8");
    console.log(`  ✅ Created: ${scriptPath}`);
    console.log("");

    // Save mapping documentation
    const mappingDoc = JSON.stringify({ tables, mappings }, null, 2);
    const mappingPath = join(outputDir, "schema-mapping.json");
    writeFileSync(mappingPath, mappingDoc, "utf-8");
    console.log(`  ✅ Created: ${mappingPath}`);
    console.log("");

    // Summary
    console.log("╔════════════════════════════════════════╗");
    console.log("║         Analysis Complete!             ║");
    console.log("╚════════════════════════════════════════╝");
    console.log("");
    console.log("📊 Summary:");
    console.log(`  Tables analyzed: ${tables.length}`);
    console.log(`  Tables mapped: ${mappings.length}`);
    console.log  (`  Total rows: ${tables.reduce((sum, t) => sum + t.rowCount, 0).toLocaleString()}`);
    console.log("");
    console.log("Next Steps:");
    console.log("  1. Review schema-mapping.json for column mappings");
    console.log("  2. Run the export script:");
    console.log(`     .\\exported-data\\custom-export.ps1`);
    console.log("  3. Import into PostgreSQL:");
    console.log("     npm run import-data");
    console.log("");

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error("");
    console.error("Troubleshooting:");
    console.error("  - Ensure SQL Server 2022 is installed and running");
    console.error("  - Verify the database has been restored");
    console.error("  - Check instance name (usually 'localhost\\SQLEXPRESS')");
    console.error("  - Ensure Windows Authentication is enabled");
    process.exit(1);
  }
}

main();
