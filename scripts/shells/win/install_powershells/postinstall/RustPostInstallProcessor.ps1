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

# Rust Post-Installation Processor
# Handles Rust toolchain configuration, Cargo setup, and development environment optimization

# Import required modules
$parentDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. "$parentDir\win_common\GlobalVars.ps1"
. "$parentDir\win_common\CommonFunc.ps1"

# Note: Environment variables (RUST_HOME, CARGO_HOME, PATH) are handled by
# Set-MultipleEnvironmentVariablesForPackage in Step21_InstallApplications.ps1

function Configure-CargoSettings {
    param (
        [Parameter(Mandatory = $true)]
        [string]$RustPath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [hashtable]$RustCallback = @{},
        [string]$LogPrefix = "[Rust-Cargo]"
    )
    
    Write-Host "$LogPrefix Configuring Cargo settings..." -ForegroundColor Cyan
    
    # Create .cargo directory if it doesn't exist
    $cargoDir = Join-Path $env:USERPROFILE ".cargo"
    if (-not (Test-Path $cargoDir)) {
        New-Item -ItemType Directory -Path $cargoDir -Force | Out-Null
        Write-Host "$LogPrefix Created Cargo directory: $cargoDir" -ForegroundColor Green
    }
    
    # Create config.toml for Cargo configuration
    $configTomlPath = Join-Path $cargoDir "config.toml"
    
    # Check if we should configure mirrors based on region
    $shouldConfigureMirrors = -not $Global:RegionIsGlobal
    $registryUrl = "https://github.com/rust-lang/crates.io-index"

    # Use region-specific registry for non-global regions
    if ($shouldConfigureMirrors) {
        $registryUrl = "https://mirrors.ustc.edu.cn/crates.io-index"
        Write-Host "$LogPrefix Using region-specific Cargo registry: $registryUrl" -ForegroundColor Yellow
    } else {
        Write-Host "$LogPrefix Using default Cargo registry (Global region)" -ForegroundColor Cyan
    }
    
    # Create config.toml content
    $configTomlContent = @"
[build]
# Use all available CPU cores for compilation
jobs = 0

[cargo-new]
# Default template for new projects
name = "Your Name"
email = "your.email@example.com"

[net]
# Network configuration
retry = 2
git-fetch-with-cli = true

"@
    
    if ($shouldConfigureMirrors) {
        $configTomlContent += @"

[source.crates-io]
# Use faster mirror for crates.io
replace-with = "ustc"

[source.ustc]
registry = "$registryUrl"

"@
    }
    
    $configTomlContent += @"

[profile.dev]
# Development profile optimizations
opt-level = 0
debug = true
split-debuginfo = "unpacked"

[profile.release]
# Release profile optimizations
opt-level = 3
debug = false
lto = true
codegen-units = 1
panic = "abort"

"@
    
    # Write config.toml
    try {
        Set-Content -Path $configTomlPath -Value $configTomlContent -Encoding UTF8
        Write-Host "$LogPrefix Created Cargo config.toml: $configTomlPath" -ForegroundColor Green
        
        if ($shouldConfigureMirrors) {
            Write-Host "$LogPrefix Configured Cargo registry mirror for faster downloads" -ForegroundColor Green
        }
        
        return $true
    }
    catch {
        Write-Host "$LogPrefix Failed to create Cargo config.toml: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Install-RustComponents {
    param (
        [Parameter(Mandatory = $true)]
        [string]$RustPath,
        [string]$LogPrefix = "[Rust-Components]"
    )
    
    Write-Host "$LogPrefix Installing essential Rust components..." -ForegroundColor Cyan
    
    try {
        # Install rustfmt (code formatter)
        $rustupPath = Join-Path (Split-Path $RustPath -Parent) "rustup.exe"
        if (Test-Path $rustupPath) {
            Write-Host "$LogPrefix Installing rustfmt..." -ForegroundColor Yellow
            & $rustupPath component add rustfmt 2>&1 | Out-Null
            $rustfmtPath = Join-Path (Split-Path $RustPath -Parent) "rustfmt.exe"
            if (Test-Path -LiteralPath $rustfmtPath) {
                Write-Host "$LogPrefix rustfmt installed successfully" -ForegroundColor Green
            }
            
            # Install clippy (linter)
            Write-Host "$LogPrefix Installing clippy..." -ForegroundColor Yellow
            & $rustupPath component add clippy 2>&1 | Out-Null
            $clippyPath = Join-Path (Split-Path $RustPath -Parent) "clippy-driver.exe"
            if (Test-Path -LiteralPath $clippyPath) {
                Write-Host "$LogPrefix clippy installed successfully" -ForegroundColor Green
            }
            
            # Install rust-src (source code for standard library)
            Write-Host "$LogPrefix Installing rust-src..." -ForegroundColor Yellow
            & $rustupPath component add rust-src 2>&1 | Out-Null
            $componentList = & $rustupPath component list --installed 2>&1
            if ("$componentList" -match 'rust-src') {
                Write-Host "$LogPrefix rust-src installed successfully" -ForegroundColor Green
            }
        } else {
            Write-Host "$LogPrefix rustup not found, skipping component installation" -ForegroundColor Yellow
        }
        
        return $true
    }
    catch {
        Write-Host "$LogPrefix Failed to install Rust components: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-RustInstallation {
    param (
        [Parameter(Mandatory = $true)]
        [string]$RustPath,
        [string]$LogPrefix = "[Rust-Test]"
    )
    
    Write-Host "$LogPrefix Testing Rust installation..." -ForegroundColor Cyan
    
    try {
        # Test Rust compiler version
        $rustVersion = & $RustPath --version 2>&1
        if (("$rustVersion").Contains('rustc')) {
            Write-Host "$LogPrefix Rust compiler check passed" -ForegroundColor Green
            $versionLine = ($rustVersion | Select-Object -First 1).ToString()
            Write-Host "$LogPrefix $versionLine" -ForegroundColor Cyan
        } else {
            Write-Host "$LogPrefix Rust compiler check failed" -ForegroundColor Red
            return $false
        }
        
        # Test Cargo (package manager)
        $cargoPath = Join-Path (Split-Path $RustPath -Parent) "cargo.exe"
        if (Test-Path $cargoPath) {
            $cargoVersion = & $cargoPath --version 2>&1
            if (("$cargoVersion").Contains('cargo')) {
                Write-Host "$LogPrefix Cargo check passed" -ForegroundColor Green
                $cargoVersionLine = ($cargoVersion | Select-Object -First 1).ToString()
                Write-Host "$LogPrefix $cargoVersionLine" -ForegroundColor Cyan
            } else {
                Write-Host "$LogPrefix Cargo check failed" -ForegroundColor Yellow
            }
        } else {
            Write-Host "$LogPrefix Cargo not found" -ForegroundColor Yellow
        }
        
        return $true
    }
    catch {
        Write-Host "$LogPrefix Rust installation test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Invoke-RustPostInstallProcessor {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$RustCallback,
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[Rust-PostInstall]"
    )
    
    Write-Host "$LogPrefix Processing Rust post-installation for $PackageName" -ForegroundColor Cyan
    
    $rustOperation = if ($RustCallback.ContainsKey("Operation")) { $RustCallback.Operation } else { "full_setup" }
    
    Write-Host "$LogPrefix Rust Operation: $rustOperation" -ForegroundColor Cyan
    
    $success = $false
    
    switch ($rustOperation.ToLower()) {
        "configure_cargo" {
            Write-Host "$LogPrefix Configuring Cargo..." -ForegroundColor Yellow
            $success = Configure-CargoSettings -RustPath $ExecutablePath -InstallDir $InstallDir -RustCallback $RustCallback -LogPrefix $LogPrefix
        }
        "install_components" {
            Write-Host "$LogPrefix Installing Rust components..." -ForegroundColor Yellow
            $success = Install-RustComponents -RustPath $ExecutablePath -LogPrefix $LogPrefix
        }
        "full_setup" {
            Write-Host "$LogPrefix Performing Rust configuration (Cargo + Components + Test)..." -ForegroundColor Yellow
            Write-Host "$LogPrefix Note: Environment variables handled by Step12" -ForegroundColor Cyan

            # Step 1: Configure Cargo
            $cargoSuccess = Configure-CargoSettings -RustPath $ExecutablePath -InstallDir $InstallDir -RustCallback $RustCallback -LogPrefix $LogPrefix

            # Step 2: Install components
            $componentsSuccess = Install-RustComponents -RustPath $ExecutablePath -LogPrefix $LogPrefix

            # Step 3: Test installation
            $testSuccess = Test-RustInstallation -RustPath $ExecutablePath -LogPrefix $LogPrefix
            if (-not $testSuccess) {
                Write-Host "$LogPrefix Warning: Rust installation test failed, but configuration completed" -ForegroundColor Yellow
            }

            $success = $cargoSuccess -and $componentsSuccess
        }
        default {
            Write-Host "$LogPrefix Error: Unknown Rust operation: $rustOperation" -ForegroundColor Red
            return $false
        }
    }
    
    if ($success) {
        Write-Host "$LogPrefix Rust post-installation completed successfully" -ForegroundColor Green
    } else {
        Write-Host "$LogPrefix Rust post-installation failed" -ForegroundColor Red
    }
    
    return $success
}
