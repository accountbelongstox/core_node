# Replaces {{APP_NAME}} and {{ROOT_NAMESPACE}} in all files under TargetDir, then renames _app.csproj to AppName.csproj.
# Usage: .\Replace-TemplateTokens.ps1 -AppName "MyApp" -TargetDir "D:\repo\dotapps\MyApp"
param(
    [Parameter(Mandatory = $true)]
    [string]$AppName,
    [Parameter(Mandatory = $true)]
    [string]$TargetDir
)
$ErrorActionPreference = "Stop"
$RootNamespace = "DotApps.$AppName"
$csprojOld = Join-Path $TargetDir "_app.csproj"
$csprojNew = Join-Path $TargetDir "$AppName.csproj"

if (-not (Test-Path $TargetDir)) {
    Write-Error "TargetDir does not exist: $TargetDir"
}

Get-ChildItem -Path $TargetDir -Recurse -File | ForEach-Object {
    $path = $_.FullName
    if ($path -match '\\obj\\|\\bin\\|\.csproj\.user$') { return }
    $content = Get-Content -Path $path -Raw -ErrorAction SilentlyContinue
    if ($null -eq $content) { return }
    $updated = $content -replace '\{\{APP_NAME\}\}', $AppName -replace '\{\{ROOT_NAMESPACE\}\}', $RootNamespace
    if ($content -ne $updated) {
        Set-Content -Path $path -Value $updated -NoNewline
    }
}

if (Test-Path $csprojOld) {
    Rename-Item -Path $csprojOld -NewName "$AppName.csproj"
}
