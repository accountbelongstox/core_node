# Global text replacement script: SmartMatrix -> SmartMatrix
# This script will replace all occurrences in source files

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Starting global text replacement in: $scriptPath" -ForegroundColor Cyan

# File extensions to process
$extensions = @("*.cmake", "*.txt", "*.cpp", "*.h", "*.ps1", "*.rc", "*.qrc", "*.pro", "*.pri", "*.ui", "*.md", "*.json", "*.icns")

# Get all matching files recursively
$files = Get-ChildItem -Path $scriptPath -Recurse -Include $extensions -File | Where-Object {
    # Exclude build directories and output directories
    $_.FullName -notmatch '\\build\\' -and
    $_.FullName -notmatch '\\output' -and
    $_.FullName -notmatch '\\.git\\'
}

$totalFiles = $files.Count
$processedFiles = 0
$modifiedFiles = 0

Write-Host "Found $totalFiles files to process" -ForegroundColor Yellow

foreach ($file in $files) {
    $processedFiles++
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8 -ErrorAction Stop
        $originalContent = $content

        # Perform replacements
        $content = $content -replace 'SmartMatrix', 'SmartMatrix'
        $content = $content -replace 'SmartMatrix', 'smartmatrix'
        $content = $content -replace 'SmartMatrix', 'SMARTMATRIX'

        # Only write if content changed
        if ($content -ne $originalContent) {
            Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline -ErrorAction Stop
            $modifiedFiles++
            Write-Host "[$processedFiles/$totalFiles] Modified: $($file.Name)" -ForegroundColor Green
        } else {
            Write-Host "[$processedFiles/$totalFiles] Unchanged: $($file.Name)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "[$processedFiles/$totalFiles] Error processing $($file.Name): $_" -ForegroundColor Red
    }
}

Write-Host "`nReplacement complete!" -ForegroundColor Cyan
Write-Host "Total files processed: $processedFiles" -ForegroundColor Yellow
Write-Host "Total files modified: $modifiedFiles" -ForegroundColor Green
