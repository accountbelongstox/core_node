# Pycore prerequisite manifest (caller: PreparePycorePrerequisites.ps1 / pyservice.ps1).

$callerDir = Split-Path -Parent $PSCommandPath
$winDir = Split-Path $callerDir -Parent
$winCommonDir = Join-Path $winDir 'win_common'
$installPowerShellsDir = Join-Path $winDir 'install_powershells'
$installerCatalogPath = Join-Path $winCommonDir 'InstallerScriptsList.ps1'

. $installerCatalogPath

$PycorePrerequisiteScripts = @(
    @{ Key = 'cuda_policy';      Script = $InstallerScriptsMap['InstallCudaNvidiaPrereq'];     SkipEnv = ''; InstallMode = '';         Full = $false }
    @{ Key = 'python_prereqs';   Script = $InstallerScriptsMap['InstallPythonPrereqPackages']; SkipEnv = ''; InstallMode = '';         Full = $false }
    @{ Key = 'desktop_manager';  Script = $InstallerScriptsMap['InstallDesktopManager'];       SkipEnv = ''; InstallMode = '';         Full = $false }
    @{ Key = 'launcher';         Script = $InstallerScriptsMap['InstallLauncher'];             SkipEnv = ''; InstallMode = '';         Full = $false }
    @{ Key = 'document_parsing'; Script = $InstallerScriptsMap['InstallDocumentParsing'];      SkipEnv = ''; InstallMode = '';         Full = $false }
    @{ Key = 'ocr';              Script = $InstallerScriptsMap['InstallOcr'];                  SkipEnv = ''; InstallMode = '';         Full = $false }
    @{ Key = 'faster_whisper';   Script = $InstallerScriptsMap['InstallFasterWhisper'];        SkipEnv = ''; InstallMode = '';         Full = $false }
    @{ Key = 'whisper';          Script = $InstallerScriptsMap['InstallWhisper'];              SkipEnv = ''; InstallMode = '';         Full = $false }
    @{ Key = 'vosk';             Script = $InstallerScriptsMap['InstallVosk'];                 SkipEnv = ''; InstallMode = '';         Full = $false }
    @{ Key = 'edge_tts';         Script = $InstallerScriptsMap['InstallEdgeTts'];              SkipEnv = ''; InstallMode = '';         Full = $false }
    @{ Key = 'chattts';          Script = $InstallerScriptsMap['InstallChatTts'];      SkipEnv = 'CHATTTS_SKIP';      InstallMode = 'neural'; Full = $true }
    @{ Key = 'cosyvoice';        Script = $InstallerScriptsMap['InstallCosyVoice'];    SkipEnv = 'COSYVOICE_SKIP';    InstallMode = 'neural'; Full = $true }
    @{ Key = 'fishspeech';       Script = $InstallerScriptsMap['InstallFishspeech'];   SkipEnv = 'FISHSPEECH_SKIP';   InstallMode = 'neural'; Full = $true }
    @{ Key = 'kokoro';           Script = $InstallerScriptsMap['InstallKokoro'];       SkipEnv = 'KOKORO_SKIP';       InstallMode = 'neural'; Full = $false }
    @{ Key = 'voxcpm2';          Script = $InstallerScriptsMap['InstallVoxcpm2'];      SkipEnv = 'VOXCPM2_SKIP';      InstallMode = 'neural'; Full = $true }
    @{ Key = 'bark';             Script = $InstallerScriptsMap['InstallBark'];         SkipEnv = 'BARK_SKIP';         InstallMode = 'neural'; Full = $true }
    @{ Key = 'parler';           Script = $InstallerScriptsMap['InstallParler'];       SkipEnv = 'PARLER_SKIP';       InstallMode = 'neural'; Full = $true }
    @{ Key = 'qwen3tts';         Script = $InstallerScriptsMap['InstallQwen3Tts'];     SkipEnv = 'QWEN3TTS_SKIP';     InstallMode = 'neural'; Full = $true }
    @{ Key = 'f5tts';            Script = $InstallerScriptsMap['InstallF5Tts'];        SkipEnv = 'F5TTS_SKIP';        InstallMode = 'neural'; Full = $true }
    @{ Key = 'gptsovits';        Script = $InstallerScriptsMap['InstallGptsovits'];    SkipEnv = 'GPTSOVITS_SKIP';    InstallMode = 'explicit'; Full = $true }
    @{ Key = 'melotts';          Script = $InstallerScriptsMap['InstallMelotts'];      SkipEnv = 'MELOTTS_SKIP';      InstallMode = 'explicit'; Full = $true }
)

function Get-PycorePrerequisiteScriptPath {
    param([string]$ScriptName)
    return Join-Path $installPowerShellsDir $ScriptName
}
