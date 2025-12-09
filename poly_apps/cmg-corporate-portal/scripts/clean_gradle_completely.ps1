#!/usr/bin/env pwsh
# -*- coding: utf-8 -*-
<#
.SYNOPSIS
    Complete Gradle cache cleanup script

.DESCRIPTION
    Thoroughly cleans all Gradle caches, daemons, and build directories
    Use this when normal build fails due to corrupted cache

.EXAMPLE
    .\clean_gradle_completely.ps1
#>

param(
    [switch]$Force
)

$ErrorActionPreference = "Continue"

function Write-ColorText {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

Write-Section "Complete Gradle Cache Cleanup"

if (-not $Force) {
    Write-ColorText "This will:" "Yellow"
    Write-ColorText "  1. Stop all Gradle daemon processes" "DarkGray"
    Write-ColorText "  2. Delete user Gradle cache (~/.gradle/caches)" "DarkGray"
    Write-ColorText "  3. Delete project .gradle directories" "DarkGray"
    Write-ColorText "  4. Clean project build directories" "DarkGray"
    Write-ColorText ""
    Write-ColorText "WARNING: This will affect ALL Gradle projects on this machine!" "Red"
    Write-ColorText "         All projects will need to re-download dependencies." "Red"
    Write-Host ""

    $confirm = Read-Host "Continue? [y/N]"
    if ($confirm -notmatch '^[Yy]') {
        Write-ColorText "Cancelled by user" "Yellow"
        exit 0
    }
}

# Get paths
$projectRoot = Split-Path -Parent $PSScriptRoot
$androidPath = Join-Path $projectRoot "android"

Write-Section "Step 1: Stop Gradle Daemons"

if (Test-Path $androidPath) {
    Push-Location $androidPath
    try {
        Write-ColorText "[Gradle] Stopping all Gradle daemons..." "Cyan"
        & .\gradlew.bat --stop 2>&1 | Out-Null
        Start-Sleep -Seconds 2
        Write-ColorText "[Success] Gradle daemons stopped" "Green"
    } catch {
        Write-ColorText "[Warning] Could not stop Gradle daemons gracefully" "Yellow"
    } finally {
        Pop-Location
    }
}

# Force kill any remaining Gradle processes
Write-ColorText "[System] Checking for running Gradle processes..." "Cyan"
$gradleProcesses = Get-Process | Where-Object { $_.ProcessName -like "*gradle*" -or $_.ProcessName -like "*java*" }
if ($gradleProcesses) {
    Write-ColorText "[System] Found $($gradleProcesses.Count) Gradle/Java processes, terminating..." "Yellow"
    $gradleProcesses | ForEach-Object {
        try {
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        } catch {}
    }
    Start-Sleep -Seconds 2
    Write-ColorText "[Success] Processes terminated" "Green"
} else {
    Write-ColorText "[Info] No Gradle processes running" "DarkGray"
}

Write-Section "Step 2: Clean User Gradle Cache"

$userGradleDir = "$env:USERPROFILE\.gradle"
$userCacheDir = "$userGradleDir\caches"

if (Test-Path $userCacheDir) {
    Write-ColorText "[Gradle] User cache directory: $userCacheDir" "Cyan"

    try {
        # Get size before
        $sizeBefore = (Get-ChildItem $userCacheDir -Recurse -ErrorAction SilentlyContinue |
                      Measure-Object -Property Length -Sum).Sum / 1MB
        Write-ColorText "[Info] Cache size: $([math]::Round($sizeBefore, 2)) MB" "DarkGray"

        Write-ColorText "[Gradle] Deleting cache contents..." "Cyan"
        Remove-Item -Path "$userCacheDir\*" -Recurse -Force -ErrorAction SilentlyContinue

        Write-ColorText "[Success] User Gradle cache cleared" "Green"
    } catch {
        Write-ColorText "[Error] Failed to clear user cache: $_" "Red"
    }
} else {
    Write-ColorText "[Info] User cache directory not found" "DarkGray"
}

# Also clean daemon directory
$daemonDir = "$userGradleDir\daemon"
if (Test-Path $daemonDir) {
    Write-ColorText "[Gradle] Cleaning daemon directory..." "Cyan"
    try {
        Remove-Item -Path "$daemonDir\*" -Recurse -Force -ErrorAction SilentlyContinue
        Write-ColorText "[Success] Daemon directory cleared" "Green"
    } catch {
        Write-ColorText "[Warning] Could not fully clear daemon directory" "Yellow"
    }
}

Write-Section "Step 3: Clean Project Gradle Directories"

if (Test-Path $androidPath) {
    $projectGradleDir = Join-Path $androidPath ".gradle"

    if (Test-Path $projectGradleDir) {
        Write-ColorText "[Gradle] Project .gradle directory: $projectGradleDir" "Cyan"
        try {
            Remove-Item -Path $projectGradleDir -Recurse -Force -ErrorAction SilentlyContinue
            Write-ColorText "[Success] Project .gradle directory deleted" "Green"
        } catch {
            Write-ColorText "[Error] Failed to delete project .gradle: $_" "Red"
        }
    } else {
        Write-ColorText "[Info] Project .gradle directory not found" "DarkGray"
    }

    # Clean build directories
    $buildDir = Join-Path $androidPath "build"
    $appBuildDir = Join-Path $androidPath "app\build"

    foreach ($dir in @($buildDir, $appBuildDir)) {
        if (Test-Path $dir) {
            Write-ColorText "[Gradle] Cleaning: $dir" "Cyan"
            try {
                Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
                Write-ColorText "[Success] Build directory cleaned" "Green"
            } catch {
                Write-ColorText "[Warning] Could not fully clean build directory" "Yellow"
            }
        }
    }
} else {
    Write-ColorText "[Warning] Android project directory not found: $androidPath" "Yellow"
}

Write-Section "Step 4: Clean Gradle Wrapper Cache"

$wrapperCache = "$userGradleDir\wrapper\dists"
if (Test-Path $wrapperCache) {
    Write-ColorText "[Gradle] Wrapper cache: $wrapperCache" "Cyan"
    Write-ColorText "[Info] Keeping wrapper cache (will re-download Gradle if deleted)" "Yellow"
    Write-ColorText "[Info] To force re-download, manually delete: $wrapperCache" "DarkGray"
}

Write-Section "Cleanup Complete"

Write-ColorText "✓ All Gradle caches cleared" "Green"
Write-ColorText "✓ All Gradle daemons stopped" "Green"
Write-ColorText "✓ Project build directories cleaned" "Green"

Write-Host ""
Write-ColorText "Next Steps:" "Cyan"
Write-ColorText "  1. Try building again:" "White"
Write-ColorText "     cd scripts" "DarkGray"
Write-ColorText "     .\start.ps1" "DarkGray"
Write-ColorText "     (Select 4 for Android build)" "DarkGray"
Write-Host ""
Write-ColorText "  2. Or manually build:" "White"
Write-ColorText "     cd android" "DarkGray"
Write-ColorText "     .\gradlew.bat clean assembleDebug" "DarkGray"
Write-Host ""
Write-ColorText "Note: First build will be slower as dependencies are re-downloaded" "Yellow"

Write-Host ""
Write-Section "Diagnostics"

Write-ColorText "Gradle Cache Status:" "Cyan"
if (Test-Path $userCacheDir) {
    $filesRemaining = (Get-ChildItem $userCacheDir -Recurse -ErrorAction SilentlyContinue).Count
    Write-ColorText "  Files remaining in cache: $filesRemaining" "DarkGray"
} else {
    Write-ColorText "  Cache directory: Deleted" "Green"
}

if (Test-Path $androidPath) {
    $projectGradleDir = Join-Path $androidPath ".gradle"
    if (Test-Path $projectGradleDir) {
        Write-ColorText "  Project .gradle: Still exists (may be recreated)" "Yellow"
    } else {
        Write-ColorText "  Project .gradle: Deleted" "Green"
    }
}

Write-ColorText "`nGradle Processes:" "Cyan"
$remaining = Get-Process | Where-Object { $_.ProcessName -like "*gradle*" }
if ($remaining) {
    Write-ColorText "  Running: $($remaining.Count) processes" "Yellow"
} else {
    Write-ColorText "  Running: None" "Green"
}

Write-Host ""
Write-ColorText "Cleanup script completed!" "Green"
