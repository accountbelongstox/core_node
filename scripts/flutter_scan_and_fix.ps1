#!/usr/bin/env pwsh

param(
    [string]$TargetDir = "D:\programing\core_node\poly_apps\flutter_bloom\lib",
    [string]$OutputDir = "D:\programing\core_node\.analysis_reports\flutter",
    [switch]$DryRun = $false,
    [switch]$FixErrors = $true
)

$ErrorActionPreference = "Continue"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Flutter Code Scanner and Fixer" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target Dir: $TargetDir" -ForegroundColor Yellow
Write-Host "Output Dir: $OutputDir" -ForegroundColor Yellow
Write-Host ""

Write-Host "[1/5] Scanning Dart files..." -ForegroundColor Green
$dartFiles = Get-ChildItem -Path $TargetDir -Filter "*.dart" -Recurse -File
$dartFilesList = $dartFiles | Select-Object -ExpandProperty FullName | Sort-Object
$dartFilesList | Out-File -FilePath "$OutputDir\dart_files_full.txt" -Encoding UTF8
Write-Host "      Found $($dartFiles.Count) Dart files" -ForegroundColor White

Write-Host ""
Write-Host "[2/5] Directory structure..." -ForegroundColor Green
$directoryStats = $dartFiles | Group-Object {
    $relativePath = $_.FullName.Replace($TargetDir, "").TrimStart('\')
    $parts = $relativePath -split '\\'
    if ($parts.Count -gt 0) { $parts[0] } else { "root" }
} | Sort-Object Count -Descending

$directoryStats | ForEach-Object {
    Write-Host "      $($_.Name) : $($_.Count) files" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[3/5] Running flutter analyze..." -ForegroundColor Green
$analyzeLogPath = "$OutputDir\flutter_analyze_full.log"

Push-Location -Path (Split-Path $TargetDir -Parent)
try {
    $analyzeOutput = flutter analyze lib 2>&1
    $analyzeOutput | Out-File -FilePath $analyzeLogPath -Encoding UTF8
    Write-Host "      Analysis complete" -ForegroundColor White
} catch {
    Write-Host "      Error: $_" -ForegroundColor Red
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "[4/5] Parsing results..." -ForegroundColor Green

$errors = @()
$warnings = @()
$infos = @()

if (Test-Path $analyzeLogPath) {
    Get-Content $analyzeLogPath | ForEach-Object {
        if ($_ -match '^\s*error\s+-') {
            $errors += $_
        } elseif ($_ -match '^\s*warning\s+-') {
            $warnings += $_
        } elseif ($_ -match '^\s*info\s+-') {
            $infos += $_
        }
    }
} else {
    Write-Host "      Warning: Log file not found at $analyzeLogPath" -ForegroundColor Yellow
}

Write-Host "      Errors: $($errors.Count)" -ForegroundColor Red
Write-Host "      Warnings: $($warnings.Count)" -ForegroundColor Yellow
Write-Host "      Infos: $($infos.Count)" -ForegroundColor Cyan

$errors | Out-File -FilePath "$OutputDir\errors_full.txt" -Encoding UTF8

if ($FixErrors -and -not $DryRun) {
    Write-Host ""
    Write-Host "[5/5] Attempting auto-fix..." -ForegroundColor Green

    Write-Host "      Running dart fix --apply..." -ForegroundColor White
    Push-Location -Path (Split-Path $TargetDir -Parent)
    try {
        $fixOutput = dart fix --apply 2>&1
        $fixOutput | Out-File -FilePath "$OutputDir\dart_fix_output.txt" -Encoding UTF8
        Write-Host "      dart fix completed" -ForegroundColor White
    } catch {
        Write-Host "      Error: $_" -ForegroundColor Red
    } finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "      Re-analyzing..." -ForegroundColor White
    Push-Location -Path (Split-Path $TargetDir -Parent)
    try {
        $analyzeOutput2 = flutter analyze lib 2>&1
        $analyzeOutput2 | Out-File -FilePath "$OutputDir\flutter_analyze_after_fix.log" -Encoding UTF8

        $errorsAfter = @()
        Get-Content "$OutputDir\flutter_analyze_after_fix.log" | ForEach-Object {
            if ($_ -match '^\s*error\s+-') {
                $errorsAfter += $_
            }
        }

        $fixed = $errors.Count - $errorsAfter.Count
        if ($fixed -gt 0) {
            Write-Host "      Fixed $fixed issues" -ForegroundColor Green
        }
        Write-Host "      Remaining errors: $($errorsAfter.Count)" -ForegroundColor Red

    } catch {
        Write-Host "      Error: $_" -ForegroundColor Red
    } finally {
        Pop-Location
    }
} else {
    Write-Host ""
    Write-Host "[5/5] Skipping auto-fix" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Scan complete" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Logs in: $OutputDir" -ForegroundColor Gray
Write-Host ""
