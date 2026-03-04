# Real-World BMS Database Migration Guide

This guide walks you through migrating real BMS (Building Management System) data from SQL Server to your Energy Pilot EMS application - a practical, hands-on approach for real projects.

## Scenario

You have a SQL Server backup file (.bak) from a BMS system (e.g., METRO_BHAWAN.bak) and need to:
1. Restore the database
2. Analyze and understand the schema
3. Map BMS tables to your EMS schema
4. Export and import the data

This is exactly what you'll face in real projects when integrating with existing BMS systems.

---

## Phase 1: SQL Server Setup

### Step 1: Install SQL Server 2022 Express (if needed)

Your backup is from SQL Server 2022. If you don't have SQL Server 2022 installed:

```powershell
# Run the installer script
.\script\install-sql2022-express.ps1
```

**Installation Steps:**
1. Choose "Basic" installation
2. Accept license terms
3. Note the instance name (usually `SQLEXPRESS`)
4. Wait 5-10 minutes for installation

### Step 2: Verify SQL Server is Running

```powershell
# Check SQL Server services
Get-Service | Where-Object {$_.Name -like 'MSSQL*'}

# Expected output: MSSQL$SQLEXPRESS should be "Running"
```

---

## Phase 2: Restore and Analyze BMS Database

### Step 3: Restore Your BMS Backup

```powershell
# Restore and inspect the database
.\script\restore-and-inspect.ps1 `
  -BackupFile "E:\Applications\METRO_BHAWAN.bak" `
  -SqlServerInstance "localhost\SQLEXPRESS" `
  -DatabaseName "METRO_BHAWAN"
```

**What this does:**
- Reads the backup file structure
- Restores the database to SQL Server
- Lists all tables and their schemas
- Shows row counts and column definitions

**Example Output:**
```
📋 Tables found in database:

  📋 Devices
     Schema: dbo | Rows: 150
     Columns:
       - DeviceID (int) NOT NULL [PK]
       - DeviceName (nvarchar(100)) NOT NULL
       - Location (nvarchar(255)) NULL
       - IPAddress (varchar(15)) NULL
       ...

  📋 MeterReadings
     Schema: dbo | Rows: 1,245,890
     Columns:
       - ReadingID (bigint) NOT NULL [PK]
       - DeviceID (int) NOT NULL
       - ActivePower (float) NULL
       - Voltage (float) NULL
       - Timestamp (datetime) NOT NULL
       ...
```

### Step 4: Analyze BMS Database Schema

Now run the automatic schema analyzer:

```bash
npm run analyze-bms -- --instance "localhost\SQLEXPRESS" --database "METRO_BHAWAN"
```

**What this does:**
- Connects to your BMS database
- Analyzes every table and column
- Automatically detects common BMS patterns:
  - Devices/Meters/Points → `devices` table
  - Readings/Measurements/Data → `readings` table
  - Alerts/Alarms/Events → `alerts` table
- Creates intelligent column mappings (e.g., `ActivePower` → `power`)
- Generates a custom export script for YOUR specific schema

**Output Files:**
- `exported-data/schema-mapping.json` - Complete mapping documentation
- `exported-data/custom-export.ps1` - Custom PowerShell export script

**Example Mapping Output:**
```
🗺️  Creating mapping strategy...

  📍 Devices → devices
     DeviceID → id
     DeviceName → name
     DeviceType → type
     Location → location
     IPAddress → ipAddress

  📊 MeterReadings → readings
     DeviceID → deviceId
     ActivePower → power
     Voltage → voltage Current → current
     Timestamp → timestamp
```

---

## Phase 3: Export BMS Data

### Step 5: Review the Mapping

Open the generated mapping file to review how your BMS schema maps to EMS:

```bash
code exported-data/schema-mapping.json
```

**What to check:**
- Are all important tables mapped?
- Are column mappings correct?
- Any custom fields you need to handle?

### Step 6: Run the Custom Export

```powershell
# Export with default settings (last 15 days)
.\exported-data\custom-export.ps1

# Or customize:
.\exported-data\custom-export.ps1 -DaysOfHistory 30 -OutputFolder ".\my-bms-data"
```

**What this does:**
- Exports mapped tables to CSV files
- Filters readings to specified date range (default: 15 days)
- Applies column renaming based on mappings
- Creates: `devices.csv`, `readings.csv`, `alerts.csv`

**Example Output:**
```
📤 Exporting Devices...
  ✓ Exported 150 rows

📤 Exporting MeterReadings...
  ✓ Exported 25,680 rows (last 15 days)

📤 Exporting Alerts...
  ✓ Exported 342 rows

✅ Export complete!
```

---

## Phase 4: Import into PostgreSQL

### Step 7: Ensure PostgreSQL is Ready

```bash
# Check DATABASE_URL is set
echo $env:DATABASE_URL

# If not set, add to .env file:
# DATABASE_URL=postgresql://user:password@localhost:5432/energy_pilot

# Push schema to database
npm run db:push
```

### Step 8: Import the BMS Data

```bash
# Import from exported CSV files
npm run import-data -- --source ./exported-data --clear
```

**What this does:**
- Clears existing data (--clear flag)
- Reads CSV files from exported-data folder
- Maps old device IDs to new auto-generated IDs
- Imports devices first, then readings, then alerts
- Maintains referential integrity

**Example Output:**
```
╔════════════════════════════════════════╗
║   Energy Pilot - Data Import Tool     ║
╚════════════════════════════════════════╝

📦 Importing Devices...
  ✓ Imported device: Main Building Meter (ID: 1)
  ✓ Imported device: HVAC VFD Panel (ID: 2)
  ...
✅ Imported 150 devices

📊 Importing Meter Readings...
  ✓ Imported 5000 readings...
  ✓ Imported 10000 readings...
  ...
✅ Imported 25,680 readings

🚨 Importing Alerts...
✅ Imported 342 alerts

╔════════════════════════════════════════╗
║         Import Summary                 ║
╚════════════════════════════════════════╝
  Devices: 150
  Readings: 25,680
  Alerts: 342
  Duration: 12.34s

✅ Import completed successfully!
```

---

## Phase 5: Verify and Use

### Step 9: Start Your Application

```bash
npm run dev
```

### Step 10: Verify Data in Application

1. **Dashboard** - Check real-time metrics and trends
2. **Devices** - See all imported meters and their status
3. **Analytics** - View 15-day historical trends
4. **Alarms** - Review imported alert history

### Step 11: Query Data Directly (Optional)

```sql
-- Check imported devices
SELECT * FROM devices LIMIT 10;

-- View latest readings
SELECT d.name, r.power, r.voltage, r.timestamp
FROM readings r
JOIN devices d ON d.id = r.device_id
ORDER BY r.timestamp DESC
LIMIT 20;

-- Check date range of imported data
SELECT 
  MIN(timestamp) as first_reading,
  MAX(timestamp) as last_reading,
  COUNT(*) as total_readings
FROM readings;
```

---

## Real-World Tips

### Handling Unknown Schemas

If the analyzer doesn't detect all tables correctly:

1. Review `schema-mapping.json`
2. Manually edit `custom-export.ps1` to add tables
3. Add custom column mappings in the SQL query

### Large Datasets

For millions of readings:

```bash
# Increase batch size for faster import
npm run import-data -- --source ./exported-data --batch-size 5000

# Or limit date range during export
.\exported-data\custom-export.ps1 -DaysOfHistory 7
```

### Custom Transformations

If you need to transform data (e.g., convert units):

1. Edit the generated `custom-export.ps1`
2. Add SQL transformations:
   ```sql
   SELECT 
     DeviceID,
     ActivePower * 1000 as Power,  -- Convert MW to kW
     Voltage,
     Timestamp
   FROM MeterReadings
   ```

### Incremental Updates

To add new data without clearing existing:

```bash
# Export latest data only
.\exported-data\custom-export.ps1 -DaysOfHistory 1

# Import without clearing
npm run import-data -- --source ./exported-data
```

---

## Troubleshooting

### SQL Server Connection Issues

```powershell
# Test connection
Invoke-Sqlcmd -ServerInstance "localhost\SQLEXPRESS" -TrustServerCertificate -Query "SELECT @@VERSION"

# If fails, check:
# - SQL Server service is running
# - Windows Authentication is enabled
# - Firewall allows local connections
```

### Import Errors

**"Device ID not found"**
- Ensure devices are imported before readings
- Check CSV column names match expected format

**"Column mismatch"**
- Review schema-mapping.json
- Verify CSV headers match target schema

**"Date parsing error"**
- Ensure dates are in ISO format or SQL Server format
- Check for NULL timestamps

---

## What You've Learned

This hands-on process teaches you:

✅ **Real BMS Integration** - Working with actual building management system data  
✅ **Schema Analysis** - Understanding and mapping complex database structures  
✅ **Data Migration** - Moving data between different database systems  
✅ **ETL Pattern** - Extract, Transform, Load for real-world projects  
✅ **Practical Skills** - Exactly what you'll do when integrating with BMS systems in production  

---

## Next Steps

1. **Customize the mapping** - Add your specific business logic
2. **Automate the pipeline** - Schedule regular exports/imports
3. **Add validation** - Implement data quality checks
4. **Handle real-time** - Connect directly to BMS APIs for live data
5. **Scale up** - Handle larger datasets and more devices

This is the foundation for any real EMS project that needs to integrate with existing BMS infrastructure!
