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
$SCRIPT_STEP4_INSTALL_GIT_SSH = "Step4_InstallGitSSH.ps1"
$SCRIPT_STEP5_INSTALL_GIT = "Step5_InstallGit.ps1"
$SCRIPT_STEP6_INSTALL_SCOOP_WITH_CHINA_MIRROR = "Step6_InstallScoopWithChinaMirror.ps1"
$SCRIPT_STEP8_DV = "Step8_DV.ps1"
$SCRIPT_STEP9_SET_FILE_ASSOCIATIONS = "Step9_SetFileAssociations.ps1"
$SCRIPT_STEP11_INSTALL_7IP_BASE = "Step11_Install7ipBase.ps1"
$SCRIPT_STEP12_INSTALL_APPLICATIONS = "Step12_InstallApplications.ps1"
$SCRIPT_STEP13_CHECK_CORE_NODE_PROJECT = "Step13_CheckCoreNodeProject.ps1"
$SCRIPT_STEP26_INSTALL_CHROME = "Step26_InstallChrome.ps1"
$SCRIPT_STEP47_INSTALL_APK_TOOL = "Step47_InstallApkTool.ps1"
$SCRIPT_STEP56_INSTALL_ANDROID_STUDIO = "Step56_InstallAndroidStudio.ps1"
$SCRIPT_STEP57_INSTALL_ANDROID_PLATFORM_TOOLS = "Step57_InstallAndroidPlatformTools.ps1"
$SCRIPT_STEP66_INSTALL_FLUTTER = "Step66_InstallFlutter.ps1"
$SCRIPT_STEP80_INSTALL_WSL = "Step80_InstallWSL.ps1"
$SCRIPT_STEP81_INSTALL_WSL_UBUNTU24 = "Step81_InstallWSLUbuntu24.ps1"
$SCRIPT_STEP82_SET_ROOT_LOGIN_WSL_UBUNTU_DEBIAN = "Step82_SetRootLoginWSLUbuntuDebian.ps1"
$SCRIPT_STEP83_INSTALL_VISUAL_STUDIO = "Step83_InstallVisualStudio.ps1"
$SCRIPT_STEP84_INSTALL_QT_BUILD_TOOLS = "Step84_InstallQtBuildTools.ps1"
$SCRIPT_STEP85_INSTALL_QT = "Step85_InstallQt.ps1"

# Installer scripts mapping with key:val structure
# Key: Script identifier, Val: Actual script filename variable
$InstallerScriptsMap = @{
    "InitializeBaseDirectories" = $SCRIPT_STEP1_INITIALIZE_BASE_DIRECTORIES
    "SetBaseSettings" = $SCRIPT_STEP2_SET_BASE_SETTINGS
    "InitWinget" = $SCRIPT_STEP3_INIT_WINGET
    "InstallGitSSH" = $SCRIPT_STEP4_INSTALL_GIT_SSH
    "InstallGit" = $SCRIPT_STEP5_INSTALL_GIT
    "InstallScoopWithChinaMirror" = $SCRIPT_STEP6_INSTALL_SCOOP_WITH_CHINA_MIRROR
    "DV" = $SCRIPT_STEP8_DV
    "SetFileAssociations" = $SCRIPT_STEP9_SET_FILE_ASSOCIATIONS
    "Install7ipBase" = $SCRIPT_STEP11_INSTALL_7IP_BASE
    "InstallApplications" = $SCRIPT_STEP12_INSTALL_APPLICATIONS
    "CheckCoreNodeProject" = $SCRIPT_STEP13_CHECK_CORE_NODE_PROJECT
    "InstallChrome" = $SCRIPT_STEP26_INSTALL_CHROME
    "InstallApkTool" = $SCRIPT_STEP47_INSTALL_APK_TOOL
    "InstallAndroidStudio" = $SCRIPT_STEP56_INSTALL_ANDROID_STUDIO
    "InstallAndroidPlatformTools" = $SCRIPT_STEP57_INSTALL_ANDROID_PLATFORM_TOOLS
    "InstallFlutter" = $SCRIPT_STEP66_INSTALL_FLUTTER
    "InstallWSL" = $SCRIPT_STEP80_INSTALL_WSL
    "InstallWSLUbuntu24" = $SCRIPT_STEP81_INSTALL_WSL_UBUNTU24
    "SetRootLoginWSLUbuntuDebian" = $SCRIPT_STEP82_SET_ROOT_LOGIN_WSL_UBUNTU_DEBIAN
    "InstallVisualStudio" = $SCRIPT_STEP83_INSTALL_VISUAL_STUDIO
    "InstallQtBuildTools" = $SCRIPT_STEP84_INSTALL_QT_BUILD_TOOLS
    "InstallQt" = $SCRIPT_STEP85_INSTALL_QT
}

# Legacy array for backward compatibility - using variables
$InstallerScripts = @(
    $SCRIPT_STEP1_INITIALIZE_BASE_DIRECTORIES,
    $SCRIPT_STEP2_SET_BASE_SETTINGS,
    $SCRIPT_STEP3_INIT_WINGET,
    $SCRIPT_STEP4_INSTALL_GIT_SSH,
    $SCRIPT_STEP5_INSTALL_GIT,
    $SCRIPT_STEP6_INSTALL_SCOOP_WITH_CHINA_MIRROR,
    $SCRIPT_STEP8_DV,
    $SCRIPT_STEP9_SET_FILE_ASSOCIATIONS,
    $SCRIPT_STEP11_INSTALL_7IP_BASE,
    $SCRIPT_STEP12_INSTALL_APPLICATIONS,
    $SCRIPT_STEP13_CHECK_CORE_NODE_PROJECT,
    $SCRIPT_STEP26_INSTALL_CHROME,
    $SCRIPT_STEP47_INSTALL_APK_TOOL,
    $SCRIPT_STEP56_INSTALL_ANDROID_STUDIO,
    $SCRIPT_STEP57_INSTALL_ANDROID_PLATFORM_TOOLS,
    $SCRIPT_STEP66_INSTALL_FLUTTER,
    $SCRIPT_STEP80_INSTALL_WSL,
    $SCRIPT_STEP81_INSTALL_WSL_UBUNTU24,
    $SCRIPT_STEP82_SET_ROOT_LOGIN_WSL_UBUNTU_DEBIAN,
    $SCRIPT_STEP83_INSTALL_VISUAL_STUDIO,
    $SCRIPT_STEP84_INSTALL_QT_BUILD_TOOLS,
    $SCRIPT_STEP85_INSTALL_QT
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

# Function to get all initialization scripts (first 5 steps)
function Get-InitializationScripts {
    $initKeys = @("InitializeBaseDirectories", "SetBaseSettings", "InitWinget", "InstallGitSSH", "InstallGit")
    $scripts = @()
    foreach ($key in $initKeys) {
        $scriptName = Get-InstallerScriptName $key
        if ($scriptName) {
            $scripts += $scriptName
        }
    }
    return $scripts
}