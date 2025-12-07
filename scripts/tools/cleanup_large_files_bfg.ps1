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

# Cleanup Large Files using BFG Repo-Cleaner (Faster Alternative)
# BFG is 10-720x faster than git filter-branch

$ScriptDir = Split-Path -Parent $PSCommandPath
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..\..") | Select-Object -ExpandProperty Path
$BfgJar = Join-Path $ScriptDir "bfg.jar"
$BfgUrl = "https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"

Write-Host "================================================================" -ForegroundColor White
Write-Host "BFG Repo-Cleaner - Fast Git History Cleanup" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White
Write-Host ""

Set-Location $ProjectRoot

if (-not (Test-Path ".git" -PathType Container)) {
    Write-Host "Error: Not a Git repository" -ForegroundColor Red
    exit 1
}

$javaPath = Get-Command java -ErrorAction SilentlyContinue
if (-not $javaPath) {
    Write-Host "Error: Java is not installed" -ForegroundColor Red
    Write-Host "Install Java from: https://www.oracle.com/java/technologies/downloads/" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $BfgJar)) {
    Write-Host "Downloading BFG Repo-Cleaner..." -ForegroundColor Blue
    try {
        Invoke-WebRequest -Uri $BfgUrl -OutFile $BfgJar
        Write-Host "BFG downloaded" -ForegroundColor Green
    } catch {
        Write-Host "Failed to download BFG: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host "WARNING: This will rewrite Git history!" -ForegroundColor Yellow
Write-Host ""
Write-Host "This will remove:" -ForegroundColor White
Write-Host "  - All files larger than 100MB from history" -ForegroundColor White
Write-Host "  - Specific .hprof files" -ForegroundColor White
Write-Host ""
$confirm = Read-Host "Continue? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "Operation cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Step 1: Creating backup..." -ForegroundColor Blue
git branch backup-before-bfg 2>$null
Write-Host "Backup branch created: backup-before-bfg" -ForegroundColor Green

Write-Host ""
Write-Host "Step 2: Deleting large files from current HEAD..." -ForegroundColor Blue
$hprofPath = Join-Path $ProjectRoot "poly_apps\react_native_new_kotlin\*.hprof"
if (Test-Path $hprofPath) {
    Remove-Item $hprofPath -Force
}
git add .
git commit -m "Remove large .hprof files from HEAD" 2>$null

Write-Host ""
Write-Host "Step 3: Running BFG to clean history..." -ForegroundColor Blue
& java -jar $BfgJar --delete-files "*.hprof"
& java -jar $BfgJar --strip-blobs-bigger-than 100M

Write-Host ""
Write-Host "Step 4: Cleaning up..." -ForegroundColor Blue
git reflog expire --expire=now --all
git gc --prune=now --aggressive

Write-Host ""
Write-Host "Step 5: Adding .gitignore rules..." -ForegroundColor Blue
$gitignorePath = Join-Path $ProjectRoot ".gitignore"
$gitignoreContent = ""
if (Test-Path $gitignorePath) {
    $gitignoreContent = Get-Content $gitignorePath -Raw
}
if ($gitignoreContent -notmatch "\*\.hprof") {
    Add-Content -Path $gitignorePath -Value "*.hprof"
    git add .gitignore
    git commit -m "Add .hprof to .gitignore" 2>$null
}

Write-Host ""
$gitDirPath = Join-Path $ProjectRoot ".git"
$gitSize = (Get-ChildItem $gitDirPath -Recurse -Force | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host ("{0:N2} MB .git" -f $gitSize) -ForegroundColor White
Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "BFG cleanup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Review: git log --oneline | head -20" -ForegroundColor White
Write-Host "  2. Force push: git push origin main --force" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: Notify team before force pushing!" -ForegroundColor Yellow
Write-Host ""
