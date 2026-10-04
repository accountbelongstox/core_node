# Series index: orchestration only. Components are install_powershells/<Series>_<Part>.ps1 (each still
# runnable on its own); win_common/InstallSeriesCommon.ps1 runs them in this order.
$SERIES_TITLE = 'Qt (build tools, Qt, Qt official installer)'
$SERIES_COMPONENTS = @(
    'Qt_BuildTools.ps1'
    'Qt_Install.ps1'
    'Qt_Official.ps1'
)
$SERIES_WIN_COMMON_DIR = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'

. (Join-Path $SERIES_WIN_COMMON_DIR 'InstallSeriesCommon.ps1')
Invoke-InstallSeries -Title $SERIES_TITLE -Components $SERIES_COMPONENTS
