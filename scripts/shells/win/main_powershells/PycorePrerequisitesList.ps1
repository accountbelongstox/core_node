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
    @{ Key = 'chattts';          Script = $InstallerScriptsMap['InstallChatTts'] }
    @{ Key = 'cosyvoice';        Script = $InstallerScriptsMap['InstallCosyVoice'] }
    @{ Key = 'fishspeech';       Script = $InstallerScriptsMap['InstallFishspeech'] }
    @{ Key = 'kokoro';           Script = $InstallerScriptsMap['InstallKokoro'] }
    @{ Key = 'voxcpm2';          Script = $InstallerScriptsMap['InstallVoxcpm2'] }
    @{ Key = 'bark';             Script = $InstallerScriptsMap['InstallBark'] }
    @{ Key = 'parler';           Script = $InstallerScriptsMap['InstallParler'] }
    @{ Key = 'qwen3tts';         Script = $InstallerScriptsMap['InstallQwen3Tts'] }
    @{ Key = 'f5tts';            Script = $InstallerScriptsMap['InstallF5Tts'] }
    @{ Key = 'gptsovits';        Script = $InstallerScriptsMap['InstallGptsovits'] }
    @{ Key = 'melotts';          Script = $InstallerScriptsMap['InstallMelotts'] }
)

$NeuralTtsOptInKeys = @(
    'chattts', 'cosyvoice', 'f5tts', 'fishspeech', 'kokoro',
    'voxcpm2', 'bark', 'parler', 'qwen3tts'
)

function Get-PycorePrerequisiteScriptPath {
    param([string]$ScriptName)
    return Join-Path $installPowerShellsDir $ScriptName
}
