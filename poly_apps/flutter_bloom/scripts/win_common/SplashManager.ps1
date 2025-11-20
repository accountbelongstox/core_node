# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Flutter Bloom - Splash Manager Library (PowerShell Wrapper)
# This library provides PowerShell wrapper for Python-based splash screen management

# Import required modules
. (Join-Path $PSScriptRoot "FlutterGlobalVar.ps1")
. (Join-Path $PSScriptRoot "BCommon.ps1")

# Variable declarations
$Global:CommonSplashConfigFile = "flutter_native_splash.yaml"
$Global:PythonSplashManager = Join-Path (Split-Path $PSScriptRoot -Parent) "build_scripts\utils\splash_manager.py"
$Global:PubspecCacheDir = Join-Path (Split-Path $PSScriptRoot -Parent) ".pubspec_cache"
$Global:PubspecHashFile = "pubspec_hash.txt"

function Get-PubspecHash {
    <#
    .SYNOPSIS
    Calculate hash of pubspec.yaml file

    .PARAMETER PubspecPath
    Path to pubspec.yaml file

    .RETURNS
    Hash string of the file content
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$PubspecPath
    )

    if (-not (Test-Path $PubspecPath)) {
        return $null
    }

    try {
        $content = Get-Content $PubspecPath -Raw -ErrorAction Stop
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
        $hashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
        $hashBytes = $hashAlgorithm.ComputeHash($bytes)
        $hashString = [System.BitConverter]::ToString($hashBytes) -replace '-', ''
        return $hashString
    } catch {
        Write-ColorMessage -Message "[PUBSPEC-CACHE] Error calculating hash: $($_.Exception.Message)" -Type "Error"
        return $null
    }
}

function Test-PubspecChanged {
    <#
    .SYNOPSIS
    Check if pubspec.yaml has changed since last pub get

    .PARAMETER ProjectRoot
    Project root directory containing pubspec.yaml

    .RETURNS
    Boolean - $true if changed or first run, $false if unchanged
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$ProjectRoot
    )

    $pubspecPath = Join-Path $ProjectRoot "pubspec.yaml"

    if (-not (Test-Path $pubspecPath)) {
        Write-ColorMessage -Message "[PUBSPEC-CACHE] pubspec.yaml not found at: $pubspecPath" -Type "Warning"
        return $true
    }

    $currentHash = Get-PubspecHash -PubspecPath $pubspecPath

    if (-not $currentHash) {
        Write-ColorMessage -Message "[PUBSPEC-CACHE] Failed to calculate current hash, will run pub get" -Type "Warning"
        return $true
    }

    $cacheDir = $Global:PubspecCacheDir
    $hashFilePath = Join-Path $cacheDir $Global:PubspecHashFile

    if (-not (Test-Path $cacheDir)) {
        New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
    }

    if (-not (Test-Path $hashFilePath)) {
        Write-ColorMessage -Message "[PUBSPEC-CACHE] No previous hash found, first run detected" -Type "Info"
        Set-Content -Path $hashFilePath -Value $currentHash -Force
        return $true
    }

    try {
        $previousHash = Get-Content $hashFilePath -Raw -ErrorAction Stop
        $previousHash = $previousHash.Trim()

        if ($currentHash -eq $previousHash) {
            Write-ColorMessage -Message "[PUBSPEC-CACHE] pubspec.yaml unchanged, skipping pub get" -Type "Success"
            return $false
        } else {
            Write-ColorMessage -Message "[PUBSPEC-CACHE] pubspec.yaml changed, will run pub get" -Type "Info"
            Set-Content -Path $hashFilePath -Value $currentHash -Force
            return $true
        }
    } catch {
        Write-ColorMessage -Message "[PUBSPEC-CACHE] Error reading previous hash: $($_.Exception.Message)" -Type "Error"
        return $true
    }
}

function Test-BuildPubspecChanged {
    <#
    .SYNOPSIS
    Check if pubspec.yaml has changed for build mode (compares with source project)

    .PARAMETER SourceRoot
    Source Flutter project root directory

    .RETURNS
    Boolean - $true if changed or first run, $false if unchanged
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$SourceRoot
    )

    $pubspecPath = Join-Path $SourceRoot "pubspec.yaml"

    if (-not (Test-Path $pubspecPath)) {
        Write-ColorMessage -Message "[PUBSPEC-CACHE] pubspec.yaml not found at: $pubspecPath" -Type "Warning"
        return $true
    }

    $currentHash = Get-PubspecHash -PubspecPath $pubspecPath

    if (-not $currentHash) {
        Write-ColorMessage -Message "[PUBSPEC-CACHE] Failed to calculate current hash, will run pub get" -Type "Warning"
        return $true
    }

    $cacheDir = $Global:PubspecCacheDir
    $buildHashFile = Join-Path $cacheDir "build_pubspec_hash.txt"

    if (-not (Test-Path $cacheDir)) {
        New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
    }

    if (-not (Test-Path $buildHashFile)) {
        Write-ColorMessage -Message "[PUBSPEC-CACHE] No previous build hash found, first build detected" -Type "Info"
        Set-Content -Path $buildHashFile -Value $currentHash -Force
        return $true
    }

    try {
        $previousHash = Get-Content $buildHashFile -Raw -ErrorAction Stop
        $previousHash = $previousHash.Trim()

        if ($currentHash -eq $previousHash) {
            Write-ColorMessage -Message "[PUBSPEC-CACHE] pubspec.yaml unchanged since last build" -Type "Success"
            return $false
        } else {
            Write-ColorMessage -Message "[PUBSPEC-CACHE] pubspec.yaml changed, will run pub get" -Type "Info"
            Set-Content -Path $buildHashFile -Value $currentHash -Force
            return $true
        }
    } catch {
        Write-ColorMessage -Message "[PUBSPEC-CACHE] Error reading previous hash: $($_.Exception.Message)" -Type "Error"
        return $true
    }
}

function Copy-PubCache {
    <#
    .SYNOPSIS
    Copy .pub-cache directory from source to target for build optimization

    .PARAMETER SourceRoot
    Source Flutter project root directory

    .PARAMETER TargetRoot
    Target build directory

    .RETURNS
    Boolean - $true if successful, $false if failed
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$SourceRoot,

        [Parameter(Mandatory=$true)]
        [string]$TargetRoot
    )

    $sourcePubCache = Join-Path $SourceRoot ".pub-cache"
    $targetPubCache = Join-Path $TargetRoot ".pub-cache"

    if (-not (Test-Path $sourcePubCache)) {
        Write-ColorMessage -Message "[PUBSPEC-CACHE] Source .pub-cache not found: $sourcePubCache" -Type "Warning"
        return $false
    }

    try {
        Write-ColorMessage -Message "[PUBSPEC-CACHE] Copying .pub-cache from source to build directory..." -Type "Info"

        if (Test-Path $targetPubCache) {
            Remove-Item -Path $targetPubCache -Recurse -Force -ErrorAction Stop
        }

        Copy-Item -Path $sourcePubCache -Destination $targetPubCache -Recurse -Force -ErrorAction Stop

        Write-ColorMessage -Message "[PUBSPEC-CACHE] Successfully copied .pub-cache to build directory" -Type "Success"
        return $true
    } catch {
        Write-ColorMessage -Message "[PUBSPEC-CACHE] Failed to copy .pub-cache: $($_.Exception.Message)" -Type "Error"
        return $false
    }
}

function Set-BuildPubspecSkipFlag {
    <#
    .SYNOPSIS
    Set flag file to indicate pub get should be skipped in build scripts

    .PARAMETER TargetRoot
    Target build directory

    .RETURNS
    Boolean - $true if successful, $false if failed
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$TargetRoot
    )

    try {
        $flagFile = Join-Path $TargetRoot ".skip_pub_get"
        Set-Content -Path $flagFile -Value "SKIP_PUB_GET=true" -Force
        Write-ColorMessage -Message "[PUBSPEC-CACHE] Created skip pub get flag: $flagFile" -Type "Info"
        return $true
    } catch {
        Write-ColorMessage -Message "[PUBSPEC-CACHE] Failed to create skip flag: $($_.Exception.Message)" -Type "Error"
        return $false
    }
}

function Invoke-PythonSplashUpdate {
    <#
    .SYNOPSIS
    Call Python splash manager to update splash configuration using file variable system

    .RETURNS
    Boolean indicating success or failure
    #>

    # Read variables from file variable system (like BCommon.ps1)
    $selectedApp = Get-FileVariable -Name $Global:KEY_SELECTED_APP -DefaultValue ""
    $selectedAction = Get-FileVariable -Name $Global:KEY_SELECTED_ACTION -DefaultValue ""
    $selectedPlatform = Get-FileVariable -Name $Global:KEY_SELECTED_PLATFORM -DefaultValue ""
    $selectedEntryFile = Get-FileVariable -Name $Global:KEY_SELECTED_ENTRY_FILE -DefaultValue ""
    $appIndex = Get-FileVariable -Name $Global:KEY_APP_INDEX -DefaultValue ""
    $debugPort = Get-FileVariable -Name $Global:KEY_DEBUG_PORT -DefaultValue ""
    $scriptPath = Get-FileVariable -Name $Global:KEY_SCRIPT_PATH -DefaultValue ""

    if (-not $selectedApp) {
        Write-ColorMessage -Message "[SPLASH-PY] No app selected in file variables" -Type "Warning"
        return $false
    }

    Write-ColorMessage -Message "[SPLASH-PY] Starting Python splash update for app: $selectedApp" -Type "Info"

    # Check if Python is available
    if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
        Write-ColorMessage -Message "[SPLASH-PY] Python command not found in PATH" -Type "Error"
        return $false
    }

    # Check if Python splash manager exists
    if (-not (Test-Path $Global:PythonSplashManager)) {
        Write-ColorMessage -Message "[SPLASH-PY] Python splash manager not found: $Global:PythonSplashManager" -Type "Error"
        return $false
    }

    # No need to pass parameters - Python will read from file variable system
    try {
        # Call Python splash manager - uses file variable system (no arguments)
        $command = "python `"$Global:PythonSplashManager`""
        Write-ColorMessage -Message "[SPLASH-PY] Executing: $command" -Type "Command"
        Write-ColorMessage -Message "[SPLASH-PY] Python will read app from file variables (KEY_SELECTED_APP = $selectedApp)" -Type "Info"

        $result = Invoke-Expression $command
        $exitCode = $LASTEXITCODE

        if ($exitCode -eq 0) {
            Write-ColorMessage -Message "[SPLASH-PY] Python splash update completed successfully" -Type "Success"
            return $true
        } else {
            Write-ColorMessage -Message "[SPLASH-PY] Python splash update failed with exit code: $exitCode" -Type "Error"
            return $false
        }

    } catch {
        Write-ColorMessage -Message "[SPLASH-PY] Error executing Python splash update: $($_.Exception.Message)" -Type "Error"
        return $false
    }
}

function Invoke-FlutterNativeSplash {
    <#
    .SYNOPSIS
    Execute flutter_native_splash generate command using file variable system

    .RETURNS
    Boolean indicating success or failure
    #>

    # Read variables from file variable system (like BCommon.ps1)
    $selectedApp = Get-FileVariable -Name $Global:KEY_SELECTED_APP -DefaultValue ""
    $selectedAction = Get-FileVariable -Name $Global:KEY_SELECTED_ACTION -DefaultValue ""
    $selectedPlatform = Get-FileVariable -Name $Global:KEY_SELECTED_PLATFORM -DefaultValue ""
    $selectedEntryFile = Get-FileVariable -Name $Global:KEY_SELECTED_ENTRY_FILE -DefaultValue ""
    $appIndex = Get-FileVariable -Name $Global:KEY_APP_INDEX -DefaultValue ""
    $debugPort = Get-FileVariable -Name $Global:KEY_DEBUG_PORT -DefaultValue ""
    $scriptPath = Get-FileVariable -Name $Global:KEY_SCRIPT_PATH -DefaultValue ""

    if (-not $scriptPath) {
        Write-ColorMessage -Message "[SPLASH-FLUTTER] No script path found in file variables" -Type "Warning"
        return $false
    }

    # Get project root from script path directory (2 levels up)
    $projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $scriptPath))

    Write-ColorMessage -Message "[SPLASH-FLUTTER] Running flutter_native_splash generate..." -Type "Info"

    # Change to project root directory
    Push-Location $projectRoot

    try {
        # Check if flutter command is available
        if (-not (Get-Command "flutter" -ErrorAction SilentlyContinue)) {
            Write-ColorMessage -Message "[SPLASH-FLUTTER] Flutter command not found in PATH" -Type "Error"
            Pop-Location
            return $false
        }

        # Check if we need to run flutter pub get
        $isDebugMode = Test-IsDebugMode
        $needsPubGet = $true

        if ($isDebugMode) {
            $pubspecChanged = Test-PubspecChanged -ProjectRoot $projectRoot
            $needsPubGet = $pubspecChanged
        }

        if ($needsPubGet) {
            Write-ColorMessage -Message "[SPLASH-FLUTTER] Running flutter pub get..." -Type "Command"
            $pubgetResult = flutter pub get
            if ($LASTEXITCODE -ne 0) {
                Write-ColorMessage -Message "[SPLASH-FLUTTER] flutter pub get failed" -Type "Error"
                Pop-Location
                return $false
            }

            # Run flutter_native_splash generate only if pub get was executed
            Write-ColorMessage -Message "[SPLASH-FLUTTER] Running flutter_native_splash generate..." -Type "Command"
            $splashResult = flutter pub run flutter_native_splash:create
            if ($LASTEXITCODE -ne 0) {
                Write-ColorMessage -Message "[SPLASH-FLUTTER] flutter_native_splash generate failed" -Type "Error"
                Pop-Location
                return $false
            }
        } else {
            Write-ColorMessage -Message "[SPLASH-FLUTTER] Skipping flutter pub get (pubspec.yaml unchanged, packages already downloaded)" -Type "Info"
            Write-ColorMessage -Message "[SPLASH-FLUTTER] Skipping flutter_native_splash generate (splash already generated)" -Type "Info"
        }

        Write-ColorMessage -Message "[SPLASH-FLUTTER] flutter_native_splash completed successfully" -Type "Success"
        Pop-Location
        return $true

    } catch {
        Write-ColorMessage -Message "[SPLASH-FLUTTER] Error running flutter_native_splash: $($_.Exception.Message)" -Type "Error"
        if (Get-Location) {
            Pop-Location
        }
        return $false
    }
}

function Update-AppSplash {
    <#
    .SYNOPSIS
    Complete splash update process using file variable system

    .PARAMETER GenerateOnly
    Only run flutter_native_splash generate, skip config update

    .RETURNS
    Boolean indicating success or failure
    #>

    param(
        [Parameter(Mandatory=$false)]
        [switch]$GenerateOnly = $false
    )

    # Read variables from file variable system (like BCommon.ps1)
    $selectedApp = Get-FileVariable -Name $Global:KEY_SELECTED_APP -DefaultValue ""
    $selectedAction = Get-FileVariable -Name $Global:KEY_SELECTED_ACTION -DefaultValue ""
    $selectedPlatform = Get-FileVariable -Name $Global:KEY_SELECTED_PLATFORM -DefaultValue ""
    $selectedEntryFile = Get-FileVariable -Name $Global:KEY_SELECTED_ENTRY_FILE -DefaultValue ""
    $appIndex = Get-FileVariable -Name $Global:KEY_APP_INDEX -DefaultValue ""
    $debugPort = Get-FileVariable -Name $Global:KEY_DEBUG_PORT -DefaultValue ""
    $scriptPath = Get-FileVariable -Name $Global:KEY_SCRIPT_PATH -DefaultValue ""

    if (-not $selectedApp) {
        Write-ColorMessage -Message "[SPLASH] No app selected in file variables" -Type "Warning"
        return $false
    }

    Write-ColorMessage -Message "[SPLASH] Starting complete splash update process for app: $selectedApp" -Type "Info"

    try {
        if ($GenerateOnly) {
            # Only run flutter_native_splash generate
            return Invoke-FlutterNativeSplash
        } else {
            # Step 1: Update splash configuration using Python
            if (-not (Invoke-PythonSplashUpdate)) {
                Write-ColorMessage -Message "[SPLASH] Splash configuration update failed" -Type "Error"
                return $false
            }

            # Step 2: Run flutter_native_splash to generate resources
            if (-not (Invoke-FlutterNativeSplash)) {
                Write-ColorMessage -Message "[SPLASH] flutter_native_splash generation failed" -Type "Error"
                return $false
            }

            Write-ColorMessage -Message "[SPLASH] Complete splash update process finished for app: $selectedApp" -Type "Success"
            return $true
        }

    } catch {
        Write-ColorMessage -Message "[SPLASH] Error in complete splash update process: $($_.Exception.Message)" -Type "Error"
        return $false
    }
}

function Invoke-PreDebugSplashUpdate {
    <#
    .SYNOPSIS
    Update splash screen before starting debug mode based on selected app

    .DESCRIPTION
    This function should be called before starting Flutter debug to update splash screens
    for the selected app using the existing variable system
    #>

    try {
        # Read selected app from global variables
        $selectedApp = Get-FileVariable -Name $Global:KEY_SELECTED_APP -DefaultValue ""

        if (-not $selectedApp) {
            Write-ColorMessage -Message "[SPLASH] No app selected for debug, skipping splash update" -Type "Warning"
            return $true
        }

        Write-ColorMessage -Message "[SPLASH] Pre-debug splash update for app: $selectedApp" -Type "Info"

        # Update splash for selected app (using file variable system)
        $result = Update-AppSplash

        if ($result) {
            Write-ColorMessage -Message "[SPLASH] Splash update completed successfully" -Type "Success"
        } else {
            Write-ColorMessage -Message "[SPLASH] Splash update failed, continuing with debug anyway" -Type "Warning"
        }

        return $true
    }
    catch {
        Write-ColorMessage -Message "[SPLASH] Error in pre-debug splash update: $($_.Exception.Message)" -Type "Error"
        # Don't fail debug due to splash issues
        return $true
    }
}

Write-Host "[INFO] SplashManager library loaded successfully" -ForegroundColor Green