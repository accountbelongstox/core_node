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

# Unified Manager - Install Dependencies
# Installs dependencies for one or multiple applications in the project

param(
    [string[]]$Apps = @(),           # Specific apps to install dependencies for
    [switch]$All = $false,           # Install dependencies for all apps
    [switch]$Interactive = $false,   # Interactive mode for app selection
    [switch]$List = $false,          # List available apps
    [switch]$Verbose = $false,       # Verbose output
    [switch]$Force = $false,         # Force reinstall dependencies
    [switch]$Clean = $false          # Clean install (remove existing dependencies first)
)

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$UTILS_PATH = Join-Path (Split-Path -Parent $SCRIPT_DIR) "common\utils.ps1"
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $SCRIPT_DIR))

# Import utilities
if (Test-Path $UTILS_PATH) {
    . $UTILS_PATH
} else {
    Write-Error "Utilities not found: $UTILS_PATH"
    exit 1
}

# Function to detect package manager and install dependencies
function Install-AppDependencies {
    param(
        [string]$AppPath,
        [string]$AppName,
        [bool]$ForceReinstall = $false,
        [bool]$CleanInstall = $false
    )

    Write-Info "Installing dependencies for: $AppName"
    Write-Info "  Path: $AppPath"

    $originalLocation = Get-Location

    try {
        Set-Location $AppPath

        # Node.js applications (package.json)
        if (Test-Path "package.json") {
            Write-Success "Detected Node.js application (package.json)"

            if ($CleanInstall -and (Test-Path "node_modules")) {
                Write-Info "Cleaning existing node_modules..."
                Remove-Item -Recurse -Force "node_modules"
            }

            if ($CleanInstall -and (Test-Path "package-lock.json")) {
                Write-Info "Removing package-lock.json for clean install..."
                Remove-Item -Force "package-lock.json"
            }

            # Check if npm is available
            if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
                Write-Error "npm not found. Please install Node.js first."
                return $false
            }

            Write-Info "Running npm install..."
            if ($Verbose) {
                & npm install --verbose
            } else {
                & npm install
            }

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Successfully installed Node.js dependencies for $AppName"
            } else {
                Write-Error "Failed to install Node.js dependencies for $AppName"
                return $false
            }
        }
        # Python applications (requirements.txt or pyproject.toml)
        elseif (Test-Path "requirements.txt") {
            Write-Success "Detected Python application (requirements.txt)"

            # Check if pip is available
            if (-not (Get-Command "pip" -ErrorAction SilentlyContinue)) {
                Write-Error "pip not found. Please install Python first."
                return $false
            }

            Write-Info "Running pip install..."
            if ($ForceReinstall) {
                & pip install -r requirements.txt --force-reinstall
            } else {
                & pip install -r requirements.txt
            }

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Successfully installed Python dependencies for $AppName"
            } else {
                Write-Error "Failed to install Python dependencies for $AppName"
                return $false
            }
        }
        elseif (Test-Path "pyproject.toml") {
            Write-Success "Detected Python application (pyproject.toml)"

            # Check if pip is available
            if (-not (Get-Command "pip" -ErrorAction SilentlyContinue)) {
                Write-Error "pip not found. Please install Python first."
                return $false
            }

            Write-Info "Running pip install (editable)..."
            & pip install -e .

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Successfully installed Python dependencies for $AppName"
            } else {
                Write-Error "Failed to install Python dependencies for $AppName"
                return $false
            }
        }
        # PHP applications (composer.json)
        elseif (Test-Path "composer.json") {
            Write-Success "Detected PHP application (composer.json)"

            # Check if composer is available
            if (-not (Get-Command "composer" -ErrorAction SilentlyContinue)) {
                Write-Error "composer not found. Please install Composer first."
                return $false
            }

            if ($CleanInstall -and (Test-Path "vendor")) {
                Write-Info "Cleaning existing vendor directory..."
                Remove-Item -Recurse -Force "vendor"
            }

            Write-Info "Running composer install..."
            if ($Verbose) {
                & composer install --verbose
            } else {
                & composer install
            }

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Successfully installed PHP dependencies for $AppName"
            } else {
                Write-Error "Failed to install PHP dependencies for $AppName"
                return $false
            }
        }
        # Flutter applications (pubspec.yaml)
        elseif (Test-Path "pubspec.yaml") {
            Write-Success "Detected Flutter application (pubspec.yaml)"

            # Check if flutter is available
            if (-not (Get-Command "flutter" -ErrorAction SilentlyContinue)) {
                Write-Error "flutter not found. Please install Flutter first."
                return $false
            }

            if ($CleanInstall) {
                Write-Info "Running flutter clean..."
                & flutter clean
            }

            Write-Info "Running flutter pub get..."
            & flutter pub get

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Successfully installed Flutter dependencies for $AppName"
            } else {
                Write-Error "Failed to install Flutter dependencies for $AppName"
                return $false
            }
        }
        # Rust applications (Cargo.toml)
        elseif (Test-Path "Cargo.toml") {
            Write-Success "Detected Rust application (Cargo.toml)"

            # Check if cargo is available
            if (-not (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
                Write-Error "cargo not found. Please install Rust first."
                return $false
            }

            if ($CleanInstall -and (Test-Path "target")) {
                Write-Info "Cleaning existing target directory..."
                Remove-Item -Recurse -Force "target"
            }

            Write-Info "Running cargo build..."
            & cargo build

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Successfully built Rust dependencies for $AppName"
            } else {
                Write-Error "Failed to build Rust dependencies for $AppName"
                return $false
            }
        }
        else {
            Write-Warning "No recognized dependency file found for $AppName"
            Write-Info "Supported files: package.json, requirements.txt, pyproject.toml, composer.json, pubspec.yaml, Cargo.toml"
            return $false
        }

        return $true
    }
    catch {
        Write-Error "Error installing dependencies for ${AppName}: $_"
        return $false
    }
    finally {
        Set-Location $originalLocation
    }
}

# Function to get all available applications
function Get-AvailableApplications {
    $apps = @()

    # Check regular apps directory
    $appsPath = Join-Path $PROJECT_ROOT "apps"
    if (Test-Path $appsPath -PathType Container) {
        $appDirectories = Get-ChildItem -Path $appsPath -Directory
        foreach ($dir in $appDirectories) {
            $apps += @{
                Name = $dir.Name
                Path = $dir.FullName
                Type = "app"
            }
        }
    }

    # Check poly apps directory
    $polyAppsPath = Join-Path $PROJECT_ROOT "poly_apps"
    if (Test-Path $polyAppsPath -PathType Container) {
        $polyAppDirectories = Get-ChildItem -Path $polyAppsPath -Directory
        foreach ($dir in $polyAppDirectories) {
            $apps += @{
                Name = $dir.Name
                Path = $dir.FullName
                Type = "poly-app"
            }
        }
    }

    return $apps
}

# Function to show available applications
function Show-AvailableApplications {
    $apps = Get-AvailableApplications

    if ($apps.Count -eq 0) {
        Write-Warning "No applications found"
        return
    }

    Write-Info "Available Applications:"
    Write-Host ""

    for ($i = 0; $i -lt $apps.Count; $i++) {
        $app = $apps[$i]
        $depFile = ""

        # Detect dependency file
        $depFiles = @("package.json", "requirements.txt", "pyproject.toml", "composer.json", "pubspec.yaml", "Cargo.toml")
        foreach ($file in $depFiles) {
            if (Test-Path (Join-Path $app.Path $file)) {
                $depFile = $file
                break
            }
        }

        $status = if ($depFile) { "[$depFile]" } else { "[No deps]" }
        Write-Host "$($i + 1). $($app.Name) ($($app.Type)) $status" -ForegroundColor Cyan
    }

    Write-Host ""
}

# Function for interactive application selection
function Get-InteractiveSelection {
    $apps = Get-AvailableApplications()

    if ($apps.Count -eq 0) {
        Write-Warning "No applications found"
        return @()
    }

    Show-AvailableApplications
    Write-Info "Enter app numbers to install dependencies (comma-separated), 'all' for all apps, or 'q' to quit:"
    $selection = Read-Host

    if ([string]::IsNullOrWhiteSpace($selection) -or $selection -eq 'q') {
        return @()
    }

    if ($selection -eq 'all') {
        return $apps
    }

    $selectedApps = @()
    $numbers = $selection -split ',' | ForEach-Object { $_.Trim() }

    foreach ($num in $numbers) {
        if ($num -match '^\d+$') {
            $index = [int]$num - 1
            if ($index -ge 0 -and $index -lt $apps.Count) {
                $selectedApps += $apps[$index]
            } else {
                Write-Warning "Invalid app number: $num"
            }
        } else {
            Write-Warning "Invalid input: $num"
        }
    }

    return $selectedApps
}

# Function to install dependencies for multiple applications
function Install-MultipleAppsDependencies {
    param([array]$Applications)

    $successCount = 0
    $failedCount = 0
    $failedApps = @()

    Write-Info "Installing dependencies for $($Applications.Count) applications..."
    Write-Host ""

    foreach ($app in $Applications) {
        Write-Info "Processing: $($app.Name)"

        $result = Install-AppDependencies -AppPath $app.Path -AppName $app.Name -ForceReinstall $Force -CleanInstall $Clean

        if ($result) {
            $successCount++
        } else {
            $failedCount++
            $failedApps += $app.Name
        }

        Write-Host ""
    }

    # Summary
    Write-Info "Installation Summary:"
    Write-Success "Successfully processed: $successCount applications"

    if ($failedCount -gt 0) {
        Write-Error "Failed to process: $failedCount applications"
        Write-Error "Failed apps: $($failedApps -join ', ')"
    }
}

# Main execution function
function Start-InstallAll {
    if ($List) {
        Show-AvailableApplications
        return
    }

    $appsToProcess = @()

    if ($Interactive -or ($Apps.Count -eq 0 -and -not $All)) {
        # Interactive mode
        $appsToProcess = Get-InteractiveSelection
        if ($appsToProcess.Count -eq 0) {
            Write-Info "No applications selected"
            return
        }
    }
    elseif ($All) {
        # Install for all applications
        $appsToProcess = Get-AvailableApplications
        if ($appsToProcess.Count -eq 0) {
            Write-Warning "No applications found"
            return
        }
    }
    elseif ($Apps.Count -gt 0) {
        # Specific applications
        $allApps = Get-AvailableApplications
        foreach ($appName in $Apps) {
            $foundApp = $allApps | Where-Object { $_.Name -eq $appName }
            if ($foundApp) {
                $appsToProcess += $foundApp
            } else {
                Write-Warning "Application not found: $appName"
            }
        }

        if ($appsToProcess.Count -eq 0) {
            Write-Error "No valid applications found from input: $($Apps -join ', ')"
            return
        }
    }

    Install-MultipleAppsDependencies -Applications $appsToProcess
}

# Main execution
Start-InstallAll