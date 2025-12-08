# Create New Kotlin KMP APP Script
# This script creates a new KMP app by cloning the alkaa template repository

# Get the root directory (2 levels up from this script)
$scriptPath = $PSScriptRoot
$rootDir = Split-Path (Split-Path $scriptPath -Parent) -Parent

# Get next available kmpapp index
function Get-NextKmpAppIndex {
    $polyAppsPath = Join-Path $rootDir "poly_apps"
    if (-not (Test-Path $polyAppsPath)) {
        return 1
    }

    $existingDirs = Get-ChildItem -Path $polyAppsPath -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match "^kmpapp_\d+$" }

    if (@($existingDirs).Count -eq 0) {
        return 1
    }

    $maxIndex = 0
    foreach ($dir in $existingDirs) {
        if ($dir.Name -match "^kmpapp_(\d+)$") {
            $index = [int]$matches[1]
            if ($index -gt $maxIndex) {
                $maxIndex = $index
            }
        }
    }

    return $maxIndex + 1
}

# Create new Kotlin KMP APP from alkaa template
function Create-NewKmpApp {
    Write-Host ""
    Write-Host "=== Create New Kotlin KMP APP ===" -ForegroundColor Cyan
    Write-Host ""

    $alkaaRepoUrl = "https://github.com/igorescodro/alkaa.git"
    $polyAppsPath = Join-Path $rootDir "poly_apps"

    # Ensure poly_apps directory exists
    if (-not (Test-Path $polyAppsPath)) {
        Write-Host "Creating poly_apps directory..." -ForegroundColor Yellow
        Write-Host "Command: New-Item -ItemType Directory -Path `"$polyAppsPath`" -Force" -ForegroundColor Gray
        New-Item -ItemType Directory -Path $polyAppsPath -Force | Out-Null
    }

    # Get next available index
    $nextIndex = Get-NextKmpAppIndex
    $defaultAppName = "kmpapp_$nextIndex"

    # Prompt user for custom app name
    Write-Host "Default app name: $defaultAppName" -ForegroundColor Green
    Write-Host ""
    Write-Host "Enter custom app name (or press Enter to use default): " -ForegroundColor Cyan -NoNewline
    $customName = Read-Host

    # Use custom name if provided, otherwise use default
    if ([string]::IsNullOrWhiteSpace($customName)) {
        $newAppName = $defaultAppName
        Write-Host "Using default name: $newAppName" -ForegroundColor Yellow
    } else {
        # Sanitize the custom name (remove invalid characters)
        $newAppName = $customName -replace '[<>:"/\\|?*]', '_'
        if ($newAppName -ne $customName) {
            Write-Host "Name sanitized to: $newAppName" -ForegroundColor Yellow
        } else {
            Write-Host "Using custom name: $newAppName" -ForegroundColor Yellow
        }
    }

    $newAppPath = Join-Path $polyAppsPath $newAppName
    Write-Host ""

    # Check if directory already exists
    if (Test-Path $newAppPath) {
        Write-Host "ERROR: Directory already exists: $newAppPath" -ForegroundColor Red
        Read-Host "Press any key to continue"
        return
    }

    Write-Host "App name: $newAppName" -ForegroundColor Green
    Write-Host "Target path: $newAppPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Cloning alkaa repository from: $alkaaRepoUrl" -ForegroundColor Cyan
    Write-Host ""

    # Confirm before proceeding
    Write-Host "Press any key to continue, or 'n' to cancel..." -ForegroundColor Yellow
    $response = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    if ($response.Character -eq 'n' -or $response.Character -eq 'N') {
        Write-Host "Operation cancelled" -ForegroundColor Yellow
        Start-Sleep -Seconds 1
        return
    }

    # Change to poly_apps directory
    $originalLocation = Get-Location
    try {
        Set-Location $polyAppsPath
        Write-Host "Changed to directory: $polyAppsPath" -ForegroundColor Cyan
        Write-Host "Command: Set-Location `"$polyAppsPath`"" -ForegroundColor Gray
        Write-Host ""

        # Clone the repository
        Write-Host "Cloning repository..." -ForegroundColor Cyan
        Write-Host "Command: git clone $alkaaRepoUrl $newAppName" -ForegroundColor Gray
        Write-Host ""

        # Run git clone with direct console output (no capturing, no exit code checking)
        & git clone $alkaaRepoUrl $newAppName
        Write-Host ""

        # Check if directory was actually created (don't rely on exit code)
        if (Test-Path $newAppPath) {
            Write-Host "New KMP APP created at: $newAppPath" -ForegroundColor Green
            Write-Host ""

            # Remove .git and .github directories
            Write-Host "Removing .git and .github directories from cloned repository..." -ForegroundColor Cyan

            $gitDir = Join-Path $newAppPath ".git"
            $githubDir = Join-Path $newAppPath ".github"

            # Remove .git directory
            if (Test-Path $gitDir) {
                Remove-Item -Path $gitDir -Recurse -Force -ErrorAction SilentlyContinue
                if (-not (Test-Path $gitDir)) {
                    Write-Host "Successfully removed .git directory" -ForegroundColor Green
                } else {
                    Write-Host "Warning: .git directory could not be removed" -ForegroundColor Yellow
                }
            } else {
                Write-Host ".git directory not found" -ForegroundColor Gray
            }

            # Remove .github directory
            if (Test-Path $githubDir) {
                Remove-Item -Path $githubDir -Recurse -Force -ErrorAction SilentlyContinue
                if (-not (Test-Path $githubDir)) {
                    Write-Host "Successfully removed .github directory" -ForegroundColor Green
                } else {
                    Write-Host "Warning: .github directory could not be removed" -ForegroundColor Yellow
                }
            } else {
                Write-Host ".github directory not found" -ForegroundColor Gray
            }
            Write-Host ""

            Write-Host "KMP APP created successfully!" -ForegroundColor Green
            Write-Host "Location: $newAppPath" -ForegroundColor Cyan
        } else {
            Write-Host "ERROR: Directory was not created at: $newAppPath" -ForegroundColor Red
            Write-Host "Clone operation did not succeed." -ForegroundColor Red
        }
    } catch {
        Write-Host "ERROR: Exception during clone operation: $($_.Exception.Message)" -ForegroundColor Red
    } finally {
        Set-Location $originalLocation
        Write-Host "Restored to original directory: $originalLocation" -ForegroundColor Cyan
    }

    Write-Host ""
    Read-Host "Press any key to continue"
}

# Run the script
Create-NewKmpApp
