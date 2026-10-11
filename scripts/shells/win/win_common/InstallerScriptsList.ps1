# DevInstaller manifest (callers: DevInstaller.ps1, InitializationManager.ps1, TestInstaller.ps1).
# Step scripts live under install_powershells/; the full installation runs them in $InstallerScripts order.

#region Load Dependencies
$scriptDir             = Split-Path -Parent $PSCommandPath
$winCommonDir          = $scriptDir
$winShellsDir          = Split-Path -Parent $winCommonDir
$installPowerShellsDir = Join-Path $winShellsDir 'install_powershells'
$globalVarsPath        = Join-Path $winCommonDir 'GlobalVars.ps1'
$pythonRuntimePath     = Join-Path $winCommonDir 'PythonRuntimeCommon.ps1'
. $globalVarsPath
. $pythonRuntimePath
#endregion

# Script filename variables - each script name defined only once. A series index step
# (Step*_Install<Series>.ps1) orchestrates its component scripts (<Series>_<Part>.ps1) through
# win_common/InstallSeriesCommon.ps1; components stay runnable on their own.
$SCRIPT_STEP1_INITIALIZE_BASE_DIRECTORIES = "Step1_InitializeBaseDirectories.ps1"
$SCRIPT_STEP2_SET_BASE_SETTINGS = "Step2_SetBaseSettings.ps1"
$SCRIPT_STEP3_INIT_WINGET = "Step3_InitWinget.ps1"
$SCRIPT_STEP4_INSTALL_NODE = "Step4_InstallNode.ps1"
$SCRIPT_STEP5_INSTALL_GIT = "Step5_InstallGit.ps1"
$SCRIPT_STEP7_FIX_CORE_NODE_PROJECT_LOCATION = "Step7_FixCoreNodeProjectLocation.ps1"
$SCRIPT_STEP8_INSTALL_PYTHON = "Step8_InstallPython.ps1"
$SCRIPT_STEP14_INSTALL_SCOOP_WITH_CHINA_MIRROR = "Step14_InstallScoopWithChinaMirror.ps1"
$SCRIPT_STEP15_EXTEND_WINDOWS_UPDATE = "Step15_ExtendWindowsUpdate.ps1"
$SCRIPT_STEP16_INSTALL_PHP_WEB = "Step16_InstallPhpWeb.ps1"
$SCRIPT_STEP17_INSTALL_DATABASES = "Step17_InstallDatabases.ps1"
$SCRIPT_STEP18_SET_FILE_ASSOCIATIONS = "Step18_SetFileAssociations.ps1"
$SCRIPT_STEP19_DV = "Step19_DV.ps1"
$SCRIPT_STEP20_INSTALL_BASE_TOOLS = "Step20_InstallBaseTools.ps1"
$SCRIPT_STEP21_INSTALL_APPLICATIONS = "Step21_InstallApplications.ps1"
$SCRIPT_STEP22_INSTALL_CHROME = "Step22_InstallChrome.ps1"
$SCRIPT_STEP26_INSTALL_ANDROID = "Step26_InstallAndroid.ps1"
$SCRIPT_STEP28_INSTALL_FLUTTER = "Step28_InstallFlutter.ps1"
$SCRIPT_STEP29_INSTALL_WSL_DOCKER = "Step29_InstallWslDocker.ps1"
$SCRIPT_STEP32_INSTALL_VISUAL_STUDIO = "Step32_InstallVisualStudio.ps1"
$SCRIPT_STEP33_INSTALL_QT = "Step33_InstallQt.ps1"
$SCRIPT_STEP44_CHECK_CORE_NODE_PROJECT = "Step44_CheckCoreNodeProject.ps1"
$SCRIPT_STEP46_INSTALL_AI_MODELS = "Step46_InstallAiModels.ps1"
$SCRIPT_STEP47_INSTALL_DOCUMENT_PARSING = "Step47_InstallDocumentParsing.ps1"
$SCRIPT_STEP49_INSTALL_LAUNCHER = "Step49_InstallLauncher.ps1"
$SCRIPT_STEP65_INSTALL_AI_TOOLS = "Step65_InstallAiTools.ps1"
$SCRIPT_STEP71_INSTALL_DOTNET = "Step71_InstallDotnet.ps1"
$SCRIPT_STEP72_INSTALL_REMOTE_CONTROL_HOST = "Step72_InstallRemoteControlHost.ps1"
$SCRIPT_STEP73_INSTALL_NETWORK_ROUTER = "Step73_InstallNetworkRouter.ps1"
$SCRIPT_STEP74_INSTALL_VIRTUAL_AUDIO_CABLE = "Step74_InstallVirtualAudioCable.ps1"
$SCRIPT_STEP97_INSTALL_TAILSCALE = "Step97_InstallTailscale.ps1"
$SCRIPT_STEP175_LARAVEL_MAIN_START = "Step175_LaravelMainStart.ps1"
# Components the minimal initialization (InitializationManager) runs without their whole series
$SCRIPT_GIT_SSH_KEYS = "Git_SshKeys.ps1"
$SCRIPT_GIT_INSTALL = "Git_Install.ps1"
$SCRIPT_PYTHON_DEFAULT = "Python_Default.ps1"
$SCRIPT_NODE_RUNTIME = "Node_Runtime.ps1"

$InstallerScriptsMap = @{
    "InitializeBaseDirectories" = $SCRIPT_STEP1_INITIALIZE_BASE_DIRECTORIES
    "SetBaseSettings" = $SCRIPT_STEP2_SET_BASE_SETTINGS
    "InitWinget" = $SCRIPT_STEP3_INIT_WINGET
    "InstallGitSSH" = $SCRIPT_GIT_SSH_KEYS
    "InstallGit" = $SCRIPT_GIT_INSTALL
    "FixCoreNodeProjectLocation" = $SCRIPT_STEP7_FIX_CORE_NODE_PROJECT_LOCATION
    "InstallPython" = $SCRIPT_PYTHON_DEFAULT
    "InstallNodeJS" = $SCRIPT_NODE_RUNTIME
    "InstallVirtualAudioCable" = $SCRIPT_STEP74_INSTALL_VIRTUAL_AUDIO_CABLE
}

# DevInstaller sweep order: small essentials first, the largest downloads last. Each entry only
# depends on entries above it (the Python series keeps CUDA before the GPU-aware packages).
$InstallerScripts = @(
    # 1. System base, package managers and basic libraries
    $SCRIPT_STEP1_INITIALIZE_BASE_DIRECTORIES,
    $SCRIPT_STEP2_SET_BASE_SETTINGS,
    $SCRIPT_STEP3_INIT_WINGET,
    $SCRIPT_STEP15_EXTEND_WINDOWS_UPDATE,
    $SCRIPT_STEP19_DV,
    $SCRIPT_STEP5_INSTALL_GIT,
    $SCRIPT_STEP7_FIX_CORE_NODE_PROJECT_LOCATION,
    $SCRIPT_STEP44_CHECK_CORE_NODE_PROJECT,
    $SCRIPT_STEP14_INSTALL_SCOOP_WITH_CHINA_MIRROR,
    $SCRIPT_STEP20_INSTALL_BASE_TOOLS,
    # 2. Programming base: Python, Node, PHP/FrankenPHP/nginx, databases, .NET
    $SCRIPT_STEP8_INSTALL_PYTHON,
    $SCRIPT_STEP47_INSTALL_DOCUMENT_PARSING,
    $SCRIPT_STEP49_INSTALL_LAUNCHER,
    $SCRIPT_STEP4_INSTALL_NODE,
    $SCRIPT_STEP16_INSTALL_PHP_WEB,
    $SCRIPT_STEP17_INSTALL_DATABASES,
    $SCRIPT_STEP71_INSTALL_DOTNET,
    # 3. AI tools: one step installs every AI CLI (claude/codex/gemini/..., pi/omp/bun, codex multi-device)
    $SCRIPT_STEP65_INSTALL_AI_TOOLS,
    # 4. Mesh VPN (headscale/tailscale) and network, then the Laravel deployment that publishes tailnet sites
    $SCRIPT_STEP97_INSTALL_TAILSCALE,
    $SCRIPT_STEP73_INSTALL_NETWORK_ROUTER,
    $SCRIPT_STEP74_INSTALL_VIRTUAL_AUDIO_CABLE,
    $SCRIPT_STEP175_LARAVEL_MAIN_START,
    # 5. Chrome and the desktop applications (VS Code, ...), then the file associations that point at them
    $SCRIPT_STEP22_INSTALL_CHROME,
    $SCRIPT_STEP21_INSTALL_APPLICATIONS,
    $SCRIPT_STEP18_SET_FILE_ASSOCIATIONS,
    # 6. Large development software, smaller first
    $SCRIPT_STEP26_INSTALL_ANDROID,
    $SCRIPT_STEP28_INSTALL_FLUTTER,
    $SCRIPT_STEP33_INSTALL_QT,
    $SCRIPT_STEP32_INSTALL_VISUAL_STUDIO,
    # 7. WSL / Docker host
    $SCRIPT_STEP29_INSTALL_WSL_DOCKER,
    # 8. AI models (gated by the [A] AI model level), smallest download first
    $SCRIPT_STEP46_INSTALL_AI_MODELS
)

# Step files in install order: the full-installation sweep first, then the steps that only run on
# demand (or from another step, e.g. Step41/Step63 from Step65) in numeric order.
function Get-DiscoveredInstallerStepScripts {
    $names = @()
    $onDemand = @()
    if (-not (Test-Path -LiteralPath $installPowerShellsDir)) {
        return @()
    }
    $names = @(Get-ChildItem -LiteralPath $installPowerShellsDir -Filter 'Step*_*.ps1' -File -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
    $onDemand = @($names | Where-Object { $InstallerScripts -notcontains $_ } | Sort-Object {
        if ($_ -match '^Step(\d+)_') { [int]$Matches[1] } else { 999999 }
    })
    return @(@($InstallerScripts | Where-Object { $names -contains $_ }) + $onDemand)
}

function Test-InstallerScriptStringParam {
    param(
        [Parameter(Mandatory = $true)][string]$ScriptPath,
        [Parameter(Mandatory = $true)][string]$ParamName
    )
    if (-not (Test-Path -LiteralPath $ScriptPath)) { return $false }
    $raw = Get-Content -LiteralPath $ScriptPath -Raw -ErrorAction SilentlyContinue
    if (-not $raw) { return $false }
    return $raw -match "\[string\]\`$$ParamName\b"
}

function Resolve-InstallerStepPythonExe {
    param([string]$PreferredPath = '')

    if ($Global:PYTHON_EXE_PATH -and (Test-Path -LiteralPath $Global:PYTHON_EXE_PATH)) {
        return (Resolve-Path -LiteralPath $Global:PYTHON_EXE_PATH).Path
    }
    return $null
}

function Invoke-InstallerStepScript {
    param(
        [Parameter(Mandatory = $true)][string]$ScriptName,
        [string]$Region = '',
        [string]$PythonExe = '',
        [string]$ScriptPath = ''
    )

    $scriptPath = if ($ScriptPath) { $ScriptPath } else { Get-InstallerScriptPath -ScriptName $ScriptName }
    if (-not (Test-Path -LiteralPath $scriptPath)) {
        Write-Warning "Installer step not found: $scriptPath"
        return $false
    }

    if (-not $PythonExe) {
        $PythonExe = Resolve-InstallerStepPythonExe
    }

    $invokeArgs = @{}
    if ($PythonExe -and (Test-InstallerScriptStringParam -ScriptPath $scriptPath -ParamName 'Python')) {
        $invokeArgs['Python'] = $PythonExe
    }
    if ($Region -and (Test-InstallerScriptStringParam -ScriptPath $scriptPath -ParamName 'Region')) {
        $invokeArgs['Region'] = $Region
    }

    try {
        Unblock-File -Path $scriptPath -ErrorAction SilentlyContinue
        if ($invokeArgs.Count -gt 0) {
            & $scriptPath @invokeArgs | Out-Host
        } else {
            & $scriptPath | Out-Host
        }
        # Steps are idempotent and self-report; never gate on exit code / $LASTEXITCODE.
        return $true
    } catch {
        Write-Warning "Installer step failed ($ScriptName): $($_.Exception.Message)"
        return $false
    } finally {
        Invoke-CnToolCachePrune
    }
}

function Get-InstallerScriptName {
    param([string]$Key)
    if ($InstallerScriptsMap.ContainsKey($Key)) {
        return $InstallerScriptsMap[$Key]
    }
    Write-Warning "Script key '$Key' not found in InstallerScriptsMap"
    return $null
}

function Get-InstallerScriptPath {
    param([string]$ScriptName)
    return Join-Path $installPowerShellsDir $ScriptName
}

function Get-InitializationScripts {
    $initKeys = @("InitializeBaseDirectories", "SetBaseSettings", "InitWinget", "InstallGitSSH", "InstallGit", "FixCoreNodeProjectLocation", "InstallPython", "InstallNodeJS")
    $scripts = @()
    foreach ($key in $initKeys) {
        $scriptName = Get-InstallerScriptName $key
        if ($scriptName) { $scripts += $scriptName }
    }
    return $scripts
}
