# Demo Energy Meters Setup Guide

## Overview

This document describes the 5 demo energy meters configured for client demonstrations and system testing. Each meter has been configured with full 3-phase parameters and includes 15 days of realistic historical data.

---

## Demo Meters Configuration

### 1. **EM-MAIN-INCOMER**
- **Location**: Main Electrical Room - Incomer
- **Type**: Main Building Supply
- **Power Profile**: Office Hours (8 AM - 6 PM peak)
- **Power Range**: 450-650 kW
- **Rated Voltage**: 400V (3-phase)
- **Rated Current**: 800A
- **IP Address**: 192.168.1.100
- **Modbus Address**: 10

**Characteristics**:
- High load during office hours (75-90%)
- Reduced load evenings/nights (35-50%)
- Minimal load on weekends (15%)
- Represents total building consumption

---

### 2. **EM-HVAC-SYSTEM**
- **Location**: Mechanical Floor - HVAC
- **Type**: HVAC Central Plant
- **Power Profile**: Seasonal (Temperature-dependent)
- **Power Range**: 120-280 kW
- **Rated Voltage**: 400V (3-phase)
- **Rated Current**: 350A
- **IP Address**: 192.168.1.101
- **Modbus Address**: 11

**Characteristics**:
- Peak load 10 AM - 4 PM (85-95%)
- Medium load extended hours (55-70%)
- Night setback mode (20-30%)
- Cyclical patterns based on cooling demand

---

### 3. **EM-LIGHTING-CIRCUIT**
- **Location**: Distribution Board - Lighting
- **Type**: Building Lighting
- **Power Profile**: Office Hours
- **Power Range**: 45-95 kW
- **Rated Voltage**: 400V (3-phase)
- **Rated Current**: 120A
- **IP Address**: 192.168.1.102
- **Modbus Address**: 12

**Characteristics**:
- High during office hours (75-90%)
- Low during non-working hours (10-15%)
- Weekend minimal lighting (15%)
- Clear day/night pattern

---

### 4. **EM-DATA-CENTER**
- **Location**: Server Room - UPS Output
- **Type**: IT Infrastructure
- **Power Profile**: 24x7 Constant
- **Power Range**: 180-220 kW
- **Rated Voltage**: 400V (3-phase)
- **Rated Current**: 320A
- **IP Address**: 192.168.1.103
- **Modbus Address**: 13

**Characteristics**:
- Consistent 75-90% load 24/7
- No significant daily variations
- Minor fluctuations based on compute workload
- High reliability requirement

---

### 5. **EM-PRODUCTION-LINE**
- **Location**: Factory Floor - Production
- **Type**: Manufacturing Equipment
- **Power Profile**: Industrial Shifts
- **Power Range**: 250-480 kW
- **Rated Voltage**: 400V (3-phase)
- **Rated Current**: 600A
- **IP Address**: 192.168.1.104
- **Modbus Address**: 14

**Characteristics**:
- High load during production hours 6 AM - 10 PM (80-95%)
- Night shift operation (25-35%)
- Reduced weekend operation (20%)
- Variable based on production schedule

---

## Full 3-Phase Parameter Template

Each meter captures the following parameters:

### Power Measurements
- `power` - Total active power (kW)

### Voltage Measurements (3-phase)
- `voltage` - Average voltage (V)
- `voltageL1L2` - L1-L2 phase voltage (V)
- `voltageL2L3` - L2-L3 phase voltage (V)
- `voltageL3L1` - L3-L1 phase voltage (V)

### Current Measurements (3-phase)
- `current` - Average current (A)
- `currentL1` - L1 phase current (A)
- `currentL2` - L2 phase current (A)
- `currentL3` - L3 phase current (A)

### Energy & Power Quality
- `energy` - Cumulative energy consumption (kWh)
- `frequency` - Line frequency (Hz) - typically 50 Hz ± 0.1
- `powerFactor` - Power factor (0.88 - 0.96)

---

## Historical Data

### Data Coverage
- **Time Range**: Last 15 days
- **Interval**: Hourly readings
- **Total Readings**: 360 per meter (1,800 total)
- **Data Points**: 13 parameters × 1,800 readings = 23,400 data points

### Realistic Patterns
The mock data includes:
- ✅ Daily load cycles (day/night variations)
- ✅ Weekend patterns (reduced consumption)
- ✅ Profile-specific behaviors (office/industrial/24x7)
- ✅ Realistic voltage variations (±4V from nominal)
- ✅ Balanced 3-phase currents with minor imbalances
- ✅ Frequency stability (50 Hz ± 0.1 Hz)
- ✅ Power factor in typical range (0.88 - 0.96)
- ✅ Cumulative energy accumulation

---

## Usage

### View Meters Dashboard
```
http://localhost:5000/meters
```

### Reset and Recreate Demo Data
```bash
npm run add-demo-meters
```

### Clean All Demo Meters
```bash
npm run reset-db
```

---

## API Endpoints

### Get All Meters
```bash
GET /api/meters
```

### Get Meter Current Reading
```bash
GET /api/meters/{id}/reading
```

### Get Meter Historical Readings
```bash
GET /api/meters/{id}/readings?hours=24
```
Parameters:
- `hours` - Number of hours of history (default: 24, max: 720)

---

## Demo Scenarios

### Scenario 1: Energy Consumption Analysis
- View total building consumption (EM-MAIN-INCOMER)
- Compare sub-system consumption (HVAC, Lighting, Data Center)
- Identify peak demand periods

### Scenario 2: Load Profiling
- Analyze daily load patterns
- Compare weekday vs weekend consumption
- Identify optimization opportunities

### Scenario 3: Power Quality Monitoring
- Monitor voltage stability across phases
- Check current balance
- Verify frequency stability
- Track power factor trends

### Scenario 4: Real-time Monitoring
- Live meter cards with 2-second updates
- Status indicators (online/offline)
- Multi-parameter visualization

### Scenario 5: Historical Trend Analysis
- 15-day consumption trends
- Hour-by-hour comparisons
- Energy usage forecasting

---

## Technical Details

### Database Schema
- **Table**: `devices` - Meter configurations
- **Table**: `readings` - All measurements
- **Indexes**: deviceId, timestamp for fast queries

### Data Generation
- **Script**: `script/add-demo-meters.ts`
- **Power Calculation**: Profile-based with time-of-day variations
- **Voltage**: Base ± random variation (±4V)
- **Current**: Calculated from power using I = P/(√3 × V × PF)
- **Energy**: Cumulative integration of power over time
- **Frequency**: 50 Hz ± 0.1 Hz random variation
- **Power Factor**: 0.88 - 0.96 typical range

---

## Manufacturer Information

All demo meters are configured as:
- **Manufacturer**: Schneider Electric
- **Model**: PM5340
- **Protocol**: Modbus RTU/TCP
- **Phases**: 3-phase, 4-wire
- **Accuracy Class**: 0.5S (IEC 62053-22)

---

## Next Steps

1. **View Dashboard**: Open http://localhost:5000/meters
2. **Explore Readings**: Click eye icon on any meter card
3. **Check Trends**: View 15 days of historical data
4. **Test Real-time**: Watch live updates every 2 seconds
5. **Demo to Client**: Show realistic energy monitoring scenarios

---

**Document Version**: 1.0  
**Last Updated**: February 9, 2026  
**Created By**: Energy Pilot Demo Setup Script
