#!/usr/bin/env pwsh

# Non-ASCII Character Detection and Cleanup Script
# This script scans for non-ASCII characters in code files and provides cleanup options

param(
    [string]$Path = "D:\programing\core_node",
    [switch]$Fix = $false,
    [switch]$Verbose = $false
)

# File extensions to check
$CodeExtensions = @(
    "*.sh", "*.ps1", "*.py", "*.js", "*.ts", "*.php", "*.java", "*.cpp", "*.c", "*.h",
    "*.cs", "*.rb", "*.go", "*.rs", "*.swift", "*.kt", "*.scala", "*.sql", "*.xml",
    "*.json", "*.yaml", "*.yml", "*.toml", "*.ini", "*.cfg", "*.conf", "*.md"
)

# Directories to exclude
$ExcludeDirs = @(
    "node_modules", ".git", ".vscode", ".idea", "vendor", "build", "dist", 
    "target", "bin", "obj", "__pycache__", ".pytest_cache", "coverage"
)

Write-Host "🔍 Scanning for non-ASCII characters in code files..." -ForegroundColor Cyan
Write-Host "📁 Path: $Path" -ForegroundColor Gray
Write-Host "🔧 Fix Mode: $Fix" -ForegroundColor Gray
Write-Host ""

$TotalFiles = 0
$FilesWithNonASCII = 0
$TotalNonASCII = 0
$Results = @()

# Function to check if file contains non-ASCII characters
function Test-NonASCII {
    param([string]$FilePath)
    
    try {
        $content = Get-Content -Path $FilePath -Raw -Encoding UTF8
        $nonASCIIMatches = [regex]::Matches($content, '[^\x00-\x7F]')
        
        if ($nonASCIIMatches.Count -gt 0) {
            $lines = $content -split "`n"
            $lineNumbers = @()
            
            foreach ($match in $nonASCIIMatches) {
                $lineNumber = ($content.Substring(0, $match.Index) -split "`n").Count
                $lineNumbers += $lineNumber
            }
            
            return @{
                HasNonASCII = $true
                Count = $nonASCIIMatches.Count
                Characters = $nonASCIIMatches | ForEach-Object { $_.Value } | Sort-Object -Unique
                LineNumbers = $lineNumbers | Sort-Object -Unique
                Content = $content
            }
        }
        
        return @{ HasNonASCII = $false }
    }
    catch {
        Write-Warning "Error reading file $FilePath`: $($_.Exception.Message)"
        return @{ HasNonASCII = $false }
    }
}

# Function to fix non-ASCII characters
function Fix-NonASCII {
    param([string]$FilePath, [string]$Content)
    
    try {
        # Common non-ASCII character replacements
        $replacements = @{
            '"' = '"'  # Left double quotation mark
            '"' = '"'  # Right double quotation mark
            ''' = "'"  # Left single quotation mark
            ''' = "'"  # Right single quotation mark
            '�? = '-'  # En dash
            '�? = '-'  # Em dash
            '�? = '...' # Horizontal ellipsis
            '°' = 'deg' # Degree symbol
            '×' = 'x'   # Multiplication sign
            '÷' = '/'   # Division sign
            '±' = '+/-' # Plus-minus sign
            '�? = '<='  # Less-than or equal to
            '�? = '>='  # Greater-than or equal to
            '�? = '!='  # Not equal to
            '�? = 'inf' # Infinity
            'α' = 'alpha'
            'β' = 'beta'
            'γ' = 'gamma'
            'δ' = 'delta'
            'ε' = 'epsilon'
            'π' = 'pi'
            'σ' = 'sigma'
            'τ' = 'tau'
            'φ' = 'phi'
            'ψ' = 'psi'
            'ω' = 'omega'
        }
        
        $fixedContent = $Content
        
        foreach ($char in $replacements.Keys) {
            $fixedContent = $fixedContent -replace [regex]::Escape($char), $replacements[$char]
        }
        
        # Remove any remaining non-ASCII characters
        $fixedContent = $fixedContent -replace '[^\x00-\x7F]', '?'
        
        if ($fixedContent -ne $Content) {
            Set-Content -Path $FilePath -Value $fixedContent -Encoding UTF8 -NoNewline
            return $true
        }
        
        return $false
    }
    catch {
        Write-Error "Error fixing file $FilePath`: $($_.Exception.Message)"
        return $false
    }
}

# Scan all files
foreach ($extension in $CodeExtensions) {
    $files = Get-ChildItem -Path $Path -Filter $extension -Recurse | Where-Object {
        $exclude = $false
        foreach ($excludeDir in $ExcludeDirs) {
            if ($_.FullName -like "*\$excludeDir\*") {
                $exclude = $true
                break
            }
        }
        return -not $exclude
    }
    
    foreach ($file in $files) {
        $TotalFiles++
        
        if ($Verbose) {
            Write-Host "Checking: $($file.FullName)" -ForegroundColor DarkGray
        }
        
        $result = Test-NonASCII -FilePath $file.FullName
        
        if ($result.HasNonASCII) {
            $FilesWithNonASCII++
            $TotalNonASCII += $result.Count
            
            $fileResult = @{
                File = $file.FullName
                Count = $result.Count
                Characters = $result.Characters
                LineNumbers = $result.LineNumbers
                Content = $result.Content
            }
            $Results += $fileResult
            
            Write-Host "�?$($file.Name)" -ForegroundColor Red -NoNewline
            Write-Host " - $($result.Count) non-ASCII characters" -ForegroundColor Yellow
            Write-Host "   Characters: $($result.Characters -join ', ')" -ForegroundColor DarkYellow
            Write-Host "   Lines: $($result.LineNumbers -join ', ')" -ForegroundColor DarkYellow
            
            if ($Fix) {
                Write-Host "🔧 Fixing..." -ForegroundColor Cyan -NoNewline
                $fixed = Fix-NonASCII -FilePath $file.FullName -Content $result.Content
                if ($fixed) {
                    Write-Host " �?Fixed" -ForegroundColor Green
                } else {
                    Write-Host " ⚠️ No changes needed" -ForegroundColor Yellow
                }
            }
        }
    }
}

# Summary
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "   Total files scanned: $TotalFiles" -ForegroundColor White
Write-Host "   Files with non-ASCII: $FilesWithNonASCII" -ForegroundColor $(if ($FilesWithNonASCII -gt 0) { "Red" } else { "Green" })
Write-Host "   Total non-ASCII characters: $TotalNonASCII" -ForegroundColor $(if ($TotalNonASCII -gt 0) { "Red" } else { "Green" })

if ($FilesWithNonASCII -eq 0) {
    Write-Host ""
    Write-Host "�?All files are clean! No non-ASCII characters found." -ForegroundColor Green
} else {
    Write-Host ""
    if (-not $Fix) {
        Write-Host "💡 To fix non-ASCII characters, run:" -ForegroundColor Yellow
        Write-Host "   .\check_non_ascii.ps1 -Fix" -ForegroundColor White
    } else {
        Write-Host "🔧 Non-ASCII characters have been processed." -ForegroundColor Green
    }
}

# Detailed report if verbose
if ($Verbose -and $Results.Count -gt 0) {
    Write-Host ""
    Write-Host "📋 Detailed Report:" -ForegroundColor Cyan
    foreach ($result in $Results) {
        Write-Host ""
        Write-Host "File: $($result.File)" -ForegroundColor White
        Write-Host "Non-ASCII characters: $($result.Characters -join ', ')" -ForegroundColor Yellow
        Write-Host "Line numbers: $($result.LineNumbers -join ', ')" -ForegroundColor Yellow
    }
}
