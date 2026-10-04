# Native Windows MySQL (latest) install/configure, governed by DATABASE_ENGINE (mysql | both).
# Mirrors the Linux 85_install_mysql.sh via the shared MysqlManager (idempotent + port reuse).

# Variables (declared at the beginning of the file)
$WinCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common"
$COMPONENT_ID = 'Database_MySQL'
$mysqlOk = $false

. (Join-Path $WinCommonDir "GlobalVars.ps1")
. (Join-Path $WinCommonDir "CommonFunc.ps1")
. (Join-Path $WinCommonDir "MysqlManager.ps1")

if (-not (Test-DatabaseEngineSelected -Engine 'mysql')) {
    Write-ColorMessage "[$COMPONENT_ID] Skipping MySQL (DATABASE_ENGINE=$(Get-DatabaseEngine))." -Type "Info"
    return
}

Write-ColorMessage "[$COMPONENT_ID] Native Windows MySQL install/configure (latest, idempotent, port reuse)" -Type "Info"
if (-not $Global:IS_RUN_ADMIN) {
    Write-ColorMessage "[$COMPONENT_ID] Not elevated - service registration is skipped (mysqld still starts for this session)." -Type "Warning"
}

$mysqlOk = Ensure-Mysql

if ($mysqlOk) {
    Write-ColorMessage "[$COMPONENT_ID] MySQL ready." -Type "Success"
} else {
    Write-ColorMessage "[$COMPONENT_ID] MySQL setup incomplete - see messages above." -Type "Error"
}
