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

# Flutter Build Executor Helper Functions
# Build execution and management for Flutter multi-app development
# Author: Development Script System
# Version: 1.0

# Import required modules
$WinCommonDir = $PSScriptRoot
. (Join-Path $WinCommonDir "FlutterGlobalVar.ps1")
. (Join-Path $WinCommonDir "BCommon.ps1")

function Initialize-BuildEnvironment {
    <#
    .SYNOPSIS
    Initialize build environment and verify dependencies

    .RETURNS
    True if successful
    #>

    try {
        Write-Host "Initializing build environment..." -ForegroundColor Yellow

        # Test Flutter environment
        if (-not (Test-FlutterEnvironment)) {
            return $false
        }

        # Test Python environment
        try {
            $pythonVersion = python --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Python is available: $pythonVersion" -ForegroundColor Green
            } else {
                Write-Error "✗ Python is not available"
                return $false
            }
        }
        catch {
            Write-Error "✗ Python is not available in PATH"
            return $false
        }

        # Initialize backup system
        if (-not (Initialize-BackupSystem)) {
            Write-Warning "Backup system initialization failed"
        }

        # Set up working directory
        $projectRoot = Get-GvarValue -Name "flutter_project_dir"
        if ($projectRoot -and (Test-Path $projectRoot)) {
            Set-Location $projectRoot
            Write-Host "✓ Working directory set to: $projectRoot" -ForegroundColor Green
        }

        Write-Host "Build environment initialized successfully" -ForegroundColor Green
        return $true

    }
    catch {
        Write-Error "Error initializing build environment: $($_.Exception.Message)"
        return $false
    }
}

function Invoke-PreBuildScripts {
    <#
    .SYNOPSIS
    Execute pre-build Python scripts for app preparation

    .PARAMETER AppName
    Name of the app to prepare

    .PARAMETER BuildOptions
    Build options from configuration

    .RETURNS
    True if successful
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName,

        [Parameter(Mandatory=$true)]
        [hashtable]$BuildOptions
    )

    try {
        $devScriptDir = Get-GvarValue -Name "dev_script_dir"
        $pythonHelperDir = Join-Path $devScriptDir "py_helper"

        Write-Host "Executing pre-build scripts for app: $AppName" -ForegroundColor Yellow

        # Check if external safe build is enabled
        $useExternalBuild = $BuildOptions["use_external_safe_build"] -eq "true"

        if ($useExternalBuild) {
            Write-Host "External safe build enabled - setting up external environment" -ForegroundColor Cyan

            # Execute external safe build setup
            $externalBuildScript = Join-Path $pythonHelperDir "external_safe_build.py"
            if (Test-Path $externalBuildScript) {
                $args = @($AppName, "true")
                if (-not (Invoke-PythonScript -ScriptPath $externalBuildScript -Arguments $args -Description "Setting up external safe build environment")) {
                    Write-Error "Failed to setup external safe build environment"
                    return $false
                }
            } else {
                Write-Warning "External safe build script not found: $externalBuildScript"
            }
        }

        # Store current app name in Gvar for Python scripts
        Set-GvarValue -Name "current_app_name" -Value $AppName -Type "string"
        # Store build options as individual variables
        foreach ($kvp in $BuildOptions.GetEnumerator()) {
            Set-GvarValue -Name "build_option_$($kvp.Key)" -Value $kvp.Value -Type "string"
        }

        # b-1: Collect package IDs
        $collectScript = Join-Path $pythonHelperDir "collect_package_ids.py"
        if (Test-Path $collectScript) {
            if (-not (Invoke-PythonScript -ScriptPath $collectScript -Description "Collecting package IDs")) {
                return $false
            }
        } else {
            Write-Warning "Package ID collection script not found: $collectScript"
        }

        # b-2: Replace package IDs (if needed)
        if ($BuildOptions.ContainsKey("random_package_id") -and $BuildOptions["random_package_id"] -eq "true") {
            $replaceIdScript = Join-Path $pythonHelperDir "replace_package_ids.py"
            if (Test-Path $replaceIdScript) {
                $args = @($AppName)
                if (-not (Invoke-PythonScript -ScriptPath $replaceIdScript -Arguments $args -Description "Replacing package IDs with random values")) {
                    return $false
                }
            } else {
                Write-Warning "Package ID replacement script not found: $replaceIdScript"
            }
        }

        # b-3: Replace app names (if needed)
        if ($BuildOptions.ContainsKey("custom_app_name")) {
            $replaceNameScript = Join-Path $pythonHelperDir "replace_app_names.py"
            if (Test-Path $replaceNameScript) {
                $args = @($AppName, $BuildOptions["custom_app_name"])
                if (-not (Invoke-PythonScript -ScriptPath $replaceNameScript -Arguments $args -Description "Replacing app names")) {
                    return $false
                }
            } else {
                Write-Warning "App name replacement script not found: $replaceNameScript"
            }
        }

        # b-4: Process images (if needed)
        if ($BuildOptions.ContainsKey("process_images") -and $BuildOptions["process_images"] -eq "true") {
            $processImagesScript = Join-Path $pythonHelperDir "process_images.py"
            if (Test-Path $processImagesScript) {
                $args = @($AppName)
                if (-not (Invoke-PythonScript -ScriptPath $processImagesScript -Arguments $args -Description "Processing images")) {
                    return $false
                }
            } else {
                Write-Warning "Image processing script not found: $processImagesScript"
            }
        }

        # b-5: Manage pubspec.yaml
        $managePubspecScript = Join-Path $pythonHelperDir "manage_pubspec.py"
        if (Test-Path $managePubspecScript) {
            $args = @($AppName)
            if (-not (Invoke-PythonScript -ScriptPath $managePubspecScript -Arguments $args -Description "Managing pubspec.yaml")) {
                return $false
            }
        } else {
            Write-Warning "Pubspec management script not found: $managePubspecScript"
        }

        Write-Host "Pre-build scripts completed successfully" -ForegroundColor Green
        return $true

    }
    catch {
        Write-Error "Error executing pre-build scripts: $($_.Exception.Message)"
        return $false
    }
}

function Invoke-FlutterBuild {
    <#
    .SYNOPSIS
    Execute Flutter build or debug command

    .PARAMETER AppName
    Name of the app to build

    .PARAMETER BuildAction
    Build action (debug/build)

    .PARAMETER Platform
    Target platform

    .RETURNS
    True if successful
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName,

        [Parameter(Mandatory=$true)]
        [string]$BuildAction,

        [Parameter(Mandatory=$true)]
        [string]$Platform
    )

    try {
        Write-Host "Executing Flutter $BuildAction for $AppName on $Platform" -ForegroundColor Yellow

        # Get Flutter command
        $flutterCommand = Get-FlutterCommand -Action $BuildAction -Platform $Platform -AppName $AppName

        if (-not $flutterCommand) {
            Write-Error "Failed to generate Flutter command"
            return $false
        }

        # Handle multiple commands (for "all" platform)
        if ($flutterCommand -is [array]) {
            $allSuccessful = $true
            foreach ($command in $flutterCommand) {
                Write-Host "Executing: $command" -ForegroundColor Cyan
                if (-not (Invoke-SafeCommand -Command $command -Description "Flutter build command")) {
                    $allSuccessful = $false
                }
            }
            return $allSuccessful
        } else {
            # Single command
            return Invoke-SafeCommand -Command $flutterCommand -Description "Flutter $BuildAction command"
        }

    }
    catch {
        Write-Error "Error executing Flutter build: $($_.Exception.Message)"
        return $false
    }
}

function Invoke-PostBuildCleanup {
    <#
    .SYNOPSIS
    Execute post-build cleanup if needed

    .PARAMETER AppName
    Name of the app

    .PARAMETER AutoCleanup
    Whether to automatically clean up after build

    .RETURNS
    True if successful
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName,

        [Parameter(Mandatory=$false)]
        [bool]$AutoCleanup = $false
    )

    try {
        # Always cleanup external build if active
        if (Test-ExternalBuildActive) {
            Write-Host "Cleaning up external build environment" -ForegroundColor Yellow

            $devScriptDir = Get-GvarValue -Name "dev_script_dir"
            $pythonHelperDir = Join-Path $devScriptDir "py_helper"
            $externalBuildScript = Join-Path $pythonHelperDir "external_safe_build.py"

            if (Test-Path $externalBuildScript) {
                $args = @($AppName, "false")
                if (-not (Invoke-PythonScript -ScriptPath $externalBuildScript -Arguments $args -Description "Cleaning up external safe build environment")) {
                    Write-Warning "Failed to cleanup external build environment"
                }
            }
        }

        if ($AutoCleanup) {
            Write-Host "Performing post-build cleanup for: $AppName" -ForegroundColor Yellow
            return Invoke-CleanupRestore -AppName $AppName
        } else {
            Write-Host "Skipping post-build cleanup (auto cleanup disabled)" -ForegroundColor Gray
            return $true
        }

    }
    catch {
        Write-Error "Error in post-build cleanup: $($_.Exception.Message)"
        return $false
    }
}

function Get-BuildOptions {
    <#
    .SYNOPSIS
    Get build options for specific app from configuration

    .PARAMETER AppName
    Name of the app

    .RETURNS
    Hashtable of build options
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName
    )

    try {
        $devScriptDir = Get-GvarValue -Name "dev_script_dir"
        $buildOptionsFile = Join-Path $devScriptDir "build_option.ini"

        if (-not (Test-Path $buildOptionsFile)) {
            Write-Warning "Build options file not found: $buildOptionsFile"
            return @{}
        }

        $options = @{}
        $content = Get-Content $buildOptionsFile -Raw

        # Parse pipe-delimited format: external_assets_dir|random_id|random_app_name|fixed_id|fixed_app_name|optimize_images|debug_platform|debug_port|build_platform|use_external_safe_build
        foreach ($line in $content -split "`r?`n") {
            $line = $line.Trim()

            # Skip comments and empty lines
            if ($line.StartsWith("#") -or $line -eq "") {
                continue
            }

            # Parse app_name = options format
            if ($line -match '^([^=]+)=(.*)$') {
                $configAppName = $matches[1].Trim()
                $configValues = $matches[2].Trim()

                if ($configAppName -eq $AppName) {
                    $values = $configValues -split '\|'

                    # Ensure we have enough values (pad with empty strings if needed)
                    while ($values.Count -lt 10) {
                        $values += ""
                    }

                    $options = @{
                        "external_assets_dir" = $values[0]
                        "random_id" = $values[1]
                        "random_app_name" = $values[2]
                        "fixed_id" = $values[3]
                        "fixed_app_name" = $values[4]
                        "optimize_images" = $values[5]
                        "debug_platform" = $values[6]
                        "debug_port" = $values[7]
                        "build_platform" = $values[8]
                        "use_external_safe_build" = $values[9]
                    }
                    break
                }
            }
        }

        if ($Global:DEBUG_MODE) {
            Write-Host "Build options for $AppName : $($options | ConvertTo-Json -Compress)" -ForegroundColor Cyan
        }

        return $options

    }
    catch {
        Write-Error "Error reading build options: $($_.Exception.Message)"
        return @{}
    }
}

function Invoke-CompleteBuildProcess {
    <#
    .SYNOPSIS
    Execute complete build process for an app

    .PARAMETER AppName
    Name of the app to build

    .PARAMETER BuildAction
    Build action (debug/build)

    .PARAMETER Platform
    Target platform

    .PARAMETER AutoCleanup
    Whether to automatically clean up after build

    .RETURNS
    True if successful
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName,

        [Parameter(Mandatory=$true)]
        [string]$BuildAction,

        [Parameter(Mandatory=$true)]
        [string]$Platform,

        [Parameter(Mandatory=$false)]
        [bool]$AutoCleanup = $false
    )

    try {
        Write-Host "=" * 60 -ForegroundColor Yellow
        Write-Host "Complete Build Process for: $AppName" -ForegroundColor Green
        Write-Host "Action: $BuildAction | Platform: $Platform" -ForegroundColor Green
        Write-Host "=" * 60 -ForegroundColor Yellow

        # Print comprehensive debug information
        $additionalVars = @{
            'AppName' = $AppName
            'BuildAction' = $BuildAction
            'Platform' = $Platform
            'AutoCleanup' = $AutoCleanup
            'PSScriptRoot' = $PSScriptRoot
            'Location' = (Get-Location).Path
            'ExternalBuildActive' = Test-ExternalBuildActive
        }
        Write-DebugVariables -ScriptName "BUILD_EXECUTOR" -AdditionalVars $additionalVars

        # Initialize build environment
        if (-not (Initialize-BuildEnvironment)) {
            Write-Error "Failed to initialize build environment"
            return $false
        }

        # Get build options
        $buildOptions = Get-BuildOptions -AppName $AppName

        # Execute pre-build scripts
        if (-not (Invoke-PreBuildScripts -AppName $AppName -BuildOptions $buildOptions)) {
            Write-Error "Pre-build scripts failed"
            return $false
        }

        # Execute Flutter build/debug
        if (-not (Invoke-FlutterBuild -AppName $AppName -BuildAction $BuildAction -Platform $Platform)) {
            Write-Error "Flutter build failed"
            return $false
        }

        # Post-build cleanup
        if (-not (Invoke-PostBuildCleanup -AppName $AppName -AutoCleanup $AutoCleanup)) {
            Write-Warning "Post-build cleanup had issues"
        }

        Write-Host "=" * 60 -ForegroundColor Green
        Write-Host "Build process completed successfully for: $AppName" -ForegroundColor Green
        Write-Host "=" * 60 -ForegroundColor Green

        # Save last successful build info
        Set-GvarValue -Name "last_build_app_name" -Value $AppName -Type "string"
        Set-GvarValue -Name "last_build_action" -Value $BuildAction -Type "string"
        Set-GvarValue -Name "last_build_platform" -Value $Platform -Type "string"
        Set-GvarValue -Name "last_build_timestamp" -Value (Get-Date -Format "yyyy-MM-dd HH:mm:ss") -Type "string"
        Set-GvarValue -Name "last_build_success" -Value "true" -Type "string"

        return $true

    }
    catch {
        Write-Error "Error in complete build process: $($_.Exception.Message)"
        return $false
    }
}

function Show-BuildSummary {
    <#
    .SYNOPSIS
    Display build summary and results
    #>

    try {
        $appName = Get-GvarValue -Name "last_build_app_name"
        $buildAction = Get-GvarValue -Name "last_build_action"
        $platform = Get-GvarValue -Name "last_build_platform"
        $timestamp = Get-GvarValue -Name "last_build_timestamp"
        $success = Get-GvarValue -Name "last_build_success"

        if ($appName -and $buildAction -and $platform) {
            Write-Host ""
            Write-Host "Last Build Summary:" -ForegroundColor Yellow
            Write-Host "-" * 30 -ForegroundColor Yellow
            Write-Host "App: $appName" -ForegroundColor White
            Write-Host "Action: $buildAction" -ForegroundColor White
            Write-Host "Platform: $platform" -ForegroundColor White
            Write-Host "Time: $timestamp" -ForegroundColor White
            Write-Host "Status: $(if ($success -eq 'true') { 'SUCCESS' } else { 'FAILED' })" -ForegroundColor $(if ($success -eq 'true') { 'Green' } else { 'Red' })
            Write-Host ""
        } else {
            Write-Host "No build history available" -ForegroundColor Gray
        }

    }
    catch {
        Write-Warning "Error displaying build summary: $($_.Exception.Message)"
    }
}

# Functions are available for dot-sourcing, no Export-ModuleMember needed