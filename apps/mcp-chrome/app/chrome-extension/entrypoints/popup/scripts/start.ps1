# Popup dev helper: bun install + wxt dev, open Chrome extensions page, restore cwd.

$ErrorActionPreference = "Continue"

$InitialDir = $null
$ScriptDir = $null
$PopupDir = $null
$EntrypointsDir = $null
$ExtensionRoot = $null
$ChromeExe = $null
$ProgramFilesChrome = $null
$LocalAppDataChrome = $null

$InitialDir = Get-Location
$ScriptDir = $PSScriptRoot
$PopupDir = Split-Path -Parent $ScriptDir
$EntrypointsDir = Split-Path -Parent $PopupDir
$ExtensionRoot = Split-Path -Parent $EntrypointsDir

$ExtensionRoot = Resolve-Path -LiteralPath $ExtensionRoot

Write-Host ""
Write-Host "========================================"
Write-Host "  chrome-mcp-server popup dev (Windows)"
Write-Host "========================================"
Write-Host ""
Write-Host ('[*] Initial directory: ' + $InitialDir.Path)
Write-Host ('[*] Extension root: ' + $ExtensionRoot)
Write-Host ""

Set-Location -LiteralPath $ExtensionRoot

try {
    Write-Host '[*] bun install (live output)'
    Write-Host "----------------------------------------"
    & bun install
    Write-Host "----------------------------------------"
    Write-Host ""

    $ProgramFilesChrome = Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"
    $LocalAppDataChrome = Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"

    if (Test-Path -LiteralPath $ProgramFilesChrome) {
        $ChromeExe = $ProgramFilesChrome
    } elseif (Test-Path -LiteralPath $LocalAppDataChrome) {
        $ChromeExe = $LocalAppDataChrome
    } else {
        $ChromeExe = $null
    }

    Write-Host '[*] Opening Chrome extension debug pages (non-blocking)'
    try {
        if ($null -ne $ChromeExe) {
            Start-Process -FilePath $ChromeExe -ArgumentList "chrome://extensions/"
            Start-Process -FilePath $ChromeExe -ArgumentList "chrome://inspect/#extensions"
        } else {
            Start-Process -FilePath "chrome" -ArgumentList "chrome://extensions/" -ErrorAction SilentlyContinue
        }
    } catch {
        Write-Host '[!] Could not launch Chrome automatically. Open chrome://extensions/ manually.'
    }

    Write-Host ""
    Write-Host '[*] bun run dev (wxt) - press Ctrl+C to stop'
    Write-Host "----------------------------------------"
    & bun run dev
    Write-Host "----------------------------------------"
    Write-Host ""
} finally {
    Set-Location -LiteralPath $InitialDir.Path
    Write-Host ('[*] Restored directory: ' + $InitialDir.Path)
    Write-Host ""
}
