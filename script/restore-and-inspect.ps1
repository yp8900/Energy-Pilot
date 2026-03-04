# Restore and Inspect SQL Server Database
# This script helps restore the .bak file and inspect its structure

param(
    [Parameter(Mandatory=$false)]
    [string]$BackupFile = "E:\Applications\METRO_BHAWAN.bak",
    
    [Parameter(Mandatory=$false)]
    [string]$SqlServerInstance = "localhost",
    
    [Parameter(Mandatory=$false)]
    [string]$DatabaseName = "METRO_BHAWAN"
)

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  SQL Server Restore & Inspect Tool    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if SQL Server module is available
Write-Host "Checking for SqlServer PowerShell module..." -ForegroundColor Yellow
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "❌ SqlServer module not found. Installing..." -ForegroundColor Red
    Write-Host "This may take a few minutes..." -ForegroundColor Gray
    try {
        Install-Module -Name SqlServer -Scope CurrentUser -Force -AllowClobber
        Write-Host "✅ SqlServer module installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to install SqlServer module: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install manually:" -ForegroundColor Yellow
        Write-Host "  Install-Module -Name SqlServer -Scope CurrentUser" -ForegroundColor Gray
        exit 1
    }
}

Import-Module SqlServer -ErrorAction Stop
Write-Host "✅ SqlServer module loaded" -ForegroundColor Green
Write-Host ""

# Check if backup file exists
if (-not (Test-Path $BackupFile)) {
    Write-Host "❌ Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Backup File Information:" -ForegroundColor Cyan
$fileInfo = Get-Item $BackupFile
Write-Host "  Path: $($fileInfo.FullName)" -ForegroundColor Gray
Write-Host "  Size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Gray
Write-Host "  Modified: $($fileInfo.LastWriteTime)" -ForegroundColor Gray
Write-Host ""

# Read backup file header
Write-Host "🔍 Reading backup file information..." -ForegroundColor Yellow
try {
    $backupInfo = Invoke-Sqlcmd -ServerInstance $SqlServerInstance -TrustServerCertificate -Query @"
RESTORE FILELISTONLY 
FROM DISK = N'$BackupFile'
"@
    
    Write-Host "✅ Backup file is valid" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Files in backup:" -ForegroundColor Cyan
    foreach ($file in $backupInfo) {
        Write-Host "  - $($file.LogicalName) -> $($file.PhysicalName)" -ForegroundColor Gray
    }
    Write-Host ""
} catch {
    Write-Host "❌ Failed to read backup file: $_" -ForegroundColor Red
    Write-Host "Make sure SQL Server is running and accessible" -ForegroundColor Yellow
    exit 1
}

# Prepare restore paths - detect the correct path for the instance
$dataPath = ""

# Try to detect SQL Server data path based on instance
if ($SqlServerInstance -like "*SQLEXPRESS*") {
    # SQL Server Express paths (try different versions)
    $possiblePaths = @(
        "C:\Program Files\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQL\DATA",  # SQL 2025
        "C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\DATA",  # SQL 2022
        "C:\Program Files\Microsoft SQL Server\MSSQL15.SQLEXPRESS\MSSQL\DATA"   # SQL 2019
    )
} else {
    # SQL Server Standard paths
    $possiblePaths = @(
        "C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER\MSSQL\DATA",
        "C:\Program Files\Microsoft SQL Server\MSSQL15.MSSQLSERVER\MSSQL\DATA"
    )
}

# Find first existing path
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $dataPath = $path
        break
    }
}

# Fallback to temp location if none found
if (-not $dataPath) {
    $dataPath = "C:\SQLData"
    if (-not (Test-Path $dataPath)) {
        New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
    }
}

Write-Host "📁 Database files will be restored to: $dataPath" -ForegroundColor Cyan
Write-Host ""

# Build RESTORE command
$logicalDataFile = $backupInfo[0].LogicalName
$logicalLogFile = if ($backupInfo.Count -gt 1) { $backupInfo[1].LogicalName } else { "${DatabaseName}_log" }

$restoreQuery = @"
USE master;

-- Set database to single user if exists
IF EXISTS (SELECT name FROM sys.databases WHERE name = N'$DatabaseName')
BEGIN
    ALTER DATABASE [$DatabaseName] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [$DatabaseName];
END

-- Restore database
RESTORE DATABASE [$DatabaseName]
FROM DISK = N'$BackupFile'
WITH 
    MOVE '$logicalDataFile' TO '$dataPath\${DatabaseName}.mdf',
    MOVE '$logicalLogFile' TO '$dataPath\${DatabaseName}_log.ldf',
    REPLACE,
    RECOVERY,
    STATS = 10;
    
-- Set to multi-user
ALTER DATABASE [$DatabaseName] SET MULTI_USER;
"@

Write-Host "🔄 Restoring database..." -ForegroundColor Yellow
Write-Host "This may take several minutes for a large backup..." -ForegroundColor Gray
Write-Host ""

try {
    Invoke-Sqlcmd -ServerInstance $SqlServerInstance -TrustServerCertificate -Query $restoreQuery -QueryTimeout 600
    Write-Host "✅ Database restored successfully!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Failed to restore database: $_" -ForegroundColor Red
    exit 1
}

# Inspect database structure
Write-Host "🔍 Inspecting database structure..." -ForegroundColor Yellow
Write-Host ""

# Get all tables
$tablesQuery = @"
SELECT 
    t.TABLE_SCHEMA,
    t.TABLE_NAME,
    (SELECT COUNT(*) FROM [$DatabaseName].[' + t.TABLE_SCHEMA + '].[' + t.TABLE_NAME + ']) as RowCount
FROM [$DatabaseName].INFORMATION_SCHEMA.TABLES t
WHERE t.TABLE_TYPE = 'BASE TABLE'
ORDER BY t.TABLE_NAME
"@

try {
    $tables = Invoke-Sqlcmd -ServerInstance $SqlServerInstance -Database $DatabaseName -TrustServerCertificate -Query @"
SELECT 
    TABLE_SCHEMA,
    TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME
"@

    Write-Host "📊 Tables found in database:" -ForegroundColor Cyan
    Write-Host ""
    
    foreach ($table in $tables) {
        $fullTableName = "[$($table.TABLE_SCHEMA)].[$($table.TABLE_NAME)]"
        
        # Get row count
        $countQuery = "SELECT COUNT(*) as RowCount FROM $fullTableName"
        $count = (Invoke-Sqlcmd -ServerInstance $SqlServerInstance -Database $DatabaseName -TrustServerCertificate -Query $countQuery).RowCount
        
        Write-Host "  📋 $($table.TABLE_NAME)" -ForegroundColor White
        Write-Host "     Schema: $($table.TABLE_SCHEMA) | Rows: $count" -ForegroundColor Gray
        
        # Get columns
        $columnsQuery = @"
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = '$($table.TABLE_SCHEMA)' 
  AND TABLE_NAME = '$($table.TABLE_NAME)'
ORDER BY ORDINAL_POSITION
"@
        $columns = Invoke-Sqlcmd -ServerInstance $SqlServerInstance -Database $DatabaseName -TrustServerCertificate -Query $columnsQuery
        
        Write-Host "     Columns:" -ForegroundColor Gray
        foreach ($col in $columns) {
            $colInfo = "       - $($col.COLUMN_NAME) ($($col.DATA_TYPE)"
            if ($col.CHARACTER_MAXIMUM_LENGTH) {
                $colInfo += "($($col.CHARACTER_MAXIMUM_LENGTH))"
            }
            $colInfo += ")"
            if ($col.IS_NULLABLE -eq 'YES') {
                $colInfo += " NULL"
            }
            Write-Host $colInfo -ForegroundColor DarkGray
        }
        Write-Host ""
    }
    
} catch {
    Write-Host "❌ Failed to inspect database: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Review the table structure above" -ForegroundColor White
Write-Host "2. Run the export script to extract data" -ForegroundColor White
Write-Host "3. Import into PostgreSQL" -ForegroundColor White
Write-Host ""
Write-Host "To export data, run:" -ForegroundColor Cyan
Write-Host "  .\exported-data\export-with-powershell.ps1" -ForegroundColor Gray
Write-Host ""
