# Script to automatically resolve merge conflicts
# Strategy: Keep HEAD version by default, but can be customized

$conflictFiles = Get-ChildItem -Path . -Recurse -File -Exclude "fix_merge_conflicts.ps1" | 
    Where-Object { 
        $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
        $content -and $content -match "<<<<<<< HEAD"
    }

Write-Host "Found $($conflictFiles.Count) files with merge conflicts" -ForegroundColor Yellow

foreach ($file in $conflictFiles) {
    Write-Host "Processing: $($file.FullName)" -ForegroundColor Cyan
    
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Pattern to match merge conflicts
    # <<<<<<< HEAD
    # ... content ...
    # =======
    # ... content ...
    # >>>>>>> commit_hash
    
    $pattern = '(?s)<<<<<<< HEAD\s*\r?\n(.*?)\r?\n=======\s*\r?\n(.*?)\r?\n>>>>>>> [a-f0-9]+\s*\r?\n'
    
    # Strategy: Keep HEAD version (first capture group)
    # If HEAD is empty or whitespace only, keep the incoming version
    $resolved = $content -replace $pattern, {
        param($match)
        $headContent = $match.Groups[1].Value.Trim()
        $incomingContent = $match.Groups[2].Value.Trim()
        
        # If HEAD is empty, keep incoming
        if ([string]::IsNullOrWhiteSpace($headContent)) {
            return $incomingContent
        }
        # Otherwise keep HEAD
        return $headContent
    }
    
    if ($resolved -ne $originalContent) {
        # Remove any remaining conflict markers (in case pattern didn't match perfectly)
        $resolved = $resolved -replace '<<<<<<< HEAD\s*\r?\n', ''
        $resolved = $resolved -replace '=======\s*\r?\n', ''
        $resolved = $resolved -replace '>>>>>>> [a-f0-9]+\s*\r?\n', ''
        
        Set-Content -Path $file.FullName -Value $resolved -NoNewline
        Write-Host "  Fixed: $($file.Name)" -ForegroundColor Green
    } else {
        Write-Host "  No changes needed (manual review required): $($file.Name)" -ForegroundColor Yellow
    }
}

Write-Host "`nDone! Please review the changes." -ForegroundColor Green

