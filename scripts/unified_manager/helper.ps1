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

# Unified Manager Helper - PowerShell
# Provides quick access to common unified manager functions

param(
    [string]$Action = "help"
)

# Variables declaration
$UNIFIED_MANAGER_ROOT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$UTILS_PATH = Join-Path $UNIFIED_MANAGER_ROOT_DIR "common\utils.ps1"
$START_SCRIPT = Join-Path $UNIFIED_MANAGER_ROOT_DIR "app_managers\start_apps.ps1"

# Import utilities
if (Test-Path $UTILS_PATH) {
    . $UTILS_PATH
}

function Show-Help {
    Write-Host "Unified Manager Helper" -ForegroundColor Green
    Write-Host ""
    Write-Host "Quick Commands:" -ForegroundColor Cyan
    Write-Host "  .\helper.ps1 list          - Show all apps and presets" -ForegroundColor White
    Write-Host "  .\helper.ps1 check         - Check all app scripts" -ForegroundColor White
    Write-Host "  .\helper.ps1 start 1,3,5   - Start specific apps by ID" -ForegroundColor White
    Write-Host "  .\helper.ps1 preset P1     - Start preset by ID" -ForegroundColor White
    Write-Host "  .\helper.ps1 interactive   - Interactive selection mode" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\helper.ps1 start 1-5     - Start apps 1 through 5" -ForegroundColor Gray
    Write-Host "  .\helper.ps1 preset dev-suite - Start dev-suite preset" -ForegroundColor Gray
}

function Show-QuickList {
    Write-Host "Quick App Reference:" -ForegroundColor Green
    Write-Host ""
    
    $registry = Get-AppRegistry
    if (-not $registry) {
        Write-Error "Failed to load app registry"
        return
    }
    
    # Show apps in compact format
    $sortedApps = $registry.apps.PSObject.Properties | Sort-Object { $_.Value.id }
    foreach ($appProperty in $sortedApps) {
        $appName = $appProperty.Name
        $appConfig = $appProperty.Value
        Write-Host "$($appConfig.id): $appName ($($appConfig.type))" -ForegroundColor Cyan
    }
    
    Write-Host ""
    Write-Host "Quick Preset Reference:" -ForegroundColor Green
    foreach ($presetName in $registry.presets.PSObject.Properties.Name) {
        $presetConfig = $registry.presets.$presetName
        Write-Host "$($presetConfig.id): $presetName" -ForegroundColor Magenta
    }
}

function Start-QuickApps {
    param([string]$AppSpecs)
    
    if (-not (Test-Path $START_SCRIPT)) {
        Write-Error "Start script not found: $START_SCRIPT"
        return
    }
    
    $apps = $AppSpecs -split ","
    & $START_SCRIPT -Apps $apps -Background
}

function Start-QuickPreset {
    param([string]$PresetSpec)
    
    if (-not (Test-Path $START_SCRIPT)) {
        Write-Error "Start script not found: $START_SCRIPT"
        return
    }
    
    & $START_SCRIPT -Preset $PresetSpec -Background
}

function Start-Interactive {
    if (-not (Test-Path $START_SCRIPT)) {
        Write-Error "Start script not found: $START_SCRIPT"
        return
    }
    
    & $START_SCRIPT -Interactive
}

function Check-AllScripts {
    if (Get-Command Test-AllAppScripts -ErrorAction SilentlyContinue) {
        Test-AllAppScripts
    } else {
        Write-Error "Script checking function not available"
    }
}

# Main execution
switch ($Action.ToLower()) {
    "help" { Show-Help }
    "list" { 
        if (Test-Path $START_SCRIPT) {
            & $START_SCRIPT -List
        } else {
            Show-QuickList
        }
    }
    "quick" { Show-QuickList }
    "check" { Check-AllScripts }
    "interactive" { Start-Interactive }
    default {
        if ($Action -match "^start\s+(.+)") {
            Start-QuickApps -AppSpecs $matches[1]
        }
        elseif ($Action -match "^preset\s+(.+)") {
            Start-QuickPreset -PresetSpec $matches[1]
        }
        elseif ($args.Count -gt 0) {
            # Handle additional arguments
            switch ($args[0].ToLower()) {
                "start" { 
                    if ($args.Count -gt 1) {
                        Start-QuickApps -AppSpecs $args[1]
                    } else {
                        Write-Error "Please specify apps to start"
                    }
                }
                "preset" { 
                    if ($args.Count -gt 1) {
                        Start-QuickPreset -PresetSpec $args[1]
                    } else {
                        Write-Error "Please specify preset to start"
                    }
                }
                default { Show-Help }
            }
        }
        else {
            Show-Help
        }
    }
}

exit 0
