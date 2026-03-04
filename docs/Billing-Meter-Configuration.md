# Billing Meter Configuration Guide

## Overview

The Energy-Pilot system supports **Main Billing Meters** and **Sub-Meters** to accurately calculate energy costs without double-counting.

## Problem: Double-Counting Energy

In real buildings, you have two types of meters:

### 1. Main Billing Meters (Utility Meters)
- **Location**: At the main electrical incomer from the utility company
- **Purpose**: Measure actual energy purchased from the utility
- **Used For**: Cost calculation and billing
- **Examples**:
  - Main building incomer
  - Utility meter at service entrance
  - Primary distribution panel meters

### 2. Sub-Meters (Distribution Monitoring)
- **Location**: Downstream of main meters on individual circuits/systems
- **Purpose**: Monitor energy distribution to different areas/equipment
- **Used For**: Monitoring and analysis only (NOT for billing)
- **Examples**:
  - HVAC system meter
  - Lighting circuit meter
  - Data center meter
  - Production line meter
  - Individual floor/department meters

### The Double-Counting Issue

**Scenario:**
```
Main Incomer Meter: 1000 kWh (actual utility consumption)
  ├─ HVAC Sub-Meter: 400 kWh
  ├─ Lighting Sub-Meter: 300 kWh
  └─ Data Center Sub-Meter: 300 kWh
```

**WRONG Calculation (all meters summed):**
- Total = 1000 + 400 + 300 + 300 = **2000 kWh** ❌
- Cost = 2000 × ₹8 = **₹16,000** (WRONG!)

**CORRECT Calculation (billing meters only):**
- Total = 1000 kWh ✅
- Cost = 1000 × ₹8 = **₹8,000** (CORRECT!)

The sub-meters measure energy that's already counted by the main meter, so including them in cost calculations inflates costs incorrectly.

## Solution: Billing Meter Flag

The system uses an `isBillingMeter` flag to distinguish:
- **TRUE** = Main utility meter → Include in cost calculations
- **FALSE** = Sub-meter → Use for monitoring only

## Configuration

### 1. Marking Meters as Billing Meters

**Via Device Edit Dialog:**
1. Navigate to **Devices** or **Meters** page
2. Click **Edit** on a meter
3. Check **"Main Billing Meter"** checkbox for utility meters
4. Leave unchecked for all sub-meters
5. Click **Update Device**

**Important Guidelines:**
- ✅ Mark main incoming/utility meters as billing meters
- ❌ Do NOT mark sub-meters as billing meters
- 💡 When in doubt: Only meters that appear on your utility bill should be marked as billing meters

### 2. Visual Indicators

Billing meters are identified with a **💰 BILLING** badge:
- Appears on Device list
- Appears on Meters card view
- Appears on Meters table view

### 3. Custom Analytics Display

The Custom Analytics page shows:
- Energy consumption from billing meters only
- Cost calculated from billing meters only
- Clear indicator: "From X billing meter(s)"
- Info box explaining the calculation method

### 4. System-Wide Cost Calculations

**All cost-related displays now use billing meters only:**

✅ **Custom Analytics** (`/api/analytics/custom`)
- All KPI calculations use billing meter energy
- Metadata shows `billingMetersUsedForCost` count

✅ **Period Analytics** (`/api/analytics/periods`)
- Daily, weekly, monthly cost trends
- Used by Analytics page time period selector
- Response includes `billingMetersUsed` count

✅ **Dashboard Summary** (`/api/analytics/summary`)
- Projected monthly cost calculation
- Building performance metrics
- Response includes `billingMetersUsed` count

✅ **Consumption Data** (`/api/analytics/consumption`)
- Daily consumption charts
- Cost breakdowns by time period
- Only billing meters included in summaries

**Note:** Power, voltage, current statistics still use ALL meters for monitoring purposes.

## Demo Configuration

In mock mode, the following setup is used:

| Meter Name           | Type         | Billing Meter | Usage                    |
|---------------------|--------------|---------------|--------------------------|
| EM-MAIN-INCOMER     | Smart Meter  | ✅ TRUE       | Main utility meter       |
| EM-HVAC-SYSTEM      | Smart Meter  | ❌ FALSE      | HVAC monitoring only     |
| EM-LIGHTING-CIRCUIT | Smart Meter  | ❌ FALSE      | Lighting monitoring only |
| EM-DATA-CENTER      | Smart Meter  | ❌ FALSE      | Data center monitoring   |
| EM-PRODUCTION-LINE  | Smart Meter  | ❌ FALSE      | Production monitoring    |

**Result:** Only EM-MAIN-INCOMER's energy is used for cost calculations.

## Database Schema

### Field: `isBillingMeter`
- **Type**: Boolean
- **Default**: `false`
- **Location**: `devices` table
- **Description**: Indicates if meter should be used for cost calculation

## API Response Examples

All analytics endpoints now include billing meter metadata:

### `/api/analytics/custom` (Custom Analytics KPIs)
```json
{
  "metadata": {
    "totalEnergy": 182247.3,
    "totalCost": 1457978,
    "billingMetersCount": 1,
    "billingMetersUsedForCost": 1,
    "onlineDevices": 5,
    "devicesWithData": 5
  }
}
```

### `/api/analytics/periods` (Daily/Weekly/Monthly Trends)
```json
{
  "period": "week",
  "consumption": 1250.5,
  "cost": 10004,
  "onlineDevices": 5,
  "billingMetersCount": 1,
  "billingMetersUsed": 1,
  "devicesWithData": 1
}
```

### `/api/analytics/summary` (Dashboard Projection)
```json
{
  "projectedMonthlyCost": "73598",
  "onlineDevices": 5,
  "billingMetersCount": 1,
  "billingMetersUsed": 1,
  "devicesWithCurrentData": 5
}
```

**Key Fields:**
- `billingMetersCount`: How many billing meters are configured
- `billingMetersUsed`: How many contributed to this calculation
- `onlineDevices`: Total devices (billing + sub-meters)
- `devicesWithData`: Devices with valid readings (all types)

## Best Practices

### ✅ DO:
- Mark only main incoming/utility meters as billing meters
- Review billing meter configuration quarterly
- Verify costs match utility bills
- Document which meters are billing meters

### ❌ DON'T:
- Mark sub-meters as billing meters
- Assume all meters should be billing meters
- Include monitoring-only meters in cost calculations
- Forget to configure new meters

## Implementation Details

### Backend Logic (server/routes.ts)

```typescript
// Filter for billing meters only for energy/cost calculation
const billingMeters = onlineDevices.filter(d => d.isBillingMeter === true);

// Calculate energy and cost ONLY from billing meters
for (const device of billingMeters) {
  // ... sum energy consumption
  totalEnergy += deviceConsumption;
}

// Calculate stats from ALL meters (power, voltage, current)
for (const device of allMetersForStats) {
  // ... calculate statistics
}

totalCost = totalEnergy * tariffRate;
```

### Key Points:
- **Energy/Cost**: Sum from billing meters only
- **Statistics** (power, voltage, current): Calculate from all meters
- **Prevents double-counting**: Sub-meter energy not included in costs

## Troubleshooting

### Issue: Cost seems too low
**Solution**: Verify main utility meters are marked as billing meters

### Issue: Cost seems too high
**Solution**: Verify sub-meters are NOT marked as billing meters

### Issue: Missing billing meters count
**Solution**: At least one meter must be marked as billing meter

### Issue: No cost data showing
**Solution**: Ensure billing meters are online and generating readings

## Related Documentation

- [Custom Analytics Configuration](./custom-analytics.json)
- [Data Validation System](./Data-Validation-System.md)
- [Energy Meter Discovery Guide](./Energy-Meter-Discovery-Guide.md)

## Version History

- **v1.0** (Feb 2026): Initial implementation of billing meter flag
- Feature added based on production deployment feedback to prevent double-counting in multi-meter installations
