# App Manager - Command generator (Windows PS1)
# Builds launch command for an app using config templates.

param()
$ErrorActionPreference = 'SilentlyContinue'

function Get-LaunchCommand {
    param(
        [PSCustomObject]$App,
        [string]$RootDir
    )
    $templates = $Script:CommandTemplates
    $key = $App.Framework -replace 'Start$', ''
    $key = $key -replace 'MultiPlatform', ''
    $key = $key -replace 'reactNative', 'reactnative'
    $key = $key.ToLower()
    $isDev = $App.Debug
    $cmdKey = "${key}_dev"
    if (-not $isDev -and $templates.ContainsKey("${key}_build")) {
        $cmdKey = "${key}_build"
    }
    if (-not $templates.ContainsKey($cmdKey)) {
        $cmdKey = "${key}_dev"
    }
    if (-not $templates.ContainsKey($cmdKey)) {
        if ($App.Type -eq 'ncoreApp') { $cmdKey = 'ncore_dev' }
        elseif ($App.Type -eq 'pycoreApp') { $cmdKey = 'pycore_dev' }
        else { $cmdKey = 'polyLauncher' }
    }
    $tpl = $templates[$cmdKey]
    if (-not $tpl) { return "" }
    $tpl = $tpl -replace '\{app_path\}', $App.Path -replace '\{app_name\}', $App.Name -replace '\{port\}', $App.Port -replace '\{root_dir\}', $RootDir
    return $tpl
}

function Set-AppCommands {
    param(
        [array]$Apps,
        [string]$RootDir
    )
    foreach ($a in $Apps) {
        $a.Command = Get-LaunchCommand -App $a -RootDir $RootDir
    }
}
