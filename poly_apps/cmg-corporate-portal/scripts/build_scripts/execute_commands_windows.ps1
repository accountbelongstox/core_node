# ============================================
# Windows Variable Reader and Command Executor
# Reads file variables and executes commands
# ============================================

param(
    [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"

# ============================================
# VARIABLE DECLARATIONS
# ============================================

$VarDir = Join-Path $ProjectRoot ".build_vars"
$AppPrefix = ""  # Will be determined from var files

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
# VARIABLE SYSTEM FUNCTIONS
# ============================================

function Find-AppPrefix {
    """Find the app prefix from variable files"""
    if (-not (Test-Path $VarDir)) {
        return $null
    }

    $varFiles = Get-ChildItem -Path $VarDir -Filter "*_vars.json" -File
    if ($varFiles.Count -eq 0) {
        return $null
    }

    $fileName = $varFiles[0].BaseName
    return $fileName.Replace("_vars", "")
}

function Load-Variables {
    """Load all variables from JSON file"""
    param([string]$AppPrefix)

    $varFile = Join-Path $VarDir "${AppPrefix}_vars.json"

    if (-not (Test-Path $varFile)) {
        Write-ColorText "[ERROR] Variable file not found: $varFile" "Red"
        return @{}
    }

    try {
        $content = Get-Content $varFile -Raw -Encoding UTF8
        $allVars = $content | ConvertFrom-Json

        # Convert to hashtable
        $vars = @{}
        foreach ($prop in $allVars.PSObject.Properties) {
            # Remove prefix from key name
            $key = $prop.Name
            if ($key.StartsWith("${AppPrefix}_")) {
                $cleanKey = $key.Substring($AppPrefix.Length + 1)
                $vars[$cleanKey] = $prop.Value
            }
        }

        return $vars
    } catch {
        Write-ColorText "[ERROR] Failed to load variables: $_" "Red"
        return @{}
    }
}

function Load-Commands {
    """Load command queue from JSON file"""
    param([string]$AppPrefix)

    $cmdFile = Join-Path $VarDir "${AppPrefix}_commands.json"

    if (-not (Test-Path $cmdFile)) {
        Write-ColorText "[ERROR] Command file not found: $cmdFile" "Red"
        return @()
    }

    try {
        $content = Get-Content $cmdFile -Raw -Encoding UTF8
        return $content | ConvertFrom-Json
    } catch {
        Write-ColorText "[ERROR] Failed to load commands: $_" "Red"
        return @()
    }
}

# ============================================
# COMMAND EXECUTION FUNCTIONS
# ============================================

function Execute-Command {
    param(
        [string]$CommandType,
        [hashtable]$Vars
    )

    # Parse command type
    $parts = $CommandType -split '\|'
    $cmd = $parts[0]

    switch ($cmd) {
        "backup_package_json" {
            Backup-PackageJson -Vars $Vars
        }
        "install_core_packages" {
            Install-CorePackages -Vars $Vars
        }
        "install_platform_packages" {
            Install-PlatformPackages -Vars $Vars
        }
        "install_plugin_packages" {
            Install-PluginPackages -Vars $Vars
        }
        "init_capacitor" {
            $appName = $parts[1]
            $packageId = $parts[2]
            Initialize-Capacitor -AppName $appName -PackageId $packageId -Vars $Vars
        }
        "add_android_platform" {
            Add-AndroidPlatform -Vars $Vars
        }
        "start_dev_server" {
            Start-DevServer -Vars $Vars
        }
        "build_web" {
            Build-Web -Vars $Vars
        }
        "sync_capacitor_android" {
            Sync-CapacitorAndroid -Vars $Vars
        }
        "build_android_apk" {
            Build-AndroidApk -Vars $Vars
        }
        default {
            Write-ColorText "[WARNING] Unknown command: $cmd" "Yellow"
        }
    }
}

function Backup-PackageJson {
    param([hashtable]$Vars)

    $packageJsonPath = $Vars["PACKAGE_JSON_PATH"]
    $backupPath = $Vars["PACKAGE_JSON_BACKUP_PATH"]

    if (Test-Path $backupPath) {
        Write-ColorText "[Backup] package.json.backup already exists, skipping" "Green"
    } else {
        if (Test-Path $packageJsonPath) {
            try {
                Copy-Item $packageJsonPath $backupPath -Force
                Write-ColorText "[Backup] Created package.json.backup" "Green"
            } catch {
                Write-ColorText "[ERROR] Failed to backup package.json: $_" "Red"
            }
        }
    }
}

function Install-CorePackages {
    param([hashtable]$Vars)

    Write-Section "Installing Capacitor Core Packages"

    $projectRoot = $Vars["PROJECT_ROOT"]
    $packagesJson = $Vars["CAPACITOR_CORE_PACKAGES"]
    $packages = $packagesJson | ConvertFrom-Json

    Push-Location $projectRoot
    try {
        $packageList = $packages -join " "
        Write-ColorText "[Install] Installing: $packageList" "Cyan"
        & pnpm add $packages

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[WARNING] Some packages failed to install" "Yellow"
        } else {
            Write-ColorText "[Success] Core packages installed" "Green"
        }
    } finally {
        Pop-Location
    }
}

function Install-PlatformPackages {
    param([hashtable]$Vars)

    Write-Section "Installing Capacitor Platform Packages"

    $projectRoot = $Vars["PROJECT_ROOT"]
    $packagesJson = $Vars["CAPACITOR_PLATFORM_PACKAGES"]
    $packages = $packagesJson | ConvertFrom-Json

    Push-Location $projectRoot
    try {
        $packageList = $packages -join " "
        Write-ColorText "[Install] Installing: $packageList" "Cyan"
        & pnpm add $packages

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[WARNING] Some packages failed to install" "Yellow"
        } else {
            Write-ColorText "[Success] Platform packages installed" "Green"
        }
    } finally {
        Pop-Location
    }
}

function Install-PluginPackages {
    param([hashtable]$Vars)

    Write-Section "Installing Capacitor Plugin Packages"

    $projectRoot = $Vars["PROJECT_ROOT"]
    $packagesJson = $Vars["CAPACITOR_PLUGIN_PACKAGES"]
    $packages = $packagesJson | ConvertFrom-Json

    Push-Location $projectRoot
    try {
        Write-ColorText "[Install] Installing $($packages.Count) plugins..." "Cyan"
        Write-ColorText "[Install] This may take a moment..." "DarkGray"
        & pnpm add $packages

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[WARNING] Some packages failed to install" "Yellow"
        } else {
            Write-ColorText "[Success] All plugin packages installed" "Green"
        }
    } finally {
        Pop-Location
    }
}

function Initialize-Capacitor {
    param(
        [string]$AppName,
        [string]$PackageId,
        [hashtable]$Vars
    )

    Write-Section "Initializing Capacitor"

    $projectRoot = $Vars["PROJECT_ROOT"]
    $capacitorConfigTs = Join-Path $projectRoot "capacitor.config.ts"
    $capacitorConfigJs = Join-Path $projectRoot "capacitor.config.js"

    Write-ColorText "[Config] App Name: $AppName" "Cyan"
    Write-ColorText "[Config] Package ID: $PackageId" "Cyan"

    Push-Location $projectRoot
    try {
        Write-ColorText "[Capacitor] Running: npx cap init ""$AppName"" ""$PackageId""" "DarkGray"

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
                                    Copy-Item $fullPath $backupPath -Force
                                    Write-ColorText "[Backup] Created backup: $configFile.backup" "Green"

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
    param([hashtable]$Vars)

    Write-Section "Adding Android Platform"

    $projectRoot = $Vars["PROJECT_ROOT"]

    Push-Location $projectRoot
    try {
        & npx cap add android

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[WARNING] Failed to add Android platform" "Yellow"
        } else {
            Write-ColorText "[Success] Android platform added" "Green"
        }
    } finally {
        Pop-Location
    }
}

function Start-DevServer {
    param([hashtable]$Vars)

    Write-Header "Starting Development Server"

    $projectRoot = $Vars["PROJECT_ROOT"]

    Push-Location $projectRoot
    try {
        & pnpm run dev
    } finally {
        Pop-Location
    }
}

function Build-Web {
    param([hashtable]$Vars)

    Write-Section "Building Web Assets"

    $projectRoot = $Vars["PROJECT_ROOT"]

    Push-Location $projectRoot
    try {
        & pnpm run build

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[ERROR] Web build failed" "Red"
        } else {
            Write-ColorText "[Success] Web build completed" "Green"
        }
    } finally {
        Pop-Location
    }
}

function Sync-CapacitorAndroid {
    param([hashtable]$Vars)

    Write-Section "Syncing Capacitor"

    $projectRoot = $Vars["PROJECT_ROOT"]

    Push-Location $projectRoot
    try {
        & npx cap sync android

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[ERROR] Capacitor sync failed" "Red"
        } else {
            Write-ColorText "[Success] Capacitor synced" "Green"
        }
    } finally {
        Pop-Location
    }
}

function Build-AndroidApk {
    param([hashtable]$Vars)

    Write-Section "Building Android APK"

    $androidPath = $Vars["ANDROID_PATH"]
    $gradlewPath = Join-Path $androidPath "gradlew.bat"

    if (-not (Test-Path $gradlewPath)) {
        Write-ColorText "[ERROR] Gradle wrapper not found at: $gradlewPath" "Red"
        return
    }

    Push-Location $androidPath
    try {
        & .\gradlew.bat assembleDebug

        if ($LASTEXITCODE -ne 0) {
            Write-ColorText "[ERROR] Android build failed" "Red"
        } else {
            Write-ColorText "[Success] Android build completed" "Green"
            Write-ColorText "[Output] APK location: android\app\build\outputs\apk\debug\" "Cyan"
        }
    } finally {
        Pop-Location
    }
}

# ============================================
# MAIN EXECUTION
# ============================================

Write-Header "Windows Command Executor"

# Find app prefix
$AppPrefix = Find-AppPrefix

if (-not $AppPrefix) {
    Write-ColorText "[ERROR] No variable files found in: $VarDir" "Red"
    Write-ColorText "[ERROR] Did Python controller run successfully?" "Red"
    exit 1
}

Write-ColorText "[Shell] Found app prefix: $AppPrefix" "Green"

# Load variables
$vars = Load-Variables -AppPrefix $AppPrefix

if ($vars.Count -eq 0) {
    Write-ColorText "[ERROR] No variables loaded" "Red"
    exit 1
}

Write-ColorText "[Shell] Loaded $($vars.Count) variables" "Green"

# Check for Python success
if ($vars["PYTHON_SUCCESS"] -ne "true") {
    Write-ColorText "[ERROR] Python controller did not complete successfully" "Red"
    exit 1
}

# Check for errors
if ($vars.ContainsKey("ERROR")) {
    Write-ColorText "[ERROR] Python reported error: $($vars['ERROR'])" "Red"
    exit 1
}

# Load and execute commands
$commands = Load-Commands -AppPrefix $AppPrefix

if ($commands.Count -eq 0) {
    Write-ColorText "[WARNING] No commands to execute" "Yellow"
    exit 0
}

Write-ColorText "[Shell] Executing $($commands.Count) commands..." "Cyan"
Write-Host ""

foreach ($cmd in $commands) {
    if ($cmd.description) {
        Write-ColorText "[Execute] $($cmd.description)" "Cyan"
    }

    Execute-Command -CommandType $cmd.command -Vars $vars
}

Write-Host ""
Write-Header "Execution Complete"
