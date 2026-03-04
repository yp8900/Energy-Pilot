# Data Import Scripts

This folder contains scripts to import meter data from SQL Server backup files into PostgreSQL.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Export Data from SQL Server

```powershell
# Run the PowerShell export helper
.\script\sql-server-export.ps1 -BackupFile "C:\path\to\your\backup.bak"
```

This will guide you through:
- Restoring the .bak file
- Exporting tables to CSV files
- Saving CSVs to `./exported-data` folder

### 3. Import Data to PostgreSQL

```bash
# Make sure DATABASE_URL is set
# Then run the import
npm run import-data

# Or with options:
npm run import-data -- --source ./exported-data --clear
```

## Files

- **sql-server-export.ps1** - PowerShell script to help export data from SQL Server
- **import-meter-data.ts** - TypeScript script to import CSV data into PostgreSQL

## Options

### sql-server-export.ps1

```powershell
-BackupFile       # Path to .bak file (required)
-SqlServerInstance # SQL Server instance (default: localhost)
-DatabaseName     # Database name for restore (default: EnergyMeterData)
-OutputFolder     # Where to save CSVs (default: ./exported-data)
```

### import-meter-data.ts

```bash
--source <folder>     # Folder with CSV files (default: ./exported-data)
--clear              # Clear existing data before import
--batch-size <num>   # Batch size for inserts (default: 1000)
```

## Example Workflow

```powershell
# 1. Export from SQL Server
.\script\sql-server-export.ps1 -BackupFile "C:\Backups\meters.bak"

# 2. Follow prompts to restore DB and export CSVs

# 3. Import to PostgreSQL
npm run import-data -- --source .\exported-data --clear

# 4. Verify
npm run dev
# Check Dashboard for imported data
```

## CSV Format

The import script expects these files in the source folder:

- **devices.csv** - Device/meter information
- **readings.csv** - Meter readings (last 15 days recommended)
- **alerts.csv** - Alert history (optional)

See [Data Import Guide](../docs/Data-Import-Guide.md) for detailed CSV format specifications.

## Troubleshooting

### "Database not connected"
- Ensure `DATABASE_URL` environment variable is set
- Check PostgreSQL is running

### "CSV file not found"
- Verify files are in the `--source` folder
- Check file names match: devices.csv, readings.csv, alerts.csv

### SQL Server connection issues
- Install PowerShell SqlServer module: `Install-Module -Name SqlServer`
- Verify SQL Server is accessible

## See Also

- [Complete Data Import Guide](../docs/Data-Import-Guide.md)
- [Database Schema](../shared/schema.ts)
