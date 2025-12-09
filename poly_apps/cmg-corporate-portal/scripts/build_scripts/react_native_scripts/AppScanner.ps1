# AppScanner.ps1
# Scans and discovers React Native apps in the workspace

$script:appConfigs = @{}

function Initialize-AppConfigs {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory
    )

    $script:appConfigs = @{}

    $configsPath = Join-Path $AppDirectory "configs"

    if (-not (Test-Path $configsPath)) {
        Write-Host "[WARNING] Configs directory not found at: $configsPath" -ForegroundColor Yellow
        return
    }

    $configFiles = Get-ChildItem -Path $configsPath -Filter "*.config.ts" -File

    foreach ($configFile in $configFiles) {
        $namespace = $configFile.BaseName -replace '\.config$', ''

        $appConfig = @{
            Name = $namespace
            DisplayName = $namespace.ToUpper()
            ConfigFile = $configFile.FullName
            Port = 8081
            DevCommand = "react-native start"
            BuildAndroidCommand = "react-native run-android"
            BuildIosCommand = "react-native run-ios"
            TestCommand = "jest"
        }

        $script:appConfigs[$namespace] = $appConfig
    }

    if ($script:appConfigs.Count -eq 0) {
        Write-Host "[WARNING] No app configurations found in: $configsPath" -ForegroundColor Yellow
    } else {
        Write-Host "[INFO] Found $($script:appConfigs.Count) app(s)" -ForegroundColor Green
    }
}

function Get-AppConfigs {
    return $script:appConfigs
}

function Get-AppConfig {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Namespace
    )

    if ($script:appConfigs.ContainsKey($Namespace)) {
        return $script:appConfigs[$Namespace]
    }

    return $null
}

function Test-AppExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Namespace
    )

    return $script:appConfigs.ContainsKey($Namespace)
}
