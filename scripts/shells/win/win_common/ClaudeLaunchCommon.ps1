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
