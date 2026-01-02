# BACnet Gateway Modbus Meter Discovery

## Vendor-Independent Approach

This system discovers Modbus energy meters by reading BACnet objects from the gateway device (e.g., Loytec LIOB-589). **No vendor-specific Modbus register maps needed** - the gateway already has the configuration!

## How It Works

### Architecture
```
Physical Layer:
RS485 Bus → Modbus Meters (Address 1, 2, 3...) → Loytec LIOB-589 Gateway

Protocol Layer:
Modbus RTU ← Gateway (configured) → BACnet/IP

Application Layer:
Energy-Pilot ← BACnet Read → Gateway Objects ← Mapped from → Modbus Registers
```

### Discovery Process

1. **Scan BACnet Device**
   - Discover Loytec LIOB-589 at 192.168.1.47 (Device ID: 17800)
   - Read object-list property from device
   - Find all AI (Analog Input), AV (Analog Value), MSV (Multi-State Value) objects

2. **Identify Modbus Objects**
   - Read object-name, description, present-value, units for each object
   - Filter objects with Modbus-related names (e.g., "Meter1_ActivePower", "EM_01_Voltage_L1")
   - Pattern matching on common keywords: meter, energy, power, voltage, current, kWh, etc.

3. **Group by Meter**
   - Parse object names to extract meter identifier (e.g., "Meter1", "EM_01", "Addr1")
   - Group all parameters belonging to same meter
   - Example naming patterns:
     - `Meter1_ActivePower_Total` → Meter 1, Active Power, Total
     - `EM_01_Voltage_L1` → Meter 1 (EM=Energy Meter), Voltage, Phase L1
     - `Building_Main_Current_L2` → Meter "Building_Main", Current, Phase L2

4. **Categorize Parameters**
   - Power: Active, Reactive, Apparent (Total + per-phase)
   - Energy: kWh, kVArh, kVAh
   - Voltage: L1-N, L2-N, L3-N, L1-L2, L2-L3, L3-L1
   - Current: L1, L2, L3, Neutral
   - Frequency: System frequency
   - Power Factor: Total + per-phase

5. **Read Values via BACnet**
   - Use BACnet readProperty to get present-value
   - No direct Modbus communication needed!
   - Gateway handles all Modbus complexity

## API Usage

### Step 1: Discover BACnet Device
```bash
GET /api/bacnet/discover
```

**Response:**
```json
{
  "success": true,
  "count": 1,
  "devices": [{
    "deviceId": 17800,
    "address": "192.168.1.47",
    "name": "LIOB-589",
    "vendor": "Loytec",
    "maxApduLength": 1476
  }]
}
```

### Step 2: Scan for Modbus Meters via BACnet
```bash
GET /api/bacnet/device/17800/modbus-meters?address=192.168.1.47
```

**Response:**
```json
{
  "success": true,
  "deviceId": 17800,
  "ipAddress": "192.168.1.47",
  "meterCount": 3,
  "meters": [
    {
      "address": 1,
      "name": "Meter1",
      "parameterCount": 25,
      "categories": {
        "power": 6,
        "energy": 3,
        "voltage": 6,
        "current": 4,
        "frequency": 1,
        "powerFactor": 4,
        "other": 1
      },
      "sampleParameters": [
        {
          "name": "Meter1_ActivePower_Total",
          "type": "active_power",
          "phase": "TOTAL",
          "units": "kW",
          "bacnetObject": "AI:100"
        },
        {
          "name": "Meter1_Voltage_L1",
          "type": "voltage",
          "phase": "L1",
          "units": "V",
          "bacnetObject": "AI:110"
        }
      ]
    },
    {
      "address": 2,
      "name": "Meter2",
      "parameterCount": 25,
      ...
    }
  ]
}
```

### Step 3: Read Meter Values
```bash
GET /api/bacnet/modbus-meter/Meter1/read
```

**Response:**
```json
{
  "success": true,
  "meterKey": "Meter1",
  "timestamp": "2025-12-30T18:00:00.000Z",
  "valueCount": 25,
  "values": {
    "Meter1_ActivePower_Total": {
      "value": 125.45,
      "units": "kW",
      "parameterType": "active_power",
      "phase": "TOTAL",
      "objectInstance": 100,
      "timestamp": "2025-12-30T18:00:00.000Z"
    },
    "Meter1_Voltage_L1": {
      "value": 230.2,
      "units": "V",
      "parameterType": "voltage",
      "phase": "L1",
      "objectInstance": 110,
      "timestamp": "2025-12-30T18:00:00.000Z"
    },
    ...
  }
}
```

### Step 4: Export Configuration for Dashboard
```bash
GET /api/bacnet/modbus-meters/config
```

**Response:**
```json
{
  "success": true,
  "meterCount": 3,
  "meters": [
    {
      "id": "Meter1",
      "name": "Meter1",
      "address": 1,
      "parameters": [
        {
          "name": "Meter1_ActivePower_Total",
          "type": "active_power",
          "phase": "TOTAL",
          "units": "kW",
          "bacnetObject": "AI:100"
        }
      ]
    }
  ]
}
```

## Configuration on Loytec LIOB-589

### Object Naming Convention

For proper auto-discovery, configure BACnet object names on the gateway following these patterns:

#### Pattern 1: Meter Number Prefix
```
Meter1_ActivePower_Total
Meter1_Voltage_L1
Meter1_Current_L1
Meter2_ActivePower_Total
Meter2_Voltage_L1
```

#### Pattern 2: Energy Meter (EM) Prefix
```
EM_01_Power_kW
EM_01_Voltage_L1_V
EM_01_Current_L1_A
EM_02_Power_kW
EM_02_Voltage_L2_V
```

#### Pattern 3: Modbus Address Prefix
```
Modbus_Addr1_ActivePower
Modbus_Addr1_Voltage_L1
Modbus_Addr2_ActivePower
```

#### Pattern 4: Location-Based Naming
```
Building_Main_Power_Total
Building_Main_Voltage_L1
Substation_A_Power_Total
Substation_A_Voltage_L1
```

### Recommended Object Types

- **Analog Input (AI)**: For measured values from Modbus (power, voltage, current, energy)
- **Analog Value (AV)**: For calculated values (totals, averages)
- **Multi-State Value (MSV)**: For status/alarms

### Example Configuration

On Loytec LIOB-589 web interface:

1. **Configure Modbus Master**:
   - Port: COM1 or COM2
   - Baud Rate: 9600 or 19200
   - Parity: Even
   - Data Bits: 8
   - Stop Bits: 1

2. **Add Modbus Devices**:
   - Device 1: Address 1 (Schneider PM8000)
   - Device 2: Address 2 (ABB M2M)
   - Device 3: Address 3 (Generic Meter)

3. **Map Modbus Registers to BACnet Objects**:
   - Create AI objects for each Modbus register
   - Name them with clear patterns
   - Set appropriate units (kW, V, A, Hz)

4. **Enable BACnet**:
   - Device Instance: 17800
   - Port: 47808
   - Network: Enable BAC0

## Advantages

### ✅ Vendor-Independent
- No need for manufacturer-specific register maps
- Works with any meter configured on gateway
- Automatic adaptation to different meter types

### ✅ Simplified Configuration
- Gateway already has Modbus configuration
- No need to manage baud rates, addresses, register maps
- Just read BACnet objects!

### ✅ Real-Time Updates
- BACnet COV (Change of Value) subscriptions possible
- Gateway handles Modbus polling
- Energy-Pilot just reads current values

### ✅ Flexible Naming
- Auto-parsing handles various naming conventions
- Easy to identify meters and parameters
- Supports custom location/building names

### ✅ Production Ready
- Gateway provides reliable Modbus communication
- Industrial-grade hardware (Loytec)
- Proven BACnet/Modbus gateway solution

## Workflow Integration

### Phase 1: Discovery
1. User clicks "Discover BACnet Devices" in UI
2. System finds Loytec LIOB-589 at 192.168.1.47
3. User clicks "Scan for Modbus Meters"
4. System reads all BACnet objects
5. Auto-groups into meters (Meter1, Meter2, etc.)
6. Shows discovered meters with parameter counts

### Phase 2: Configuration
1. User selects which meters to monitor
2. Assigns friendly names (e.g., "Main Building", "Substation A")
3. Chooses which parameters to display on dashboard
4. Saves configuration to database

### Phase 3: Dashboard Population
1. System auto-creates cards for each meter
2. Real-time data displayed (power, energy, voltage, current)
3. Background polling service updates every 2-5 seconds
4. Historical data logged to database

### Phase 4: Analytics
1. Trend charts for power consumption
2. Energy usage reports (daily, monthly)
3. Demand analysis (peak times)
4. Alarm thresholds (voltage deviations, high current)

## Testing Steps

1. **Ensure BACnet Device is Online**:
   ```bash
   GET /api/bacnet/discover
   # Should return Device 17800
   ```

2. **Scan for Modbus Meters**:
   ```bash
   GET /api/bacnet/device/17800/modbus-meters?address=192.168.1.47
   # Should return list of discovered meters
   ```

3. **Read First Meter**:
   ```bash
   GET /api/bacnet/modbus-meter/Meter1/read
   # Should return live values
   ```

4. **Export Configuration**:
   ```bash
   GET /api/bacnet/modbus-meters/config
   # Use this to populate dashboard
   ```

## Troubleshooting

### No Meters Found
- Check object naming on Loytec gateway
- Ensure objects have "meter", "power", "energy", etc. in name
- Verify object-list property is readable

### Can't Read Values
- Check BACnet device is responding to Who-Is
- Verify present-value property exists for objects
- Ensure network connectivity (Wi-Fi on 192.168.1.33)

### Wrong Meter Grouping
- Review object naming convention
- Add meter number or identifier prefix
- Use consistent naming across parameters

### Missing Parameters
- Check if all required objects are created on gateway
- Verify units property is set
- Ensure object types are AI/AV (not BI/BO)

## Next Steps

1. ✅ **Test Discovery**: Call the API to scan your Loytec device
2. ✅ **Verify Naming**: Check if object names follow patterns
3. ✅ **Read Values**: Confirm live data is accessible
4. ⏳ **Build UI**: Create meter selection interface
5. ⏳ **Dashboard Integration**: Auto-populate cards with discovered meters
6. ⏳ **Historical Logging**: Store readings for analytics

This approach gives you **maximum flexibility** without needing to know anything about the actual Modbus meters - the gateway configuration is your source of truth! 🎯
