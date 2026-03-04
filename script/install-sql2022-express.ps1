# Install SQL Server 2022 Express
# Quick setup script to install SQL Server 2022 Express for restoring the backup

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  SQL Server 2022 Express Installer    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "This will download and install SQL Server 2022 Express Edition (free)" -ForegroundColor Yellow
Write-Host "Required to restore your SQL Server 2022 backup file" -ForegroundColor Yellow
Write-Host ""

$downloadUrl = "https://go.microsoft.com/fwlink/p/?linkid=2216019&clcid=0x409&culture=en-us&country=us"
$installer = "$env:TEMP\SQL2022-SSEI-Expr.exe"

Write-Host "📥 Downloading SQL Server 2022 Express..." -ForegroundColor Cyan
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installer -UseBasicParsing
    Write-Host "✅ Download complete" -ForegroundColor Green
} catch {
    Write-Host "❌ Download failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please download manually from:" -ForegroundColor Yellow
    Write-Host "https://www.microsoft.com/en-us/sql-server/sql-server-downloads" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "🚀 Launching installer..." -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: When the installer starts:" -ForegroundColor Yellow
Write-Host "  1. Choose 'Basic' installation" -ForegroundColor White
Write-Host "  2. Accept the license terms" -ForegroundColor White
Write-Host "  3. Click 'Install'" -ForegroundColor White  
Write-Host "  4. Wait for installation to complete (5-10 minutes)" -ForegroundColor White
Write-Host "  5. Note the instance name (usually SQLEXPRESS)" -ForegroundColor White
Write-Host ""

Start-Process -FilePath $installer -Wait

Write-Host ""
Write-Host "✅ Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: Run the restore script again:" -ForegroundColor Cyan
Write-Host "  .\script\restore-and-inspect.ps1 -SqlServerInstance 'localhost\SQLEXPRESS'" -ForegroundColor Gray
Write-Host ""
