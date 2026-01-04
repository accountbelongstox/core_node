# Git Wildcard Cleanup Feature

## 功能概述

Git Management 工具的选项 4 "Remove directories from Git history" 现已支持通配符模式，可以批量删除所有子目录中的特定目录。

## 支持的平台

- ✅ Linux
- ✅ Windows
- ✅ macOS

## 支持的通配符

| 通配符 | 说明 | 示例 |
|--------|------|------|
| `*` | 匹配任意字符（不跨目录） | `poly_apps/*/dist` |
| `**` | 递归匹配所有目录层级 | `**/.outputs` |
| `?` | 匹配单个字符 | `test?.txt` |
| `[abc]` | 匹配方括号中的任意一个字符 | `[tT]est` |

## 使用示例

### 1. 删除所有 `.outputs` 目录

```bash
# 输入模式
**/.outputs

# 匹配结果
poly_apps/app1/.outputs
poly_apps/app2/.outputs
pycore/module1/.outputs
...
```

### 2. 删除所有 `node_modules` 目录

```bash
# 输入模式
**/node_modules

# 匹配结果
node_modules/
poly_apps/app1/node_modules/
poly_apps/app2/node_modules/
...
```

### 3. 删除多个模式（空格分隔）

```bash
# 输入模式
**/.venv **/node_modules **/__pycache__

# 匹配结果
- 所有 .venv 目录
- 所有 node_modules 目录
- 所有 __pycache__ 目录
```

### 4. 删除特定应用下的 dist 目录

```bash
# 输入模式
poly_apps/**/dist

# 匹配结果
poly_apps/appfactory-master-dashboard/dist
poly_apps/laravel_dashboard/dist
poly_apps/wordflow-ai/dist
...
```

## 工作原理

### 阶段 1: 物理删除（当前 HEAD）

使用 Python `pathlib.glob()` 进行跨平台通配符匹配：

```python
# 检测通配符
has_wildcards = any(char in dir_path for char in ['*', '?', '[', ']'])

if has_wildcards:
    # 使用 glob 匹配所有符合的目录
    matched_paths = list(core_node_root.glob(pattern))

    # 删除所有匹配的目录
    for path in matched_paths:
        if path.is_dir():
            shutil.rmtree(path)
```

### 阶段 2: 历史清理（Git History）

使用 `git-filter-repo` 从 Git 历史中删除：

```bash
git filter-repo --path '**/.outputs' --invert-paths --force
```

`git-filter-repo` 原生支持 glob 通配符，无需额外处理。

## 实测数据

基于当前项目测试结果：

| 模式 | 匹配数量 | 说明 |
|------|---------|------|
| `**/node_modules` | 6042 | 所有 node_modules 目录 |
| `**/__pycache__` | 131 | 所有 Python 缓存目录 |
| `poly_apps/**/dist` | 668 | poly_apps 下的所有 dist 目录 |
| `**/.outputs` | 0 | 当前项目中不存在 |
| `**/.venv` | 0 | 当前项目中不存在 |

## 安全特性

1. **双重确认**：操作前需要确认
2. **自动备份**：创建备份分支（`backup-before-filter-repo-YYYYMMDD-HHMMSS`）
3. **详细日志**：显示每个匹配和删除的目录
4. **错误处理**：单个目录删除失败不影响其他目录
5. **统计信息**：显示总共删除的目录数量

## 示例输出

```bash
╔════════════════════════════════════════════════════════════════╗
║         REMOVE DIRECTORIES FROM GIT HISTORY                   ║
╚════════════════════════════════════════════════════════════════╝

Examples:
  • Direct path: .venv, node_modules, dist, __pycache__
  • Wildcard pattern: **/.outputs (all .outputs dirs)
  • Multiple patterns: **/.venv **/node_modules

You can enter multiple directories separated by spaces
Supports wildcards: * (any chars), ** (recursive), ? (single char)

Enter directory path(s) to remove: **/.outputs

Searching for pattern: **/.outputs
  Found 5 matching directories
  [DEBUG] Removing: poly_apps/app1/.outputs
  ✓ Removed: poly_apps/app1/.outputs
  [DEBUG] Removing: poly_apps/app2/.outputs
  ✓ Removed: poly_apps/app2/.outputs
  ...

Total directories removed: 5
```

## 技术实现

### 跨平台路径处理

```python
# 处理 Windows 和 Linux 的路径分隔符
dir_path_clean = dir_path.rstrip('/').rstrip('\\')

# 使用 pathlib.Path 进行跨平台操作
from pathlib import Path
matched_paths = list(self.core_node_root.glob(dir_path_clean))
```

### pathlib.glob() 的优势

1. **跨平台**：Windows、Linux、macOS 统一接口
2. **原生通配符**：支持 `*`, `**`, `?`, `[]` 等
3. **返回 Path 对象**：方便后续操作
4. **安全性**：自动处理路径规范化

## 注意事项

⚠️ **重要警告**：

1. 此操作会**重写 Git 历史**
2. `git-filter-repo` 会**自动删除所有 remotes**
3. 需要 **force push** 才能更新远程仓库
4. 建议先在测试分支或测试仓库验证

## 恢复操作

如果操作后想恢复，可以切换到备份分支：

```bash
# 查看所有备份分支
git branch | grep backup-before-filter-repo

# 恢复到备份分支
git checkout backup-before-filter-repo-20251227-123456
```

## 相关文件

- `scripts/git/git_management.py` - 主实现文件
- `test_wildcard_glob.py` - 通配符功能测试脚本

## 测试验证

运行测试脚本验证通配符功能：

```bash
cd /www/programing/core_node
python3 test_wildcard_glob.py
```

## 修改历史

- 2025-12-27: 添加通配符支持（Windows + Linux）
- 原始版本: 仅支持直接路径
