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

# PowerShell Package Installation Manager
# Equivalent to Python's install_pypackages.py

# Hard-coded paths and variables
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# Create cache directory in AppData
$cacheBase = Join-Path $env:APPDATA ".build_flutter_bloom"
$BGCacheDir = Join-Path $cacheBase "py_packages"
$FlagsDir = Join-Path $BGCacheDir "flags"

# Ensure cache directories exist
if (-not (Test-Path $cacheBase)) {
    New-Item -ItemType Directory -Path $cacheBase -Force | Out-Null
}
if (-not (Test-Path $BGCacheDir)) {
    New-Item -ItemType Directory -Path $BGCacheDir -Force | Out-Null
}
if (-not (Test-Path $FlagsDir)) {
    New-Item -ItemType Directory -Path $FlagsDir -Force | Out-Null
}

$pipUpgraded = $false

function Write-Separator {
    param (
        [string]$Char = "=",
        [int]$Length = 80
    )
    Write-Host ($Char * $Length)
}

function Install-Package {
    param (
        [string]$PackageName
    )
    
    $flagFile = Join-Path $FlagsDir ("$PackageName.flag")
    if (Test-Path $flagFile) {
        Write-Host "Package $PackageName is already installed (flag file exists)" -ForegroundColor Green
        return $true
    }

    try {
        Write-Host "Starting installation of $PackageName..." -ForegroundColor Yellow
        $result = python -m pip install $PackageName 2>&1
        $output = $result | Out-String

        # Check for pip upgrade notice
        if (-not $script:pipUpgraded -and $output -match "To update, run: python.exe -m pip install --upgrade pip") {
            Write-Host "Upgrading pip..." -ForegroundColor Yellow
            python -m pip install --upgrade pip
            $script:pipUpgraded = $true
            
            Write-Host "Retrying package installation after pip upgrade..." -ForegroundColor Yellow
            $result = python -m pip install $PackageName 2>&1
            $output = $result | Out-String
        }

        if ($LASTEXITCODE -eq 0) {
            # Create flag file
            New-Item -ItemType File -Path $flagFile -Force | Out-Null
            Write-Host "Successfully installed $PackageName" -ForegroundColor Green
            Write-Host "Installation output:" -ForegroundColor Gray
            Write-Host $output -ForegroundColor Gray
            return $true
        } else {
            Write-Host "Failed to install $PackageName" -ForegroundColor Red
            Write-Host "Error output:" -ForegroundColor Red
            Write-Host $output -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "Exception occurred while installing $PackageName" -ForegroundColor Red
        Write-Host "Error details: $_" -ForegroundColor Red
        return $false
    }
}

# Main script execution
# Check if configuration file exists
$configFile = Join-Path $scriptPath "python_packages.json"
if (-not (Test-Path $configFile)) {
    Write-Host "Error: Configuration file 'python_packages.json' not found!" -ForegroundColor Red
    Write-Host "Please ensure the configuration file exists in: $scriptPath" -ForegroundColor Red
    exit 1
}

$testScriptPath = Join-Path $scriptPath "packag_test.py"

# First check if all packages are already installed (silent mode)
$initialCheck = python $testScriptPath "verify" "--silent"
if ($LASTEXITCODE -eq 0) {
    # All packages are installed, just show the summary
    $summary = python $testScriptPath "verify" "--silent"
    Write-Host $summary -ForegroundColor Green
    exit 0
}

# If we get here, we need to install packages
Write-Host "Package Installation Manager"
Write-Separator

# Show package information
Write-Host "`nChecking required packages..."
python $testScriptPath "parse_json"

# Get list of missing packages
Write-Host "`nChecking for missing packages..."
$missingPackages = python $testScriptPath "list_missing" | Where-Object { $_ -ne "" }

if ($missingPackages.Count -eq 0) {
    Write-Host "`nAll required packages are already installed." -ForegroundColor Green
} else {
    Write-Host "`nInstalling missing packages:"
    Write-Separator

    $allSuccess = $true
    foreach ($package in $missingPackages) {
        if (-not (Install-Package -PackageName $package)) {
            $allSuccess = $false
        }
    }

    if ($allSuccess) {
        Write-Host "`nSUCCESS: All required packages installed successfully." -ForegroundColor Green
    } else {
        Write-Host "`nERROR: Some packages failed to install. Please check the logs above." -ForegroundColor Red
        exit 1
    }
}

# Final verification
Write-Host "`nVerifying package installations..."
Write-Separator

$testResult = python $testScriptPath "verify"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSUCCESS: All package verifications passed." -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nERROR: Some package verifications failed. Please check the logs above." -ForegroundColor Red
    exit 1
}
