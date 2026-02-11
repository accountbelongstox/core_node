$base = "D:\programing\core_node\pyapps\d3-check"
$dir = Get-ChildItem -LiteralPath $base -Directory | Where-Object { $_.Name -like "cursor_AI*" } | Select-Object -First 1
$src = Join-Path $dir.FullName "_batch_20709_200.txt"
$dst = Join-Path $dir.FullName "_batch_20909_200.txt"
Copy-Item -LiteralPath $src -Destination $dst -Force
Write-Host "Copied to _batch_20909_200.txt"
