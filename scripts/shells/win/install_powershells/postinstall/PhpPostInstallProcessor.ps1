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
    $phpIniDepsFixPath = Join-Path $parentDir "1_phpconfig\fix_php_ini_deps.php"

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

    # Idempotent php.ini dependency + duplicate-load cleanup, run right after
    # configure_php_ini.php so the rest of Step16 (Composer/Swoole spawn PHP
    # subprocesses) does not log "Module <ext> already loaded". Comments out
    # auto-dep extensions (pgsql, auto-loaded by pdo_pgsql) and deduplicates
    # same-extension lines in different Windows forms (extension=pdo_pgsql vs
    # extension=php_pdo_pgsql.dll - both resolve to the same DLL). No-op when
    # the ini is already clean. Best-effort: never blocks the step.
    if (Test-Path $phpIniDepsFixPath) {
        try {
            Write-Host "$LogPrefix Running fix_php_ini_deps.php (idempotent ini cleanup)..." -ForegroundColor Yellow
            & $PhpExePath $phpIniDepsFixPath | Out-Null
            Write-Host "$LogPrefix php.ini dependency/duplicate cleanup completed" -ForegroundColor Green
        }
        catch {
            Write-Host "$LogPrefix Warning: fix_php_ini_deps.php reported an error: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "$LogPrefix Warning: fix_php_ini_deps.php not found at $phpIniDepsFixPath" -ForegroundColor Yellow
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

function Install-PECL {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PhpPath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [string]$LogPrefix = "[PHP-PECL]"
    )

    Write-Host "$LogPrefix Installing PECL (PHP Extension Community Library)..." -ForegroundColor Cyan
    Write-Host "$LogPrefix PECL is a prerequisite for installing PHP extensions via PECL" -ForegroundColor Cyan

    # Check if PECL is already installed
    $peclBatPath = Join-Path $InstallDir "pecl.bat"
    $peclPhpPath = Join-Path $InstallDir "pecl.php"
    $peclBatInBin = Join-Path $InstallDir "bin\pecl.bat"
    
    $peclFound = $false
    $peclPath = $null
    
    if (Test-Path $peclBatPath) {
        $peclPath = $peclBatPath
        $peclFound = $true
        Write-Host "$LogPrefix PECL already installed at: $peclPath" -ForegroundColor Green
    }
    elseif (Test-Path $peclPhpPath) {
        $peclPath = $peclPhpPath
        $peclFound = $true
        Write-Host "$LogPrefix PECL PHP script already exists at: $peclPhpPath" -ForegroundColor Green
    }
    elseif (Test-Path $peclBatInBin) {
        $peclPath = $peclBatInBin
        $peclFound = $true
        Write-Host "$LogPrefix PECL already installed at: $peclPath" -ForegroundColor Green
    }
    
    if ($peclFound) {
        # Verify PECL is working (idempotent check - supports repeated runs)
        Write-Host "$LogPrefix Verifying PECL installation (idempotent check)..." -ForegroundColor Yellow
        try {
            if ($peclPath -like "*.bat") {
                $peclVersion = & $peclPath version 2>&1
            }
            else {
                $peclVersion = & $PhpPath $peclPhpPath version 2>&1
            }
            if ($peclVersion -match "PECL|PEAR") {
                Write-Host "$LogPrefix PECL is working correctly (verified)" -ForegroundColor Green
                return $peclPath
            }
            else {
                Write-Host "$LogPrefix PECL found but verification failed, will reinstall..." -ForegroundColor Yellow
                Write-Host "$LogPrefix PECL output: $peclVersion" -ForegroundColor Yellow
                $peclFound = $false
            }
        }
        catch {
            Write-Host "$LogPrefix PECL found but not working (error: $($_.Exception.Message)), will reinstall..." -ForegroundColor Yellow
            $peclFound = $false
        }
    }

    if (-not $peclFound) {
        Write-Host "$LogPrefix PECL not found or not working, installing/reinstalling via go-pear.phar..." -ForegroundColor Yellow
        Write-Host "$LogPrefix This installation is idempotent - safe to run multiple times" -ForegroundColor Cyan
        
        # Download go-pear.phar (idempotent - will skip if already exists and valid)
        $goPearUrl = "https://pear.php.net/go-pear.phar"
        $goPearPath = Join-Path $InstallDir "go-pear.phar"
        $goPearTempPath = Join-Path $env:TEMP "go-pear.phar"
        
        Write-Host "$LogPrefix Downloading go-pear.phar from $goPearUrl..." -ForegroundColor Yellow
        try {
            # Check if go-pear.phar already exists locally
            if (Test-Path $goPearPath) {
                $existingSize = (Get-Item $goPearPath).Length
                if ($existingSize -gt 0) {
                    Write-Host "$LogPrefix go-pear.phar already exists locally ($([math]::Round($existingSize / 1KB, 2)) KB), will use it" -ForegroundColor Green
                }
                else {
                    Write-Host "$LogPrefix Existing go-pear.phar is empty, will re-download" -ForegroundColor Yellow
                    Remove-Item $goPearPath -Force -ErrorAction SilentlyContinue
                }
            }
            
            # Download if needed
            if (-not (Test-Path $goPearPath)) {
                # Use common download method
                $downloaded = Get-FileWithSizeCheck -localPath $goPearTempPath -remoteUrl $goPearUrl -description "go-pear.phar installer"
                
                if ($downloaded -and (Test-Path $goPearTempPath)) {
                    # Copy to PHP installation directory
                    Copy-Item $goPearTempPath $goPearPath -Force
                    Write-Host "$LogPrefix Downloaded go-pear.phar successfully" -ForegroundColor Green
                }
                else {
                    # Try direct download
                    Invoke-WebRequest -Uri $goPearUrl -OutFile $goPearPath -UseBasicParsing
                    Write-Host "$LogPrefix Downloaded go-pear.phar directly" -ForegroundColor Green
                }
            }
        }
        catch {
            Write-Host "$LogPrefix Failed to download go-pear.phar: $($_.Exception.Message)" -ForegroundColor Red
            return $null
        }
        
        # Run go-pear.phar installer (must run with CWD = InstallDir so default $prefix is PHP dir)
        if (Test-Path $goPearPath) {
            Write-Host "$LogPrefix Running go-pear.phar installer..." -ForegroundColor Yellow
            Write-Host "$LogPrefix This will install PEAR and PECL to: $InstallDir" -ForegroundColor Cyan
            if (-not (Test-Path $InstallDir)) {
                Write-Host "$LogPrefix InstallDir does not exist: $InstallDir" -ForegroundColor Red
                return $null
            }
            Push-Location -LiteralPath $InstallDir
            try {
                # Try normal installation first; go-pear.phar uses current directory as default $prefix
                $installOutput = & $PhpPath $goPearPath 2>&1
                # If signature error, try with phar.require_hash=0
                if (-not (($installOutput -match "signature|hash") -or (Test-Path $peclBatPath) -or (Test-Path $peclPhpPath))) {
                    Write-Host "$LogPrefix Retrying with phar.require_hash=0 flag..." -ForegroundColor Yellow
                    $installOutput = & $PhpPath -d phar.require_hash=0 $goPearPath 2>&1
                }
                # Check if installation was successful (pecl.bat under InstallDir or InstallDir\bin)
                if (Test-Path $peclBatPath) {
                    Write-Host "$LogPrefix PECL installed successfully at: $peclBatPath" -ForegroundColor Green
                    $peclPath = $peclBatPath
                }
                elseif (Test-Path $peclPhpPath) {
                    Write-Host "$LogPrefix PECL PHP script installed at: $peclPhpPath" -ForegroundColor Green
                    $peclPath = $peclPhpPath
                }
                elseif (Test-Path $peclBatInBin) {
                    Write-Host "$LogPrefix PECL installed at: $peclBatInBin" -ForegroundColor Green
                    $peclPath = $peclBatInBin
                }
                else {
                    Write-Host "$LogPrefix PECL installation may have completed, but pecl.bat not found" -ForegroundColor Yellow
                    Write-Host "$LogPrefix Installation output: $installOutput" -ForegroundColor Yellow
                    return $null
                }
            }
            catch {
                Write-Host "$LogPrefix Failed to run go-pear.phar: $($_.Exception.Message)" -ForegroundColor Red
                return $null
            }
            finally {
                Pop-Location -ErrorAction SilentlyContinue
                if (Test-Path $goPearTempPath) {
                    Remove-Item $goPearTempPath -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }
    
    # Verify PECL installation
    if ($peclPath) {
        Write-Host "$LogPrefix Verifying PECL installation..." -ForegroundColor Yellow
        try {
            if ($peclPath -like "*.bat") {
                $peclTest = & $peclPath version 2>&1
            }
            else {
                $peclTest = & $PhpPath $peclPath version 2>&1
            }
            
            if ($peclTest -match "PECL|PEAR") {
                Write-Host "$LogPrefix PECL installation verified successfully" -ForegroundColor Green
                return $peclPath
            }
            else {
                Write-Host "$LogPrefix PECL installation verification failed" -ForegroundColor Yellow
                return $null
            }
        }
        catch {
            Write-Host "$LogPrefix PECL verification error: $($_.Exception.Message)" -ForegroundColor Yellow
            return $null
        }
    }
    
    return $null
}

function Install-SwooleExtension {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PhpPath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [string]$LogPrefix = "[PHP-Swoole]"
    )

    Write-Host "$LogPrefix Installing Swoole extension for PHP 8.5 on Windows..." -ForegroundColor Cyan

    # Check if Swoole is already installed
    Write-Host "$LogPrefix Checking if Swoole extension is already installed..." -ForegroundColor Yellow
    $phpModulesOutput = & $PhpPath -m 2>&1 | Out-String
    $modulesList = $phpModulesOutput -split "`n" | ForEach-Object { $_.Trim() }
    $swooleInstalled = $false
    foreach ($module in $modulesList) {
        if ($module -eq "swoole" -or $module -eq "openswoole") {
            $swooleInstalled = $true
            break
        }
    }
    if ($swooleInstalled) {
        Write-Host "$LogPrefix Swoole extension is already installed" -ForegroundColor Green
        return $true
    }

    # Get PHP architecture (x64 or x86)
    $phpArch = "x64"
    $phpInfoOutput = & $PhpPath -i 2>&1
    if ($phpInfoOutput -match 'Architecture.*x86') {
        $phpArch = "x86"
    }
    Write-Host "$LogPrefix Detected PHP architecture: $phpArch" -ForegroundColor Cyan

    # Get PHP thread safety (NTS or TS)
    $phpThreadSafety = "nts"
    if ($phpInfoOutput -match 'Thread Safety.*enabled') {
        $phpThreadSafety = "ts"
    }
    Write-Host "$LogPrefix Detected PHP thread safety: $phpThreadSafety" -ForegroundColor Cyan

    # Get PHP extension directory
    $extDir = $null
    $extDirOutput = & $PhpPath -i 2>&1 | Select-String "extension_dir"
    if ($extDirOutput) {
        $extDirLine = $extDirOutput.ToString()
        # Try multiple regex patterns to extract extension directory
        if ($extDirLine -match 'extension_dir\s*=>\s*([^\s=]+)') {
            $extDir = $matches[1].Trim()
        }
        elseif ($extDirLine -match 'extension_dir.*?=>\s*([^\s=]+)') {
            $extDir = $matches[1].Trim()
        }
        # Remove any trailing characters that might be part of the output format
        if ($extDir -match '^(.+?)(?:\s*=>|$)') {
            $extDir = $matches[1].Trim()
        }
    }
    
    # Validate extracted path - if it's not a valid path, use default
    if ([string]::IsNullOrEmpty($extDir) -or -not (Test-Path (Split-Path $extDir -Parent -ErrorAction SilentlyContinue))) {
        $extDir = Join-Path $InstallDir "ext"
        Write-Host "$LogPrefix Using default extension directory: $extDir" -ForegroundColor Yellow
    }
    
    # Ensure extension directory exists
    if (-not (Test-Path $extDir)) {
        New-Item -ItemType Directory -Path $extDir -Force | Out-Null
        Write-Host "$LogPrefix Created extension directory: $extDir" -ForegroundColor Cyan
    }
    Write-Host "$LogPrefix PHP extension directory: $extDir" -ForegroundColor Cyan

    # ========================================================================
    # DEPENDENCY ORDER: PECL must be installed before attempting PECL-based installation
    # ========================================================================
    # Step 1: Install PECL (Prerequisite for Method 1)
    # Step 2: Method 1 - Try PECL installation (requires PECL from Step 1)
    # Step 3: Method 2 - Download pre-compiled DLL (fallback, no dependencies)
    # Step 4: Method 3 - Try Open Swoole via PECL (requires PECL from Step 1)
    # ========================================================================
    
    # Method 1: Try PECL installation
    # PECL (PHP Extension Community Library) is a tool for installing PHP extensions
    # On Windows, PECL may be available as pecl.bat in PHP installation directory
    # or can be called via php.exe using go-pear.phar
    Write-Host "$LogPrefix Method 1: Attempting to install Swoole via PECL..." -ForegroundColor Yellow
    
    # DEPENDENCY: Install PECL first (prerequisite for PECL-based installation)
    Write-Host "$LogPrefix [DEPENDENCY] Checking/Installing PECL (prerequisite for PECL installation method)..." -ForegroundColor Cyan
    $peclPath = Install-PECL -PhpPath $PhpPath -InstallDir $InstallDir -LogPrefix "$LogPrefix [PECL-Install]"
    
    # If PECL found or installed, try to use it
    if ($peclPath) {
        try {
            Write-Host "$LogPrefix Running PECL install swoole using: $peclPath" -ForegroundColor Yellow
            if ($peclPath -like "*.bat") {
                # pecl.bat - execute directly
                $peclOutput = & $peclPath install swoole 2>&1
            }
            else {
                # pecl.php - execute via php.exe
                $peclOutput = & $PhpPath $peclPhpPath install swoole 2>&1
            }
            
            $phpModulesCheck = & $PhpPath -m 2>&1 | Out-String
            $modulesCheckList = $phpModulesCheck -split "`n" | ForEach-Object { $_.Trim() }
            $swooleFound = $false
            foreach ($module in $modulesCheckList) {
                if ($module -eq "swoole") {
                    $swooleFound = $true
                    break
                }
            }
            if ($swooleFound) {
                Write-Host "$LogPrefix Swoole installed successfully via PECL" -ForegroundColor Green
                Write-Host "$LogPrefix Swoole extension verified and enabled" -ForegroundColor Green
                return $true
            }
            else {
                Write-Host "$LogPrefix PECL installation did not enable swoole module" -ForegroundColor Yellow
                Write-Host "$LogPrefix PECL output: $peclOutput" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "$LogPrefix PECL installation failed: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "$LogPrefix PECL not available, skipping PECL method" -ForegroundColor Yellow
        Write-Host "$LogPrefix Will try pre-compiled DLL method instead (Method 2)" -ForegroundColor Yellow
    }

    # Method 2: Download pre-compiled Swoole DLL for Windows
    # According to MCP documentation, Swoole requires Linux, OS X, Cygwin, or WSL
    # Windows native compilation is not officially supported
    # However, windows.php.net provides Swoole 4.8.15 DLL (latest available for Windows)
    Write-Host "$LogPrefix Method 2: Attempting to download Swoole DLL..." -ForegroundColor Yellow
    
    # Use only the latest available Swoole version for Windows (4.8.15)
    # This is the most recent version available on windows.php.net
    $swooleVersion = "4.8.15"
    $dllFileName = "php_swoole-$swooleVersion-$phpThreadSafety-$phpArch.dll"
    $dllUrl = "https://windows.php.net/downloads/pecl/releases/swoole/$swooleVersion/$dllFileName"
    $dllPath = Join-Path $extDir $dllFileName
    
    $swooleDllFound = $false
    $downloadedDllPath = $null
    
    # Check if DLL already exists locally
    if (Test-Path $dllPath) {
        $existingSize = (Get-Item $dllPath).Length
        Write-Host "$LogPrefix Swoole DLL already exists: $dllPath ($([math]::Round($existingSize / 1MB, 2)) MB)" -ForegroundColor Green
        $swooleDllFound = $true
        $downloadedDllPath = $dllPath
    }
    else {
        # Display detailed download information
        Write-Host "$LogPrefix Swoole DLL not found, attempting to download..." -ForegroundColor Cyan
        Write-Host "$LogPrefix Attempting to download Swoole DLL for PHP 8.5 ($phpThreadSafety, $phpArch)..." -ForegroundColor Cyan
        Write-Host "$LogPrefix Extension directory: $extDir" -ForegroundColor Cyan
        Write-Host "$LogPrefix PHP executable: $PhpPath" -ForegroundColor Cyan
        Write-Host "$LogPrefix Downloading Swoole version: $swooleVersion" -ForegroundColor Yellow
        Write-Host "$LogPrefix DLL URL: $dllUrl" -ForegroundColor Cyan
        
        # Check if file exists remotely and download
        try {
            $headResponse = Invoke-WebRequest -Uri $dllUrl -Method Head -UseBasicParsing -ErrorAction Stop
            if ($headResponse.StatusCode -eq 200) {
                $fileSize = [int]$headResponse.Headers['Content-Length']
                Write-Host "$LogPrefix File found on server (Size: $([math]::Round($fileSize / 1MB, 2)) MB)" -ForegroundColor Green
                
                # Use common download method
                $downloadDescription = "Swoole $swooleVersion DLL for PHP 8.5 ($phpThreadSafety, $phpArch)"
                $downloaded = Get-FileWithSizeCheck -localPath $dllPath -remoteUrl $dllUrl -description $downloadDescription
                
                if ($downloaded -and (Test-Path $dllPath)) {
                    $actualSize = (Get-Item $dllPath).Length
                    Write-Host "$LogPrefix Swoole DLL downloaded successfully: $dllPath ($([math]::Round($actualSize / 1MB, 2)) MB)" -ForegroundColor Green
                    $swooleDllFound = $true
                    $downloadedDllPath = $dllPath
                }
                else {
                    Write-Host "$LogPrefix Download failed or file verification failed" -ForegroundColor Yellow
                }
            }
        }
        catch {
            $statusCode = $null
            if ($_.Exception.Response) {
                $statusCode = [int]$_.Exception.Response.StatusCode.value__
            }
            Write-Host "$LogPrefix File not found (HTTP $statusCode): $dllUrl" -ForegroundColor Yellow
            Write-Host "$LogPrefix Swoole $swooleVersion DLL is not available for PHP 8.5 ($phpThreadSafety, $phpArch)" -ForegroundColor Yellow
        }
    }
    
    if (-not $swooleDllFound) {
        Write-Host "$LogPrefix Swoole DLL installation failed" -ForegroundColor Yellow
        Write-Host "$LogPrefix According to Swoole documentation: Swoole requires Linux, OS X, Cygwin, or WSL" -ForegroundColor Cyan
        Write-Host "$LogPrefix Windows native compilation is not officially supported" -ForegroundColor Cyan
        Write-Host "$LogPrefix" -ForegroundColor Yellow
        Write-Host "$LogPrefix Recommended alternatives for Laravel Octane on Windows:" -ForegroundColor Yellow
        Write-Host "$LogPrefix   1. RoadRunner (Native Windows support):" -ForegroundColor Green
        Write-Host "$LogPrefix      composer require laravel/octane spiral/roadrunner-cli spiral/roadrunner-http" -ForegroundColor Cyan
        Write-Host "$LogPrefix      php artisan octane:install --server=roadrunner" -ForegroundColor Cyan
        Write-Host "$LogPrefix   2. FrankenPHP (Native Windows support):" -ForegroundColor Green
        Write-Host "$LogPrefix      composer require laravel/octane" -ForegroundColor Cyan
        Write-Host "$LogPrefix      php artisan octane:install --server=frankenphp" -ForegroundColor Cyan
    }
    
    # If DLL downloaded successfully, enable it in php.ini
    if ($swooleDllFound -and $downloadedDllPath) {
        # Find php.ini file
        $phpIniPath = $null
        $phpIniOutput = & $PhpPath --ini 2>&1
        if ($phpIniOutput -match 'Loaded Configuration File.*=> (.+)') {
            $phpIniPath = $matches[1].Trim()
        }
        
        if ([string]::IsNullOrEmpty($phpIniPath) -or -not (Test-Path $phpIniPath)) {
            $phpIniPath = Join-Path $InstallDir "php.ini"
        }

        if (Test-Path $phpIniPath) {
            Write-Host "$LogPrefix Enabling Swoole extension in php.ini: $phpIniPath" -ForegroundColor Yellow
            $phpIniContent = Get-Content $phpIniPath -Raw
            
            # Get DLL file name (without path)
            $dllFileNameOnly = Split-Path $downloadedDllPath -Leaf
            
            # Check if extension is already enabled
            if ($phpIniContent -notmatch "extension\s*=\s*$([regex]::Escape($dllFileNameOnly))") {
                # Add extension line (prefer after other extensions)
                if ($phpIniContent -match ';extension=.*') {
                    $phpIniContent = $phpIniContent -replace '(;extension=.*)', "`$1`nextension=$dllFileNameOnly"
                }
                elseif ($phpIniContent -notmatch "extension\s*=\s*$([regex]::Escape($dllFileNameOnly))") {
                    $phpIniContent += "`nextension=$dllFileNameOnly`n"
                }
                
                Set-Content -Path $phpIniPath -Value $phpIniContent -NoNewline
                Write-Host "$LogPrefix Added extension=$dllFileNameOnly to php.ini" -ForegroundColor Green
            }
            else {
                Write-Host "$LogPrefix Swoole extension already enabled in php.ini" -ForegroundColor Green
            }

            # Verify installation
            $phpModulesCheck = & $PhpPath -m 2>&1 | Out-String
            $modulesCheckList = $phpModulesCheck -split "`n" | ForEach-Object { $_.Trim() }
            $swooleFound = $false
            foreach ($module in $modulesCheckList) {
                if ($module -eq "swoole") {
                    $swooleFound = $true
                    break
                }
            }
            if ($swooleFound) {
                Write-Host "$LogPrefix Swoole extension verified and enabled successfully" -ForegroundColor Green
                return $true
            }
            else {
                Write-Host "$LogPrefix Warning: Swoole DLL installed but not loaded by PHP" -ForegroundColor Yellow
                Write-Host "$LogPrefix You may need to restart PHP or check php.ini configuration" -ForegroundColor Yellow
            }
        }
    }

    # Method 3: Try PECL with openswoole as alternative
    # DEPENDENCY: Requires PECL from Step 1 (already installed/checked above)
    Write-Host "$LogPrefix Method 3: Attempting to install Open Swoole via PECL as alternative..." -ForegroundColor Yellow
    
    # Use PECL if available (from Step 1 dependency installation)
    if ($peclPath) {
        try {
            Write-Host "$LogPrefix Running PECL install openswoole using: $peclPath" -ForegroundColor Yellow
            if ($peclPath -like "*.bat") {
                # pecl.bat - execute directly
                $peclOutput = & $peclPath install openswoole 2>&1
            }
            else {
                # pecl.php - execute via php.exe
                $peclPhpPath = Join-Path $InstallDir "pecl.php"
                $peclOutput = & $PhpPath $peclPhpPath install openswoole 2>&1
            }
            
            $phpModulesCheck = & $PhpPath -m 2>&1 | Out-String
            $modulesCheckList = $phpModulesCheck -split "`n" | ForEach-Object { $_.Trim() }
            $openswooleFound = $false
            foreach ($module in $modulesCheckList) {
                if ($module -eq "openswoole") {
                    $openswooleFound = $true
                    break
                }
            }
            if ($openswooleFound) {
                Write-Host "$LogPrefix Open Swoole installed successfully via PECL" -ForegroundColor Green
                Write-Host "$LogPrefix Open Swoole extension verified and enabled (compatible with Swoole)" -ForegroundColor Green
                return $true
            }
            else {
                Write-Host "$LogPrefix Open Swoole PECL installation did not enable openswoole module" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "$LogPrefix Open Swoole PECL installation failed: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "$LogPrefix PECL not available, skipping Open Swoole PECL method" -ForegroundColor Yellow
    }

    Write-Host "$LogPrefix Warning: All Swoole installation methods failed. Swoole may not be available on Windows for PHP 8.5." -ForegroundColor Yellow
    Write-Host "$LogPrefix Consider using WSL, Docker, or check for updated Windows builds at https://windows.php.net/downloads/pecl/releases/swoole/" -ForegroundColor Yellow
    return $false
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
            Write-Host "$LogPrefix Performing full PHP setup (INI + Extensions + Composer + Swoole)..." -ForegroundColor Yellow

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

            # Step 4: Install Swoole extension (always run, never skip, continue even if fails)
            # Required for Laravel 12 with Octane
            try {
                Install-SwooleExtension -PhpPath $ExecutablePath -InstallDir $InstallDir -LogPrefix $LogPrefix
            }
            catch {
                Write-Host "$LogPrefix Warning: Failed to install Swoole extension: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
        default {
            Write-Host "$LogPrefix Error: Unknown PHP operation: $phpOperation" -ForegroundColor Red
            return
        }
    }

    Write-Host "$LogPrefix PHP post-installation completed" -ForegroundColor Green
}
