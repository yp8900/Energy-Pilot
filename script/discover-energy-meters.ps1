# Discover Energy Meters from METRO_BHAWAN BMS
# Analyzes LogItemInfo to find energy meters and their parameters

param(
    [string]$SourceFolder = ".\exported-data"
)

Write-Host "🔍 Energy Meter Discovery Tool" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

$logItemInfoPath = Join-Path $SourceFolder "LogItemInfo.csv"

if (-not (Test-Path $logItemInfoPath)) {
    Write-Host "❌ LogItemInfo.csv not found in $SourceFolder" -ForegroundColor Red
    exit 1
}

# Import CSV
Write-Host "📂 Loading LogItemInfo.csv..." -ForegroundColor Yellow
$logItems = Import-Csv $logItemInfoPath -Header "LogId","ItemId","ItemIndex","AbsolutePath","Unit","Unknown1","Unknown2"

# Find all energy meter related items (EM_* parameters)
Write-Host "🔎 Discovering energy meters..." -ForegroundColor Yellow
$energyMeterItems = $logItems | Where-Object { 
    $_.AbsolutePath -match "/EM/" -or 
    $_.AbsolutePath -match "EM_CURRENT|EM_VOLTAGE|EM_POWER|EM_ENERGY|EM_FREQUENCY|EM_PF"
}

Write-Host "✅ Found $($energyMeterItems.Count) energy meter parameters`n" -ForegroundColor Green

# Group by device to discover meter hierarchy
$metersByDevice = @{}

foreach ($item in $energyMeterItems) {
    $path = $item.AbsolutePath
    
    # Extract device name from path
    if ($path -match "Devices/([^/]+)/") {
        $deviceName = $matches[1]
    } elseif ($path -match "PGM1/([^/]+)/EM_") {
        $deviceName = $matches[1]
    } else {
        $deviceName = "Unknown"
    }
    
    # Extract parameter name
    if ($path -match "(EM_[A-Z_]+)") {
        $parameter = $matches[1]
    } else {
        continue
    }
    
    if (-not $metersByDevice.ContainsKey($deviceName)) {
        $metersByDevice[$deviceName] = @{
            Name = $deviceName
            Parameters = @{}
            LogIds = @()
        }
    }
    
    if (-not $metersByDevice[$deviceName].Parameters.ContainsKey($parameter)) {
        $metersByDevice[$deviceName].Parameters[$parameter] = @()
    }
    
    $metersByDevice[$deviceName].Parameters[$parameter] += @{
        LogId = $item.LogId
        Path = $path
        Unit = $item.Unit
    }
    
    if ($metersByDevice[$deviceName].LogIds -notcontains $item.LogId) {
        $metersByDevice[$deviceName].LogIds += $item.LogId
    }
}

# Display discovered meters
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Discovered Energy Meters & Parameters            ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$meterCount = 0
foreach ($meterName in ($metersByDevice.Keys | Sort-Object)) {
    $meter = $metersByDevice[$meterName]
    $meterCount++
    
    Write-Host "📊 Meter $meterCount`: $meterName" -ForegroundColor Green
    Write-Host "   Parameters:" -ForegroundColor Yellow
    
    foreach ($param in ($meter.Parameters.Keys | Sort-Object)) {
        $count = $meter.Parameters[$param].Count
        Write-Host "   • $param ($count instance(s))" -ForegroundColor White
    }
    
    Write-Host "   LogIds: $($meter.LogIds -join ', ')" -ForegroundColor Gray
    Write-Host ""
}

# Export discovered meters to JSON for import script
$discoveryOutput = @{
    DiscoveredAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    TotalMeters = $metersByDevice.Count
    TotalParameters = $energyMeterItems.Count
    Meters = @()
}

foreach ($meterName in ($metersByDevice.Keys | Sort-Object)) {
    $meter = $metersByDevice[$meterName]
    $discoveryOutput.Meters += @{
        Name = $meterName
        Type = "EnergyMeter"
        LogIds = $meter.LogIds
        Parameters = @($meter.Parameters.Keys)
        ParameterDetails = $meter.Parameters
    }
}

$outputPath = Join-Path $SourceFolder "discovered-energy-meters.json"
$discoveryOutput | ConvertTo-Json -Depth 10 | Out-File $outputPath -Encoding UTF8

Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║              Discovery Summary                        ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "  Total Energy Meters: $($metersByDevice.Count)" -ForegroundColor Green
Write-Host "  Total Parameters: $($energyMeterItems.Count)" -ForegroundColor Green
Write-Host "  Output: $outputPath" -ForegroundColor Yellow
Write-Host "`n✅ Discovery complete!`n" -ForegroundColor Green
