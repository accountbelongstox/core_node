# Series index: orchestration only. Components are install_powershells/<Series>_<Part>.ps1 (each still
# runnable on its own); win_common/InstallSeriesCommon.ps1 runs them in this order.
$SERIES_TITLE = 'AI models, smallest download first (gated by the AI model level)'
$SERIES_COMPONENTS = @(
    'Model_EdgeTts.ps1'
    'Model_Ocr.ps1'
    'Model_Sherpa.ps1'
    'Model_Vosk.ps1'
    'Model_FasterWhisper.ps1'
    'Model_Whisper.ps1'
    'Model_Kokoro.ps1'
    'Model_Melotts.ps1'
    'Model_ChatTts.ps1'
    'Model_F5Tts.ps1'
    'Model_NLLB200.ps1'
    'Model_Ollama.ps1'
    'Model_CosyVoice.ps1'
    'Model_Gptsovits.ps1'
    'Model_Fishspeech.ps1'
    'Model_Voxcpm2.ps1'
    'Model_Bark.ps1'
    'Model_Parler.ps1'
    'Model_Qwen3Tts.ps1'
    'Model_Qwen25.ps1'
    'Model_DeepSeekOCR.ps1'
    'Model_DeepSeek.ps1'
)
$SERIES_WIN_COMMON_DIR = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'

. (Join-Path $SERIES_WIN_COMMON_DIR 'InstallSeriesCommon.ps1')
Invoke-InstallSeries -Title $SERIES_TITLE -Components $SERIES_COMPONENTS
