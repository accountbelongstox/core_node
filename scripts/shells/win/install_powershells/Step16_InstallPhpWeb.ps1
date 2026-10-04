# Series index: orchestration only. Components are install_powershells/<Series>_<Part>.ps1 (each still
# runnable on its own); win_common/InstallSeriesCommon.ps1 runs them in this order.
$SERIES_TITLE = 'PHP and web server (PHP, FrankenPHP, Composer, PHP config, nginx)'
$SERIES_COMPONENTS = @(
    'Web_Php.ps1'
    'Web_FrankenPhp.ps1'
    'Web_Composer.ps1'
    'Web_ConfigurePhp85.ps1'
    'Web_Nginx.ps1'
)
$SERIES_WIN_COMMON_DIR = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'

. (Join-Path $SERIES_WIN_COMMON_DIR 'InstallSeriesCommon.ps1')
Invoke-InstallSeries -Title $SERIES_TITLE -Components $SERIES_COMPONENTS
