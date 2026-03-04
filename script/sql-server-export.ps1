# SQL Server Data Export Script
# This script helps export meter data from a SQL Server .bak file

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    
    [Parameter(Mandatory=$false)]
    [string]$SqlServerInstance = "localhost",
    
    [Parameter(Mandatory=$false)]
    [string]$DatabaseName = "EnergyMeterData",
    
    [Parameter(Mandatory=$false)]
    [string]$OutputFolder = ".\exported-data"
)

Write-Host "=== SQL Server Data Export Tool ===" -ForegroundColor Cyan
Write-Host ""

# Check if backup file exists
if (-not (Test-Path $BackupFile)) {
    Write-Host "Error: Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

# Create output folder
if (-not (Test-Path $OutputFolder)) {
    New-Item -ItemType Directory -Path $OutputFolder | Out-Null
    Write-Host "Created output folder: $OutputFolder" -ForegroundColor Green
}

Write-Host "Step 1: Restore Database from Backup" -ForegroundColor Yellow
Write-Host "---------------------------------------"
Write-Host "Backup File: $BackupFile"
Write-Host "Instance: $SqlServerInstance"
Write-Host "Database: $DatabaseName"
Write-Host ""

# SQL to restore database
$restoreSQL = @"
USE master;
GO

-- Drop if exists
IF EXISTS (SELECT name FROM sys.databases WHERE name = N'$DatabaseName')
BEGIN
    ALTER DATABASE [$DatabaseName] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [$DatabaseName];
END
GO

-- Restore from backup
RESTORE DATABASE [$DatabaseName]
FROM DISK = N'$BackupFile'
WITH REPLACE,
     MOVE '$DatabaseName' TO 'C:\SQLData\$DatabaseName.mdf',
     MOVE '$DatabaseName_log' TO 'C:\SQLData\$DatabaseName_log.ldf';
GO
"@

Write-Host "To restore the database, run this SQL in SQL Server Management Studio:" -ForegroundColor Cyan
Write-Host $restoreSQL -ForegroundColor Gray
Write-Host ""

# Export tables to CSV
Write-Host "Step 2: Export Data to CSV" -ForegroundColor Yellow
Write-Host "---------------------------------------"
Write-Host ""

$exportSQL = @"
-- Export Devices
SELECT * FROM [$DatabaseName].dbo.Devices;

-- Export Meter Readings (last 15 days)
SELECT * FROM [$DatabaseName].dbo.MeterReadings
WHERE Timestamp >= DATEADD(day, -15, GETDATE())
ORDER BY Timestamp;

-- Export Alerts (last 15 days)
SELECT * FROM [$DatabaseName].dbo.Alerts
WHERE Timestamp >= DATEADD(day, -15, GETDATE())
ORDER BY Timestamp;
"@

Write-Host "Use BCP or SQLCMD to export data:" -ForegroundColor Cyan
Write-Host ""

# BCP Export commands
$bcpCommands = @"
# Export Devices
bcp "SELECT * FROM [$DatabaseName].dbo.Devices" queryout "$OutputFolder\devices.csv" -S $SqlServerInstance -T -c -t"," -r"\n"

# Export Readings (last 15 days)
bcp "SELECT * FROM [$DatabaseName].dbo.MeterReadings WHERE Timestamp >= DATEADD(day, -15, GETDATE()) ORDER BY Timestamp" queryout "$OutputFolder\readings.csv" -S $SqlServerInstance -T -c -t"," -r"\n"

# Export Alerts (last 15 days)
bcp "SELECT * FROM [$DatabaseName].dbo.Alerts WHERE Timestamp >= DATEADD(day, -15, GETDATE()) ORDER BY Timestamp" queryout "$OutputFolder\alerts.csv" -S $SqlServerInstance -T -c -t"," -r"\n"
"@

Write-Host $bcpCommands -ForegroundColor Gray
Write-Host ""

# Alternative: PowerShell export
Write-Host "Or use this PowerShell script to export:" -ForegroundColor Cyan
$outputPath = Join-Path $OutputFolder "export-with-powershell.ps1"

$psExportScript = @"
# PowerShell SQL Server Export Script
`$SqlServerInstance = "$SqlServerInstance"
`$DatabaseName = "$DatabaseName"
`$OutputFolder = "$OutputFolder"

# Import SQL Server module
Import-Module SqlServer -ErrorAction SilentlyContinue

# Export Devices
`$devicesQuery = "SELECT * FROM [$DatabaseName].dbo.Devices"
`$devices = Invoke-Sqlcmd -ServerInstance `$SqlServerInstance -Query `$devicesQuery
`$devices | Export-Csv -Path "`$OutputFolder\devices.csv" -NoTypeInformation

# Export Readings (last 15 days)
`$readingsQuery = "SELECT * FROM [$DatabaseName].dbo.MeterReadings WHERE Timestamp >= DATEADD(day, -15, GETDATE()) ORDER BY Timestamp"
`$readings = Invoke-Sqlcmd -ServerInstance `$SqlServerInstance -Query `$readingsQuery
`$readings | Export-Csv -Path "`$OutputFolder\readings.csv" -NoTypeInformation

# Export Alerts (last 15 days)
`$alertsQuery = "SELECT * FROM [$DatabaseName].dbo.Alerts WHERE Timestamp >= DATEADD(day, -15, GETDATE()) ORDER BY Timestamp"
`$alerts = Invoke-Sqlcmd -ServerInstance `$SqlServerInstance -Query `$alertsQuery
`$alerts | Export-Csv -Path "`$OutputFolder\alerts.csv" -NoTypeInformation

Write-Host "Export completed successfully!" -ForegroundColor Green
"@

$psExportScript | Out-File -FilePath $outputPath -Encoding UTF8
Write-Host "PowerShell export script created: $outputPath" -ForegroundColor Green
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Restore the .bak file using SQL Server Management Studio or the SQL above"
Write-Host "2. Run the export script to generate CSV files"
Write-Host "3. Use the import-meter-data.ts script to import into PostgreSQL"
Write-Host ""
