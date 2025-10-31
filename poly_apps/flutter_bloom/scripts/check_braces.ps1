$file = "D:\programing\core_node\poly_apps\flutter_bloom\scripts\win_common\BCommon.ps1"
$content = Get-Content $file -Raw

$openBraces = ([regex]::Matches($content, '\{')).Count
$closeBraces = ([regex]::Matches($content, '\}')).Count

Write-Host "Open braces: $openBraces"
Write-Host "Close braces: $closeBraces"
Write-Host "Difference: $($openBraces - $closeBraces)"

# Find all function definitions
$functions = [regex]::Matches($content, 'function\s+(\S+)\s*\{')
Write-Host "`nFunction count: $($functions.Count)"
Write-Host "Functions found:"
foreach ($match in $functions) {
    Write-Host "  - $($match.Groups[1].Value)"
}
