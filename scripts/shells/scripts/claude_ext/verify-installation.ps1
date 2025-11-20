# Test Script - Verify Claude Extension Installation

Write-Host "========================================"
Write-Host "  Claude Extension - Verification"
Write-Host "========================================"
Write-Host ""

$cliDir = "D:\.dev_win11\node\node_modules\@anthropic-ai\claude-code"
$extDir = Join-Path $cliDir "claude-ext"
$claudeMorePath = "D:\.dev_win11\node\claudeMore.ps1"

$checks = @(
    @{
        Name = "cli.beautified.js exists"
        Path = Join-Path $cliDir "cli.beautified.js"
    },
    @{
        Name = "cli.beautified.js.backup exists"
        Path = Join-Path $cliDir "cli.beautified.js.backup"
    },
    @{
        Name = "input-capture.mjs exists"
        Path = Join-Path $extDir "input-capture.mjs"
    },
    @{
        Name = "claudeMore.ps1 exists"
        Path = $claudeMorePath
    }
)

$allPassed = $true

foreach ($check in $checks) {
    Write-Host "Checking: $($check.Name)..." -NoNewline

    if (Test-Path $check.Path) {
        Write-Host " [OK]" -ForegroundColor Green
    } else {
        Write-Host " [FAILED]" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host ""
Write-Host "Verifying injections..."

$beautifiedPath = Join-Path $cliDir "cli.beautified.js"
$content = Get-Content $beautifiedPath -Raw

Write-Host "  Header injection..." -NoNewline
if ($content -match 'CLAUDE-EXT: INJECTED') {
    Write-Host " [OK]" -ForegroundColor Green
} else {
    Write-Host " [FAILED]" -ForegroundColor Red
    $allPassed = $false
}

Write-Host "  Import statement..." -NoNewline
if ($content -match "import\('./claude-ext/input-capture\.mjs'\)") {
    Write-Host " [OK]" -ForegroundColor Green
} else {
    Write-Host " [FAILED]" -ForegroundColor Red
    $allPassed = $false
}

Write-Host "  Submit hook..." -NoNewline
if ($content -match "__inputCapture\.captureSubmit") {
    Write-Host " [OK]" -ForegroundColor Green
} else {
    Write-Host " [FAILED]" -ForegroundColor Red
    $allPassed = $false
}

Write-Host "  Change hook..." -NoNewline
if ($content -match "__inputCapture\.captureChange") {
    Write-Host " [OK]" -ForegroundColor Green
} else {
    Write-Host " [FAILED]" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""
Write-Host "Verifying claudeMore.ps1..."

$claudeMoreContent = Get-Content $claudeMorePath -Raw

Write-Host "  Uses cli.beautified.js..." -NoNewline
if ($claudeMoreContent -match 'cli\.beautified\.js') {
    Write-Host " [OK]" -ForegroundColor Green
} else {
    Write-Host " [FAILED]" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""
Write-Host "========================================"

if ($allPassed) {
    Write-Host "  All checks passed!" -ForegroundColor Green
    Write-Host "========================================"
    Write-Host ""
    Write-Host "You can now use:" -ForegroundColor Cyan
    Write-Host "  claudeMore" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Logs will be saved to:" -ForegroundColor Cyan
    Write-Host "  $extDir\input-logs\" -ForegroundColor Yellow
} else {
    Write-Host "  Some checks failed!" -ForegroundColor Red
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Please run setup again:" -ForegroundColor Yellow
    Write-Host "  .\setup-claude-ext.ps1 -Force"
}

Write-Host ""
