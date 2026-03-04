@echo off
REM Energy-Pilot Demo Launcher for Windows CMD

echo.
echo ========================================
echo   Energy-Pilot Demo Launcher
echo ========================================
echo.

cd /d "%~dp0"

REM Check if PowerShell is available (it should be on all modern Windows)
where pwsh >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting with PowerShell Core...
    pwsh -ExecutionPolicy Bypass -File "%~dp0start-demo.ps1"
) else (
    where powershell >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo Starting with Windows PowerShell...
        powershell -ExecutionPolicy Bypass -File "%~dp0start-demo.ps1"
    ) else (
        echo PowerShell not found! Using npm directly...
        npm run dev
    )
)

pause
