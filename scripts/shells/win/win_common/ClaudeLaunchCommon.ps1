function Resolve-ClaudeCodeExecutable {
    $candidatePaths = @()
    $localBinExe = $null
    $claudeCommand = $null
    $commandBaseDir = $null
    $npmPackageExe = $null
    $candidatePath = $null

    $localBinExe = Join-Path $env:USERPROFILE ".local\bin\claude.exe"
    if (Test-Path $localBinExe) {
        $candidatePaths += $localBinExe
    }

    $claudeCommand = Get-Command "claude" -ErrorAction SilentlyContinue
    if ($claudeCommand) {
        if ($claudeCommand.CommandType -eq 'Application') {
            $candidatePaths += $claudeCommand.Source
        }
        else {
            $commandBaseDir = Split-Path $claudeCommand.Source -Parent
            $npmPackageExe = Join-Path $commandBaseDir "node_modules\@anthropic-ai\claude-code\bin\claude.exe"
            if (Test-Path $npmPackageExe) {
                $candidatePaths += $npmPackageExe
            }
        }
    }

    foreach ($candidatePath in $candidatePaths) {
        if ((Test-Path $candidatePath) -and -not (Test-Path $candidatePath -PathType Container)) {
            return $candidatePath
        }
    }

    return $null
}
