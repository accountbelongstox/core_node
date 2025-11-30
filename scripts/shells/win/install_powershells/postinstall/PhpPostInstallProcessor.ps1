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
        [string]$LogPrefix = "[PHP-Composer]"
    )
    
    Write-Host "$LogPrefix Installing Composer..." -ForegroundColor Cyan
    
    $composerDir = $InstallDir
    $composerPhar = Join-Path $composerDir "composer.phar"
    $composerBat = Join-Path $composerDir "composer.bat"
    
    # Check if Composer is already installed
    if (Test-Path $composerPhar) {
        Write-Host "$LogPrefix Composer is already installed at: $composerPhar" -ForegroundColor Green
        return $true
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
        
        if (Test-Path $composerPhar) {
            # Create composer.bat
            $batContent = @"
@echo off
php "%~dp0composer.phar" %*
"@
            Set-Content -Path $composerBat -Value $batContent -Encoding ASCII
            
            # Add Composer to PATH
            Write-Host "$LogPrefix Adding Composer to PATH..." -ForegroundColor Cyan
            $windowsPathFunctionPath = Join-Path $parentDir "win_common\WindowsPathFunction.ps1"
            & $windowsPathFunctionPath "add" $composerDir
            Write-Host "$LogPrefix Added Composer to PATH: $composerDir" -ForegroundColor Green
            
            Write-Host "$LogPrefix Composer installed successfully" -ForegroundColor Green
            return $true
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
    return $false
}

function Find-ExtensionDll {
    param (
        [Parameter(Mandatory = $true)]
        [string]$ExtensionName,
        [Parameter(Mandatory = $true)]
        [string]$ExtDir,
        [string]$LogPrefix = "[PHP-Ext]"
    )
    
    # Enhanced extension detection based on configure_php_ini.php
    $normalizedName = $ExtensionName.ToLower()
    
    # Define search patterns (order matters - most specific first)
    $patterns = @(
        "php_$ExtensionName.dll",
        "php_${ExtensionName}3.dll",
        "php_${ExtensionName}_nts.dll",
        "php_${ExtensionName}_ts.dll",
        "$ExtensionName.dll"
    )
    
    # First, try exact pattern matches
    foreach ($pattern in $patterns) {
        $dllPath = Join-Path $ExtDir $pattern
        if (Test-Path $dllPath) {
            Write-Host "$LogPrefix Found extension DLL: $pattern" -ForegroundColor Green
            return $pattern
        }
    }
    
    # If no exact match, scan all DLLs for fuzzy matches
    $dllFiles = Get-ChildItem -Path $ExtDir -Filter "*.dll" -ErrorAction SilentlyContinue
    
    foreach ($dll in $dllFiles) {
        $dllName = $dll.BaseName.ToLower()
        $dllBase = $dllName -replace '^php_', '' -replace '_nts$', '' -replace '_ts$', ''
        
        # Direct match
        if ($dllBase -eq $normalizedName) {
            Write-Host "$LogPrefix Found extension DLL via fuzzy match: $($dll.Name)" -ForegroundColor Green
            return $dll.Name
        }
        
        # Version number variations (e.g., mysql -> mysql3)
        if ($dllBase -match "^$normalizedName\d*$") {
            Write-Host "$LogPrefix Found extension DLL via version match: $($dll.Name)" -ForegroundColor Green
            return $dll.Name
        }
        
        # Handle common variations
        $variations = @(
            $normalizedName -replace '3$', '',  # Remove trailing 3
            $normalizedName -replace '_', ''    # Remove underscores
        )
        
        foreach ($variation in $variations) {
            if ($dllBase -eq $variation) {
                Write-Host "$LogPrefix Found extension DLL via variation match: $($dll.Name)" -ForegroundColor Green
                return $dll.Name
            }
        }
    }
    
    return $null
}

function Update-PhpConfigValue {
    param (
        [Parameter(Mandatory = $true)]
        [string]$IniContent,
        [Parameter(Mandatory = $true)]
        [string]$Key,
        [Parameter(Mandatory = $true)]
        [string]$Value,
        [string]$LogPrefix = "[PHP-Config]"
    )

    # Enhanced configuration update based on configure_php_ini.php
    $pattern = "^\s*$Key\s*=\s*(.*?)(\s*(;.*)?)\s*$"

    if ($IniContent -match $pattern) {
        $newContent = $IniContent -replace $pattern, "$Key = $Value`$2"
        Write-Host "$LogPrefix Updated $Key = $Value" -ForegroundColor Green
        return $newContent
    } else {
        # Add new configuration at the end
        $newContent = $IniContent + "`r`n$Key = $Value"
        Write-Host "$LogPrefix Added $Key = $Value" -ForegroundColor Green
        return $newContent
    }
}

function Enable-PhpExtension {
    param (
        [Parameter(Mandatory = $true)]
        [string]$IniContent,
        [Parameter(Mandatory = $true)]
        [string]$ExtensionName,
        [Parameter(Mandatory = $true)]
        [string]$ExtDir,
        [string]$LogPrefix = "[PHP-Ext]"
    )

    # Find the actual DLL file
    $dllName = Find-ExtensionDll -ExtensionName $ExtensionName -ExtDir $ExtDir -LogPrefix $LogPrefix

    if (-not $dllName) {
        Write-Host "$LogPrefix Extension $ExtensionName DLL not found" -ForegroundColor Yellow
        return @($IniContent, $false)
    }

    # Check if extension is already enabled
    $pattern = "^\s*(;)?\s*extension\s*=\s*$([regex]::Escape($dllName))\s*$"

    if ($IniContent -match $pattern) {
        $regexMatches = [regex]::Matches($IniContent, $pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
        if ($regexMatches.Count -gt 0 -and $regexMatches[0].Groups[1].Value -eq ';') {
            # Uncomment the extension
            $newContent = $IniContent -replace $pattern, "extension=$dllName"
            Write-Host "$LogPrefix Enabled extension $ExtensionName ($dllName)" -ForegroundColor Green
            return @($newContent, $true)
        } else {
            Write-Host "$LogPrefix Extension $ExtensionName already enabled" -ForegroundColor Cyan
            return @($IniContent, $true)
        }
    } else {
        # Add extension to Dynamic Extensions section
        $dynamicExtensionsPattern = "(; Dynamic Extensions ;)"
        if ($IniContent -match $dynamicExtensionsPattern) {
            $newContent = $IniContent -replace $dynamicExtensionsPattern, "`$1`r`nextension=$dllName"
        } else {
            # Add at the end
            $newContent = $IniContent + "`r`nextension=$dllName"
        }
        Write-Host "$LogPrefix Added extension $ExtensionName ($dllName)" -ForegroundColor Green
        return @($newContent, $true)
    }
}

function Configure-PhpIniForPackage {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PhpDir,
        [string]$LogPrefix = "[PHP-Config]"
    )

    Write-Host "$LogPrefix Configuring PHP in directory: $PhpDir" -ForegroundColor Cyan

    # Ensure the PHP directory exists
    if (-not (Test-Path $PhpDir)) {
        Write-Host "$LogPrefix Error: PHP directory not found: $PhpDir" -ForegroundColor Red
        return $false
    }

    # Locate php.ini files
    $phpIniDev = Join-Path $PhpDir "php.ini-development"
    $phpIniProd = Join-Path $PhpDir "php.ini-production"
    $phpIni = Join-Path $PhpDir "php.ini"

    Write-Host "$LogPrefix Looking for PHP configuration files..." -ForegroundColor Gray
    Write-Host "$LogPrefix   php.ini: $(if (Test-Path $phpIni) { 'EXISTS' } else { 'NOT FOUND' })" -ForegroundColor Gray
    Write-Host "$LogPrefix   php.ini-development: $(if (Test-Path $phpIniDev) { 'EXISTS' } else { 'NOT FOUND' })" -ForegroundColor Gray
    Write-Host "$LogPrefix   php.ini-production: $(if (Test-Path $phpIniProd) { 'EXISTS' } else { 'NOT FOUND' })" -ForegroundColor Gray

    # Create php.ini if it doesn't exist, prioritizing development template
    if (-not (Test-Path $phpIni)) {
        Write-Host "$LogPrefix php.ini not found, creating from template..." -ForegroundColor Yellow

        if (Test-Path $phpIniDev) {
            Copy-Item -Path $phpIniDev -Destination $phpIni -Force
            Write-Host "$LogPrefix Created php.ini from php.ini-development template" -ForegroundColor Green
        }
        elseif (Test-Path $phpIniProd) {
            Copy-Item -Path $phpIniProd -Destination $phpIni -Force
            Write-Host "$LogPrefix Created php.ini from php.ini-production template" -ForegroundColor Green
        }
        else {
            Write-Host "$LogPrefix Error: No php.ini template found" -ForegroundColor Red
            Write-Host "$LogPrefix Expected templates: php.ini-development or php.ini-production" -ForegroundColor Red
            Write-Host "$LogPrefix Please ensure PHP is properly installed in: $PhpDir" -ForegroundColor Red
            return $false
        }
    }
    else {
        Write-Host "$LogPrefix php.ini already exists, updating configuration..." -ForegroundColor Cyan
    }

    try {
        # Read current content
        $iniContent = Get-Content -Path $phpIni -Raw

        # Enhanced configuration values based on configure_php_ini.php
        $configReplacements = @{
            'upload_max_filesize' = '10240M'
            'post_max_size' = '10240M'
            'display_errors' = 'On'
            'max_execution_time' = '300'
            'max_input_time' = '300'
            'memory_limit' = '512M'
            'max_input_vars' = '10000'
            'date.timezone' = 'UTC'
            'error_log' = '"error.log"'
            'file_uploads' = 'On'
        }

        Write-Host "$LogPrefix Applying enhanced PHP configuration..." -ForegroundColor Yellow
        foreach ($key in $configReplacements.Keys) {
            $iniContent = Update-PhpConfigValue -IniContent $iniContent -Key $key -Value $configReplacements[$key] -LogPrefix $LogPrefix
        }

        # Set extension directory
        $extDir = Join-Path $PhpDir "ext"
        if (Test-Path $extDir) {
            $iniContent = Update-PhpConfigValue -IniContent $iniContent -Key 'extension_dir' -Value "`"$extDir`"" -LogPrefix $LogPrefix
        }

        # Save modified content
        Set-Content -Path $phpIni -Value $iniContent
        Write-Host "$LogPrefix Successfully updated php.ini with enhanced configuration" -ForegroundColor Green

        return $true
    }
    catch {
        Write-Host "$LogPrefix Error configuring php.ini: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Enable-PhpExtensions {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PhpDir,
        [string]$LogPrefix = "[PHP-Extensions]"
    )

    $phpIni = Join-Path $PhpDir "php.ini"
    $extDir = Join-Path $PhpDir "ext"

    if (-not (Test-Path $phpIni)) {
        Write-Host "$LogPrefix Error: php.ini not found: $phpIni" -ForegroundColor Red
        return $false
    }

    if (-not (Test-Path $extDir)) {
        Write-Host "$LogPrefix Warning: Extension directory not found: $extDir" -ForegroundColor Yellow
        return $true  # Not a fatal error
    }

    # Read current content
    $iniContent = Get-Content -Path $phpIni -Raw

    # Define required extensions
    $requiredExtensions = @(
        'openssl',
        'curl',
        'mbstring',
        'pdo_sqlite',
        'pdo_mysql',
        'fileinfo',
        'zip',
        'gd',
        'intl',
        'bcmath'
    )

    Write-Host "$LogPrefix Processing extensions..." -ForegroundColor Yellow
    $enabledCount = 0
    $alreadyEnabledCount = 0
    $missingCount = 0

    foreach ($ext in $requiredExtensions) {
        $result = Enable-PhpExtension -IniContent $iniContent -ExtensionName $ext -ExtDir $extDir -LogPrefix $LogPrefix
        $iniContent = $result[0]
        $wasEnabled = $result[1]

        if ($wasEnabled) {
            if ($result[0] -ne $iniContent) {
                $enabledCount++
            } else {
                $alreadyEnabledCount++
            }
        } else {
            $missingCount++
        }
    }

    # Save updated content
    Set-Content -Path $phpIni -Value $iniContent

    # Report results
    Write-Host "$LogPrefix Extension processing complete:" -ForegroundColor Green
    Write-Host "$LogPrefix   Newly enabled: $enabledCount" -ForegroundColor Green
    Write-Host "$LogPrefix   Already enabled: $alreadyEnabledCount" -ForegroundColor Cyan
    Write-Host "$LogPrefix   Not available: $missingCount" -ForegroundColor Yellow

    return $true
}

function Test-PhpConfiguration {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PhpPath,
        [string]$LogPrefix = "[PHP-Test]"
    )

    Write-Host "$LogPrefix Testing PHP configuration..." -ForegroundColor Cyan

    try {
        # Test PHP version
        $versionOutput = & $PhpPath -v 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "$LogPrefix PHP version check passed" -ForegroundColor Green
        } else {
            Write-Host "$LogPrefix PHP version check failed: $versionOutput" -ForegroundColor Red
            return $false
        }

        # Test PHP modules (suppress warnings for this test)
        $modulesOutput = & $PhpPath -m 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "$LogPrefix PHP modules check passed" -ForegroundColor Green

            # Check for critical extensions
            $criticalExtensions = @('openssl', 'curl', 'mbstring')
            foreach ($ext in $criticalExtensions) {
                if ($modulesOutput -contains $ext) {
                    Write-Host "$LogPrefix Extension $ext is loaded" -ForegroundColor Green
                } else {
                    Write-Host "$LogPrefix Warning: Extension $ext is not loaded" -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host "$LogPrefix PHP modules check failed" -ForegroundColor Yellow
        }

        return $true
    }
    catch {
        Write-Host "$LogPrefix PHP configuration test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
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
        return $false
    }

    Write-Host "$LogPrefix PHP Operation: $phpOperation" -ForegroundColor Cyan

    $success = $false

    switch ($phpOperation.ToLower()) {
        "configure_ini" {
            Write-Host "$LogPrefix Configuring PHP INI file..." -ForegroundColor Yellow
            $configSuccess = Configure-PhpIniForPackage -PhpDir $InstallDir -LogPrefix $LogPrefix
            $extSuccess = Enable-PhpExtensions -PhpDir $InstallDir -LogPrefix $LogPrefix
            $success = $configSuccess -and $extSuccess
        }
        "install_composer" {
            Write-Host "$LogPrefix Installing Composer..." -ForegroundColor Yellow
            $success = Install-ComposerForPhp -PhpPath $ExecutablePath -InstallDir $InstallDir -LogPrefix $LogPrefix
        }
        "full_setup" {
            Write-Host "$LogPrefix Performing full PHP setup (INI + Extensions + Composer)..." -ForegroundColor Yellow

            # Step 1: Configure php.ini with enhanced settings
            $configSuccess = Configure-PhpIniForPackage -PhpDir $InstallDir -LogPrefix $LogPrefix

            # Step 2: Enable extensions
            $extSuccess = Enable-PhpExtensions -PhpDir $InstallDir -LogPrefix $LogPrefix

            # Step 3: Install Composer
            $composerSuccess = Install-ComposerForPhp -PhpPath $ExecutablePath -InstallDir $InstallDir -LogPrefix $LogPrefix

            # Step 4: Test PHP configuration
            if ($configSuccess -and $extSuccess) {
                $testSuccess = Test-PhpConfiguration -PhpPath $ExecutablePath -LogPrefix $LogPrefix
                if (-not $testSuccess) {
                    Write-Host "$LogPrefix Warning: PHP configuration test failed, but setup completed" -ForegroundColor Yellow
                }
            }

            $success = $configSuccess -and $extSuccess -and $composerSuccess
        }
        default {
            Write-Host "$LogPrefix Error: Unknown PHP operation: $phpOperation" -ForegroundColor Red
            return $false
        }
    }

    if ($success) {
        Write-Host "$LogPrefix PHP post-installation completed successfully" -ForegroundColor Green
    } else {
        Write-Host "$LogPrefix PHP post-installation failed" -ForegroundColor Red
    }

    return $success
}
