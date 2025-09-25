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

# Registry Parser - Converts simplified text format to full registry with auto-detection
# Handles automatic path detection, script scanning, and index generation

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$UNIFIED_MANAGER_DIR = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $UNIFIED_MANAGER_DIR)
$REGISTRY_INI_FILE = Join-Path $UNIFIED_MANAGER_DIR "app_registry.ini"
$APPS_DIR = Join-Path $PROJECT_ROOT "apps"
$POLY_APPS_DIR = Join-Path $PROJECT_ROOT "poly_apps"

# Function to parse INI registry format
function Get-IniAppRegistry {
    if (-not (Test-Path $REGISTRY_INI_FILE)) {
        Write-Error "Registry file not found: $REGISTRY_INI_FILE"
        return $null
    }

    $registry = @{
        apps = @{}
        presets = @{}
    }
    
    $appIndex = 1
    $presetIndex = 1
    $currentSection = ""
    $currentApp = @{}

    try {
        $lines = Get-Content $REGISTRY_INI_FILE -Encoding UTF8
        
        foreach ($line in $lines) {
            # Skip comments and empty lines
            if ($line -match '^\s*#' -or $line -match '^\s*$') {
                continue
            }
            
            # Check for section header [SectionName]
            if ($line -match '^\[(.+)\]$') {
                $sectionName = $matches[1].Trim()
                
                # Save previous app if exists
                if ($currentSection -and $currentApp.Count -gt 0 -and -not $currentSection.StartsWith("PRESET:")) {
                    $appConfig = Get-AutoDetectedAppConfig -AppName $currentSection -AppType $currentApp.type -AppDescription $currentApp.description -Index $appIndex
                    if ($appConfig) {
                        $registry.apps[$currentSection] = $appConfig
                        $appIndex++
                    }
                }
                
                # Handle preset sections
                if ($sectionName.StartsWith("PRESET:")) {
                    $currentSection = $sectionName
                    $currentApp = @{}
                } else {
                    $currentSection = $sectionName
                    $currentApp = @{}
                }
                continue
            }
            
            # Parse key=value pairs
            if ($line -match '^([^=]+)=(.*)$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                
                if ($currentSection.StartsWith("PRESET:")) {
                    # Handle preset configuration
                    $presetName = $currentSection -replace '^PRESET:', ''
                    if (-not $registry.presets[$presetName]) {
                        $registry.presets[$presetName] = @{
                            id = "P$presetIndex"
                            description = ""
                            apps = @()
                            app_names = @()
                        }
                        $presetIndex++
                    }
                    
                    if ($key -eq "description") {
                        $registry.presets[$presetName].description = $value
                    } elseif ($key -eq "apps") {
                        $appList = $value -split ',' | ForEach-Object { $_.Trim() }
                        $registry.presets[$presetName].app_names = $appList
                    }
                } else {
                    # Handle app configuration
                    $currentApp[$key] = $value
                }
            }
        }
        
        # Save the last app if exists
        if ($currentSection -and $currentApp.Count -gt 0 -and -not $currentSection.StartsWith("PRESET:")) {
            $appConfig = Get-AutoDetectedAppConfig -AppName $currentSection -AppType $currentApp.type -AppDescription $currentApp.description -Index $appIndex
            if ($appConfig) {
                $registry.apps[$currentSection] = $appConfig
            }
        }
        
        # Sort apps by name and reassign sequential IDs for consistency
        $sortedAppNames = $registry.apps.Keys | Sort-Object
        $newAppIndex = 1
        foreach ($appName in $sortedAppNames) {
            $registry.apps[$appName].id = $newAppIndex
            $newAppIndex++
        }

        # Sort presets by name and reassign sequential IDs
        $sortedPresetNames = $registry.presets.Keys | Sort-Object
        $newPresetIndex = 1
        foreach ($presetName in $sortedPresetNames) {
            $registry.presets[$presetName].id = "P$newPresetIndex"
            $newPresetIndex++
        }

        # Convert app names to IDs in presets
        foreach ($presetName in $registry.presets.Keys) {
            $appIds = @()
            foreach ($appName in $registry.presets[$presetName].app_names) {
                if ($registry.apps[$appName]) {
                    $appIds += $registry.apps[$appName].id
                }
            }
            $registry.presets[$presetName].apps = $appIds
        }
        
        return $registry
    }
    catch {
        Write-Error "Failed to parse registry file: $_"
        return $null
    }
}

# Function to auto-detect app configuration based on type and directory scanning
function Get-AutoDetectedAppConfig {
    param(
        [string]$AppName,
        [string]$AppType,
        [string]$AppDescription,
        [int]$Index
    )

    # Determine base path based on type
    $appPath = ""
    $basePath = ""
    
    if ($AppType -eq "ncore-app" -or $AppType -eq "python") {
        $basePath = $APPS_DIR
        $appPath = "apps/$AppName"
    } elseif ($AppType -like "poly-*") {
        $basePath = $POLY_APPS_DIR
        $appBaseName = $AppName -replace ':.*', '' # Remove variant suffix for path
        $appPath = "poly_apps/$appBaseName"
    } else {
        Write-Warning "Unknown app type: $AppType for app: $AppName"
        return $null
    }
    
    # Check if app directory exists
    $fullAppPath = Join-Path $PROJECT_ROOT $appPath
    if (-not (Test-Path $fullAppPath)) {
        Write-Warning "App directory not found: $fullAppPath for app: $AppName"
        return $null
    }
    
    # Auto-detect scripts directory
    $scriptsDir = Join-Path $fullAppPath "scripts"
    $hasScripts = Test-Path $scriptsDir
    
    # Auto-detect available scripts
    $availableScripts = @{}
    if ($hasScripts) {
        $scriptFiles = Get-ChildItem -Path $scriptsDir -Filter "*.bat" -File
        foreach ($script in $scriptFiles) {
            $scriptName = $script.BaseName
            $availableScripts[$scriptName] = $script.FullName
        }
    }
    
    # Determine category based on type
    $category = switch ($AppType) {
        "ncore-app" { "backend" }
        "python" { "automation" }
        "poly-vue" { "frontend" }
        "poly-laravel" { "backend" }
        "poly-flutter" { "mobile" }
        default { "other" }
    }
    
    # Build app configuration
    $appConfig = @{
        id = $Index
        type = $AppType
        category = $category
        path = $appPath
        description = $AppDescription
        requires_root = $false
        auto_restart = if ($AppType -eq "ncore-app" -or $AppType -eq "poly-laravel") { $true } else { $false }
        dependencies = if ($AppType -eq "ncore-app") { @("ncore") } else { @() }
        ports = @()
    }
    
    # Add Linux commands (keep existing structure for compatibility)
    if ($AppType -eq "ncore-app") {
        $appConfig.start_cmd_linux = "bash apps/$AppName/scripts/start.sh &"
        $appConfig.install_cmd_linux = "bash apps/$AppName/scripts/install.sh"
        $appConfig.deploy_cmd_linux = "bash apps/$AppName/scripts/deploy.sh"
        $appConfig.stop_cmd_linux = "bash apps/$AppName/scripts/stop.sh"
        $appConfig.ncore_app_name = $AppName
    } elseif ($AppType -like "poly-*") {
        $appBaseName = $AppName -replace ':.*', ''
        $appConfig.install_cmd_linux = "bash poly_apps/$appBaseName/scripts/install.sh"
        $appConfig.deploy_cmd_linux = "bash poly_apps/$appBaseName/scripts/deploy.sh"
        
        # Handle poly app variants
        if ($AppName -match ':(.+)$') {
            $variant = $matches[1]
            $appConfig.start_cmd_linux = "bash poly_apps/$appBaseName/scripts/start.sh $variant &"
            $appConfig.deploy_cmd_linux = "bash poly_apps/$appBaseName/scripts/deploy.sh $variant"
            $appConfig.build_cmd = "yarn build:$variant"
            $appConfig.stop_cmd = "pkill -f `"yarn dev:$variant`""
            $appConfig.generate_cmd = "yarn generate:$variant"
        } else {
            $appConfig.start_cmd_linux = "bash poly_apps/$appBaseName/scripts/start.sh &"
        }
        
        # Set default ports based on type
        if ($AppType -eq "poly-vue") {
            $appConfig.ports = if ($AppName -like "nuxt_main*") { @(3001) } else { @(5173) }
            $appConfig.build_cmd = if ($AppName -like "*admin-vue-tailwind*") { "npm run build" } elseif ($AppName -like "*it-tools*") { "pnpm build" } else { "yarn build" }
            $appConfig.stop_cmd = if ($AppName -like "*admin-vue-tailwind*") { "pkill -f `"npm run dev`"" } elseif ($AppName -like "*it-tools*") { "pkill -f `"pnpm dev`"" } else { "pkill -f `"yarn dev`"" }
        } elseif ($AppType -eq "poly-laravel") {
            $appConfig.ports = @(8000)
            $appConfig.build_cmd = "npm run build && php artisan optimize"
            $appConfig.stop_cmd = "pkill -f `"php artisan serve`""
        } elseif ($AppType -eq "poly-flutter") {
            $appConfig.ports = @(8080)
            $appConfig.build_cmd = "flutter build web"
            $appConfig.stop_cmd = "pkill -f `"flutter run`""
        }
    } elseif ($AppType -eq "python") {
        $appConfig.start_cmd = "python main.py"
        $appConfig.install_cmd = "uv sync"
        $appConfig.stop_cmd = "pkill -f `"python main.py`""
        $appConfig.deploy_cmd_linux = "bash apps/$AppName/scripts/deploy.sh"
    }
    
    return $appConfig
}

# Function to get registry with auto-detection (main entry point)
function Get-AppRegistryWithAutoDetection {
    return Get-IniAppRegistry
}

# Functions are available when this script is dot-sourced