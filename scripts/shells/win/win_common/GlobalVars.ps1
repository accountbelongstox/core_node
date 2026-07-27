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

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$sharedCacheEnvPath = Join-Path $PSScriptRoot 'SharedCacheEnv.ps1'
$sharedCacheLoaded = Get-Variable -Name 'PycoreSharedCacheEnvLoaded' -Scope Script -ErrorAction SilentlyContinue
. (Join-Path $PSScriptRoot 'AiRuntimePolicy.ps1')

function Test-AdminPrivileges {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
$systemName = "win"
$winName = "Windows"
$osInfo = Get-CimInstance Win32_OperatingSystem
$winVer = $osInfo.Version
$winBuild = [int]$osInfo.BuildNumber

$Global:IS_RUN_ADMIN = Test-AdminPrivileges

if ($winBuild -ge 22000) {
    $systemName = "win11"
    $winName = "Windows 11"
    $Global:isWin11 = $true
    $Global:isWin10 = $false
}
elseif ($winVer.StartsWith("10.0")) {
    $systemName = "win10"
    $winName = "Windows 10"
    $Global:isWin11 = $false
    $Global:isWin10 = $true
}
elseif ($winVer.StartsWith("6.3")) {
    $systemName = "win_8"
    $winName = "Windows 8.1"
    $Global:isWin11 = $false
    $Global:isWin10 = $false
}
elseif ($winVer.StartsWith("6.2")) {
    $systemName = "win_8"
    $winName = "Windows 8"
    $Global:isWin11 = $false
    $Global:isWin10 = $false
}
elseif ($winVer.StartsWith("6.1")) {
    $systemName = "win_7"
    $winName = "Windows 7"
    $Global:isWin11 = $false
    $Global:isWin10 = $false
}
else {
    $systemName = "win"
    $winName = "Windows"
    $Global:isWin11 = $false
    $Global:isWin10 = $false
}
$Global:supportedWin = $Global:isWin11 -or $Global:isWin10

# Dynamically determine the core node root directory
# This script is located at: scripts/shells/win/win_common/GlobalVars.ps1
# So we need to go up 4 levels to reach the root directory
try {
    $scriptDir = $PSScriptRoot
    $candidateCore = (Get-Item $scriptDir).Parent.Parent.Parent.Parent.FullName
    if ($candidateCore -and (Test-Path (Join-Path $candidateCore 'scripts'))) {
        $Global:BASE_DIR = $candidateCore
    } else {
        # Fallback: try to find the root by looking for package.json or main.js
        $currentDir = $scriptDir
        while ($currentDir -and $currentDir -ne (Split-Path $currentDir -Parent)) {
            if ((Test-Path (Join-Path $currentDir 'package.json')) -or (Test-Path (Join-Path $currentDir 'main.js'))) {
                $Global:BASE_DIR = $currentDir
                break
            }
            $currentDir = Split-Path $currentDir -Parent
        }
        if (-not $Global:BASE_DIR) {
            throw "Cannot determine core node root directory"
        }
    }
} catch {
    throw "Failed to determine core node root directory: $($_.Exception.Message)"
}

$Global:CORE_NODE_DIR = $Global:BASE_DIR
$Global:CORE_NODE_SCRIPTS_DIR = Join-Path $BASE_DIR "scripts"

# Backup configuration
$Global:BACKUP_PARENT_DIR = Split-Path $Global:BASE_DIR -Parent
$Global:BACKUP_NAME_PREFIX = "core_node"

# Check if current script is running from BASE_DIR or its subdirectories
$Global:IS_RUNNING_FROM_BASE_DIR = $PSScriptRoot -like "$Global:BASE_DIR*"
$Global:IS_RUNNING_FROM_BASE_DIR_SUBDIR = $PSScriptRoot -like "$Global:BASE_DIR\*"  
$Global:APPS_DIR = Join-Path $BASE_DIR "apps"
$Global:TEMP_DIR = "D:\.tmp"
$Global:DOWNLOADS_DIR = Join-Path $TEMP_DIR "Downloads"
$Global:LOGS_DIR = Join-Path $TEMP_DIR ".logs"
$Global:LOG_FILE = Join-Path $LOGS_DIR "devops_setup.log"
$Global:STEP_COUNT = 1

# Debug Configuration
$Global:DEBUG_MODE = $true  # Set to $false to disable debug output
$Global:DEBUG_PREFIX = "[DEBUG]"

# Execution Mode Configuration
$Global:EXECUTION_MODE = "PROJECT"  # Default to PROJECT mode, will be set by InitializationManager.ps1

# Desktop Cleanup Configuration
$Global:AGGRESSIVE_CLEANUP_ENABLED = $false  # Set to $true to enable aggressive desktop cleanup

$Global:LANG_COMPILER_DIR = "D:\.dev_$systemName"
$Global:WINENVS_DIR = ".winenvs"  # Windows environment scripts directory name
$Global:APP_INSTALL_DIR = "D:\applications"
$Global:CURSOR_INSTALL_DIR = Join-Path $Global:APP_INSTALL_DIR "cursor"
$Global:WEIXIN_INSTALL_DIR = "$Global:APP_INSTALL_DIR\Weixin"
$Global:WEIXIN_EXE_PATH = Join-Path $Global:WEIXIN_INSTALL_DIR "Weixin.exe"
$Global:QQ_INSTALL_DIR = "$Global:APP_INSTALL_DIR\QQ"
$Global:QQ_EXE_PATH = Join-Path $Global:QQ_INSTALL_DIR "QQ.exe"
$Global:PROJECT_ROOT_DIR = "D:\programing"
$Global:PROJECT_DIR = "$PROJECT_ROOT_DIR\core_node"
$Global:PROJECT_SCRIPTS_DIR = "$PROJECT_DIR\scripts"
$Global:PROJECT_WIN_SCRIPTS_DIR = "$PROJECT_SCRIPTS_DIR\shells\win"
$Global:INLINE_WINENVS_DIR = "$PROJECT_SCRIPTS_DIR\winenvs"  # Inline scripts directory - scripts in memory travel with code
$Global:CHOCO_DIR = "C:\ProgramData\chocolatey"
$Global:SCOOP_CACHE_DIR = "$TEMP_DIR\scoop"
$Global:SCOOP_DIR = "$LANG_COMPILER_DIR\scoop"
$Global:SCOOP_APPS_DIR = "$LANG_COMPILER_DIR\scoop\apps"
$Global:SCOOP_EXE = "$SCOOP_DIR\shims\scoop.cmd"
$Global:SCOOP_GLOBAL_DIR = "$LANG_COMPILER_DIR\scoop\apps"
$Global:CHOCO_EXE = "$CHOCO_DIR\choco.exe"
$Global:CHOCO_CACHE_DIR = "$TEMP_DIR\chocolatey"

if ($null -eq $sharedCacheLoaded -or -not [bool]$sharedCacheLoaded.Value) {
    . $sharedCacheEnvPath
    Set-Variable -Name 'PycoreSharedCacheEnvLoaded' -Scope Script -Value $true
}

$Global:USER_DIR = "D:\programing\Users\$env:USERNAME\.core_node"
$Global:USER_CACHE_DIR = Join-Path $Global:CORE_NODE_CACHE_DIR 'core_node'
if (-not (Test-Path $Global:USER_CACHE_DIR)) {
    New-Item -ItemType Directory -Path $Global:USER_CACHE_DIR -Force | Out-Null
}

$Global:APP_INSTALLED_FLAG_DIR = "$Global:USER_DIR\.app_installed_flag"
$Global:GIT_CONFIG_DIR = "$Global:USER_DIR\.git_config"
$Global:USER_CONFIG_DIR = Join-Path $Global:USER_DIR ".config"
$Global:SCRIPTS_DIR = "$Global:USER_DIR\.scripts"
$Global:WINGET_FLAG_FILE = "$Global:USER_DIR\.winget_set_flag_file"

# Desktop Category Constants
$Global:DESKTOP_CATEGORY_DEVELOPMENT_TOOLS = "DevelopmentTools"
$Global:DESKTOP_CATEGORY_DEV_SCRIPTS = "DevScripts"
$Global:DESKTOP_CATEGORY_TEXT_EDITORS = "TextEditors"
$Global:DESKTOP_CATEGORY_COMPRESSION_TOOLS = "CompressionTools"
$Global:DESKTOP_CATEGORY_NETWORK_TOOLS = "NetworkTools"
$Global:DESKTOP_CATEGORY_DOCUMENT_TOOLS = "DocumentTools"
$Global:DESKTOP_CATEGORY_DATABASE_TOOLS = "DatabaseTools"
$Global:DESKTOP_CATEGORY_API_TOOLS = "APITools"
$Global:DESKTOP_CATEGORY_DESIGN_TOOLS = "DesignTools"
$Global:DESKTOP_CATEGORY_MEDIA_TOOLS = "MediaTools"
$Global:DESKTOP_CATEGORY_SOCIAL_MEDIA = "SocialMedia"
$Global:DESKTOP_CATEGORY_OFFICE_TOOLS = "OfficeTools"
$Global:DESKTOP_CATEGORY_NETWORK_ACCELERATORS = "NetworkAccelerators"
$Global:DESKTOP_CATEGORY_BROWSERS = "Browsers"
$Global:DESKTOP_CATEGORY_GAMES = "Games"
$Global:DESKTOP_CATEGORY_SECURITY_TOOLS = "SecurityTools"
$Global:DESKTOP_CATEGORY_SYSTEM_TOOLS = "SystemTools"
$Global:DESKTOP_CATEGORY_DOWNLOAD_TOOLS = "DownloadTools"
$Global:DESKTOP_CATEGORY_EDUCATION = "Education"
$Global:DESKTOP_CATEGORY_FINANCE = "Finance"
$Global:DESKTOP_CATEGORY_SHOPPING = "Shopping"
$Global:DESKTOP_CATEGORY_AI_CLI_TOOLS = "AICLITools"
# Global variables directory (must-be-defined-first)
$Global:GLOBAL_VAR_DIR = Join-Path $Global:USER_DIR ".global_vars"

# Common encryption/decryption functions for GlobalVars
. (Join-Path $PSScriptRoot 'GlobalVarStoreCommon.ps1')


# Git related global variables
$Global:GIT_INSTALL_DIR = "$Global:APP_INSTALL_DIR\Git"
$Global:GIT_EXE_PATH = Join-Path $Global:GIT_INSTALL_DIR "cmd\git.exe"
$Global:GIT_FLAG_FILE = "$Global:USER_DIR\.git_set"
$Global:GIT_WINGET_ID = "Git.Git"
$Global:GIT_DEFAULT_USER = "DevOps User"
$Global:GIT_DEFAULT_EMAIL = "devops@example.com"

# Node.js related global variables
$Global:NODE_VERSION = "24.11.1"
$Global:NODE_DIR = Join-Path $Global:LANG_COMPILER_DIR "node-v$Global:NODE_VERSION"
$Global:NODE_EXE_PATH = Join-Path $Global:NODE_DIR "node.exe"
$Global:NPM_EXE_PATH = Join-Path $Global:NODE_DIR "npm.cmd"
$Global:PNPM_EXE_PATH = Join-Path $Global:NODE_DIR "pnpm.cmd"
$Global:YARN_EXE_PATH = Join-Path $Global:NODE_DIR "yarn.cmd"
$Global:NODE_WINGET_ID = "OpenJS.NodeJS.LTS"

# Standalone system Python policy (no conda) — paths composed from LANG_COMPILER_DIR
$Global:AI_POLICY_VERSION = Get-AiRuntimePolicyValue -Name 'AI_POLICY_VERSION' -Default '0'
$Global:PYTHON_VERSION = Get-AiRuntimePolicyValue -Name 'AI_PYTHON_VERSION' -Default '3.13'
$Global:PYTHON_VERSION_COMPACT = ($Global:PYTHON_VERSION -replace '\.', '')
$Global:PYTHON_WINGET_ID = "Python.Python.$($Global:PYTHON_VERSION)"
$Global:PYTHON_DIR = Join-Path $Global:LANG_COMPILER_DIR ("python$($Global:PYTHON_VERSION_COMPACT)")
$Global:PYTHON_SCRIPTS_DIR = Join-Path $Global:PYTHON_DIR "Scripts"
$Global:PYTHON_EXE_PATH = Join-Path $Global:PYTHON_DIR "python.exe"
$Global:PIP_EXE_PATH = Join-Path $Global:PYTHON_SCRIPTS_DIR "pip.exe"
$Global:UV_EXE_PATH = Join-Path $Global:PYTHON_SCRIPTS_DIR "uv.exe"
$Global:PIPX_EXE_PATH = Join-Path $Global:PYTHON_SCRIPTS_DIR "pipx.exe"
$Global:POETRY_EXE_PATH = Join-Path $Global:PYTHON_SCRIPTS_DIR "poetry.exe"
$Global:PYTHON_FLAG_FILE = Join-Path $Global:USER_CACHE_DIR ("python$($Global:PYTHON_VERSION_COMPACT).install_success.flag")

# Bucket-A shared transformers pin — mirrors linux/common/common_functions.sh
# ($LLM_TRANSFORMERS_SPEC). DeepSeek-VL/DeepSeek-OCR/Qwen2.5/NLLB-200/Bark all install
# transformers at THIS one version in the single system Python 3.13, so they never race
# (Windows has no shared venv; every LLM step shares one interpreter). 4.46.3 satisfies
# all of them. Set $env:LLM_TRANSFORMERS_SPEC to bump it everywhere at once.
# Contract: development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §7.
$Global:LLM_TRANSFORMERS_SPEC = if ($env:LLM_TRANSFORMERS_SPEC) { $env:LLM_TRANSFORMERS_SPEC } else { Get-AiRuntimePolicyValue -Name 'AI_SHARED_TRANSFORMERS_SPEC' -Default 'transformers' }

# NVIDIA tools (optional override; default to System32 nvidia-smi.exe)
$Global:NVidiaSmiPath = Join-Path $env:SystemRoot 'System32\nvidia-smi.exe'

# Repository Configuration - Auto-switch based on region
$Global:GITEE_BASE_URL = "https://gitee.com/accountbelongstox/core_node/raw/main"
$Global:GITHUB_RAW_BASE_URL = "https://raw.githubusercontent.com/accountbelongstox/core_node/main"

# Git Clone URLs for project setup
$Global:GITEE_CLONE_URL = "https://gitee.com/accountbelongstox/core_node.git"
$Global:GITHUB_CLONE_URL = "https://github.com/accountbelongstox/core_node.git"
$Global:GITEE_SSH_CLONE_URL = "git@gitee.com:accountbelongstox/core_node.git"
$Global:GITHUB_SSH_CLONE_URL = "git@github.com:accountbelongstox/core_node.git"

# Function to get appropriate download base URL based on region
function Get-RegionBaseURL {
    $selectedRegion = Get-GlobalVar -key "SELECTED_REGION" -defaultValue "China"
    if ($selectedRegion -eq "China") {
        return $Global:GITEE_BASE_URL
    } else {
        return $Global:GITHUB_RAW_BASE_URL
    }
}

# Function to get region-specific URL with optional sub-path
function Get-RegionURL {
    param(
        [string]$SubPath = ""
    )
    $selectedRegion = Get-GlobalVar -key "SELECTED_REGION" -defaultValue "China"
    $baseUrl = if ($selectedRegion -eq "China") {
        $Global:GITEE_BASE_URL
    } else {
        $Global:GITHUB_RAW_BASE_URL
    }

    if ([string]::IsNullOrWhiteSpace($SubPath)) {
        return $baseUrl
    } else {
        return "$baseUrl/$SubPath"
    }
}

# Function to check if SSH key pair exists
function Test-SSHKeyPairExists {
    $sshDir = $Global:SSH_DIR
    if (-not (Test-Path $sshDir)) {
        return $false
    }

    $pubKeys = Get-ChildItem -Path $sshDir -Filter "*.pub" -File -ErrorAction SilentlyContinue
    foreach ($pub in $pubKeys) {
        $priv = Join-Path $sshDir ([System.IO.Path]::GetFileNameWithoutExtension($pub.Name))
        if (Test-Path $priv) {
            return $true
        }
    }
    return $false
}

# Function to get region-specific Git clone URL (with SSH support)
function Get-RegionCloneURL {
    param(
        [switch]$PreferSSH = $true
    )

    $selectedRegion = Get-GlobalVar -key "SELECTED_REGION" -defaultValue "Global"
    $hasSSHKey = Test-SSHKeyPairExists

    # If PreferSSH is enabled and SSH key exists, use SSH URL
    if ($PreferSSH -and $hasSSHKey) {
        if ($selectedRegion -eq "China") {
            return $Global:GITEE_SSH_CLONE_URL
        } else {
            return $Global:GITHUB_SSH_CLONE_URL
        }
    } else {
        # Otherwise use HTTPS URL
        if ($selectedRegion -eq "China") {
            return $Global:GITEE_CLONE_URL
        } else {
            return $Global:GITHUB_CLONE_URL
        }
    }
}

# Legacy function aliases for backward compatibility
function Get-RegionDownloadBaseURL {
    return Get-RegionURL
}

function Get-RegionRemoteBaseUrl {
    return Get-RegionURL -SubPath "scripts/shells/win/install_powershells"
}

function Get-RegionInstallerScriptsListUrl {
    return Get-RegionURL -SubPath "scripts/shells/win/win_common/InstallerScriptsList.ps1"
}

function Get-RegionTestInstallerUrl {
    return Get-RegionURL -SubPath "scripts/shells/win/TestInstaller.ps1"
}

# Dynamic URL assignment based on region
$Global:CURRENT_BASE_URL = Get-RegionBaseURL
$Global:GITEE_SCRIPTS_URL = "$Global:CURRENT_BASE_URL/scripts"
$Global:GITEE_UTILS_URL = "$Global:CURRENT_BASE_URL/ncore/utils"

# Environment Scripts related global variables
$Global:SET_ENV_JS_PATH = "$Global:SCRIPTS_DIR\winpath.js"
$Global:SET_ENV_JS_URL = "$Global:GITEE_UTILS_URL/win_tool/libs/winpath.js"

# Global 7-Zip Variables
$Global:SEVENZIP_TEMP_DIR = $Global:TEMP_DIR
$Global:SEVENZIP_INSTALL_DIR = "$Global:LANG_COMPILER_DIR\7z"
$Global:SEVENZIP_DOWNLOAD_URL = "https://www.7-zip.org/a/7z2408-x64.exe"
$Global:SEVENZIP_EXE_PATH = Join-Path $Global:SEVENZIP_INSTALL_DIR "7z.exe"
$Global:SEVENZIP_TMP_NAME = "7z2408-x64.exe"
$Global:SEVENZIP_TMP_PATH = Join-Path $Global:SEVENZIP_TEMP_DIR $Global:SEVENZIP_TMP_NAME

# Global Security Tools (Sysinternals Suite) Variables
# Portable forensic/behavior-analysis toolkit (Process Monitor "procmon",
# Autoruns "au", Process Explorer, Sigcheck, TCPView, Handle, ListDLLs, Sysmon,
# PsExec, Strings, AccessChk...). Used to attribute rogue processes that tamper
# with non-default Chrome installs. Installed under LANG_COMPILER_DIR and linked
# into .winenvs so the tools and helper scripts are globally available.
$Global:SECURITY_TOOLS_INSTALL_DIR = Join-Path $Global:LANG_COMPILER_DIR "Sysinternals"
$Global:SECURITY_TOOLS_DOWNLOAD_URL = "https://download.sysinternals.com/files/SysinternalsSuite.zip"
$Global:SECURITY_TOOLS_ZIP_NAME = "SysinternalsSuite.zip"
$Global:SECURITY_TOOLS_ZIP_PATH = Join-Path $Global:DOWNLOADS_DIR $Global:SECURITY_TOOLS_ZIP_NAME
$Global:SECURITY_TOOLS_SENTINEL_EXE = Join-Path $Global:SECURITY_TOOLS_INSTALL_DIR "Procmon.exe"

# Global UVX Variables
$Global:UVX_INSTALL_DIR = Join-Path $Global:LANG_COMPILER_DIR "uvx"
$Global:UVX_EXECUTABLE = "uvx.exe"
$Global:UVX_PACKAGE_NAME = "uv"
$Global:UVX_PIP_PACKAGE = "uv"
$Global:UVX_INSTALLED_FLAG = Join-Path $Global:USER_CACHE_DIR "UVX_Installed_flag"
$Global:PHP_VERSIONS = @(
    @{
        Id        = "PHP.PHP.8.4"
        Version   = "84"
        IsDefault = $true
    }
)
$Global:PHP_CONFIGFILE_URL = "$Global:GITEE_SCRIPTS_URL/shells/win/1_phpconfig/configure_php_ini.php"
$Global:PHP_CONFIGFILE_PATH = "$Global:SCRIPTS_DIR\configure_php_ini.php"
$Global:PHP_CONFIGFILE_LOCAL_PATH = "$Global:PROJECT_WIN_SCRIPTS_DIR\1_phpconfig\configure_php_ini.php"

# Note: Java configuration moved to ApplicationsList.ps1 for consistency
# Note: FFmpeg configuration moved to ApplicationsList.ps1 for consistency


# Global Android Studio Variables
$Global:ANDROID_STUDIO_VERSION = "2025.1.3.7"
$Global:ANDROID_STUDIO_DOWNLOAD_URL = "https://redirector.gvt1.com/edgedl/android/studio/install/2025.1.3.7/android-studio-2025.1.3.7-windows.exe"
$Global:ANDROID_DIR = "C:\Program Files\Android"
$Global:ANDROID_STUDIO_DIR = Join-Path $ANDROID_DIR "Android Studio"
$Global:ANDROID_STUDIO_EXE_PATH = Join-Path $ANDROID_STUDIO_DIR "bin\studio64.exe"
$Global:ANDROID_SDK_DIR = Join-Path $ANDROID_DIR "Sdk"
$Global:ANDROID_STUDIO_INSTALLED_FLAG = "$Global:USER_CACHE_DIR\AndroidStudio_Installed_flag"

# Note: Go configuration moved to ApplicationsList.ps1 for consistency

# Global Flutter Variables
$Global:FLUTTER_VERSION = "3.35.5-stable"
$Global:FLUTTER_DIR = Join-Path $Global:LANG_COMPILER_DIR "flutter"
$Global:FLUTTER_EXE_PATH = Join-Path $Global:FLUTTER_DIR "bin\flutter.bat"
$Global:FLUTTER_INSTALLED_FLAG = "$Global:USER_CACHE_DIR\Flutter_Installed_flag"

# Flutter mirror configuration
$Global:FLUTTER_MIRRORS = @{
    "Global" = @{
        "PUB_HOSTED_URL"           = "https://pub.dev"
        "FLUTTER_STORAGE_BASE_URL" = "https://storage.googleapis.com"
        "DOWNLOAD_URL_FORMAT"      = "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_{0}.zip"
    }
    "China"  = @{
        "PUB_HOSTED_URL"           = "https://pub.flutter-io.cn"
        "FLUTTER_STORAGE_BASE_URL" = "https://storage.flutter-io.cn"
        "DOWNLOAD_URL_FORMAT"      = "https://storage.flutter-io.cn/flutter_infra_release/releases/stable/windows/flutter_windows_{0}.zip"
    }
}

# Note: Ruby configuration moved to ApplicationsList.ps1 for consistency

# Note: Rust configuration moved to ApplicationsList.ps1 for consistency

# Global Qt Variables
$Global:QT_DEFAULT_VERSION = "6.10.0"
$Global:QT_INSTALL_BASE_DIR = Join-Path $Global:LANG_COMPILER_DIR "Qt"
$Global:QT_INSTALL_METHOD = Get-GlobalVar -key "QT_INSTALL_METHOD" -defaultValue "installer"  # "installer" or "source"
$Global:QT_INSTALLER_FILENAME = "qt-online-installer-windows-x64-online.exe"
$Global:QT_INSTALLER_URL_GLOBAL = "https://download.qt.io/official_releases/online_installers/$Global:QT_INSTALLER_FILENAME"
$Global:QT_INSTALLER_URL_CHINA = "https://mirrors.tuna.tsinghua.edu.cn/qt/official_releases/online_installers/$Global:QT_INSTALLER_FILENAME"
$Global:QT_INSTALLER_DOWNLOAD_PATH = Join-Path $Global:DOWNLOADS_DIR $Global:QT_INSTALLER_FILENAME

# Global Visual Studio Variables
$Global:VS2022_VERSIONS = @{
    "2022" = @{
        WingetId   = "Microsoft.VisualStudio.2022.Community"
        Workloads  = @(
            "Microsoft.VisualStudio.Workload.ManagedDesktop",
            "Microsoft.VisualStudio.Workload.NetWeb",
            "Microsoft.VisualStudio.Workload.NativeDesktop"
        )
        Components = @(
            # Core C++ components
            "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
            "Microsoft.VisualStudio.Component.VC.14.34.17.4.x86.x64",

            # Windows SDK
            "Microsoft.VisualStudio.Component.Windows10SDK.19041",
            "Microsoft.VisualStudio.Component.Windows11SDK.22000",

            # CMake support
            "Microsoft.VisualStudio.Component.CMake.Tools",
            "Microsoft.VisualStudio.Component.VC.CMake.Project",

            # ATL and MFC (required for Qt Speech, WebView, and other Win32 apps)
            "Microsoft.VisualStudio.Component.VC.ATL",
            "Microsoft.VisualStudio.Component.VC.ATLMFC",

            # C++/CLI support
            "Microsoft.VisualStudio.Component.VC.CLI.Support",

            # Additional useful components
            "Microsoft.VisualStudio.Component.IntelliCode",
            "Microsoft.VisualStudio.Component.VC.DiagnosticTools",
            "Microsoft.VisualStudio.Component.VC.Redist.14.Latest"
        )
    }
    "2022-minimal" = @{
        WingetId   = "Microsoft.VisualStudio.2022.Community"
        Workloads  = @(
            "Microsoft.VisualStudio.Workload.ManagedDesktop"
        )
        Components = @(
            "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
            "Microsoft.VisualStudio.Component.Windows10SDK.19041"
        )
    }
}
$Global:VS2022_DEFAULT_VERSION = "2022"
$Global:VS2022_DIR = Join-Path $Global:LANG_COMPILER_DIR "vs2022"
$Global:VS2022_DEFAULT_DIR = "C:\Program Files\Microsoft Visual Studio"

# Git SSH Scripts
$Global:GIT_SSH_PUB_URL = "$Global:GITEE_SCRIPTS_URL/git/git.ssh.id.ed.pub.js"
$Global:GIT_SSH_KEY_URL = "$Global:GITEE_SCRIPTS_URL/git/git.ssh.id.ed.js"
$Global:SSH_DIR = Join-Path $env:USERPROFILE ".ssh"
$Global:SSH_PUB_PATH = Join-Path $Global:SSH_DIR ([System.IO.Path]::GetFileName($Global:GIT_SSH_PUB_URL))
$Global:SSH_KEY_PATH = Join-Path $Global:SSH_DIR ([System.IO.Path]::GetFileName($Global:GIT_SSH_KEY_URL))

# Initialize global variables from stored values
$storedVars = Get-AllGlobalVars
$Global:VARIABLES_INITIALIZED = @{}

# Function to initialize a global variable
function Initialize-GlobalVar {
    param (
        [string]$name,
        [string]$value,
        [string]$description = ""
    )
    $storedValue = $storedVars[$name]
    if ($storedValue) {
        Set-Variable -Name $name -Value $storedValue -Scope Global
    }
    else {
        Set-Variable -Name $name -Value $value -Scope Global
        Set-GlobalVar -key $name -value $value
    }
    $Global:VARIABLES_INITIALIZED[$name] = $true
}

# Function to initialize all variables from directory
function Initialize-AllGlobalVars {
    if (-not (Test-Path $Global:GLOBAL_VAR_DIR)) {
        New-Item -ItemType Directory -Path $Global:GLOBAL_VAR_DIR -Force | Out-Null
    }
    Get-ChildItem $Global:GLOBAL_VAR_DIR | ForEach-Object {
        $name = $_.Name
        $value = Get-Content $_.FullName -Raw
        Set-Variable -Name $name -Value $value -Scope Global
    }
}

Initialize-AllGlobalVars

$selectedRegion = Get-GlobalVar -key "SELECTED_REGION"
if ([string]::IsNullOrWhiteSpace($selectedRegion)) {
    $selectedRegion = "Global"
}
$Global:SELECTED_REGION = $selectedRegion
$Global:RegionIsChina = $selectedRegion -eq "China"
$Global:RegionIsGlobal = $selectedRegion -eq "Global"

$Global:CHINESE_CUNZHI = [char]0x5BF8 + [char]0x6B62  # cunzhi (Store-Stop)
$Global:CHINESE_DENGYIXIA = [char]0x7B49 + [char]0x4E00 + [char]0x4E0B  # dengyixia (Wait a moment)
$Global:CHINESE_ALIBABA = [char]0x963F + [char]0x91CC + [char]0x5DF4 + [char]0x5DF4  # alibaba (Alibaba)
$Global:CHINESE_BYTEDANCE = [char]0x5B57 + [char]0x8282 + [char]0x8DF3 + [char]0x52A8  # zijietiaodong (ByteDance)

if ($selectedRegion -eq "China") {
    $Global:ENV_LOCAL = "cn"
}
else {
    $Global:ENV_LOCAL = "en"
}


# Global Apktool Variables
$Global:APKTOOL_VERSION = "2.11.1"
$Global:APKTOOL_JAR_URL = "https://bitbucket.org/iBotPeaches/apktool/downloads/apktool_2.11.1.jar"
$Global:APKTOOL_INSTALL_DIR = Join-Path $Global:LANG_COMPILER_DIR "apktool"
$Global:APKTOOL_JAR_PATH = Join-Path $Global:APKTOOL_INSTALL_DIR "apktool.jar"
$Global:APKTOOL_BAT_PATH = Join-Path $Global:APKTOOL_INSTALL_DIR "apktool.bat"
$Global:APKTOOL_INSTALLED_FLAG = Join-Path $Global:USER_CACHE_DIR "Apktool_Installed_flag"


# Chinese Unicode variables for keywords (using pinyin comments to avoid encoding issues)
$Global:CHINESE_WEIXIN = [char]0x5FAE + [char]0x4FE1  # weixin (WeChat)
$Global:CHINESE_JINSHAN = [char]0x91D1 + [char]0x5C71  # jinshan (Kingsoft)
$Global:CHINESE_JIANYING = [char]0x526A + [char]0x6620  # jianying (CapCut)
$Global:CHINESE_XUNLEI = [char]0x8FC5 + [char]0x96F7  # xunlei (Thunder)
$Global:CHINESE_BAIDUWANGPAN = [char]0x767E + [char]0x5EA6 + [char]0x7F51 + [char]0x76D8  # baiduwangpan (BaiduNetDisk)
$Global:CHINESE_KUAIFAN = [char]0x5FEB + [char]0x5E06  # kuaifan (QuickFox)
$Global:CHINESE_CHUANSUO = [char]0x7A7F + [char]0x68AD  # chuansuo (Shuttle)

$Global:ENABLE_DEFENDER_EXE_URL = "$Global:GITEE_SCRIPTS_URL/shells/win/encrypt_scripts/enable-defender.exe.js"
$Global:ENABLE_DEFENDER_TMP_PATH = Join-Path $Global:USER_CACHE_DIR "enable-defender.exe.js"
$Global:ENABLE_DEFENDER_EXE_PATH = Join-Path $Global:USER_CACHE_DIR "enable-defender.exe"
$Global:WSL_INSTALLED_FLAG = "$Global:USER_CACHE_DIR\WSL_Installed_flag"
$Global:STEP8_DV_INSTALLED_FLAG = "$Global:USER_CACHE_DIR\Step8_DV_Installed.flag"
$Global:STEP2_BASE_SETTINGS_FLAG = Join-Path $Global:USER_CACHE_DIR "Step2_BaseSettings_Completed.flag"
$Global:STEP2_EXPLORER_RESTART_FLAG = Join-Path $Global:USER_CACHE_DIR "Step2_ExplorerRestart_Completed.flag"
$Global:STEP2_WIN10_CONTEXT_MENU_FLAG = Join-Path $Global:USER_CACHE_DIR "Step2_Win10ContextMenu_Completed.flag"
$Global:TEMP_REG_DIR = Join-Path $Global:USER_CACHE_DIR "reg_files"

# WSL related global variables
$Global:UBUNTU_VERSION = "24.04"
$Global:UBUNTU_DEFAULT_PASSWORD = "123456"
$Global:UBUNTU_WSL_DOWNLOAD_URL = "https://releases.ubuntu.com/noble/ubuntu-24.04.3-wsl-amd64.wsl"
$Global:UBUNTU_WSL_FILENAME = "ubuntu-24.04.3-wsl-amd64.wsl"
$Global:UBUNTU_WSL_LOCAL_PATH = Join-Path $Global:TEMP_DIR $Global:UBUNTU_WSL_FILENAME
$Global:WSL2_KERNEL_UPDATE_URL = "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi"
$Global:WSL2_KERNEL_FILENAME = "wsl_update_x64.msi"
$Global:WSL2_KERNEL_LOCAL_PATH = Join-Path $Global:TEMP_DIR $Global:WSL2_KERNEL_FILENAME
$Global:DEV_QUICK_SCRIPTS_DIR = Join-Path $Global:LANG_COMPILER_DIR ".dev_quickscripts"

# WSL Disk Management - Use LANG_COMPILER_DIR instead of TEMP_DIR
$Global:WSL_DISK_DIR = Join-Path $Global:LANG_COMPILER_DIR "wsl_disk"
$Global:WSL_UBUNTU_DISK_DIR = Join-Path $Global:WSL_DISK_DIR "ubuntu"
$Global:WSL_DEBIAN_DISK_DIR = Join-Path $Global:WSL_DISK_DIR "debian"


# MCP Services Configuration
$Global:MCP_SOURCE_DIR = Join-Path $Global:BASE_DIR "ncore\mcp_server"
$Global:MCP_DEPLOY_DIR = Join-Path $Global:LANG_COMPILER_DIR "mcp_service"
$Global:MCP_HTTP_SERVER_PORT = 38000
$Global:MCP_HTTP_SERVER_SCRIPT = Join-Path $Global:CORE_NODE_SCRIPTS_DIR "shells\scripts\mcp_http_server.js"

# MCP Services Array - REMOVED: Framework adjustment - services now managed via MCP_SERVICES_PACKAGES
