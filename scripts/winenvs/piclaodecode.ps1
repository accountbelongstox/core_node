$scriptPath = $PSScriptRoot
$piYoloPath = Join-Path $scriptPath 'piyolo.ps1'
$mode = 'claude'

& $piYoloPath $mode @args
