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

# Prerequisites Check and Auto-Installation

function Test-CommandExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Stop'

    try {
        if (Get-Command $Command -ErrorAction Stop) {
            return $true
        }
    }
    catch {
        return $false
    }
    finally {
        $ErrorActionPreference = $oldPreference
    }

    return $false
}

function Install-NodeJS {
    Write-Host ""
    Write-Host "[INFO] Node.js is not installed on this system" -ForegroundColor Yellow
    Write-Host "[INFO] Node.js is required to run Nuxt applications" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please install Node.js from one of the following sources:" -ForegroundColor Cyan
    Write-Host "  1. Official website: https://nodejs.org/" -ForegroundColor White
    Write-Host "  2. Using winget: winget install OpenJS.NodeJS.LTS" -ForegroundColor White
    Write-Host "  3. Using Chocolatey: choco install nodejs-lts" -ForegroundColor White
    Write-Host ""

    $response = Read-Host "Would you like to open the Node.js download page? (Y/N)"

    if ($response -eq 'Y' -or $response -eq 'y') {
        Start-Process "https://nodejs.org/"
    }

    Write-Host ""
    Write-Host "[ERROR] Please install Node.js and run this script again" -ForegroundColor Red
    exit 1
}

function Install-Yarn {
    Write-Host ""
    Write-Host "[INFO] Yarn is not installed, installing via npm..." -ForegroundColor Yellow

    try {
        npm install -g yarn

        if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) {
            Write-Host "[SUCCESS] Yarn installed successfully" -ForegroundColor Green
            return $true
        }
        else {
            Write-Host "[ERROR] Failed to install Yarn" -ForegroundColor Red
            Write-Host "Press any key to exit..." -ForegroundColor Cyan
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            exit 1
        }
    }
    catch {
        Write-Host "[ERROR] Failed to install Yarn: $_" -ForegroundColor Red
        Write-Host "Press any key to exit..." -ForegroundColor Cyan
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

function Install-NodeModules {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory
    )

    $nodeModulesPath = Join-Path $AppDirectory "node_modules"

    if (-not (Test-Path $nodeModulesPath)) {
        Write-Host ""
        Write-Host "[INFO] node_modules not found, installing dependencies..." -ForegroundColor Yellow
        Write-Host ""

        Push-Location $AppDirectory

        try {
            yarn install

            if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) {
                Write-Host ""
                Write-Host "[SUCCESS] Dependencies installed successfully" -ForegroundColor Green
            }
            else {
                Write-Host ""
                Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
                Write-Host "Exit code: $LASTEXITCODE" -ForegroundColor Yellow
                Write-Host "Press any key to exit..." -ForegroundColor Cyan
                Pop-Location
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                exit 1
            }
        }
        catch {
            Write-Host ""
            Write-Host "[ERROR] Failed to install dependencies: $_" -ForegroundColor Red
            Write-Host "Press any key to exit..." -ForegroundColor Cyan
            Pop-Location
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            exit 1
        }
        finally {
            Pop-Location
        }
    }
}

function Test-Prerequisites {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory
    )

    Write-Host ""
    Write-Host "=== Checking Prerequisites ===" -ForegroundColor Cyan
    Write-Host ""

    if (-not (Test-CommandExists "node")) {
        Install-NodeJS
    }
    else {
        $nodeVersion = node --version
        Write-Host "[OK] Node.js is installed: $nodeVersion" -ForegroundColor Green
    }

    if (-not (Test-CommandExists "yarn")) {
        $yarnInstalled = Install-Yarn
        if (-not $yarnInstalled) {
            Write-Host "[ERROR] Cannot proceed without Yarn" -ForegroundColor Red
            exit 1
        }
    }
    else {
        $yarnVersion = yarn --version
        Write-Host "[OK] Yarn is installed: $yarnVersion" -ForegroundColor Green
    }

    Install-NodeModules -AppDirectory $AppDirectory

    Write-Host ""
    Write-Host "[SUCCESS] All prerequisites are met" -ForegroundColor Green
    Write-Host ""
}
