# Series index: orchestration only. Components are install_powershells/<Series>_<Part>.ps1 (each still
# runnable on its own); win_common/InstallSeriesCommon.ps1 runs them in this order.
$SERIES_TITLE = 'Python (default, CUDA policy, prerequisite packages, isolated 3.10/3.12)'
$SERIES_COMPONENTS = @(
    'Python_Default.ps1'
    'Python_CudaPrereq.ps1'
    'Python_PrereqPackages.ps1'
    'Python_Isolated310.ps1'
    'Python_Isolated312.ps1'
)
$SERIES_WIN_COMMON_DIR = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'

. (Join-Path $SERIES_WIN_COMMON_DIR 'InstallSeriesCommon.ps1')
Invoke-InstallSeries -Title $SERIES_TITLE -Components $SERIES_COMPONENTS
