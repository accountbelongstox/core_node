# 修复 Git 历史中的敏感信息
# 这个脚本会修改 Git 历史，将旧 commit 中的敏感信息替换为新的拆分版本

Write-Host "开始修复 Git 历史中的敏感信息..." -ForegroundColor Yellow

# 检查是否在正确的目录
if (-not (Test-Path ".git")) {
    Write-Host "错误: 不在 Git 仓库根目录" -ForegroundColor Red
    exit 1
}

# 备份当前分支
$backupBranch = "backup-before-history-fix-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-Host "创建备份分支: $backupBranch" -ForegroundColor Cyan
git branch $backupBranch

# 找到包含敏感信息的 commit
$problematicCommit = "c511cf4f"
Write-Host "找到问题 commit: $problematicCommit" -ForegroundColor Cyan

# 使用 git filter-branch 来修改历史
# 这会替换所有 commit 中该文件的内容
Write-Host "使用 git filter-branch 修改历史..." -ForegroundColor Yellow
Write-Host "警告: 这将重写 Git 历史，请确保已备份！" -ForegroundColor Red

# 创建一个临时脚本来替换文件内容
$filterScript = @"
#!/bin/sh
git checkout HEAD -- poly_apps/top-router/src/services/geminiAccountService.js 2>/dev/null || exit 0
if git show HEAD:poly_apps/top-router/src/services/geminiAccountService.js | grep -q "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j"; then
    # 如果文件存在且包含敏感信息，用当前版本替换
    git checkout HEAD -- poly_apps/top-router/src/services/geminiAccountService.js
fi
"@

# 由于是 Windows，我们使用不同的方法
Write-Host "使用交互式 rebase 来修改历史..." -ForegroundColor Yellow
Write-Host "请手动执行以下命令来修改 Git 历史:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. git rebase -i c511cf4f^" -ForegroundColor Green
Write-Host "2. 将包含敏感信息的 commit 标记为 'edit'" -ForegroundColor Green
Write-Host "3. 对于每个标记为 'edit' 的 commit，执行:" -ForegroundColor Green
Write-Host "   git checkout HEAD -- poly_apps/top-router/src/services/geminiAccountService.js" -ForegroundColor Green
Write-Host "   git add poly_apps/top-router/src/services/geminiAccountService.js" -ForegroundColor Green
Write-Host "   git commit --amend --no-edit" -ForegroundColor Green
Write-Host "   git rebase --continue" -ForegroundColor Green
Write-Host ""
Write-Host "或者使用 BFG Repo-Cleaner (推荐):" -ForegroundColor Yellow
Write-Host "1. 下载 BFG: https://rtyley.github.io/bfg-repo-cleaner/" -ForegroundColor Green
Write-Host "2. java -jar bfg.jar --replace-text passwords.txt" -ForegroundColor Green
Write-Host ""

