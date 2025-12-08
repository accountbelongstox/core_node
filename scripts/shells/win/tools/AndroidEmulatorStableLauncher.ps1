# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

<#
.SYNOPSIS
    Stable Android Emulator Launcher with comprehensive error handling
.DESCRIPTION
    This script provides a robust Android emulator startup process including:
    1. SDK/Emulator/Platform-Tools upgrade checks
    2. Proper emulator configuration (GPU, memory, snapshots)
    3. Wait for emulator boot completion
    4. Proper startup sequence
    5. Prevent duplicate launches
#>

#region Variable Declarations
$ErrorActionPreference = "Continue"

$script:TOOLS_DIR = Split-Path -Path $PSScriptRoot -Parent
$script:WIN_DIR = Split-Path -Path $script:TOOLS_DIR -Parent
$script:INSTALL_DIR = Join-Path $script:WIN_DIR "install_powershells"
$script:SDK_PATH = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$script:EMULATOR_PATH = Join-Path $script:SDK_PATH "emulator\emulator.exe"
$script:ADB_PATH = Join-Path $script:SDK_PATH "platform-tools\adb.exe"
$script:SDKMANAGER_PATH = Join-Path $script:SDK_PATH "cmdline-tools\latest\bin\sdkmanager.bat"
$script:AVDMANAGER_PATH = Join-Path $script:SDK_PATH "cmdline-tools\latest\bin\avdmanager.bat"
$script:AVD_DIR = Join-Path $env:USERPROFILE ".android\avd"
$script:DEFAULT_AVD_NAME = "Pixel_6_API_34"
$script:WAIT_BOOT_TIMEOUT = 180
$script:WAIT_DEVICE_TIMEOUT = 60
$script:POLL_INTERVAL = 5
$script:COLOR_INFO = "Cyan"
$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:EMULATOR_PROC_NAME = "qemu-system-x86_64"
$script:ADB_PORT = 5037
#endregion

#region Helper Functions
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )

    $timestamp = Get-Date -Format "HH:mm:ss"
    $color = $script:COLOR_INFO

    switch ($Level) {
        "SUCCESS" { $color = $script:COLOR_SUCCESS }
        "WARNING" { $color = $script:COLOR_WARNING }
        "ERROR" { $color = $script:COLOR_ERROR }
    }

    Write-Host "[$timestamp][$Level] $Message" -ForegroundColor $color
}

function Test-EmulatorRunning {
    <#
    .SYNOPSIS
        Check if emulator is already running
    #>
    $emuProcess = Get-Process -Name $script:EMULATOR_PROC_NAME -ErrorAction SilentlyContinue
    if ($emuProcess) {
        Write-Log "Emulator process already running (PID: $($emuProcess.Id))" "WARNING"
        return $true
    }

    $adbDevices = & $script:ADB_PATH devices 2>$null
    $onlineDevice = $adbDevices | Select-String "emulator-\d+\s+device"
    if ($onlineDevice) {
        Write-Log "Emulator device already online: $onlineDevice" "WARNING"
        return $true
    }

    return $false
}

function Stop-AllEmulators {
    <#
    .SYNOPSIS
        Stop all running emulator processes
    #>
    Write-Log "Stopping all emulator processes..." "INFO"

    $processes = Get-Process | Where-Object {
        $_.ProcessName -match "(qemu|emulator|AndroidEmulator)"
    }

    foreach ($proc in $processes) {
        try {
            Write-Log "Stopping process: $($proc.ProcessName) (PID: $($proc.Id))" "WARNING"
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Log "Failed to stop process $($proc.Id): $($_.Exception.Message)" "WARNING"
        }
    }

    Start-Sleep -Seconds 2
    Write-Log "All emulator processes stopped" "SUCCESS"
}

function Reset-AdbServer {
    <#
    .SYNOPSIS
        Reset ADB server completely
    #>
    Write-Log "Resetting ADB server..." "INFO"

    $adbProcs = Get-Process -Name "adb" -ErrorAction SilentlyContinue
    foreach ($proc in $adbProcs) {
        Write-Log "Killing ADB process (PID: $($proc.Id))" "WARNING"
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }

    Start-Sleep -Seconds 2

    & $script:ADB_PATH kill-server 2>&1 | Out-Null
    Start-Sleep -Seconds 2

    & $script:ADB_PATH start-server 2>&1 | Out-Null
    Start-Sleep -Seconds 3

    $portCheck = netstat -ano | Select-String ":$script:ADB_PORT"
    if ($portCheck) {
        Write-Log "ADB server listening on port $script:ADB_PORT" "SUCCESS"
    } else {
        Write-Log "ADB server may not be listening properly" "WARNING"
    }
}

function Update-SdkComponents {
    <#
    .SYNOPSIS
        Update SDK components (emulator, platform-tools)
    #>
    Write-Log "Checking for SDK component updates..." "INFO"

    if (-not (Test-Path $script:SDKMANAGER_PATH)) {
        Write-Log "sdkmanager not found at: $script:SDKMANAGER_PATH" "WARNING"
        Write-Log "Skipping SDK update check" "WARNING"
        return
    }

    try {
        Write-Log "Updating emulator..." "INFO"
        & $script:SDKMANAGER_PATH "emulator" 2>&1 | ForEach-Object { Write-Host $_ }

        Write-Log "Updating platform-tools..." "INFO"
        & $script:SDKMANAGER_PATH "platform-tools" 2>&1 | ForEach-Object { Write-Host $_ }

        Write-Log "SDK components updated successfully" "SUCCESS"
    } catch {
        Write-Log "SDK update failed: $($_.Exception.Message)" "WARNING"
    }
}

function Get-AvailableAvds {
    <#
    .SYNOPSIS
        Get list of available AVDs
    #>
    if (-not (Test-Path $script:EMULATOR_PATH)) {
        Write-Log "Emulator not found at: $script:EMULATOR_PATH" "ERROR"
        return @()
    }

    $avdList = & $script:EMULATOR_PATH -list-avds 2>$null
    return $avdList | Where-Object { $_ }
}

function Optimize-AvdConfig {
    param(
        [string]$AvdName
    )
    <#
    .SYNOPSIS
        Optimize AVD configuration for stability
    #>
    $avdConfigPath = Join-Path $script:AVD_DIR "$AvdName.avd\config.ini"

    if (-not (Test-Path $avdConfigPath)) {
        Write-Log "AVD config not found: $avdConfigPath" "WARNING"
        return
    }

    Write-Log "Optimizing AVD configuration: $AvdName" "INFO"

    $configUpdates = @{
        "hw.gpu.enabled" = "yes"
        "hw.gpu.mode" = "auto"
        "hw.ramSize" = "4096"
        "vm.heapSize" = "256"
        "hw.keyboard" = "yes"
        "hw.mainKeys" = "no"
    }

    $content = Get-Content -Path $avdConfigPath
    $modified = $false

    foreach ($key in $configUpdates.Keys) {
        $value = $configUpdates[$key]
        $found = $false

        for ($i = 0; $i -lt $content.Count; $i++) {
            if ($content[$i] -match "^$key\s*=") {
                if ($content[$i] -ne "$key=$value") {
                    $content[$i] = "$key=$value"
                    $modified = $true
                    Write-Log "Updated: $key=$value" "INFO"
                }
                $found = $true
                break
            }
        }

        if (-not $found) {
            $content += "$key=$value"
            $modified = $true
            Write-Log "Added: $key=$value" "INFO"
        }
    }

    if ($modified) {
        $content | Set-Content -Path $avdConfigPath -Encoding UTF8
        Write-Log "AVD configuration optimized" "SUCCESS"
    } else {
        Write-Log "AVD configuration already optimal" "SUCCESS"
    }
}

function Remove-CorruptedSnapshots {
    param(
        [string]$AvdName
    )
    <#
    .SYNOPSIS
        Remove corrupted snapshot files
    #>
    $snapshotDir = Join-Path $script:AVD_DIR "$AvdName.avd\snapshots"

    if (Test-Path $snapshotDir) {
        Write-Log "Removing corrupted snapshots..." "WARNING"
        Remove-Item -Path $snapshotDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Log "Snapshots removed" "SUCCESS"
    } else {
        Write-Log "No snapshots to remove" "INFO"
    }
}

function Clean-TempFiles {
    <#
    .SYNOPSIS
        Clean temporary emulator files
    #>
    Write-Log "Cleaning temporary files..." "INFO"

    $tempDirs = @(
        (Join-Path $env:TEMP "AndroidEmulator"),
        (Join-Path $env:TEMP "avd"),
        (Join-Path $env:TEMP "netsimd")
    )

    foreach ($dir in $tempDirs) {
        if (Test-Path $dir) {
            Write-Log "Removing: $dir" "INFO"
            Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    Write-Log "Temporary files cleaned" "SUCCESS"
}

function Start-EmulatorProcess {
    param(
        [string]$AvdName
    )
    <#
    .SYNOPSIS
        Start emulator with optimal parameters
    #>
    Write-Log "Starting emulator for AVD: $AvdName" "INFO"

    $emulatorArgs = @(
        "-avd", $AvdName,
        "-no-snapshot",
        "-no-audio",
        "-no-boot-anim",
        "-gpu", "auto",
        "-memory", "4096",
        "-partition-size", "2048",
        "-port", "5554"
    )

    Write-Log "Emulator command: $script:EMULATOR_PATH $($emulatorArgs -join ' ')" "INFO"

    Start-Process -FilePath $script:EMULATOR_PATH -ArgumentList $emulatorArgs -NoNewWindow

    Write-Log "Emulator process started" "SUCCESS"
}

function Wait-ForDevice {
    <#
    .SYNOPSIS
        Wait for emulator device to appear in adb
    #>
    Write-Log "Waiting for emulator device (max $script:WAIT_DEVICE_TIMEOUT seconds)..." "INFO"

    $elapsed = 0
    $deviceId = $null

    while ($elapsed -lt $script:WAIT_DEVICE_TIMEOUT) {
        $devicesOutput = & $script:ADB_PATH devices 2>$null

        foreach ($line in $devicesOutput) {
            if ($line -match "^(emulator-\d+)\s+device") {
                $deviceId = $matches[1]
                Write-Log "Device detected: $deviceId" "SUCCESS"
                return $deviceId
            } elseif ($line -match "^(emulator-\d+)\s+offline") {
                $deviceId = $matches[1]
                Write-Log "Device offline, attempting reconnect..." "WARNING"

                & $script:ADB_PATH kill-server 2>&1 | Out-Null
                Start-Sleep -Seconds 2
                & $script:ADB_PATH start-server 2>&1 | Out-Null
                Start-Sleep -Seconds 3
            }
        }

        if (($elapsed % 10) -eq 0) {
            Write-Log "Still waiting... ($elapsed seconds elapsed)" "INFO"
        }

        Start-Sleep -Seconds $script:POLL_INTERVAL
        $elapsed += $script:POLL_INTERVAL
    }

    Write-Log "Device did not appear within timeout" "ERROR"
    return $null
}

function Wait-ForBootComplete {
    param(
        [string]$DeviceId
    )
    <#
    .SYNOPSIS
        Wait for emulator boot completion
    #>
    Write-Log "Waiting for boot completion (max $script:WAIT_BOOT_TIMEOUT seconds)..." "INFO"

    $elapsed = 0

    while ($elapsed -lt $script:WAIT_BOOT_TIMEOUT) {
        $bootProp = & $script:ADB_PATH -s $DeviceId shell getprop sys.boot_completed 2>$null

        if ($bootProp -match "1") {
            Write-Log "Boot completed" "SUCCESS"
            return $true
        }

        if (($elapsed % 20) -eq 0) {
            Write-Log "Still booting... ($elapsed seconds elapsed)" "INFO"
        }

        Start-Sleep -Seconds $script:POLL_INTERVAL
        $elapsed += $script:POLL_INTERVAL
    }

    Write-Log "Boot did not complete within timeout" "ERROR"
    return $false
}

function Show-EmulatorInfo {
    param(
        [string]$DeviceId
    )
    <#
    .SYNOPSIS
        Display emulator information
    #>
    Write-Log "Emulator Information:" "SUCCESS"

    $androidVersion = & $script:ADB_PATH -s $DeviceId shell getprop ro.build.version.release 2>$null
    Write-Host "  Android Version: $androidVersion" -ForegroundColor Green

    $apiLevel = & $script:ADB_PATH -s $DeviceId shell getprop ro.build.version.sdk 2>$null
    Write-Host "  API Level: $apiLevel" -ForegroundColor Green

    $deviceModel = & $script:ADB_PATH -s $DeviceId shell getprop ro.product.model 2>$null
    Write-Host "  Device Model: $deviceModel" -ForegroundColor Green

    $deviceName = & $script:ADB_PATH -s $DeviceId shell getprop ro.product.device 2>$null
    Write-Host "  Device Name: $deviceName" -ForegroundColor Green

    Write-Host ""
}
#endregion

#region Main Execution
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Android Emulator Stable Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Log "Step 1: Verify Android SDK installation" "INFO"
if (-not (Test-Path $script:SDK_PATH)) {
    Write-Log "Android SDK not found at: $script:SDK_PATH" "ERROR"
    Write-Log "Please install Android Studio or Android SDK" "ERROR"
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Log "Android SDK found" "SUCCESS"

if (-not (Test-Path $script:EMULATOR_PATH)) {
    Write-Log "Emulator binary not found at: $script:EMULATOR_PATH" "ERROR"
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Log "Emulator binary found" "SUCCESS"

if (-not (Test-Path $script:ADB_PATH)) {
    Write-Log "ADB binary not found at: $script:ADB_PATH" "ERROR"
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Log "ADB binary found" "SUCCESS"

Write-Host ""
Write-Log "Step 2: Check if emulator is already running" "INFO"
if (Test-EmulatorRunning) {
    $response = Read-Host "Emulator is already running. Stop and restart? (y/n)"
    if ($response -eq "y") {
        Stop-AllEmulators
    } else {
        Write-Log "Using existing emulator instance" "INFO"
        Read-Host "Press Enter to exit"
        exit 0
    }
}
Write-Log "No emulator currently running" "SUCCESS"

Write-Host ""
Write-Log "Step 3: Update SDK components (optional)" "INFO"
$updateResponse = Read-Host "Update emulator and platform-tools? (y/n)"
if ($updateResponse -eq "y") {
    Update-SdkComponents
} else {
    Write-Log "Skipping SDK component updates" "INFO"
}

Write-Host ""
Write-Log "Step 4: Reset ADB server" "INFO"
Reset-AdbServer

Write-Host ""
Write-Log "Step 5: Clean temporary files" "INFO"
Clean-TempFiles

Write-Host ""
Write-Log "Step 6: Select AVD" "INFO"
$avds = Get-AvailableAvds

if ($avds.Count -eq 0) {
    Write-Log "No AVDs found" "ERROR"
    Write-Log "Please create an AVD using Android Studio or avdmanager" "ERROR"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Log "Available AVDs:" "INFO"
for ($i = 0; $i -lt $avds.Count; $i++) {
    Write-Host "  $($i + 1). $($avds[$i])" -ForegroundColor Cyan
}

$selection = Read-Host "Select AVD (1-$($avds.Count)) or press Enter for default [$($avds[0])]"
if ([string]::IsNullOrWhiteSpace($selection)) {
    $selectedAvd = $avds[0]
} else {
    $index = [int]$selection - 1
    if ($index -ge 0 -and $index -lt $avds.Count) {
        $selectedAvd = $avds[$index]
    } else {
        Write-Log "Invalid selection, using default" "WARNING"
        $selectedAvd = $avds[0]
    }
}

Write-Log "Selected AVD: $selectedAvd" "SUCCESS"

Write-Host ""
Write-Log "Step 7: Optimize AVD configuration" "INFO"
Optimize-AvdConfig -AvdName $selectedAvd

Write-Host ""
Write-Log "Step 8: Remove corrupted snapshots" "INFO"
Remove-CorruptedSnapshots -AvdName $selectedAvd

Write-Host ""
Write-Log "Step 9: Start emulator" "INFO"
Start-EmulatorProcess -AvdName $selectedAvd

Write-Host ""
Write-Log "Step 10: Wait for device" "INFO"
$deviceId = Wait-ForDevice

if (-not $deviceId) {
    Write-Log "Failed to detect emulator device" "ERROR"
    Write-Log "Check emulator window for errors" "ERROR"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Log "Step 11: Wait for boot completion" "INFO"
$bootSuccess = Wait-ForBootComplete -DeviceId $deviceId

if (-not $bootSuccess) {
    Write-Log "Boot did not complete successfully" "WARNING"
    Write-Log "Emulator may still be booting, check emulator window" "WARNING"
}

Write-Host ""
Show-EmulatorInfo -DeviceId $deviceId

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Emulator started successfully!" -ForegroundColor Green
Write-Host "Device ID: $deviceId" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Log "You can now use the emulator for development" "SUCCESS"
Write-Log "To install an app: adb -s $deviceId install app.apk" "INFO"
Write-Log "To view logs: adb -s $deviceId logcat" "INFO"

Write-Host ""
Read-Host "Press Enter to exit"
#endregion
