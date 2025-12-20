# ========================================
# XingCan Cloud Matrix Build Script
# Version: 2.1.0
# ========================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("release", "debug")]
    [string]$Config = "release",

    [Parameter(Mandatory=$false)]
    [switch]$Deploy = $false,

    [Parameter(Mandatory=$false)]
    [switch]$SkipDownload = $false
)

$ErrorActionPreference = "Continue"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Join-Path (Split-Path -Parent $ScriptRoot) "TcUi"
$ScrcpyVersion = "3.3.3"

# Helper functions
function Write-ColorText {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

function Show-Menu {
    Clear-Host
    Write-Host ""
    Write-ColorText "========================================" "Cyan"
    Write-ColorText " XingCan Cloud Matrix Build System" "Cyan"
    Write-ColorText " Version 2.1.0" "Cyan"
    Write-ColorText "========================================" "Cyan"
    Write-Host ""

    Write-ColorText "  Quick Start:" "Yellow"
    Write-ColorText "    1. Build Application (Release)" "Green"
    Write-ColorText "    2. Build Application (Debug)" "Green"
    Write-ColorText "    3. Build + Deploy" "Green"
    Write-Host ""

    Write-ColorText "  Manual Steps:" "Yellow"
    Write-ColorText "    4. Download scrcpy-server Only" "White"
    Write-ColorText "    5. Compile Translation Files Only" "White"
    Write-ColorText "    6. Deploy Only" "White"
    Write-Host ""

    Write-ColorText "  Utilities:" "Yellow"
    Write-ColorText "    7. Check Dependencies" "White"
    Write-ColorText "    8. Clean Build Files" "White"
    Write-ColorText "    9. System Information" "White"
    Write-Host ""

    Write-ColorText "    0. Exit" "Red"
    Write-Host ""
    Write-Host "========================================"
    Write-Host ""
}

# Download scrcpy-server (silent mode for auto-build)
function Download-Scrcpy-Silent {
    $targetFile = Join-Path $ProjectRoot "third_party\scrcpy-server\scrcpy-server-v$ScrcpyVersion"

    if (Test-Path $targetFile) {
        Write-ColorText "[OK] scrcpy-server already downloaded" "Green"
        return $true
    }

    Write-ColorText "[>] Downloading scrcpy-server v$ScrcpyVersion..." "Cyan"

    # Use existing batch script
    $downloadScript = Join-Path $ScriptRoot "download-scrcpy-server.bat"

    if (Test-Path $downloadScript) {
        Push-Location $ScriptRoot
        try {
            # Run batch script with echo Y to auto-confirm
            echo Y | cmd /c "download-scrcpy-server.bat"

            if (Test-Path $targetFile) {
                Write-ColorText "[OK] Download complete!" "Green"
                return $true
            }
            else {
                Write-ColorText "[X] Download failed" "Red"
                return $false
            }
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-ColorText "[X] Download script not found: $downloadScript" "Red"
        return $false
    }
}

# Option 4: Download scrcpy-server (manual)
function Download-Scrcpy {
    Write-ColorText "Downloading scrcpy-server..." "Cyan"

    $downloadScript = Join-Path $ScriptRoot "download-scrcpy-server.bat"

    if (Test-Path $downloadScript) {
        Push-Location $ScriptRoot
        try {
            & cmd /c "download-scrcpy-server.bat"
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-ColorText "Download script not found: $downloadScript" "Red"
    }

    Read-Host "Press Enter to continue"
}

# Option 2: Compile translations
function Compile-Translations {
    Write-ColorText "Compiling translations..." "Cyan"

    Push-Location $ProjectRoot
    try {
        lrelease 17_TcUi.pro
        Write-ColorText "Compilation complete!" "Green"
    }
    catch {
        Write-ColorText "Compilation failed" "Red"
    }
    finally {
        Pop-Location
    }

    Read-Host "Press Enter to continue"
}

# Option 1/2: Build application (auto-download + auto-open)
function Build-App {
    param([string]$BuildConfig)

    Write-Host ""
    Write-ColorText "========================================" "Green"
    Write-ColorText " Building Application ($BuildConfig)" "Green"
    Write-ColorText "========================================" "Green"
    Write-Host ""

    # Step 1: Auto-download scrcpy-server if missing
    Write-ColorText "[1/3] Checking scrcpy-server..." "Cyan"
    Download-Scrcpy-Silent

    # Step 2: Auto-compile translations
    Write-Host ""
    Write-ColorText "[2/3] Compiling translations..." "Cyan"
    Push-Location $ProjectRoot
    try {
        lrelease 17_TcUi.pro 2>&1 | Out-Null
        Write-ColorText "[OK] Translations compiled" "Green"
    }
    catch {
        Write-ColorText "[!] Translation compilation skipped" "Yellow"
    }
    finally {
        Pop-Location
    }

    # Step 3: Build
    Write-Host ""
    Write-ColorText "[3/3] Building application..." "Cyan"

    $buildScript = Join-Path $ScriptRoot "build-windows.bat"

    if (Test-Path $buildScript) {
        Push-Location $ScriptRoot
        try {
            & cmd /c "build-windows.bat $BuildConfig"

            # Check if build succeeded
            $outputDir = if ($BuildConfig -eq "debug") { "output\win\x64\debug" } else { "output\win\x64\release" }
            $exePath = Join-Path $ProjectRoot "$outputDir\17_TcUi.exe"

            if (Test-Path $exePath) {
                Write-Host ""
                Write-ColorText "========================================" "Green"
                Write-ColorText " Build Successful!" "Green"
                Write-ColorText "========================================" "Green"
                Write-Host ""
                Write-ColorText "Executable: $exePath" "Green"
                Write-Host ""

                # Auto-open output directory
                $outputFullPath = Join-Path $ProjectRoot $outputDir
                Write-ColorText "Opening build directory..." "Cyan"
                Start-Process explorer.exe $outputFullPath
            }
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-ColorText "[X] Build script not found: $buildScript" "Red"
    }

    Write-Host ""
    Read-Host "Press Enter to continue"
}

# Option 5: Deploy
function Deploy-App {
    Write-ColorText "Deploying application..." "Cyan"

    $deployScript = Join-Path $ScriptRoot "deploy-windows.bat"

    if (Test-Path $deployScript) {
        Push-Location $ScriptRoot
        try {
            & cmd /c "deploy-windows.bat"
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-ColorText "Deploy script not found: $deployScript" "Red"
    }

    Read-Host "Press Enter to continue"
}

# Option 3: Full build + deploy
function Full-Build-Deploy {
    Write-Host ""
    Write-ColorText "========================================" "Green"
    Write-ColorText " Build + Deploy Workflow" "Green"
    Write-ColorText "========================================" "Green"
    Write-Host ""

    # Step 1: Auto-download scrcpy-server
    Write-ColorText "[1/4] Checking scrcpy-server..." "Cyan"
    Download-Scrcpy-Silent

    # Step 2: Compile translations
    Write-Host ""
    Write-ColorText "[2/4] Compiling translations..." "Cyan"
    Push-Location $ProjectRoot
    try {
        lrelease 17_TcUi.pro 2>&1 | Out-Null
        Write-ColorText "[OK] Translations compiled" "Green"
    }
    catch {
        Write-ColorText "[!] Translation compilation skipped" "Yellow"
    }
    finally {
        Pop-Location
    }

    # Step 3: Build
    Write-Host ""
    Write-ColorText "[3/4] Building application..." "Cyan"
    $buildScript = Join-Path $ScriptRoot "build-windows.bat"

    if (Test-Path $buildScript) {
        Push-Location $ScriptRoot
        try {
            & cmd /c "build-windows.bat release"
        }
        finally {
            Pop-Location
        }
    }

    # Step 4: Deploy
    Write-Host ""
    Write-ColorText "[4/4] Deploying application..." "Cyan"
    $deployScript = Join-Path $ScriptRoot "deploy-windows.bat"

    if (Test-Path $deployScript) {
        Push-Location $ScriptRoot
        try {
            & cmd /c "deploy-windows.bat"
        }
        finally {
            Pop-Location
        }
    }

    # Check result and open folder
    $exePath = Join-Path $ProjectRoot "output\win\x64\release\17_TcUi.exe"
    if (Test-Path $exePath) {
        Write-Host ""
        Write-ColorText "========================================" "Green"
        Write-ColorText " Build + Deploy Successful!" "Green"
        Write-ColorText "========================================" "Green"
        Write-Host ""
        Write-ColorText "Executable: $exePath" "Green"
        Write-Host ""

        # Auto-open output directory
        $outputPath = Join-Path $ProjectRoot "output\win\x64\release"
        Write-ColorText "Opening build directory..." "Cyan"
        Start-Process explorer.exe $outputPath
    }

    Write-Host ""
    Read-Host "Press Enter to continue"
}

# Option 8: Clean
function Clean-Build {
    Write-ColorText "Cleaning build files..." "Cyan"

    Push-Location $ProjectRoot
    try {
        Remove-Item -Path "Makefile*" -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "*.obj", "*.o" -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "output\win" -Recurse -Force -ErrorAction SilentlyContinue
        Write-ColorText "Clean complete!" "Green"
    }
    finally {
        Pop-Location
    }

    Read-Host "Press Enter to continue"
}

# Option 9: System info
function Show-Info {
    Write-ColorText "System Information" "Cyan"
    Write-Host ""

    Write-Host "Project: XingCan Cloud Matrix"
    Write-Host "Version: 2.1.0"
    Write-Host "scrcpy: v$ScrcpyVersion"
    Write-Host ""

    # Qt check
    $qmake = Get-Command qmake -ErrorAction SilentlyContinue
    if ($qmake) {
        Write-ColorText "Qt: Found in PATH" "Green"
        qmake -v | Select-String "Qt version"
    }
    else {
        Write-ColorText "Qt: Not detected" "Yellow"
    }
    Write-Host ""

    # MSVC check
    $cl = Get-Command cl -ErrorAction SilentlyContinue
    if ($cl) {
        Write-ColorText "MSVC: Found in PATH" "Green"
        cl 2>&1 | Select-String "Version"
    }
    else {
        Write-ColorText "MSVC: Not loaded" "Yellow"
    }
    Write-Host ""

    Read-Host "Press Enter to continue"
}

# Option 7: Check dependencies
function Check-Dependencies {
    Write-ColorText "Checking dependencies..." "Cyan"

    $checkScript = Join-Path $ScriptRoot "check-dependencies.bat"

    if (Test-Path $checkScript) {
        Push-Location $ScriptRoot
        try {
            & cmd /c "check-dependencies.bat"
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-ColorText "Dependency checker not found: $checkScript" "Red"
        Read-Host "Press Enter to continue"
    }
}

# Main menu loop
function Main {
    while ($true) {
        Show-Menu

        $choice = Read-Host "Enter your choice (0-9)"

        switch ($choice) {
            "1" { Build-App -BuildConfig "release" }
            "2" { Build-App -BuildConfig "debug" }
            "3" { Full-Build-Deploy }
            "4" { Download-Scrcpy }
            "5" { Compile-Translations }
            "6" { Deploy-App }
            "7" { Check-Dependencies }
            "8" { Clean-Build }
            "9" { Show-Info }
            "0" {
                Write-Host ""
                Write-ColorText "Goodbye!" "Cyan"
                Write-Host ""
                exit 0
            }
            default {
                Write-ColorText "Invalid choice" "Red"
                Start-Sleep -Seconds 2
            }
        }
    }
}

# Entry point
if ($PSBoundParameters.Count -gt 0) {
    # Non-interactive mode with parameters
    Write-ColorText "XingCan Cloud Matrix - Non-Interactive Mode" "Cyan"

    if ($Deploy) {
        Full-Build-Deploy
    }
    else {
        Build-App -BuildConfig $Config
    }
}
else {
    # Interactive menu mode
    Main
}
