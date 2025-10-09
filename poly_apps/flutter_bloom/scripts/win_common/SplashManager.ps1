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

function Invoke-PythonSplashUpdate {
    <#
    .SYNOPSIS
    Call Python splash manager to update splash configuration

    .PARAMETER AppName
    Name of the Flutter app

    .PARAMETER ProjectRoot
    Path to Flutter project root

    .RETURNS
    Boolean indicating success or failure
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName,

        [Parameter(Mandatory=$false)]
        [string]$ProjectRoot = $Global:FLUTTER_PROJECT_DIR
    )

    try {
        Write-ColorMessage -Message "[SPLASH-PY] Starting Python splash update for app: $AppName" -Type "Info"

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

        # Call Python splash manager
        $pythonArgs = @(
            "`"$Global:PythonSplashManager`"",
            $AppName,
            $ProjectRoot
        )

        $command = "python $($pythonArgs -join ' ')"
        Write-ColorMessage -Message "[SPLASH-PY] Executing: $command" -Type "Command"

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
    Execute flutter_native_splash generate command

    .PARAMETER ProjectRoot
    Path to Flutter project root

    .RETURNS
    Boolean indicating success or failure
    #>

    param(
        [Parameter(Mandatory=$false)]
        [string]$ProjectRoot = $Global:FLUTTER_PROJECT_DIR
    )

    try {
        Write-ColorMessage -Message "[SPLASH-FLUTTER] Running flutter_native_splash generate..." -Type "Info"

        # Change to project root directory
        Push-Location $ProjectRoot

        # Check if flutter command is available
        if (-not (Get-Command "flutter" -ErrorAction SilentlyContinue)) {
            Write-ColorMessage -Message "[SPLASH-FLUTTER] Flutter command not found in PATH" -Type "Error"
            Pop-Location
            return $false
        }

        # Run flutter pub get first to ensure dependencies
        Write-ColorMessage -Message "[SPLASH-FLUTTER] Running flutter pub get..." -Type "Command"
        $pubgetResult = flutter pub get
        if ($LASTEXITCODE -ne 0) {
            Write-ColorMessage -Message "[SPLASH-FLUTTER] flutter pub get failed" -Type "Error"
            Pop-Location
            return $false
        }

        # Run flutter_native_splash generate
        Write-ColorMessage -Message "[SPLASH-FLUTTER] Running flutter_native_splash generate..." -Type "Command"
        $splashResult = flutter_native_splash generate
        if ($LASTEXITCODE -ne 0) {
            Write-ColorMessage -Message "[SPLASH-FLUTTER] flutter_native_splash generate failed" -Type "Error"
            Pop-Location
            return $false
        }

        Write-ColorMessage -Message "[SPLASH-FLUTTER] flutter_native_splash completed successfully" -Type "Success"
        Pop-Location
        return $true

    } catch {
        Write-ColorMessage -Message "[SPLASH-FLUTTER] Error running flutter_native_splash: $($_.Exception.Message)" -Type "Error"
        if (Get-Location -PathType Container) {
            Pop-Location
        }
        return $false
    }
}

function Update-AppSplash {
    <#
    .SYNOPSIS
    Complete splash update process for an app

    .PARAMETER AppName
    Name of the Flutter app

    .PARAMETER ProjectRoot
    Path to Flutter project root

    .PARAMETER GenerateOnly
    Only run flutter_native_splash generate, skip config update

    .RETURNS
    Boolean indicating success or failure
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName,

        [Parameter(Mandatory=$false)]
        [string]$ProjectRoot = $Global:FLUTTER_PROJECT_DIR,

        [switch]$GenerateOnly = $false
    )

    try {
        Write-ColorMessage -Message "[SPLASH] Starting complete splash update process for app: $AppName" -Type "Info"

        if ($GenerateOnly) {
            # Only run flutter_native_splash generate
            return Invoke-FlutterNativeSplash -ProjectRoot $ProjectRoot
        } else {
            # Step 1: Update splash configuration using Python
            if (-not (Invoke-PythonSplashUpdate -AppName $AppName -ProjectRoot $ProjectRoot)) {
                Write-ColorMessage -Message "[SPLASH] Splash configuration update failed" -Type "Error"
                return $false
            }

            # Step 2: Run flutter_native_splash to generate resources
            if (-not (Invoke-FlutterNativeSplash -ProjectRoot $ProjectRoot)) {
                Write-ColorMessage -Message "[SPLASH] flutter_native_splash generation failed" -Type "Error"
                return $false
            }

            Write-ColorMessage -Message "[SPLASH] Complete splash update process finished for app: $AppName" -Type "Success"
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

        # Update splash for selected app
        $result = Update-AppSplash -AppName $selectedApp

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