# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Native Windows PostgreSQL install/configure. Mirrors the Linux canonical
# 46_install_postgresql.sh via the shared PostgresqlManager (idempotent + :5432
# reuse). Same data dir (map_web_path "postgresql"), password store, app DBs.

# Variables (declared at the beginning of the file)
$WinCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common"
$STEP_NUMBER  = 33
$pgOk         = $false

. (Join-Path $WinCommonDir "GlobalVars.ps1")
. (Join-Path $WinCommonDir "CommonFunc.ps1")
. (Join-Path $WinCommonDir "PostgresqlManager.ps1")

Write-ColorMessage "[Step $STEP_NUMBER] Native Windows PostgreSQL install/configure (idempotent, :5432 reuse)" -Type "Info"
if (-not $Global:IS_RUN_ADMIN) {
    Write-ColorMessage "[Step $STEP_NUMBER] Not elevated - service registration may be skipped (cluster can still start via pg_ctl)." -Type "Warning"
}

$pgOk = Ensure-Postgresql

if ($pgOk) {
    Write-ColorMessage "[Step $STEP_NUMBER] PostgreSQL ready on $($Global:PG_HOST):$($Global:PG_PORT) (data: $($Global:PG_DATA_DIR))." -Type "Success"
} else {
    Write-ColorMessage "[Step $STEP_NUMBER] PostgreSQL setup incomplete - see messages above." -Type "Error"
}
