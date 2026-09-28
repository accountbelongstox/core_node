# One-click debug launcher for DotApps.d3check
# Usage (from repo root): .\scripts\debug_d3check.ps1

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$OriginalDir = Get-Location

try {
    Set-Location -LiteralPath $RepoRoot

    Write-Host "=== Starting d3check (Debug) ===" -ForegroundColor Cyan
    Write-Host "RepoRoot: $RepoRoot" -ForegroundColor Gray

    $csproj = "dotapps/d3check/d3check.csproj"
    if (-not (Test-Path -LiteralPath $csproj)) {
        throw "csproj not found: $csproj"
    }

    # Run WPF app in Debug
    & dotnet run --project $csproj -c Debug
    $exitCode = $LASTEXITCODE
}
finally {
    Set-Location -LiteralPath $OriginalDir
}

exit $exitCode
