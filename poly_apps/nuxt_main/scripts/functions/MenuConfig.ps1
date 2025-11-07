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

# Menu Configuration for Nuxt Main Apps
# Automatically discovers applications from apps/ directory with support for manual overrides

$script:AppConfigs = $null
$script:IsAutoDiscoveryEnabled = $true
$script:AppsDirectory = $null

# Hardcoded fallback configuration (used only if auto-discovery fails)
$script:FallbackAppConfigs = @{
    "example" = @{
        Name = "example"
        DisplayName = "Example App"
        Port = 3000
        DevCommand = "dev:example"
        BuildCommand = "build:example"
    }
    "codemart" = @{
        Name = "codemart"
        DisplayName = "CodeMart"
        Port = 3001
        DevCommand = "dev:codemart"
        BuildCommand = "build:codemart"
    }
    "dev" = @{
        Name = "dev"
        DisplayName = "Dev App"
        Port = 3002
        DevCommand = "dev:dev"
        BuildCommand = "build:dev"
    }
    "admin" = @{
        Name = "admin"
        DisplayName = "Admin Panel"
        Port = 3003
        DevCommand = "dev:admin"
        BuildCommand = "build:admin"
    }
    "dashboard" = @{
        Name = "dashboard"
        DisplayName = "Dashboard"
        Port = 3004
        DevCommand = "dev:dashboard"
        BuildCommand = "build:dashboard"
    }
}

function Initialize-AppConfigs {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory
    )

    $script:AppsDirectory = Join-Path $AppDirectory "apps"

    if (Test-Path $script:AppsDirectory -PathType Container) {
        try {
            $script:AppConfigs = Build-ApplicationConfigs -AppsDirectory $script:AppsDirectory -BasePort 3000
            if ($script:AppConfigs.Count -gt 0) {
                Log-DiscoveredApplications -AppConfigs $script:AppConfigs
                return $true
            }
        }
        catch {
            Write-Host "[WARNING] Auto-discovery failed: $_" -ForegroundColor Yellow
        }
    }

    Write-Host "[INFO] Falling back to hardcoded application configuration" -ForegroundColor Yellow
    $script:AppConfigs = $script:FallbackAppConfigs
    return $false
}

function Get-AppConfigs {
    if ($null -eq $script:AppConfigs) {
        Write-Host "[WARNING] AppConfigs not initialized. Returning fallback configuration." -ForegroundColor Yellow
        return $script:FallbackAppConfigs
    }
    return $script:AppConfigs
}

function Get-AppConfig {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppName
    )

    $configs = Get-AppConfigs
    if ($configs.ContainsKey($AppName)) {
        return $configs[$AppName]
    }

    return $null
}
