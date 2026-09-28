$scriptPath = $PSScriptRoot
$piYoloPath = Join-Path $scriptPath 'piyolo.ps1'
$mode = 'kimi'

& $piYoloPath $mode @args
