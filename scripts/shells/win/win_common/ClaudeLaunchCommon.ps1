# Claude Code is native-only (AiCliProvisionCommon.ps1 Invoke-AiCliNativeEnsure):
# the official %USERPROFILE%\.local\bin\claude.exe, or $null when it is missing.
function Resolve-ClaudeCodeExecutable {
    $localBinExe = Join-Path (Join-Path (Join-Path $env:USERPROFILE ".local") "bin") "claude.exe"

    if (Test-Path -LiteralPath $localBinExe -PathType Leaf) {
        return $localBinExe
    }
    return $null
}
