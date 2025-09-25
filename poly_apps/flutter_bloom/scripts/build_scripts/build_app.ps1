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

param(
    [string]$appname,
    [switch]$debug
)

# Import shared variables and functions from win_common
$WIN_COMMON_DIR = Join-Path (Split-Path -Parent $PSScriptRoot) "win_common"
. (Join-Path $WIN_COMMON_DIR "FlutterGlobalVar.ps1")
. (Join-Path $WIN_COMMON_DIR "BCommon.ps1")

# Debug mode functions
function Save-DebugSetting {
    param([bool]$IsDebugMode)
    
    $gvarPath = Join-Path $PSScriptRoot ".gvar"
    $debugSetting = "DEBUG_MODE=$IsDebugMode"
    
    # Read existing .gvar content if it exists
    $existingContent = @()
    if (Test-Path $gvarPath) {
        $existingContent = Get-Content $gvarPath
    }
    
    # Remove existing DEBUG_MODE line and add new one
    $updatedContent = $existingContent | Where-Object { $_ -notmatch "^DEBUG_MODE=" }
    $updatedContent += $debugSetting
    
    # Write back to file
    $updatedContent | Set-Content $gvarPath -Encoding UTF8
    
    if ($IsDebugMode) {
        Write-Host "DEBUG MODE ENABLED - Debug setting saved to .gvar" -ForegroundColor Yellow
    } else {
        Write-Host "Debug mode disabled - Setting saved to .gvar" -ForegroundColor Gray
    }
}

function Load-DebugSetting {
    $gvarPath = Join-Path $PSScriptRoot ".gvar"
    
    if (Test-Path $gvarPath) {
        $content = Get-Content $gvarPath
        $debugLine = $content | Where-Object { $_ -match "^DEBUG_MODE=" }
        if ($debugLine) {
            $debugValue = $debugLine -replace "^DEBUG_MODE=", ""
            return [bool]::Parse($debugValue)
        }
    }
    return $false
}

function Write-DebugInfo {
    param([string]$Message)
    
    if ($Global:DebugMode) {
        Write-Host "[DEBUG] $Message" -ForegroundColor Cyan
    }
}

function Confirm-DebugStep {
    param(
        [string]$StepName,
        [string]$Action = "continue"
    )
    
    if ($Global:DebugMode) {
        Write-Host "`n==== DEBUG STEP CONFIRMATION ====" -ForegroundColor Yellow
        Write-Host "Step: $StepName" -ForegroundColor Yellow
        Write-Host "Action: $Action" -ForegroundColor Yellow
        Write-Host "Press 'Y' to continue, 'N' to skip, or 'Q' to quit..." -ForegroundColor Yellow
        
        do {
            $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            $char = $key.Character.ToString().ToUpper()
            
            switch ($char) {
                'Y' { 
                    Write-Host "Y - Continuing..." -ForegroundColor Green
                    return $true
                }
                'N' { 
                    Write-Host "N - Skipping step..." -ForegroundColor Yellow
                    return $false
                }
                'Q' { 
                    Write-Host "Q - Quitting..." -ForegroundColor Red
                    exit 0
                }
                default {
                    Write-Host "`nInvalid key. Press Y/N/Q" -ForegroundColor Red
                }
            }
        } while ($true)
    }
    return $true
}

function Start-DebugStep {
    param([string]$StepName, [string]$Details = "")
    
    if ($Global:DebugMode) {
        Write-Host "`n>>> STARTING STEP: $StepName <<<" -ForegroundColor Green
        if ($Details) {
            Write-DebugInfo "Details: $Details"
        }
        Write-DebugInfo "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        
        if (-not (Confirm-DebugStep -StepName $StepName -Action "start execution")) {
            Write-Warning "Step '$StepName' skipped by user"
            return $false
        }
    }
    return $true
}

function Complete-DebugStep {
    param([string]$StepName, [string]$Result = "completed successfully")
    
    if ($Global:DebugMode) {
        Write-Host "`n<<< COMPLETED STEP: $StepName <<<" -ForegroundColor Blue
        Write-DebugInfo "Result: $Result"
        Write-DebugInfo "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        
        Confirm-DebugStep -StepName $StepName -Action "acknowledge completion"
    }
}

# Function to show app selection menu
function Show-AppSelectionMenu {
    param([string[]]$appNames)
    
    $selectedIndex = 0
    $done = $false
    
    while (-not $done) {
        Clear-Host
        Write-Info "==== Flutter App Selection ===="
        Write-Info "Available apps:"
        Write-Info ""
        
        for ($i = 0; $i -lt $appNames.Count; $i++) {
            if ($i -eq $selectedIndex) {
                Write-Host (" > {0}" -f $appNames[$i]) -BackgroundColor White -ForegroundColor Black
            } else {
                Write-Host ("   {0}" -f $appNames[$i])
            }
        }
        
        Write-Info ""
        Write-Info "Use Up/Down arrows to select, Enter to confirm, CTRL+C to exit."
        
        $key = $null
        while ($null -eq $key) {
            if ([System.Console]::KeyAvailable) {
                $key = [System.Console]::ReadKey($true)
                if ($key.Modifiers -band [System.ConsoleModifiers]::Control -and $key.Key -eq 'C') {
                    Write-Warning "Exiting..."
                    exit 0
                }
            }
        }
        
        switch ($key.Key) {
            'UpArrow'   { 
                $selectedIndex = ($selectedIndex - 1) % $appNames.Count
                if ($selectedIndex -lt 0) { $selectedIndex = $appNames.Count - 1 }
            }
            'DownArrow' { 
                $selectedIndex = ($selectedIndex + 1) % $appNames.Count
            }
            'Enter'     { 
                $done = $true
            }
        }
    }
    
    return $appNames[$selectedIndex]
}

# Function to validate appname
function Test-AppNameExists {
    param([string]$appname)
    
    $libAppsPath = Join-Path $PSScriptRoot "..\..\lib\apps"
    $appDir = Join-Path $libAppsPath "app_$appname"
    
    return Test-Path $appDir
}

# Function to create external assets directory
function Create-ExternalAssetsDirectory {
    param([string]$appname)

    if (-not (Start-DebugStep "Create External Assets Directory" "App: $appname")) {
        return $null
    }

    $externalAssetsDir = Join-Path $Global:programingDir "flutter_assets"
    $appAssetsDir = Join-Path $externalAssetsDir $appname

    Write-DebugInfo "External assets root: $externalAssetsDir"
    Write-DebugInfo "App assets directory: $appAssetsDir"

    # Create main external assets directory
    if (-not (Test-Path $externalAssetsDir)) {
        New-Item -ItemType Directory -Path $externalAssetsDir -Force | Out-Null
        Write-Info "Created external assets directory: $externalAssetsDir"
    }

    # Create app-specific assets directory
    if (-not (Test-Path $appAssetsDir)) {
        New-Item -ItemType Directory -Path $appAssetsDir -Force | Out-Null
        Write-Info "Created app assets directory: $appAssetsDir"
    }

    # Create subdirectories for different asset types based on Flutter development standards
    $subdirs = @(
        "icons",           # App icons and general icons
        "images",          # App images and general images
        "splash",          # Splash screen images (new directory)
        "android_icons",   # Android-specific icons (new directory)
        "ios",             # iOS resources
        "macos",           # macOS resources
        "web",             # Web resources
        "windows",         # Windows resources
        "config"           # Configuration files (new directory)
    )

    foreach ($subdir in $subdirs) {
        $subdirPath = Join-Path $appAssetsDir $subdir
        if (-not (Test-Path $subdirPath)) {
            New-Item -ItemType Directory -Path $subdirPath -Force | Out-Null
            Write-Info "Created subdirectory: $subdirPath"
        }
    }

    # Create example configuration file if config directory is new
    $configDir = Join-Path $appAssetsDir "config"
    $exampleConfigFile = Join-Path $configDir "app_config.json"
    if (-not (Test-Path $exampleConfigFile)) {
        $exampleConfig = @{
            general = @{
                app_name = $appname
            }
            android = @{
                applicationId = "com.example.$appname"
                package = "com.example.$appname"
            }
            ios = @{
                displayName = $appname
                bundleId = "com.example.$appname"
            }
        } | ConvertTo-Json -Depth 3

        [System.IO.File]::WriteAllText($exampleConfigFile, $exampleConfig, [System.Text.Encoding]::UTF8)
        Write-Info "Created example config file: $exampleConfigFile"
    }

    Complete-DebugStep "Create External Assets Directory" "Created $appAssetsDir with subdirectories"
    return $appAssetsDir
}

# Function to run compilation helper scripts
function Invoke-CompilationHelpers {
    param([string]$appname, [string]$externalAssetsDir)

    if (-not (Start-DebugStep "Run Compilation Helper Scripts" "App: $appname, Assets: $externalAssetsDir")) {
        return
    }

    $compilationHelpersScript = Join-Path $PSScriptRoot "compilation_helpers\run_all_helpers.py"

    Write-Info "Running compilation helper scripts..."
    Write-Info "App: $appname"
    Write-Info "External assets directory: $externalAssetsDir"
    Write-DebugInfo "Helper script path: $compilationHelpersScript"

    $flutterRoot = Join-Path $PSScriptRoot "..\.."
    $flutterRoot = Resolve-Path $flutterRoot

    $pythonArgs = @(
        $compilationHelpersScript,
        "--appname", $appname,
        "--external-assets", $externalAssetsDir,
        "--flutter-root", $flutterRoot,
        "--stop-on-error"
    )

    $Commander = "python $($pythonArgs -join ' ')"
    Write-Info "Commander: $Commander"

    & python $pythonArgs

    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Compilation helpers failed with error code: $LASTEXITCODE"
        exit $LASTEXITCODE
    }

    Complete-DebugStep "Run Compilation Helper Scripts" "Python helpers completed successfully"
    Write-Success "Compilation helpers completed successfully."
}

function Prepare-BuildEnvironment {
    if (-not (Start-DebugStep "Prepare Build Environment" "Setting up directories and workspace")) {
        return
    }

    # Debug output
    Write-DebugInfo "Script directory: $scriptDir $($args[0])"
    Write-DebugInfo "Flutter root directory: $flutterRoot"
    Write-DebugInfo "lib directory: $libDir"
    Write-DebugInfo "app_ directories: $appDirs"
    Write-DebugInfo "App names (prefix removed): $appNames"
    Write-DebugInfo "App name: $Global:appname"
    
    # Record the initial working directory
    $script:initialWorkingDir = Get-Location
    Write-DebugInfo "Initial working directory: $script:initialWorkingDir"
    
    # Change to the pybuildscripts directory as the working directory
    Set-Location $Global:pybuildscriptsDir
    Write-Info "Working directory set to: $Global:pybuildscriptsDir"
    
    Complete-DebugStep "Prepare Build Environment" "Environment prepared successfully"
}

function Run-PyPrebuild {
    $prebuildPyScript = Join-Path $PSScriptRoot "pybuildscripts\main.py"
    Write-Info "Executing prebuild_app.ps1..."
    $Commander = "python $prebuildPyScript"
    Write-Info "Commander : $Commander"
    & python $prebuildPyScript
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "prebuild_app.ps1 execution failed with error code: $LASTEXITCODE"
        exit $LASTEXITCODE
    }
}

function PreBuild-Tasks {
    if (-not (Start-DebugStep "Pre-Build Tasks" "Validating app and preparing environment")) {
        return
    }

    # Validate appname
    Write-DebugInfo "Validating appname: $Global:appname"
    if (-not $Global:appname -or $Global:appname -eq '') {
        Write-ErrorMsg "Error: No appname provided"
        Write-Info "Available apps: $($Global:appNames -join ', ')"
        Write-Info "Example usage: .\build_app.ps1 your_app_name"
        exit 1
    }
    Write-Info "Received appname: $Global:appname"
    
    # Validate if appname exists
    Write-DebugInfo "Checking if app exists in directory structure"
    if (-not (Test-ValidAppName -AppName $Global:appname)) {
        Write-ErrorMsg "Error: Invalid appname '$Global:appname'. Available apps: $($Global:appNames -join ', ')"
        Write-Info "Example usage: .\build_app.ps1 your_app_name"
        exit 1
    }
    
    # Set workspace root
    $workspaceRoot = Join-Path $PSScriptRoot ".."
    $workspaceRoot = Join-Path $workspaceRoot ".."
    $workspaceRoot = Resolve-Path $workspaceRoot
    $script:workspaceRoot = $workspaceRoot
    Write-DebugInfo "Workspace root set to: $workspaceRoot"
    
    Write-Info "Executing pre-build preparation..."
    
    # Check Python installation
    Write-DebugInfo "Verifying Python installation"
    & python --version
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Error: Python not found. Please ensure Python is installed and added to system PATH."
        exit 1
    }
    
    # Install Python packages
    $installPackagesScript = Join-Path $PSScriptRoot "pybuildscripts\installer_py_package\install_pypackages.ps1"
    Write-DebugInfo "Installing Python packages from: $installPackagesScript"
    Write-Info "Installing required Python packages..."
    & powershell -ExecutionPolicy Bypass -File $installPackagesScript
    
    Complete-DebugStep "Pre-Build Tasks" "App validation and environment preparation completed"
    Write-Success "Pre-build preparation completed."
}

function Invoke-AppBuildSteps {
    if (-not (Start-DebugStep "App Build Steps" "Building Flutter app: $Global:appname")) {
        return
    }

    $buildStartTime = Get-Date
    Write-DebugInfo "Build started at: $buildStartTime"
    
    # Use the current Flutter project directory for building
    $appBuildDir = $Global:flutterRoot
    Write-DebugInfo "Flutter project directory: $appBuildDir"
    
    if (-not (Test-Path $appBuildDir)) {
        Write-Host "Error: Flutter project directory does not exist: $appBuildDir" -ForegroundColor Red
        exit 1
    }
    
    Set-Location $appBuildDir
    Write-Host "Building in Flutter project directory: $appBuildDir" -ForegroundColor Yellow
    
    # Continue with build steps in this directory
    # Run flutter clean first
    if (Confirm-DebugStep "Flutter Clean" "clean build cache") {
        Write-Warning "`nRunning flutter clean By {$appBuildDir}..."
        $Commander = "flutter clean"
        Write-Info "Commander : $Commander"
        Write-DebugInfo "Executing: $Commander"
        & flutter clean
        Write-DebugInfo "Flutter clean completed with exit code: $LASTEXITCODE"
    }
    
    # Run flutter pub get
    if (Confirm-DebugStep "Flutter Pub Get" "download dependencies") {
        Write-Warning "`nRunning flutter pub get By {$appBuildDir}..."
        $Commander = "flutter pub get"
        Write-Info "Commander : $Commander"
        Write-DebugInfo "Executing: $Commander"
        & flutter pub get
        Write-DebugInfo "Flutter pub get completed with exit code: $LASTEXITCODE"
    }
    
    # Build for Android
    if (Confirm-DebugStep "Android APK Build" "build release APK") {
        Write-Warning "`nBuilding Android APK By {$appBuildDir}..."
        $Commander = "flutter build apk --release"
        Write-Info "Commander : $Commander"
        Write-DebugInfo "Executing: $Commander"
        & flutter build apk --release
        Write-DebugInfo "Android APK build completed with exit code: $LASTEXITCODE"
    }
    
    # Build for iOS
    if (Confirm-DebugStep "iOS App Build" "build release iOS app") {
        Write-Warning "`nBuilding iOS App By {$appBuildDir}..."
        $Commander = "flutter build ios --release"
        Write-Info "Commander : $Commander"
        Write-DebugInfo "Executing: $Commander"
        & flutter build ios --release
        Write-DebugInfo "iOS app build completed with exit code: $LASTEXITCODE"
    }
    
    # Show build success and APK location
    $apkPath = Join-Path $appBuildDir "build\app\outputs\flutter-apk\app-release.apk"
    Write-DebugInfo "Checking for APK at: $apkPath"
    
    if (Test-Path $apkPath) {
        Write-Success "`nBuild completed successfully!"
        Write-Success "APK location: $apkPath"
        # Get APK file size
        $apkSize = (Get-Item $apkPath).Length / 1MB
        Write-Success "APK size: $([math]::Round($apkSize, 2)) MB"
        Write-DebugInfo "APK size in bytes: $((Get-Item $apkPath).Length)"
        
        # Copy APK to static resources dir with timestamped name
        $targetDir = Join-Path $Global:BuildAppsStaticResourcesDir ("${Global:appname}_release")
        Write-DebugInfo "Target directory: $targetDir"
        
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir | Out-Null
            Write-DebugInfo "Created target directory: $targetDir"
        }
        
        $targetFile = Join-Path $targetDir (Get-ApkFileName $Global:appname)
        Write-DebugInfo "Copying APK to: $targetFile"
        Copy-FileForce -src $apkPath -out $targetFile
        Write-Success "Copied APK to: $targetFile"
    } else {
        Write-Warning "`nBuild completed but APK not found at expected location: $apkPath"
        Write-DebugInfo "APK file not found - build may have failed"
    }
    
    $buildEndTime = Get-Date
    $elapsed = $buildEndTime - $buildStartTime
    Write-DebugInfo "Build ended at: $buildEndTime"
    Write-DebugInfo "Total elapsed time: $($elapsed.ToString())"
    Write-Info ("Total build time: {0} seconds" -f [math]::Round($elapsed.TotalSeconds, 2))
    
    Complete-DebugStep "App Build Steps" "Flutter app build process completed"
}

# Main execution logic
try {
    # Initialize debug mode
    $Global:DebugMode = $debug.IsPresent
    if ($Global:DebugMode) {
        Save-DebugSetting -IsDebugMode $true
        Write-Host "DEBUG MODE ENABLED" -ForegroundColor Yellow
        Write-DebugInfo "Script started with debug mode enabled"
        Write-DebugInfo "Debug parameter: $debug"
        Write-DebugInfo "Script location: $PSScriptRoot"
        
        if (-not (Confirm-DebugStep "Script Initialization" "start build script execution")) {
            Write-Warning "Build script execution cancelled by user"
            exit 0
        }
    } else {
        # Check if debug mode was previously saved
        $savedDebugMode = Load-DebugSetting
        if ($savedDebugMode) {
            $Global:DebugMode = $true
            Write-Host "Debug mode loaded from .gvar settings" -ForegroundColor Yellow
        } else {
            Save-DebugSetting -IsDebugMode $false
        }
    }
    
    # Check if appname parameter was provided
    if (-not $appname -or $appname -eq '') {
        Write-Info "No appname provided. Showing build configuration menu..."
        
        # Update menu with provided appname if any
        if ($appname -and $appname -ne '') {
            # Find the appname in the list and set as default
            $appIndex = [array]::IndexOf($Global:appNames, $appname)
            if ($appIndex -ge 0) {
                $Global:MenuGroups[0].Default = $appname
            }
        }
        
        # Show interactive menu
        Show-MenuGroups -MenuGroups $Global:MenuGroups
        $appname = Get-AppName
        
        Write-Success "Selected configuration:"
        Write-Info "  App: $appname"
        Write-Info "  App Display Name: $(Get-FileVariable -Name "$Global:KEY_APPDISPLAYNAME_PREFIX$appname")"
        Write-Info "  APP ID: $(Get-FileVariable -Name "$Global:KEY_APPID_PREFIX$appname")"
        Write-Info "  Build Options: $(Get-FileVariable -Name "$Global:KEY_BUILDOPTIONS_PREFIX$appname")"
        Write-Info "  Image Compression: $(Get-FileVariable -Name "$Global:KEY_IMAGECOMPRESSION_PREFIX$appname")"
    } else {
        # Validate provided appname
        if (-not (Test-AppNameExists -appname $appname)) {
            Write-ErrorMsg "Error: App '$appname' does not exist."
            
            Write-Info "Available apps: $($Global:appNames -join ', ')"
            exit 1
        }
        
        Write-Success "Using provided appname: $appname"
        Set-AppName -appname $appname
    }
    
    # Set global appname
    $Global:appname = $appname
    
    # Create external assets directory
    $externalAssetsDir = Create-ExternalAssetsDirectory -appname $appname
    
    # Set environment variables for Python scripts based on menu selections
    $appIDMode = Get-FileVariable -Name "$Global:KEY_APPID_PREFIX$appname"
    $imageCompression = Get-FileVariable -Name "$Global:KEY_IMAGECOMPRESSION_PREFIX$appname"
    $appDisplayNameMode = Get-FileVariable -Name "$Global:KEY_APPDISPLAYNAME_PREFIX$appname"
    
    # Set environment variables
    $env:USE_RANDOM_ID = if ($appIDMode -eq 'Generate Random ID') { 'true' } else { 'false' }
    $env:IMAGE_COMPRESSION = if ($imageCompression -eq 'No Compression') { 'disabled' } else { 'enabled' }
    $env:APP_DISPLAY_MODE = if ($appDisplayNameMode) { $appDisplayNameMode } else { 'Random Generate' }
    
    # Handle manual input for display name
    if ($appDisplayNameMode -eq 'Manual Input') {
        $manualDisplayName = Request-ManualAppDisplayName -appname $appname
        $env:APP_DISPLAY_MANUAL_NAME = $manualDisplayName
        Write-Info "Manual display name entered: $manualDisplayName"
    }
    
    Write-Info "Environment variables set:"
    Write-Info "  USE_RANDOM_ID: $env:USE_RANDOM_ID"
    Write-Info "  IMAGE_COMPRESSION: $env:IMAGE_COMPRESSION"
    Write-Info "  APP_DISPLAY_MODE: $env:APP_DISPLAY_MODE"
    if ($env:APP_DISPLAY_MANUAL_NAME) {
        Write-Info "  APP_DISPLAY_MANUAL_NAME: $env:APP_DISPLAY_MANUAL_NAME"
    }
    
    # Run compilation helper scripts
    Invoke-CompilationHelpers -appname $appname -externalAssetsDir $externalAssetsDir
    
    # Continue with existing build logic
    Prepare-BuildEnvironment
    PreBuild-Tasks
    # Skip old Python prebuild as we now use compilation helpers
    # Run-PyPrebuild
    Invoke-AppBuildSteps
    
    # Open build output directory in explorer after compilation
    $buildOutputDir = Join-Path $Global:flutterRoot "build"
    if (Test-Path $buildOutputDir) {
        Write-Info "Opening build output directory in explorer: $buildOutputDir"
        Start-Process "explorer.exe" -ArgumentList $buildOutputDir
    }
    
    # Final debug confirmation
    if ($Global:DebugMode) {
        Write-Host "BUILD SCRIPT COMPLETED" -ForegroundColor Green
        Complete-DebugStep "Build Script Execution" "All build operations completed successfully"
    }
    
} catch {
    Write-ErrorMsg "Error: $_"
    exit 1
} finally {
    # Return to the initial directory
    if ($script:initialWorkingDir) {
        Write-Success "Returning to initial directory: $script:initialWorkingDir"
        Set-Location $script:initialWorkingDir
    }
}
