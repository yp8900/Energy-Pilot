# BACnet-Modbus Device Naming Convention

## Overview

This document defines the naming convention for Modbus devices exposed through BACnet gateways in the Energy Pilot system. Using consistent naming patterns ensures proper device grouping and automatic meter discovery.

---

## Naming Convention

### Required Format

```
DeviceType_Number_ParameterName
```

**Components:**
- **DeviceType**: Type of device (Meter, EM, VFD, Drive, etc.)
- **Number**: Unique device identifier (1, 2, 01, 02, etc.)
- **ParameterName**: Descriptive parameter name with optional units

**Separator**: Underscore (`_`) or hyphen (`-`)

---

## Supported Device Type Prefixes

| Prefix Pattern | Description | Example |
|----------------|-------------|---------|
| `Meter{N}_` | Generic energy meter | `Meter1_ActivePower` |
| `EM_{NN}_` or `EM{NN}_` | Energy meter with 2-digit ID | `EM_01_Voltage`, `EM01_Current` |
| `VFD{N}_` | Variable Frequency Drive | `VFD1_MotorSpeed` |
| `Drive{N}_` | Motor drive | `Drive1_Torque` |
| `Inverter{N}_` | Inverter | `Inverter1_DCVoltage` |
| `Device{N}_` | Generic device | `Device1_Temperature` |
| `Unit{N}_` | Generic unit | `Unit1_Pressure` |
| `Sensor{N}_` | Sensor device | `Sensor1_Humidity` |

**Note**: `{N}` = device number (1, 2, 3...), `{NN}` = zero-padded number (01, 02, 03...)

---

## Examples

### Energy Meter 01
```
EM_01_Voltage [V]
EM_01_Current [A]
EM_01_ActivePower [kW]
EM_01_ReactivePower [kVAr]
EM_01_Energy [kWh]
EM_01_Frequency [Hz]
EM_01_PowerFactor
```

**Result**: Grouped as **"EM_01"** meter with 7 parameters

---

### Energy Meter 02
```
EM_02_Voltage [V]
EM_02_Current [A]
EM_02_ActivePower [kW]
EM_02_Energy [kWh]
```

**Result**: Grouped as **"EM_02"** meter with 4 parameters

---

### VFD 1
```
VFD1_InputPower [kW]
VFD1_MotorVoltage [V]
VFD1_MotorCurrent [A]
VFD1_Frequency [Hz]
VFD1_Speed [RPM]
VFD1_Torque [Nm]
VFD1_DCLinkVoltage [V]
```

**Result**: Grouped as **"VFD1"** meter with 7 parameters

---

### VFD 2
```
VFD2_MotorSpeed [RPM]
VFD2_Torque [%]
VFD2_Power [kW]
```

**Result**: Grouped as **"VFD2"** meter with 3 parameters

---

### Generic Meters
```
Meter1_Voltage_L1 [V]
Meter1_Voltage_L2 [V]
Meter1_Voltage_L3 [V]
Meter1_Current_L1 [A]
Meter1_Current_L2 [A]
Meter1_Current_L3 [A]
Meter1_TotalPower [kW]

Meter2_Voltage [V]
Meter2_Current [A]
Meter2_Power [kW]
```

**Result**: 
- **"Meter1"** with 7 parameters (3-phase)
- **"Meter2"** with 3 parameters (single-phase)

---

## Configuration in Loytec LIOB-589

### Step 1: Add Modbus Device Configuration
1. Open Loytec web interface
2. Navigate to Modbus → RS485 Configuration
3. Add your Modbus device(s)
4. Configure slave address, baud rate, parity

### Step 2: Map Modbus Registers to BACnet Objects
1. Navigate to BACnet → Object Configuration
2. Create **Type 23 (Program)** objects for each Modbus parameter
3. Link to Modbus registers (Holding Registers, Input Registers)

### Step 3: Apply Naming Convention
For each BACnet object, set the **Object Name** following the pattern:

```
DeviceType_Number_ParameterName [Unit]
```

**Examples:**
- Object: Type 23, Instance 0 → Name: `EM_01_Voltage [V]`
- Object: Type 23, Instance 1 → Name: `EM_01_Current [A]`
- Object: Type 23, Instance 2 → Name: `EM_01_Power [kW]`
- Object: Type 23, Instance 10 → Name: `VFD1_Speed [RPM]`
- Object: Type 23, Instance 11 → Name: `VFD1_Torque [Nm]`

### Step 4: Save and Test
1. Save configuration
2. Restart BACnet service if needed
3. Use Energy Pilot's "Discover Devices" and "Scan Objects" to verify

---

## How the System Groups Devices

### Grouping Logic

1. **Scan all BACnet objects** from gateway (Type 23 Program objects)
2. **Parse object names** to extract device prefix
3. **Group by prefix**:
   - `EM_01_Voltage` → Device: **EM_01**
   - `EM_01_Current` → Device: **EM_01**
   - `EM_02_Voltage` → Device: **EM_02**
   - `VFD1_Speed` → Device: **VFD1**

### Result

Each device appears as a separate **meter** in the Energy Pilot system with all its parameters grouped together.

---

## Best Practices

### ✅ DO

- Use consistent prefixes across all parameters of the same device
- Use zero-padded numbers for 10+ devices (EM_01, EM_02, ... EM_10)
- Include units in parameter names for clarity: `[V]`, `[A]`, `[kW]`, `[Hz]`
- Use descriptive parameter names: `ActivePower`, `Voltage_L1`, `TotalEnergy`
- Keep names under 50 characters

### ❌ DON'T

- Mix naming patterns for the same device:
  - ❌ `EM-01_Voltage` and `EM01_Current` (inconsistent separator)
  - ❌ `EM_01_Voltage` and `EM_1_Current` (inconsistent number format)
- Use spaces in device prefixes:
  - ❌ `EM 01_Voltage` (use underscore: `EM_01_Voltage`)
- Omit device number for multiple devices:
  - ❌ `EM_Voltage` for multiple meters (use `EM_01_Voltage`, `EM_02_Voltage`)

---

## Example Configuration

### Scenario: Factory with 3 Energy Meters and 2 VFDs

**Loytec BACnet Object Names:**

```
# Main Incomer - Energy Meter 01
EM_01_Voltage_L1 [V]
EM_01_Voltage_L2 [V]
EM_01_Voltage_L3 [V]
EM_01_Current_L1 [A]
EM_01_Current_L2 [A]
EM_01_Current_L3 [A]
EM_01_ActivePower [kW]
EM_01_Energy [kWh]
EM_01_Frequency [Hz]

# Production Line 1 - Energy Meter 02
EM_02_Voltage [V]
EM_02_Current [A]
EM_02_Power [kW]
EM_02_Energy [kWh]

# Production Line 2 - Energy Meter 03
EM_03_Voltage [V]
EM_03_Current [A]
EM_03_Power [kW]
EM_03_Energy [kWh]

# Compressor VFD - Drive 1
VFD1_InputPower [kW]
VFD1_MotorVoltage [V]
VFD1_MotorCurrent [A]
VFD1_Frequency [Hz]
VFD1_Speed [RPM]
VFD1_Torque [Nm]

# Pump VFD - Drive 2
VFD2_Speed [RPM]
VFD2_Power [kW]
VFD2_Status
```

**Energy Pilot Discovery Result:**

- ✅ **EM_01** - 9 parameters (Main Incomer, 3-phase)
- ✅ **EM_02** - 4 parameters (Production Line 1)
- ✅ **EM_03** - 4 parameters (Production Line 2)
- ✅ **VFD1** - 6 parameters (Compressor Drive)
- ✅ **VFD2** - 3 parameters (Pump Drive)

**Total: 5 devices properly grouped and identified**

---

## Automatic Device Type Detection

If no explicit prefix is found, the system attempts to auto-detect device type based on parameter names:

| Keywords Found | Detected Type |
|----------------|---------------|
| motor, frequency, speed, torque | **VFD** |
| kwh, energy | **Energy Meter** |
| power + voltage + current | **Power Meter** |
| Default | **Modbus Device** |

**Auto-detected name format**: `{Type} (Device {DeviceID})`

**Example**: `VFD (Device 17800)`

---

## Troubleshooting

### Issue: Multiple devices grouped as one

**Cause**: Inconsistent or missing device prefixes

**Solution**: Ensure all parameters use the same prefix pattern:
```
✅ CORRECT:
EM_01_Voltage
EM_01_Current
EM_02_Voltage
EM_02_Current

❌ WRONG:
EM_01_Voltage
EM_Current        ← Missing device number
Voltage_EM_02     ← Wrong order
EM-01-Current     ← Wrong separator
```

### Issue: Device not appearing in scan

**Cause**: Object names don't match Modbus-related patterns

**Solution**: Ensure names include keywords like: power, voltage, current, energy, kwh, frequency, motor, speed, torque, etc.

### Issue: Parameters split into multiple devices

**Cause**: Inconsistent device number format

**Solution**: Use consistent numbering:
```
✅ CORRECT:
EM_01_Voltage
EM_01_Current

❌ WRONG:
EM_01_Voltage
EM_1_Current     ← Inconsistent: 01 vs 1
```

---

## Dashboard Parameter Mapping

The system automatically maps standard energy meter parameters to dashboard fields for real-time display. When you select meters to save, these parameters are recognized and mapped:

### Standard Energy Meter Parameters

#### 📊 Voltage Measurements
- **Single Phase**: `Voltage [V]`
- **Three Phase Line-to-Line**:
  - `Voltage L1-L2 [V]`
  - `Voltage L2-L3 [V]`
  - `Voltage L3-L1 [V]`
- **Three Phase Line-to-Neutral** (4-wire systems):
  - `Voltage L1-N [V]`
  - `Voltage L2-N [V]`
  - `Voltage L3-N [V]`

#### ⚡ Current Measurements
- `Current L1 [A]`
- `Current L2 [A]`
- `Current L3 [A]`
- `Current [A]` (single phase)

#### ⏱ Frequency
- `Frequency [Hz]`

#### 🔋 Power & Energy
- `Total Active Power [kW]` or `ActivePower [kW]`
- `Total Active Energy [kWh]` or `Energy [kWh]`
- `Reactive Power [kVAr]`
- `Apparent Power [kVA]`
- `Power Factor` or `PF`

### Mapped Fields

When saving meters to devices, parameters are automatically mapped to these database fields:

| Parameter Category | Maps To Field | Dashboard Display |
|-------------------|---------------|-------------------|
| Voltage (any phase) | `voltage` | Real-time voltage chart |
| Current (any phase) | `current` | Real-time current chart |
| Active Power | `power` | Main power gauge |
| Active Energy | `energy` | Cumulative energy counter |
| Frequency | `frequency` | Frequency indicator |
| Power Factor | `powerFactor` | PF gauge |

### Example: Energy Meter with Full Parameters

```
EM_01_Voltage_L1-L2 [V]      → voltage field (L1-L2 phase)
EM_01_Voltage_L2-L3 [V]      → voltage field (L2-L3 phase)
EM_01_Voltage_L3-L1 [V]      → voltage field (L3-L1 phase)
EM_01_Current_L1 [A]         → current field (L1 phase)
EM_01_Current_L2 [A]         → current field (L2 phase)
EM_01_Current_L3 [A]         → current field (L3 phase)
EM_01_Frequency [Hz]         → frequency field
EM_01_TotalActivePower [kW]  → power field
EM_01_TotalActiveEnergy [kWh] → energy field
```

**Dashboard Display**: All these parameters will be visible in the real-time dashboard with live updates.

---

## Summary

✅ Use format: `DeviceType_Number_ParameterName`

✅ Supported prefixes: Meter, EM, VFD, Drive, Inverter, Device, Unit, Sensor

✅ Consistent naming within each device

✅ Include units in parameter names: `[V]`, `[A]`, `[kW]`

✅ Zero-pad numbers for 10+ devices: EM_01, EM_02, ..., EM_10

✅ Standard parameters automatically map to dashboard fields

---

## Related Documentation

- [BACnet-Modbus Integration Roadmap](./BACnet-IP-Modbus-Integration-Roadmap.md)
- [Modbus Meter Configuration Guide](./Modbus-Meter-Configuration-Guide.md)
- [BACnet Troubleshooting Guide](./BACnet-Troubleshooting-Guide.md)
- [Modbus RTU Integration Guide](./Modbus-RTU-Integration-Guide.md)

---

**Document Version**: 1.1  
**Last Updated**: December 31, 2025  
**Author**: Energy Pilot Development Team
