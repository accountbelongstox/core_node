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

# App Scanner - Automatic Application Discovery
# Scans apps/ directory to discover all available Nuxt applications

function Scan-Applications {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppsDirectory
    )

    $appDirs = Get-ChildItem -Path $AppsDirectory -Directory -Filter "app_*" -ErrorAction SilentlyContinue
    $discoveredApps = @()

    foreach ($appDir in $appDirs) {
        $appName = $appDir.Name -replace "^app_", ""
        $discoveredApps += $appName
    }

    return @($discoveredApps | Sort-Object)
}

function Convert-ToDisplayName {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppName
    )

    $words = $AppName -split "_"
    $displayName = ($words | ForEach-Object {
        $char0 = $_.Substring(0, 1).ToUpper()
        $charRest = $_.Substring(1).ToLower()
        $char0 + $charRest
    }) -join " "

    return $displayName
}

function Get-AppConfigOverride {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppName,
        [Parameter(Mandatory = $true)]
        [string]$AppsDirectory
    )

    $appDir = Join-Path $AppsDirectory "app_$AppName"
    $configPath = Join-Path $appDir "app-config.json"
    $configOverride = $null

    if (Test-Path $configPath) {
        try {
            $configOverride = Get-Content $configPath -Raw | ConvertFrom-Json
        }
        catch {
            Write-Host "[WARNING] Failed to parse app-config.json for $AppName : $_" -ForegroundColor Yellow
        }
    }

    return $configOverride
}

function Generate-PortNumber {
    param(
        [Parameter(Mandatory = $true)]
        [int]$SequenceIndex,
        [Parameter(Mandatory = $false)]
        [int]$BasePort = 3000
    )

    return $BasePort + $SequenceIndex
}

function Validate-AppStructure {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppName,
        [Parameter(Mandatory = $true)]
        [string]$AppsDirectory
    )

    $appPath = Join-Path $AppsDirectory "app_$AppName"

    if (-not (Test-Path $appPath -PathType Container)) {
        Write-Host "[ERROR] Application directory not found: app_$AppName" -ForegroundColor Red
        return $false
    }

    $hasAnyContent = (Get-ChildItem -Path $appPath -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0

    if (-not $hasAnyContent) {
        Write-Host "[WARNING] Application directory is empty: app_$AppName" -ForegroundColor Yellow
        return $false
    }

    Write-Host "[INFO] Discovered app: app_$AppName" -ForegroundColor Gray
    return $true
}

function Build-ApplicationConfigs {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppsDirectory,
        [Parameter(Mandatory = $false)]
        [int]$BasePort = 3000
    )

    $discoveredApps = Scan-Applications -AppsDirectory $AppsDirectory
    $appConfigs = @{}
    $sequenceIndex = 0

    foreach ($appName in $discoveredApps) {
        $displayName = Convert-ToDisplayName -AppName $appName
        $portNumber = Generate-PortNumber -SequenceIndex $sequenceIndex -BasePort $BasePort
        $override = Get-AppConfigOverride -AppName $appName -AppsDirectory $AppsDirectory

        $config = @{
            Name = $appName
            DisplayName = if ($override.displayName) { $override.displayName } else { $displayName }
            Port = if ($override.port) { $override.port } else { $portNumber }
            DevCommand = if ($override.devCommand) { $override.devCommand } else { "dev:$appName" }
            BuildCommand = if ($override.buildCommand) { $override.buildCommand } else { "build:$appName" }
        }

        $isValid = Validate-AppStructure -AppName $appName -AppsDirectory $AppsDirectory
        if ($isValid) {
            $appConfigs[$appName] = $config
        }
        else {
            Write-Host "[ERROR] Application structure validation failed for: $appName" -ForegroundColor Red
        }

        $sequenceIndex += 1
    }

    return $appConfigs
}

function Get-AllDiscoveredApps {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppsDirectory
    )

    return Scan-Applications -AppsDirectory $AppsDirectory
}

function Log-DiscoveredApplications {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$AppConfigs
    )

    Write-Host ""
    Write-Host "=== Discovered Applications ===" -ForegroundColor Cyan
    Write-Host "Total: $($AppConfigs.Count) application(s)" -ForegroundColor Green

    foreach ($appName in $AppConfigs.Keys | Sort-Object) {
        $config = $AppConfigs[$appName]
        Write-Host "  ✓ $($config.DisplayName)" -ForegroundColor Green
        Write-Host "    └─ Namespace: $appName, Port: $($config.Port)" -ForegroundColor Gray
    }

    Write-Host ""
}
