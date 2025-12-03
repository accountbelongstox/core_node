# HoloFortune React Native Startup Script (PowerShell)
# Set console encoding to UTF-8
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   HoloFortune React Native Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Detect package manager
$packageManager = "npm"
if (Get-Command "pnpm" -ErrorAction SilentlyContinue) {
    $packageManager = "pnpm"
    Write-Host "Using pnpm as package manager" -ForegroundColor Green
} elseif (Get-Command "yarn" -ErrorAction SilentlyContinue) {
    $packageManager = "yarn"
    Write-Host "Using yarn as package manager" -ForegroundColor Green
} else {
    Write-Host "Using npm as package manager" -ForegroundColor Yellow
}
Write-Host ""

# Check and fix JAVA_HOME
function Fix-JavaHome {
    $currentJavaHome = $env:JAVA_HOME
    if ($currentJavaHome) {
        # Remove trailing \bin if present
        if ($currentJavaHome.EndsWith("\bin")) {
            $env:JAVA_HOME = $currentJavaHome.Substring(0, $currentJavaHome.Length - 4)
            Write-Host "Fixed JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Yellow
        }
        # Check if JAVA_HOME is valid
        if (-not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
            Write-Host "JAVA_HOME is invalid, attempting to find Java..." -ForegroundColor Yellow
            $env:JAVA_HOME = $null
        }
    }
    
    # If JAVA_HOME is not set or invalid, try to find it
    if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
        Write-Host "Searching for Java installation..." -ForegroundColor Yellow
        
        # Common Java installation paths
        $javaPaths = @(
            "${env:ProgramFiles}\Java",
            "${env:ProgramFiles(x86)}\Java",
            "C:\Program Files\Java",
            "C:\Program Files (x86)\Java",
            "${env:LOCALAPPDATA}\Programs\Android\Android Studio\jbr",
            "${env:ProgramFiles}\Android\Android Studio\jbr",
            "C:\Program Files\Android\Android Studio\jbr"
        )
        
        $foundJava = $false
        foreach ($basePath in $javaPaths) {
            if (Test-Path $basePath) {
                $jdkDirs = Get-ChildItem -Path $basePath -Directory -ErrorAction SilentlyContinue | 
                    Where-Object { $_.Name -like "jdk*" -or $_.Name -like "jbr*" } |
                    Sort-Object Name -Descending
                
                foreach ($jdkDir in $jdkDirs) {
                    $javaExe = Join-Path $jdkDir.FullName "bin\java.exe"
                    if (Test-Path $javaExe) {
                        $env:JAVA_HOME = $jdkDir.FullName
                        Write-Host "Found Java: $env:JAVA_HOME" -ForegroundColor Green
                        $foundJava = $true
                        break
                    }
                }
                if ($foundJava) { break }
            }
        }
        
        if (-not $foundJava) {
            Write-Host "Java not found automatically. Please set JAVA_HOME manually." -ForegroundColor Red
            Write-Host "Example: `$env:JAVA_HOME = 'C:\Program Files\Java\jdk-17'" -ForegroundColor Yellow
            return $false
        }
    } else {
        Write-Host "JAVA_HOME is set correctly: $env:JAVA_HOME" -ForegroundColor Green
    }
    return $true
}

# Fix JAVA_HOME before proceeding
$javaOk = Fix-JavaHome
if (-not $javaOk) {
    Write-Host ""
    Write-Host "Warning: Java environment may not be configured correctly." -ForegroundColor Yellow
    Write-Host "You can continue, but Android builds may fail." -ForegroundColor Yellow
    Write-Host ""
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules not found, installing dependencies..." -ForegroundColor Yellow
    Write-Host ""
    & $packageManager install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies!" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
    Write-Host "Dependencies installed successfully!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Dependencies already exist, checking essential packages..." -ForegroundColor Green
    # Check if react-native is installed
    $reactNativeInstalled = Test-Path (Join-Path $PWD "node_modules\react-native")
    $reactNativeBin = Test-Path (Join-Path $PWD "node_modules\.bin\react-native.CMD")
    
    if (-not $reactNativeInstalled -or -not $reactNativeBin) {
        Write-Host "react-native or its binaries not found, installing..." -ForegroundColor Yellow
        & $packageManager add react-native
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to install react-native!" -ForegroundColor Red
            exit 1
        }
        Write-Host "react-native installed successfully!" -ForegroundColor Green
    }
    Write-Host ""
}

# Display menu
Write-Host "Please select a mode:" -ForegroundColor Yellow
Write-Host "1. Debug Mode - Start Metro bundler and dev server" -ForegroundColor White
Write-Host "2. Run Android - Build and run on connected Android device/emulator" -ForegroundColor White
Write-Host "3. Build Android Debug - Build Android Debug APK" -ForegroundColor White
Write-Host "4. Build Android Release - Build Android Release APK" -ForegroundColor White
Write-Host "5. Start Metro Only - Start Metro bundler only" -ForegroundColor White
Write-Host "6. Clean & Reinstall - Clean and reinstall dependencies" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter option (1-6)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Starting debug mode..." -ForegroundColor Green
        Write-Host ""
        # Run react-native using the best available method
        $reactNativeBin = Join-Path $PWD "node_modules\.bin\react-native.CMD"
        $reactNativePs1 = Join-Path $PWD "node_modules\.bin\react-native.ps1"
        if (Test-Path $reactNativeBin) {
            & $reactNativeBin start
        } elseif (Test-Path $reactNativePs1) {
            & $reactNativePs1 start
        } elseif ($packageManager -eq "pnpm") {
            pnpm exec react-native start
        } elseif ($packageManager -eq "yarn") {
            yarn react-native start
        } else {
            npx react-native start
        }
    }
    "2" {
        Write-Host ""
        Write-Host "Running Android app on connected device..." -ForegroundColor Green
        Write-Host ""
        
        # Ensure JAVA_HOME is set correctly
        Fix-JavaHome | Out-Null
        
        Write-Host "Checking for connected devices..." -ForegroundColor Yellow
        $adbDevices = adb devices 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ADB not found. Please install Android SDK Platform Tools." -ForegroundColor Red
            Write-Host "You can install it via Android Studio SDK Manager." -ForegroundColor Yellow
            exit 1
        }
        $deviceCount = ($adbDevices | Select-String "device$" | Measure-Object).Count
        if ($deviceCount -eq 0) {
            Write-Host "No Android devices found!" -ForegroundColor Red
            Write-Host "Please connect a device via USB or start an emulator." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "To check devices manually, run: adb devices" -ForegroundColor Gray
            Write-Host "To start an emulator, open Android Studio > AVD Manager" -ForegroundColor Gray
            exit 1
        }
        Write-Host "Found $deviceCount device(s). Starting app..." -ForegroundColor Green
        Write-Host ""
        # Run react-native using the best available method
        $reactNativeBin = Join-Path $PWD "node_modules\.bin\react-native.CMD"
        $reactNativePs1 = Join-Path $PWD "node_modules\.bin\react-native.ps1"
        if (Test-Path $reactNativeBin) {
            & $reactNativeBin run-android
        } elseif (Test-Path $reactNativePs1) {
            & $reactNativePs1 run-android
        } elseif ($packageManager -eq "pnpm") {
            pnpm exec react-native run-android
        } elseif ($packageManager -eq "yarn") {
            yarn react-native run-android
        } else {
            npx react-native run-android
        }
    }
    "3" {
        Write-Host ""
        Write-Host "Building Android Debug APK..." -ForegroundColor Green
        Write-Host ""
        Push-Location android
        if (Test-Path "gradlew.bat") {
            & .\gradlew.bat assembleDebug
        } else {
            & .\gradlew assembleDebug
        }
        $exitCode = $LASTEXITCODE
        Pop-Location
        if ($exitCode -ne 0) {
            Write-Host "Build failed!" -ForegroundColor Red
            exit 1
        }
        Write-Host ""
        Write-Host "Build completed! APK location: android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Green
    }
    "4" {
        Write-Host ""
        Write-Host "Building Android Release APK..." -ForegroundColor Green
        Write-Host ""
        Push-Location android
        if (Test-Path "gradlew.bat") {
            & .\gradlew.bat assembleRelease
        } else {
            & .\gradlew assembleRelease
        }
        $exitCode = $LASTEXITCODE
        Pop-Location
        if ($exitCode -ne 0) {
            Write-Host "Build failed!" -ForegroundColor Red
            exit 1
        }
        Write-Host ""
        Write-Host "Build completed! APK location: android\app\build\outputs\apk\release\app-release.apk" -ForegroundColor Green
    }
    "5" {
        Write-Host ""
        Write-Host "Starting Metro bundler..." -ForegroundColor Green
        Write-Host ""
        # Run react-native using the best available method
        $reactNativeBin = Join-Path $PWD "node_modules\.bin\react-native.CMD"
        $reactNativePs1 = Join-Path $PWD "node_modules\.bin\react-native.ps1"
        if (Test-Path $reactNativeBin) {
            & $reactNativeBin start
        } elseif (Test-Path $reactNativePs1) {
            & $reactNativePs1 start
        } elseif ($packageManager -eq "pnpm") {
            pnpm exec react-native start
        } elseif ($packageManager -eq "yarn") {
            yarn react-native start
        } else {
            npx react-native start
        }
    }
    "6" {
        Write-Host ""
        Write-Host "Cleaning and reinstalling..." -ForegroundColor Yellow
        Write-Host ""
        
        # Remove node_modules
        if (Test-Path "node_modules") {
            Write-Host "Removing node_modules..." -ForegroundColor Yellow
            Remove-Item -Recurse -Force "node_modules"
        }
        
        # Remove lock files
        if (Test-Path "package-lock.json") {
            Write-Host "Removing package-lock.json..." -ForegroundColor Yellow
            Remove-Item -Force "package-lock.json"
        }
        if (Test-Path "pnpm-lock.yaml") {
            Write-Host "Removing pnpm-lock.yaml..." -ForegroundColor Yellow
            Remove-Item -Force "pnpm-lock.yaml"
        }
        if (Test-Path "yarn.lock") {
            Write-Host "Removing yarn.lock..." -ForegroundColor Yellow
            Remove-Item -Force "yarn.lock"
        }
        
        # Remove iOS Pods if exists
        if (Test-Path "ios\Pods") {
            Write-Host "Removing iOS Pods..." -ForegroundColor Yellow
            Remove-Item -Recurse -Force "ios\Pods"
        }
        
        # Remove build directories
        if (Test-Path "android\build") {
            Write-Host "Removing Android build directory..." -ForegroundColor Yellow
            Remove-Item -Recurse -Force "android\build"
        }
        
        if (Test-Path "android\app\build") {
            Write-Host "Removing Android app build directory..." -ForegroundColor Yellow
            Remove-Item -Recurse -Force "android\app\build"
        }
        
        if (Test-Path "ios\build") {
            Write-Host "Removing iOS build directory..." -ForegroundColor Yellow
            Remove-Item -Recurse -Force "ios\build"
        }
        
        Write-Host "Reinstalling dependencies..." -ForegroundColor Yellow
        Write-Host ""
        & $packageManager install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to install dependencies!" -ForegroundColor Red
            exit 1
        }
        
        # Install iOS dependencies if macOS
        if ($IsMacOS -or (Test-Path "ios")) {
            Write-Host ""
            Write-Host "iOS directory detected. Install CocoaPods dependencies? (y/n)" -ForegroundColor Yellow
            $installPods = Read-Host
            if ($installPods -eq "y" -or $installPods -eq "Y") {
                Push-Location ios
                pod install
                Pop-Location
            }
        }
        
        Write-Host ""
        Write-Host "Clean completed!" -ForegroundColor Green
        Write-Host ""
    }
    default {
        Write-Host ""
        Write-Host "Invalid option, exiting." -ForegroundColor Red
        Write-Host ""
        exit 1
    }
}

# Helper function to show debug instructions
function Show-DebugInstructions {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   Debug Instructions" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Make sure Metro bundler is running (option 1 or 5)" -ForegroundColor Yellow
    Write-Host "2. Connect your Android device via USB or start an emulator" -ForegroundColor Yellow
    Write-Host "3. Enable USB debugging on your device:" -ForegroundColor Yellow
    Write-Host "   - Settings > About Phone > Tap Build Number 7 times" -ForegroundColor Gray
    Write-Host "   - Settings > Developer Options > Enable USB Debugging" -ForegroundColor Gray
    Write-Host "4. Run the app using option 2, or manually:" -ForegroundColor Yellow
    Write-Host "   pnpm exec react-native run-android" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Debug Commands (when app is running):" -ForegroundColor Cyan
    Write-Host "  r - Reload app" -ForegroundColor White
    Write-Host "  d - Open Dev Menu" -ForegroundColor White
    Write-Host "  j - Open DevTools" -ForegroundColor White
    Write-Host "  Ctrl+C - Stop Metro bundler" -ForegroundColor White
    Write-Host ""
}

# Show instructions if Metro is running
if ($choice -eq "1" -or $choice -eq "5") {
    Show-DebugInstructions
}
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
