# Pycore prerequisite manifest (caller: PreparePycorePrerequisites.ps1 / pyservice.ps1).
# Step scripts live under install_powershells/ and are invoked in dependency order only.

$callerDir            = Split-Path -Parent $PSCommandPath
$installPowerShellsDir = Join-Path (Split-Path $callerDir -Parent) 'install_powershells'

$PYCORE_PREREQ_DESKTOP_MANAGER   = 'Step48_InstallDesktopManager.ps1'
$PYCORE_PREREQ_LAUNCHER          = 'Step49_InstallLauncher.ps1'
$PYCORE_PREREQ_DOCUMENT_PARSING  = 'Step47_InstallDocumentParsing.ps1'
$PYCORE_PREREQ_OCR               = 'Step46_InstallOcr.ps1'
$PYCORE_PREREQ_FASTER_WHISPER    = 'Step11_InstallFasterWhisper.ps1'
$PYCORE_PREREQ_WHISPER           = 'Step42_InstallWhisper.ps1'
$PYCORE_PREREQ_VOSK              = 'Step43_InstallVosk.ps1'
$PYCORE_PREREQ_EDGE_TTS          = 'Step12_InstallEdgeTts.ps1'
$PYCORE_PREREQ_CHATTTS           = 'Step51_InstallChatTts.ps1'
$PYCORE_PREREQ_COSYVOICE         = 'Step52_InstallCosyVoice.ps1'
$PYCORE_PREREQ_FISHSPEECH        = 'Step56_InstallFishspeech.ps1'
$PYCORE_PREREQ_KOKORO            = 'Step57_InstallKokoro.ps1'
$PYCORE_PREREQ_VOXCPM2           = 'Step58_InstallVoxcpm2.ps1'
$PYCORE_PREREQ_BARK              = 'Step59_InstallBark.ps1'
$PYCORE_PREREQ_PARLER             = 'Step60_InstallParler.ps1'
$PYCORE_PREREQ_QWEN3TTS          = 'Step61_InstallQwen3Tts.ps1'
$PYCORE_PREREQ_F5TTS             = 'Step53_InstallF5Tts.ps1'
$PYCORE_PREREQ_GPTSOVITS         = 'Step54_InstallGptsovits.ps1'
$PYCORE_PREREQ_MELOTTS           = 'Step55_InstallMelotts.ps1'

# Dependency order: UI -> light pip -> OCR -> STT -> TTS -> neural (opt-in) -> melotts (opt-in, last; pins old transformers)
$PycorePrerequisiteScripts = @(
    @{ Key = 'desktop_manager';  Script = $PYCORE_PREREQ_DESKTOP_MANAGER }
    @{ Key = 'launcher';         Script = $PYCORE_PREREQ_LAUNCHER }
    @{ Key = 'document_parsing'; Script = $PYCORE_PREREQ_DOCUMENT_PARSING }
    @{ Key = 'ocr';              Script = $PYCORE_PREREQ_OCR }
    @{ Key = 'faster_whisper';   Script = $PYCORE_PREREQ_FASTER_WHISPER }
    @{ Key = 'whisper';          Script = $PYCORE_PREREQ_WHISPER }
    @{ Key = 'vosk';             Script = $PYCORE_PREREQ_VOSK }
    @{ Key = 'edge_tts';         Script = $PYCORE_PREREQ_EDGE_TTS }
    @{ Key = 'chattts';          Script = $PYCORE_PREREQ_CHATTTS }
    @{ Key = 'cosyvoice';        Script = $PYCORE_PREREQ_COSYVOICE }
    @{ Key = 'fishspeech';       Script = $PYCORE_PREREQ_FISHSPEECH }
    @{ Key = 'kokoro';           Script = $PYCORE_PREREQ_KOKORO }
    @{ Key = 'voxcpm2';          Script = $PYCORE_PREREQ_VOXCPM2 }
    @{ Key = 'bark';             Script = $PYCORE_PREREQ_BARK }
    @{ Key = 'parler';           Script = $PYCORE_PREREQ_PARLER }
    @{ Key = 'qwen3tts';         Script = $PYCORE_PREREQ_QWEN3TTS }
    @{ Key = 'f5tts';            Script = $PYCORE_PREREQ_F5TTS }
    @{ Key = 'gptsovits';        Script = $PYCORE_PREREQ_GPTSOVITS }
    @{ Key = 'melotts';          Script = $PYCORE_PREREQ_MELOTTS }
)

$NeuralTtsOptInKeys = @('chattts', 'cosyvoice', 'f5tts', 'gptsovits', 'fishspeech', 'kokoro', 'voxcpm2', 'bark', 'parler', 'qwen3tts')

function Get-PycorePrerequisiteScriptPath {
    param([string]$ScriptName)
    return Join-Path $installPowerShellsDir $ScriptName
}
