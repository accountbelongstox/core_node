# Series index: orchestration only. Components are install_powershells/<Series>_<Part>.ps1 (each still
# runnable on its own); win_common/InstallSeriesCommon.ps1 runs them in this order.
$SERIES_TITLE = 'Base tools (7-Zip, FFmpeg, NSSM, Sysinternals)'
$SERIES_COMPONENTS = @(
    'BaseTools_7Zip.ps1'
    'BaseTools_Ffmpeg.ps1'
    'BaseTools_Nssm.ps1'
    'BaseTools_SecurityTools.ps1'
)
$SERIES_WIN_COMMON_DIR = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'

. (Join-Path $SERIES_WIN_COMMON_DIR 'InstallSeriesCommon.ps1')
Invoke-InstallSeries -Title $SERIES_TITLE -Components $SERIES_COMPONENTS
