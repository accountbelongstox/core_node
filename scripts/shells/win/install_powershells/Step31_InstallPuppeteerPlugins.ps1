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

$ScriptCurrentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ParentDirLevel1 = Split-Path -Parent $ScriptCurrentDir
$ParentDirLevel2 = Split-Path -Parent $ParentDirLevel1
$ScriptIndex = "27"

Write-Host "[$ScriptIndex] Installing Puppeteer Anti-Detection Plugins..."

# Function to install npm package
function Install-NpmPackage {
    param (
        [string]$PackageName
    )

    Write-Host "[$ScriptIndex] Installing $PackageName..."

    try {
        $result = npm install -g $PackageName 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[$ScriptIndex] $PackageName installed successfully" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[$ScriptIndex] Failed to install $PackageName" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "[$ScriptIndex] Error installing $PackageName : $_" -ForegroundColor Red
        return $false
    }
}

# Install Git if not present (required for rebrowser-patches)
$gitExePath = $Global:GIT_EXE_PATH
if (-not (Test-Path $gitExePath)) {
    Write-Host "[$ScriptIndex] Git not found at $gitExePath. Please install Git first for patch support." -ForegroundColor Yellow
} else {
    Write-Host "[$ScriptIndex] Git found at: $gitExePath" -ForegroundColor Green

    # Add Git usr/bin to PATH for patch command
    $gitUsrBin = Join-Path (Split-Path (Split-Path $gitExePath -Parent) -Parent) "usr\bin"
    if (Test-Path $gitUsrBin) {
        $env:PATH = "$env:PATH;$gitUsrBin"
        Write-Host "[$ScriptIndex] Added Git usr/bin to PATH: $gitUsrBin" -ForegroundColor Green
    }
}

# Install rebrowser packages (best anti-detection)
Write-Host "[$ScriptIndex] Installing rebrowser packages..."
Install-NpmPackage "rebrowser-puppeteer-core"
Install-NpmPackage "rebrowser-puppeteer"

# Install puppeteer-real-browser
Write-Host "[$ScriptIndex] Installing puppeteer-real-browser..."
Install-NpmPackage "puppeteer-real-browser"

# Install puppeteer-extra and plugins
Write-Host "[$ScriptIndex] Installing puppeteer-extra and plugins..."
Install-NpmPackage "puppeteer-extra"
Install-NpmPackage "puppeteer-extra-plugin-stealth"
Install-NpmPackage "puppeteer-extra-plugin-adblocker"
Install-NpmPackage "puppeteer-extra-plugin-anonymize-ua"
Install-NpmPackage "puppeteer-extra-plugin-user-preferences"
Install-NpmPackage "puppeteer-extra-plugin-recaptcha"
Install-NpmPackage "puppeteer-extra-plugin-block-resources"

# Apply rebrowser patches to puppeteer-core if installed
Write-Host "[$ScriptIndex] Applying rebrowser patches..."
$puppeteerCoreInstalled = npm list -g puppeteer-core 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[$ScriptIndex] Patching puppeteer-core with rebrowser-patches..."
    try {
        npx rebrowser-patches@latest patch --packageName puppeteer-core
    } catch {
        Write-Host "[$ScriptIndex] Warning: Failed to apply patches: $_" -ForegroundColor Yellow
    }
}

Write-Host "[$ScriptIndex] Puppeteer anti-detection plugins installation completed" -ForegroundColor Green
Write-Host "[$ScriptIndex] Installed packages:"
Write-Host "[$ScriptIndex]   - rebrowser-puppeteer-core (best anti-detection)"
Write-Host "[$ScriptIndex]   - rebrowser-puppeteer"
Write-Host "[$ScriptIndex]   - puppeteer-real-browser"
Write-Host "[$ScriptIndex]   - puppeteer-extra + stealth, adblocker, anonymize-ua plugins"
