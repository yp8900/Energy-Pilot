# Analyze BMS Database and Create Export Script
# PowerShell version - reliable for Windows Authentication

param(
    [Parameter(Mandatory=$false)]
    [string]$SqlServerInstance = "localhost\SQLEXPRESS",
    
    [Parameter(Mandatory=$false)]
    [string]$DatabaseName = "METRO_BHAWAN",
    
    [Parameter(Mandatory=$false)]
    [string]$OutputFolder = ".\exported-data"
)

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  BMS Database Schema Analyzer          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Import-Module SqlServer -ErrorAction Stop

Write-Host "🔍 Analyzing Database..." -ForegroundColor Yellow
Write-Host "  Instance: $SqlServerInstance" -ForegroundColor Gray
Write-Host "  Database: $DatabaseName" -ForegroundColor Gray
Write-Host ""

# Get all tables
Write-Host "📋 Discovering tables..." -ForegroundColor Cyan

$tables = Invoke-Sqlcmd -ServerInstance $SqlServerInstance -Database $DatabaseName -TrustServerCertificate -Query @"
SELECT 
    t.TABLE_SCHEMA,
    t.TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES t
WHERE t.TABLE_TYPE = 'BASE TABLE'
ORDER BY t.TABLE_NAME
"@

Write-Host "  Found $($tables.Count) tables" -ForegroundColor Green
Write-Host ""

# Analyze each table
$tableInfo = @()
$totalRows = 0

Write-Host "🔍 Analyzing table structures..." -ForegroundColor Cyan
Write-Host ""

foreach ($table in $tables) {
    $schema = $table.TABLE_SCHEMA
    $tableName = $table.TABLE_NAME
    $fullTableName = "[$schema].[$tableName]"
    
    # Get row count
    try {
        $countResult = Invoke-Sqlcmd -ServerInstance $SqlServerInstance -Database $DatabaseName -TrustServerCertificate -Query "SELECT COUNT_BIG(*) as [Count] FROM $fullTableName"
        $rowCount = $countResult.Count
    } catch {
        $rowCount = 0
    }
    
    # Get columns
    $columns = Invoke-Sqlcmd -ServerInstance $SqlServerInstance -Database $DatabaseName -TrustServerCertificate -Query @"
SELECT 
    c.COLUMN_NAME,
    c.DATA_TYPE,
    c.CHARACTER_MAXIMUM_LENGTH,
    c.IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS c
WHERE c.TABLE_SCHEMA = '$schema'
  AND c.TABLE_NAME = '$tableName'
ORDER BY c.ORDINAL_POSITION
"@
    
    $tableInfo += [PSCustomObject]@{
        Schema = $schema
        TableName = $tableName
        RowCount = $rowCount
        Columns = $columns
    }
    
    $totalRows += $rowCount
    
    # Display progress
   $rowDisplay = if ($rowCount -gt 0) { $rowCount.ToString("N0") } else { "0" }
    Write-Host "  ✓ $tableName" -ForegroundColor White -NoNewline
    Write-Host " ($rowDisplay rows)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Analysis complete!" -ForegroundColor Green
Write-Host ""

# Display interesting tables
Write-Host "📊 Key Tables Identified:" -ForegroundColor Cyan
Write-Host ""

# Categorize tables
$trendLogTables = $tableInfo | Where-Object { $_.TableName -like "TrendLog*" }
$otherTables = $tableInfo | Where-Object { $_.TableName -notlike "TrendLog*" }

Write-Host "  BMS Trend Logs ($($trendLogTables.Count) tables):" -ForegroundColor Yellow
foreach ($t in ($trendLogTables | Select-Object -First 5)) {
    Write-Host "    - $($t.TableName) ($($t.RowCount.ToString('N0')) rows)" -ForegroundColor Gray
}
if ($trendLogTables.Count > 5) {
    Write-Host "    ... and $($trendLogTables.Count - 5) more trend log tables" -ForegroundColor DarkGray
}
Write-Host ""

Write-Host "  Other Tables:" -ForegroundColor Yellow
foreach ($t in $otherTables) {
    $rowDisplay = $t.RowCount.ToString("N0")
    Write-Host "    - $($t.TableName) ($rowDisplay rows)" -ForegroundColor Gray
    
    # Show first few columns for context
    $colPreview = ($t.Columns | Select-Object -First 5 | ForEach-Object { $_.COLUMN_NAME }) -join ", "
    Write-Host "      Columns: $colPreview..." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 Summary:" -ForegroundColor Yellow
Write-Host "  Total Tables: $($tables.Count)" -ForegroundColor White
Write-Host "  Total Rows: $($totalRows.ToString('N0'))" -ForegroundColor White
Write-Host "  Trend Log Tables: $($trendLogTables.Count)" -ForegroundColor White
Write-Host ""

# Generate custom export script
Write-Host "📝 Generating custom export script..." -ForegroundColor Cyan

$exportScript = @"
# BMS Data Export Script - METRO_BHAWAN
# Auto-generated on $(Get-Date -Format "yyyy-MM-dd HH:mm")

param(
    [Parameter(Mandatory=`$false)]
    [string]`$OutputFolder = ".\exported-data",
    
    [Parameter(Mandatory=`$false)]
    [int]`$DaysOfHistory = 15,
    
    [Parameter(Mandatory=`$false)]
    [int]`$MaxTrendLogs = 10  # Limit trend logs to export (there are $($trendLogTables.Count) total)
)

`$SqlServerInstance = "$SqlServerInstance"
`$DatabaseName = "$DatabaseName"

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   METRO_BHAWAN BMS Data Export         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Import-Module SqlServer -ErrorAction Stop

if (-not (Test-Path `$OutputFolder)) {
    New-Item -ItemType Directory -Path `$OutputFolder | Out-Null
}

Write-Host "📊 Export Configuration:" -ForegroundColor Yellow
Write-Host "  Database: `$DatabaseName" -ForegroundColor Gray
Write-Host "  Instance: `$SqlServerInstance" -ForegroundColor Gray
Write-Host "  Output: `$OutputFolder" -ForegroundColor Gray
Write-Host "  History: Last `$DaysOfHistory days" -ForegroundColor Gray
Write-Host ""

"@

# Add exports for non-trend tables
foreach ($t in $otherTables | Where-Object { $_.RowCount -gt 0 }) {
    $tableName = $t.TableName
    $schema = $t.Schema
    $fullName = "[$schema].[$tableName]"
    
    # Check if table has timestamp column
    $timestampCol = $t.Columns | Where-Object { $_.DATA_TYPE -in @('datetime', 'datetime2', 'timestamp', 'bigint') -and $_.COLUMN_NAME -match 'time|date' } | Select-Object -First 1
    
    $exportScript += @"
# Export $tableName
Write-Host "📤 Exporting $tableName..." -ForegroundColor Cyan
`$query = "SELECT * FROM $fullName"
"@
    
    if ($timestampCol) {
        $colName = $timestampCol.COLUMN_NAME
        if ($timestampCol.DATA_TYPE -eq 'bigint') {
            # Unix timestamp or similar
            $exportScript += " WHERE [$colName] >= $(([DateTimeOffset]::Now.AddDays(-15).ToUnixTimeSeconds()))"
        } elseif ($timestampCol.DATA_TYPE -like 'datetime*') {
            $exportScript += " WHERE [$colName] >= DATEADD(day, -`$DaysOfHistory, GETDATE())"
        }
    }
    
    $exportScript += @"

`$data = Invoke-Sqlcmd -ServerInstance `$SqlServerInstance -Database `$DatabaseName -TrustServerCertificate -Query `$query
`$data | Export-Csv -Path "`$OutputFolder\$tableName.csv" -NoTypeInformation
Write-Host "  ✓ Exported `$(`$data.Count) rows" -ForegroundColor Green
Write-Host ""

"@
}

# Add selective trend log export
$exportScript += @"
# Export Trend Logs (limited to `$MaxTrendLogs most recent)
Write-Host "📊 Exporting Trend Logs (up to `$MaxTrendLogs tables)..." -ForegroundColor Cyan

`$trendLogTables = @(
"@

foreach ($t in ($trendLogTables | Select-Object -First 50)) {
    $exportScript += "    '$($t.TableName)'`n"
}

$exportScript += @"
)

`$exported = 0
foreach (`$trendTable in (`$trendLogTables | Select-Object -First `$MaxTrendLogs)) {
    Write-Host "  📤 `$trendTable..." -ForegroundColor Gray
    
    `$query = "SELECT TOP 10000 * FROM [dbo].[`$trendTable] ORDER BY LogId DESC"
    `$data = Invoke-Sqlcmd -ServerInstance `$SqlServerInstance -Database `$DatabaseName -TrustServerCertificate -Query `$query
    
    if (`$data.Count -gt 0) {
        `$data | Export-Csv -Path "`$OutputFolder\`$trendTable.csv" -NoTypeInformation
        Write-Host "    ✓ `$(`$data.Count) rows" -ForegroundColor Green
        `$exported++
    }
}

Write-Host ""
Write-Host "✅ Export complete!" -ForegroundColor Green
Write-Host "  Tables exported: `$exported trend logs + other tables" -ForegroundColor Gray
Write-Host ""
Write-Host "📁 Files saved to: `$OutputFolder" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next step: Import into PostgreSQL" -ForegroundColor Yellow
Write-Host "  npm run import-data -- --source `$OutputFolder --clear" -ForegroundColor Gray
Write-Host ""
"@

# Save export script
if (-not (Test-Path $OutputFolder)) {
    New-Item -ItemType Directory -Path $OutputFolder | Out-Null
}

$exportScriptPath = Join-Path $OutputFolder "export-metro-bhawan.ps1"
$exportScript | Out-File -FilePath $exportScriptPath -Encoding UTF8

Write-Host "✅ Created export script: $exportScriptPath" -ForegroundColor Green
Write-Host ""

# Save analysis report
$reportPath = Join-Path $OutputFolder "schema-analysis.json"
$tableInfo | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host "✅ Created analysis report: $reportPath" -ForegroundColor Green
Write-Host ""

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         Next Steps                     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Review the analysis report to understand your BMS data" -ForegroundColor White
Write-Host "2. Run the export script:" -ForegroundColor White
Write-Host "   .\exported-data\export-metro-bhawan.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Import into your EMS application:" -ForegroundColor White
Write-Host "   npm run import-data -- --source .\exported-data --clear" -ForegroundColor Gray
Write-Host ""
