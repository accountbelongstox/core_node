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

# PHP Post-Installation Processor
# Handles PHP configuration, Composer installation, and extension setup
# Enhanced with advanced extension detection and configuration management

# Import required modules
$parentDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. "$parentDir\win_common\GlobalVars.ps1"
. "$parentDir\win_common\CommonFunc.ps1"

function Install-ComposerForPhp {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PhpPath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [string]$LogPrefix = "[PHP-Composer]",
        [bool]$ForceReinstall = $false
    )
    
    
    $composerDir = $InstallDir
    $composerBat = Join-Path $composerDir "composer.bat"
    
    # Check if Composer and PHP are in the same installation directory
    if (-not $ForceReinstall) {
        $phpExeFile = Get-ChildItem -Path $InstallDir -Filter "php.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
        $composerPharFile = Get-ChildItem -Path $InstallDir -Filter "composer.phar" -ErrorAction SilentlyContinue | Select-Object -First 1
        
        if ($phpExeFile -and $composerPharFile) {
            Write-Host "$LogPrefix Composer is already installed in the same directory as PHP" -ForegroundColor Green
            return
        }
    }
    
    if ($ForceReinstall) {
        Write-Host "$LogPrefix Force reinstalling Composer..." -ForegroundColor Yellow
    }
    else {
        Write-Host "$LogPrefix Installing Composer..." -ForegroundColor Yellow
    }
    
    # Create composer directory if it doesn't exist
    if (-not (Test-Path $composerDir)) {
        New-Item -ItemType Directory -Path $composerDir -Force | Out-Null
    }
    
    try {
        # Download Composer installer
        $installerUrl = "https://getcomposer.org/installer"
        $installerPath = Join-Path $Global:DOWNLOADS_DIR "composer-setup.php"
        
        Write-Host "$LogPrefix Downloading Composer installer..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
        
        # Run Composer installer
        Write-Host "$LogPrefix Running Composer installer..." -ForegroundColor Yellow
        & $PhpPath $installerPath --install-dir="$composerDir" --filename=composer.phar
        
        # Verify installation by scanning binary files
        $composerPharFile = Get-ChildItem -Path $composerDir -Filter "composer.phar" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($composerPharFile -and $composerPharFile.Length -gt 0) {
            # Create composer.bat
            $batContent = @"
@echo off
php "%~dp0composer.phar" %*
"@
            Set-Content -Path $composerBat -Value $batContent -Encoding ASCII
            
            # Verify composer.bat was created
            $composerBatFile = Get-ChildItem -Path $composerDir -Filter "composer.bat" -ErrorAction SilentlyContinue | Select-Object -First 1
            if (-not $composerBatFile -or $composerBatFile.Length -eq 0) {
                Write-Host "$LogPrefix Warning: Failed to create composer.bat" -ForegroundColor Yellow
                return
            }
            
            # Add Composer to PATH
            Write-Host "$LogPrefix Adding Composer to PATH..." -ForegroundColor Cyan
            $windowsPathFunctionPath = Join-Path $parentDir "win_common\WindowsPathFunction.ps1"
            & $windowsPathFunctionPath "add" $composerDir
            Write-Host "$LogPrefix Added Composer to PATH: $composerDir" -ForegroundColor Green
            
            # Verify installation: check if composer.phar and php.exe are in the same directory
            $phpExeFile = Get-ChildItem -Path $composerDir -Filter "php.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
            $finalPharFile = Get-ChildItem -Path $composerDir -Filter "composer.phar" -ErrorAction SilentlyContinue | Select-Object -First 1
            
            if ($phpExeFile -and $finalPharFile) {
                Write-Host "$LogPrefix Composer installed and verified successfully" -ForegroundColor Green
            }
            else {
                Write-Host "$LogPrefix Warning: Composer and PHP are not in the same directory" -ForegroundColor Yellow
            }
        }
    }
    catch {
        Write-Host "$LogPrefix Failed to install Composer: $($_.Exception.Message)" -ForegroundColor Red
    }
    finally {
        if (Test-Path $installerPath) {
            Remove-Item $installerPath -Force
        }
    }
}

function Configure-PhpIniForPackage {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PhpDir,
        [Parameter(Mandatory = $true)]
        [string]$PhpExePath,
        [string]$LogPrefix = "[PHP-Config]"
    )

    Write-Host "$LogPrefix Configuring PHP using configure_php_ini.php..." -ForegroundColor Cyan

    if (-not (Test-Path $PhpExePath)) {
        Write-Host "$LogPrefix Error: PHP executable not found: $PhpExePath" -ForegroundColor Red
        return
    }

    $parentDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $phpConfigScriptPath = Join-Path $parentDir "1_phpconfig\configure_php_ini.php"

    if (-not (Test-Path $phpConfigScriptPath)) {
        Write-Host "$LogPrefix Error: configure_php_ini.php not found at $phpConfigScriptPath" -ForegroundColor Red
        return
    }

    try {
        Write-Host "$LogPrefix Running configure_php_ini.php..." -ForegroundColor Yellow
        & $PhpExePath $phpConfigScriptPath $PhpExePath
        Write-Host "$LogPrefix PHP configuration completed" -ForegroundColor Green
    }
    catch {
        Write-Host "$LogPrefix Error running configure_php_ini.php: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Enable-PhpExtensions {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PhpDir,
        [Parameter(Mandatory = $true)]
        [string]$PhpExePath,
        [string]$LogPrefix = "[PHP-Extensions]"
    )

    Write-Host "$LogPrefix Extensions are configured by configure_php_ini.php" -ForegroundColor Cyan
}


function Invoke-PhpPostInstallProcessor {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$PhpCallback,
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[PHP-PostInstall]"
    )

    Write-Host "$LogPrefix Processing PHP post-installation for $PackageName" -ForegroundColor Cyan

    $phpOperation = if ($PhpCallback.ContainsKey("Operation")) { $PhpCallback.Operation } else { "" }

    if ([string]::IsNullOrEmpty($phpOperation)) {
        Write-Host "$LogPrefix Error: PHP callback missing Operation parameter" -ForegroundColor Red
        return
    }

    Write-Host "$LogPrefix PHP Operation: $phpOperation" -ForegroundColor Cyan

    switch ($phpOperation.ToLower()) {
        "configure_ini" {
            Write-Host "$LogPrefix Configuring PHP INI file using configure_php_ini.php..." -ForegroundColor Yellow
            Configure-PhpIniForPackage -PhpDir $InstallDir -PhpExePath $ExecutablePath -LogPrefix $LogPrefix
            Enable-PhpExtensions -PhpDir $InstallDir -PhpExePath $ExecutablePath -LogPrefix $LogPrefix
        }
        "install_composer" {
            Write-Host "$LogPrefix Installing Composer..." -ForegroundColor Yellow
            Install-ComposerForPhp -PhpPath $ExecutablePath -InstallDir $InstallDir -LogPrefix $LogPrefix
        }
        "full_setup" {
            Write-Host "$LogPrefix Performing full PHP setup (INI + Extensions + Composer)..." -ForegroundColor Yellow

            # Step 1: Configure php.ini using configure_php_ini.php (always run, continue even if fails)
            try {
                Configure-PhpIniForPackage -PhpDir $InstallDir -PhpExePath $ExecutablePath -LogPrefix $LogPrefix
            }
            catch {
                Write-Host "$LogPrefix Warning: Failed to configure php.ini: $($_.Exception.Message)" -ForegroundColor Yellow
            }

            # Step 2: Extensions are handled by configure_php_ini.php (always run, continue even if fails)
            try {
                Enable-PhpExtensions -PhpDir $InstallDir -PhpExePath $ExecutablePath -LogPrefix $LogPrefix
            }
            catch {
                Write-Host "$LogPrefix Warning: Failed to enable extensions: $($_.Exception.Message)" -ForegroundColor Yellow
            }

            # Step 3: Install Composer (always run, continue even if fails)
            try {
                Install-ComposerForPhp -PhpPath $ExecutablePath -InstallDir $InstallDir -LogPrefix $LogPrefix -ForceReinstall $false
            }
            catch {
                Write-Host "$LogPrefix Warning: Failed to install Composer: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
        default {
            Write-Host "$LogPrefix Error: Unknown PHP operation: $phpOperation" -ForegroundColor Red
            return
        }
    }

    Write-Host "$LogPrefix PHP post-installation completed" -ForegroundColor Green
}
