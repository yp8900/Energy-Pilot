# Export METRO_BHAWAN BMS Data
# Focused export for EMS integration - Loytec/BACnet format

param(
    [Parameter(Mandatory=$false)]
    [string]$OutputFolder = ".\exported-data",
    
    [Parameter(Mandatory=$false)]
    [int]$DaysOfHistory = 15,
    
    [Parameter(Mandatory=$false)]
    [int]$MaxRecordsPerTable = 50000
)

$SqlServerInstance = "localhost\SQLEXPRESS"
$DatabaseName = "METRO_BHAWAN"

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   METRO_BHAWAN BMS Data Export         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Import-Module SqlServer

if (-not (Test-Path $OutputFolder)) {
    New-Item -ItemType Directory -Path $OutputFolder | Out-Null
}

Write-Host "📊 Configuration:" -ForegroundColor Yellow
Write-Host "  Database: $DatabaseName" -ForegroundColor Gray
Write-Host "  Instance: $SqlServerInstance" -ForegroundColor Gray
Write-Host "  Output: $OutputFolder" -ForegroundColor Gray
Write-Host "  History: Last $DaysOfHistory days" -ForegroundColor Gray
Write-Host ""

# Calculate timestamp cutoff (assuming timestamps are in seconds since epoch)
$cutoffDate = (Get-Date).AddDays(-$DaysOfHistory)
$cutoffTimestamp = [Math]::Floor(($cutoffDate - (Get-Date "1970-01-01")).TotalSeconds)

Write-Host "📋 Step 1: Discovering tables..." -ForegroundColor Cyan

$allTables = Invoke-Sqlcmd -ServerInstance $SqlServerInstance -Database $DatabaseName -TrustServerCertificate -Query @"
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME
"@

$trendTables = $allTables | Where-Object { $_.TABLE_NAME -like "TrendLog*" }
$alarmTables = $allTables | Where-Object { $_.TABLE_NAME -like "AlarmLog*" }
$otherTables = $allTables | Where-Object { $_.TABLE_NAME -notlike "TrendLog*" -and $_.TABLE_NAME -notlike "AlarmLog*" }

Write-Host "  ✓ Found $($trendTables.Count) TrendLog tables" -ForegroundColor Green
Write-Host "  ✓ Found $($alarmTables.Count) AlarmLog tables" -ForegroundColor Green
Write-Host "  ✓ Found $($otherTables.Count) other tables" -ForegroundColor Green
Write-Host ""

# Export TrendLogs (meter readings)
Write-Host "📊 Step 2: Exporting TrendLog data (meter readings)..." -ForegroundColor Cyan
$allReadings = @()
$tableCount = 0

foreach ($table in $trendTables) {
    $tableName = $table.TABLE_NAME
    $tableCount++
    
    Write-Host "  Processing $tableName ($tableCount/$($trendTables.Count))..." -ForegroundColor Gray
    
    try {
        # Get recent data from this trend log
        $data = Invoke-Sqlcmd -ServerInstance $SqlServerInstance -Database $DatabaseName -TrustServerCertificate -Query @"
SELECT TOP $MaxRecordsPerTable 
    '$tableName' as SourceTable,
    LogId,
    SeqNum,
    RecordType,
    ItemIndex,
    Value,
    Timestamp
FROM [dbo].[$tableName]
WHERE Timestamp >= $cutoffTimestamp
ORDER BY Timestamp DESC
"@
        
        if ($data) {
            $allReadings += $data
            Write-Host "    ✓ $($data.Count) records" -ForegroundColor Green
        }
    } catch {
        Write-Host "    ⚠ Skipped (error: $($_.Exception.Message))" -ForegroundColor Yellow
    }
}

if ($allReadings.Count -gt 0) {
    $readingsPath = Join-Path $OutputFolder "trendlog_readings.csv"
    $allReadings | Export-Csv -Path $readingsPath -NoTypeInformation
    Write-Host "  ✅ Exported $($allReadings.Count) total trend readings" -ForegroundColor Green
} else {
    Write-Host "  ⚠ No trend data found" -ForegroundColor Yellow
}
Write-Host ""

# Export AlarmLogs (alerts)
Write-Host "🚨 Step 3: Exporting AlarmLog data (alerts)..." -ForegroundColor Cyan
$allAlarms = @()
$tableCount = 0

foreach ($table in $alarmTables) {
    $tableName = $table.TABLE_NAME
    $tableCount++
    
    Write-Host "  Processing $tableName ($tableCount/$($alarmTables.Count))..." -ForegroundColor Gray
    
    try {
        $data = Invoke-Sqlcmd -ServerInstance $SqlServerInstance -Database $DatabaseName -TrustServerCertificate -Query @"
SELECT TOP 10000
    '$tableName' as SourceTable,
    *
FROM [dbo].[$tableName]
WHERE Timestamp >= $cutoffTimestamp
ORDER BY Timestamp DESC
"@
        
        if ($data) {
            $allAlarms += $data
            Write-Host "    ✓ $($data.Count) records" -ForegroundColor Green
        }
    } catch {
        Write-Host "    ⚠ Skipped (error: $($_.Exception.Message))" -ForegroundColor Yellow
    }
}

if ($allAlarms.Count -gt 0) {
    $alarmsPath = Join-Path $OutputFolder "alarmlog_alerts.csv"
    $allAlarms | Export-Csv -Path $alarmsPath -NoTypeInformation
    Write-Host "  ✅ Exported $($allAlarms.Count) total alarm records" -ForegroundColor Green
} else {
    Write-Host "  ⚠ No alarm data found" -ForegroundColor Yellow
}
Write-Host ""

# Export other tables
if ($otherTables.Count -gt 0) {
    Write-Host "📦 Step 4: Exporting other tables..." -ForegroundColor Cyan
    
    foreach ($table in $otherTables) {
        $tableName = $table.TABLE_NAME
        Write-Host "  Exporting $tableName..." -ForegroundColor Gray
        
        try {
            $data = Invoke-Sqlcmd -ServerInstance $SqlServerInstance -Database $DatabaseName -TrustServerCertificate -Query "SELECT TOP 10000 * FROM [dbo].[$tableName]"
            
            if ($data -and $data.Count -gt 0) {
                $filePath = Join-Path $OutputFolder "$tableName.csv"
                $data | Export-Csv -Path $filePath -NoTypeInformation
                Write-Host "    ✓ $($data.Count) rows" -ForegroundColor Green
            }
        } catch {
            Write-Host "    ⚠ Skipped" -ForegroundColor Yellow
        }
    }
    Write-Host ""
}

# Summary
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         Export Summary                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Trend Readings: $($allReadings.Count)" -ForegroundColor White
Write-Host "  Alarm Logs: $($allAlarms.Count)" -ForegroundColor White
Write-Host "  Output Folder: $OutputFolder" -ForegroundColor White
Write-Host ""
Write-Host "✅ Export complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review the exported CSV files" -ForegroundColor White
Write-Host "  2. Create device mappings based on SourceTable names" -ForegroundColor White
Write-Host "  3. Transform and import into PostgreSQL" -ForegroundColor White
Write-Host ""
Write-Host "Note: This BMS uses Loytec/BACnet format with:" -ForegroundColor Cyan
Write-Host "  - TrendLog tables for time-series data" -ForegroundColor Gray
Write-Host "  - AlarmLog tables for events/alerts" -ForegroundColor Gray
Write-Host "  - Timestamps in Unix epoch format" -ForegroundColor Gray
Write-Host ""
