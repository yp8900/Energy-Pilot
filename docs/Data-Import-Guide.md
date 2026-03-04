# Data Import Guide

This guide explains how to import meter data from a SQL Server .bak file into the Energy Pilot PostgreSQL database.

## Overview

The import process has two main steps:
1. **Export**: Extract data from SQL Server backup file to CSV files
2. **Import**: Load CSV data into PostgreSQL database

## Prerequisites

- SQL Server (for restoring .bak file)
- SQL Server Management Studio or PowerShell SqlServer module
- PostgreSQL database configured (DATABASE_URL set)
- Node.js/TypeScript environment

## Step 1: Export Data from SQL Server

### Option A: Using PowerShell Script (Recommended)

```powershell
# Run the export helper script
.\script\sql-server-export.ps1 -BackupFile "C:\path\to\your\backup.bak"

# Optional parameters:
.\script\sql-server-export.ps1 `
  -BackupFile "C:\path\to\backup.bak" `
  -SqlServerInstance "localhost" `
  -DatabaseName "EnergyMeterData" `
  -OutputFolder ".\exported-data"
```

This will:
- Provide SQL commands to restore your .bak file
- Generate BCP export commands
- Create a PowerShell export script

### Option B: Manual Export Steps

1. **Restore the .bak file in SQL Server Management Studio**
   - Right-click Databases → Restore Database
   - Select your .bak file
   - Choose a database name (e.g., "EnergyMeterData")

2. **Identify the table structure**
   ```sql
   -- List all tables
   SELECT TABLE_NAME 
   FROM INFORMATION_SCHEMA.TABLES 
   WHERE TABLE_TYPE = 'BASE TABLE';
   
   -- View table schema
   EXEC sp_help 'YourTableName';
   ```

3. **Export to CSV using BCP or PowerShell**
   ```powershell
   # Using PowerShell
   Import-Module SqlServer
   
   $query = "SELECT * FROM Devices"
   $data = Invoke-Sqlcmd -ServerInstance "localhost" -Database "EnergyMeterData" -Query $query
   $data | Export-Csv -Path ".\exported-data\devices.csv" -NoTypeInformation
   ```

## Step 2: Map SQL Server Schema to PostgreSQL

The import script expects these CSV files:

### devices.csv
```csv
Id,Name,Type,Location,IpAddress,Status
1,Main Meter,Smart Meter,Building A,192.168.1.100,online
2,VFD Panel,PLC,Building B,192.168.1.101,online
```

### readings.csv (last 15 days)
```csv
Id,DeviceId,Power,Voltage,Current,Energy,Frequency,PowerFactor,Timestamp
1,1,150.5,230.2,2.5,1250.8,50.0,0.95,2026-01-24 10:00:00
2,1,155.3,229.8,2.6,1256.1,50.0,0.94,2026-01-24 10:05:00
```

### alerts.csv (last 15 days)
```csv
Id,DeviceId,Severity,Message,Timestamp,Acknowledged
1,1,warning,High power consumption detected,2026-01-24 12:30:00,false
2,2,critical,Communication timeout,2026-01-25 08:15:00,true
```

**Note**: Your SQL Server column names might be different. Update the CSV column headers to match the expected format above.

## Step 3: Import Data into PostgreSQL

### Ensure Database is Running

```bash
# Check DATABASE_URL is set
echo $env:DATABASE_URL  # PowerShell

# Run database migrations if needed
npm run db:push
```

### Run the Import Script

```bash
# Import from default folder (./exported-data)
npm run import-data

# Or with custom source folder
tsx script/import-meter-data.ts --source "C:\path\to\exported-data"

# Clear existing data before import
tsx script/import-meter-data.ts --source ./exported-data --clear

# Adjust batch size for large datasets
tsx script/import-meter-data.ts --source ./exported-data --batch-size 5000
```

### Import Options

- `--source <folder>`: Specify the folder containing CSV files (default: ./exported-data)
- `--clear`: Delete existing data before import
- `--batch-size <number>`: Number of readings to insert per batch (default: 1000)

## Step 4: Verify Import

### Check Data in Database

```sql
-- Count devices
SELECT COUNT(*) FROM devices;

-- Count readings
SELECT COUNT(*) FROM readings;

-- Check date range of readings
SELECT MIN(timestamp), MAX(timestamp) FROM readings;

-- Sample readings
SELECT d.name, r.power, r.voltage, r.timestamp
FROM readings r
JOIN devices d ON d.id = r.device_id
ORDER BY r.timestamp DESC
LIMIT 10;
```

### Or use the Application

1. Start the application: `npm run dev`
2. Navigate to Dashboard to see imported data
3. Check Analytics page for trends over the 15-day period
4. View Devices page to see all imported meters

## Troubleshooting

### SQL Server Connection Issues

```powershell
# Install SQL Server module
Install-Module -Name SqlServer -Scope CurrentUser

# Test connection
Test-NetConnection -ComputerName localhost -Port 1433
```

### CSV Format Issues

- Ensure column names match expected format
- Check for special characters in data (commas, quotes)
- Verify date format is parseable (ISO 8601 recommended)

### PostgreSQL Import Errors

- Check that DATABASE_URL is correct
- Ensure PostgreSQL is running
- Verify schema is up to date: `npm run db:push`
- Check for foreign key constraint violations

### Performance Optimization

For large datasets:
- Increase `--batch-size` to 5000 or 10000
- Temporarily disable indexes during import
- Use PostgreSQL's COPY command for very large files

## Example: Complete Import Workflow

```powershell
# 1. Export from SQL Server
.\script\sql-server-export.ps1 -BackupFile "C:\Backups\MeterData.bak"

# 2. Follow the generated instructions to restore and export

# 3. Verify CSV files
Get-ChildItem .\exported-data\*.csv

# 4. Import to PostgreSQL
tsx script/import-meter-data.ts --source .\exported-data --clear

# 5. Start the application
npm run dev
```

## Schema Mapping Reference

| SQL Server Column | PostgreSQL Column | Type | Notes |
|------------------|-------------------|------|-------|
| Id | id (auto-generated) | integer | New IDs assigned on import |
| Name | name | text | Device/meter name |
| Type | type | text | 'Smart Meter', 'PLC', 'Sensor' |
| Location | location | text | Physical location |
| IpAddress | ipAddress | text | IP address |
| Status | status | text | 'online', 'offline', 'maintenance' |
| Power | power | double | kW |
| Voltage | voltage | double | V (average) |
| VoltageL1L2 | voltageL1L2 | double | V L1-L2 phase |
| Current | current | double | A (average) |
| CurrentL1 | currentL1 | double | A L1 phase |
| Energy | energy | double | kWh total |
| Frequency | frequency | double | Hz |
| PowerFactor | powerFactor | double | Power factor |
| Timestamp | timestamp | timestamp | Reading timestamp |

## Support

If you encounter issues during import:
1. Check the error messages in the console
2. Verify CSV file formats
3. Review database connection settings
4. Check PostgreSQL logs for detailed error information
