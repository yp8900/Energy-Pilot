# RS485 Modbus RTU Energy Meters with BMS Vendor Integration

## Architecture Overview

```
[Building Floor 1]
├── Energy Meter 1 (Schneider PM5340) ──┐
├── Energy Meter 2 (ABB A44)           ──┤
└── Energy Meter 3 (Socomec Diris A40) ──┤
                                          │
[Building Floor 2]                       │ RS485
├── Energy Meter 4 (Schneider PM3255)  ──┤ Modbus RTU
├── Energy Meter 5 (Siemens PAC4200)   ──┤ Bus
                                          │
[Main Electrical Room]                   │
└── BMS Gateway/HMI ←────────────────────┘
    │
    │ Ethernet/SQL
    ▼
[SQL Server Database] ←── [Your Web Dashboard]
```

## Common BMS Vendor Systems

### 1. **Schneider Electric EcoStruxure**
- **Software**: PowerLogic ION Enterprise, EcoStruxure Power Monitoring Expert
- **Database Tables**: Usually named `MeterData`, `RealTimeValues`, `AlarmLog`
- **Modbus Registers**: Standardized IEC 61850 mapping

### 2. **Siemens SICAM/Desigo**
- **Software**: SICAM PAS, PowerManager
- **Database**: SQL Server with `MEASUREMENT_VALUES`, `DEVICE_STATUS`
- **Protocol**: Modbus RTU/TCP bridge

### 3. **ABB System 800xA**
- **Software**: MicroSCADA, System 800xA
- **Tables**: `REAL_TIME_DATA`, `HISTORICAL_DATA`, `ALARMS`

### 4. **Johnson Controls Metasys**
- **Software**: Metasys Server
- **Database**: `PointHistory`, `AlarmHistory`, `ObjectStatus`

## Database Schema Examples

### Typical BMS Vendor Tables

```sql
-- Energy Meters Configuration
CREATE TABLE EnergyMeters (
    MeterID VARCHAR(20) PRIMARY KEY,
    MeterName VARCHAR(100),
    Location VARCHAR(100),
    MeterType VARCHAR(50),          -- 'Schneider PM5340', 'ABB A44', etc.
    ModbusAddress INT,              -- Modbus slave address (1-247)
    RS485Port VARCHAR(10),          -- 'COM1', 'RTU1', etc.
    BaudRate INT DEFAULT 9600,
    Parity VARCHAR(5) DEFAULT 'N',  -- None, Even, Odd
    DataBits INT DEFAULT 8,
    StopBits INT DEFAULT 1,
    CommStatus VARCHAR(20),         -- 'Online', 'Offline', 'Error'
    LastCommunication DATETIME,
    IsActive BIT DEFAULT 1
);

-- Real-time Modbus Register Data
CREATE TABLE RealTimeData (
    ID BIGINT IDENTITY PRIMARY KEY,
    MeterID VARCHAR(20),
    Timestamp DATETIME DEFAULT GETDATE(),
    
    -- Standard Electrical Parameters (IEEE 1159)
    ActivePower_kW FLOAT,           -- Modbus registers 3000-3007
    ReactivePower_kVAr FLOAT,       -- Modbus registers 3008-3015
    ApparentPower_kVA FLOAT,        -- Calculated or registers 3016-3023
    Energy_kWh FLOAT,               -- Energy registers (varies by meter)
    
    -- Voltage measurements
    Voltage_L1 FLOAT,               -- Phase 1 voltage
    Voltage_L2 FLOAT,               -- Phase 2 voltage  
    Voltage_L3 FLOAT,               -- Phase 3 voltage
    Voltage_LL_Avg FLOAT,           -- Line-to-line average
    
    -- Current measurements
    Current_L1 FLOAT,               -- Phase 1 current
    Current_L2 FLOAT,               -- Phase 2 current
    Current_L3 FLOAT,               -- Phase 3 current
    Current_N FLOAT,                -- Neutral current
    
    -- Power Quality
    PowerFactor FLOAT,              -- Overall power factor
    PowerFactor_L1 FLOAT,           -- Phase 1 power factor
    PowerFactor_L2 FLOAT,           -- Phase 2 power factor
    PowerFactor_L3 FLOAT,           -- Phase 3 power factor
    Frequency FLOAT,                -- Network frequency
    
    -- Advanced Power Quality (if available)
    THD_Voltage_L1 FLOAT,           -- Total Harmonic Distortion
    THD_Current_L1 FLOAT,
    
    -- Demand values
    MaxDemand_kW FLOAT,
    AvgDemand_kW FLOAT,
    
    FOREIGN KEY (MeterID) REFERENCES EnergyMeters(MeterID)
);

-- BMS Alarms and Events
CREATE TABLE Alarms (
    AlarmID VARCHAR(50) PRIMARY KEY,
    MeterID VARCHAR(20),
    MeterName VARCHAR(100),
    AlarmType VARCHAR(50),          -- 'Communication Error', 'Threshold', etc.
    Severity VARCHAR(20),           -- 'Critical', 'High', 'Medium', 'Low'
    Message VARCHAR(500),
    Timestamp DATETIME,
    Status VARCHAR(20),             -- 'Active', 'Acknowledged', 'Cleared'
    ModbusRegister INT,             -- Which register caused the alarm
    RegisterValue FLOAT,            -- Value that triggered alarm
    ThresholdValue FLOAT,           -- Configured threshold
    FOREIGN KEY (MeterID) REFERENCES EnergyMeters(MeterID)
);
```

## Implementation Steps

### 1. **Identify Your BMS Vendor Schema**

Run this query on your BMS database to discover tables:

```sql
-- Discover BMS database structure
SELECT 
    TABLE_SCHEMA,
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME LIKE '%meter%' 
   OR TABLE_NAME LIKE '%energy%' 
   OR TABLE_NAME LIKE '%power%'
   OR TABLE_NAME LIKE '%alarm%'
ORDER BY TABLE_NAME, ORDINAL_POSITION;
```

### 2. **Configure Connection**

Update your `.env` file:
```bash
# Your BMS SQL Server (replace with actual values)
BMS_SERVER=bms-sql-server.yourcompany.com
BMS_DATABASE=PowerMonitoring_DB  # or EnergyManagement, SCADA_DB, etc.
BMS_USER=readonly_user
BMS_PASSWORD=your_secure_password
BMS_SYNC_INTERVAL=1
```

### 3. **Common Modbus Register Mappings**

Different meter manufacturers use different register layouts:

```javascript
// Schneider PM5340 example
const SCHNEIDER_REGISTERS = {
  ACTIVE_POWER_L1: 3000,
  ACTIVE_POWER_L2: 3002,
  ACTIVE_POWER_L3: 3004,
  TOTAL_ACTIVE_POWER: 3006,
  VOLTAGE_L1: 3020,
  VOLTAGE_L2: 3022,
  VOLTAGE_L3: 3024,
  CURRENT_L1: 3000,
  ENERGY_KWH: 4000
};

// ABB A44 example  
const ABB_REGISTERS = {
  ACTIVE_POWER: 1280,
  REACTIVE_POWER: 1282,
  VOLTAGE_L1: 1284,
  CURRENT_L1: 1300,
  ENERGY_KWH: 5000
};
```

## Benefits of This Approach

### ✅ **No Direct Modbus Communication Needed**
- Your dashboard doesn't handle RS485 complexity
- BMS vendor handles all Modbus protocol details
- No need for RS485 converters or Modbus libraries

### ✅ **Single Source of Truth**
- BMS vendor database is authoritative
- Consistent data across all systems
- Existing vendor support and maintenance

### ✅ **Real-time Performance** 
- SQL queries are fast (milliseconds)
- Modbus polling handled by optimized vendor software
- No communication bottlenecks

### ✅ **Enterprise Integration**
- SQL Server integrates with existing IT infrastructure
- Standard database security and backup
- Easy reporting and business intelligence

## Troubleshooting Common Issues

### 1. **Modbus Communication Problems**
- Check in BMS vendor software, not your dashboard
- Verify RS485 wiring and termination resistors
- Confirm baud rate and Modbus address settings

### 2. **Data Synchronization**
- Monitor BMS vendor logs for communication errors
- Ensure SQL Server connection has read permissions
- Check that tables are being updated by vendor software

### 3. **Performance Optimization**
- Add indexes on MeterID and Timestamp columns
- Use SQL Server query optimization
- Implement data archival for old readings

This approach leverages your existing BMS investment while providing modern web dashboard capabilities!