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

<#
.SYNOPSIS
    Git Management Functions - Python-based with File Variables
.DESCRIPTION
    Provides Git Management functionality using Python for menu organization
    and file variables for communication between Python and PowerShell
#>

# File variables directory
$script:GIT_VARS_DIR = Join-Path $env:USERPROFILE ".core_node\.build_global_vars"

# Helper functions for file variables
function Read-GitVar {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Key,

        [Parameter(Mandatory = $false)]
        [string]$Default = ""
    )

    $varFile = Join-Path $script:GIT_VARS_DIR $Key

    if (Test-Path $varFile) {
        return (Get-Content -Path $varFile -Raw).Trim()
    } else {
        return $Default
    }
}

function Write-GitVar {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Key,

        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    # Ensure directory exists
    if (-not (Test-Path $script:GIT_VARS_DIR)) {
        New-Item -Path $script:GIT_VARS_DIR -ItemType Directory -Force | Out-Null
    }

    $varFile = Join-Path $script:GIT_VARS_DIR $Key
    Set-Content -Path $varFile -Value $Value -NoNewline
}

function Remove-GitVar {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Key
    )

    $varFile = Join-Path $script:GIT_VARS_DIR $Key
    if (Test-Path $varFile) {
        Remove-Item -Path $varFile -Force
    }
}

function Clear-GitVars {
    if (Test-Path $script:GIT_VARS_DIR) {
        Get-ChildItem -Path $script:GIT_VARS_DIR -Filter "git_*" | Remove-Item -Force
    }
}

function Show-GitManagementMenu {
    <#
    .SYNOPSIS
        Shows the Git Management menu using Python
    .DESCRIPTION
        Calls Python script to show menu and handle user input,
        then reads file variables to execute shell commands
    #>

    while ($true) {
        # Clear previous variables
        Clear-GitVars

        # Get paths
        $gitManagementPy = Join-Path $Global:CORE_NODE_SCRIPTS_DIR "git\git_management.py"

        # Check if Python script exists
        if (-not (Test-Path $gitManagementPy)) {
            Write-ColorMessage -Message "Error: Git Management Python script not found at $gitManagementPy" -Type "Error"
            Read-Host "Press Enter to continue"
            return
        }

        # Call Python to show menu and handle user input
        try {
            python $gitManagementPy
        } catch {
            Write-ColorMessage -Message "Error calling Python: $_" -Type "Error"
            Read-Host "Press Enter to continue"
            return
        }

        # Read operation status from file variable
        $operationStatus = Read-GitVar -Key "git_operation_status" -Default "cancelled"
        $operationType = Read-GitVar -Key "git_operation_type" -Default ""
        $menuBack = Read-GitVar -Key "git_menu_back" -Default "false"

        # Check if user wants to go back to main menu
        if ($menuBack -eq "true") {
            Clear-GitVars
            return
        }

        # Check operation status
        if ($operationStatus -eq "cancelled") {
            Write-Host ""
            Write-ColorMessage -Message "Operation cancelled." -Type "Warning"
            Read-Host "Press Enter to return to Git Management menu"
            continue
        }

        if ($operationStatus -eq "failed") {
            $errorMsg = Read-GitVar -Key "git_operation_message" -Default "Unknown error"
            Write-Host ""
            Write-ColorMessage -Message "Operation failed: $errorMsg" -Type "Error"
            Read-Host "Press Enter to return to Git Management menu"
            continue
        }

        # Execute the shell command if operation is pending
        if ($operationStatus -eq "pending") {
            $shellScript = Read-GitVar -Key "git_shell_script" -Default ""

            if ($shellScript) {
                Write-Host ""
                Write-ColorMessage -Message "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -Type "Info"
                Write-ColorMessage -Message "Executing Git operation..." -Type "Info"
                Write-ColorMessage -Message "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -Type "Info"
                Write-Host ""

                # Change to project directory
                $originalLocation = Get-Location
                Set-Location $Global:CORE_NODE_DIR

                try {
                    # Execute the shell command
                    Invoke-Expression $shellScript
                    $execResult = $LASTEXITCODE

                    # Update status based on execution result
                    if ($execResult -eq 0 -or $null -eq $execResult) {
                        Write-GitVar -Key "git_operation_status" -Value "success"
                        Write-Host ""
                        Write-ColorMessage -Message "✓ Operation completed successfully!" -Type "Success"

                        # Show backup branch info for force overwrite
                        if ($operationType -eq "force_overwrite") {
                            $backupBranch = Read-GitVar -Key "git_backup_branch" -Default ""
                            if ($backupBranch) {
                                Write-Host ""
                                Write-ColorMessage -Message "Your local changes have been backed up to: $backupBranch" -Type "Info"
                            }
                        }
                    } else {
                        Write-GitVar -Key "git_operation_status" -Value "failed"
                        Write-Host ""
                        Write-ColorMessage -Message "✗ Operation failed." -Type "Error"
                        Write-ColorMessage -Message "Please check the output above for details." -Type "Warning"
                    }
                } catch {
                    Write-GitVar -Key "git_operation_status" -Value "failed"
                    Write-Host ""
                    Write-ColorMessage -Message "✗ Operation failed with exception: $_" -Type "Error"
                } finally {
                    Set-Location $originalLocation
                }

                Write-Host ""
                Write-ColorMessage -Message "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -Type "Info"
            } else {
                Write-Host ""
                Write-ColorMessage -Message "Error: No shell command generated." -Type "Error"
                Write-GitVar -Key "git_operation_status" -Value "failed"
            }
        }

        # Pause before returning to menu
        Write-Host ""
        Read-Host "Press Enter to return to Git Management menu"
    }
}

# Backward compatibility wrapper
function Show-GitSourceSubMenu {
    Show-GitManagementMenu
}

# Export functions
Export-ModuleMember -Function @(
    'Show-GitManagementMenu',
    'Show-GitSourceSubMenu',
    'Read-GitVar',
    'Write-GitVar',
    'Remove-GitVar',
    'Clear-GitVars'
)
