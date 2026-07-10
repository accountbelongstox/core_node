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
$scriptDir = Split-Path -Parent $PSCommandPath
$winCommonDir = Join-Path (Split-Path -Parent $scriptDir) "win_common"
$globalVarsPath = Join-Path $winCommonDir "GlobalVars.ps1"
. $globalVarsPath
#endregion

# Script filename variables - each script name defined only once
$SCRIPT_STEP1_INITIALIZE_BASE_DIRECTORIES = "Step1_InitializeBaseDirectories.ps1"
$SCRIPT_STEP2_SET_BASE_SETTINGS = "Step2_SetBaseSettings.ps1"
$SCRIPT_STEP3_INIT_WINGET = "Step3_InitWinget.ps1"
$SCRIPT_STEP4_INSTALL_NODEJS = "Step4_InstallNodeJS.ps1"
$SCRIPT_STEP5_INSTALL_GIT_SSH = "Step5_InstallGitSSH.ps1"
$SCRIPT_STEP6_INSTALL_GIT = "Step6_InstallGit.ps1"
$SCRIPT_STEP7_FIX_CORE_NODE_PROJECT_LOCATION = "Step7_FixCoreNodeProjectLocation.ps1"
$SCRIPT_STEP8_INSTALL_PYTHON = "Step8_InstallPython.ps1"
$SCRIPT_STEP9_INSTALL_CUDA_NVIDIA_PREREQ = "Step9_InstallCudaNvidiaPrereq.ps1"
$SCRIPT_STEP10_INSTALL_PYTHON_PREREQ_PACKAGES = "Step10_InstallPythonPrereqPackages.ps1"
$SCRIPT_STEP11_INSTALL_FASTER_WHISPER = "Step11_InstallFasterWhisper.ps1"
$SCRIPT_STEP12_INSTALL_EDGE_TTS = "Step12_InstallEdgeTts.ps1"
$SCRIPT_STEP13_INSTALL_TTS_OFFLINE = "Step13_InstallTtsOffline.ps1"
$SCRIPT_STEP14_INSTALL_SCOOP_WITH_CHINA_MIRROR = "Step14_InstallScoopWithChinaMirror.ps1"
$SCRIPT_STEP15_EXTEND_WINDOWS_UPDATE = "Step15_ExtendWindowsUpdate.ps1"
$SCRIPT_STEP16_INSTALL_PHP = "Step16_InstallPHP.ps1"
$SCRIPT_STEP17_INSTALL_POSTGRESQL = "Step17_InstallPostgreSQL.ps1"
$SCRIPT_STEP18_SET_FILE_ASSOCIATIONS = "Step18_SetFileAssociations.ps1"
$SCRIPT_STEP19_DV = "Step19_DV.ps1"
$SCRIPT_STEP20_INSTALL_7IP_BASE = "Step20_Install7ipBase.ps1"
$SCRIPT_STEP21_INSTALL_APPLICATIONS = "Step21_InstallApplications.ps1"
$SCRIPT_STEP22_INSTALL_CHROME = "Step22_InstallChrome.ps1"
$SCRIPT_STEP23_INSTALL_PUPPETEER_PLUGINS = "Step23_InstallPuppeteerPlugins.ps1"
$SCRIPT_STEP24_INSTALL_SECURITY_TOOLS = "Step24_InstallSecurityTools.ps1"
$SCRIPT_STEP25_INSTALL_APK_TOOL = "Step25_InstallApkTool.ps1"
$SCRIPT_STEP26_INSTALL_ANDROID_STUDIO = "Step26_InstallAndroidStudio.ps1"
$SCRIPT_STEP27_INSTALL_ANDROID_PLATFORM_TOOLS = "Step27_InstallAndroidPlatformTools.ps1"
$SCRIPT_STEP28_INSTALL_FLUTTER = "Step28_InstallFlutter.ps1"
$SCRIPT_STEP29_INSTALL_WSL = "Step29_InstallWSL.ps1"
$SCRIPT_STEP30_INSTALL_WSL_UBUNTU24 = "Step30_InstallWSLUbuntu24.ps1"
$SCRIPT_STEP31_SET_ROOT_LOGIN_WSL_UBUNTU_DEBIAN = "Step31_SetRootLoginWSLUbuntuDebian.ps1"
$SCRIPT_STEP32_INSTALL_VISUAL_STUDIO = "Step32_InstallVisualStudio.ps1"
$SCRIPT_STEP33_INSTALL_QT_BUILD_TOOLS = "Step33_InstallQtBuildTools.ps1"
$SCRIPT_STEP34_INSTALL_QT = "Step34_InstallQt.ps1"
$SCRIPT_STEP35_INSTALL_QT_OFFICIAL = "Step35_InstallQtOfficial.ps1"
$SCRIPT_STEP36_INSTALL_DEEPSEEK = "Step36_InstallDeepSeek.ps1"
$SCRIPT_STEP37_INSTALL_DEEPSEEK_OCR = "Step37_InstallDeepSeekOCR.ps1"
$SCRIPT_STEP38_INSTALL_QWEN25 = "Step38_InstallQwen25.ps1"
$SCRIPT_STEP39_INSTALL_NLLB200 = "Step39_InstallNLLB200.ps1"
$SCRIPT_STEP40_INSTALL_NSSM = "Step40_InstallNSSM.ps1"

$InstallerScriptsMap = @{
    "InitializeBaseDirectories" = $SCRIPT_STEP1_INITIALIZE_BASE_DIRECTORIES
    "SetBaseSettings" = $SCRIPT_STEP2_SET_BASE_SETTINGS
    "InitWinget" = $SCRIPT_STEP3_INIT_WINGET
    "InstallNodeJS" = $SCRIPT_STEP4_INSTALL_NODEJS
    "InstallGitSSH" = $SCRIPT_STEP5_INSTALL_GIT_SSH
    "InstallGit" = $SCRIPT_STEP6_INSTALL_GIT
    "FixCoreNodeProjectLocation" = $SCRIPT_STEP7_FIX_CORE_NODE_PROJECT_LOCATION
    "InstallPython" = $SCRIPT_STEP8_INSTALL_PYTHON
    "InstallCudaNvidiaPrereq" = $SCRIPT_STEP9_INSTALL_CUDA_NVIDIA_PREREQ
    "InstallPythonPrereqPackages" = $SCRIPT_STEP10_INSTALL_PYTHON_PREREQ_PACKAGES
    "InstallFasterWhisper" = $SCRIPT_STEP11_INSTALL_FASTER_WHISPER
    "InstallEdgeTts" = $SCRIPT_STEP12_INSTALL_EDGE_TTS
    "InstallTtsOffline" = $SCRIPT_STEP13_INSTALL_TTS_OFFLINE
    "InstallScoopWithChinaMirror" = $SCRIPT_STEP14_INSTALL_SCOOP_WITH_CHINA_MIRROR
    "ExtendWindowsUpdate" = $SCRIPT_STEP15_EXTEND_WINDOWS_UPDATE
    "InstallPHP" = $SCRIPT_STEP16_INSTALL_PHP
    "InstallPostgreSQL" = $SCRIPT_STEP17_INSTALL_POSTGRESQL
    "SetFileAssociations" = $SCRIPT_STEP18_SET_FILE_ASSOCIATIONS
    "DV" = $SCRIPT_STEP19_DV
    "Install7ipBase" = $SCRIPT_STEP20_INSTALL_7IP_BASE
    "InstallApplications" = $SCRIPT_STEP21_INSTALL_APPLICATIONS
    "InstallChrome" = $SCRIPT_STEP22_INSTALL_CHROME
    "InstallPuppeteerPlugins" = $SCRIPT_STEP23_INSTALL_PUPPETEER_PLUGINS
    "InstallSecurityTools" = $SCRIPT_STEP24_INSTALL_SECURITY_TOOLS
    "InstallApkTool" = $SCRIPT_STEP25_INSTALL_APK_TOOL
    "InstallAndroidStudio" = $SCRIPT_STEP26_INSTALL_ANDROID_STUDIO
    "InstallAndroidPlatformTools" = $SCRIPT_STEP27_INSTALL_ANDROID_PLATFORM_TOOLS
    "InstallFlutter" = $SCRIPT_STEP28_INSTALL_FLUTTER
    "InstallWSL" = $SCRIPT_STEP29_INSTALL_WSL
    "InstallWSLUbuntu24" = $SCRIPT_STEP30_INSTALL_WSL_UBUNTU24
    "SetRootLoginWSLUbuntuDebian" = $SCRIPT_STEP31_SET_ROOT_LOGIN_WSL_UBUNTU_DEBIAN
    "InstallVisualStudio" = $SCRIPT_STEP32_INSTALL_VISUAL_STUDIO
    "InstallQtBuildTools" = $SCRIPT_STEP33_INSTALL_QT_BUILD_TOOLS
    "InstallQt" = $SCRIPT_STEP34_INSTALL_QT
    "InstallQtOfficial" = $SCRIPT_STEP35_INSTALL_QT_OFFICIAL
    "InstallDeepSeek" = $SCRIPT_STEP36_INSTALL_DEEPSEEK
    "InstallDeepSeekOCR" = $SCRIPT_STEP37_INSTALL_DEEPSEEK_OCR
    "InstallQwen25" = $SCRIPT_STEP38_INSTALL_QWEN25
    "InstallNLLB200" = $SCRIPT_STEP39_INSTALL_NLLB200
    "InstallNSSM" = $SCRIPT_STEP40_INSTALL_NSSM
}

# Execution order (Step8-13: Python -> CUDA -> AI prereq -> TTS/STT stack)
$InstallerScripts = @(
    $SCRIPT_STEP1_INITIALIZE_BASE_DIRECTORIES,
    $SCRIPT_STEP2_SET_BASE_SETTINGS,
    $SCRIPT_STEP3_INIT_WINGET,
    $SCRIPT_STEP4_INSTALL_NODEJS,
    $SCRIPT_STEP5_INSTALL_GIT_SSH,
    $SCRIPT_STEP6_INSTALL_GIT,
    $SCRIPT_STEP7_FIX_CORE_NODE_PROJECT_LOCATION,
    $SCRIPT_STEP8_INSTALL_PYTHON,
    $SCRIPT_STEP9_INSTALL_CUDA_NVIDIA_PREREQ,
    $SCRIPT_STEP10_INSTALL_PYTHON_PREREQ_PACKAGES,
    $SCRIPT_STEP11_INSTALL_FASTER_WHISPER,
    $SCRIPT_STEP12_INSTALL_EDGE_TTS,
    $SCRIPT_STEP13_INSTALL_TTS_OFFLINE,
    $SCRIPT_STEP14_INSTALL_SCOOP_WITH_CHINA_MIRROR,
    $SCRIPT_STEP15_EXTEND_WINDOWS_UPDATE,
    $SCRIPT_STEP16_INSTALL_PHP,
    $SCRIPT_STEP17_INSTALL_POSTGRESQL,
    $SCRIPT_STEP18_SET_FILE_ASSOCIATIONS,
    $SCRIPT_STEP19_DV,
    $SCRIPT_STEP20_INSTALL_7IP_BASE,
    $SCRIPT_STEP21_INSTALL_APPLICATIONS,
    $SCRIPT_STEP22_INSTALL_CHROME,
    $SCRIPT_STEP23_INSTALL_PUPPETEER_PLUGINS,
    $SCRIPT_STEP24_INSTALL_SECURITY_TOOLS,
    $SCRIPT_STEP25_INSTALL_APK_TOOL,
    $SCRIPT_STEP26_INSTALL_ANDROID_STUDIO,
    $SCRIPT_STEP27_INSTALL_ANDROID_PLATFORM_TOOLS,
    $SCRIPT_STEP28_INSTALL_FLUTTER,
    $SCRIPT_STEP29_INSTALL_WSL,
    $SCRIPT_STEP30_INSTALL_WSL_UBUNTU24,
    $SCRIPT_STEP31_SET_ROOT_LOGIN_WSL_UBUNTU_DEBIAN,
    $SCRIPT_STEP32_INSTALL_VISUAL_STUDIO,
    $SCRIPT_STEP33_INSTALL_QT_BUILD_TOOLS,
    $SCRIPT_STEP34_INSTALL_QT,
    $SCRIPT_STEP35_INSTALL_QT_OFFICIAL,
    $SCRIPT_STEP36_INSTALL_DEEPSEEK,
    $SCRIPT_STEP37_INSTALL_DEEPSEEK_OCR,
    $SCRIPT_STEP38_INSTALL_QWEN25,
    $SCRIPT_STEP39_INSTALL_NLLB200,
    $SCRIPT_STEP40_INSTALL_NSSM
)

function Get-InstallerScriptName {
    param([string]$Key)
    if ($InstallerScriptsMap.ContainsKey($Key)) {
        return $InstallerScriptsMap[$Key]
    }
    Write-Warning "Script key '$Key' not found in InstallerScriptsMap"
    return $null
}

function Get-InitializationScripts {
    $initKeys = @("InitializeBaseDirectories", "SetBaseSettings", "InitWinget", "InstallNodeJS", "InstallGitSSH", "InstallGit", "FixCoreNodeProjectLocation", "InstallPython")
    $scripts = @()
    foreach ($key in $initKeys) {
        $scriptName = Get-InstallerScriptName $key
        if ($scriptName) { $scripts += $scriptName }
    }
    return $scripts
}
