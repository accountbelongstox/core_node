# Auto-install, start, build, and debug helper for React Native (Android/optional iOS).
# Live command output is the only source of status; no exit-code checks or return parsing.

$orig = Get-Location
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Info($msg) { Write-Host "[info] $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "[warn] $msg" -ForegroundColor Yellow }

try {
  Info "Project root: $root"
  Info "Checking required tools (node, npm, npx, Java, adb)."
  $tools = @(
    @{ Name = "node"; Hint = "Install Node.js 20+ from https://nodejs.org" },
    @{ Name = "npm"; Hint = "Install Node.js (npm included)" },
    @{ Name = "npx"; Hint = "Install Node.js (npx included)" },
    @{ Name = "java"; Hint = "Install Temurin/OpenJDK 17+ and add to PATH" },
    @{ Name = "adb"; Hint = "Install Android SDK Platform Tools and add to PATH" }
  )
  foreach ($tool in $tools) {
    $hit = Get-Command $tool.Name -ErrorAction SilentlyContinue
    if ($null -eq $hit) {
      Warn "$($tool.Name) not found. $($tool.Hint)"
    } else {
      Info "$($tool.Name) -> $($hit.Source)"
    }
  }

  Info "Node version (ensure 20+):"
  node -v
  Info "npm version:"
  npm -v

  Info "Installing JS dependencies via pnpm (shamefully-hoist). Watch output for success."
  pnpm install --shamefully-hoist --no-frozen-lockfile

  function Build-AndroidDebug {
    Info "Building Android debug APK (Gradle)."
    Push-Location "$root/android"
    ./gradlew.bat assembleDebug
    Pop-Location
  }

  function Start-Metro {
    Info "Starting Metro bundler in a new PowerShell window (keep it open)."
    Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location `"$root`"; Write-Host '--- Metro bundler ---'; npx react-native start"
  }

  function Run-AndroidDebug {
    Info "Launching Android debug build in this window (connect emulator/device first)."
    Write-Host "Metro must keep running; watch Gradle/ADB output for progress." -ForegroundColor DarkGray
    npx react-native run-android --mode debug
  }

  function Install-AndroidViaAdb {
    $apk = Join-Path $root "android\app\build\outputs\apk\debug\app-debug.apk"
    Info "ADB devices list:"
    adb devices
    Info "Installing debug APK to first available device (ensure only target is connected)."
    adb install -r $apk
    Info "Launching app via adb monkey."
    adb shell monkey -p com.react_native_qy -c android.intent.category.LAUNCHER 1
  }

  function Run-IOSDebug {
    Info "Launching iOS debug build (requires macOS with Xcode and simulator/device)."
    Write-Host "Metro must keep running; watch Xcode build output for progress." -ForegroundColor DarkGray
    npx react-native run-ios --mode Debug
  }

  function Show-Menu {
    Write-Host ""
    Write-Host "=== React Native helper ===" -ForegroundColor Cyan
    Write-Host "[1] Start Metro (new window)"
    Write-Host "[2] Android debug build (CLI run-android)"
    Write-Host "[3] Android Gradle build debug APK + adb install/launch"
    Write-Host "[4] iOS debug build (macOS only)"
    Write-Host "[5] Full Android flow: Metro -> run-android"
    Write-Host "[6] Full Android flow: Metro -> Gradle build -> adb install/launch"
    Write-Host "[r] Re-run pnpm install"
    Write-Host "[q] Quit"
    Write-Host ""
  }

  $running = $true
  while ($running) {
    Show-Menu
    $choice = Read-Host "Select an option"
    switch ($choice) {
      "1" { Start-Metro }
      "2" { Run-AndroidDebug }
      "3" { Build-AndroidDebug; Install-AndroidViaAdb }
      "4" { Run-IOSDebug }
      "5" {
        Info "Flow: Metro -> run-android."
        Start-Metro
        Run-AndroidDebug
      }
      "6" {
        Info "Flow: Metro -> Gradle build -> adb install/launch."
        Start-Metro
        Build-AndroidDebug
        Install-AndroidViaAdb
      }
      "r" {
        Info "Re-installing JS dependencies with pnpm."
        pnpm install --shamefully-hoist --no-frozen-lockfile
      }
      "q" { $running = $false }
      default { Warn "Unknown option. Try again." }
    }
  }

  Info "Script finished; menu exited."
}
finally {
  Set-Location $orig
  Info "Returned to original directory: $orig"
}
