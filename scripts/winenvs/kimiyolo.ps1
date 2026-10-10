Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = $null
$scriptsDirPath = $null
$coreNodePath = $null
$shellsWinPath = $null
$winCommonDirPath = $null
$windowsPathFunctionScript = $null
$serviceContractScript = $null
$aiCliProvisionCommonScript = $null
$mcpChromeHost = $null
$mcpChromeUrl = $null
$mcpChromePort = 0
$upgradeChoice = $null
$kimiInstallerUrl = "https://code.kimi.com/kimi-code/install.ps1"
$kimiInstallerScript = $null
$pnpmCommand = $null
$kimiCommand = $null
$currentVersionOutput = $null
$latestVersionOutput = $null
$currentVersionTokens = @()
$latestVersionTokens = @()
$versionSeparators = @()
$versionToken = $null
$versionCandidate = $null
$currentVersion = $null
$latestVersion = $null
$versionGapLarge = $false
$kimiArgs = @()
$displayArgs = $null
$userProfilePath = $null
$currentLocationPath = $null
$kimiCodeHomeCandidatePath = $null
$kimiCodeHomePath = $null
$kimiMcpConfigPath = $null
$mcpConfig = $null
$mcpServersProperty = $null
$mcpServers = $null
$chromeMcpConfig = $null
$chromeMcpProperty = $null
$mcpJson = $null
$utf8Encoding = $null
$kimiSecretDirPath = $null
$kimiApiKeySecretPath = $null
$kimiBaseUrlSecretPath = $null
$kimiApiKey = ""
$kimiBaseUrl = ""
$kimiConfigTomlPath = $null
$kimiConfigApiKey = $null
$kimiConfigTomlLine = $null
$kimiKeyFile = $null
$kimiKeyEntries = @()
$selectedKeyIndex = 0
$switchChoice = $null
$switchPick = $null
$switchPickNumber = 0
$entryIndex = 0
$entryMarker = ""
$modelDeadline = $null
$modelKey = $null
$modelPick = $null
$kimiModel = "k3-256k"
$kimiModelLabel = "kimi k3 256K"
$providerArgs = @()
$providerExitCode = 0
$permissionLine = 'default_permission_mode = "auto"'
$permissionFound = $false
$configLines = @()
$configLineIndex = 0
$repairLines = @()
$repairSectionOf = @()
$repairCurrentSection = -1
$repairKfcSections = @{}
$repairIndex = 0
$repairLine = ""
$repairSectionKey = -1
$repairChanged = $false

$scriptPath = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptPath)) {
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$scriptsDirPath = Split-Path $scriptPath -Parent
$coreNodePath = Split-Path $scriptsDirPath -Parent
$shellsWinPath = Join-Path $scriptsDirPath "shells"
$shellsWinPath = Join-Path $shellsWinPath "win"
$winCommonDirPath = Join-Path $shellsWinPath "win_common"
$windowsPathFunctionScript = Join-Path $winCommonDirPath "WindowsPathFunction.ps1"
$aiCliProvisionCommonScript = Join-Path $winCommonDirPath "AiCliProvisionCommon.ps1"
$serviceContractScript = Join-Path $winCommonDirPath "ServiceContract.ps1"
. $windowsPathFunctionScript
. $serviceContractScript
# Shared launcher helpers; keys are printed through Get-AiCliMaskedSecret.
. $aiCliProvisionCommonScript
$mcpChromeHost = Get-ServiceContractHost -Name "loopback"
$mcpChromePort = Get-ServiceContractPort -Name "mcp_chrome"
$mcpChromeUrl = New-ServiceContractUrl -Protocol "http" -HostName $mcpChromeHost -Port $mcpChromePort -Path "mcp"
Set-CoreNodePaths

$kimiSecretDirPath = Join-Path $coreNodePath ".secret_keys"
$kimiSecretDirPath = Join-Path $kimiSecretDirPath ".secret_ignore"
$kimiApiKeySecretPath = Join-Path $kimiSecretDirPath "KIMI_API_KEY_1"
$kimiBaseUrlSecretPath = Join-Path $kimiSecretDirPath "KIMI_BASE_URL_1"

function Read-KimiyoloSecretFile {
    param([string]$FilePath)
    $value = ""
    if (-not (Test-Path -LiteralPath $FilePath)) {
        return $value
    }
    try {
        $bytes = [System.IO.File]::ReadAllBytes($FilePath)
        if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
            $bytes = $bytes[3..($bytes.Length - 1)]
        }
        $content = [System.Text.Encoding]::UTF8.GetString($bytes)
        foreach ($line in ($content -split "`r?`n")) {
            $trimmedLine = $line.Trim()
            if ($trimmedLine) {
                $value = $trimmedLine
                break
            }
        }
    } catch {
        $value = ""
    }
    return $value
}

$kimiApiKey = Read-KimiyoloSecretFile -FilePath $kimiApiKeySecretPath
$kimiBaseUrl = Read-KimiyoloSecretFile -FilePath $kimiBaseUrlSecretPath

# KIMI_CODE_HOME resolution (needed early for config.toml key matching).
$userProfilePath = [Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)
$currentLocationPath = (Get-Location).Path
if ([string]::IsNullOrWhiteSpace($env:KIMI_CODE_HOME)) {
    $kimiCodeHomeCandidatePath = Join-Path $userProfilePath ".kimi-code"
} elseif ([System.IO.Path]::IsPathRooted($env:KIMI_CODE_HOME)) {
    $kimiCodeHomeCandidatePath = $env:KIMI_CODE_HOME
} else {
    $kimiCodeHomeCandidatePath = Join-Path $currentLocationPath $env:KIMI_CODE_HOME
}
if (-not (Test-Path -LiteralPath $kimiCodeHomeCandidatePath)) {
    New-Item -ItemType Directory -Path $kimiCodeHomeCandidatePath -Force | Out-Null
}
$kimiCodeHomePath = (Resolve-Path -LiteralPath $kimiCodeHomeCandidatePath).Path
$kimiMcpConfigPath = Join-Path $kimiCodeHomePath "mcp.json"
$kimiConfigTomlPath = Join-Path $kimiCodeHomePath "config.toml"

$kimiConfigApiKey = $null
if (Test-Path -LiteralPath $kimiConfigTomlPath) {
    foreach ($kimiConfigTomlLine in (Get-Content -LiteralPath $kimiConfigTomlPath)) {
        if ($kimiConfigTomlLine -match '^\s*api_key\s*=\s*"(.+)"\s*$') {
            $kimiConfigApiKey = $Matches[1]
            break
        }
    }
}

# KIMI_API_KEY_${index} pool: default = the key already in config.toml;
# offer a switch prompt [y/N] when more than one key exists.
$kimiKeyEntries = @()
Get-ChildItem -LiteralPath $kimiSecretDirPath -Filter "KIMI_API_KEY_*" -File -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Name -match '^KIMI_API_KEY_(\d+)$') {
        $kimiKeyFile = Read-KimiyoloSecretFile -FilePath $_.FullName
        if (-not [string]::IsNullOrWhiteSpace($kimiKeyFile)) {
            $kimiKeyEntries += [PSCustomObject]@{
                Index = [int]$Matches[1]
                Key = $kimiKeyFile
            }
        }
    }
}
$kimiKeyEntries = @($kimiKeyEntries | Sort-Object Index)

if ($kimiKeyEntries.Count -gt 0) {
    $selectedKeyIndex = 0
    if (-not [string]::IsNullOrWhiteSpace($kimiConfigApiKey)) {
        for ($entryIndex = 0; $entryIndex -lt $kimiKeyEntries.Count; $entryIndex++) {
            if ($kimiKeyEntries[$entryIndex].Key -eq $kimiConfigApiKey) {
                $selectedKeyIndex = $entryIndex
                break
            }
        }
    }
    if ($kimiKeyEntries.Count -gt 1) {
        Write-Host "[INFO] Current key: KIMI_API_KEY_$($kimiKeyEntries[$selectedKeyIndex].Index) (from config.toml)" -ForegroundColor White
        Write-Host "Switch Kimi API key? [y/N]: " -ForegroundColor Yellow -NoNewline
        $switchChoice = Read-Host
        if (($switchChoice -eq "y") -or ($switchChoice -eq "Y")) {
            for ($entryIndex = 0; $entryIndex -lt $kimiKeyEntries.Count; $entryIndex++) {
                $entryMarker = ""
                if ($entryIndex -eq $selectedKeyIndex) {
                    $entryMarker = " (current)"
                }
                Write-Host "  [$($entryIndex + 1)] KIMI_API_KEY_$($kimiKeyEntries[$entryIndex].Index): $(Get-AiCliMaskedSecret -Value $kimiKeyEntries[$entryIndex].Key)$entryMarker" -ForegroundColor White
            }
            Write-Host "Select key number [1-$($kimiKeyEntries.Count)]: " -ForegroundColor Yellow -NoNewline
            $switchPick = Read-Host
            if ([int]::TryParse($switchPick, [ref]$switchPickNumber)) {
                if (($switchPickNumber -ge 1) -and ($switchPickNumber -le $kimiKeyEntries.Count)) {
                    $selectedKeyIndex = $switchPickNumber - 1
                }
            }
        }
    }
    $kimiApiKey = $kimiKeyEntries[$selectedKeyIndex].Key
    Write-Host "[INFO] Using KIMI_API_KEY_$($kimiKeyEntries[$selectedKeyIndex].Index): $(Get-AiCliMaskedSecret -Value $kimiApiKey)" -ForegroundColor White
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "kimiyolo.ps1" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

$kimiCommand = Get-Command kimi -ErrorAction SilentlyContinue
if ($null -eq $kimiCommand) {
    throw "kimi is not available on PATH."
}
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
$versionSeparators = @([char]' ', [char]"`t", [char]"`r", [char]"`n")
if ($null -ne $pnpmCommand) {
    $currentVersionOutput = (& $kimiCommand.Source --version 2>$null | Out-String).Trim()
    $latestVersionOutput = (& $pnpmCommand.Source view "@moonshot-ai/kimi-code" version 2>$null | Out-String).Trim()
    $currentVersionTokens = $currentVersionOutput.Split($versionSeparators, [System.StringSplitOptions]::RemoveEmptyEntries)
    foreach ($versionToken in $currentVersionTokens) {
        $versionCandidate = $versionToken.Trim()
        if ($versionCandidate.StartsWith("v", [System.StringComparison]::OrdinalIgnoreCase)) {
            $versionCandidate = $versionCandidate.Substring(1)
        }
        if ([System.Version]::TryParse($versionCandidate, [ref]$currentVersion)) {
            break
        }
    }
    $latestVersionTokens = $latestVersionOutput.Split($versionSeparators, [System.StringSplitOptions]::RemoveEmptyEntries)
    foreach ($versionToken in $latestVersionTokens) {
        $versionCandidate = $versionToken.Trim()
        if ($versionCandidate.StartsWith("v", [System.StringComparison]::OrdinalIgnoreCase)) {
            $versionCandidate = $versionCandidate.Substring(1)
        }
        if ([System.Version]::TryParse($versionCandidate, [ref]$latestVersion)) {
            break
        }
    }
}
if (($null -ne $currentVersion) -and ($null -ne $latestVersion) -and ($latestVersion -gt $currentVersion)) {
    $versionGapLarge = ($latestVersion.Major -gt $currentVersion.Major) -or
        (($latestVersion.Major -eq $currentVersion.Major) -and ($latestVersion.Minor -gt $currentVersion.Minor))
}
if ($versionGapLarge) {
    Write-Host "Upgrade Kimi Code CLI with the official native installer? [N/y]: " -ForegroundColor Yellow -NoNewline
    $upgradeChoice = Read-Host
}
if (($upgradeChoice -eq "y") -or ($upgradeChoice -eq "Y")) {
    Write-Host "[INFO] Upgrading Kimi Code CLI with the official native installer..." -ForegroundColor Cyan
    $kimiInstallerScript = Invoke-RestMethod -Uri $kimiInstallerUrl
    Invoke-Expression $kimiInstallerScript
    Write-Host "[INFO] Kimi Code CLI native upgrade command completed." -ForegroundColor Green
} elseif ($versionGapLarge) {
    Write-Host "[INFO] Kimi Code CLI upgrade skipped." -ForegroundColor DarkGray
}

# Model selection (default 1 = kimi k3 256K / k3-256k; auto-selects after 5s).
Write-Host "Select model (default 1 = kimi k3 256K / k3-256k; auto-select in 5 seconds):" -ForegroundColor Yellow
Write-Host "  [1] kimi k3 256K (k3-256k)" -ForegroundColor White
Write-Host "  [2] kimi k3 1M (k3)" -ForegroundColor White
Write-Host "  [3] kimi2.8 preview (kimi-for-coding, 1M)" -ForegroundColor White
Write-Host "  [4] kimi2.7 code highspeed (kimi-for-coding-highspeed, 256K)" -ForegroundColor White
Write-Host "Model number [1-4] (Enter or timeout = 1): " -ForegroundColor Yellow -NoNewline
$modelDeadline = (Get-Date).AddSeconds(5)
while ((Get-Date) -lt $modelDeadline) {
    if ([Console]::KeyAvailable) {
        $modelKey = [Console]::ReadKey($true)
        if ($modelKey.Key -ne [ConsoleKey]::Enter) {
            $modelPick = [string]$modelKey.KeyChar
            Write-Host $modelPick
        }
        break
    }
    Start-Sleep -Milliseconds 100
}
while ([Console]::KeyAvailable) {
    [Console]::ReadKey($true) | Out-Null
}
if ([string]::IsNullOrWhiteSpace($modelPick)) {
    Write-Host "1 (auto)"
}
switch ($modelPick) {
    "2" { $kimiModel = "k3"; $kimiModelLabel = "kimi k3 1M" }
    "3" { $kimiModel = "kimi-for-coding"; $kimiModelLabel = "kimi2.8 preview" }
    "4" { $kimiModel = "kimi-for-coding-highspeed"; $kimiModelLabel = "kimi2.7 code highspeed" }
    default { $kimiModel = "k3-256k"; $kimiModelLabel = "kimi k3 256K" }
}
Write-Host "[INFO] Model: $kimiModelLabel ($kimiModel)" -ForegroundColor White

# Non-interactive provider setup (idempotent: catalog add re-creates the provider).
if (-not [string]::IsNullOrWhiteSpace($kimiApiKey)) {
    $providerArgs = @("provider", "catalog", "add", "kimi-for-coding", "--api-key", $kimiApiKey, "--default-model", $kimiModel)
    if (-not [string]::IsNullOrWhiteSpace($kimiBaseUrl)) {
        $providerArgs += @("--base-url", $kimiBaseUrl)
    }
    & $kimiCommand.Source @providerArgs
    $providerExitCode = $LASTEXITCODE
    if ($providerExitCode -ne 0) {
        Write-Host "[WARN] Automatic provider setup failed (exit $providerExitCode)." -ForegroundColor Yellow
        Write-Host "[INFO] Manual setup: run kimi, type /provider, choose Known third-party -> Kimi For Coding," -ForegroundColor White
        Write-Host "[INFO]   and paste this key: $kimiApiKey" -ForegroundColor White
    } else {
        Write-Host "[INFO] Provider kimi-for-coding configured (default model: $kimiModel)." -ForegroundColor Green
    }
} else {
    Write-Host "[WARN] No API key found (KIMI_API_KEY_*); skipping provider setup." -ForegroundColor Yellow
}

# Idempotent repair: kimi-for-coding is now K2.8 Preview (1M context).
# Older config.toml model entries may still declare 262144 (256K); refresh them.
$utf8Encoding = New-Object System.Text.UTF8Encoding($false)
if (Test-Path -LiteralPath $kimiConfigTomlPath) {
    $repairLines = [System.IO.File]::ReadAllLines($kimiConfigTomlPath)
    $repairSectionOf = @()
    $repairCurrentSection = -1
    $repairKfcSections = @{}
    for ($repairIndex = 0; $repairIndex -lt $repairLines.Count; $repairIndex++) {
        $repairLine = $repairLines[$repairIndex]
        if ($repairLine -match '^\s*\[') {
            $repairCurrentSection = $repairIndex
        }
        $repairSectionOf += $repairCurrentSection
        if (($repairCurrentSection -ge 0) -and ($repairLine -match '^\s*model\s*=\s*"kimi-for-coding"')) {
            $repairKfcSections[$repairCurrentSection] = $true
        }
    }
    $repairChanged = $false
    for ($repairIndex = 0; $repairIndex -lt $repairLines.Count; $repairIndex++) {
        $repairSectionKey = $repairSectionOf[$repairIndex]
        if (($repairSectionKey -ge 0) -and $repairKfcSections.ContainsKey($repairSectionKey) -and ($repairLines[$repairIndex] -match '^\s*max_context_size\s*=\s*262144')) {
            $repairLines[$repairIndex] = 'max_context_size = 1048576'
            $repairChanged = $true
        }
    }
    if ($repairChanged) {
        [System.IO.File]::WriteAllLines($kimiConfigTomlPath, [string[]]$repairLines, $utf8Encoding)
        Write-Host "[INFO] Repaired kimi-for-coding model entries to K2.8 Preview (1M context)." -ForegroundColor Green
    }
}

# Permission mode: Never Ask (disables "Approve once" prompts); idempotent.
if (Test-Path -LiteralPath $kimiConfigTomlPath) {
    $configLines = [System.IO.File]::ReadAllLines($kimiConfigTomlPath)
    $permissionFound = $false
    for ($configLineIndex = 0; $configLineIndex -lt $configLines.Count; $configLineIndex++) {
        if ($configLines[$configLineIndex] -match '^\s*default_permission_mode\s*=') {
            $configLines[$configLineIndex] = $permissionLine
            $permissionFound = $true
            break
        }
    }
    if (-not $permissionFound) {
        $configLines = @($permissionLine) + $configLines
    }
    [System.IO.File]::WriteAllLines($kimiConfigTomlPath, [string[]]$configLines, $utf8Encoding)
} else {
    [System.IO.File]::WriteAllText($kimiConfigTomlPath, $permissionLine + "`r`n", $utf8Encoding)
}
Write-Host "[INFO] Permission mode: auto (Never Ask; approve prompts disabled) in $kimiConfigTomlPath" -ForegroundColor Green

Invoke-AiCliChromeServiceEnsure

Write-Host "[INFO] KIMI_BASE_URL: $(if ([string]::IsNullOrWhiteSpace($kimiBaseUrl)) { "[empty]" } else { $kimiBaseUrl })" -ForegroundColor White
Write-Host "[INFO] API key: $(Get-AiCliMaskedSecret -Value $kimiApiKey)" -ForegroundColor White

if (Test-Path -LiteralPath $kimiMcpConfigPath) {
    $mcpConfig = Get-Content -Raw -LiteralPath $kimiMcpConfigPath | ConvertFrom-Json
} else {
    $mcpConfig = [PSCustomObject]@{}
}
if ($null -eq $mcpConfig) {
    $mcpConfig = [PSCustomObject]@{}
}
$mcpServersProperty = $mcpConfig.PSObject.Properties["mcpServers"]
if ($null -eq $mcpServersProperty) {
    $mcpServers = [PSCustomObject]@{}
    $mcpConfig | Add-Member -MemberType NoteProperty -Name "mcpServers" -Value $mcpServers
} elseif ($null -eq $mcpServersProperty.Value) {
    $mcpServers = [PSCustomObject]@{}
    $mcpServersProperty.Value = $mcpServers
} else {
    $mcpServers = $mcpServersProperty.Value
}
$chromeMcpConfig = [PSCustomObject]@{
    url = $mcpChromeUrl
}
$chromeMcpProperty = $mcpServers.PSObject.Properties["chrome"]
if ($null -eq $chromeMcpProperty) {
    $mcpServers | Add-Member -MemberType NoteProperty -Name "chrome" -Value $chromeMcpConfig
} else {
    $chromeMcpProperty.Value = $chromeMcpConfig
}
$mcpJson = $mcpConfig | ConvertTo-Json -Depth 20
$utf8Encoding = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($kimiMcpConfigPath, $mcpJson, $utf8Encoding)
Write-Host "[INFO] Chrome MCP registered in Kimi Code: $kimiMcpConfigPath" -ForegroundColor Green

$kimiArgs = @(
    "--auto"
)
$displayArgs = if ($args.Count -gt 0) {
    [string]::Format("; extra args: {0}", ($args -join " "))
} else {
    ""
}

Write-Host "[INFO] AUTO: ON (Never Ask; approve prompts disabled); built-in web search: configuration preserved" -ForegroundColor Green
Write-Host "[INFO] Provider kimi-for-coding, model $kimiModel; agents and feature settings preserved$displayArgs" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

& $kimiCommand.Source @kimiArgs @args
