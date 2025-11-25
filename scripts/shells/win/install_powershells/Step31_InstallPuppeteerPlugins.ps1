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
$WinCommonDir = Join-Path $ParentDirLevel1 "win_common"
$ScriptIndex = "31"

. (Join-Path $WinCommonDir "GlobalVars.ps1")

$NpmExePath = $Global:NPM_EXE_PATH
$NpxExePath = Join-Path (Split-Path $NpmExePath -Parent) "npx.cmd"
$NodeDir = Split-Path $NpmExePath -Parent

Write-Host "[$ScriptIndex] Installing Puppeteer Anti-Detection Plugins..."

# Function to install npm package
function Install-NpmPackage {
    param (
        [string]$PackageName
    )

    Write-Host "[$ScriptIndex] Installing $PackageName..."
    & $NpmExePath install -g $PackageName
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
Write-Host "[$ScriptIndex] Checking if puppeteer-core is installed..."
& $NpmExePath list -g puppeteer-core

Write-Host "[$ScriptIndex] Getting global node_modules path..."
$globalNodeModules = & $NpmExePath root -g
Write-Host "[$ScriptIndex] Global node_modules: $globalNodeModules"

$puppeteerCorePath = Join-Path $globalNodeModules "puppeteer-core"
if (Test-Path $puppeteerCorePath) {
    Write-Host "[$ScriptIndex] Patching puppeteer-core with rebrowser-patches..."
    Write-Host "[$ScriptIndex] Using working directory: $NodeDir"

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $NpxExePath
    $psi.Arguments = "rebrowser-patches@latest patch --packageName puppeteer-core"
    $psi.WorkingDirectory = $NodeDir
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    $process.Start() | Out-Null

    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    if ($stdout) { Write-Host $stdout }
    if ($stderr) { Write-Host $stderr -ForegroundColor Yellow }

    if ($process.ExitCode -eq 0) {
        Write-Host "[$ScriptIndex] Patching completed successfully" -ForegroundColor Green
    } else {
        Write-Host "[$ScriptIndex] Patching failed with exit code: $($process.ExitCode)" -ForegroundColor Yellow
    }
} else {
    Write-Host "[$ScriptIndex] puppeteer-core not found at global location, skipping patches" -ForegroundColor Yellow
}

Write-Host "[$ScriptIndex] Puppeteer anti-detection plugins installation completed" -ForegroundColor Green
Write-Host "[$ScriptIndex] Installed packages:"
Write-Host "[$ScriptIndex]   - rebrowser-puppeteer-core (best anti-detection)"
Write-Host "[$ScriptIndex]   - rebrowser-puppeteer"
Write-Host "[$ScriptIndex]   - puppeteer-real-browser"
Write-Host "[$ScriptIndex]   - puppeteer-extra + stealth, adblocker, anonymize-ua plugins"
