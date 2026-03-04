# Sample CSV Files

These are example CSV files showing the expected format for importing meter data.

## Files

- **devices.csv** - Sample device/meter definitions
- **readings.csv** - Sample meter readings with full parameters
- **alerts.csv** - Sample alert history

## Usage

These files are templates to help you:
1. Understand the CSV format expected by the import script
2. Map your SQL Server data to the correct columns
3. Test the import process with sample data

## Testing the Import

```bash
# Test import with sample data
npm run import-data -- --source ./script/sample-csv --clear
```

## Column Mapping

### devices.csv

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| Id | No* | Original device ID from SQL Server | 1, 2, 3 |
| Name | Yes | Device/meter name | "Main Building Meter" |
| Type | Yes | Device type | "Smart Meter", "PLC", "Sensor" |
| Location | No | Physical location | "Building A - Ground Floor" |
| IpAddress | No | IP address | "192.168.1.100" |
| Status | No | Current status | "online", "offline", "maintenance" |

*Id is used only for mapping to readings/alerts, new IDs are auto-generated

### readings.csv

| Column | Required | Unit | Description |
|--------|----------|------|-------------|
| Id | No | - | Original reading ID |
| DeviceId | Yes | - | References device Id |
| Power | No | kW | Active power |
| Voltage | No | V | Average voltage |
| VoltageL1L2 | No | V | L1-L2 phase voltage |
| VoltageL2L3 | No | V | L2-L3 phase voltage |
| VoltageL3L1 | No | V | L3-L1 phase voltage |
| Current | No | A | Average current |
| CurrentL1 | No | A | L1 phase current |
| CurrentL2 | No | A | L2 phase current |
| CurrentL3 | No | A | L3 phase current |
| Energy | No | kWh | Total energy |
| Frequency | No | Hz | Line frequency |
| PowerFactor | No | - | Power factor (0-1) |
| Timestamp | Yes | - | Reading timestamp (ISO 8601) |

### alerts.csv

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| Id | No | Original alert ID | 1, 2, 3 |
| DeviceId | Yes | References device Id | 1, 2, 3 |
| Severity | Yes | Alert severity | "critical", "warning", "info" |
| Message | Yes | Alert message | "High power consumption" |
| Timestamp | Yes | Alert timestamp | "2026-01-24 12:30:00" |
| Acknowledged | No | Acknowledgment status | true, false |

## Date Format

The import script accepts these date formats:
- ISO 8601: `2026-01-24T12:30:00Z`
- SQL Server style: `2026-01-24 12:30:00`
- Date only: `2026-01-24` (time defaults to 00:00:00)

## Tips

1. **CSV Encoding**: Use UTF-8 encoding for special characters
2. **Column Headers**: First row must contain exact column names (case-sensitive)
3. **Missing Values**: Leave cells empty for NULL values, don't use "NULL" string
4. **Commas in Data**: Wrap values containing commas in double quotes
5. **Device IDs**: Old IDs are mapped to new auto-generated IDs during import

## Customizing for Your Data

If your SQL Server tables have different column names:
1. Export your data as CSV
2. Edit the CSV headers to match the expected format above
3. Or modify the import script to map your column names

See [Data Import Guide](../../docs/Data-Import-Guide.md) for more details.
