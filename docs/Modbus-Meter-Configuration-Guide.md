# Modbus Meter Configuration Guide

## Overview
The Energy-Pilot system now includes comprehensive meter definitions with proper data type handling for Modbus RTU energy meters. This guide explains how to configure and query meters for available data.

## Supported Meter Types

### 1. Generic IEC 61850 Standard
- **Use When**: Unknown meter brand or generic Modbus meter
- **Default Settings**:
  - Baud Rate: 9600
  - Parity: Even
  - Data Bits: 8
  - Stop Bits: 1
  - Byte Order: Big Endian (ABCD)

### 2. Schneider Electric PM8000 Series
- **Models**: PM8000, PM5000, PM3000
- **Default Settings**:
  - Baud Rate: 19200
  - Parity: Even
  - Register Format: Float32, Big Endian
- **Key Registers**:
  - Power: 2999-3026
  - Energy: 2699-2710
  - Voltage: 3027-3044
  - Current: 2999-3010
  - Frequency: 3109

### 3. ABB M2M/M4M
- **Default Settings**:
  - Baud Rate: 9600
  - Parity: Even
  - Register Format: Int32/UInt16, Big Endian
- **Key Registers**:
  - Power: 0x5000-0x5004
  - Energy: 0x6000-0x6002
  - Voltage: 0x5B00-0x5B02
  - Current: 0x5B0C-0x5B10
  - Frequency: 0x5B2C

### 4. Siemens PAC3200/PAC4200
- **Default Settings**:
  - Baud Rate: 19200
  - Parity: Even
  - Register Format: Float32, Big Endian
- **Key Registers**:
  - Power: 1-12
  - Energy: 801-808
  - Voltage: 13-24
  - Current: 25-32
  - Frequency: 55

## Data Type Handling

### Supported Data Types
1. **uint16** - Unsigned 16-bit integer (1 register, 0-65535)
2. **int16** - Signed 16-bit integer (1 register, -32768 to 32767)
3. **uint32** - Unsigned 32-bit integer (2 registers, 0-4294967295)
4. **int32** - Signed 32-bit integer (2 registers, -2147483648 to 2147483647)
5. **float32** - 32-bit IEEE 754 float (2 registers)
6. **float64** - 64-bit IEEE 754 double (4 registers)
7. **string** - ASCII string (multiple registers)

### Byte Order Options
- **BE** (Big Endian ABCD) - Standard Modbus, most common
- **LE** (Little Endian DCBA) - Some Asian manufacturers
- **BE_SWAP** (Big Endian Byte Swap BADC) - Some meters
- **LE_SWAP** (Little Endian Byte Swap CDAB) - Rare

## Usage Workflow

### Step 1: Connect to Modbus
```javascript
POST /api/modbus/connect
{
  "connectionType": "serial",
  "port": "COM5",
  "baudRate": 9600,
  "parity": "even",
  "dataBits": 8,
  "stopBits": 1
}
```

### Step 2: Scan for Devices
```javascript
POST /api/modbus/scan
{
  "startAddress": 1,
  "endAddress": 20,
  "timeout": 500
}
```

**Response**:
```json
{
  "success": true,
  "devices": [
    {
      "address": 1,
      "manufacturer": "Schneider Electric",
      "model": "PM8000 Series",
      "deviceType": "Energy Meter",
      "registers": [
        {
          "address": 2999,
          "name": "total_active_power",
          "description": "Total Active Power",
          "type": "input",
          "dataType": "float32",
          "unit": "kW",
          "category": "power"
        }
      ]
    }
  ]
}
```

### Step 3: Read Device Data
```javascript
GET /api/modbus/device/1/read
```

**Response**:
```json
{
  "success": true,
  "address": 1,
  "manufacturer": "Schneider Electric",
  "data": {
    "total_active_power": {
      "value": 125.45,
      "formattedValue": "125.45 kW",
      "unit": "kW",
      "category": "power",
      "timestamp": "2025-12-30T18:00:00.000Z"
    },
    "voltage_l1_n": {
      "value": 230.2,
      "formattedValue": "230.2 V",
      "unit": "V",
      "category": "voltage",
      "timestamp": "2025-12-30T18:00:00.000Z"
    }
  }
}
```

### Step 4: Query Available Meter Definitions
```javascript
GET /api/modbus/definitions
```

**Response**:
```json
{
  "success": true,
  "manufacturers": ["Generic", "Schneider Electric", "ABB", "Siemens"],
  "definitions": [
    {
      "manufacturer": "Generic",
      "models": ["IEC 61850 Standard"]
    },
    {
      "manufacturer": "Schneider Electric",
      "models": ["PM8000 Series"]
    }
  ]
}
```

### Step 5: Get Specific Meter Definition
```javascript
GET /api/modbus/definition/Schneider%20Electric/PM8000
```

**Response**:
```json
{
  "success": true,
  "definition": {
    "manufacturer": "Schneider Electric",
    "model": "PM8000 Series",
    "description": "PowerLogic PM8000 Series Power Meter",
    "baudRate": [9600, 19200, 38400, 57600, 115200],
    "defaultBaudRate": 19200,
    "defaultByteOrder": "BE",
    "registerCount": 15,
    "registersByCategory": {
      "power": [
        {
          "address": 2999,
          "name": "total_active_power",
          "description": "Total Active Power",
          "type": "input",
          "dataType": "float32",
          "unit": "kW"
        }
      ],
      "voltage": [...],
      "current": [...],
      "energy": [...],
      "frequency": [...]
    }
  }
}
```

## Register Categories

### 1. Power Measurements
- **total_active_power** - Total 3-phase active power (kW)
- **total_reactive_power** - Total 3-phase reactive power (kVAr)
- **total_apparent_power** - Total 3-phase apparent power (kVA)
- **l1/l2/l3_active_power** - Per-phase active power (kW)

### 2. Energy Measurements
- **total_active_energy** - Accumulated active energy (kWh)
- **total_reactive_energy** - Accumulated reactive energy (kVArh)
- **total_apparent_energy** - Accumulated apparent energy (kVAh)

### 3. Voltage Measurements
- **voltage_l1_n, l2_n, l3_n** - Phase-to-neutral voltage (V)
- **voltage_l1_l2, l2_l3, l3_l1** - Phase-to-phase voltage (V)

### 4. Current Measurements
- **current_l1, l2, l3** - Per-phase current (A)
- **current_neutral** - Neutral current (A)

### 5. Power Factor
- **total_power_factor** - Total power factor (dimensionless)
- **l1/l2/l3_power_factor** - Per-phase power factor

### 6. Frequency
- **frequency** - System frequency (Hz)

### 7. Demand
- **max_demand_active_power** - Maximum demand (kW)

## Configuration Best Practices

### 1. Serial Communication Settings
Most energy meters use:
- **9600 or 19200 baud** (most common)
- **Even parity** (more error detection than none)
- **8 data bits, 1 stop bit**

### 2. Address Assignment
- Use addresses 1-247
- Reserve address 1 for master meter
- Document meter addresses in a spreadsheet
- Use sequential addresses for easy management

### 3. Scan Strategy
- **Quick scan**: addresses 1-20 (typical building)
- **Full scan**: addresses 1-247 (takes ~2 minutes)
- **Timeout**: 500ms for RTU, 1000ms for TCP

### 4. Data Categories to Monitor

**For Dashboard Display**:
- Total Active Power (real-time)
- Total Active Energy (accumulated)
- Voltage L1-L3 (system health)
- Current L1-L3 (load monitoring)

**For Alarms**:
- Voltage deviations (±10% nominal)
- Current imbalance (>15% between phases)
- Power factor (<0.85)

**For Analytics**:
- Power trends (hourly/daily)
- Energy consumption (daily/monthly)
- Demand peaks (time-of-day)

## Troubleshooting

### Problem: Device not detected during scan
**Solutions**:
1. Verify physical wiring (A, B, GND)
2. Check meter address setting (DIP switches or LCD menu)
3. Try different baud rates (9600, 19200, 38400)
4. Verify parity setting (even, odd, none)

### Problem: Values reading as NaN or unrealistic
**Solutions**:
1. Try different byte order (BE, LE, BE_SWAP, LE_SWAP)
2. Verify register addresses in meter manual
3. Check data type (int16 vs float32)
4. Verify scale factor

### Problem: Intermittent communication errors
**Solutions**:
1. Reduce scan speed (increase timeout to 1000ms)
2. Check RS485 termination resistors (120Ω at both ends)
3. Verify cable length (<1200m for RS485)
4. Add delay between commands (50-100ms)

### Problem: Only some registers readable
**Solutions**:
1. Check meter manual for supported registers
2. Some meters require specific register ranges
3. Verify register type (holding vs input)
4. Check meter firmware version

## Integration with Dashboard

### Auto-Discovery Flow
1. Scan BACnet device (Loytec LIOB-589) to discover it's online
2. Scan Modbus bus via BACnet gateway or direct serial
3. System auto-identifies meter manufacturer and model
4. Load appropriate register definitions
5. Probe key registers to confirm availability
6. Present discovered meters to user for naming/configuration
7. Save meter configuration to database
8. Auto-populate dashboard with live data cards
9. Start background polling service (2-5 second refresh)

### Meter Configuration Storage
```json
{
  "meterId": "meter_001",
  "name": "Main Building Meter",
  "location": "Electrical Room A",
  "address": 1,
  "manufacturer": "Schneider Electric",
  "model": "PM8000",
  "connectionType": "serial",
  "port": "COM5",
  "baudRate": 19200,
  "parity": "even",
  "enabled": true,
  "registers": [
    {
      "name": "total_active_power",
      "displayName": "Active Power",
      "dashboardVisible": true
    },
    {
      "name": "total_active_energy",
      "displayName": "Total Energy",
      "dashboardVisible": true
    }
  ]
}
```

## API Reference

### GET /api/modbus/definitions
List all supported meter manufacturers and models

### GET /api/modbus/definition/:manufacturer/:model?
Get detailed register map for specific meter

### POST /api/modbus/connect
Connect to Modbus serial or TCP

### POST /api/modbus/scan
Scan for devices on the bus

### GET /api/modbus/devices
List discovered devices

### GET /api/modbus/device/:address/read
Read current values from specific device

### GET /api/modbus/read-all
Read all discovered devices

### POST /api/modbus/disconnect
Disconnect from Modbus

## Next Steps

1. **Test with your meter**: Connect COM5, start with 9600-E-8-1
2. **Scan addresses 1-20**: Should find your energy meters
3. **Verify data**: Check if values are realistic
4. **Configure meters**: Assign names and locations
5. **Enable dashboard**: Auto-populate cards with live data
6. **Setup alarms**: Configure thresholds for notifications
7. **Enable logging**: Store historical data for analytics
