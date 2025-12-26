$ErrorActionPreference = "Continue"

# Read variables from unified variable system
$globalVarDir = Join-Path $env:USERPROFILE ".core_node\.flutter_build\global_vars"

function Get-GlobalVar {
    param($name, $default = "")
    $varFile = Join-Path $globalVarDir $name
    if (Test-Path $varFile) {
        return Get-Content $varFile -Raw -Encoding UTF8 | ForEach-Object { $_.Trim() }
    }
    return $default
}

# Get configuration from variables
$appName = Get-GlobalVar "KEY_SELECTED_APP" "app_main"
$entryFile = Get-GlobalVar "KEY_SELECTED_ENTRY_FILE" "lib/apps/app_main/main_app_main.dart"
$platform = Get-GlobalVar "KEY_SELECTED_PLATFORM" "Android"
$emulatorName = Get-GlobalVar "KEY_SELECTED_EMULATOR" "auto"
$projectRoot = Get-GlobalVar "KEY_PROJECT_ROOT" (Get-Location)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Flutter Bloom Android Debug Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "[INFO] App: $appName" -ForegroundColor Yellow
Write-Host "[INFO] Entry File: $entryFile" -ForegroundColor Yellow
Write-Host "[INFO] Platform: $platform" -ForegroundColor Yellow
Write-Host "[INFO] Emulator: $emulatorName" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

Set-Location $projectRoot

# Determine emulator mode
$emulatorMode = "auto"
if ($platform -eq "Android") {
    $emulatorMode = "physical"
} elseif ($platform -eq "Android_Emulator" -and $emulatorName -ne "auto") {
    $emulatorMode = $emulatorName
}

# Start emulator if specific one selected
if ($emulatorMode -ne "auto" -and $emulatorMode -ne "physical") {
    Write-Host "[INFO] Starting emulator: $emulatorMode" -ForegroundColor Cyan

    $emulatorRunning = $false
    try {
        $runningEmulators = & adb devices | Select-String "emulator-" | Select-String "device$"
        if ($runningEmulators) {
            Write-Host "[INFO] Emulator already running" -ForegroundColor Green
            $emulatorRunning = $true
        }
    } catch {
        Write-Host "[WARNING] Could not check running emulators" -ForegroundColor Yellow
    }

    if (-not $emulatorRunning) {
        Write-Host "[INFO] Launching emulator: $emulatorMode" -ForegroundColor Cyan
        try {
            Start-Process -FilePath "emulator" -ArgumentList "-avd", $emulatorMode, "-netdelay", "none", "-netspeed", "full" -WindowStyle Hidden
            Write-Host "[INFO] Waiting for emulator..." -ForegroundColor Cyan

            $maxWait = 120
            $waited = 0
            $emulatorReady = $false

            while ($waited -lt $maxWait) {
                Start-Sleep -Seconds 2
                $waited += 2

                $devices = & adb devices
                $emulatorDevices = $devices | Select-String "emulator-" | Select-String "device$"

                if ($emulatorDevices) {
                    Write-Host "[SUCCESS] Emulator is ready!" -ForegroundColor Green
                    $emulatorReady = $true
                    break
                }

                if ($waited % 10 -eq 0) {
                    Write-Host "[INFO] Still waiting... ($waited/$maxWait seconds)" -ForegroundColor Yellow
                }
            }

            if (-not $emulatorReady) {
                Write-Host "[ERROR] Timeout waiting for emulator" -ForegroundColor Red
                Write-Host "[INFO] Press any key to exit..." -ForegroundColor Yellow
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                exit 1
            }
        } catch {
            Write-Host "[ERROR] Failed to start emulator: $_" -ForegroundColor Red
            Write-Host "[INFO] Press any key to exit..." -ForegroundColor Yellow
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            exit 1
        }
    }
}

# Check for ADB devices
Write-Host "[INFO] Checking for Android devices..." -ForegroundColor Cyan
$adbDevices = @()
$allDevices = @()
$adbAvailable = $false

try {
    $adbOutput = & adb devices 2>$null
    if ($LASTEXITCODE -eq 0) {
        $adbAvailable = $true
        $allDevices = @($adbOutput | Where-Object { $_ -match "\t" } | ForEach-Object {
            $parts = $_ -split "\t"
            [PSCustomObject]@{
                ID = $parts[0].Trim()
                Status = $parts[1].Trim()
            }
        })

        # Filter based on emulator mode
        if ($emulatorMode -eq "physical") {
            $adbDevices = @($allDevices | Where-Object { $_.Status -eq "device" -and $_.ID -notmatch "^emulator-" })
        } elseif ($emulatorMode -eq "auto") {
            $adbDevices = @($allDevices | Where-Object { $_.Status -eq "device" })
        } else {
            # Prefer emulators
            $adbDevices = @($allDevices | Where-Object { $_.Status -eq "device" -and $_.ID -match "^emulator-" })
            if ($adbDevices.Count -eq 0) {
                $adbDevices = @($allDevices | Where-Object { $_.Status -eq "device" })
            }
        }
    }
} catch {
    Write-Host "[WARNING] ADB not available" -ForegroundColor Yellow
}

$deviceCount = @($adbDevices).Count
$allDeviceCount = @($allDevices).Count

if (-not $adbAvailable) {
    Write-Host "[ERROR] ADB not found!" -ForegroundColor Red
    Write-Host "[INFO] Please install Android SDK Platform Tools" -ForegroundColor Yellow
    Write-Host "[INFO] Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

if ($deviceCount -eq 0) {
    Write-Host "[ERROR] No online Android devices!" -ForegroundColor Red
    Write-Host "" -ForegroundColor White

    if ($allDeviceCount -gt 0) {
        Write-Host "Found $allDeviceCount device(s) but not online:" -ForegroundColor Yellow
        foreach ($device in $allDevices) {
            Write-Host "  - $($device.ID): $($device.Status)" -ForegroundColor Yellow
        }
        Write-Host "" -ForegroundColor White
        Write-Host "Common issues:" -ForegroundColor Yellow
        Write-Host "  - offline: Unplug/replug USB or run: adb kill-server && adb start-server" -ForegroundColor White
        Write-Host "  - unauthorized: Allow USB debugging on device screen" -ForegroundColor White
    } else {
        Write-Host "Please check:" -ForegroundColor Yellow
        Write-Host "  1. Device connected via USB" -ForegroundColor White
        Write-Host "  2. USB debugging enabled" -ForegroundColor White
        Write-Host "  3. USB mode set to 'File Transfer' or 'MTP'" -ForegroundColor White
    }

    Write-Host "" -ForegroundColor White
    Write-Host "Run 'adb devices' to check status" -ForegroundColor Cyan
    Write-Host "[INFO] Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Display found devices
Write-Host "[SUCCESS] Found $deviceCount Android device(s):" -ForegroundColor Green
for ($i = 0; $i -lt $deviceCount; $i++) {
    $device = $adbDevices[$i]
    Write-Host "  [$i] $($device.ID) - $($device.Status)" -ForegroundColor White
}
Write-Host "" -ForegroundColor White

# Auto-select or let user choose
$selectedDevice = $null
if ($deviceCount -eq 1) {
    $selectedDevice = $adbDevices[0].ID
    Write-Host "[INFO] Auto-selected: $selectedDevice" -ForegroundColor Cyan
} else {
    Write-Host "Enter device number [0-$($deviceCount-1)]: " -NoNewline -ForegroundColor Yellow
    $choice = Read-Host

    if ($choice -match '^\d+$' -and [int]$choice -ge 0 -and [int]$choice -lt $deviceCount) {
        $selectedDevice = $adbDevices[[int]$choice].ID
        Write-Host "[INFO] Selected: $selectedDevice" -ForegroundColor Cyan
    } else {
        Write-Host "[ERROR] Invalid selection. Using first device." -ForegroundColor Red
        $selectedDevice = $adbDevices[0].ID
    }
}

Write-Host "" -ForegroundColor White
Write-Host "[INFO] Starting Flutter on: $selectedDevice" -ForegroundColor Green
Write-Host "[INFO] Executing: flutter run --debug -d $selectedDevice -t `"$entryFile`"" -ForegroundColor Cyan
Write-Host "[DEBUG] Hot reload: 'r' | Hot restart: 'R' | Quit: 'q'" -ForegroundColor Yellow

try {
    flutter run --debug -d $selectedDevice -t "$entryFile"
    Write-Host "[INFO] Flutter completed successfully" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Flutter failed: $_" -ForegroundColor Red
}

Write-Host "[INFO] Press any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
