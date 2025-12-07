# ============================================
# React Native Automation Menu (PowerShell)
# ============================================

param(
    [string]$ScriptDir = $PSScriptRoot
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $ScriptDir
$InitialDirectory = Get-Location

function Write-Section {
    param([string]$Message)
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Cyan
}

function Invoke-Stream {
    param(
        [string]$Executable,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory = $null
    )

    if ($WorkingDirectory) {
        Push-Location $WorkingDirectory
    }

    $argText = $Arguments -join " "
    Write-Host ""
    Write-Host ">> $Executable $argText" -ForegroundColor Yellow
    Write-Host ""

    & $Executable @Arguments

    if ($WorkingDirectory) {
        Pop-Location
    }
}

function Ensure-Dependencies {
    param([string]$Root = $ProjectRoot)

    $nodeModules = Join-Path $Root "node_modules"
    if (Test-Path $nodeModules) {
        Write-Host "[Install] Dependencies already present" -ForegroundColor Gray
        return
    }

    Write-Section "Installing dependencies (pnpm)"
    Invoke-Stream "pnpm" @("install") $Root
}

function Get-AdbPath {
    $candidates = @()
    foreach ($envName in @("ANDROID_SDK_ROOT", "ANDROID_HOME")) {
        $root = [System.Environment]::GetEnvironmentVariable($envName)
        if ($root) {
            $candidates += (Join-Path $root "platform-tools\adb.exe")
        }
    }

    $command = Get-Command adb -ErrorAction SilentlyContinue
    if ($command) {
        $candidates += $command.Source
    }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    return "adb"
}

function Ensure-Adb {
    $adbPath = Get-AdbPath
    Write-Host "[ADB] Using $adbPath" -ForegroundColor Gray
    Write-Host "[ADB] Starting server" -ForegroundColor Gray
    Invoke-Stream $adbPath @("start-server")
    return $adbPath
}

function Wait-ForDevice {
    param(
        [string]$AdbPath,
        [int]$TimeoutSeconds = 240
    )

    $startTime = Get-Date
    while ((((Get-Date) - $startTime).TotalSeconds) -lt $TimeoutSeconds) {
        $devicesOutput = & $AdbPath devices
        $lines = @($devicesOutput)
        foreach ($line in $lines) {
            if ($line -match "^(?<id>\S+)\s+device$") {
                $deviceId = $Matches["id"]
                $boot = (& $AdbPath -s $deviceId shell getprop sys.boot_completed 2>$null).Trim()
                if ($boot -eq "1") {
                    Write-Host "[ADB] Device ready: $deviceId" -ForegroundColor Green
                    return $deviceId
                }
            }
        }

        Write-Host "[ADB] Waiting for emulator/device..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }

    Write-Host "[ADB] Device not ready, continuing anyway" -ForegroundColor Yellow
    return $null
}

function Start-Metro {
    Write-Host "[Metro] Launching Metro in separate window" -ForegroundColor Yellow
    $command = "cd `"$ProjectRoot`"; npx react-native start"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $command -WindowStyle Normal
}

function Start-Emulator {
    param([string]$AdbPath)

    $sdkRoot = (Split-Path -Parent (Split-Path -Parent $AdbPath))
    $emulator = Join-Path $sdkRoot "emulator\emulator.exe"
    if (-not (Test-Path $emulator)) {
        Write-Host "[Emulator] emulator.exe not found. Please start an emulator manually." -ForegroundColor Yellow
        return
    }

    $avdList = & $emulator -list-avds
    $avds = @($avdList)
    if ($avds.Count -eq 0) {
        Write-Host "[Emulator] No AVDs defined. Please create one via Android Studio." -ForegroundColor Yellow
        return
    }

    $selectedAvd = $avds[0]
    Write-Host "[Emulator] Starting $selectedAvd" -ForegroundColor Yellow
    Start-Process -FilePath $emulator -ArgumentList "-avd", $selectedAvd -WindowStyle Minimized
}

function Run-AndroidDebug {
    Ensure-Dependencies
    $adbPath = Ensure-Adb
    $deviceReady = Wait-ForDevice -AdbPath $adbPath -TimeoutSeconds 60

    if (-not $deviceReady) {
        Start-Emulator -AdbPath $adbPath
        Wait-ForDevice -AdbPath $adbPath
    }

    Start-Metro
    Write-Section "Running Android debug build"
    Invoke-Stream "npx" @("react-native", "run-android", "--port", "8081") $ProjectRoot
}

function Build-AndroidRelease {
    $namespace = Get-CurrentNamespace
    if (-not $namespace) { $namespace = "app" }

    $config = Get-BuildConfig -Root $ProjectRoot -Namespace $namespace
    $buildNameRaw = $config.AppName
    if (-not $buildNameRaw) { $buildNameRaw = $namespace }
    $buildName = ($buildNameRaw -replace '[^A-Za-z0-9_-]', "_")
    $buildFolder = "_build_$buildName"
    $buildRoot = Join-Path "D:\" $buildFolder
    $useExternal = $config.UseExternalSafeBuild

    if ($useExternal) {
        Write-Section "Syncing project to $buildRoot"
        $helper = Join-Path $ProjectRoot "scripts\build_scripts\build_helper.py"
        & python $helper sync --src $ProjectRoot --dst $buildRoot
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Project sync failed; aborting build." -ForegroundColor Red
            return
        }
    }

    if ($useExternal) {
        $effectiveRoot = $buildRoot
    }
    else {
        $effectiveRoot = $ProjectRoot
    }

    # Install dependencies in build copy (node_modules excluded from sync).
    Ensure-Dependencies -Root $effectiveRoot

    $adbPath = Ensure-Adb
    $androidDir = Join-Path $effectiveRoot "android"
    # Resource operations run inside the build copy via Python helper.
    $helperScript = Join-Path $ProjectRoot "scripts\build_scripts\build_helper.py"
    & python $helperScript apply-resources --root $effectiveRoot --namespace $namespace --icon $config.IconFile
    & python $helperScript update-app-json --root $effectiveRoot --namespace $namespace
    & python $helperScript update-android-name --root $effectiveRoot --namespace $namespace
    & python $helperScript update-android-ids --root $effectiveRoot --namespace $namespace
    & python $helperScript replace-identifiers --root $effectiveRoot --namespace $namespace

    Write-Section "Assembling Android release"
    Invoke-Stream ".\\gradlew.bat" @("assembleRelease") $androidDir

    $apkPath = Join-Path $androidDir "app"
    $apkPath = Join-Path $apkPath "build"
    $apkPath = Join-Path $apkPath "outputs"
    $apkPath = Join-Path $apkPath "apk"
    $apkPath = Join-Path $apkPath "release"
    $apkPath = Join-Path $apkPath "app-release.apk"
    if (-not (Test-Path $apkPath)) {
        Write-Host "[APK] app-release.apk not found. Please check the build output." -ForegroundColor Yellow
        return
    }

    Write-Section "Installing release APK via adb"
    Invoke-Stream $adbPath @("install", "-r", $apkPath)
}

function Get-CurrentNamespace {
    param([string]$Root = $ProjectRoot)

    $indexPath = Join-Path $Root "index.js"
    if (-not (Test-Path $indexPath)) {
        return $null
    }

    $indexContent = Get-Content -Path $indexPath -Raw
    $pattern = "\./src/apps/(?<ns>[^/]+)/App"
    $match = [regex]::Match($indexContent, $pattern)
    if ($match.Success) {
        return $match.Groups["ns"].Value
    }

    return $null
}

function Get-BuildConfig {
    param(
        [string]$Root = $ProjectRoot,
        [string]$Namespace
    )

    $helper = Join-Path $Root "scripts\build_scripts\build_helper.py"
    $json = & python $helper read-config --root $Root --namespace $Namespace
    if ($LASTEXITCODE -ne 0 -or -not $json) {
        return @{
            AppName = $Namespace
            IconFile = "logo.png"
            UseExternalSafeBuild = $true
        }
    }
    try {
        return $json | ConvertFrom-Json
    } catch {
        return @{
            AppName = $Namespace
            IconFile = "logo.png"
            UseExternalSafeBuild = $true
        }
    }
}

function Run-IosDebug {
    Ensure-Dependencies
    Write-Section "Running iOS debug build"
    Invoke-Stream "npx" @("react-native", "run-ios") $ProjectRoot
}

function Show-Menu {
    Write-Section "React Native Automation Menu"
    Write-Host "1) Install dependencies (pnpm install)"
    Write-Host "2) Android debug (Metro + run-android)"
    Write-Host "3) Android release build + adb install"
    Write-Host "4) iOS debug (npx react-native run-ios)"
    Write-Host "5) Clean node_modules"
    Write-Host "6) Exit"
    Write-Host ""
}

function Clean-NodeModules {
    $nodeModules = Join-Path $ProjectRoot "node_modules"
    if (Test-Path $nodeModules) {
        Write-Section "Removing node_modules"
        Remove-Item -Recurse -Force $nodeModules
    } else {
        Write-Host "[Clean] node_modules is already removed" -ForegroundColor Gray
    }
}

Write-Host "Project root: $ProjectRoot" -ForegroundColor Cyan

while ($true) {
    Show-Menu
    $choice = Read-Host "Select an option"

    switch ($choice) {
        "1" { Ensure-Dependencies }
        "2" { Run-AndroidDebug }
        "3" { Build-AndroidRelease }
        "4" { Run-IosDebug }
        "5" { Clean-NodeModules }
        "6" {
            Write-Host "Exiting..." -ForegroundColor Green
            break
        }
        default { Write-Host "Invalid option" -ForegroundColor Red }
    }
}

Set-Location $InitialDirectory
