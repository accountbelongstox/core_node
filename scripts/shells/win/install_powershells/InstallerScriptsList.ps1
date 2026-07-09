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

#region Load Dependencies
# Get the directory of this script and resolve win_common path
$scriptDir = Split-Path -Parent $PSCommandPath
$winCommonDir = Join-Path (Split-Path -Parent $scriptDir) "win_common"
$globalVarsPath = Join-Path $winCommonDir "GlobalVars.ps1"

# Load GlobalVars.ps1 to get access to Get-GlobalVar and Set-GlobalVar
. $globalVarsPath
#endregion

# Centralized installer scripts list
# IMPORTANT: When adding new scripts to this list, maintain the index order sequence
# Scripts are executed in the order they appear in this array
# Always follow the existing numbering pattern (Step1_, Step2_, etc.)
#
# COMPATIBILITY NOTES:
# - Step80_InstallWSL.ps1: Enhanced with Windows 10/WSL1 compatibility support
#   - Automatically detects Windows version and WSL capabilities
#   - Enables required Windows features based on system version
#   - Upgrades WSL1 to WSL2 when supported
#   - Provides fallback installation methods for older systems

# Script filename variables - each script name defined only once
$SCRIPT_STEP1_INITIALIZE_BASE_DIRECTORIES = "Step1_InitializeBaseDirectories.ps1"
$SCRIPT_STEP2_SET_BASE_SETTINGS = "Step2_SetBaseSettings.ps1"
$SCRIPT_STEP3_INIT_WINGET = "Step3_InitWinget.ps1"
$SCRIPT_STEP4_INSTALL_NODEJS = "Step4_InstallNodeJS.ps1"
$SCRIPT_STEP5_INSTALL_GIT_SSH = "Step5_InstallGitSSH.ps1"
$SCRIPT_STEP6_INSTALL_GIT = "Step6_InstallGit.ps1"
$SCRIPT_STEP7_FIX_CORE_NODE_PROJECT_LOCATION = "Step7_FixCoreNodeProjectLocation.ps1"
$SCRIPT_STEP9_INSTALL_PYTHON = "Step9_InstallPython.ps1"
$SCRIPT_STEP17_INSTALL_FASTER_WHISPER = "Step17_InstallFasterWhisper.ps1"
$SCRIPT_STEP19_INSTALL_EDGE_TTS = "Step19_InstallEdgeTts.ps1"
$SCRIPT_STEP20_INSTALL_TTS_OFFLINE = "Step20_InstallTtsOffline.ps1"
$SCRIPT_STEP10_INSTALL_SCOOP_WITH_CHINA_MIRROR = "Step10_InstallScoopWithChinaMirror.ps1"
$SCRIPT_STEP11_EXTEND_WINDOWS_UPDATE = "Step11_ExtendWindowsUpdate.ps1"
$SCRIPT_STEP12_INSTALL_PHP = "Step12_InstallPHP.ps1"
$SCRIPT_STEP33_INSTALL_POSTGRESQL = "Step33_InstallPostgreSQL.ps1"
$SCRIPT_STEP13_SET_FILE_ASSOCIATIONS = "Step13_SetFileAssociations.ps1"
$SCRIPT_STEP14_DV = "Step14_DV.ps1"
$SCRIPT_STEP15_INSTALL_7IP_BASE = "Step15_Install7ipBase.ps1"
$SCRIPT_STEP16_INSTALL_APPLICATIONS = "Step16_InstallApplications.ps1"
$SCRIPT_STEP30_INSTALL_CHROME = "Step30_InstallChrome.ps1"
$SCRIPT_STEP31_INSTALL_PUPPETEER_PLUGINS = "Step31_InstallPuppeteerPlugins.ps1"
$SCRIPT_STEP32_INSTALL_SECURITY_TOOLS = "Step32_InstallSecurityTools.ps1"
$SCRIPT_STEP51_INSTALL_APK_TOOL = "Step51_InstallApkTool.ps1"
$SCRIPT_STEP60_INSTALL_ANDROID_STUDIO = "Step60_InstallAndroidStudio.ps1"
$SCRIPT_STEP61_INSTALL_ANDROID_PLATFORM_TOOLS = "Step61_InstallAndroidPlatformTools.ps1"
$SCRIPT_STEP70_INSTALL_FLUTTER = "Step70_InstallFlutter.ps1"
$SCRIPT_STEP84_INSTALL_WSL = "Step84_InstallWSL.ps1"
$SCRIPT_STEP85_INSTALL_WSL_UBUNTU24 = "Step85_InstallWSLUbuntu24.ps1"
$SCRIPT_STEP86_SET_ROOT_LOGIN_WSL_UBUNTU_DEBIAN = "Step86_SetRootLoginWSLUbuntuDebian.ps1"
$SCRIPT_STEP87_INSTALL_VISUAL_STUDIO = "Step87_InstallVisualStudio.ps1"
$SCRIPT_STEP88_INSTALL_QT_BUILD_TOOLS = "Step88_InstallQtBuildTools.ps1"
$SCRIPT_STEP89_INSTALL_QT = "Step89_InstallQt.ps1"
$SCRIPT_STEP94_INSTALL_QT_OFFICIAL = "Step94_InstallQtOfficial.ps1"
$SCRIPT_STEP99_INSTALL_DEEPSEEK = "Step99_InstallDeepSeek.ps1"
$SCRIPT_STEP100_INSTALL_DEEPSEEK_OCR = "Step100_InstallDeepSeekOCR.ps1"
$SCRIPT_STEP101_INSTALL_QWEN25 = "Step101_InstallQwen25.ps1"
$SCRIPT_STEP102_INSTALL_NLLB200 = "Step102_InstallNLLB200.ps1"
$SCRIPT_STEP103_INSTALL_NSSM = "Step103_InstallNSSM.ps1"
$SCRIPT_STEP104_INSTALL_QWEN_CODE = "Step104_InstallQwenCode.ps1"
$SCRIPT_STEP105_INSTALL_ARK_CLI = "Step105_InstallArkCli.ps1"
$SCRIPT_STEP106_INSTALL_ZHIPU_CLI = "Step106_InstallZhipuCli.ps1"

# Installer scripts mapping with key:val structure
# Key: Script identifier, Val: Actual script filename variable
$InstallerScriptsMap = @{
    "InitializeBaseDirectories" = $SCRIPT_STEP1_INITIALIZE_BASE_DIRECTORIES
    "SetBaseSettings" = $SCRIPT_STEP2_SET_BASE_SETTINGS
    "InitWinget" = $SCRIPT_STEP3_INIT_WINGET
    "InstallNodeJS" = $SCRIPT_STEP4_INSTALL_NODEJS
    "InstallGitSSH" = $SCRIPT_STEP5_INSTALL_GIT_SSH
    "InstallGit" = $SCRIPT_STEP6_INSTALL_GIT
    "FixCoreNodeProjectLocation" = $SCRIPT_STEP7_FIX_CORE_NODE_PROJECT_LOCATION
    "InstallPython" = $SCRIPT_STEP9_INSTALL_PYTHON
    "InstallFasterWhisper" = $SCRIPT_STEP17_INSTALL_FASTER_WHISPER
    "InstallEdgeTts" = $SCRIPT_STEP19_INSTALL_EDGE_TTS
    "InstallTtsOffline" = $SCRIPT_STEP20_INSTALL_TTS_OFFLINE
    "InstallScoopWithChinaMirror" = $SCRIPT_STEP10_INSTALL_SCOOP_WITH_CHINA_MIRROR
    "ExtendWindowsUpdate" = $SCRIPT_STEP11_EXTEND_WINDOWS_UPDATE
    "InstallPHP" = $SCRIPT_STEP12_INSTALL_PHP
    "InstallPostgreSQL" = $SCRIPT_STEP33_INSTALL_POSTGRESQL
    "SetFileAssociations" = $SCRIPT_STEP13_SET_FILE_ASSOCIATIONS
    "DV" = $SCRIPT_STEP14_DV
    "Install7ipBase" = $SCRIPT_STEP15_INSTALL_7IP_BASE
    "InstallApplications" = $SCRIPT_STEP16_INSTALL_APPLICATIONS
    "InstallChrome" = $SCRIPT_STEP30_INSTALL_CHROME
    "InstallPuppeteerPlugins" = $SCRIPT_STEP31_INSTALL_PUPPETEER_PLUGINS
    "InstallSecurityTools" = $SCRIPT_STEP32_INSTALL_SECURITY_TOOLS
    "InstallApkTool" = $SCRIPT_STEP51_INSTALL_APK_TOOL
    "InstallAndroidStudio" = $SCRIPT_STEP60_INSTALL_ANDROID_STUDIO
    "InstallAndroidPlatformTools" = $SCRIPT_STEP61_INSTALL_ANDROID_PLATFORM_TOOLS
    "InstallFlutter" = $SCRIPT_STEP70_INSTALL_FLUTTER
    "InstallWSL" = $SCRIPT_STEP84_INSTALL_WSL
    "InstallWSLUbuntu24" = $SCRIPT_STEP85_INSTALL_WSL_UBUNTU24
    "SetRootLoginWSLUbuntuDebian" = $SCRIPT_STEP86_SET_ROOT_LOGIN_WSL_UBUNTU_DEBIAN
    "InstallVisualStudio" = $SCRIPT_STEP87_INSTALL_VISUAL_STUDIO
    "InstallQtBuildTools" = $SCRIPT_STEP88_INSTALL_QT_BUILD_TOOLS
    "InstallQt" = $SCRIPT_STEP89_INSTALL_QT
    "InstallQtOfficial" = $SCRIPT_STEP94_INSTALL_QT_OFFICIAL
    "InstallDeepSeek" = $SCRIPT_STEP99_INSTALL_DEEPSEEK
    "InstallDeepSeekOCR" = $SCRIPT_STEP100_INSTALL_DEEPSEEK_OCR
    "InstallQwen25" = $SCRIPT_STEP101_INSTALL_QWEN25
    "InstallNLLB200" = $SCRIPT_STEP102_INSTALL_NLLB200
    "InstallNSSM" = $SCRIPT_STEP103_INSTALL_NSSM
    "InstallQwenCode" = $SCRIPT_STEP104_INSTALL_QWEN_CODE
    "InstallArkCli" = $SCRIPT_STEP105_INSTALL_ARK_CLI
    "InstallZhipuCli" = $SCRIPT_STEP106_INSTALL_ZHIPU_CLI
}

# Legacy array for backward compatibility - using variables
# IMPORTANT: This array defines the EXECUTION ORDER of installation scripts
# Step4_InstallNodeJS must run BEFORE Step5_InstallGitSSH because GitSSH depends on Node.js
# Step7_FixCoreNodeProjectLocation runs AFTER Step6_InstallGit to fix project location
# Step9_InstallPython must run BEFORE Step16_InstallApplications because Applications depend on pip
$InstallerScripts = @(
    $SCRIPT_STEP1_INITIALIZE_BASE_DIRECTORIES,
    $SCRIPT_STEP2_SET_BASE_SETTINGS,
    $SCRIPT_STEP3_INIT_WINGET,
    $SCRIPT_STEP4_INSTALL_NODEJS,
    $SCRIPT_STEP5_INSTALL_GIT_SSH,
    $SCRIPT_STEP6_INSTALL_GIT,
    $SCRIPT_STEP7_FIX_CORE_NODE_PROJECT_LOCATION,
    $SCRIPT_STEP9_INSTALL_PYTHON,
    $SCRIPT_STEP17_INSTALL_FASTER_WHISPER,
    $SCRIPT_STEP19_INSTALL_EDGE_TTS,
    $SCRIPT_STEP20_INSTALL_TTS_OFFLINE,
    $SCRIPT_STEP10_INSTALL_SCOOP_WITH_CHINA_MIRROR,
    $SCRIPT_STEP11_EXTEND_WINDOWS_UPDATE,
    $SCRIPT_STEP12_INSTALL_PHP,
    $SCRIPT_STEP33_INSTALL_POSTGRESQL,
    $SCRIPT_STEP13_SET_FILE_ASSOCIATIONS,
    $SCRIPT_STEP14_DV,
    $SCRIPT_STEP15_INSTALL_7IP_BASE,
    $SCRIPT_STEP16_INSTALL_APPLICATIONS,
    $SCRIPT_STEP30_INSTALL_CHROME,
    $SCRIPT_STEP31_INSTALL_PUPPETEER_PLUGINS,
    $SCRIPT_STEP32_INSTALL_SECURITY_TOOLS,
    $SCRIPT_STEP51_INSTALL_APK_TOOL,
    $SCRIPT_STEP60_INSTALL_ANDROID_STUDIO,
    $SCRIPT_STEP61_INSTALL_ANDROID_PLATFORM_TOOLS,
    $SCRIPT_STEP70_INSTALL_FLUTTER,
    $SCRIPT_STEP84_INSTALL_WSL,
    $SCRIPT_STEP85_INSTALL_WSL_UBUNTU24,
    $SCRIPT_STEP86_SET_ROOT_LOGIN_WSL_UBUNTU_DEBIAN,
    $SCRIPT_STEP87_INSTALL_VISUAL_STUDIO,
    $SCRIPT_STEP88_INSTALL_QT_BUILD_TOOLS,
    $SCRIPT_STEP89_INSTALL_QT,
    $SCRIPT_STEP94_INSTALL_QT_OFFICIAL,
    $SCRIPT_STEP99_INSTALL_DEEPSEEK,
    $SCRIPT_STEP100_INSTALL_DEEPSEEK_OCR,
    $SCRIPT_STEP101_INSTALL_QWEN25,
    $SCRIPT_STEP102_INSTALL_NLLB200,
    $SCRIPT_STEP103_INSTALL_NSSM,
    $SCRIPT_STEP104_INSTALL_QWEN_CODE,
    $SCRIPT_STEP105_INSTALL_ARK_CLI,
    $SCRIPT_STEP106_INSTALL_ZHIPU_CLI
)

# Function to get script filename by key
function Get-InstallerScriptName {
    param([string]$Key)
    if ($InstallerScriptsMap.ContainsKey($Key)) {
        return $InstallerScriptsMap[$Key]
    } else {
        Write-Warning "Script key '$Key' not found in InstallerScriptsMap"
        return $null
    }
}

# Function to get all initialization scripts (first 7 steps including Node.js, FixLocation, and Python)
# Execution order: Step1 -> Step2 -> Step3 -> Step4(Node.js) -> Step5(GitSSH) -> Step6(Git+Clone) -> Step7(FixLocation) -> Step9(Python)
function Get-InitializationScripts {
    $initKeys = @("InitializeBaseDirectories", "SetBaseSettings", "InitWinget", "InstallNodeJS", "InstallGitSSH", "InstallGit", "FixCoreNodeProjectLocation", "InstallPython")
    $scripts = @()
    foreach ($key in $initKeys) {
        $scriptName = Get-InstallerScriptName $key
        if ($scriptName) {
            $scripts += $scriptName
        }
    }
    return $scripts
}