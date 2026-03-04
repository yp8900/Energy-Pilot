#!/usr/bin/env pwsh
# Energy-Pilot Demo Startup Script
# This script starts the complete application ready for demonstration

# Set error handling
$ErrorActionPreference = "Stop"

# ASCII Banner
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                      ║" -ForegroundColor Cyan
Write-Host "║           🔋 ENERGY-PILOT DEMO LAUNCHER             ║" -ForegroundColor Cyan
Write-Host "║              Industrial Energy Management            ║" -ForegroundColor Cyan
Write-Host "║                                                      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Navigate to project directory
Set-Location $PSScriptRoot
Write-Host "📂 Project Directory: $PSScriptRoot" -ForegroundColor Gray
Write-Host ""

# Step 1: Check Node.js
Write-Host "🔍 Checking prerequisites..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "   ✓ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Node.js not found! Please install Node.js first." -ForegroundColor Red
    Write-Host "     Download from: https://nodejs.org" -ForegroundColor Yellow
    pause
    exit 1
}

# Step 2: Check dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host ""
    Write-Host "📦 Installing dependencies (first time setup)..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ✗ Failed to install dependencies!" -ForegroundColor Red
        pause
        exit 1
    }
    Write-Host "   ✓ Dependencies installed" -ForegroundColor Green
}

# Step 3: Check .env configuration
if (-not (Test-Path ".env")) {
    Write-Host ""
    Write-Host "📝 Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "   ✓ .env file created" -ForegroundColor Green
}

# Step 4: Verify mock mode (no database required)
Write-Host ""
Write-Host "⚙️  Configuration:" -ForegroundColor Yellow
$envContent = Get-Content ".env" -Raw
if ($envContent -match "^DATABASE_URL=") {
    Write-Host "   ℹ️  Database mode detected - using PostgreSQL" -ForegroundColor Cyan
    Write-Host "   ⚠️  If PostgreSQL is not running, application will fail!" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "   Switch to MOCK MODE (no database needed)? [Y/n]"
    if ($response -eq "" -or $response -eq "Y" -or $response -eq "y") {
        $envContent = $envContent -replace "^DATABASE_URL=", "# DATABASE_URL="
        $envContent | Set-Content ".env"
        Write-Host "   ✓ Switched to MOCK MODE with demo data" -ForegroundColor Green
    }
} else {
    Write-Host "   ✓ Mock mode enabled (5 demo meters included)" -ForegroundColor Green
}

# Step 5: Display demo information
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                  DEMO INFORMATION                    ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Demo Meters:" -ForegroundColor Cyan
Write-Host "   • EM-MAIN-INCOMER       (550 kW)" -ForegroundColor White
Write-Host "   • EM-HVAC-SYSTEM        (200 kW)" -ForegroundColor White
Write-Host "   • EM-LIGHTING-CIRCUIT    (70 kW)" -ForegroundColor White
Write-Host "   • EM-DATA-CENTER        (195 kW)" -ForegroundColor White
Write-Host "   • EM-PRODUCTION-LINE    (365 kW)" -ForegroundColor White
Write-Host ""
Write-Host "🔐 Login Credentials:" -ForegroundColor Cyan
Write-Host "   Admin:    admin / admin123" -ForegroundColor White
Write-Host "   Operator: operator / operator123" -ForegroundColor White
Write-Host ""
Write-Host "📚 Demo Documentation:" -ForegroundColor Cyan
Write-Host "   • DEMO-SUMMARY.md - Complete feature list" -ForegroundColor White
Write-Host "   • DEMO-CHEAT-SHEET.md - Quick reference" -ForegroundColor White
Write-Host "   • DEMO-PRESENTATION-OUTLINE.md - Slide deck guide" -ForegroundColor White
Write-Host ""

# Step 6: Start the application
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Yellow
Write-Host "║              STARTING APPLICATION...                 ║" -ForegroundColor Yellow
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Yellow
Write-Host ""
Write-Host "🚀 Launching full-stack application..." -ForegroundColor Yellow
Write-Host "   Backend:  http://localhost:5000/api" -ForegroundColor Gray
Write-Host "   Frontend: http://localhost:5000" -ForegroundColor Gray
Write-Host ""
Write-Host "⏳ Please wait for the server to start..." -ForegroundColor Gray
Write-Host "   (This may take 10-15 seconds)" -ForegroundColor Gray
Write-Host ""
Write-Host "───────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# Start the application
npm run dev

# This will only execute if npm run dev exits
Write-Host ""
Write-Host "👋 Application stopped." -ForegroundColor Yellow
Write-Host ""
