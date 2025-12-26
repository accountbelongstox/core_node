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

#region Variable Declarations
$script:WORKER_DIR = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
$script:TOOLS_DIR = Split-Path -Path $script:WORKER_DIR -Parent
$script:WIN_DIR = Split-Path -Path $script:TOOLS_DIR -Parent
$script:INSTALL_DIR = Join-Path $script:WIN_DIR "install_powershells"
$script:STUDIO_INSTALLER = Join-Path $script:INSTALL_DIR "Step60_InstallAndroidStudio.ps1"
$script:PLATFORM_INSTALLER = Join-Path $script:INSTALL_DIR "Step61_InstallAndroidPlatformTools.ps1"
$script:DEVICE_WAIT_SECONDS = 120
$script:POLL_SECONDS = 5
$script:DEVICE_POLL_LOG = 5
$script:DEFAULT_AVD = "Pixel_4_API_34"
$script:COLOR_INFO = "White"
$script:COLOR_WARN = "Yellow"
$script:COLOR_ERROR = "Red"
$script:ADB_ENV_HINTS = @(
    "Ensure Android SDK platform-tools are installed.",
    "Ensure emulator binaries exist under %ANDROID_HOME%\emulator.",
    "Ensure environment PATH includes platform-tools and emulator."
)
$script:ENV_PATHS = $env:PATH -split ";"
$script:EMU_PROCESS_NAMES = @("qemu-system-x86_64.exe", "emulator.exe", "qemu-system-aarch64.exe")
$script:ADB_SERVER_WAIT_SECONDS = 20
$script:ADB_SERVER_POLL_SECONDS = 2
$script:AVD_BOOT_WAIT_SECONDS = 180
$script:AVD_LOG_INTERVAL = 10
$script:ADB_KNOWN_PORTS = @(5037)
$script:AVD_MONITOR_SLEEP = 5
$script:PRECHECK_SLEEP = 2
$script:EMULATOR_ARGUMENTS = @(
    "-no-snapshot-save",
    "-no-snapshot-load",
    "-wipe-data",
    "-no-boot-anim"
)
$script:NETWORK_TARGETS = @("8.8.8.8", "1.1.1.1")
$script:FOUND_ADB = ""
$script:FOUND_EMULATOR = ""
$script:FOUND_STUDIO_INSTALLER = ""
$script:FOUND_PLATFORM_INSTALLER = ""
$script:CHOSEN_AVD = ""
$script:DEVICE_ID = ""
$script:LOG_PREFIX = "[EMU]"
$script:HALT_EXECUTION = $false
$script:ADB_SERVER_STARTED = $false
$script:AVD_LIST = @()
$script:ADB_RECONNECT_ATTEMPTS = 6
$script:ADB_RECONNECT_WAIT = 10
$script:BOOT_POLL_SECONDS = 5
$script:BOOT_MAX_SECONDS = 240
$script:LOGCAT_BUFFER_LINES = 200
$script:ADB_KEY_PATHS = @(
    (Join-Path $env:USERPROFILE ".android\adbkey"),
    (Join-Path $env:USERPROFILE ".android\adbkey.pub"),
    (Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adbkey"),
    (Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adbkey.pub")
)
$script:ADB_SERVER_PORT = 5037
$script:ALT_PROGRAMFILES = $null
$script:SCAN_ROOTS = @()
$script:ALL_DRIVE_ROOTS = @()
$script:SDK_ROOTS = @()
$script:AVD_DIRS = @()
$script:CACHE_DIR = Join-Path $env:LOCALAPPDATA ".core_node\cache\emu_worker"
$script:CACHE_ADB = Join-Path $script:CACHE_DIR "adb_path.txt"
$script:CACHE_EMU = Join-Path $script:CACHE_DIR "emu_path.txt"
$script:CACHE_AVD = Join-Path $script:CACHE_DIR "avd_list.txt"
$script:TOOLCHAIN_ROOT = ""
#endregion

#region Helper Functions
function Write-InfoLine {
    param([string]$Message)
    Write-Host "$($script:LOG_PREFIX) [INFO] $Message" -ForegroundColor $script:COLOR_INFO
}

function Write-WarnLine {
    param([string]$Message)
    Write-Host "$($script:LOG_PREFIX) [WARN] $Message" -ForegroundColor $script:COLOR_WARN
}

function Write-ErrorLine {
    param([string]$Message)
    Write-Host "$($script:LOG_PREFIX) [ERROR] $Message" -ForegroundColor $script:COLOR_ERROR
}

function Describe-Environment {
    Write-InfoLine "Worker directory: $script:WORKER_DIR"
    Write-InfoLine "Tools directory: $script:TOOLS_DIR"
    Write-InfoLine "Install directory: $script:INSTALL_DIR"
    $script:SDK_ROOTS = @(
        $env:ANDROID_HOME,
        $env:ANDROID_SDK_ROOT,
        (Join-Path $env:LOCALAPPDATA "Android\Sdk")
    )
    $script:AVD_DIRS = @(
        (Join-Path $env:USERPROFILE ".android\avd")
    )
    $rawRoots = ($script:SDK_ROOTS + $script:AVD_DIRS) | Where-Object { $_ -and (Test-Path $_) }
    $script:SCAN_ROOTS = @()
    foreach ($r in $rawRoots) {
        $isDriveRoot = $r -match '^[A-Za-z]:\\?$'
        $hasProgramFiles = ($r -match "Program Files")
        $hasAndroidSdk = ($r -match "Android\\Sdk")
        $hasAvd = ($r -match "\.android\\avd")
        if (-not $isDriveRoot -and -not $hasProgramFiles -and ($hasAndroidSdk -or $hasAvd)) {
            if (-not ($script:SCAN_ROOTS -contains $r)) {
                $script:SCAN_ROOTS += $r
            }
        }
    }
    Write-InfoLine "Active scan roots:"
    foreach ($r in $script:SCAN_ROOTS) { Write-Host "  $r" }
    if (-not (Test-Path $script:CACHE_DIR)) {
        New-Item -ItemType Directory -Path $script:CACHE_DIR -Force | Out-Null
    }
    Write-InfoLine "PATH entries:"
    foreach ($p in $script:ENV_PATHS) {
        if ($p) { Write-Host "  $p" }
    }
}

function Get-AndroidCommands {
    $adbCmd = Get-Command -Name "adb" -ErrorAction SilentlyContinue
    $emuCmd = Get-Command -Name "emu" -ErrorAction SilentlyContinue
    $emulatorCmd = Get-Command -Name "emulator" -ErrorAction SilentlyContinue
    $script:FOUND_ADB = ""
    $script:FOUND_EMULATOR = ""
    if ($adbCmd) { $script:FOUND_ADB = $adbCmd.Source }
    if ($emulatorCmd) { $script:FOUND_EMULATOR = $emulatorCmd.Source }
    if (-not $script:FOUND_EMULATOR -and $emuCmd) { $script:FOUND_EMULATOR = $emuCmd.Source }
    [PSCustomObject]@{ Adb = $adbCmd; Emu = $emuCmd; Emulator = $emulatorCmd }
}

function Recursive-FindBinary {
    param(
        [string]$BinaryName
    )
    $found = @()
    foreach ($root in $script:SCAN_ROOTS) {
        if (-not $root) { continue }
        if (-not (Test-Path $root)) { continue }
        Write-InfoLine "Scanning $root recursively for ${BinaryName} ..."
        $hits = Get-ChildItem -Path $root -Filter $BinaryName -File -Recurse -ErrorAction SilentlyContinue
        foreach ($h in $hits) { $found += $h.FullName }
    }
    if ($found.Count -gt 0) {
        Write-InfoLine "Found ${BinaryName}:"
        foreach ($f in $found) { Write-Host "  $f" }
    } else {
        Write-WarnLine "No ${BinaryName} found via recursive scan."
    }
    $found
}

function Build-AvdListFromIni {
    Write-InfoLine "Searching for AVD ini files across scan roots..."
    $iniHits = @()
    foreach ($root in $script:SCAN_ROOTS) {
        if (-not $root) { continue }
        if (-not (Test-Path $root)) { continue }
        $hitFiles = Get-ChildItem -Path $root -Filter "*.ini" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*.ini" }
        foreach ($f in $hitFiles) {
            $iniHits += $f.FullName
        }
    }
    if ($iniHits.Count -gt 0) {
        Write-InfoLine "Found AVD ini files:"
        foreach ($path in $iniHits) { Write-Host "  $path" }
        foreach ($path in $iniHits) {
            $name = [System.IO.Path]::GetFileNameWithoutExtension($path)
            if ($name -and -not ($script:AVD_LIST -contains $name)) {
                $script:AVD_LIST += $name
            }
        }
    } else {
        Write-WarnLine "No AVD ini files discovered."
    }
}

function Load-CachedPaths {
    if (Test-Path $script:CACHE_ADB) {
        $adbPath = Get-Content -Path $script:CACHE_ADB -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($adbPath -and (Test-Path $adbPath)) {
            $script:FOUND_ADB = $adbPath
            Write-InfoLine "Loaded cached adb path: $adbPath"
        }
    }
    if (Test-Path $script:CACHE_EMU) {
        $emuPath = Get-Content -Path $script:CACHE_EMU -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($emuPath -and (Test-Path $emuPath)) {
            $script:FOUND_EMULATOR = $emuPath
            Write-InfoLine "Loaded cached emulator path: $emuPath"
        }
    }
    if (Test-Path $script:CACHE_AVD) {
        $cachedAvds = Get-Content -Path $script:CACHE_AVD -ErrorAction SilentlyContinue
        if ($cachedAvds) {
            foreach ($avd in $cachedAvds) {
                if ($avd -and -not ($script:AVD_LIST -contains $avd)) {
                    $script:AVD_LIST += $avd
                }
            }
            if ($script:AVD_LIST.Count -gt 0) {
                Write-InfoLine "Loaded cached AVD list."
            }
        }
    }
}

function Save-CachedPaths {
    if ($script:FOUND_ADB) {
        $script:FOUND_ADB | Out-File -FilePath $script:CACHE_ADB -Encoding UTF8 -Force
    }
    if ($script:FOUND_EMULATOR) {
        $script:FOUND_EMULATOR | Out-File -FilePath $script:CACHE_EMU -Encoding UTF8 -Force
    }
    if ($script:AVD_LIST.Count -gt 0) {
        $script:AVD_LIST | Out-File -FilePath $script:CACHE_AVD -Encoding UTF8 -Force
    }
}

function Resolve-AndroidTools {
    Write-InfoLine "Resolving Android tools (adb, emulator) via PATH and SDK roots..."
    Load-CachedPaths
    $cmds = Get-AndroidCommands
    if ($cmds.Emulator -and $cmds.Emulator.Source) {
        $script:TOOLCHAIN_ROOT = Split-Path (Split-Path $cmds.Emulator.Source -Parent) -Parent
    }
    if (-not $script:FOUND_ADB) {
        $adbFound = @()
        foreach ($root in $script:SCAN_ROOTS) {
            if (-not $root) { continue }
            if (-not (Test-Path $root)) { continue }
            Write-InfoLine "Scanning $root for adb.exe ..."
            $hit = Get-ChildItem -Path $root -Filter "adb.exe" -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($hit) { $adbFound += $hit.FullName }
        }
        if ($adbFound.Count -gt 0) { $script:FOUND_ADB = $adbFound[0] }
    }
    if (-not $script:FOUND_EMULATOR) {
        $emuFound = @()
        foreach ($root in $script:SCAN_ROOTS) {
            if (-not $root) { continue }
            if (-not (Test-Path $root)) { continue }
            Write-InfoLine "Scanning $root for emulator.exe ..."
            $hit = Get-ChildItem -Path $root -Filter "emulator.exe" -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($hit) { $emuFound += $hit.FullName }
            if (-not $hit) {
                $hitAlt = Get-ChildItem -Path $root -Filter "emu.exe" -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($hitAlt) { $emuFound += $hitAlt.FullName }
            }
        }
        if ($emuFound.Count -gt 0) { $script:FOUND_EMULATOR = $emuFound[0] }
    }
    if ($script:FOUND_EMULATOR -and -not $script:FOUND_ADB) {
        $emuDir = Split-Path $script:FOUND_EMULATOR -Parent
        $candidateAdb = Join-Path (Split-Path $emuDir -Parent) "platform-tools\adb.exe"
        if (Test-Path $candidateAdb) {
            Write-InfoLine "Aligning adb with emulator toolchain: $candidateAdb"
            $script:FOUND_ADB = $candidateAdb
        }
    }
    if ($script:FOUND_ADB -and -not $script:FOUND_EMULATOR) {
        $adbDir = Split-Path $script:FOUND_ADB -Parent
        $candidateEmu = Join-Path (Split-Path $adbDir -Parent) "emulator\emulator.exe"
        if (Test-Path $candidateEmu) {
            Write-InfoLine "Aligning emulator with adb toolchain: $candidateEmu"
            $script:FOUND_EMULATOR = $candidateEmu
        }
    }
    if ($script:FOUND_ADB) { Write-InfoLine "ADB resolved: $script:FOUND_ADB" } else { Write-WarnLine "ADB not resolved." }
    if ($script:FOUND_EMULATOR) { Write-InfoLine "Emulator resolved: $script:FOUND_EMULATOR" } else { Write-WarnLine "Emulator not resolved." }
    Save-CachedPaths
}

function Run-Installer {
    param(
        [string]$InstallerPath,
        [string]$Label
    )
    if (-not (Test-Path $InstallerPath)) {
        Write-ErrorLine "Missing installer: $InstallerPath"
        $script:HALT_EXECUTION = $true
    }
    Write-InfoLine "Running installer: $Label -> $InstallerPath"
    & $InstallerPath
}

function Get-AvdList {
    param([string]$EmulatorPath)
    $script:AVD_LIST = @()
    $outputLines = & $EmulatorPath -list-avds
    foreach ($line in $outputLines) {
        if ($line -and $line.Trim()) {
            $script:AVD_LIST += $line.Trim()
        }
    }
    if ($script:AVD_LIST.Count -eq 0) {
        Write-WarnLine "No AVDs via emulator -list-avds; scanning for *.ini files..."
        Build-AvdListFromIni
    }
}

function Wait-ForDevice {
    param([string]$AdbPath)
    $elapsed = 0
    $cycle = 0
    $script:DEVICE_ID = ""
    while ($elapsed -lt $script:DEVICE_WAIT_SECONDS) {
        $devicesOutput = & $AdbPath devices
        foreach ($line in $devicesOutput) {
            if ($line -match "^emulator-\d+\s+device") {
                $parts = $line.Split()
                if ($parts.Count -gt 0) {
                    $script:DEVICE_ID = $parts[0]
                }
            }
        }
        $cycle++
        if (($cycle % $script:DEVICE_POLL_LOG) -eq 0) {
            Write-InfoLine "Waiting for emulator device... elapsed ${elapsed}s"
        }
        $offlineMatch = $devicesOutput | Where-Object { $_ -match "offline" }
        if ($offlineMatch) {
            Write-WarnLine "Detected offline device state; attempting adb reconnect..."
            & $AdbPath kill-server
            & $AdbPath start-server
            & $AdbPath connect "127.0.0.1:5554"
            & $AdbPath connect "127.0.0.1:5555"
            & $AdbPath connect "127.0.0.1:5556"
        }
        Start-Sleep -Seconds $script:POLL_SECONDS
        $elapsed += $script:POLL_SECONDS
    }
}

function Retry-AdbReconnect {
    param([string]$AdbPath)
    Write-InfoLine "Starting adb reconnect routine..."
    for ($i = 1; $i -le $script:ADB_RECONNECT_ATTEMPTS; $i++) {
        Write-WarnLine "Reconnect attempt $i/$script:ADB_RECONNECT_ATTEMPTS"
        Kill-AdbProcesses
        Clean-AdbKeys
        & $AdbPath kill-server
        & $AdbPath start-server
        & $AdbPath devices
        & $AdbPath reconnect
        & $AdbPath connect "127.0.0.1:5554"
        & $AdbPath connect "127.0.0.1:5555"
        $devicesNow = & $AdbPath devices
        $online = $devicesNow | Where-Object { $_ -match "emulator-\d+\s+device" }
        if ($online) {
            Write-InfoLine "Device online after reconnect attempt $i"
            $parts = $online[0].Split()
            if ($parts.Count -gt 0) { $script:DEVICE_ID = $parts[0] }
            break
        }
        Start-Sleep -Seconds $script:ADB_RECONNECT_WAIT
    }
    if (-not $script:DEVICE_ID) {
        Write-WarnLine "Device still offline after reconnect attempts."
    }
}

function Monitor-BootCompleted {
    param([string]$AdbPath, [string]$DeviceId)
    Write-InfoLine "Waiting for boot completion property..."
    $elapsed = 0
    while ($elapsed -lt $script:BOOT_MAX_SECONDS) {
        $prop = & $AdbPath -s $DeviceId shell getprop sys.boot_completed
        $locked = & $AdbPath -s $DeviceId shell getprop dev.bootcomplete
        if ($prop -match "1" -or $locked -match "1") {
            Write-InfoLine "Boot reported complete."
            break
        }
        if (($elapsed % $script:BOOT_POLL_SECONDS) -eq 0) {
            Write-InfoLine "Boot polling... elapsed ${elapsed}s"
        }
        Start-Sleep -Seconds $script:BOOT_POLL_SECONDS
        $elapsed += $script:BOOT_POLL_SECONDS
    }
    Write-InfoLine "Fetching recent logcat lines for diagnostics..."
    & $AdbPath -s $DeviceId logcat -d -t $script:LOGCAT_BUFFER_LINES
}

function Show-NetworkInfo {
    param(
        [string]$AdbPath,
        [string]$DeviceId
    )
    Write-InfoLine "Collecting emulator network information..."
    $ipOutput = & $AdbPath -s $DeviceId shell ip addr show
    if ($ipOutput) {
        Write-InfoLine "Emulator ip addr show:"
        foreach ($line in $ipOutput) { Write-Host $line }
    }

    $routeOutput = & $AdbPath -s $DeviceId shell ip route
    if ($routeOutput) {
        Write-InfoLine "Emulator routing table:"
        foreach ($line in $routeOutput) { Write-Host $line }
    }

    $hostIps = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch "^169\.254" }
    if ($hostIps) {
        Write-InfoLine "Host IPv4 addresses:"
        foreach ($entry in $hostIps) {
            Write-Host "$($entry.IPAddress) on $($entry.InterfaceAlias)"
        }
    }
}

function Show-ProcessInfo {
    Write-InfoLine "Checking running emulator-related processes..."
    $procList = Get-Process | Where-Object { $_.ProcessName -match "emulator" -or $_.ProcessName -match "qemu" }
    if ($procList) {
        foreach ($p in $procList) {
            Write-Host "Process: $($p.ProcessName) PID: $($p.Id)"
        }
    } else {
        Write-WarnLine "No emulator-related processes found at start."
    }
}

function Kill-AdbProcesses {
    Write-InfoLine "Killing existing adb processes..."
    $adbProcs = Get-Process -Name "adb" -ErrorAction SilentlyContinue
    foreach ($p in $adbProcs) {
        Write-WarnLine "Stopping adb PID $($p.Id)"
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    }
}

function Clean-AdbKeys {
    Write-InfoLine "Cleaning adb key files..."
    foreach ($p in $script:ADB_KEY_PATHS) {
        if (Test-Path $p) {
            Write-WarnLine "Removing $p"
            Remove-Item -Path $p -Force -ErrorAction SilentlyContinue
        }
    }
}

function Show-AdbServerInfo {
    Write-InfoLine "Checking adb server ports..."
    foreach ($port in $script:ADB_KNOWN_PORTS) {
        $netstat = netstat -ano | Select-String ":$port"
        if ($netstat) {
            Write-InfoLine "Port $port listeners:"
            foreach ($line in $netstat) { Write-Host $line }
        } else {
            Write-WarnLine "No listener detected on port $port"
        }
    }
}

function Start-AdbServer {
    param([string]$AdbPath)
    Kill-AdbProcesses
    Clean-AdbKeys
    Write-InfoLine "Starting adb server..."
    & $AdbPath start-server
    $elapsed = 0
    while ($elapsed -lt $script:ADB_SERVER_WAIT_SECONDS) {
        $serverCheck = netstat -ano | Select-String ":$($script:ADB_KNOWN_PORTS[0])"
        if ($serverCheck) {
            Write-InfoLine "adb server appears to be listening."
            $script:ADB_SERVER_STARTED = $true
            $elapsed = $script:ADB_SERVER_WAIT_SECONDS
        }
        Start-Sleep -Seconds $script:ADB_SERVER_POLL_SECONDS
        $elapsed += $script:ADB_SERVER_POLL_SECONDS
    }
    Write-WarnLine "adb server did not show listening state within $script:ADB_SERVER_WAIT_SECONDS seconds."
}

function Show-EmulatorPaths {
    Write-InfoLine "Searching for emulator binaries..."
    $paths = @()
    foreach ($entry in $script:ENV_PATHS) {
        if ($entry -and (Test-Path $entry)) {
            $emuBin = Join-Path $entry "emulator.exe"
            $emuAlt = Join-Path $entry "emu.exe"
            if (Test-Path $emuBin) { $paths += $emuBin }
            if (Test-Path $emuAlt) { $paths += $emuAlt }
        }
    }
    if ($paths.Count -gt 0) {
        Write-InfoLine "Found emulator binaries:"
        foreach ($p in $paths) { Write-Host "  $p" }
    } else {
        Write-WarnLine "No emulator binaries found in PATH scan."
    }
}

function Show-AvdDirectories {
    Write-InfoLine "Scanning for AVD directories..."
    $userDir = Join-Path $env:USERPROFILE ".android\avd"
    $dirs = @($userDir)
    foreach ($d in $dirs) {
        if (Test-Path $d) {
            Write-InfoLine "AVD directory present: $d"
            $iniFiles = Get-ChildItem -Path $d -Filter "*.ini" -ErrorAction SilentlyContinue
            foreach ($f in $iniFiles) { Write-Host "  AVD ini: $($f.Name)" }
        } else {
            Write-WarnLine "AVD directory not found: $d"
        }
    }
}

function Perform-Preflight {
    Write-InfoLine "Starting preflight checks..."
    Describe-Environment
    Show-ProcessInfo
    Show-AdbServerInfo
    Show-EmulatorPaths
    Show-AvdDirectories
    Write-InfoLine "Preflight checks completed."
}
#endregion

#region Main Execution
Write-InfoLine "Android emulator worker started (non-blocking parent)."
Perform-Preflight
$commands = Get-AndroidCommands
Resolve-AndroidTools

if (-not $script:FOUND_ADB -or (-not $script:FOUND_EMULATOR)) {
    Write-WarnLine "Android tools not fully detected. Launching installers..."
    Run-Installer -InstallerPath $script:STUDIO_INSTALLER -Label "Android Studio"
    Run-Installer -InstallerPath $script:PLATFORM_INSTALLER -Label "Android Platform Tools"
    Resolve-AndroidTools
}

if (-not $script:FOUND_ADB) {
    Write-ErrorLine "adb is not available after installer attempts. Manual check required."
    $script:HALT_EXECUTION = $true
}
if (-not $script:FOUND_EMULATOR) {
    Write-ErrorLine "emulator/emu not available after installer attempts. Manual check required."
    $script:HALT_EXECUTION = $true
}

if (-not $script:HALT_EXECUTION) {
    Start-AdbServer -AdbPath $script:FOUND_ADB
    if (-not $script:ADB_SERVER_STARTED) {
        Write-WarnLine "adb server not confirmed listening; invoking platform-tools installer..."
        Run-Installer -InstallerPath $script:PLATFORM_INSTALLER -Label "Android Platform Tools"
        Start-AdbServer -AdbPath $script:FOUND_ADB
    }
}

$emulatorPath = $script:FOUND_EMULATOR

Get-AvdList -EmulatorPath $emulatorPath
if (-not $script:HALT_EXECUTION) {
    if ($script:AVD_LIST.Count -gt 0) {
        Write-InfoLine "Detected AVDs:"
        $index = 1
        foreach ($avdItem in $script:AVD_LIST) {
            Write-Host "$index. $avdItem"
            $index++
        }
        $script:CHOSEN_AVD = $script:AVD_LIST[0]
        Write-InfoLine "Auto-selecting first AVD: $script:CHOSEN_AVD"
    } else {
        Write-WarnLine "No AVDs detected. Using fallback AVD name."
        $script:CHOSEN_AVD = $script:DEFAULT_AVD
    }
}

if (-not $script:HALT_EXECUTION) {
    Write-InfoLine "Launching emulator for AVD: $script:CHOSEN_AVD"
    $emulatorArgs = @("-avd", $script:CHOSEN_AVD) + $script:EMULATOR_ARGUMENTS
    $quotedEmu = '"' + $emulatorPath + '"'
    $quotedAvd = '"' + $script:CHOSEN_AVD + '"'
    $emulatorCommand = "$quotedEmu -avd $quotedAvd " + (($script:EMULATOR_ARGUMENTS) -join " ")
    Write-InfoLine "Emulator command: $emulatorCommand"
    $startCmd = 'start "" ' + $emulatorCommand
    cmd.exe /c $startCmd
}

if (-not $script:HALT_EXECUTION) {
    Write-InfoLine "Waiting for emulator to appear in adb devices..."
    Wait-ForDevice -AdbPath $script:FOUND_ADB
    if (-not $script:DEVICE_ID) {
        Write-WarnLine "Emulator did not appear in adb devices within the wait window. Check emulator window."
        $script:HALT_EXECUTION = $true
    } else {
        Write-InfoLine "Device detected: $script:DEVICE_ID"
        $deviceStatus = & $script:FOUND_ADB devices
        foreach ($line in $deviceStatus) { Write-Host $line }
        $offlineState = $deviceStatus | Where-Object { $_ -match "$script:DEVICE_ID\s+offline" }
        if ($offlineState) {
            Write-WarnLine "Device reported offline; trying reconnect routine."
            Retry-AdbReconnect -AdbPath $script:FOUND_ADB
        }
    }
}

if (-not $script:HALT_EXECUTION) {
    Write-InfoLine "Emulator online as $script:DEVICE_ID"
    $devicesDetail = & $script:FOUND_ADB devices -l
    if ($devicesDetail) {
        Write-InfoLine "adb devices -l output:"
        foreach ($line in $devicesDetail) { Write-Host $line }
    }
    Monitor-BootCompleted -AdbPath $script:FOUND_ADB -DeviceId $script:DEVICE_ID
    Show-NetworkInfo -AdbPath $script:FOUND_ADB -DeviceId $script:DEVICE_ID
    Write-InfoLine "Android emulator worker finished."
}
#endregion
