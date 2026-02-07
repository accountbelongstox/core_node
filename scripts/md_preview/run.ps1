# md_preview launcher: save cwd, install deps if needed, start preview, then restore cwd
$InitialDir = Get-Location
Set-Location $PSScriptRoot
try {
  if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm install --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  node index.js @args
} finally {
  Set-Location $InitialDir
}
