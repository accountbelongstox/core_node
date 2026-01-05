# Trim Cursor Files Script

## 功能说明

自动扫描 `core_node` 目录下所有 `cursor_*.md` 文件，当文件超过 2000 行时自动裁剪为保留末尾 2000 行。

## 位置

```
scripts/cursor_tools/trim_cursor_files.py
```

## 使用方法

### 基本用法

```bash
# 在 core_node 目录执行
cd /www/programing/core_node

# 使用默认设置 (保留末尾 2000 行)
python3 scripts/cursor_tools/trim_cursor_files.py

# 查看帮助
python3 scripts/cursor_tools/trim_cursor_files.py --help
```

### 高级用法

```bash
# 预览模式 (不实际修改文件)
python3 scripts/cursor_tools/trim_cursor_files.py --dry-run

# 自定义保留行数
python3 scripts/cursor_tools/trim_cursor_files.py --keep 1000

# 自定义触发阈值 (只处理超过 5000 行的文件)
python3 scripts/cursor_tools/trim_cursor_files.py --min 5000

# 指定扫描目录
python3 scripts/cursor_tools/trim_cursor_files.py --root /path/to/dir

# 组合使用
python3 scripts/cursor_tools/trim_cursor_files.py --keep 1500 --min 3000 --dry-run
```

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--root` | 扫描的根目录 | core_node 目录 |
| `--keep` | 保留的末尾行数 | 2000 |
| `--min` | 触发裁剪的最小行数 | 与 --keep 相同 |
| `--dry-run` | 预览模式，不实际修改文件 | False |
| `--verbose` | 显示详细输出 | False |

## 扫描规则

### 文件模式
- 文件名: `cursor_*.md`
- 示例: `cursor_debug.md`, `cursor_report.md`, `cursor_architecture_analysis_report.md`

### 跳过的目录 (共 85 个)

#### Node.js 相关 (6个)
- `node_modules`
- `.npm`
- `.yarn`
- `.pnp`
- `bower_components`
- `jspm_packages`

#### 构建/打包目录 (10个)
- `dist`
- `build`
- `out`
- `.next` (Next.js)
- `.nuxt` (Nuxt.js)
- `.output` (Nuxt 3)
- `.turbo` (Turborepo)
- `.vitepress` (VitePress)
- `.docusaurus` (Docusaurus)
- `_site` (Jekyll/其他静态站点生成器)

#### Python 相关 (15个)
- `__pycache__`
- `.pytest_cache`
- `.mypy_cache`
- `.ruff_cache`
- `.tox`
- `.nox`
- `venv`
- `env`
- `.venv`
- `.env`
- `site-packages`
- `.eggs`
- `*.egg-info`
- `htmlcov`
- `coverage`
- `.coverage`

#### PHP/Laravel 相关 (5个)
- `vendor`
- `storage`
- `bootstrap`
- `.phpunit.cache`
- `.phpunit.result.cache`

#### Dart/Flutter 相关 (5个)
- `.dart_tool`
- `.flutter-plugins`
- `.flutter-plugins-dependencies`
- `android`
- `ios`

#### 移动开发 (2个)
- `Pods` (iOS CocoaPods)
- `.gradle` (Android Gradle)

#### Rust 相关 (1个)
- `target`

#### Go 相关 (2个)
- `pkg`
- `bin`

#### 版本控制 (4个)
- `.git`
- `.svn`
- `.hg`
- `.gitignore`

#### IDE (5个)
- `.idea` (IntelliJ IDEA)
- `.vscode` (Visual Studio Code)
- `.vs` (Visual Studio)
- `.eclipse`
- `.settings`

#### 打包工具缓存 (3个)
- `.parcel-cache`
- `.webpack`
- `.rollup.cache`

#### 基础设施/DevOps (4个)
- `.terraform`
- `.serverless`
- `.vagrant`
- `.ansible`

#### 缓存目录 (5个)
- `.cache`
- `cache`
- `.tmp`
- `tmp`
- `temp`

#### 日志目录 (2个)
- `logs`
- `log`

#### 静态资源 (9个)
- `public`
- `static`
- `assets`
- `uploads`
- `media`
- `images`
- `img`
- `fonts`

#### 数据库 (3个)
- `db`
- `database`
- `migrations`

#### 其他 (4个)
- `.DS_Store` (macOS)
- `Thumbs.db` (Windows)
- `.sass-cache`
- `.less-cache`

## 输出示例

### 正常执行

```
============================================================
Trim cursor_*.md files to last 2000 lines
============================================================

Root directory: /www/programing/core_node
File pattern:   cursor_*.md
Keep lines:     2000
Min lines:      2000 (trim only if file > 2000 lines)
Skipping directories: 85 patterns

Scanning for cursor_*.md files...
Found 5 cursor_*.md file(s)

Processing: poly_apps/flutter_bloom/scripts/cursor_debug_script_execution_and_error.md
  Current lines: 131431
✓ Trimmed: 131431 → 2000 lines (removed 129431)
  Size: 5.5 MB → 80.4 KB (saved 5.5 MB)

Processing: test/cursor_appfactory_dashboard_mock_data_a.md
  Current lines: 500
→ Skipped (≤ 2000 lines, no need to trim)

============================================================
Summary
============================================================
Total files found:    5
Successfully trimmed: 1
Skipped:              4
Errors:               0
Total lines removed:  129431
Total size saved:     5.5 MB
============================================================
```

### 预览模式 (--dry-run)

```
============================================================
Trim cursor_*.md files to last 2000 lines
============================================================

Root directory: /www/programing/core_node
File pattern:   cursor_*.md
Keep lines:     2000
Min lines:      2000 (trim only if file > 2000 lines)
Mode:           DRY RUN (no files will be modified)
Skipping directories: 85 patterns

Scanning for cursor_*.md files...
Found 5 cursor_*.md file(s)

poly_apps/flutter_bloom/scripts/cursor_debug_script_execution_and_error.md
  Lines: 131431
  → Would trim: 131431 → 2000 (remove 129431 lines)

test/cursor_appfactory_dashboard_mock_data_a.md
  Lines: 500
  → Would skip (≤ 2000 lines)

============================================================
Summary
============================================================
Total files found:    5
Successfully trimmed: 0
Skipped:              0
Errors:               0
============================================================
```

## 安全特性

1. **临时文件机制**: 使用临时文件进行操作，确保原文件不损坏
2. **权限保持**: 保留原文件的权限设置
3. **错误处理**: 完善的异常捕获和错误报告
4. **预览模式**: `--dry-run` 可以在不修改文件的情况下查看将要进行的操作
5. **UTF-8 编码**: 正确处理 UTF-8 编码文件，忽略编码错误

## 性能

- 递归扫描整个 core_node 目录
- 智能跳过 85 个常见的不需要扫描的目录
- 仅处理 `cursor_*.md` 文件
- 大文件处理速度快（5.5MB 文件处理时间 < 1秒）

## 注意事项

1. **不可逆操作**: 裁剪后的内容无法恢复，请确保不需要的内容可以删除
2. **建议使用 --dry-run**: 首次使用建议先用 `--dry-run` 预览
3. **版本控制**: 如果文件在 git 管理下，可以通过 git 恢复
4. **定期执行**: 可以添加到定时任务中定期清理过大的日志文件

## 添加到定时任务

```bash
# 编辑 crontab
crontab -e

# 添加每天凌晨 3 点执行
0 3 * * * cd /www/programing/core_node && /usr/bin/python3 scripts/cursor_tools/trim_cursor_files.py >> /var/log/trim_cursor_files.log 2>&1
```

## 退出代码

- `0`: 成功执行（包括没有文件需要处理）
- `1`: 发生错误（目录不存在、文件处理失败等）

## 更新日志

### 2026-01-05
- 初始版本
- 支持递归扫描 cursor_*.md 文件
- 跳过 85 个常见的构建/缓存/依赖目录
- 支持预览模式和自定义参数
- 彩色输出和详细统计信息
