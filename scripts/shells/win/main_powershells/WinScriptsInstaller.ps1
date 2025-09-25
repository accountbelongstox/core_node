# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Declare all variables at the beginning of the file
$FILES = @(
    'scripts/shells/win/dd.ps1',
    'scripts/shells/win/main_powershells/EnvironmentDetection.ps1',
    'scripts/shells/win/win_common/CommanFunc.ps1',
    'scripts/shells/win/win_common/ApplicationsList.ps1',
    'scripts/shells/win/win_common/GlobalVars.ps1',
    'scripts/shells/win/win_common/IconExtractor.ps1',
    'scripts/shells/win/win_common/SimpleIconExtractor.ps1',
    'scripts/shells/win/win_common/WindowsPathFunction.ps1',
    'scripts/shells/win/win_common/WindowsServiceManager.ps1',
    'scripts/shells/win/win_common/PackageManagerInvokes.ps1',
    'scripts/shells/win/win_common/PostInstallCallbackProcessor.ps1',
    'scripts/shells/win/win_common/DesktopIconManager.ps1',
    'scripts/shells/win/win_common/StartupManager.ps1',
    'scripts/shells/win/install_powershells/InstallerScriptsList.ps1',
    'scripts/shells/win/menu_itemshells/DevInstaller.ps1',
    'scripts/shells/win/menu_itemshells/ScriptScanner.ps1',
    'scripts/shells/win/menu_itemshells/TestInstaller.ps1',
    'scripts/shells/win/menu_itemshells/WSLUbuntuManager.ps1'
)

## Dynamic configuration based on region to reduce complexity
# Function to determine base URL based on region preference
function Get-RepoBaseUrl {
    $globalVarDir = "$env:USERPROFILE\.core_node\.global_vars"
    $regionFile = Join-Path $globalVarDir "SELECTED_REGION"
    
    $selectedRegion = "China"  # Default to China if no preference set
    if (Test-Path $regionFile) {
        $selectedRegion = Get-Content $regionFile -Raw -ErrorAction SilentlyContinue
        $selectedRegion = $selectedRegion.Trim()
    }
    
    if ($selectedRegion -eq "Global") {
        return 'https://raw.githubusercontent.com/accountbelongstox/core_node/main'
    } else {
        return 'https://gitee.com/accountbelongstox/core_node/raw/main'
    }
}

$RepoBaseUrl = Get-RepoBaseUrl
$LocalDataDir = "$env:USERPROFILE\.core_node"

# Common function for safe file downloads with atomic overwrite
function Invoke-SafeDownload {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,
        [Parameter(Mandatory = $true)]
        [string]$DestinationPath,
        [string]$Description = "file"
    )
    
    $tmpPath = "$DestinationPath.tmp"
    
    # Ensure destination directory exists
    $destDir = Split-Path $DestinationPath -Parent
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    
    # Clean up any existing temp file
    if (Test-Path $tmpPath) {
        Remove-Item -Force $tmpPath -ErrorAction SilentlyContinue
    }
    
    Write-Host ("Downloading {0} from: {1}" -f $Description, $Url) -ForegroundColor White
    try {
        Invoke-WebRequest -Uri $Url -OutFile $tmpPath -UseBasicParsing -ErrorAction Stop
        
        # Verify download was successful
        if (-not (Test-Path $tmpPath) -or ((Get-Item $tmpPath).Length -le 0)) {
            throw "Empty or failed download"
        }
        
        # Atomic move to overwrite existing file
        Move-Item -Force -Path $tmpPath -Destination $DestinationPath
        Write-Host ("Saved: {0}" -f $DestinationPath) -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host ("Failed: {0} -> {1} ({2})" -f $Url, $DestinationPath, $_) -ForegroundColor Red
        # Clean up temp file on failure
        if (Test-Path $tmpPath) {
            Remove-Item -Force $tmpPath -ErrorAction SilentlyContinue
        }
        return $false
    }
}

# Ensure local data root exists
if (-not (Test-Path $LocalDataDir -PathType Container)) {
    New-Item -ItemType Directory -Path $LocalDataDir -Force | Out-Null
}


Write-Host ("Local data root: {0}" -f $LocalDataDir) -ForegroundColor White
Write-Host ("Repository base: {0}" -f $RepoBaseUrl) -ForegroundColor White

$failed = @()
foreach ($rel in $FILES) {
    $url = ("{0}/{1}" -f $RepoBaseUrl.TrimEnd('/'), $rel)
    $dest = Join-Path $LocalDataDir $rel
    
    $success = Invoke-SafeDownload -Url $url -DestinationPath $dest -Description $rel
    if (-not $success) {
        $failed += $rel
    }
}

if ($failed.Count -gt 0) {
    Write-Host ("Completed with failures: {0}" -f ($failed -join ', ')) -ForegroundColor Yellow
    exit 2
}

Write-Host 'All files downloaded successfully.' -ForegroundColor Green
exit 0


