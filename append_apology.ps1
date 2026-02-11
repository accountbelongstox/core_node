$enc = [System.Text.Encoding]::UTF8
$base = "D:\programing\core_node\pyapps\d3-check"
$dir = Get-ChildItem -LiteralPath $base -Directory | Where-Object { $_.Name -like "cursor_AI*" } | Select-Object -First 1
$pathFile = Join-Path $dir.FullName "_main_path.txt"
$paths = [System.IO.File]::ReadAllLines($pathFile, $enc)
$mainPath = $paths[0].Trim()
$batchPath = $paths[1].Trim()
$lines = [System.IO.File]::ReadAllLines($batchPath, $enc)
[System.IO.File]::AppendAllLines($mainPath, $lines, $enc)
Write-Host "Appended $($lines.Count) lines"
