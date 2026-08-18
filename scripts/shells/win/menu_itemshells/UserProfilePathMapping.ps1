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
    Apply default user profile path mappings (all dot-prefixed folders) from dd Windows Management menu.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"
#endregion

#region Bootstrap
. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")
. (Join-Path $script:WIN_COMMON_DIR "PathMappingLib.ps1")
#endregion

#region Main
function Show-UserProfilePathMappingMenu {
    Clear-Host
    Write-PathMapLog -Message "User profile path mapping (idempotent, mklink /J junctions)" -Type "Info"
    Write-Host ""
    Write-Host "  C:\Users\$env:USERNAME\<dot-folder>  ->  D:\programing\Users\$env:USERNAME\<dot-folder>"
    Write-Host "  (all dot-prefixed folders under the profile, except .ssh)"
    Write-Host ""
    Write-Host "  Close apps using mapped folders before mapping. Occupied directories are skipped with a warning."
    Write-Host ""

    $ok = Invoke-DefaultUserProfilePathMappings -UserName $env:USERNAME
    Write-Host ""
    if ($ok) {
        Write-PathMapLog -Message "Path mapping finished successfully." -Type "Success"
    }
    else {
        Write-PathMapLog -Message "Path mapping finished with errors." -Type "Error"
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    Show-UserProfilePathMappingMenu
    Wait-MenuContinue
}
#endregion
