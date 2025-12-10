# ============================================
# Windows Variable Reader and Command Executor (Refactored)
# Reads file variables directly (no JSON, no Python)
# Each variable is a separate file: filename=KEY, content=VALUE
# Uses global variable directory: C:\Users\USERNAME\.core_node\.build_global_vars
# ============================================

param(
    [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"

# ============================================
# VARIABLE DECLARATIONS
# ============================================

# Global variable directory (Windows)
$GlobalVarDir = Join-Path $env:USERPROFILE ".core_node\.build_global_vars"
$VarDir = $GlobalVarDir
$CmdDir = Join-Path $VarDir "commands"
$AppPrefix = ""  # Will be determined from var files

# Ensure global variable directory exists
if (-not (Test-Path $VarDir)) {
    New-Item -Path $VarDir -ItemType Directory -Force | Out-Null
}
if (-not (Test-Path $CmdDir)) {
    New-Item -Path $CmdDir -ItemType Directory -Force | Out-Null
}

Write-Host "[FileVarSystem] Global variable directory: $VarDir" -ForegroundColor Cyan

# ============================================
# KEY CENTER - Shared with Python and Linux
# ============================================

# Import key definitions from key_center.py
$KEY_PROJECT_ROOT = "PROJECT_ROOT"
$KEY_ANDROID_PATH = "ANDROID_PATH"
$KEY_PACKAGE_JSON_PATH = "PACKAGE_JSON_PATH"
$KEY_PACKAGE_JSON_BACKUP_PATH = "PACKAGE_JSON_BACKUP_PATH"

$KEY_APP_NAME = "APP_NAME"
$KEY_DISPLAY_NAME_EN = "DISPLAY_NAME_EN"
$KEY_PACKAGE_ID = "PACKAGE_ID"

$KEY_COMMAND_COUNT = "COMMAND_COUNT"

$KEY_PYTHON_SUCCESS = "PYTHON_SUCCESS"
$KEY_ERROR = "ERROR"

# Command fields
$FIELD_CMD_TYPE = "TYPE"
$FIELD_CMD_DESC = "DESC"
$FIELD_CMD_WORKDIR = "WORKDIR"

# ============================================
# UTILITY FUNCTIONS
# ============================================

function Write-ColorText {
    param(
        [string]$Text,
        [string]$Color = "White"
    )
    Write-Host $Text -ForegroundColor $Color
}

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "--------------------------------------------" -ForegroundColor Yellow
    Write-Host $Title -ForegroundColor Yellow
    Write-Host "--------------------------------------------" -ForegroundColor Yellow
}

# ============================================
# VARIABLE SYSTEM FUNCTIONS (NO JSON, NO PYTHON)
# ============================================

function Find-AppPrefix {
    # Find the app prefix from variable files
    if (-not (Test-Path $VarDir)) {
        return $null
    }

    $varFiles = Get-ChildItem -Path $VarDir -Filter "*_*" -File | Where-Object { $_.Name -notmatch "COMMAND" }
    if ($varFiles.Count -eq 0) {
        return $null
    }

    # Extract prefix from first file (e.g., "CMG_PORTAL_APP_NAME" -> "CMG_PORTAL")
    $fileName = $varFiles[0].Name
    $parts = $fileName -split "_"

    # Find where actual key starts by checking against known keys
    $prefix = $parts[0]
    for ($i = 1; $i -lt $parts.Length - 1; $i++) {
        $testKey = ($parts[$i..($parts.Length - 1)] -join "_")
        if ($testKey -in @($KEY_PROJECT_ROOT, $KEY_APP_NAME, $KEY_PACKAGE_ID)) {
            break
        }
        $prefix = ($parts[0..$i] -join "_")
    }

    return $prefix
}

function Get-VarValue {
    # Read a variable value from file
    param(
        [string]$Key,
        [string]$Prefix
    )

    $varFile = Join-Path $VarDir "${Prefix}_${Key}"

    if (-not (Test-Path $varFile)) {
        return $null
    }

    try {
        $content = Get-Content $varFile -Raw -Encoding UTF8
        return $content.Trim()
    } catch {
        Write-ColorText "[ERROR] Failed to read variable $Key`: $_" "Red"
        return $null
    }
}

function Get-VarAsList {
    # Read a variable as a list (newline-separated values)
    param(
        [string]$Key,
        [string]$Prefix
    )

    $content = Get-VarValue -Key $Key -Prefix $Prefix

    if (-not $content) {
        return @()
    }

    # Split by newlines and filter empty lines
    $lines = $content -split "`n"
    return $lines | Where-Object { $_.Trim() -ne "" } | ForEach-Object { $_.Trim() }
}

function Get-CommandCount {
    # Get the number of commands
    param([string]$Prefix)

    $countStr = Get-VarValue -Key $KEY_COMMAND_COUNT -Prefix $Prefix

    if (-not $countStr) {
        return 0
    }

    try {
        return [int]$countStr
    } catch {
        return 0
    }
}

function Get-Command {
    # Get a command by index
    param(
        [int]$Index,
        [string]$Prefix
    )

    $typeFile = Join-Path $CmdDir "${Prefix}_COMMAND_${Index}_${FIELD_CMD_TYPE}"
    $descFile = Join-Path $CmdDir "${Prefix}_COMMAND_${Index}_${FIELD_CMD_DESC}"
    $workdirFile = Join-Path $CmdDir "${Prefix}_COMMAND_${Index}_${FIELD_CMD_WORKDIR}"

    if (-not (Test-Path $typeFile)) {
        return $null
    }

    $command = @{
        Type = (Get-Content $typeFile -Raw -Encoding UTF8).Trim()
        Desc = if (Test-Path $descFile) { (Get-Content $descFile -Raw -Encoding UTF8).Trim() } else { "" }
        Workdir = if (Test-Path $workdirFile) { (Get-Content $workdirFile -Raw -Encoding UTF8).Trim() } else { "" }
    }

    return $command
}

# ============================================
# COMMAND EXECUTION FUNCTIONS
# ============================================

function Print-Command {
    # Print command before execution
    param([string]$CommandText)

    Write-ColorText "[CMD] $CommandText" "DarkGray"
}

# ============================================
# HELPER FUNCTIONS (Code Reuse)
# ============================================

function Invoke-ProjectCommand {
    # Execute a command in project directory with automatic error handling
    param(
        [string]$Command,
        [string]$Description,
        [string]$Prefix,
        [string]$WorkDir = $null,
        [switch]$NoErrorCheck
    )

    if (-not $WorkDir) {
        $WorkDir = Get-VarValue -Key $KEY_PROJECT_ROOT -Prefix $Prefix
    }

    Push-Location $WorkDir
    try {
        Print-Command $Command
        Invoke-Expression "& $Command"

        if (-not $NoErrorCheck) {
            if ($LASTEXITCODE -ne 0) {
                Write-ColorText "[ERROR] $Description failed" "Red"
                return $false
            } else {
                Write-ColorText "[Success] $Description completed" "Green"
                return $true
            }
        }

        return $true
    } finally {
        Pop-Location
    }
}

function Test-RequiredPath {
    # Verify that a required path exists
    param(
        [string]$Path,
        [string]$Description,
        [string]$Type = "File"
    )

    $exists = if ($Type -eq "File") {
        Test-Path $Path -PathType Leaf
    } else {
        Test-Path $Path -PathType Container
    }

    if (-not $exists) {
        Write-ColorText "[ERROR] $Description not found at: $Path" "Red"
        return $false
    }

    return $true
}

function Confirm-UserAction {
    # Ask user for confirmation with Y/N prompt
    param(
        [string]$PromptMessage,
        [string]$WarningMessage = "",
        [string]$DefaultAnswer = "N"
    )

    if ($WarningMessage) {
        Write-Host ""
        Write-ColorText $WarningMessage "Yellow"
        Write-Host ""
    }

    $promptSuffix = if ($DefaultAnswer -eq "Y") { "[Y/n]" } else { "[y/N]" }
    $confirmation = Read-Host "$PromptMessage $promptSuffix"

    if ($DefaultAnswer -eq "Y") {
        return -not ($confirmation -match '^[Nn]$')
    } else {
        return ($confirmation -match '^[Yy]$')
    }
}

function Backup-PathWithTimestamp {
    # Create timestamped backup of file or directory
    param(
        [string]$SourcePath,
        [string]$Type = "File",
        [switch]$UseRename
    )

    if (-not (Test-Path $SourcePath)) {
        Write-ColorText "[Backup] Source not found, skipping: $SourcePath" "Yellow"
        return $null
    }

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupPath = "${SourcePath}_backup_$timestamp"

    if (Test-Path $backupPath) {
        Write-ColorText "[Backup] Backup already exists: $backupPath" "Yellow"
        return $backupPath
    }

    try {
        if ($UseRename) {
            Print-Command "Rename-Item ""$SourcePath"" ""$(Split-Path -Leaf $backupPath)"""
            Rename-Item -Path $SourcePath -NewName $backupPath -Force
        } else {
            Print-Command "Copy-Item ""$SourcePath"" ""$backupPath"""
            Copy-Item -Path $SourcePath -Destination $backupPath -Recurse -Force
        }

        Write-ColorText "[Backup] Created: $(Split-Path -Leaf $backupPath)" "Green"
        return $backupPath
    } catch {
        Write-ColorText "[ERROR] Backup failed: $_" "Red"
        return $null
    }
}

# ============================================
# COMMAND EXECUTOR
# ============================================

function Execute-Command {
    param(
        [string]$CommandType,
        [string]$Prefix
    )

    # Parse command type
    $parts = $CommandType -split '\|'
    $cmd = $parts[0]

    switch ($cmd) {
        "pnpm_install" {
            Run-PnpmInstall -Prefix $Prefix
        }
        "backup_package_json" {
            Backup-PackageJson -Prefix $Prefix
        }
        "init_capacitor" {
            $appName = $parts[1]
            $packageId = $parts[2]
            Initialize-Capacitor -AppName $appName -PackageId $packageId -Prefix $Prefix
        }
        "add_android_platform" {
            Add-AndroidPlatform -Prefix $Prefix
        }
        "start_dev_server" {
            Start-DevServer -Prefix $Prefix
        }
        "build_web" {
            Build-Web -Prefix $Prefix
        }
        "sync_capacitor_android" {
            Sync-CapacitorAndroid -Prefix $Prefix
        }
        "build_android_apk" {
            Build-AndroidApk -Prefix $Prefix
        }
        "capacitor_assets_generate" {
            Generate-CapacitorAssets -Prefix $Prefix
        }
        default {
            Write-ColorText "[WARNING] Unknown command: $cmd" "Yellow"
        }
    }
}

function Run-PnpmInstall {
    param([string]$Prefix)

    Write-Section "Installing Packages"

    $projectRoot = Get-VarValue -Key $KEY_PROJECT_ROOT -Prefix $Prefix
    $packagesAdded = Get-VarValue -Key "PACKAGES_ADDED" -Prefix $Prefix
    $packagesExisting = Get-VarValue -Key "PACKAGES_EXISTING" -Prefix $Prefix

    Write-ColorText "[Install] Installing $packagesAdded new Capacitor packages..." "Cyan"
    if ($packagesExisting -gt 0) {
        Write-ColorText "[Install] ($packagesExisting packages already in package.json)" "DarkGray"
    }

    Push-Location $projectRoot
    try {
        Print-Command "pnpm install"
        & pnpm install

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[ERROR] pnpm install failed" "Red"
        } else {
            Write-ColorText "[Success] All packages installed successfully" "Green"
        }
    } finally {
        Pop-Location
    }
}

function Backup-PackageJson {
    param([string]$Prefix)

    $packageJsonPath = Get-VarValue -Key $KEY_PACKAGE_JSON_PATH -Prefix $Prefix
    $backupPath = Get-VarValue -Key $KEY_PACKAGE_JSON_BACKUP_PATH -Prefix $Prefix

    if (Test-Path $backupPath) {
        Write-ColorText "[Backup] package.json.backup already exists, skipping" "Green"
    } else {
        if (Test-Path $packageJsonPath) {
            try {
                Print-Command "Copy-Item ""$packageJsonPath"" ""$backupPath"""
                Copy-Item $packageJsonPath $backupPath -Force
                Write-ColorText "[Backup] Created package.json.backup" "Green"
            } catch {
                Write-ColorText "[ERROR] Failed to backup package.json: $_" "Red"
            }
        }
    }
}

function Initialize-Capacitor {
    param(
        [string]$AppName,
        [string]$PackageId,
        [string]$Prefix
    )

    Write-Section "Initializing Capacitor"

    $projectRoot = Get-VarValue -Key $KEY_PROJECT_ROOT -Prefix $Prefix
    $capacitorConfigTs = Join-Path $projectRoot "capacitor.config.ts"
    $capacitorConfigJs = Join-Path $projectRoot "capacitor.config.js"

    $displayNameEn = Get-VarValue -Key $KEY_DISPLAY_NAME_EN -Prefix $Prefix
    $displayNameCn = Get-VarValue -Key "DISPLAY_NAME_CN" -Prefix $Prefix
    $description = Get-VarValue -Key "DESCRIPTION" -Prefix $Prefix

    Write-ColorText "[Config] App Name (Technical): $AppName" "Cyan"
    if ($displayNameEn) {
        Write-ColorText "[Config] Display Name (EN): $displayNameEn" "Cyan"
    }
    if ($displayNameCn) {
        Write-ColorText "[Config] Display Name (CN): $displayNameCn" "Cyan"
    }
    Write-ColorText "[Config] Package ID: $PackageId" "Cyan"
    if ($description) {
        Write-ColorText "[Config] Description: $description" "DarkGray"
    }

    Push-Location $projectRoot
    try {
        Print-Command "npx cap init ""$AppName"" ""$PackageId"""

        # Capture output to check for errors
        $output = & npx cap init "$AppName" "$PackageId" 2>&1 | Out-String

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[ERROR] Capacitor initialization failed" "Red"
            Write-Host $output

            # Check if error is about non-JSON config file
            if ($output -match "non-JSON configuration file" -or $output -match "capacitor.config.ts") {
                Write-Host ""
                Write-ColorText "[Warning] Found existing Capacitor configuration file(s)" "Yellow"

                $existingConfigs = @()
                if (Test-Path $capacitorConfigTs) {
                    $existingConfigs += "capacitor.config.ts"
                }
                if (Test-Path $capacitorConfigJs) {
                    $existingConfigs += "capacitor.config.js"
                }

                if ($existingConfigs.Count -gt 0) {
                    Write-ColorText "[Info] Found: $($existingConfigs -join ', ')" "Cyan"
                    Write-Host ""
                    Write-Host "Capacitor requires a JSON configuration file for initialization."
                    Write-Host "The existing TypeScript/JavaScript config will be removed."
                    Write-Host ""

                    # Prompt user
                    $confirmation = Read-Host "Delete config file(s) and reinitialize? [Y/n]"

                    if ($confirmation -match '^[Yy]' -or [string]::IsNullOrWhiteSpace($confirmation)) {
                        Write-Host ""
                        Write-ColorText "[Action] Removing existing configuration files..." "Yellow"

                        # Remove existing config files
                        foreach ($configFile in $existingConfigs) {
                            $fullPath = Join-Path $projectRoot $configFile
                            try {
                                # Backup first
                                $backupPath = "$fullPath.backup"
                                if (Test-Path $fullPath) {
                                    Print-Command "Copy-Item ""$fullPath"" ""$backupPath"""
                                    Copy-Item $fullPath $backupPath -Force
                                    Write-ColorText "[Backup] Created backup: $configFile.backup" "Green"

                                    Print-Command "Remove-Item ""$fullPath"""
                                    Remove-Item $fullPath -Force
                                    Write-ColorText "[Removed] Deleted: $configFile" "Green"
                                }
                            } catch {
                                Write-ColorText "[ERROR] Failed to remove $configFile`: $_" "Red"
                            }
                        }

                        Write-Host ""
                        Write-ColorText "[Capacitor] Retrying initialization..." "Yellow"

                        # Retry initialization
                        Print-Command "npx cap init ""$AppName"" ""$PackageId"""
                        & npx cap init "$AppName" "$PackageId"

                        if ($LASTEXITCODE -eq 0) {
                            Write-ColorText "[Success] Capacitor initialized successfully" "Green"
                        } else {
                            Write-ColorText "[ERROR] Capacitor initialization failed again" "Red"
                        }
                    } else {
                        Write-Host ""
                        Write-ColorText "[Skipped] Capacitor initialization cancelled by user" "Yellow"
                        Write-ColorText "[Info] You can manually delete the config files and run initialization again" "Cyan"
                    }
                }
            }
        } else {
            Write-ColorText "[Success] Capacitor initialized successfully" "Green"
        }
    } finally {
        Pop-Location
    }
}

function Add-AndroidPlatform {
    param([string]$Prefix)

    Write-Section "Adding Android Platform"

    $projectRoot = Get-VarValue -Key $KEY_PROJECT_ROOT -Prefix $Prefix
    $androidPath = Join-Path $projectRoot "android"

    Push-Location $projectRoot
    try {
        # Check if Android platform already exists
        if (Test-Path $androidPath) {
            Write-Host ""
            Write-ColorText "[Warning] Android platform already exists at: .\android" "Yellow"
            Write-Host ""
            Write-Host "To re-add this platform, the existing android directory must be removed."
            Write-Host "WARNING: Your native Android project will be completely removed."
            Write-Host ""

            # Prompt user
            $confirmation = Read-Host "Remove existing android directory and re-add platform? [y/N]"

            if ($confirmation -match '^[Yy]$') {
                Write-Host ""
                Write-ColorText "[Action] Removing existing Android platform..." "Yellow"

                # Backup directory name
                $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
                $backupPath = "${androidPath}_backup_$timestamp"

                try {
                    # Rename instead of delete for safety
                    Print-Command "Rename-Item ""$androidPath"" ""$backupPath"""
                    Rename-Item -Path $androidPath -NewName "$backupPath" -Force
                    Write-ColorText "[Backup] Moved to: .\android_backup_$timestamp" "Green"
                } catch {
                    Write-ColorText "[ERROR] Failed to remove android directory: $_" "Red"
                    return
                }

                Write-Host ""
                Write-ColorText "[Capacitor] Adding Android platform..." "Yellow"
                Print-Command "npx cap add android"
                & npx cap add android

                if ($LASTEXITCODE -ne 0) {
                    Write-ColorText "[ERROR] Failed to add Android platform" "Red"
                    return
                } else {
                    Write-ColorText "[Success] Android platform added successfully" "Green"
                }
            } else {
                Write-Host ""
                Write-ColorText "[Info] Android platform addition cancelled by user" "Cyan"
                return
            }
        } else {
            # Android platform doesn't exist, add it normally
            Print-Command "npx cap add android"
            & npx cap add android

            if ($LASTEXITCODE -ne 0) {
                Write-ColorText "[ERROR] Failed to add Android platform" "Red"
                return
            } else {
                Write-ColorText "[Success] Android platform added successfully" "Green"
            }
        }

        # After successful addition, scan and preview resources
        if (Test-Path $androidPath) {
            Write-Host ""
            Write-ColorText "[Preview] Scanning Android resources..." "Cyan"

            # Get build scripts directory
            $buildScriptsDir = Split-Path -Parent $MyInvocation.ScriptName
            $scannerScript = Join-Path $buildScriptsDir "resource_scanner.py"
            $previewScript = Join-Path $buildScriptsDir "web_preview_server.py"

            if (Test-Path $scannerScript) {
                # Run Python script to scan and preview
                $pythonCmd = @"
import sys
sys.path.insert(0, r'$buildScriptsDir')
from resource_scanner import ResourceScanner
from web_preview_server import show_preview

scanner = ResourceScanner(r'$androidPath')
resource_data = scanner.get_full_report()

print('\n[Preview] Launching resource preview server...')
show_preview(resource_data, port=8899)
"@

                Print-Command "python -c ""<scan and preview resources>"""
                $pythonCmd | python -

                Write-Host ""
                Write-ColorText "[Preview] Preview closed" "Green"
            }
        }

    } finally {
        Pop-Location
    }
}

function Generate-CapacitorAssets {
    param([string]$Prefix)

    Write-Section "Generating Capacitor Assets"

    $projectRoot = Get-VarValue -Key $KEY_PROJECT_ROOT -Prefix $Prefix
    $runAssets = Get-VarValue -Key "RUN_CAPACITOR_ASSETS" -Prefix $Prefix

    if ($runAssets -ne "true") {
        Write-ColorText "[Skip] Capacitor assets generation skipped (no valid icon provided)" "Yellow"
        return
    }

    Push-Location $projectRoot
    try {
        Write-ColorText "[Assets] Generating Android resources using Capacitor official tool..." "Cyan"
        Print-Command "npx @capacitor/assets generate --android"
        & npx @capacitor/assets generate --android

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[ERROR] Capacitor assets generation failed" "Red"
            Write-ColorText "[INFO] Make sure @capacitor/assets is installed: pnpm add -D @capacitor/assets" "Yellow"
        } else {
            Write-ColorText "[Success] Capacitor assets generated successfully" "Green"
            Write-ColorText "[Info] All Android icon densities have been auto-generated" "DarkGray"
        }
    } finally {
        Pop-Location
    }
}

function Start-DevServer {
    param([string]$Prefix)

    Write-Header "Starting Development Server"

    $projectRoot = Get-VarValue -Key $KEY_PROJECT_ROOT -Prefix $Prefix

    Push-Location $projectRoot
    try {
        Print-Command "pnpm run dev"
        & pnpm run dev
    } finally {
        Pop-Location
    }
}

function Build-Web {
    param([string]$Prefix)

    Write-Section "Building Web Assets"

    Invoke-ProjectCommand `
        -Command "pnpm run build" `
        -Description "Web build" `
        -Prefix $Prefix
}

function Sync-CapacitorAndroid {
    param([string]$Prefix)

    Write-Section "Syncing Capacitor"

    Invoke-ProjectCommand `
        -Command "npx cap sync android" `
        -Description "Capacitor sync" `
        -Prefix $Prefix
}

function Build-AndroidApk {
    param([string]$Prefix)

    Write-Section "Building Android APK"

    $androidPath = Get-VarValue -Key $KEY_ANDROID_PATH -Prefix $Prefix
    $gradlewPath = Join-Path $androidPath "gradlew.bat"

    if (-not (Test-RequiredPath $gradlewPath "Gradle wrapper" "File")) {
        return
    }

    Push-Location $androidPath
    try {
        # First attempt
        Print-Command ".\gradlew.bat assembleDebug"
        & .\gradlew.bat assembleDebug

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[ERROR] Android build failed" "Red"
            Write-ColorText "[INFO] Attempting to clean Gradle cache and retry..." "Yellow"

            # Clean Gradle cache
            Write-ColorText "`n[Gradle] Cleaning build directory..." "Cyan"
            Print-Command ".\gradlew.bat clean"
            & .\gradlew.bat clean

            # Clean Gradle user cache (common location for corrupted files)
            $gradleCacheDir = "$env:USERPROFILE\.gradle\caches"
            if (Test-Path $gradleCacheDir) {
                Write-ColorText "[Gradle] Clearing Gradle caches at: $gradleCacheDir" "Cyan"
                try {
                    Remove-Item -Path "$gradleCacheDir\*" -Recurse -Force -ErrorAction SilentlyContinue
                    Write-ColorText "[Gradle] Cache cleared successfully" "Green"
                } catch {
                    Write-ColorText "[Gradle] Warning: Could not fully clear cache (some files may be in use)" "Yellow"
                }
            }

            # Retry build
            Write-ColorText "`n[Gradle] Retrying build..." "Cyan"
            Print-Command ".\gradlew.bat assembleDebug"
            & .\gradlew.bat assembleDebug

            if ($LASTEXITCODE -ne 0) {
                Write-ColorText "[ERROR] Android build failed after cache cleanup" "Red"
                Write-ColorText "[SOLUTION] Try manually running:" "Yellow"
                Write-ColorText "  cd android" "DarkGray"
                Write-ColorText "  .\gradlew.bat clean build --refresh-dependencies" "DarkGray"
            } else {
                Write-ColorText "[Success] Android APK built successfully after retry" "Green"
            }
        } else {
            Write-ColorText "[Success] Android build completed" "Green"
        }

        # Show APK location if exists
        $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
        if (Test-Path $apkPath) {
            $fullPath = (Get-Item $apkPath).FullName
            Write-ColorText "`n[APK] $fullPath" "Green"
        } else {
            Write-ColorText "[Output] APK location: android\app\build\outputs\apk\debug\" "Cyan"
        }
    } finally {
        Pop-Location
    }
}

# ============================================
# MAIN EXECUTION
# ============================================

Write-Header "Windows Command Executor (Refactored)"

# Find app prefix
$AppPrefix = Find-AppPrefix

if (-not $AppPrefix) {
    Write-ColorText "[ERROR] No variable files found in: $VarDir" "Red"
    Write-ColorText "[ERROR] Did Python controller run successfully?" "Red"
    exit 1
}

Write-ColorText "[Shell] Found app prefix: $AppPrefix" "Green"

# Check for Python success
$pythonSuccess = Get-VarValue -Key $KEY_PYTHON_SUCCESS -Prefix $AppPrefix

if ($pythonSuccess -ne "true") {
    Write-ColorText "[ERROR] Python controller did not complete successfully" "Red"
    exit 1
}

# Check for errors
$errorMsg = Get-VarValue -Key $KEY_ERROR -Prefix $AppPrefix

if ($errorMsg) {
    Write-ColorText "[ERROR] Python reported error: $errorMsg" "Red"
    exit 1
}

# Get command count
$commandCount = Get-CommandCount -Prefix $AppPrefix

if ($commandCount -eq 0) {
    Write-ColorText "[WARNING] No commands to execute" "Yellow"
    exit 0
}

Write-ColorText "[Shell] Executing $commandCount commands..." "Cyan"
Write-Host ""

# Execute each command
for ($i = 0; $i -lt $commandCount; $i++) {
    $cmd = Get-Command -Index $i -Prefix $AppPrefix

    if ($cmd) {
        if ($cmd.Desc) {
            Write-ColorText "[Execute] $($cmd.Desc)" "Cyan"
        }

        Execute-Command -CommandType $cmd.Type -Prefix $AppPrefix
    }
}

Write-Host ""
Write-Header "Execution Complete"
