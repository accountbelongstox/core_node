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

# Ruby Post-Installation Processor
# Handles Ruby configuration, Gem setup, and development environment optimization

# Import required modules
$parentDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. "$parentDir\win_common\GlobalVars.ps1"
. "$parentDir\win_common\CommanFunc.ps1"

# Note: Environment variables (RUBY_HOME, PATH) are handled by
# Set-MultipleEnvironmentVariablesForPackage in Step12_InstallApplications.ps1

function Configure-GemSettings {
    param (
        [Parameter(Mandatory = $true)]
        [string]$RubyPath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [hashtable]$RubyCallback = @{},
        [string]$LogPrefix = "[Ruby-Gem]"
    )
    
    Write-Host "$LogPrefix Configuring Gem settings..." -ForegroundColor Cyan
    
    # Get gem command path
    $gemPath = Join-Path (Split-Path $RubyPath -Parent) "gem.exe"
    if (-not (Test-Path $gemPath)) {
        $gemPath = Join-Path (Split-Path $RubyPath -Parent) "gem.cmd"
    }
    
    if (-not (Test-Path $gemPath)) {
        Write-Host "$LogPrefix Gem command not found, skipping gem configuration" -ForegroundColor Yellow
        return $false
    }
    
    try {
        # Check for region-specific configuration
        $shouldConfigureMirrors = -not $Global:RegionIsGlobal
        $gemSource = "https://rubygems.org/"

        if ($shouldConfigureMirrors) {
            $gemSource = "https://gems.ruby-china.com/"
            Write-Host "$LogPrefix Using region-specific Gem source: $gemSource" -ForegroundColor Yellow
        } else {
            Write-Host "$LogPrefix Using default Gem source (Global region)" -ForegroundColor Cyan
        }
        
        if ($shouldConfigureMirrors) {
            # Remove default source and add mirror
            Write-Host "$LogPrefix Configuring Gem mirror..." -ForegroundColor Yellow
            & $gemPath sources --remove https://rubygems.org/ 2>&1 | Out-Null
            & $gemPath sources --add $gemSource 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "$LogPrefix Gem mirror configured successfully" -ForegroundColor Green
            } else {
                Write-Host "$LogPrefix Failed to configure Gem mirror" -ForegroundColor Yellow
            }
        }
        
        # Configure gem to not install documentation by default (faster installs)
        $gemrcPath = Join-Path $env:USERPROFILE ".gemrc"
        $gemrcContent = @"
gem: --no-document
install: --no-document
update: --no-document
"@
        
        Set-Content -Path $gemrcPath -Value $gemrcContent -Encoding UTF8
        Write-Host "$LogPrefix Created .gemrc configuration: $gemrcPath" -ForegroundColor Green
        
        return $true
    }
    catch {
        Write-Host "$LogPrefix Failed to configure Gem settings: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Install-EssentialGems {
    param (
        [Parameter(Mandatory = $true)]
        [string]$RubyPath,
        [string]$LogPrefix = "[Ruby-Gems]"
    )
    
    Write-Host "$LogPrefix Installing essential Ruby gems..." -ForegroundColor Cyan
    
    # Get gem command path
    $gemPath = Join-Path (Split-Path $RubyPath -Parent) "gem.exe"
    if (-not (Test-Path $gemPath)) {
        $gemPath = Join-Path (Split-Path $RubyPath -Parent) "gem.cmd"
    }
    
    if (-not (Test-Path $gemPath)) {
        Write-Host "$LogPrefix Gem command not found, skipping gem installation" -ForegroundColor Yellow
        return $false
    }
    
    try {
        # List of essential gems
        $essentialGems = @(
            "bundler",
            "rake",
            "minitest",
            "rubocop"
        )
        
        foreach ($gem in $essentialGems) {
            Write-Host "$LogPrefix Installing gem: $gem..." -ForegroundColor Yellow
            try {
                & $gemPath install $gem 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "$LogPrefix $gem installed successfully" -ForegroundColor Green
                } else {
                    Write-Host "$LogPrefix Failed to install $gem" -ForegroundColor Yellow
                }
            }
            catch {
                Write-Host "$LogPrefix Error installing $gem: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
        
        return $true
    }
    catch {
        Write-Host "$LogPrefix Failed to install essential gems: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Setup-BundlerConfig {
    param (
        [Parameter(Mandatory = $true)]
        [string]$RubyPath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [string]$LogPrefix = "[Ruby-Bundler]"
    )
    
    Write-Host "$LogPrefix Setting up Bundler configuration..." -ForegroundColor Cyan
    
    # Get bundler command path
    $bundlerPath = Join-Path (Split-Path $RubyPath -Parent) "bundle.exe"
    if (-not (Test-Path $bundlerPath)) {
        $bundlerPath = Join-Path (Split-Path $RubyPath -Parent) "bundle.cmd"
    }
    
    if (-not (Test-Path $bundlerPath)) {
        Write-Host "$LogPrefix Bundler command not found, skipping bundler configuration" -ForegroundColor Yellow
        return $false
    }
    
    try {
        # Configure bundler to use parallel jobs
        & $bundlerPath config --global jobs 4 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "$LogPrefix Configured Bundler to use 4 parallel jobs" -ForegroundColor Green
        }
        
        # Configure bundler to retry failed downloads
        & $bundlerPath config --global retry 3 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "$LogPrefix Configured Bundler to retry failed downloads 3 times" -ForegroundColor Green
        }
        
        return $true
    }
    catch {
        Write-Host "$LogPrefix Failed to configure Bundler: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-RubyInstallation {
    param (
        [Parameter(Mandatory = $true)]
        [string]$RubyPath,
        [string]$LogPrefix = "[Ruby-Test]"
    )
    
    Write-Host "$LogPrefix Testing Ruby installation..." -ForegroundColor Cyan
    
    try {
        # Test Ruby version
        $rubyVersion = & $RubyPath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "$LogPrefix Ruby version check passed" -ForegroundColor Green
            $versionLine = ($rubyVersion | Select-Object -First 1).ToString()
            Write-Host "$LogPrefix $versionLine" -ForegroundColor Cyan
        } else {
            Write-Host "$LogPrefix Ruby version check failed" -ForegroundColor Red
            return $false
        }
        
        # Test Gem
        $gemPath = Join-Path (Split-Path $RubyPath -Parent) "gem.exe"
        if (-not (Test-Path $gemPath)) {
            $gemPath = Join-Path (Split-Path $RubyPath -Parent) "gem.cmd"
        }
        
        if (Test-Path $gemPath) {
            $gemVersion = & $gemPath --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "$LogPrefix Gem check passed" -ForegroundColor Green
                $gemVersionLine = ($gemVersion | Select-Object -First 1).ToString()
                Write-Host "$LogPrefix Gem version: $gemVersionLine" -ForegroundColor Cyan
            } else {
                Write-Host "$LogPrefix Gem check failed" -ForegroundColor Yellow
            }
        } else {
            Write-Host "$LogPrefix Gem not found" -ForegroundColor Yellow
        }
        
        return $true
    }
    catch {
        Write-Host "$LogPrefix Ruby installation test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Invoke-RubyPostInstallProcessor {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$RubyCallback,
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[Ruby-PostInstall]"
    )
    
    Write-Host "$LogPrefix Processing Ruby post-installation for $PackageName" -ForegroundColor Cyan
    
    $rubyOperation = if ($RubyCallback.ContainsKey("Operation")) { $RubyCallback.Operation } else { "full_setup" }
    
    Write-Host "$LogPrefix Ruby Operation: $rubyOperation" -ForegroundColor Cyan
    
    $success = $false
    
    switch ($rubyOperation.ToLower()) {
        "configure_gem" {
            Write-Host "$LogPrefix Configuring Gem..." -ForegroundColor Yellow
            $success = Configure-GemSettings -RubyPath $ExecutablePath -InstallDir $InstallDir -RubyCallback $RubyCallback -LogPrefix $LogPrefix
        }
        "install_gems" {
            Write-Host "$LogPrefix Installing essential gems..." -ForegroundColor Yellow
            $success = Install-EssentialGems -RubyPath $ExecutablePath -LogPrefix $LogPrefix
        }
        "setup_bundler" {
            Write-Host "$LogPrefix Setting up Bundler..." -ForegroundColor Yellow
            $success = Setup-BundlerConfig -RubyPath $ExecutablePath -InstallDir $InstallDir -LogPrefix $LogPrefix
        }
        "full_setup" {
            Write-Host "$LogPrefix Performing Ruby configuration (Gem + Gems + Bundler + Test)..." -ForegroundColor Yellow
            Write-Host "$LogPrefix Note: Environment variables handled by Step12" -ForegroundColor Cyan

            # Step 1: Configure Gem
            $gemSuccess = Configure-GemSettings -RubyPath $ExecutablePath -InstallDir $InstallDir -RubyCallback $RubyCallback -LogPrefix $LogPrefix

            # Step 2: Install essential gems
            $gemsSuccess = Install-EssentialGems -RubyPath $ExecutablePath -LogPrefix $LogPrefix

            # Step 3: Setup Bundler
            $bundlerSuccess = Setup-BundlerConfig -RubyPath $ExecutablePath -InstallDir $InstallDir -LogPrefix $LogPrefix

            # Step 4: Test installation
            $testSuccess = Test-RubyInstallation -RubyPath $ExecutablePath -LogPrefix $LogPrefix
            if (-not $testSuccess) {
                Write-Host "$LogPrefix Warning: Ruby installation test failed, but configuration completed" -ForegroundColor Yellow
            }

            $success = $gemSuccess -and $gemsSuccess -and $bundlerSuccess
        }
        default {
            Write-Host "$LogPrefix Error: Unknown Ruby operation: $rubyOperation" -ForegroundColor Red
            return $false
        }
    }
    
    if ($success) {
        Write-Host "$LogPrefix Ruby post-installation completed successfully" -ForegroundColor Green
    } else {
        Write-Host "$LogPrefix Ruby post-installation failed" -ForegroundColor Red
    }
    
    return $success
}
