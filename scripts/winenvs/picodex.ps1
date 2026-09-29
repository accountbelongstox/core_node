$scriptPath = $PSScriptRoot
$piYoloPath = Join-Path $scriptPath 'piyolo.ps1'
$mode = 'codex'

& $piYoloPath $mode @args
