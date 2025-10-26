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

# Go Post-Installation Processor
# Handles Go toolchain configuration, module setup, and development environment optimization

# Import required modules
$parentDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. "$parentDir\win_common\GlobalVars.ps1"
. "$parentDir\win_common\CommonFunc.ps1"

# Note: Environment variables (GOROOT, GOPATH, PATH) are handled by
# Set-MultipleEnvironmentVariablesForPackage in Step12_InstallApplications.ps1

function Configure-GoProxy {
    param (
        [Parameter(Mandatory = $true)]
        [string]$GoPath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [hashtable]$GoCallback = @{},
        [string]$LogPrefix = "[Go-Proxy]"
    )
    
    Write-Host "$LogPrefix Configuring Go proxy settings..." -ForegroundColor Cyan
    
    # Check for region-specific configuration
    $proxyUrl = "https://proxy.golang.org,direct"
    $sumdbUrl = "sum.golang.org"

    if (-not $Global:RegionIsGlobal) {
        $proxyUrl = "https://goproxy.cn,direct"
        $sumdbUrl = "sum.golang.google.cn"
        Write-Host "$LogPrefix Using region-specific Go proxy: $proxyUrl" -ForegroundColor Yellow
    } else {
        Write-Host "$LogPrefix Using default Go proxy (Global region)" -ForegroundColor Cyan
    }
    
    # Note: GOPROXY, GOSUMDB, GO111MODULE environment variables should be set via
    # ApplicationsList.ps1 EnvVars configuration and handled by Step12
    Write-Host "$LogPrefix Configured Go proxy settings: $proxyUrl" -ForegroundColor Green
    Write-Host "$LogPrefix Configured Go sumdb: $sumdbUrl" -ForegroundColor Green
    Write-Host "$LogPrefix Note: Environment variables will be set by Step12" -ForegroundColor Cyan
    
    return $true
}

function Setup-GoWorkspace {
    param (
        [Parameter(Mandatory = $true)]
        [string]$GoPath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [string]$LogPrefix = "[Go-Workspace]"
    )
    
    Write-Host "$LogPrefix Setting up Go workspace..." -ForegroundColor Cyan
    
    # Create GOPATH directory structure
    $goPath = Join-Path $env:USERPROFILE "go"
    $srcDir = Join-Path $goPath "src"
    $binDir = Join-Path $goPath "bin"
    $pkgDir = Join-Path $goPath "pkg"
    
    # Create directories if they don't exist
    foreach ($dir in @($goPath, $srcDir, $binDir, $pkgDir)) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Host "$LogPrefix Created directory: $dir" -ForegroundColor Green
        } else {
            Write-Host "$LogPrefix Directory already exists: $dir" -ForegroundColor Cyan
        }
    }
    
    return $true
}

function Install-GoTools {
    param (
        [Parameter(Mandatory = $true)]
        [string]$GoPath,
        [string]$LogPrefix = "[Go-Tools]"
    )
    
    Write-Host "$LogPrefix Installing essential Go tools..." -ForegroundColor Cyan
    
    try {
        # List of essential Go tools
        $goTools = @(
            "golang.org/x/tools/cmd/goimports",
            "golang.org/x/tools/cmd/godoc",
            "golang.org/x/lint/golint",
            "github.com/go-delve/delve/cmd/dlv"
        )
        
        foreach ($tool in $goTools) {
            Write-Host "$LogPrefix Installing $tool..." -ForegroundColor Yellow
            try {
                & $GoPath install "$tool@latest" 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "$LogPrefix $tool installed successfully" -ForegroundColor Green
                } else {
                    Write-Host "$LogPrefix Failed to install $tool" -ForegroundColor Yellow
                }
            }
            catch {
                Write-Host "$LogPrefix Error installing $tool: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
        
        return $true
    }
    catch {
        Write-Host "$LogPrefix Failed to install Go tools: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-GoInstallation {
    param (
        [Parameter(Mandatory = $true)]
        [string]$GoPath,
        [string]$LogPrefix = "[Go-Test]"
    )
    
    Write-Host "$LogPrefix Testing Go installation..." -ForegroundColor Cyan
    
    try {
        # Test Go version
        $goVersion = & $GoPath version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "$LogPrefix Go version check passed" -ForegroundColor Green
            $versionLine = ($goVersion | Select-Object -First 1).ToString()
            Write-Host "$LogPrefix $versionLine" -ForegroundColor Cyan
        } else {
            Write-Host "$LogPrefix Go version check failed" -ForegroundColor Red
            return $false
        }
        
        # Test Go environment
        $goEnv = & $GoPath env GOROOT GOPATH GOPROXY 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "$LogPrefix Go environment check passed" -ForegroundColor Green
            foreach ($line in $goEnv) {
                Write-Host "$LogPrefix $line" -ForegroundColor Cyan
            }
        } else {
            Write-Host "$LogPrefix Go environment check failed" -ForegroundColor Yellow
        }
        
        return $true
    }
    catch {
        Write-Host "$LogPrefix Go installation test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Invoke-GoPostInstallProcessor {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$GoCallback,
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[Go-PostInstall]"
    )
    
    Write-Host "$LogPrefix Processing Go post-installation for $PackageName" -ForegroundColor Cyan
    
    $goOperation = if ($GoCallback.ContainsKey("Operation")) { $GoCallback.Operation } else { "full_setup" }
    
    Write-Host "$LogPrefix Go Operation: $goOperation" -ForegroundColor Cyan
    
    $success = $false
    
    switch ($goOperation.ToLower()) {
        "configure_proxy" {
            Write-Host "$LogPrefix Configuring Go proxy..." -ForegroundColor Yellow
            $success = Configure-GoProxy -GoPath $ExecutablePath -InstallDir $InstallDir -GoCallback $GoCallback -LogPrefix $LogPrefix
        }
        "setup_workspace" {
            Write-Host "$LogPrefix Setting up Go workspace..." -ForegroundColor Yellow
            $success = Setup-GoWorkspace -GoPath $ExecutablePath -InstallDir $InstallDir -LogPrefix $LogPrefix
        }
        "install_tools" {
            Write-Host "$LogPrefix Installing Go tools..." -ForegroundColor Yellow
            $success = Install-GoTools -GoPath $ExecutablePath -LogPrefix $LogPrefix
        }
        "full_setup" {
            Write-Host "$LogPrefix Performing Go configuration (Proxy + Workspace + Tools + Test)..." -ForegroundColor Yellow
            Write-Host "$LogPrefix Note: Environment variables handled by Step12" -ForegroundColor Cyan

            # Step 1: Configure proxy
            $proxySuccess = Configure-GoProxy -GoPath $ExecutablePath -InstallDir $InstallDir -GoCallback $GoCallback -LogPrefix $LogPrefix

            # Step 2: Setup workspace
            $workspaceSuccess = Setup-GoWorkspace -GoPath $ExecutablePath -InstallDir $InstallDir -LogPrefix $LogPrefix

            # Step 3: Install tools
            $toolsSuccess = Install-GoTools -GoPath $ExecutablePath -LogPrefix $LogPrefix

            # Step 4: Test installation
            $testSuccess = Test-GoInstallation -GoPath $ExecutablePath -LogPrefix $LogPrefix
            if (-not $testSuccess) {
                Write-Host "$LogPrefix Warning: Go installation test failed, but configuration completed" -ForegroundColor Yellow
            }

            $success = $proxySuccess -and $workspaceSuccess -and $toolsSuccess
        }
        default {
            Write-Host "$LogPrefix Error: Unknown Go operation: $goOperation" -ForegroundColor Red
            return $false
        }
    }
    
    if ($success) {
        Write-Host "$LogPrefix Go post-installation completed successfully" -ForegroundColor Green
    } else {
        Write-Host "$LogPrefix Go post-installation failed" -ForegroundColor Red
    }
    
    return $success
}
