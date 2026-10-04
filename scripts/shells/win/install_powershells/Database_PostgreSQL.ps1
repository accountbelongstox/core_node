# Native Windows PostgreSQL install/configure. Mirrors the Linux canonical
# 75_install_postgresql.sh via the shared PostgresqlManager (idempotent + :5432
# reuse). Same data dir (map_web_path "postgresql"), password store, app DBs.

# Variables (declared at the beginning of the file)
$WinCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common"
$COMPONENT_ID = 'Database_PostgreSQL'
$pgOk         = $false

. (Join-Path $WinCommonDir "GlobalVars.ps1")
. (Join-Path $WinCommonDir "CommonFunc.ps1")
. (Join-Path $WinCommonDir "PostgresqlManager.ps1")

if (-not (Test-DatabaseEngineSelected -Engine 'pg')) {
    Write-ColorMessage "[$COMPONENT_ID] Skipping PostgreSQL (DATABASE_ENGINE=$(Get-DatabaseEngine))." -Type "Info"
    return
}

Write-ColorMessage "[$COMPONENT_ID] Native Windows PostgreSQL install/configure (idempotent, :5432 reuse)" -Type "Info"
if (-not $Global:IS_RUN_ADMIN) {
    Write-ColorMessage "[$COMPONENT_ID] Not elevated - service registration may be skipped (cluster can still start via pg_ctl)." -Type "Warning"
}

$pgOk = Ensure-Postgresql

if ($pgOk) {
    Write-ColorMessage "[$COMPONENT_ID] PostgreSQL ready on $($Global:PG_HOST):$($Global:PG_PORT) (data: $($Global:PG_DATA_DIR))." -Type "Success"
} else {
    Write-ColorMessage "[$COMPONENT_ID] PostgreSQL setup incomplete - see messages above." -Type "Error"
}
