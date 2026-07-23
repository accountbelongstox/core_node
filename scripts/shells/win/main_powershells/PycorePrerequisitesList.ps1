# Pycore prerequisite manifest (caller: PreparePycorePrerequisites.ps1 / pyservice.ps1).

$callerDir = Split-Path -Parent $PSCommandPath
$winDir = Split-Path $callerDir -Parent
$winCommonDir = Join-Path $winDir 'win_common'
$installPowerShellsDir = Join-Path $winDir 'install_powershells'
$installerCatalogPath = Join-Path $winCommonDir 'InstallerScriptsList.ps1'

. $installerCatalogPath

$PycorePrerequisiteScripts = @(
    @{ Key = 'cuda_policy';      Script = $InstallerScriptsMap['InstallCudaNvidiaPrereq'] }
    @{ Key = 'python_prereqs';   Script = $InstallerScriptsMap['InstallPythonPrereqPackages'] }
    @{ Key = 'desktop_manager';  Script = $InstallerScriptsMap['InstallDesktopManager'] }
    @{ Key = 'launcher';         Script = $InstallerScriptsMap['InstallLauncher'] }
    @{ Key = 'document_parsing'; Script = $InstallerScriptsMap['InstallDocumentParsing'] }
    @{ Key = 'ocr';              Script = $InstallerScriptsMap['InstallOcr'] }
    @{ Key = 'faster_whisper';   Script = $InstallerScriptsMap['InstallFasterWhisper'] }
    @{ Key = 'whisper';          Script = $InstallerScriptsMap['InstallWhisper'] }
    @{ Key = 'vosk';             Script = $InstallerScriptsMap['InstallVosk'] }
    @{ Key = 'edge_tts';         Script = $InstallerScriptsMap['InstallEdgeTts'] }
    @{ Key = 'chattts';          Script = $InstallerScriptsMap['InstallChatTts'];      SkipEnv = 'CHATTTS_SKIP' }
    @{ Key = 'cosyvoice';        Script = $InstallerScriptsMap['InstallCosyVoice'];    SkipEnv = 'COSYVOICE_SKIP' }
    @{ Key = 'fishspeech';       Script = $InstallerScriptsMap['InstallFishspeech'];   SkipEnv = 'FISHSPEECH_SKIP' }
    @{ Key = 'kokoro';           Script = $InstallerScriptsMap['InstallKokoro'];       SkipEnv = 'KOKORO_SKIP' }
    @{ Key = 'voxcpm2';          Script = $InstallerScriptsMap['InstallVoxcpm2'];      SkipEnv = 'VOXCPM2_SKIP' }
    @{ Key = 'bark';             Script = $InstallerScriptsMap['InstallBark'];         SkipEnv = 'BARK_SKIP' }
    @{ Key = 'parler';           Script = $InstallerScriptsMap['InstallParler'];       SkipEnv = 'PARLER_SKIP' }
    @{ Key = 'qwen3tts';         Script = $InstallerScriptsMap['InstallQwen3Tts'];     SkipEnv = 'QWEN3TTS_SKIP' }
    @{ Key = 'f5tts';            Script = $InstallerScriptsMap['InstallF5Tts'];        SkipEnv = 'F5TTS_SKIP' }
    @{ Key = 'gptsovits';        Script = $InstallerScriptsMap['InstallGptsovits'];    SkipEnv = 'GPTSOVITS_SKIP' }
    @{ Key = 'melotts';          Script = $InstallerScriptsMap['InstallMelotts'];      SkipEnv = 'MELOTTS_SKIP' }
)

$NeuralTtsOptInKeys = @(
    'chattts', 'cosyvoice', 'f5tts', 'fishspeech', 'kokoro',
    'voxcpm2', 'bark', 'parler', 'qwen3tts'
)

function Get-PycorePrerequisiteScriptPath {
    param([string]$ScriptName)
    return Join-Path $installPowerShellsDir $ScriptName
}
