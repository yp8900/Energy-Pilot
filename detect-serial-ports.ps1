# Detect Serial COM Ports
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "     Serial Port Detection Tool" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Available COM Ports:" -ForegroundColor Yellow
Write-Host ""

$ports = [System.IO.Ports.SerialPort]::getportnames()

if ($ports.Count -eq 0) {
    Write-Host "  No COM ports detected!" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Possible reasons:" -ForegroundColor Yellow
    Write-Host "    - No USB-to-Serial adapter plugged in"
    Write-Host "    - Driver not installed" 
    Write-Host "    - Device not recognized by Windows"
    Write-Host ""
} else {
    foreach ($port in $ports) {
        Write-Host "  $port - AVAILABLE" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "Total ports found: $($ports.Count)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Usage Instructions:" -ForegroundColor Yellow
Write-Host "  1. Note the COM port number above"
Write-Host "  2. Open http://localhost:5000/modbus-scanner"
Write-Host "  3. Select Direct Serial connection type"
Write-Host "  4. Enter your COM port number"
Write-Host "  5. Configure serial parameters"
Write-Host "  6. Click Connect to Modbus"
Write-Host ""
