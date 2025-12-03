# ErrorHandler.ps1
# Error handling utilities for React Native scripts

function Invoke-CommandWithErrorHandling {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command,
        [Parameter(Mandatory = $true)]
        [string]$CommandDescription,
        [Parameter(Mandatory = $false)]
        [bool]$PauseOnError = $false
    )

    Write-Host ""
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host "  EXECUTING: $CommandDescription" -ForegroundColor Cyan
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host ""

    try {
        & $Command

        if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "===============================================================================" -ForegroundColor Red
            Write-Host "  ERROR: Command failed with exit code $LASTEXITCODE" -ForegroundColor Red
            Write-Host "  Command: $CommandDescription" -ForegroundColor Red
            Write-Host "===============================================================================" -ForegroundColor Red
            Write-Host ""

            if ($PauseOnError) {
                Write-Host "Press any key to continue..." -ForegroundColor Yellow
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            }

            return $false
        }

        Write-Host ""
        Write-Host "===============================================================================" -ForegroundColor Green
        Write-Host "  SUCCESS: $CommandDescription" -ForegroundColor Green
        Write-Host "===============================================================================" -ForegroundColor Green
        Write-Host ""

        return $true
    }
    catch {
        Write-Host ""
        Write-Host "===============================================================================" -ForegroundColor Red
        Write-Host "  EXCEPTION: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  Command: $CommandDescription" -ForegroundColor Red
        Write-Host "===============================================================================" -ForegroundColor Red
        Write-Host ""

        if ($PauseOnError) {
            Write-Host "Press any key to continue..." -ForegroundColor Yellow
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }

        return $false
    }
}
