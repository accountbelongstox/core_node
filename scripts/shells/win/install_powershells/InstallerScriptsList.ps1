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
$SCRIPT_STEP7_INSTALL_SCOOP_WITH_CHINA_MIRROR = "Step7_InstallScoopWithChinaMirror.ps1"
$SCRIPT_STEP8_EXTEND_WINDOWS_UPDATE = "Step8_ExtendWindowsUpdate.ps1"
$SCRIPT_STEP8_INSTALL_PHP = "Step8_InstallPHP.ps1"
$SCRIPT_STEP9_DV = "Step9_DV.ps1"
$SCRIPT_STEP10_SET_FILE_ASSOCIATIONS = "Step10_SetFileAssociations.ps1"
$SCRIPT_STEP12_INSTALL_7IP_BASE = "Step12_Install7ipBase.ps1"
$SCRIPT_STEP13_INSTALL_APPLICATIONS = "Step13_InstallApplications.ps1"
$SCRIPT_STEP14_CHECK_CORE_NODE_PROJECT = "Step14_CheckCoreNodeProject.ps1"
$SCRIPT_STEP27_INSTALL_CHROME = "Step27_InstallChrome.ps1"
$SCRIPT_STEP28_INSTALL_PUPPETEER_PLUGINS = "Step28_InstallPuppeteerPlugins.ps1"
$SCRIPT_STEP48_INSTALL_APK_TOOL = "Step48_InstallApkTool.ps1"
$SCRIPT_STEP57_INSTALL_ANDROID_STUDIO = "Step57_InstallAndroidStudio.ps1"
$SCRIPT_STEP58_INSTALL_ANDROID_PLATFORM_TOOLS = "Step58_InstallAndroidPlatformTools.ps1"
$SCRIPT_STEP67_INSTALL_FLUTTER = "Step67_InstallFlutter.ps1"
$SCRIPT_STEP81_INSTALL_WSL = "Step81_InstallWSL.ps1"
$SCRIPT_STEP82_INSTALL_WSL_UBUNTU24 = "Step82_InstallWSLUbuntu24.ps1"
$SCRIPT_STEP83_SET_ROOT_LOGIN_WSL_UBUNTU_DEBIAN = "Step83_SetRootLoginWSLUbuntuDebian.ps1"
$SCRIPT_STEP84_INSTALL_VISUAL_STUDIO = "Step84_InstallVisualStudio.ps1"
$SCRIPT_STEP85_INSTALL_QT_BUILD_TOOLS = "Step85_InstallQtBuildTools.ps1"
$SCRIPT_STEP86_INSTALL_QT = "Step86_InstallQt.ps1"
$SCRIPT_STEP91_INSTALL_QT_OFFICIAL = "Step91_InstallQtOfficial.ps1"
$SCRIPT_STEP96_INSTALL_DEEPSEEK = "Step96_InstallDeepSeek.ps1"
$SCRIPT_STEP97_INSTALL_DEEPSEEK_OCR = "Step97_InstallDeepSeekOCR.ps1"
$SCRIPT_STEP98_INSTALL_QWEN25 = "Step98_InstallQwen25.ps1"
$SCRIPT_STEP99_INSTALL_NLLB200 = "Step99_InstallNLLB200.ps1"

# Installer scripts mapping with key:val structure
# Key: Script identifier, Val: Actual script filename variable
$InstallerScriptsMap = @{
    "InitializeBaseDirectories" = $SCRIPT_STEP1_INITIALIZE_BASE_DIRECTORIES
    "SetBaseSettings" = $SCRIPT_STEP2_SET_BASE_SETTINGS
    "InitWinget" = $SCRIPT_STEP3_INIT_WINGET
    "InstallNodeJS" = $SCRIPT_STEP4_INSTALL_NODEJS
    "InstallGitSSH" = $SCRIPT_STEP5_INSTALL_GIT_SSH
    "InstallGit" = $SCRIPT_STEP6_INSTALL_GIT
    "InstallScoopWithChinaMirror" = $SCRIPT_STEP7_INSTALL_SCOOP_WITH_CHINA_MIRROR
    "ExtendWindowsUpdate" = $SCRIPT_STEP8_EXTEND_WINDOWS_UPDATE
    "InstallPHP" = $SCRIPT_STEP8_INSTALL_PHP
    "DV" = $SCRIPT_STEP9_DV
    "SetFileAssociations" = $SCRIPT_STEP10_SET_FILE_ASSOCIATIONS
    "Install7ipBase" = $SCRIPT_STEP12_INSTALL_7IP_BASE
    "InstallApplications" = $SCRIPT_STEP13_INSTALL_APPLICATIONS
    "CheckCoreNodeProject" = $SCRIPT_STEP14_CHECK_CORE_NODE_PROJECT
    "InstallChrome" = $SCRIPT_STEP27_INSTALL_CHROME
    "InstallPuppeteerPlugins" = $SCRIPT_STEP28_INSTALL_PUPPETEER_PLUGINS
    "InstallApkTool" = $SCRIPT_STEP48_INSTALL_APK_TOOL
    "InstallAndroidStudio" = $SCRIPT_STEP57_INSTALL_ANDROID_STUDIO
    "InstallAndroidPlatformTools" = $SCRIPT_STEP58_INSTALL_ANDROID_PLATFORM_TOOLS
    "InstallFlutter" = $SCRIPT_STEP67_INSTALL_FLUTTER
    "InstallWSL" = $SCRIPT_STEP81_INSTALL_WSL
    "InstallWSLUbuntu24" = $SCRIPT_STEP82_INSTALL_WSL_UBUNTU24
    "SetRootLoginWSLUbuntuDebian" = $SCRIPT_STEP83_SET_ROOT_LOGIN_WSL_UBUNTU_DEBIAN
    "InstallVisualStudio" = $SCRIPT_STEP84_INSTALL_VISUAL_STUDIO
    "InstallQtBuildTools" = $SCRIPT_STEP85_INSTALL_QT_BUILD_TOOLS
    "InstallQt" = $SCRIPT_STEP86_INSTALL_QT
    "InstallQtOfficial" = $SCRIPT_STEP91_INSTALL_QT_OFFICIAL
    "InstallDeepSeek" = $SCRIPT_STEP96_INSTALL_DEEPSEEK
    "InstallDeepSeekOCR" = $SCRIPT_STEP97_INSTALL_DEEPSEEK_OCR
    "InstallQwen25" = $SCRIPT_STEP98_INSTALL_QWEN25
    "InstallNLLB200" = $SCRIPT_STEP99_INSTALL_NLLB200
}

# Legacy array for backward compatibility - using variables
# IMPORTANT: This array defines the EXECUTION ORDER of installation scripts
# Step4_InstallNodeJS must run BEFORE Step5_InstallGitSSH because GitSSH depends on Node.js
$InstallerScripts = @(
    $SCRIPT_STEP1_INITIALIZE_BASE_DIRECTORIES,
    $SCRIPT_STEP2_SET_BASE_SETTINGS,
    $SCRIPT_STEP3_INIT_WINGET,
    $SCRIPT_STEP4_INSTALL_NODEJS,
    $SCRIPT_STEP5_INSTALL_GIT_SSH,
    $SCRIPT_STEP6_INSTALL_GIT,
    $SCRIPT_STEP7_INSTALL_SCOOP_WITH_CHINA_MIRROR,
    $SCRIPT_STEP8_EXTEND_WINDOWS_UPDATE,
    $SCRIPT_STEP8_INSTALL_PHP,
    $SCRIPT_STEP9_DV,
    $SCRIPT_STEP10_SET_FILE_ASSOCIATIONS,
    $SCRIPT_STEP12_INSTALL_7IP_BASE,
    $SCRIPT_STEP13_INSTALL_APPLICATIONS,
    $SCRIPT_STEP14_CHECK_CORE_NODE_PROJECT,
    $SCRIPT_STEP27_INSTALL_CHROME,
    $SCRIPT_STEP28_INSTALL_PUPPETEER_PLUGINS,
    $SCRIPT_STEP48_INSTALL_APK_TOOL,
    $SCRIPT_STEP57_INSTALL_ANDROID_STUDIO,
    $SCRIPT_STEP58_INSTALL_ANDROID_PLATFORM_TOOLS,
    $SCRIPT_STEP67_INSTALL_FLUTTER,
    $SCRIPT_STEP81_INSTALL_WSL,
    $SCRIPT_STEP82_INSTALL_WSL_UBUNTU24,
    $SCRIPT_STEP83_SET_ROOT_LOGIN_WSL_UBUNTU_DEBIAN,
    $SCRIPT_STEP84_INSTALL_VISUAL_STUDIO,
    $SCRIPT_STEP85_INSTALL_QT_BUILD_TOOLS,
    $SCRIPT_STEP86_INSTALL_QT,
    $SCRIPT_STEP91_INSTALL_QT_OFFICIAL,
    $SCRIPT_STEP96_INSTALL_DEEPSEEK,
    $SCRIPT_STEP97_INSTALL_DEEPSEEK_OCR,
    $SCRIPT_STEP98_INSTALL_QWEN25,
    $SCRIPT_STEP99_INSTALL_NLLB200
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

# Function to get all initialization scripts (first 6 steps including Node.js)
# Execution order: Step1 -> Step2 -> Step3 -> Step4(Node.js) -> Step5(GitSSH) -> Step6(Git+Clone)
function Get-InitializationScripts {
    $initKeys = @("InitializeBaseDirectories", "SetBaseSettings", "InitWinget", "InstallNodeJS", "InstallGitSSH", "InstallGit")
    $scripts = @()
    foreach ($key in $initKeys) {
        $scriptName = Get-InstallerScriptName $key
        if ($scriptName) {
            $scripts += $scriptName
        }
    }
    return $scripts
}