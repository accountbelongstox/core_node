# Debug registry structure
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$UTILS_PATH = Join-Path $SCRIPT_DIR "common\utils.ps1"

# Import utilities
. $UTILS_PATH

Write-Host "=== Debug Registry Structure ===" -ForegroundColor Yellow

$registry = Get-AppRegistry
if ($registry) {
    Write-Host "Registry type: $($registry.GetType())" -ForegroundColor Cyan
    Write-Host "Apps type: $($registry.apps.GetType())" -ForegroundColor Cyan
    Write-Host "Apps count: $($registry.apps.Count)" -ForegroundColor Cyan
    
    Write-Host ""
    Write-Host "Apps keys:" -ForegroundColor Yellow
    foreach ($key in $registry.apps.Keys) {
        Write-Host "  Key: '$key'" -ForegroundColor White
        $app = $registry.apps[$key]
        Write-Host "    App type: $($app.GetType())" -ForegroundColor Gray
        Write-Host "    ID: $($app.id)" -ForegroundColor Gray
        Write-Host "    Type: $($app.type)" -ForegroundColor Gray
        Write-Host "    Description: $($app.description)" -ForegroundColor Gray
        break  # Just show first one
    }
} else {
    Write-Host "No registry loaded" -ForegroundColor Red
}