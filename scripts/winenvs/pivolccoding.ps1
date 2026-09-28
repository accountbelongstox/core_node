$scriptPath = $PSScriptRoot
$piYoloPath = Join-Path $scriptPath 'piyolo.ps1'
$mode = 'volc-coding'

& $piYoloPath $mode @args
