# PHP Post-Installation Processor
# Handles PHP configuration, Composer installation, and extension setup
# Enhanced with advanced extension detection and configuration management

# Import required modules
$parentDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$windowsPathFunctionPath = Join-Path $parentDir "win_common\WindowsPathFunction.ps1"
. (Join-Path (Join-Path $parentDir "win_common") "GlobalVars.ps1")
. (Join-Path (Join-Path $parentDir "win_common") "CommonFunc.ps1")
if (-not (Get-Command Get-ServiceContractValue -ErrorAction SilentlyContinue)) {
    . (Join-Path (Join-Path $parentDir "win_common") "ServiceContract.ps1")
}
# Official Windows PECL build of Swoole (downloads.php.net/~windows/pecl/releases/swoole/<version>/)
$script:SwooleWindowsVersion = [string](Get-ServiceContractValue -ContractPath 'versions.swoole_windows')
$script:SwooleWindowsReleaseUrl = 'https://downloads.php.net/~windows/pecl/releases/swoole'
$script:SwooleWindowsVsTags = @('vs17', 'vs16')
$script:SwooleDllName = 'php_swoole.dll'

function Get-PhpRuntimeValue {
    # One value straight from PHP (no output scraping): php -r "echo <expression>;"
    param([Parameter(Mandatory = $true)][string]$PhpPath, [Parameter(Mandatory = $true)][string]$Expression)
    return ([string](& $PhpPath -r "echo $Expression;" 2>$null)).Trim()
}

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
    $composerPhar = Join-Path $composerDir "composer.phar"
    $installerUrl = "https://getcomposer.org/installer"
    $installerPath = Join-Path $Global:DOWNLOADS_DIR "composer-setup.php"
    $composerInstalled = (Test-Path -LiteralPath $PhpPath -PathType Leaf) -and (Test-Path -LiteralPath $composerPhar -PathType Leaf)
    $batContent = $null
    $requiredDir = $null

    # Check if Composer and PHP are in the same installation directory
    if ($composerInstalled -and -not $ForceReinstall) {
        Write-Host "$LogPrefix Composer is already installed in the same directory as PHP" -ForegroundColor Green
    }
    else {
        if ($ForceReinstall) {
            Write-Host "$LogPrefix Force reinstalling Composer..." -ForegroundColor Yellow
        }
        else {
            Write-Host "$LogPrefix Installing Composer..." -ForegroundColor Yellow
        }

        foreach ($requiredDir in @($composerDir, (Split-Path -Parent $installerPath))) {
            if (-not (Test-Path -LiteralPath $requiredDir)) {
                New-Item -ItemType Directory -Path $requiredDir -Force | Out-Null
            }
        }

        try {
            Write-Host "$LogPrefix Downloading Composer installer..." -ForegroundColor Yellow
            Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing

            Write-Host "$LogPrefix Running Composer installer..." -ForegroundColor Yellow
            & $PhpPath $installerPath --install-dir="$composerDir" --filename=composer.phar
        }
        catch {
            Write-Host "$LogPrefix Failed to install Composer: $($_.Exception.Message)" -ForegroundColor Red
        }
        finally {
            if (Test-Path -LiteralPath $installerPath) {
                Remove-Item -LiteralPath $installerPath -Force
            }
        }
    }

    if (-not (Test-Path -LiteralPath $composerPhar -PathType Leaf)) {
        Write-Host "$LogPrefix Composer binary is unavailable after installation" -ForegroundColor Red
        return $null
    }

    if (-not (Test-Path -LiteralPath $composerBat -PathType Leaf)) {
        $batContent = @"
@echo off
php "%~dp0composer.phar" %*
"@
        Set-Content -LiteralPath $composerBat -Value $batContent -Encoding ASCII
        Write-Host "$LogPrefix Repaired Composer launcher: $composerBat" -ForegroundColor Green
    }

    if (-not (Test-Path -LiteralPath $composerBat -PathType Leaf)) {
        Write-Host "$LogPrefix Composer launcher is unavailable after repair" -ForegroundColor Red
        return $null
    }

    Write-Host "$LogPrefix Ensuring Composer is in PATH..." -ForegroundColor Cyan
    & $windowsPathFunctionPath "add" $composerDir
    Write-Host "$LogPrefix Composer PATH repair completed: $composerDir" -ForegroundColor Green

    return $composerBat
}

# Converge the `php` CLI on one runtime (Linux ensure_single_php_link): <PhpExePath>'s
# directory owns `php` on PATH, PHP_HOME follows it, and PHP_INI_SCAN_DIR is set to
# <IniScanDir> or, when empty, removed if it still holds <StaleIniScanDir>.
# Idempotent: only drifted values are rewritten.
function Set-PhpCliRuntime {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PhpExePath,
        [string]$IniScanDir = "",
        [string]$StaleIniScanDir = "",
        [string]$LogPrefix = "[PHP-CLI]"
    )

    $phpDir = Split-Path -Parent $PhpExePath
    $currentHome = [Environment]::GetEnvironmentVariable("PHP_HOME", "Machine")
    $currentScanDir = [Environment]::GetEnvironmentVariable("PHP_INI_SCAN_DIR", "Machine")
    $resolvedPhp = $null
    $versionLine = ""

    & $windowsPathFunctionPath "add" $phpDir
    & $windowsPathFunctionPath "unique" "php" $phpDir

    if ($currentHome -ne $phpDir) {
        & $windowsPathFunctionPath "setvar" "PHP_HOME" $phpDir
    }
    $env:PHP_HOME = $phpDir

    if (-not [string]::IsNullOrWhiteSpace($IniScanDir)) {
        if ($currentScanDir -ne $IniScanDir) {
            & $windowsPathFunctionPath "setvar" "PHP_INI_SCAN_DIR" $IniScanDir
        }
        $env:PHP_INI_SCAN_DIR = $IniScanDir
    }
    elseif (-not [string]::IsNullOrWhiteSpace($StaleIniScanDir)) {
        if ($currentScanDir -eq $StaleIniScanDir) {
            & $windowsPathFunctionPath "removevar" "PHP_INI_SCAN_DIR"
        }
        if ($env:PHP_INI_SCAN_DIR -eq $StaleIniScanDir) {
            Remove-Item -Path "Env:PHP_INI_SCAN_DIR" -ErrorAction SilentlyContinue
        }
    }

    $resolvedPhp = Get-Command "php" -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($resolvedPhp -and ($resolvedPhp.Source -eq $PhpExePath)) {
        $versionLine = [string](& $PhpExePath -v 2>$null | Select-Object -First 1)
        Write-Host "$LogPrefix php CLI: $versionLine ($PhpExePath)" -ForegroundColor Green
        return $true
    }
    Write-Host "$LogPrefix Warning: php resolves to '$($resolvedPhp.Source)', expected $PhpExePath" -ForegroundColor Yellow
    return $false
}

function Get-ComposerGlobalBinDirectory {
    param (
        [Parameter(Mandatory = $true)]
        [string]$ComposerPath,
        [string]$LogPrefix = "[PHP-Composer]"
    )

    $composerBinOutput = @()
    $composerBinDir = $null
    $candidatePath = $null
    $composerHome = $env:COMPOSER_HOME

    try {
        $composerBinOutput = @(& $ComposerPath global config bin-dir --absolute --no-ansi 2>&1)
        foreach ($outputLine in $composerBinOutput) {
            $candidatePath = ([string]$outputLine).Trim()
            if ([System.IO.Path]::IsPathRooted($candidatePath)) {
                $composerBinDir = [System.IO.Path]::GetFullPath($candidatePath)
            }
        }
    }
    catch {
        Write-Host "$LogPrefix Warning: Failed to query Composer global bin directory: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    if (-not $composerBinDir) {
        if ([string]::IsNullOrWhiteSpace($composerHome)) {
            $composerHome = Join-Path $env:APPDATA "Composer"
        }
        $composerBinDir = Join-Path (Join-Path $composerHome "vendor") "bin"
    }

    return $composerBinDir
}

function Install-LaravelInstallerForPhp {
    param (
        [Parameter(Mandatory = $true)]
        [string]$ComposerPath,
        [string]$LogPrefix = "[PHP-Laravel]"
    )

    $composerBinDir = Get-ComposerGlobalBinDirectory -ComposerPath $ComposerPath -LogPrefix $LogPrefix
    $laravelBat = Join-Path $composerBinDir "laravel.bat"
    $laravelExecutable = Join-Path $composerBinDir "laravel"
    $laravelInstalled = (Test-Path -LiteralPath $laravelBat -PathType Leaf) -or (Test-Path -LiteralPath $laravelExecutable -PathType Leaf)

    if (-not $laravelInstalled) {
        Write-Host "$LogPrefix Installing Laravel Installer..." -ForegroundColor Yellow
        try {
            & $ComposerPath global require "laravel/installer" --no-interaction
        }
        catch {
            Write-Host "$LogPrefix Failed to install Laravel Installer: $($_.Exception.Message)" -ForegroundColor Red
        }
        $laravelInstalled = (Test-Path -LiteralPath $laravelBat -PathType Leaf) -or (Test-Path -LiteralPath $laravelExecutable -PathType Leaf)
    }
    else {
        Write-Host "$LogPrefix Laravel Installer is already installed" -ForegroundColor Green
    }

    if (-not $laravelInstalled) {
        Write-Host "$LogPrefix Laravel Installer binary is unavailable after installation" -ForegroundColor Red
        return
    }

    Write-Host "$LogPrefix Ensuring Laravel Installer is in PATH..." -ForegroundColor Cyan
    & $windowsPathFunctionPath "add" $composerBinDir
    Write-Host "$LogPrefix Laravel Installer PATH repair completed: $composerBinDir" -ForegroundColor Green
}

function Configure-PhpIniForPackage {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PhpDir,
        [Parameter(Mandatory = $true)]
        [string]$PhpExePath,
        [string]$LogPrefix = "[PHP-Config]"
    )

    $parentDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $phpConfigScriptPath = Join-Path $parentDir "1_phpconfig\configure_php_ini.php"
    $phpIniDepsFixPath = Join-Path $parentDir "1_phpconfig\fix_php_ini_deps.php"
    $phpErrorLogPath = Join-Path $PhpDir "error.log"

    Write-Host "$LogPrefix Configuring PHP using configure_php_ini.php..." -ForegroundColor Cyan

    if (-not (Test-Path $PhpExePath)) {
        Write-Host "$LogPrefix Error: PHP executable not found: $PhpExePath" -ForegroundColor Red
        return
    }

    if (-not (Test-Path $phpConfigScriptPath)) {
        Write-Host "$LogPrefix Error: configure_php_ini.php not found at $phpConfigScriptPath" -ForegroundColor Red
        return
    }

    try {
        Write-Host "$LogPrefix Running configure_php_ini.php..." -ForegroundColor Yellow
        & $PhpExePath $phpConfigScriptPath $PhpExePath $phpErrorLogPath
        if ($LASTEXITCODE -ne 0) {
            Write-Host "$LogPrefix Error: configure_php_ini.php exited with code $LASTEXITCODE" -ForegroundColor Red
            return
        }
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
            if (("$peclVersion").Contains('PECL') -or ("$peclVersion").Contains('PEAR')) {
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
        $goPearTempPath = Join-Path $Global:DOWNLOADS_DIR "go-pear.phar"
        
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
                # go-pear.phar is interactive (system/local, "Enter to continue", php.ini); empty lines take
                # every default. It uses the current directory as the default $prefix.
                $installOutput = ("`n" * 6) | & $PhpPath $goPearPath 2>&1
                # On a signature/hash error (and no PECL produced), retry with phar.require_hash=0
                if ((@($installOutput) -match "signature|hash") -and -not ((Test-Path $peclBatPath) -or (Test-Path $peclPhpPath))) {
                    Write-Host "$LogPrefix Retrying with phar.require_hash=0 flag..." -ForegroundColor Yellow
                    $installOutput = ("`n" * 6) | & $PhpPath -d phar.require_hash=0 $goPearPath 2>&1
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

    # Build facts straight from PHP: architecture, thread safety, major.minor, extension directory
    $phpArch = if ((Get-PhpRuntimeValue -PhpPath $PhpPath -Expression 'PHP_INT_SIZE') -eq '4') { "x86" } else { "x64" }
    Write-Host "$LogPrefix Detected PHP architecture: $phpArch" -ForegroundColor Cyan
    $phpThreadSafety = if ((Get-PhpRuntimeValue -PhpPath $PhpPath -Expression 'PHP_ZTS') -eq '1') { "ts" } else { "nts" }
    Write-Host "$LogPrefix Detected PHP thread safety: $phpThreadSafety" -ForegroundColor Cyan
    $phpMinorVersion = Get-PhpRuntimeValue -PhpPath $PhpPath -Expression "PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION"
    Write-Host "$LogPrefix Detected PHP version: $phpMinorVersion" -ForegroundColor Cyan
    $extDir = Get-PhpRuntimeValue -PhpPath $PhpPath -Expression "ini_get('extension_dir')"
    if ($extDir -and -not [System.IO.Path]::IsPathRooted($extDir)) { $extDir = Join-Path $InstallDir $extDir }

    # Validate the path - if it is not usable, use the default
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
                $peclOutput = & $PhpPath $peclPath install swoole 2>&1
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
    
    # Official builds are ZIPs named php_swoole-<version>-<PHP major.minor>-<ts|nts>-<vsNN>-<arch>.zip
    # (version from contract versions.swoole_windows); the ZIP holds php_swoole.dll.
    $swooleVersion = $script:SwooleWindowsVersion
    $dllPath = Join-Path $extDir $script:SwooleDllName
    $swooleZipName = ''
    $swooleZipUrl = ''
    $swooleZipPath = ''
    $swooleExtractDir = Join-Path $env:TEMP ("swoole_extract_{0}" -f $swooleVersion)
    $vsTag = ''

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
        Write-Host "$LogPrefix Swoole DLL not found; looking for the official build for PHP $phpMinorVersion ($phpThreadSafety, $phpArch), Swoole $swooleVersion..." -ForegroundColor Cyan
        foreach ($vsTag in $script:SwooleWindowsVsTags) {
            $swooleZipName = "php_swoole-{0}-{1}-{2}-{3}-{4}.zip" -f $swooleVersion.ToLowerInvariant(), $phpMinorVersion, $phpThreadSafety, $vsTag, $phpArch
            $swooleZipUrl = "{0}/{1}/{2}" -f $script:SwooleWindowsReleaseUrl, $swooleVersion, $swooleZipName
            try {
                Invoke-WebRequest -Uri $swooleZipUrl -Method Head -UseBasicParsing -ErrorAction Stop | Out-Null
            }
            catch {
                Write-Host "$LogPrefix Not published: $swooleZipUrl" -ForegroundColor Yellow
                $swooleZipUrl = ''
                continue
            }
            break
        }
        if ($swooleZipUrl) {
            $swooleZipPath = Join-Path $Global:DOWNLOADS_DIR $swooleZipName
            if (Get-FileWithSizeCheck -localPath $swooleZipPath -remoteUrl $swooleZipUrl -description "Swoole $swooleVersion for PHP $phpMinorVersion ($phpThreadSafety, $phpArch)") {
                try {
                    if (Test-Path $swooleExtractDir) { Remove-Item $swooleExtractDir -Recurse -Force }
                    Expand-Archive -Path $swooleZipPath -DestinationPath $swooleExtractDir -Force
                    $extractedDll = Get-ChildItem -Path $swooleExtractDir -Recurse -Filter $script:SwooleDllName -File | Select-Object -First 1
                    if ($extractedDll) {
                        Copy-Item -LiteralPath $extractedDll.FullName -Destination $dllPath -Force
                        $swooleDllFound = $true
                        $downloadedDllPath = $dllPath
                        Write-Host "$LogPrefix Swoole DLL installed: $dllPath" -ForegroundColor Green
                    } else {
                        Write-Host "$LogPrefix $($script:SwooleDllName) not found inside $swooleZipName" -ForegroundColor Yellow
                    }
                }
                catch {
                    Write-Host "$LogPrefix Extracting $swooleZipName failed: $($_.Exception.Message)" -ForegroundColor Yellow
                }
                finally {
                    if (Test-Path $swooleExtractDir) { Remove-Item $swooleExtractDir -Recurse -Force -ErrorAction SilentlyContinue }
                }
            }
        }
        else {
            Write-Host "$LogPrefix No official Swoole $swooleVersion build for PHP $phpMinorVersion ($phpThreadSafety, $phpArch)" -ForegroundColor Yellow
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
        $phpIniPath = Get-PhpRuntimeValue -PhpPath $PhpPath -Expression 'php_ini_loaded_file()'

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
                # Append exactly one extension line
                $phpIniContent = $phpIniContent.TrimEnd() + "`r`nextension=$dllFileNameOnly`r`n"
                
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

    $composerPath = Join-Path $InstallDir "composer.bat"
    $phpOperation = if ($PhpCallback.ContainsKey("Operation")) { $PhpCallback.Operation } else { "" }

    Write-Host "$LogPrefix Processing PHP post-installation for $PackageName" -ForegroundColor Cyan

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
            Install-ComposerForPhp -PhpPath $ExecutablePath -InstallDir $InstallDir -LogPrefix $LogPrefix | Out-Null
            if (Test-Path -LiteralPath $composerPath -PathType Leaf) {
                Install-LaravelInstallerForPhp -ComposerPath $composerPath -LogPrefix $LogPrefix
            }
        }
        "full_setup" {
            Write-Host "$LogPrefix Performing full PHP setup (INI + Extensions + Composer + Laravel + Swoole)..." -ForegroundColor Yellow

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
                Install-ComposerForPhp -PhpPath $ExecutablePath -InstallDir $InstallDir -LogPrefix $LogPrefix -ForceReinstall $false | Out-Null
            }
            catch {
                Write-Host "$LogPrefix Warning: Failed to install Composer: $($_.Exception.Message)" -ForegroundColor Yellow
            }

            # Step 4: Install Laravel Installer and repair its PATH (continue even if it fails)
            try {
                if (Test-Path -LiteralPath $composerPath -PathType Leaf) {
                    Install-LaravelInstallerForPhp -ComposerPath $composerPath -LogPrefix $LogPrefix
                }
            }
            catch {
                Write-Host "$LogPrefix Warning: Failed to install Laravel Installer: $($_.Exception.Message)" -ForegroundColor Yellow
            }

            # Step 5: Install Swoole extension (always run, never skip, continue even if fails)
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
