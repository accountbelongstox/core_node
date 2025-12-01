# Fix Qt 6.9.3 qmake bugs in Makefiles:
# 1. Remove invalid -Bx compiler option
# 2. Fix /source-charset:utf-8 conflict with /utf-8
# 3. Remove 2>NUL redirects to show compiler errors

$makefiles = Get-ChildItem -Filter "Makefile*" -File -ErrorAction SilentlyContinue

if ($makefiles.Count -eq 0) {
    Write-Host "No Makefiles found to fix"
    exit 0
}

Write-Host "Found $($makefiles.Count) Makefile(s) to check"

$fixedCount = 0
foreach ($makefile in $makefiles) {
    try {
        $content = Get-Content $makefile.FullName -Raw -ErrorAction Stop
        $modified = $false

        # Fix 1: Remove invalid -Bx option
        if ($content -match '-Bx\S+') {
            Write-Host "  Fixing: $($makefile.Name)"
            # Remove -Bx option (matches -Bx followed by non-whitespace characters)
            $content = $content -replace '\s+-Bx\S+', ''
            $modified = $true
            Write-Host "    OK: Removed -Bx option"
        }

        # Fix 2: Remove -source-charset:utf-8 when -utf-8 exists (D8016 error)
        # -utf-8 is equivalent to -source-charset:utf-8 + -execution-charset:utf-8
        # Match both / and - prefixes for compatibility
        if (($content -match '[-/]utf-8') -and ($content -match '[-/]source-charset:utf-8')) {
            $content = $content -replace '\s+[-/]source-charset:utf-8', ''
            if (-not $modified) {
                Write-Host "  Fixing: $($makefile.Name)"
            }
            $modified = $true
            Write-Host "    OK: Removed conflicting source-charset option"
        }

        # Fix 3: Remove 2>NUL redirects to show compiler errors
        if ($content -match '2>NUL') {
            $content = $content -replace '\s+2>NUL', ''
            if (-not $modified) {
                Write-Host "  Fixing: $($makefile.Name)"
            }
            $modified = $true
            Write-Host "    OK: Enabled error output"
        }

        if ($modified) {
            Set-Content $makefile.FullName $content -NoNewline -ErrorAction Stop
            $fixedCount++
        } else {
            Write-Host "  Skip: $($makefile.Name) (no fixes needed)"
        }
    }
    catch {
        Write-Host "  ERROR: Failed to process $($makefile.Name): $_"
    }
}

if ($fixedCount -gt 0) {
    Write-Host "Successfully fixed $fixedCount Makefile(s)"
} else {
    Write-Host "No Makefiles needed fixing"
}

exit 0
