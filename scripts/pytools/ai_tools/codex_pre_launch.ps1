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
    Codex CLI Pre-Launch Script

.DESCRIPTION
    This script executes before Codex CLI launches.
    Can be used for environment setup, validation, or other pre-launch tasks.

.PARAMETER WorkingDirectory
    The current working directory

.EXAMPLE
    & codex_pre_launch.ps1 -WorkingDirectory "D:\projects\my-project"
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$WorkingDirectory = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Pre-launch tasks can be added here
# Currently this script is a placeholder for future functionality

Write-Host "[INFO] Codex CLI pre-launch script executed" -ForegroundColor Cyan
if ($WorkingDirectory) {
    Write-Host "[INFO] Working Directory: $WorkingDirectory" -ForegroundColor Cyan
}
