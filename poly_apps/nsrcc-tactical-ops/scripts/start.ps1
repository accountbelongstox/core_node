# ============================================================================
# 老挝靶场 - Development Script
# ============================================================================

param(
    [string]$Action = ""
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# ============================================================================
# Utility Functions
# ============================================================================

function Write-Info { param([string]$msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success { param([string]$msg) Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Error { param([string]$msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Warning { param([string]$msg) Write-Host "[WARNING] $msg" -ForegroundColor Yellow }

function Test-PnpmInstalled {
    try { $null = Get-Command pnpm -ErrorAction Stop; return $true }
    catch { return $false }
}

function Install-Pnpm {
    Write-Info "Installing pnpm..."
    npm install -g pnpm
    if ($LASTEXITCODE -eq 0) { Write-Success "pnpm installed" } else { Write-Error "pnpm install failed"; exit 1 }
}

function Ensure-Pnpm {
    if (-not (Test-PnpmInstalled)) { Install-Pnpm }
}

function Auto-InstallPackages {
    Push-Location $ProjectRoot
    try {
        Write-Info "Installing packages..."
        pnpm install
        if ($LASTEXITCODE -ne 0) { Write-Error "Package installation failed"; exit 1 }
        Write-Success "Packages installed"
    } finally { Pop-Location }
}

function Auto-SetupCapacitor {
    Push-Location $ProjectRoot
    try {
        $configPath = Join-Path $ProjectRoot "capacitor.config.ts"
        $nodeModulesPath = Join-Path $ProjectRoot "node_modules"
        
        $hasCapacitor = Test-Path (Join-Path $nodeModulesPath "@capacitor\core")
        
        if (-not $hasCapacitor) {
            Write-Info "Installing Capacitor packages..."
            pnpm add -D @capacitor/cli
            pnpm add @capacitor/core
        }
        
        if (-not (Test-Path $configPath)) {
            Write-Info "Initializing Capacitor..."
            npx cap init 2>$null
        }
        
        $androidPath = Join-Path $ProjectRoot "android"
        $iosPath = Join-Path $ProjectRoot "ios"
        
        if (-not (Test-Path $androidPath)) {
            Write-Info "Adding Android platform..."
            pnpm add -D @capacitor/android
            npx cap add android 2>$null
        }
        
        if (-not (Test-Path $iosPath)) {
            Write-Info "Adding iOS platform..."
            pnpm add -D @capacitor/ios
            npx cap add ios 2>$null
        }
        
        Write-Success "Capacitor setup complete"
    } finally { Pop-Location }
}

# ============================================================================
# Development Functions
# ============================================================================

function Start-Dev {
    Push-Location $ProjectRoot
    try {
        Write-Info "Starting development server..."
        pnpm dev
    } finally { Pop-Location }
}

function Build-Project {
    Push-Location $ProjectRoot
    try {
        Write-Info "Building project..."
        pnpm build
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Build complete"
            npx cap sync 2>$null
        } else {
            Write-Error "Build failed"
            exit 1
        }
    } finally { Pop-Location }
}

function Sync-Capacitor {
    Push-Location $ProjectRoot
    try {
        Write-Info "Syncing Capacitor..."
        npx cap sync
        if ($LASTEXITCODE -eq 0) { Write-Success "Capacitor synced" } else { Write-Error "Sync failed" }
    } finally { Pop-Location }
}

function Open-Android {
    Push-Location $ProjectRoot
    try {
        Write-Info "Opening Android Studio..."
        npx cap open android
    } finally { Pop-Location }
}

function Open-IOS {
    Push-Location $ProjectRoot
    try {
        Write-Info "Opening Xcode..."
        npx cap open ios
    } finally { Pop-Location }
}

function Test-AdbInstalled {
    try { $null = Get-Command adb -ErrorAction Stop; return $true }
    catch { return $false }
}

function Install-APKToDevice {
    Push-Location $ProjectRoot
    try {
        $apkPath = Join-Path $ProjectRoot "android\app\build\outputs\apk\debug\app-debug.apk"
        
        if (-not (Test-Path $apkPath)) {
            Write-Error "APK not found. Please build the app first (option 3)"
            return
        }
        
        if (-not (Test-AdbInstalled)) {
            Write-Error "adb is not installed or not in PATH"
            Write-Info "Please install Android SDK Platform Tools"
            return
        }
        
        Write-Info "Checking connected devices..."
        $devices = adb devices
        $deviceCount = ($devices | Select-String "device$" | Measure-Object).Count
        
        if ($deviceCount -eq 0) {
            Write-Error "No Android device connected"
            Write-Info "Please connect your device via USB and enable USB debugging"
            return
        }
        
        Write-Info "Installing APK to device..."
        adb install -r $apkPath
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "APK installed successfully"
            Write-Info "Launching app..."
            adb shell am start -n com.nsrcc.tacticalops/.MainActivity
        } else {
            Write-Error "APK installation failed"
        }
    } finally { Pop-Location }
}

function Copy-AppAssets {
    Push-Location $ProjectRoot
    try {
        $logoPath = Join-Path $ProjectRoot "assets\logo.png"
        $splashPath = Join-Path $ProjectRoot "assets\splash.png"
        
        # Copy logo as app icon (Android)
        if (Test-Path $logoPath) {
            $androidIconPath = Join-Path $ProjectRoot "android\app\src\main\res\mipmap-xxxhdpi\ic_launcher.png"
            $androidIconDir = Split-Path $androidIconPath -Parent
            if (-not (Test-Path $androidIconDir)) {
                New-Item -ItemType Directory -Path $androidIconDir -Force | Out-Null
            }
            Copy-Item $logoPath $androidIconPath -Force
            Write-Info "App icon copied to Android"
        } else {
            Write-Warning "logo.png not found, skipping icon copy"
        }
        
        # Copy splash as launch screen (Android)
        if (Test-Path $splashPath) {
            $androidSplashPath = Join-Path $ProjectRoot "android\app\src\main\res\drawable\splash.png"
            $androidSplashDir = Split-Path $androidSplashPath -Parent
            if (-not (Test-Path $androidSplashDir)) {
                New-Item -ItemType Directory -Path $androidSplashDir -Force | Out-Null
            }
            Copy-Item $splashPath $androidSplashPath -Force
            Write-Info "Splash screen copied to Android"
        } else {
            Write-Warning "splash.png not found, skipping splash copy"
        }
        
        # Copy logo as app icon (iOS)
        if (Test-Path $logoPath) {
            $iosIconPath = Join-Path $ProjectRoot "ios\App\App\Assets.xcassets\AppIcon.appiconset\AppIcon.png"
            $iosIconDir = Split-Path $iosIconPath -Parent
            if (Test-Path $iosIconDir) {
                Copy-Item $logoPath $iosIconPath -Force
                Write-Info "App icon copied to iOS"
            }
        }
        
        # Copy splash as launch screen (iOS)
        if (Test-Path $splashPath) {
            $iosSplashPath = Join-Path $ProjectRoot "ios\App\App\Assets.xcassets\Splash.imageset\Splash.png"
            $iosSplashDir = Split-Path $iosSplashPath -Parent
            if (Test-Path $iosSplashDir) {
                Copy-Item $splashPath $iosSplashPath -Force
                Write-Info "Splash screen copied to iOS"
            }
        }
    } finally { Pop-Location }
}

function Build-AndroidApp {
    Push-Location $ProjectRoot
    try {
        Write-Info "Building web project first..."
        pnpm build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Web build failed"
            exit 1
        }
        
        Write-Info "Copying app assets..."
        Copy-AppAssets
        
        Write-Info "Syncing Capacitor..."
        npx cap sync android
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Capacitor sync failed"
            exit 1
        }
        
        Write-Info "Building Android app..."
        Push-Location android
        try {
            .\gradlew assembleDebug
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Android app built successfully"
            } else {
                Write-Error "Android build failed"
                exit 1
            }
        } finally { Pop-Location }
    } finally { Pop-Location }
}

function Build-IOSApp {
    Push-Location $ProjectRoot
    try {
        Write-Info "Building web project first..."
        pnpm build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Web build failed"
            exit 1
        }
        
        Write-Info "Copying app assets..."
        Copy-AppAssets
        
        Write-Info "Syncing Capacitor..."
        npx cap sync ios
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Capacitor sync failed"
            exit 1
        }
        
        Write-Info "Opening Xcode for iOS build..."
        Write-Warning "Please build the app in Xcode (Product > Build or Cmd+B)"
        npx cap open ios
    } finally { Pop-Location }
}

# ============================================================================
# Menu Functions
# ============================================================================

function Show-Menu {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  老挝靶场 - Development Menu" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Development:" -ForegroundColor Cyan
    Write-Host "  1. Start development server" -ForegroundColor Yellow
    Write-Host "  2. Build web project" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Build Apps:" -ForegroundColor Cyan
    Write-Host "  3. Build Android APK" -ForegroundColor Yellow
    Write-Host "  4. Build iOS app (opens Xcode)" -ForegroundColor Yellow
    Write-Host "  5. Install APK to device (adb)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Capacitor:" -ForegroundColor Cyan
    Write-Host "  6. Sync Capacitor" -ForegroundColor Yellow
    Write-Host "  7. Open Android Studio" -ForegroundColor Yellow
    Write-Host "  8. Open Xcode (iOS)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  0. Exit" -ForegroundColor Red
    Write-Host ""
}

function Handle-Choice {
    param([string]$choice)
    
    switch ($choice) {
        "1" { Start-Dev }
        "2" { Build-Project; Read-Host "Press Enter to continue" }
        "3" { Build-AndroidApp; Read-Host "Press Enter to continue" }
        "4" { Build-IOSApp; Read-Host "Press Enter to continue" }
        "5" { Install-APKToDevice; Read-Host "Press Enter to continue" }
        "6" { Sync-Capacitor; Read-Host "Press Enter to continue" }
        "7" { Open-Android; Read-Host "Press Enter to continue" }
        "8" { Open-IOS; Read-Host "Press Enter to continue" }
        "0" { Write-Info "Exiting..."; exit 0 }
        default { Write-Error "Invalid choice"; Read-Host "Press Enter to continue" }
    }
}

# ============================================================================
# Main Execution
# ============================================================================

# Auto setup (runs automatically)
Write-Info "Auto-setting up environment..."
Ensure-Pnpm
Auto-InstallPackages
Auto-SetupCapacitor
Write-Host ""

# Handle direct action or show menu
if ($Action) {
    switch ($Action.ToLower()) {
        "dev" { Start-Dev }
        "build" { Build-Project }
        "build:android" { Build-AndroidApp }
        "build:ios" { Build-IOSApp }
        "install" { Install-APKToDevice }
        "sync" { Sync-Capacitor }
        default { Write-Error "Unknown action: $Action"; exit 1 }
    }
} else {
    while ($true) {
        Clear-Host
        Show-Menu
        $choice = Read-Host "Enter your choice"
        Handle-Choice -choice $choice
    }
}
