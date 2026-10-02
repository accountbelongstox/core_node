# .NET 8 SDK + VC++ 2015-2022 x64 redistributable (dotapps/d3d4tester: WPF build, OpenCvSharp4, PaddleOCRSharp).
# Windows twin of linux/debian/install_shells/57_install_dotnet.sh. Detection is by binary/DLL existence;
# only the missing piece is installed (winget). Idempotent.
[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$SCRIPT_INDEX       = '[Step71-Dotnet]'
$DOTNET_WINGET_ID   = 'Microsoft.DotNet.SDK.8'
$VCREDIST_WINGET_ID = 'Microsoft.VCRedist.2015+.x64'
$DOTNET_EXE_NAME    = 'dotnet.exe'
$DOTNET_SDK_FILTER  = '8.*'
$VCREDIST_DLLS      = @('vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll')
$winCommonDir       = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
$system32Dir        = Join-Path $env:SystemRoot 'System32'
$dotnetPath         = $null
$sdkVersion         = $null
$vcredistReady      = $false
$wingetArgs         = $null

. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'CommonFunc.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')

function Get-DotnetPath {
    $command = Get-Command -Name 'dotnet' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $command) {
        return [string]$command.Source
    }
    $fallback = Join-Path (Join-Path $env:ProgramFiles 'dotnet') $DOTNET_EXE_NAME
    if (Test-Path -LiteralPath $fallback -PathType Leaf) {
        return $fallback
    }
    return $null
}

function Get-DotnetSdk8Version {
    param([string]$ExePath)
    if ([string]::IsNullOrEmpty($ExePath)) {
        return $null
    }
    $sdks = Join-Path (Split-Path -Parent $ExePath) 'sdk'
    if (-not (Test-Path -LiteralPath $sdks -PathType Container)) {
        return $null
    }
    $found = Get-ChildItem -LiteralPath $sdks -Directory -Filter $DOTNET_SDK_FILTER -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $found) {
        return $null
    }
    return $found.Name
}

function Test-VcRedistPresent {
    foreach ($dll in $VCREDIST_DLLS) {
        if (-not (Test-Path -LiteralPath (Join-Path $system32Dir $dll) -PathType Leaf)) {
            return $false
        }
    }
    return $true
}

$dotnetPath = Get-DotnetPath
$sdkVersion = Get-DotnetSdk8Version -ExePath $dotnetPath
if ($null -ne $sdkVersion -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [idempotent] .NET 8 SDK present: $sdkVersion" -ForegroundColor Green
}
else {
    Write-Host "$SCRIPT_INDEX [..] installing .NET 8 SDK via winget ($DOTNET_WINGET_ID) ..." -ForegroundColor Yellow
    Invoke-WingetCommand -Id $DOTNET_WINGET_ID -Keyword $DOTNET_EXE_NAME -ForceToInstallDir $false -IncludeSystemPaths $true -UseInstallLocation $false -InstalledCheck { $null -ne (Get-DotnetSdk8Version -ExePath (Get-DotnetPath)) } | Out-Null
    Refresh-ProcessPathEnv
    $dotnetPath = Get-DotnetPath
    $sdkVersion = Get-DotnetSdk8Version -ExePath $dotnetPath
    if ($null -eq $sdkVersion) {
        Write-Host "$SCRIPT_INDEX [!] .NET 8 SDK is still missing after the install; it will retry next run." -ForegroundColor DarkYellow
    }
    else {
        Write-Host "$SCRIPT_INDEX [OK] .NET 8 SDK ready: $sdkVersion" -ForegroundColor Green
    }
}

$vcredistReady = Test-VcRedistPresent
if ($vcredistReady -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [idempotent] VC++ 2015-2022 x64 redistributable present" -ForegroundColor Green
}
else {
    Write-Host "$SCRIPT_INDEX [..] installing VC++ 2015-2022 x64 redistributable via winget ($VCREDIST_WINGET_ID) ..." -ForegroundColor Yellow
    $wingetArgs = @('install', '--id', $VCREDIST_WINGET_ID, '--exact', '--silent', '--accept-source-agreements')
    if ($Global:isWin11) {
        $wingetArgs += '--accept-package-agreements'
    }
    & winget @wingetArgs
    if (Test-VcRedistPresent) {
        Write-Host "$SCRIPT_INDEX [OK] VC++ 2015-2022 x64 redistributable ready" -ForegroundColor Green
    }
    else {
        Write-Host "$SCRIPT_INDEX [!] VC++ redistributable is still missing after the install; it will retry next run." -ForegroundColor DarkYellow
    }
}
