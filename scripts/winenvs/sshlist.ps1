# SSH Connection Configuration Command List with Delete Function
# Generated on 2025-11-03 20:25:16

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptsDirPath = Split-Path $PSScriptRoot -Parent
$projectRootPath = Split-Path $scriptsDirPath -Parent
$winCommonDirPath = Join-Path (Join-Path $scriptsDirPath "shells") "win"
$winCommonDirPath = Join-Path $winCommonDirPath "win_common"
$windowsPathFunctionScript = Join-Path $winCommonDirPath "WindowsPathFunction.ps1"
. $windowsPathFunctionScript
Set-CoreNodePaths

Write-Host ""
Write-Host "SSH Connection Configuration Available Commands:" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$scriptPath = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptPath)) {
    $scriptPath = Get-Location
}

$files = Get-ChildItem -Path $scriptPath -Filter "ssh*.ps1" | Where-Object { $_.Name -ne "sshlist.ps1" }

if ($files.Count -eq 0) {
    Write-Host "No ssh commands found." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit
}

$counter = 0
foreach ($file in $files) {
    $counter++
    Write-Host "  $counter. $($file.BaseName)" -ForegroundColor White
}

Write-Host ""
Write-Host "Total: $($files.Count) files available" -ForegroundColor Green
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Environment Variables Status:" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  SSH_CONNECTION: Checking..." -ForegroundColor White Write-Host "  SSH_PASSWORD: Checking..." -ForegroundColor White
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "File Management Options:" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "1. Delete a file (enter file number)" -ForegroundColor White
Write-Host "2. Exit" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter your choice (1-2)"

if ($choice -eq "1") {
    Write-Host ""
    $fileNum = Read-Host "Enter file number to delete"

    if (-not [string]::IsNullOrWhiteSpace($fileNum)) {
        try {
            $fileNumInt = [int]$fileNum
            if ($fileNumInt -gt 0 -and $fileNumInt -le $files.Count) {
                $fileToDelete = $files[$fileNumInt - 1]
                Write-Host ""
                Write-Host "File to delete: $($fileToDelete.Name)" -ForegroundColor Yellow
                $confirm = Read-Host "Are you sure you want to delete this file? (Y/N)"

                if ($confirm -eq "Y" -or $confirm -eq "y") {
                    Remove-Item -Path $fileToDelete.FullName -Force
                    Write-Host "File deleted successfully: $($fileToDelete.Name)" -ForegroundColor Green
                } else {
                    Write-Host "Deletion cancelled." -ForegroundColor Yellow
                }
            } else {
                Write-Host "Invalid file number." -ForegroundColor Red
            }
        } catch {
            Write-Host "Invalid input." -ForegroundColor Red
        }
    }
    Write-Host ""
    Read-Host "Press Enter to exit"
}
