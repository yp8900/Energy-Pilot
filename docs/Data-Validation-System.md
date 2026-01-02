# Data Validation System

## Overview

The Energy-Pilot system now includes comprehensive data validation to ensure that analytics calculations only include readings with meaningful, valid data. This prevents invalid or "N/A" readings from skewing calculations and provides accurate insights.

## Problem Statement

When BACnet devices fail to respond or return "invalid value" errors, the system could previously record readings with zero or null values. Including these invalid readings in analytics calculations would:

- **Skew averages**: Example: `(0+0+0+0+65)/5 = 13 kW` instead of correct `65/1 = 65 kW`
- **Inflate device counts**: Show 5 devices contributing to averages when only 1 has valid data
- **Produce incorrect costs**: Calculate costs based on zeros, showing lower costs than actual
- **Mislead users**: Display N/A in the UI but use those values in backend calculations

## Validation Rules

### Reading Validation Logic

A reading is considered **valid** if it meets the following criteria:

```typescript
function isValidReading(reading: any): boolean {
  if (!reading) return false;
  
  const validParams = [
    reading.power && reading.power > 0,
    reading.voltage && reading.voltage > 0,
    reading.current && reading.current > 0,
    reading.frequency && reading.frequency > 0
  ].filter(Boolean).length;
  
  return validParams >= 2; // Requires at least 2 valid parameters
}
```

**Requirements:**
- At least **2 out of 4** main parameters must be present and greater than 0
- Parameters checked: `power`, `voltage`, `current`, `frequency`
- All parameters must be positive numbers (> 0)

**Examples:**
- ✅ **Valid**: Power=65kW, Voltage=387V, Current=56A, Frequency=50Hz (4/4 params)
- ✅ **Valid**: Power=65kW, Voltage=387V (2/4 params)
- ❌ **Invalid**: Power=65kW only (1/4 params)
- ❌ **Invalid**: All zeros (0/4 params)
- ❌ **Invalid**: Null or undefined reading

## Implementation

### Backend Filtering (server/routes.ts)

All analytics endpoints now filter readings before processing:

#### 1. Periods Endpoint (`/api/analytics/periods`)
```typescript
for (const device of onlineDevices) {
  const readings = await storage.getMeterReadings(device.id, Math.ceil(periodHours));
  
  // Filter to valid readings only
  const validReadings = readings.filter(isValidReading);
  
  if (validReadings.length === 0) {
    devicesWithoutData++;
    continue; // Skip device entirely
  }
  
  devicesWithData++;
  
  // Process ONLY validReadings for calculations
  for (const reading of validReadings) {
    // ... daily consumption calculation
  }
}
```

**Response includes:**
- `devicesWithData`: Number of devices with valid readings
- `devicesWithoutData`: Number of devices without valid data
- `consumption`: Calculated only from valid readings
- `cost`: Based only on valid consumption

#### 2. Custom Analytics Endpoint (`/api/analytics/custom`)
```typescript
for (const device of onlineDevices) {
  const readings = await storage.getMeterReadings(device.id, Math.ceil(periodHours));
  
  const validReadings = readings.filter(isValidReading);
  
  if (validReadings.length === 0) {
    devicesWithoutData++;
    continue;
  }
  
  devicesWithData++;
  
  // Calculate parameters ONLY from validReadings
  for (const reading of validReadings) {
    avgPower += reading.power;
    powerCount++;
    
    // Track voltage - only from valid readings
    if (reading.voltage) {
      avgVoltage += reading.voltage;
      voltageCount++;
    }
    
    // Track current - only from valid readings
    if (reading.current) {
      avgCurrent += reading.current;
      currentCount++;
    }
    // ... other calculations
  }
}

// Calculate averages
avgPower = powerCount > 0 ? avgPower / powerCount : 0;
avgVoltage = voltageCount > 0 ? avgVoltage / voltageCount : 0;
avgCurrent = currentCount > 0 ? avgCurrent / currentCount : 0;

// Use devicesWithData for deviceCount parameter
const paramValues = {
  deviceCount: devicesWithData, // Not onlineDevices.length
  avgPower,
  avgVoltage,
  avgCurrent,
  // ... other parameters
};
```

**Response includes:**
- `metadata.devicesWithData`: Devices that contributed to calculations
- `metadata.devicesWithoutData`: Devices excluded due to no valid data
- `metadata.avgVoltage`: Average voltage from valid readings only
- `metadata.avgCurrent`: Average current from valid readings only
- `calculations`: Results based only on valid data

**Available for custom formulas**: `totalEnergy`, `totalCost`, `avgPower`, `maxPower`, `deviceCount`, `daysElapsed`, `avgVoltage`, `avgCurrent`, `sumOfIndividualPeaks`, `systemPeak`

#### 3. Power Trend Endpoint (`/api/analytics/power-trend`)
```typescript
for (const device of onlineDevices) {
  const readings = await storage.getMeterReadings(device.id, hours);
  
  // Filter to only valid readings
  const validReadings = readings.filter(isValidReading);
  
  validReadings.forEach(reading => {
    if (reading.power && reading.timestamp) {
      allReadings.push({
        timestamp: new Date(reading.timestamp),
        power: reading.power
      });
    }
  });
}
```

**Result**: Chart data includes only valid power readings, showing accurate trends.

#### 4. Summary Endpoint (`/api/analytics/summary`)
```typescript
let devicesWithCurrentData = 0;

for (const device of onlineDevices) {
  const reading = await storage.getMeterReading(device.id);
  
  // Check if current reading is valid
  if (reading && isValidReading(reading)) {
    const power = reading.power || 0;
    totalCurrentPower += power;
    // ... other calculations
    devicesWithCurrentData++;
  }
}

// Historical data also filtered
for (const device of devices) {
  const readings = await storage.getMeterReadings(device.id, 30 * 24);
  const validReadings = readings.filter(isValidReading);
  // ... process only validReadings
}
```

**Response includes:**
- `devicesWithCurrentData`: Devices with valid current readings
- Calculations based only on valid historical data

#### 5. Cost Trends Endpoint (`/api/analytics/cost-trends`)
```typescript
for (const device of devices) {
  const readings = await storage.getMeterReadings(device.id, daysNum * 24);
  
  const validReadings = readings.filter(isValidReading);
  
  if (validReadings.length === 0) {
    console.log(`⚠️  No valid data, skipping ${device.name}`);
    continue;
  }
  
  // Group by date using ONLY validReadings
  const dailyReadings = validReadings.filter(r => new Date(r.timestamp) >= startDate);
  // ... calculate daily consumption
}
```

**Result**: Cost trends exclude devices with no valid data, showing accurate historical costs.

### Frontend Display

#### Visual Indicators (Meters.tsx, Dashboard.tsx)

```tsx
// Check if reading is valid (same logic as backend)
const validParams = [
  reading?.power && reading.power > 0,
  reading?.voltage && reading.voltage > 0,
  reading?.current && reading.current > 0,
  reading?.frequency && reading.frequency > 0
].filter(Boolean).length;
const hasData = reading && validParams >= 2;

const formatValue = (value, unit, decimals, isOffline, hasData) => {
  if (!hasData || value === undefined || value === null) {
    return <span className="text-red-500 font-semibold">N/A</span>;
  }
  if (isOffline) {
    return <span className="text-gray-400">Offline</span>;
  }
  return `${value.toFixed(decimals)} ${unit}`;
};
```

**Display States:**
- **N/A** (red, `text-red-500`): Reading exists but has < 2 valid parameters
- **Offline** (gray, `text-gray-400`): Device status is offline
- **Normal**: Reading has >= 2 valid parameters, displays actual value

#### Data Summary (Dashboard.tsx)

```tsx
<StatsCard
  title="Online Devices"
  value={analytics?.onlineDevices || 0}
  unit={`/ ${analytics?.totalDevices || 0}`}
  icon={<Server className="h-5 w-5" />}
  description={periodData?.devicesWithData ? `${periodData.devicesWithData} with valid data` : undefined}
/>
```

Shows: `5 / 5` with description `"1 with valid data"` when only 1 device has valid readings.

#### Custom Analytics (CustomAnalytics.tsx)

```tsx
<div>
  <p className="text-xs text-muted-foreground">Active Devices</p>
  <p className="text-xl font-bold">{data.metadata.deviceCount}</p>
  {data.metadata.devicesWithData !== undefined && (
    <p className="text-xs text-muted-foreground mt-0.5">
      {data.metadata.devicesWithData} with valid data
      {data.metadata.devicesWithoutData > 0 && (
        <span className="text-red-500"> • {data.metadata.devicesWithoutData} N/A</span>
      )}
    </p>
  )}
</div>
```

Shows: `1 with valid data • 4 N/A` when 4 devices have invalid readings.

## Impact on Calculations

### Before Validation

With 5 devices (EM_01-04 invalid, EM_05 valid with 65kW):

```
Total Power = 0 + 0 + 0 + 0 + 65 = 65 kW ✅ (accidentally correct)
Average Power = 65 / 5 = 13 kW ❌ (wrong - includes invalid devices)
Device Count = 5 ❌ (includes invalid devices)
Load Factor = (13 / 5 / 65) * 100 = 4% ❌ (completely wrong)
```

### After Validation

With 5 devices (EM_01-04 filtered out, EM_05 valid with 65kW):

```
Total Power = 65 kW ✅ (correct)
Average Power = 65 / 1 = 65 kW ✅ (correct - only valid device)
Device Count = 1 ✅ (only counts devices with valid data)
Load Factor = (65 / 1 / 65) * 100 = 100% ✅ (correct)
```

### Custom Calculations

**Energy Efficiency** (`(totalEnergy / totalCost) * 100`):
- **Before**: Based on 5 devices, includes zeros → skewed result
- **After**: Based on 1 device with valid data → accurate result

**Load Factor** (`(sumOfIndividualPeaks / systemPeak / deviceCount) * 100`):
- **Before**: deviceCount=5, includes invalid devices → inflated denominator
- **After**: deviceCount=1, only valid devices → accurate percentage

**Carbon Footprint** (`totalEnergy * 0.82`):
- **Before**: totalEnergy includes zeros from invalid devices
- **After**: totalEnergy only from valid readings → accurate emissions

## Testing & Verification

### Current System State

With the current setup:
- **EM_01**: 1 valid param (Power) → **Invalid** → Shows **N/A**
- **EM_02-04**: 0 valid params → **Invalid** → Shows **N/A**
- **EM_05**: 4 valid params (Power, Voltage, Current, Frequency) → **Valid** → Shows values

### Expected Results

All analytics endpoints should now report:
- `devicesWithData: 1`
- `devicesWithoutData: 4`
- `deviceCount: 1` (in custom analytics)
- Calculations based only on EM_05 data

### Verification Steps

1. **Check Dashboard "Online Devices" card**: Should show `"1 with valid data"`
2. **Check Custom Analytics**: Should show `"1 with valid data • 4 N/A"`
3. **Check Power Trend chart**: Should only plot EM_05 readings
4. **Check Cost Trends**: Should only calculate costs from EM_05 consumption
5. **Check Period calculations**: Consumption should match EM_05 only

## Benefits

✅ **Accurate Analytics**: Calculations reflect only devices with meaningful data  
✅ **Transparent Reporting**: Users see how many devices contribute to metrics  
✅ **Reliable Trends**: Charts and graphs show true patterns, not skewed by invalid data  
✅ **Correct Costs**: Cost calculations based on actual consumption, not zeros  
✅ **Better Decisions**: Business decisions based on accurate, validated data  
✅ **Clear UI Feedback**: Visual indicators (N/A in red) match backend behavior  

## Maintenance

### Adding New Endpoints

When adding new analytics endpoints, always:

1. **Filter readings**:
   ```typescript
   const validReadings = readings.filter(isValidReading);
   ```

2. **Track device counts**:
   ```typescript
   let devicesWithData = 0;
   let devicesWithoutData = 0;
   
   if (validReadings.length === 0) {
     devicesWithoutData++;
     continue;
   }
   devicesWithData++;
   ```

3. **Include in response**:
   ```typescript
   res.json({
     // ... other data
     devicesWithData,
     devicesWithoutData
   });
   ```

### Modifying Validation Rules

To change validation requirements, update `isValidReading()` function in `server/routes.ts`:

```typescript
// Example: Require 3 out of 4 parameters
return validParams >= 3;

// Example: Only check power and voltage
const validParams = [
  reading.power && reading.power > 0,
  reading.voltage && reading.voltage > 0
].filter(Boolean).length;
return validParams >= 2;
```

**Important**: If you change backend validation, update frontend validation in `Meters.tsx` and `Dashboard.tsx` to match!

## Future Enhancements

Potential improvements:
- **Configurable threshold**: Allow admins to set validation threshold (1, 2, 3, or 4 params required)
- **Per-parameter validation**: Different thresholds for different meter types
- **Data quality score**: Show % of valid readings over time
- **Automatic alerts**: Notify when device data quality drops below threshold
- **Historical quality tracking**: Track which devices frequently have invalid data
- **Validation dashboard**: Dedicated page showing data quality metrics per device

## Conclusion

The data validation system ensures that all analytics, calculations, and reports are based on reliable, meaningful data. Invalid readings are excluded from calculations while being clearly indicated in the UI, providing users with accurate insights and transparent reporting about data quality.
