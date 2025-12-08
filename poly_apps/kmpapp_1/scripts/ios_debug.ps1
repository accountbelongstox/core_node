# ios_debug.ps1 - iOS Platform Debugging Script
# Usage: .\scripts\ios_debug.ps1 [command] [options]
# Note: iOS debugging requires macOS. This script may not work on Windows.

param(
    [Parameter(Position=0)]
    [string]$Command = "",
    
    [Parameter(Position=1)]
    [string]$Option = "",
    
    [Parameter(Position=2)]
    [string]$Option2 = "",
    
    [Parameter(Position=3)]
    [string]$Option3 = ""
)

# Configuration
$IOS_APP_DIR = "ios-app"
$SCHEME = "alkaa"
$CONFIGURATION = "Debug"
$SIMULATOR_NAME = "iPhone 15 Pro"

# Functions: Print colored messages
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function: Check if command exists
function Test-Command {
    param([string]$CommandName)
    
    $null = Get-Command $CommandName -ErrorAction SilentlyContinue
    if (-not $?) {
        Write-Error "$CommandName is not installed, please install it first"
        exit 1
    }
}

# Function: Check if on macOS
function Test-macOS {
    if ($IsMacOS -or (Get-Command "uname" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue)) {
        $uname = & uname 2>$null
        if ($uname -eq "Darwin") {
            return $true
        }
    }
    return $false
}

# Function: List available iOS simulators
function Get-Simulators {
    Write-Info "Available iOS simulators:"
    $simulators = & xcrun simctl list devices available
    $simulators | Select-String -Pattern "iPhone|iPad" | ForEach-Object {
        Write-Host "  - $($_.Line.Trim())"
    }
}

# Function: Start simulator
function Start-Simulator {
    param([string]$SimulatorName)
    
    if ([string]::IsNullOrEmpty($SimulatorName)) {
        $SimulatorName = $SIMULATOR_NAME
    }
    
    Write-Info "Starting iOS simulator: $SimulatorName"
    
    # Check if simulator is already running
    $booted = & xcrun simctl list devices | Select-String -Pattern $SimulatorName | Select-String -Pattern "Booted"
    if ($booted) {
        Write-Warning "Simulator $SimulatorName is already running"
    } else {
        # Start simulator
        & xcrun simctl boot $SimulatorName 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to start simulator: $SimulatorName"
            Write-Info "Please check if simulator name is correct"
            Get-Simulators
            exit 1
        }
        Write-Success "Simulator started"
    }
    
    # Open Simulator app
    & open -a Simulator
}

# Function: Build shared module
function Build-SharedModule {
    Write-Info "Building KMP shared module..."
    & .\gradlew :shared:packForXcode
    Write-Success "Shared module built"
}

# Function: Open Xcode project
function Open-Xcode {
    $workspaceFile = Join-Path $IOS_APP_DIR "alkaa.xcworkspace"
    $projectFile = Join-Path $IOS_APP_DIR "alkaa.xcodeproj"
    
    if (Test-Path $workspaceFile) {
        Write-Info "Opening Xcode Workspace..."
        & open $workspaceFile
    } elseif (Test-Path $projectFile) {
        Write-Info "Opening Xcode Project..."
        & open $projectFile
    } else {
        Write-Error "Xcode project file not found"
        exit 1
    }
}

# Function: Build and run using xcodebuild
function Build-Run {
    param([string]$SimulatorName)
    
    if ([string]::IsNullOrEmpty($SimulatorName)) {
        $SimulatorName = $SIMULATOR_NAME
    }
    
    Write-Info "Building and running with xcodebuild..."
    
    # Get simulator UDID
    $udid = & xcrun simctl list devices | Select-String -Pattern $SimulatorName | ForEach-Object {
        if ($_ -match '([A-F0-9-]{36})') {
            $matches[1]
        }
    } | Select-Object -First 1
    
    if ([string]::IsNullOrEmpty($udid)) {
        Write-Error "Simulator not found: $SimulatorName"
        Get-Simulators
        exit 1
    }
    
    Write-Info "Target simulator UDID: $udid"
    
    # Build shared module
    Build-SharedModule
    
    # Build app
    Write-Info "Building iOS app..."
    & xcodebuild `
        -workspace (Join-Path $IOS_APP_DIR "alkaa.xcworkspace") `
        -scheme $SCHEME `
        -configuration $CONFIGURATION `
        -destination "id=$udid" `
        clean build
    
    # Install to simulator
    Write-Info "Installing app to simulator..."
    $appPath = Join-Path $IOS_APP_DIR "build/Build/Products/${CONFIGURATION}-iphonesimulator/${SCHEME}.app"
    & xcrun simctl install $udid $appPath 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Installation failed, try running with Xcode"
    }
    
    # Launch app
    Write-Info "Launching app..."
    & xcrun simctl launch $udid "com.escodro.alkaa"
    
    Write-Success "App launched"
}

# Function: View logs
function Show-Logs {
    Write-Info "Viewing simulator logs (Press Ctrl+C to exit)..."
    $bootedUdid = & xcrun simctl list devices | Select-String -Pattern "Booted" | ForEach-Object {
        if ($_ -match '([A-F0-9-]{36})') {
            $matches[1]
        }
    } | Select-Object -First 1
    
    if ([string]::IsNullOrEmpty($bootedUdid)) {
        Write-Error "No running simulator found"
        exit 1
    }
    
    $logPath = "$env:HOME/Library/Logs/CoreSimulator/$bootedUdid/system.log"
    Get-Content $logPath -Wait -Tail 50
}

# Function: Record simulator screen
function Record-Screen {
    param([string]$OutputFile = "screen_recording.mp4")
    
    $bootedUdid = & xcrun simctl list devices | Select-String -Pattern "Booted" | ForEach-Object {
        if ($_ -match '([A-F0-9-]{36})') {
            $matches[1]
        }
    } | Select-Object -First 1
    
    if ([string]::IsNullOrEmpty($bootedUdid)) {
        Write-Error "No running simulator found"
        exit 1
    }
    
    Write-Info "Starting screen recording to: $OutputFile"
    Write-Info "Press Ctrl+C to stop recording"
    
    & xcrun simctl io booted recordVideo $OutputFile
    Write-Success "Recording saved to: $OutputFile"
}

# Function: Set simulator language
function Set-SimulatorLanguage {
    param(
        [string]$SimulatorName,
        [string]$Language = "zh",
        [string]$Locale = "zh_CN"
    )
    
    if ([string]::IsNullOrEmpty($SimulatorName)) {
        $SimulatorName = $SIMULATOR_NAME
    }
    
    Write-Info "Setting simulator language: $Language, locale: $Locale"
    & xcrun simctl boot $SimulatorName --language $Language --locale $Locale
    Write-Success "Language set"
}

# Main function
function Main {
    Write-Info "iOS Debugging Tool"
    Write-Host ""
    
    # Check if on macOS
    if (-not (Test-macOS)) {
        Write-Error "iOS debugging requires macOS"
        exit 1
    }
    
    # Check required commands
    Test-Command "xcrun"
    Test-Command "xcodebuild"
    
    # Parse command
    switch ($Command.ToLower()) {
        "list" {
            Get-Simulators
            exit 0
        }
        "simulator" {
            Start-Simulator $Option
        }
        "build" {
            Build-SharedModule
        }
        "open" {
            Build-SharedModule
            Open-Xcode
            Write-Info "In Xcode:"
            Write-Host "  1. Select simulator: $(if ($Option) { $Option } else { $SIMULATOR_NAME })"
            Write-Host "  2. Select Scheme: $SCHEME"
            Write-Host "  3. Click Run button (Cmd + R)"
        }
        "run" {
            Start-Simulator $Option
            Build-Run $Option
        }
        "logs" {
            Show-Logs
        }
        "record" {
            Record-Screen $Option
        }
        "language" {
            Set-SimulatorLanguage $Option $Option2 $Option3
        }
        default {
            Write-Host "Usage: .\scripts\ios_debug.ps1 [command] [options]"
            Write-Host ""
            Write-Host "Commands:"
            Write-Host "  list                    - List available simulators"
            Write-Host "  simulator [name]        - Start simulator"
            Write-Host "  build                   - Build shared module"
            Write-Host "  open [simulator]        - Build and open Xcode"
            Write-Host "  run [simulator]         - Build and run to simulator"
            Write-Host "  logs                     - View simulator logs"
            Write-Host "  record [filename]      - Record simulator screen"
            Write-Host "  language [name] [lang] [locale] - Set simulator language"
            Write-Host ""
            Write-Host "Examples:"
            Write-Host "  .\scripts\ios_debug.ps1 list"
            Write-Host "  .\scripts\ios_debug.ps1 simulator `"iPhone 15 Pro`""
            Write-Host "  .\scripts\ios_debug.ps1 open"
            Write-Host "  .\scripts\ios_debug.ps1 run `"iPhone 15 Pro`""
            Write-Host "  .\scripts\ios_debug.ps1 logs"
            Write-Host "  .\scripts\ios_debug.ps1 record demo.mp4"
            Write-Host "  .\scripts\ios_debug.ps1 language `"iPhone 15 Pro`" zh zh_CN"
            exit 1
        }
    }
}

Main

