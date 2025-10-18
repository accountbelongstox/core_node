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

# Error Handling Functions

function Show-ErrorAndPause {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ErrorMessage,
        [Parameter(Mandatory = $false)]
        [string]$ErrorDetails = "",
        [Parameter(Mandatory = $false)]
        [int]$ExitCode = 1
    )

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "           ERROR OCCURRED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $ErrorMessage" -ForegroundColor Red

    if (-not [string]::IsNullOrEmpty($ErrorDetails)) {
        Write-Host ""
        Write-Host "Details:" -ForegroundColor Yellow
        Write-Host "$ErrorDetails" -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host "Exit Code: $ExitCode" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Cyan

    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

    exit $ExitCode
}

function Invoke-CommandWithErrorHandling {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command,
        [Parameter(Mandatory = $true)]
        [string]$CommandDescription,
        [Parameter(Mandatory = $false)]
        [bool]$PauseOnError = $true
    )

    try {
        & $Command

        if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
            if ($PauseOnError) {
                Show-ErrorAndPause -ErrorMessage "$CommandDescription failed" -ErrorDetails "Exit code: $LASTEXITCODE" -ExitCode $LASTEXITCODE
            }
            else {
                throw "$CommandDescription failed with exit code $LASTEXITCODE"
            }
        }
    }
    catch {
        if ($PauseOnError) {
            Show-ErrorAndPause -ErrorMessage "$CommandDescription failed" -ErrorDetails $_.Exception.Message
        }
        else {
            throw
        }
    }
}
