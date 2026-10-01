<#
.SYNOPSIS
    Superseded entry point: forwards to Step69_InstallFrontendPackages.ps1, which owns the
    frontend dependency install (the UI uses bun; the legacy desktop-manager is unused).
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',   # unused; kept for PreparePycorePrerequisites.ps1's uniform call
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$frontendStep = Join-Path $PSScriptRoot 'Step69_InstallFrontendPackages.ps1'
& $frontendStep -Force:$Force
