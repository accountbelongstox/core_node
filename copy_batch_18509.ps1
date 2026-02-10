$enc = [System.Text.Encoding]::UTF8
$base = "D:\programing\core_node\pyapps\d3-check"
$dir = Get-ChildItem -LiteralPath $base -Directory | Where-Object { $_.Name -like "cursor_AI*" } | Select-Object -First 1
$src = Join-Path $dir.FullName "_batch_18309_200.txt"
$dst = Join-Path $dir.FullName "_batch_18509_200.txt"
Copy-Item -LiteralPath $src -Destination $dst -Force
Write-Host "Copied to _batch_18509_200.txt"
