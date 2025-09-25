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

# Unified Manager - Build Applications
# Builds one or multiple applications in the project

param(
    [string[]]$Apps = @(),           # Specific apps to build
    [switch]$All = $false,           # Build all applications
    [switch]$Interactive = $false,   # Interactive mode for app selection
    [switch]$List = $false,          # List available apps
    [switch]$Verbose = $false,       # Verbose output
    [switch]$Clean = $false,         # Clean build (remove existing build artifacts first)
    [switch]$Production = $false,    # Production build
    [switch]$Development = $false,   # Development build
    [string]$BuildType = "default"   # Build type (default, production, development)
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

# Determine build type from switches
if ($Production) {
    $BuildType = "production"
} elseif ($Development) {
    $BuildType = "development"
}

# Function to build a single application
function Build-SingleApplication {
    param(
        [string]$AppPath,
        [string]$AppName,
        [string]$BuildMode = "default",
        [bool]$CleanBuild = $false
    )

    Write-Info "Building application: $AppName"
    Write-Info "  Path: $AppPath"
    Write-Info "  Build Mode: $BuildMode"

    $originalLocation = Get-Location

    try {
        Set-Location $AppPath

        # Node.js applications (package.json)
        if (Test-Path "package.json") {
            Write-Success "Detected Node.js application (package.json)"

            if ($CleanBuild) {
                # Clean node_modules and build artifacts
                if (Test-Path "node_modules") {
                    Write-Info "Cleaning node_modules..."
                    Remove-Item -Recurse -Force "node_modules"
                }
                if (Test-Path "dist") {
                    Write-Info "Cleaning dist directory..."
                    Remove-Item -Recurse -Force "dist"
                }
                if (Test-Path "build") {
                    Write-Info "Cleaning build directory..."
                    Remove-Item -Recurse -Force "build"
                }
            }

            # Check if npm is available
            if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
                Write-Error "npm not found. Please install Node.js first."
                return $false
            }

            # Install dependencies if needed
            if (-not (Test-Path "node_modules")) {
                Write-Info "Installing dependencies..."
                & npm install
                if ($LASTEXITCODE -ne 0) {
                    Write-Error "Failed to install dependencies"
                    return $false
                }
            }

            # Determine build command
            $buildCommand = "npm run build"

            # Check package.json for specific build scripts
            $packageJson = Get-Content "package.json" | ConvertFrom-Json
            if ($packageJson.scripts) {
                switch ($BuildMode) {
                    "production" {
                        if ($packageJson.scripts."build:prod") {
                            $buildCommand = "npm run build:prod"
                        } elseif ($packageJson.scripts."build:production") {
                            $buildCommand = "npm run build:production"
                        }
                    }
                    "development" {
                        if ($packageJson.scripts."build:dev") {
                            $buildCommand = "npm run build:dev"
                        } elseif ($packageJson.scripts."build:development") {
                            $buildCommand = "npm run build:development"
                        }
                    }
                }

                # Check if build script exists
                if (-not $packageJson.scripts.build -and -not $packageJson.scripts."build:prod" -and -not $packageJson.scripts."build:dev") {
                    Write-Warning "No build script found in package.json for $AppName"
                    return $false
                }
            }

            Write-Info "Running: $buildCommand"
            if ($Verbose) {
                & cmd /c $buildCommand
            } else {
                & cmd /c "$buildCommand 2>&1"
            }

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Successfully built Node.js application: $AppName"
            } else {
                Write-Error "Failed to build Node.js application: $AppName"
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

            if ($CleanBuild) {
                Write-Info "Running flutter clean..."
                & flutter clean
            }

            # Get dependencies
            Write-Info "Getting Flutter dependencies..."
            & flutter pub get
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to get Flutter dependencies"
                return $false
            }

            # Determine build command
            $buildCommand = switch ($BuildMode) {
                "production" { "flutter build apk --release" }
                "development" { "flutter build apk --debug" }
                default { "flutter build apk" }
            }

            Write-Info "Running: $buildCommand"
            & cmd /c $buildCommand

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Successfully built Flutter application: $AppName"
            } else {
                Write-Error "Failed to build Flutter application: $AppName"
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

            if ($CleanBuild) {
                Write-Info "Running cargo clean..."
                & cargo clean
            }

            # Determine build command
            $buildCommand = switch ($BuildMode) {
                "production" { "cargo build --release" }
                "development" { "cargo build" }
                default { "cargo build" }
            }

            Write-Info "Running: $buildCommand"
            & cargo build $(if ($BuildMode -eq "production") { "--release" })

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Successfully built Rust application: $AppName"
            } else {
                Write-Error "Failed to build Rust application: $AppName"
                return $false
            }
        }
        # Go applications (go.mod)
        elseif (Test-Path "go.mod") {
            Write-Success "Detected Go application (go.mod)"

            # Check if go is available
            if (-not (Get-Command "go" -ErrorAction SilentlyContinue)) {
                Write-Error "go not found. Please install Go first."
                return $false
            }

            if ($CleanBuild) {
                Write-Info "Cleaning Go module cache..."
                & go clean -modcache
            }

            Write-Info "Running: go build"
            & go build

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Successfully built Go application: $AppName"
            } else {
                Write-Error "Failed to build Go application: $AppName"
                return $false
            }
        }
        # Python applications (setup.py or pyproject.toml)
        elseif (Test-Path "setup.py" -or Test-Path "pyproject.toml") {
            Write-Success "Detected Python application"

            # Check if python is available
            if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
                Write-Error "python not found. Please install Python first."
                return $false
            }

            if ($CleanBuild) {
                # Clean build artifacts
                if (Test-Path "build") {
                    Write-Info "Cleaning build directory..."
                    Remove-Item -Recurse -Force "build"
                }
                if (Test-Path "dist") {
                    Write-Info "Cleaning dist directory..."
                    Remove-Item -Recurse -Force "dist"
                }
                Get-ChildItem -Path . -Filter "*.egg-info" -Directory | Remove-Item -Recurse -Force
            }

            if (Test-Path "pyproject.toml") {
                Write-Info "Building with pip (pyproject.toml)..."
                & python -m pip install -e .
            } else {
                Write-Info "Building with setup.py..."
                & python setup.py build
            }

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Successfully built Python application: $AppName"
            } else {
                Write-Error "Failed to build Python application: $AppName"
                return $false
            }
        }
        # .NET applications (*.csproj, *.sln)
        elseif ((Get-ChildItem -Filter "*.csproj" -ErrorAction SilentlyContinue) -or (Get-ChildItem -Filter "*.sln" -ErrorAction SilentlyContinue)) {
            Write-Success "Detected .NET application"

            # Check if dotnet is available
            if (-not (Get-Command "dotnet" -ErrorAction SilentlyContinue)) {
                Write-Error "dotnet not found. Please install .NET SDK first."
                return $false
            }

            if ($CleanBuild) {
                Write-Info "Running dotnet clean..."
                & dotnet clean
            }

            # Determine build configuration
            $configuration = switch ($BuildMode) {
                "production" { "Release" }
                "development" { "Debug" }
                default { "Release" }
            }

            Write-Info "Running: dotnet build --configuration $configuration"
            & dotnet build --configuration $configuration

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Successfully built .NET application: $AppName"
            } else {
                Write-Error "Failed to build .NET application: $AppName"
                return $false
            }
        }
        else {
            Write-Warning "No recognized build file found for $AppName"
            Write-Info "Supported files: package.json, pubspec.yaml, Cargo.toml, go.mod, setup.py, pyproject.toml, *.csproj, *.sln"
            return $false
        }

        return $true
    }
    catch {
        Write-Error "Error building ${AppName}: $_"
        return $false
    }
    finally {
        Set-Location $originalLocation
    }
}

# Function to get all buildable applications
function Get-BuildableApplications {
    $apps = @()

    # Check regular apps directory
    $appsPath = Join-Path $PROJECT_ROOT "apps"
    if (Test-Path $appsPath -PathType Container) {
        $appDirectories = Get-ChildItem -Path $appsPath -Directory
        foreach ($dir in $appDirectories) {
            # Check if app has buildable files
            $hasBuildFile = $false
            $buildFiles = @("package.json", "pubspec.yaml", "Cargo.toml", "go.mod", "setup.py", "pyproject.toml")
            foreach ($file in $buildFiles) {
                if (Test-Path (Join-Path $dir.FullName $file)) {
                    $hasBuildFile = $true
                    break
                }
            }

            # Check for .NET files
            if (-not $hasBuildFile) {
                $csprojFiles = Get-ChildItem -Path $dir.FullName -Filter "*.csproj" -ErrorAction SilentlyContinue
                $slnFiles = Get-ChildItem -Path $dir.FullName -Filter "*.sln" -ErrorAction SilentlyContinue
                if ($csprojFiles -or $slnFiles) {
                    $hasBuildFile = $true
                }
            }

            if ($hasBuildFile) {
                $apps += @{
                    Name = $dir.Name
                    Path = $dir.FullName
                    Type = "app"
                }
            }
        }
    }

    # Check poly apps directory
    $polyAppsPath = Join-Path $PROJECT_ROOT "poly_apps"
    if (Test-Path $polyAppsPath -PathType Container) {
        $polyAppDirectories = Get-ChildItem -Path $polyAppsPath -Directory
        foreach ($dir in $polyAppDirectories) {
            # Check if app has buildable files
            $hasBuildFile = $false
            $buildFiles = @("package.json", "pubspec.yaml", "Cargo.toml", "go.mod", "setup.py", "pyproject.toml")
            foreach ($file in $buildFiles) {
                if (Test-Path (Join-Path $dir.FullName $file)) {
                    $hasBuildFile = $true
                    break
                }
            }

            # Check for .NET files
            if (-not $hasBuildFile) {
                $csprojFiles = Get-ChildItem -Path $dir.FullName -Filter "*.csproj" -ErrorAction SilentlyContinue
                $slnFiles = Get-ChildItem -Path $dir.FullName -Filter "*.sln" -ErrorAction SilentlyContinue
                if ($csprojFiles -or $slnFiles) {
                    $hasBuildFile = $true
                }
            }

            if ($hasBuildFile) {
                $apps += @{
                    Name = $dir.Name
                    Path = $dir.FullName
                    Type = "poly-app"
                }
            }
        }
    }

    return $apps
}

# Function to show buildable applications
function Show-BuildableApplications {
    $apps = Get-BuildableApplications

    if ($apps.Count -eq 0) {
        Write-Warning "No buildable applications found"
        return
    }

    Write-Info "Buildable Applications:"
    Write-Host ""

    for ($i = 0; $i -lt $apps.Count; $i++) {
        $app = $apps[$i]
        $buildFile = ""

        # Detect build file
        $buildFiles = @("package.json", "pubspec.yaml", "Cargo.toml", "go.mod", "setup.py", "pyproject.toml")
        foreach ($file in $buildFiles) {
            if (Test-Path (Join-Path $app.Path $file)) {
                $buildFile = $file
                break
            fi
        }

        # Check for .NET files
        if (-not $buildFile) {
            $csprojFiles = Get-ChildItem -Path $app.Path -Filter "*.csproj" -ErrorAction SilentlyContinue
            $slnFiles = Get-ChildItem -Path $app.Path -Filter "*.sln" -ErrorAction SilentlyContinue
            if ($csprojFiles) {
                $buildFile = "*.csproj"
            } elseif ($slnFiles) {
                $buildFile = "*.sln"
            }
        }

        $status = if ($buildFile) { "[$buildFile]" } else { "[Unknown]" }
        Write-Host "$($i + 1). $($app.Name) ($($app.Type)) $status" -ForegroundColor Cyan
    }

    Write-Host ""
}

# Function for interactive application selection
function Get-InteractiveSelection {
    $apps = Get-BuildableApplications

    if ($apps.Count -eq 0) {
        Write-Warning "No buildable applications found"
        return @()
    }

    Show-BuildableApplications
    Write-Info "Enter app numbers to build (comma-separated), 'all' for all apps, or 'q' to quit:"
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

# Function to build multiple applications
function Build-MultipleApplications {
    param([array]$Applications)

    $successCount = 0
    $failedCount = 0
    $failedApps = @()

    Write-Info "Building $($Applications.Count) applications..."
    Write-Host ""

    foreach ($app in $Applications) {
        Write-Info "Processing: $($app.Name)"

        $result = Build-SingleApplication -AppPath $app.Path -AppName $app.Name -BuildMode $BuildType -CleanBuild $Clean

        if ($result) {
            $successCount++
        } else {
            $failedCount++
            $failedApps += $app.Name
        }

        Write-Host ""
    }

    # Summary
    Write-Info "Build Summary:"
    Write-Success "Successfully built: $successCount applications"

    if ($failedCount -gt 0) {
        Write-Error "Failed to build: $failedCount applications"
        Write-Error "Failed apps: $($failedApps -join ', ')"
    }
}

# Main execution function
function Start-BuildApps {
    if ($List) {
        Show-BuildableApplications
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
        # Build all applications
        $appsToProcess = Get-BuildableApplications
        if ($appsToProcess.Count -eq 0) {
            Write-Warning "No buildable applications found"
            return
        }
    }
    elseif ($Apps.Count -gt 0) {
        # Specific applications
        $allApps = Get-BuildableApplications
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

    Build-MultipleApplications -Applications $appsToProcess
}

# Main execution
Start-BuildApps