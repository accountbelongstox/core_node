# DotApps launcher: menu to create new app or run existing apps.
# Run from repo root: .\dotapps\start.ps1   or from dotapps: .\start.ps1

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = if (Test-Path (Join-Path $ScriptDir "..\dotcore")) { (Resolve-Path (Join-Path $ScriptDir "..")).Path } else { $ScriptDir }
$DotAppsDir = if (Test-Path (Join-Path $RepoRoot "dotapps")) { Join-Path $RepoRoot "dotapps" } else { $ScriptDir }
$DotCoreDir = Join-Path $RepoRoot "dotcore"
$SlnPath = Join-Path $DotCoreDir "dotcore.sln"

function Get-AppList {
    $list = @()
    $templateDir = Join-Path $DotAppsDir "_template"
    foreach ($dir in Get-ChildItem -Path $DotAppsDir -Directory) {
        if ($dir.Name.StartsWith("_") -or $dir.FullName -eq $templateDir) { continue }
        $csproj = Get-ChildItem -Path $dir.FullName -Filter "*.csproj" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($csproj) {
            $list += @{ Name = $dir.Name; Path = $dir.FullName; Csproj = $csproj.FullName }
        }
    }
    return $list
}

function Show-Menu {
    $apps = Get-AppList
    Write-Host ""
    Write-Host "=== DotApps Menu ===" -ForegroundColor Cyan
    Write-Host "  1. Create new app"
    $i = 2
    foreach ($a in $apps) {
        Write-Host "  $i. $($a.Name)"
        $i++
    }
    Write-Host "  Q. Quit"
    Write-Host ""
}

function New-App {
    $templateDir = Join-Path $DotAppsDir "_template"
    if (-not (Test-Path $templateDir)) {
        Write-Host "Template not found: $templateDir" -ForegroundColor Red
        return
    }
    Write-Host "Enter app name (e.g. MyTool): " -NoNewline
    $name = Read-Host
    $name = $name.Trim()
    if ([string]::IsNullOrWhiteSpace($name)) {
        Write-Host "App name is required." -ForegroundColor Yellow
        return
    }
    $appDir = Join-Path $DotAppsDir $name
    if (Test-Path $appDir) {
        Write-Host "Directory already exists: $appDir" -ForegroundColor Yellow
        return
    }
    Copy-Item -Path $templateDir -Destination $appDir -Recurse -Force
    $replaceScript = Join-Path $DotAppsDir "scripts\Replace-TemplateTokens.ps1"
    if (Test-Path $replaceScript) {
        & $replaceScript -AppName $name -TargetDir $appDir
    }
    Write-Host "Created app from template: $appDir" -ForegroundColor Green
    Write-Host "Add to solution: dotnet sln dotcore\dotcore.sln add dotapps\$name\$name.csproj"
    Write-Host "Run: dotnet run --project dotapps\$name\$name.csproj"
}

function Run-AppByIndex {
    param([int]$idx)
    $apps = Get-AppList
    # Menu: 2 = first app, 3 = second, ... so idx 2..(1+apps.Count) -> apps[0..(Count-1)]
    if ($idx -lt 2 -or $idx -gt (1 + $apps.Count)) { return }
    $selected = $apps[$idx - 2]
    Write-Host "Running: $($selected.Name) ..." -ForegroundColor Green
    Push-Location $RepoRoot
    try {
        dotnet run --project $selected.Csproj
    }
    finally {
        Pop-Location
    }
}

# Main loop: flat single-level menu (1 = Create new app, 2..N = run app by list order, Q = quit)
while ($true) {
    Show-Menu
    $choice = Read-Host "Choice"
    $trimmed = $choice.Trim().ToUpperInvariant()
    if ($trimmed -eq "Q") { Write-Host "Bye."; exit 0 }
    if ($trimmed -eq "1") { New-App; continue }
    $idx = 0
    [int]::TryParse($choice, [ref]$idx) | Out-Null
    if ($idx -ge 2) {
        Run-AppByIndex -idx $idx
    }
    else {
        Write-Host "Unknown option." -ForegroundColor Yellow
    }
}
