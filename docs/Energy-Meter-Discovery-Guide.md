# Energy Meter Discovery & Import Guide

## Overview
This guide explains how to discover and import ONLY energy meter data from the METRO_BHAWAN BMS, filtering out DDC controllers, HVAC systems, alarms, and other non-energy meter devices.

## Why This Approach?
The previous import included **919 devices** with **679,643 readings** - most of which were DDC controller data, HVAC parameters, and alarms. The new smart discovery approach:

- ✅ **87 energy meters** (vs 919 mixed devices)
- ✅ **310,527 readings** (vs 679,643 with junk data)
- ✅ **Filtered out 1.5M non-energy records** (DDC, HVAC, alarms)
- ✅ **Only Modbus RS485 energy meters** from PGM1 path

## Discovery Process

### Path Pattern
Energy meters are identified by this BMS path pattern:
```
Datapoints/Modbus Port RS485/Datapoints/PGM1/[MeterName]/[Parameters]
```

**Example:**
```
Datapoints/Modbus Port RS485/Datapoints/PGM1/EM/MAIN/WH
                                           └─┬──┘ └──┬┘ └┬┘
                                        Meter Name  Loc  Param
```

### Discovered Meter Types
- **EM/MAIN** - Main Incomer (29 parameters)
- **EM/AHU_LC** - AHU Left Center
- **EM/LDB_RC** - Light Distribution Board Right Center
- **EM/CHILLER** - Chiller Energy Meter
- **SCR/AHU_SC_R** - AHU South Center Right
- And 82 more meters...

### Parameters Discovered
| Parameter | Mapped To | Description |
|-----------|-----------|-------------|
| WH, MAIN_WH | `energy` | Watt-hours (Energy consumption) |
| Run _W, W | `power` | Watts (Real power) |
| Total_Amp, Am | `current` | Amperes (Current) |
| VLL, VLN | `voltage` | Voltage (Line-to-Line, Line-to-Neutral) |

## Step-by-Step Workflow

### Step 1: Discover Energy Meters
```powershell
cd Energy-Pilot
npm run discover-meters -- --source .\exported-data
```

**Output:**
- Scans `exported-data/LogItemInfo.csv`
- Filters Modbus RS485/PGM1 paths only
- Groups parameters by meter name
- Saves to `exported-data/discovered-energy-meters.json`
- Shows detailed report in console

**Example Output:**
```
✅ Discovered 87 Energy Meters

📊 EM/MAIN
   Path: Datapoints/Modbus Port RS485/Datapoints/PGM1/EM/MAIN
   Parameters (29):
      • MAIN_WH         (no unit) - LogId: 64750
      • MAIN_Run _W     (no unit) - LogId: 76304
      • MAIN_TAmp       (no unit) - LogId: 85084
```

### Step 2: Clean Database (Optional)
If you previously imported junk data:
```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/energy_pilot"
npm run clean-db
```

**This will delete:**
- All devices
- All readings
- All alerts

### Step 3: Import Energy Meter Data
```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/energy_pilot"
npm run import-energy-meters -- --source .\exported-data
```

**What Happens:**
1. Loads `discovered-energy-meters.json`
2. Creates 87 devices (energy meters only)
3. Filters 1.96M trend records to 443,976 energy meter records
4. Consolidates to 310,527 readings (groups by device + timestamp)
5. Maps parameters:
   - `WH` → energy
   - `Run _W` → power
   - `Total_Amp` → current
   - `VLL/VLN` → voltage

**Example Output:**
```
✅ Discovered Meters: 87
📊 Matched: 443,976 records
📊 Skipped: 1,514,952 records (non-energy meter data)
📊 Consolidated: 310,527 readings
Duration: 39.73s
```

### Step 4: View in Web UI
Navigate to **Energy Meters** page in the application:
```
http://localhost:5173/modbus-energy-discovery
```

**Features:**
- ✅ View all 87 discovered energy meters
- ✅ Expand each meter to see parameters
- ✅ See parameter types (Energy, Power, Current, Voltage)
- ✅ View LogIds for each parameter
- ✅ Export to JSON for reporting

### Step 5: Start Application
```powershell
.\start-all.ps1
```

Access:
- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:5000

## File Structure

### Discovery Files
```
exported-data/
├── LogItemInfo.csv               # BMS metadata (1,182 items)
├── trendlog_readings.csv         # Raw trend data (1.96M records)
├── discovered-energy-meters.json # Discovered meters (87 meters)
└── alarmlog_alerts.csv           # (Not imported in smart mode)
```

### Scripts
```
script/
├── discover-energy-meters.ts     # Discovery script
├── import-energy-meters-smart.ts # Smart import (energy only)
├── clean-database.ts             # Database cleanup
└── export-bms-data.ps1          # SQL Server export
```

## NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| **discover-meters** | `npm run discover-meters -- --source ./exported-data` | Discover energy meters from LogItemInfo |
| **clean-db** | `npm run clean-db` | Clean PostgreSQL database |
| **import-energy-meters** | `npm run import-energy-meters -- --source ./exported-data` | Import only energy meter data |

## Viewing Discovered Meters

### In Terminal
After running `npm run discover-meters`:
```
📊 EM/MAIN
   Path: Datapoints/Modbus Port RS485/Datapoints/PGM1/EM/MAIN
   Parameters (29):
      • MAIN_WH (Energy) - LogId: 64750
      • MAIN_Run _W (Power) - LogId: 76304
```

### In Web UI
Navigate to: `http://localhost:5173/modbus-energy-discovery`

- **Total Meters:** 87
- **Total Parameters:** 363
- **Main Incomer:** Found ✓
- **Source:** Modbus RS485

Click on any meter card to expand and see all parameters with:
- Parameter name
- Type badge (Energy, Power, Current, Voltage)
- Log ID
- Unit

### Via JSON File
```powershell
cat .\exported-data\discovered-energy-meters.json | ConvertFrom-Json | Select -First 3
```

Or copy to frontend:
```powershell
Copy-Item .\exported-data\discovered-energy-meters.json .\client\public\
```

## Dashboard View
After import, your Energy Pilot dashboard will show:

### Devices Page
- 87 energy meters (not 919 DDC controllers!)
- Meter names: "EM - MAIN", "EM - AHU_LC", "EM - CHILLER"
- All marked as "active" energy_meter type

### Analytics Page
- Clean energy consumption trends
- Power usage graphs (WH, Run_W)
- Current monitoring (Total_Amp)
- No junk DDC controller data!

## Troubleshooting

### Error: Discovery file not found
**Solution:** Run discovery first:
```powershell
npm run discover-meters -- --source .\exported-data
```

### Error: DATABASE_URL not set
**Solution:** Set inline:
```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/energy_pilot"
npm run import-energy-meters -- --source .\exported-data
```

### Error: 0 readings imported
**Check:**
1. LogItemInfo.csv exists in exported-data
2. trendlog_readings.csv has data
3. LogIds match between files:
```powershell
# Check LogIds in discovery
cat .\exported-data\discovered-energy-meters.json | ConvertFrom-Json | Select -ExpandProperty parameters | Select -First 5 logId

# Check LogIds in readings
Import-Csv .\exported-data\trendlog_readings.csv | Select -First 5 LogId
```

## Comparison: Before vs After

### Before (Junk Import)
- **Devices:** 919 (DDC controllers, HVAC, meters, everything!)
- **Readings:** 679,643 (mixed data)
- **Alerts:** 62,858 (not needed)
- **Import Time:** 73.24s
- **Dashboard:** Cluttered with non-energy devices

### After (Smart Energy-Only Import)
- **Devices:** 87 (energy meters only)
- **Readings:** 310,527 (energy data only)
- **Alerts:** 0 (skipped)
- **Import Time:** 39.73s
- **Dashboard:** Clean energy monitoring

## Next Steps

1. ✅ **Discovery Complete** - View meters at `/modbus-energy-discovery`
2. ✅ **Data Imported** - See readings in Dashboard/Analytics
3. 📊 **Configure Dashboards** - Create custom views for main incomer vs submeter
4. 🔔 **Set Thresholds** - Add alerts for high power consumption
5. 📈 **Trend Analysis** - Compare energy usage across floors/AHUs

## Tips

### Find Specific Meter
```powershell
cat .\exported-data\discovered-energy-meters.json | ConvertFrom-Json | Where { $_.name -like "*MAIN*" }
```

### Check Parameter Coverage
Look for meters with:
- Energy (WH) - for consumption tracking
- Power (W) - for load monitoring
- Current (Amp) - for electrical safety
- Voltage (V) - for power quality

### Re-import After Changes
```powershell
# Clean, discover, import in sequence
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/energy_pilot"
npm run clean-db
npm run discover-meters -- --source .\exported-data
npm run import-energy-meters -- --source .\exported-data
```

## Summary
This workflow ensures you import **only energy meter data** from your BMS, filtering out unnecessary DDC controllers, HVAC parameters, and alarm logs. The result is a clean, focused energy monitoring system with 87 real energy meters and 310K relevant readings!
