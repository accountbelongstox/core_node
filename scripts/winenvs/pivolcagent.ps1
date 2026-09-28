$scriptPath = $PSScriptRoot
$piYoloPath = Join-Path $scriptPath 'piyolo.ps1'
$mode = 'volc-agent'

& $piYoloPath $mode @args
