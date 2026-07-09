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
    'scripts/shells/win/win_common/CommonFunc.ps1',
    'scripts/shells/win/win_common/StringEscapeUtils.ps1',
    'scripts/shells/win/win_common/registry_templates/all_files_context.reg',
    'scripts/shells/win/win_common/registry_templates/file_context.reg',
    'scripts/shells/win/win_common/registry_templates/folder_context.reg',
    'scripts/shells/win/win_common/registry_templates/new_document.reg',
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
    'scripts/shells/win/win_common/SecretDecryptionCheck.ps1',
    'scripts/shells/win/win_common/SecretEncryptionCheck.ps1',
    'scripts/shells/win/install_powershells/InstallerScriptsList.ps1',
    'scripts/shells/win/install_powershells/Step1_InitializeBaseDirectories.ps1',
    'scripts/shells/win/install_powershells/Step2_SetBaseSettings.ps1',
    'scripts/shells/win/install_powershells/Step3_InitWinget.ps1',
    'scripts/shells/win/install_powershells/Step4_InstallNodeJS.ps1',
    'scripts/shells/win/install_powershells/Step5_InstallGitSSH.ps1',
    'scripts/shells/win/install_powershells/Step6_InstallGit.ps1',
    'scripts/shells/win/install_powershells/Step7_FixCoreNodeProjectLocation.ps1',
    'scripts/shells/win/install_powershells/Step9_InstallPython.ps1',
    'scripts/shells/win/install_powershells/Step10_InstallScoopWithChinaMirror.ps1',
    'scripts/shells/win/install_powershells/Step11_ExtendWindowsUpdate.ps1',
    'scripts/shells/win/install_powershells/Step12_InstallPHP.ps1',
    'scripts/shells/win/install_powershells/Step13_SetFileAssociations.ps1',
    'scripts/shells/win/install_powershells/Step14_DV.ps1',
    'scripts/shells/win/install_powershells/Step15_Install7ipBase.ps1',
    'scripts/shells/win/install_powershells/Step16_InstallApplications.ps1',
    'scripts/shells/win/install_powershells/Step30_InstallChrome.ps1',
    'scripts/shells/win/install_powershells/Step31_InstallPuppeteerPlugins.ps1',
    'scripts/shells/win/install_powershells/Step51_InstallApkTool.ps1',
    'scripts/shells/win/install_powershells/Step60_InstallAndroidStudio.ps1',
    'scripts/shells/win/install_powershells/Step61_InstallAndroidPlatformTools.ps1',
    'scripts/shells/win/install_powershells/Step70_InstallFlutter.ps1',
    'scripts/shells/win/install_powershells/Step84_InstallWSL.ps1',
    'scripts/shells/win/install_powershells/Step85_InstallWSLUbuntu24.ps1',
    'scripts/shells/win/install_powershells/Step86_SetRootLoginWSLUbuntuDebian.ps1',
    'scripts/shells/win/install_powershells/Step87_InstallVisualStudio.ps1',
    'scripts/shells/win/install_powershells/Step88_InstallQtBuildTools.ps1',
    'scripts/shells/win/install_powershells/Step89_InstallQt.ps1',
    'scripts/shells/win/install_powershells/Step94_InstallQtOfficial.ps1',
    'scripts/shells/win/install_powershells/Step99_InstallDeepSeek.ps1',
    'scripts/shells/win/install_powershells/Step100_InstallDeepSeekOCR.ps1',
    'scripts/shells/win/install_powershells/Step101_InstallQwen25.ps1',
    'scripts/shells/win/install_powershells/Step102_InstallNLLB200.ps1',
    'scripts/shells/win/install_powershells/Step104_InstallQwenCode.ps1',
    'scripts/shells/win/install_powershells/Step105_InstallArkCli.ps1',
    'scripts/shells/win/install_powershells/Step106_InstallZhipuCli.ps1',
    'scripts/shells/win/install_powershells/postinstall/WeChatInstallProcessor.ps1',
    'scripts/shells/win/install_powershells/postinstall/GoPostInstallProcessor.ps1',
    'scripts/shells/win/install_powershells/postinstall/JavaPostInstallProcessor.ps1',
    'scripts/shells/win/install_powershells/postinstall/NodePostInstallProcessor.ps1',
    'scripts/shells/win/install_powershells/postinstall/PhpPostInstallProcessor.ps1',
    'scripts/shells/win/install_powershells/postinstall/RubyPostInstallProcessor.ps1',
    'scripts/shells/win/install_powershells/postinstall/RustPostInstallProcessor.ps1',
    'scripts/shells/win/install_powershells/postinstall/WSLUpgradeProcessor.ps1',
    'scripts/shells/win/menu_itemshells/DevInstaller.ps1',
    'scripts/shells/win/menu_itemshells/InitializationManager.ps1',
    'scripts/shells/win/menu_itemshells/ScriptScanner.ps1',
    'scripts/shells/win/menu_itemshells/TestInstaller.ps1',
    'scripts/shells/win/menu_itemshells/WSLUbuntuManager.ps1',
    'scripts/shells/win/tools/ScriptProcessor.ps1'
)

## Dynamic configuration based on region to reduce complexity
# Function to determine base URL based on region preference
function Get-RepoBaseUrl {
    $globalVarDir = "$env:USERPROFILE\.core_node\.global_vars"
    $regionFile = Join-Path $globalVarDir "SELECTED_REGION"
    
    $selectedRegion = "Global"  # Default to Global if no preference set
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


