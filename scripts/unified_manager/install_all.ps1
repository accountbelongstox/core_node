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

# Unified Manager - Install All Dependencies
# Installs dependencies for all applications in the project

param(
    [string]$Type = "all",           # all, node, poly, python
    [string[]]$Apps = @(),           # Specific apps to install
    [switch]$Force = $false,         # Force reinstall
    [switch]$Parallel = $false,      # Install in parallel
    [switch]$SkipRoot = $false,      # Skip root package.json
    [switch]$Verbose = $false        # Verbose output
)

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$UTILS_PATH = Join-Path $SCRIPT_DIR "common\utils.ps1"
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $SCRIPT_DIR)
$ROOT_PACKAGE_JSON = Join-Path $PROJECT_ROOT "package.json"

# Import utilities
. $UTILS_PATH

# Function to install root dependencies
function Install-RootDependencies {
    if ($SkipRoot) {
        Write-Info "Skipping root dependencies installation"
        return $true
    }
    
    if (-not (Test-Path $ROOT_PACKAGE_JSON)) {
        Write-Warning "Root package.json not found, skipping root dependencies"
        return $true
    }
    
    Write-Info "Installing root dependencies..."
    
    Invoke-InDirectory -Path $PROJECT_ROOT -ScriptBlock {
        if ($Verbose) {
            npm install --verbose
        } else {
            npm install
        }
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install root dependencies"
            return $false
        }
    }
    
    Write-Success "Root dependencies installed successfully"
    return $true
}

# Function to install Node.js app dependencies
function Install-NodeAppDependencies {
    param([object]$AppConfig, [string]$AppName)
    
    $appPath = Get-AppPath -AppName $AppName
    if (-not $appPath) {
        return $false
    }
    
    Write-Info "Installing dependencies for Node.js app: $AppName"
    
    # Node.js apps typically use root package.json
    if (Test-Path (Join-Path $appPath "package.json")) {
        Invoke-InDirectory -Path $appPath -ScriptBlock {
            if ($Verbose) {
                npm install --verbose
            } else {
                npm install
            }
            
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to install dependencies for $AppName"
                return $false
            }
        }
    } else {
        Write-Info "$AppName uses root dependencies (no local package.json)"
    }
    
    return $true
}

# Function to install Python app dependencies
function Install-PythonAppDependencies {
    param([object]$AppConfig, [string]$AppName)
    
    $appPath = Get-AppPath -AppName $AppName
    if (-not $appPath) {
        return $false
    }
    
    Write-Info "Installing dependencies for Python app: $AppName"
    
    $requirementsFile = Join-Path $appPath "requirements.txt"
    if (Test-Path $requirementsFile) {
        if (-not (Test-Command "python")) {
            Write-Error "Python not found. Please install Python first."
            return $false
        }
        
        if (-not (Test-Command "pip")) {
            Write-Error "pip not found. Please install pip first."
            return $false
        }
        
        Invoke-InDirectory -Path $appPath -ScriptBlock {
            if ($Verbose) {
                pip install -r requirements.txt --verbose
            } else {
                pip install -r requirements.txt
            }
            
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to install Python dependencies for $AppName"
                return $false
            }
        }
    } else {
        Write-Warning "No requirements.txt found for $AppName"
    }
    
    return $true
}

# Function to install Poly app dependencies
function Install-PolyAppDependencies {
    param([object]$AppConfig, [string]$AppName)
    
    $appPath = Get-AppPath -AppName $AppName
    if (-not $appPath) {
        return $false
    }
    
    Write-Info "Installing dependencies for Poly app: $AppName"
    
    $installCmd = $AppConfig.install_cmd
    if (-not $installCmd) {
        Write-Warning "No install command specified for $AppName"
        return $true
    }
    
    # Determine package manager and check if it exists
    $packageManager = $installCmd.Split()[0]
    
    switch ($packageManager) {
        "npm" {
            if (-not (Test-Command "npm")) {
                Write-Error "npm not found. Please install Node.js first."
                return $false
            }
        }
        "yarn" {
            if (-not (Test-Command "yarn")) {
                Write-Error "yarn not found. Please install yarn first."
                return $false
            }
        }
        "pnpm" {
            if (-not (Test-Command "pnpm")) {
                Write-Error "pnpm not found. Please install pnpm first."
                return $false
            }
        }
        "composer" {
            if (-not (Test-Command "composer")) {
                Write-Error "composer not found. Please install Composer first."
                return $false
            }
        }
        "flutter" {
            if (-not (Test-Command "flutter")) {
                Write-Error "flutter not found. Please install Flutter first."
                return $false
            }
        }
        default {
            Write-Warning "Unknown package manager: $packageManager"
        }
    }
    
    Invoke-InDirectory -Path $appPath -ScriptBlock {
        if ($Verbose) {
            Write-Info "Executing: $installCmd"
        }
        
        Invoke-Expression $installCmd
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install dependencies for $AppName"
            return $false
        }
    }
    
    return $true
}

# Function to install app dependencies
function Install-AppDependencies {
    param([string]$AppName)

    $appConfig = Get-AppConfig -AppIdentifier $AppName
    if (-not $appConfig) {
        return $false
    }

    if (-not (Test-AppExists -AppIdentifier $appConfig)) {
        Write-Error "Application directory not found: $AppName"
        return $false
    }
    
    $success = $false
    switch ($appConfig.type) {
        "ncore-app" {
            $success = Install-NodeAppDependencies -AppConfig $appConfig -AppName $AppName
        }
        "python" {
            $success = Install-PythonAppDependencies -AppConfig $appConfig -AppName $AppName
        }
        "poly-vue" {
            $success = Install-PolyAppDependencies -AppConfig $appConfig -AppName $AppName
        }
        "poly-laravel" {
            $success = Install-PolyAppDependencies -AppConfig $appConfig -AppName $AppName
        }
        "poly-flutter" {
            $success = Install-PolyAppDependencies -AppConfig $appConfig -AppName $AppName
        }
        default {
            Write-Warning "Unknown application type: $($appConfig.type) for $AppName"
            $success = $true
        }
    }
    
    if ($success) {
        Write-Success "Dependencies installed successfully for $AppName"
    }
    
    return $success
}

# Function to get apps to install based on filters
function Get-AppsToInstall {
    $registry = Get-AppRegistry
    if (-not $registry) {
        return @()
    }
    
    $appsToInstall = @()
    
    if ($Apps.Count -gt 0) {
        # Install specific apps
        $appsToInstall = $Apps
    } else {
        # Install based on type filter
        foreach ($appName in $registry.apps.PSObject.Properties.Name) {
            $appConfig = $registry.apps.$appName
            
            if ($Type -eq "all" -or $appConfig.type -eq $Type) {
                $appsToInstall += $appName
            }
        }
    }
    
    return $appsToInstall
}

# Main installation function
function Start-Installation {
    Write-Info "Starting dependency installation..."
    Write-Info "Type filter: $Type"
    Write-Info "Force reinstall: $Force"
    Write-Info "Parallel execution: $Parallel"
    
    # Install root dependencies first
    if (-not (Install-RootDependencies)) {
        Write-Error "Failed to install root dependencies"
        return $false
    }
    
    # Get apps to install
    $appsToInstall = Get-AppsToInstall
    if ($appsToInstall.Count -eq 0) {
        Write-Warning "No applications found to install"
        return $true
    }
    
    Write-Info "Installing dependencies for $($appsToInstall.Count) applications: $($appsToInstall -join ', ')"
    
    $failedApps = @()
    $successfulApps = @()
    
    if ($Parallel) {
        # Parallel installation (simplified version)
        Write-Info "Installing dependencies in parallel..."
        $jobs = @()
        
        foreach ($app in $appsToInstall) {
            $job = Start-Job -ScriptBlock {
                param($AppName, $UtilsPath)
                . $UtilsPath
                Install-AppDependencies -AppName $AppName
            } -ArgumentList $app, $UTILS_PATH
            
            $jobs += @{Job = $job; AppName = $app}
        }
        
        # Wait for all jobs to complete
        foreach ($jobInfo in $jobs) {
            $result = Receive-Job -Job $jobInfo.Job -Wait
            Remove-Job -Job $jobInfo.Job
            
            if ($result) {
                $successfulApps += $jobInfo.AppName
            } else {
                $failedApps += $jobInfo.AppName
            }
        }
    } else {
        # Sequential installation
        foreach ($app in $appsToInstall) {
            if (Install-AppDependencies -AppName $app) {
                $successfulApps += $app
            } else {
                $failedApps += $app
            }
        }
    }
    
    # Report results
    Write-Info "Installation completed"
    Write-Success "Successfully installed: $($successfulApps.Count) apps"
    if ($successfulApps.Count -gt 0) {
        Write-Info "  - $($successfulApps -join ', ')"
    }
    
    if ($failedApps.Count -gt 0) {
        Write-Error "Failed to install: $($failedApps.Count) apps"
        Write-Error "  - $($failedApps -join ', ')"
        return $false
    }
    
    return $true
}

# Main execution
if (-not (Test-Path $UTILS_PATH)) {
    Write-Error "Utilities not found: $UTILS_PATH"
    exit 1
}

$success = Start-Installation
if (-not $success) {
    exit 1
}

Write-Success "All dependencies installed successfully!"
exit 0
