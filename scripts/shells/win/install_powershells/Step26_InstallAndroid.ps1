# Series index: orchestration only. Components are install_powershells/<Series>_<Part>.ps1 (each still
# runnable on its own); win_common/InstallSeriesCommon.ps1 runs them in this order.
$SERIES_TITLE = 'Android (platform tools, scrcpy, apktool, Android Studio, SDK packages)'
$SERIES_COMPONENTS = @(
    'Android_PlatformTools.ps1'
    'Android_Scrcpy.ps1'
    'Android_ApkTool.ps1'
    'Android_Studio.ps1'
    'Android_SdkPackages.ps1'
)
$SERIES_WIN_COMMON_DIR = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'

. (Join-Path $SERIES_WIN_COMMON_DIR 'InstallSeriesCommon.ps1')
Invoke-InstallSeries -Title $SERIES_TITLE -Components $SERIES_COMPONENTS
