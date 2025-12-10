#!/usr/bin/env pwsh
# -*- coding: utf-8 -*-
<#
.SYNOPSIS
    Fix Gradle JAR file creation failure

.DESCRIPTION
    Specifically fixes: Failed to create Jar file ...gradle-8.2.1.jar
    by forcefully stopping all processes and clearing locked files
#>

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

Write-Section "Fix Gradle JAR Creation Failure"

Write-ColorText "Target: C:\Users\accou\.gradle\caches\jars-9\d78d5ca2aa14c70895820c0e5bba6a9b\gradle-8.2.1.jar" "Yellow"
Write-Host ""

# Step 1: Force stop ALL Java/Gradle processes
Write-Section "Step 1: Force Stop All Java/Gradle Processes"

Write-ColorText "[Process] Finding Java and Gradle processes..." "Cyan"

$javaProcesses = Get-Process -Name "java", "javaw" -ErrorAction SilentlyContinue
$gradleProcesses = Get-Process | Where-Object { $_.ProcessName -like "*gradle*" }

$allProcesses = @()
if ($javaProcesses) { $allProcesses += $javaProcesses }
if ($gradleProcesses) { $allProcesses += $gradleProcesses }

if ($allProcesses.Count -gt 0) {
    Write-ColorText "[Process] Found $($allProcesses.Count) processes" "Yellow"

    foreach ($proc in $allProcesses) {
        try {
            Write-ColorText "  Killing: $($proc.ProcessName) (PID: $($proc.Id))" "DarkGray"
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        } catch {
            Write-ColorText "  Warning: Could not kill PID $($proc.Id)" "Yellow"
        }
    }

    Write-ColorText "[Success] All processes terminated" "Green"
    Write-ColorText "[Wait] Waiting 3 seconds for file handles to release..." "Cyan"
    Start-Sleep -Seconds 3
} else {
    Write-ColorText "[Info] No Java/Gradle processes running" "Green"
}

# Step 2: Delete the specific problematic directory
Write-Section "Step 2: Delete Problematic JAR Directory"

$problemDir = "C:\Users\accou\.gradle\caches\jars-9\d78d5ca2aa14c70895820c0e5bba6a9b"
$problemJar = "$problemDir\gradle-8.2.1.jar"

Write-ColorText "[Target] Directory: $problemDir" "Cyan"

if (Test-Path $problemDir) {
    Write-ColorText "[Status] Directory exists, attempting to delete..." "Yellow"

    # Try to unlock the file first using icacls
    Write-ColorText "[Security] Attempting to take ownership..." "Cyan"
    try {
        # Take ownership
        & takeown /F "$problemDir" /R /D Y 2>&1 | Out-Null
        # Grant full control
        & icacls "$problemDir" /grant "${env:USERNAME}:(OI)(CI)F" /T /C /Q 2>&1 | Out-Null
        Write-ColorText "[Success] Ownership taken" "Green"
    } catch {
        Write-ColorText "[Warning] Could not change ownership (may not be needed)" "Yellow"
    }

    # Try to delete
    try {
        Remove-Item -Path $problemDir -Recurse -Force -ErrorAction Stop
        Write-ColorText "[Success] Problematic directory deleted!" "Green"
    } catch {
        Write-ColorText "[Error] Failed to delete directory: $_" "Red"
        Write-ColorText "[Action] Trying alternative method..." "Yellow"

        # Try cmd rmdir
        try {
            & cmd /c "rmdir /S /Q `"$problemDir`"" 2>&1 | Out-Null
            Write-ColorText "[Success] Directory deleted using cmd" "Green"
        } catch {
            Write-ColorText "[Error] Alternative method also failed" "Red"
        }
    }
} else {
    Write-ColorText "[Info] Directory does not exist (already clean)" "Green"
}

# Step 3: Delete entire jars-9 directory
Write-Section "Step 3: Clean Entire jars-9 Cache"

$jars9Dir = "C:\Users\accou\.gradle\caches\jars-9"

if (Test-Path $jars9Dir) {
    Write-ColorText "[Cache] jars-9 directory exists" "Cyan"
    Write-ColorText "[Action] Deleting entire jars-9 cache..." "Yellow"

    try {
        Remove-Item -Path "$jars9Dir\*" -Recurse -Force -ErrorAction Stop
        Write-ColorText "[Success] jars-9 cache cleared!" "Green"
    } catch {
        Write-ColorText "[Warning] Could not fully clear jars-9 cache" "Yellow"
        Write-ColorText "[Error] $_" "Red"
    }
} else {
    Write-ColorText "[Info] jars-9 directory does not exist" "Green"
}

# Step 4: Stop Gradle Daemon properly
Write-Section "Step 4: Stop Gradle Daemon"

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidPath = Join-Path $projectRoot "android"

if (Test-Path $androidPath) {
    Push-Location $androidPath
    try {
        Write-ColorText "[Gradle] Stopping Gradle daemon..." "Cyan"
        & .\gradlew.bat --stop 2>&1 | ForEach-Object { Write-ColorText "  $_" "DarkGray" }
        Write-ColorText "[Success] Gradle daemon stopped" "Green"
    } catch {
        Write-ColorText "[Warning] Could not stop Gradle daemon" "Yellow"
    } finally {
        Pop-Location
    }
}

# Step 5: Clean Gradle daemon logs
Write-Section "Step 5: Clean Gradle Daemon Logs"

$daemonDir = "C:\Users\accou\.gradle\daemon"
if (Test-Path $daemonDir) {
    Write-ColorText "[Daemon] Cleaning daemon directory..." "Cyan"
    try {
        Remove-Item -Path "$daemonDir\*" -Recurse -Force -ErrorAction SilentlyContinue
        Write-ColorText "[Success] Daemon directory cleaned" "Green"
    } catch {
        Write-ColorText "[Warning] Could not fully clean daemon directory" "Yellow"
    }
}

# Step 6: Verify cleanup
Write-Section "Verification"

Write-ColorText "Checking cleanup results:" "Cyan"
Write-Host ""

# Check problem directory
if (Test-Path $problemDir) {
    Write-ColorText "✗ Problem directory still exists!" "Red"
    Write-ColorText "  Path: $problemDir" "DarkGray"
} else {
    Write-ColorText "✓ Problem directory removed" "Green"
}

# Check jars-9
if (Test-Path $jars9Dir) {
    $filesCount = (Get-ChildItem -Path $jars9Dir -Recurse -ErrorAction SilentlyContinue).Count
    if ($filesCount -eq 0) {
        Write-ColorText "✓ jars-9 cache is empty" "Green"
    } else {
        Write-ColorText "⚠ jars-9 cache has $filesCount files remaining" "Yellow"
    }
} else {
    Write-ColorText "✓ jars-9 directory removed" "Green"
}

# Check for Java processes
$remainingJava = Get-Process -Name "java", "javaw" -ErrorAction SilentlyContinue
if ($remainingJava) {
    Write-ColorText "⚠ $($remainingJava.Count) Java processes still running" "Yellow"
} else {
    Write-ColorText "✓ No Java processes running" "Green"
}

Write-Section "Next Steps"

Write-ColorText "1. Try building again:" "Cyan"
Write-ColorText "   cd scripts" "DarkGray"
Write-ColorText "   .\start.ps1" "DarkGray"
Write-ColorText "   (Select 4 for Android build)" "DarkGray"
Write-Host ""

Write-ColorText "2. If it still fails:" "Cyan"
Write-ColorText "   a. Check your antivirus software" "DarkGray"
Write-ColorText "      (Temporarily disable real-time protection)" "DarkGray"
Write-ColorText "   b. Run this script as Administrator" "DarkGray"
Write-ColorText "   c. Restart your computer" "DarkGray"
Write-Host ""

Write-ColorText "3. Manual verification:" "Cyan"
Write-ColorText "   cd android" "DarkGray"
Write-ColorText "   .\gradlew.bat --version" "DarkGray"
Write-ColorText "   (This should download Gradle successfully)" "DarkGray"

Write-Host ""
Write-Section "Script Complete"

Write-ColorText "Cleanup completed. Please try building again." "Green"
Write-Host ""

# Offer to test immediately
$test = Read-Host "Test Gradle now? [Y/n]"
if ($test -match '^[Yy]' -or $test -eq '') {
    Write-Host ""
    Write-ColorText "[Test] Testing Gradle..." "Cyan"

    if (Test-Path $androidPath) {
        Push-Location $androidPath
        try {
            Write-ColorText "[Command] .\gradlew.bat --version" "DarkGray"
            & .\gradlew.bat --version

            if ($LASTEXITCODE -eq 0) {
                Write-ColorText "`n[Success] Gradle is working!" "Green"
                Write-ColorText "[Info] You can now build the APK" "Cyan"
            } else {
                Write-ColorText "`n[Error] Gradle test failed" "Red"
            }
        } finally {
            Pop-Location
        }
    }
}
