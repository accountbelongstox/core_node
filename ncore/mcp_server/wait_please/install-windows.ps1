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

<#
.SYNOPSIS
    Build and install the cunzhi MCP tools on Windows (English-only, ASCII-safe).
.DESCRIPTION
    Builds the frontend (pnpm) and the Rust binaries (cargo), then installs the
    produced executables into %LOCALAPPDATA%\cunzhi\bin and adds it to the user PATH.

    The Rust crate defines its binaries with non-ASCII (Chinese) names in
    Cargo.toml. To keep this script pure ASCII (PowerShell 5.1 mis-decodes
    non-ASCII source unless saved as UTF-8 with BOM, which was the cause of the
    previous corruption), the produced executables are DISCOVERED at runtime from
    target\release rather than referenced by hard-coded names.
.PARAMETER BuildOnly
    Build the binaries but do not install or modify PATH.
#>

param(
    [switch]$BuildOnly = $false
)

#region Variable Declarations
$ErrorActionPreference = "Stop"
$script:PROJECT_DIR = $PSScriptRoot
$script:RELEASE_DIR = Join-Path $script:PROJECT_DIR "target\release"
$script:NODE_MODULES_DIR = Join-Path $script:PROJECT_DIR "node_modules"
$script:LOCAL_APP_DATA = $env:LOCALAPPDATA
$script:INSTALL_DIR = Join-Path $script:LOCAL_APP_DATA "cunzhi"
$script:BIN_DIR = Join-Path $script:INSTALL_DIR "bin"
$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:COLOR_INFO = "Cyan"
$script:ProducedBinaries = @()
#endregion

#region Helper Functions
function Test-CommandExists {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}
#endregion

#region Main
Write-Host "[*] Building cunzhi MCP tools (Windows)..." -ForegroundColor $script:COLOR_SUCCESS

Write-Host "[*] Checking dependencies..." -ForegroundColor $script:COLOR_WARNING
if (-not (Test-CommandExists "cargo")) {
    Write-Host "[X] Error: 'cargo' not found." -ForegroundColor $script:COLOR_ERROR
    Write-Host "    Install Rust: https://rustup.rs/" -ForegroundColor $script:COLOR_ERROR
    exit 1
}
if (-not (Test-CommandExists "pnpm")) {
    Write-Host "[X] Error: 'pnpm' not found." -ForegroundColor $script:COLOR_ERROR
    Write-Host "    Install pnpm: npm install -g pnpm" -ForegroundColor $script:COLOR_ERROR
    exit 1
}

Push-Location $script:PROJECT_DIR
try {
    if (-not (Test-Path -LiteralPath $script:NODE_MODULES_DIR)) {
        Write-Host "[*] Installing frontend dependencies (pnpm install)..." -ForegroundColor $script:COLOR_WARNING
        pnpm install
    }

    Write-Host "[*] Building frontend (pnpm build)..." -ForegroundColor $script:COLOR_WARNING
    pnpm build

    Write-Host "[*] Building Rust binaries (cargo build --release)..." -ForegroundColor $script:COLOR_WARNING
    cargo build --release

    if (-not (Test-Path -LiteralPath $script:RELEASE_DIR)) {
        Write-Host "[X] Build failed: release directory not found at $script:RELEASE_DIR" -ForegroundColor $script:COLOR_ERROR
        exit 1
    }

    # Discover the produced top-level executables (the crate's two binaries).
    $script:ProducedBinaries = @(Get-ChildItem -LiteralPath $script:RELEASE_DIR -Filter "*.exe" -File -ErrorAction SilentlyContinue)
    if ($script:ProducedBinaries.Count -eq 0) {
        Write-Host "[X] Build failed: no .exe found in $script:RELEASE_DIR" -ForegroundColor $script:COLOR_ERROR
        exit 1
    }

    Write-Host "[+] Build complete. Produced binaries:" -ForegroundColor $script:COLOR_SUCCESS
    foreach ($bin in $script:ProducedBinaries) {
        Write-Host "    $($bin.Name)" -ForegroundColor $script:COLOR_INFO
    }
} finally {
    Pop-Location
}

if ($BuildOnly) {
    Write-Host ""
    Write-Host "[+] Build-only mode complete." -ForegroundColor $script:COLOR_SUCCESS
    Write-Host "[*] Binaries are in: $script:RELEASE_DIR" -ForegroundColor $script:COLOR_INFO
    exit 0
}

Write-Host "[*] Installing to: $script:INSTALL_DIR" -ForegroundColor $script:COLOR_WARNING
New-Item -ItemType Directory -Path $script:BIN_DIR -Force | Out-Null

foreach ($bin in $script:ProducedBinaries) {
    $dest = Join-Path $script:BIN_DIR $bin.Name
    Copy-Item -LiteralPath $bin.FullName -Destination $dest -Force
}
Write-Host "[+] Installed binaries to: $script:BIN_DIR" -ForegroundColor $script:COLOR_SUCCESS

# Add bin dir to the User PATH if not already present.
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if (-not $currentPath) { $currentPath = "" }
if ($currentPath -notlike "*$script:BIN_DIR*") {
    Write-Host "[*] Adding bin directory to User PATH..." -ForegroundColor $script:COLOR_WARNING
    try {
        $newPath = if ($currentPath.Length -gt 0) { "$currentPath;$script:BIN_DIR" } else { $script:BIN_DIR }
        [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
        Write-Host "[+] Added to PATH: $script:BIN_DIR" -ForegroundColor $script:COLOR_SUCCESS
        Write-Host "[*] Restart your terminal for the PATH change to take effect." -ForegroundColor $script:COLOR_INFO
    } catch {
        Write-Host "[!] Could not modify PATH automatically. Add this directory manually: $script:BIN_DIR" -ForegroundColor $script:COLOR_WARNING
    }
} else {
    Write-Host "[+] Bin directory already in PATH." -ForegroundColor $script:COLOR_SUCCESS
}

Write-Host ""
Write-Host "[+] cunzhi MCP tools installed." -ForegroundColor $script:COLOR_SUCCESS
Write-Host "[*] Install dir: $script:INSTALL_DIR" -ForegroundColor $script:COLOR_INFO
Write-Host "[*] Bin dir:     $script:BIN_DIR" -ForegroundColor $script:COLOR_INFO
Write-Host "[*] Add the MCP server binary (the one ending without the UI window) to your MCP client config." -ForegroundColor $script:COLOR_INFO
#endregion
