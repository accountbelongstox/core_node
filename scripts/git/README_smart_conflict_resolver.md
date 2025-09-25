# 智能Git冲突解决工具 v2.0

## 功能特点

🚀 **全新智能版本**，专为解决Git合并冲突而设计

### 核心功能
- 🔍 **智能扫描**: 自动扫描项目中的所有代码文件，检测Git冲突标记
- 🤖 **智能分析**: 基于启发式规则推荐最佳解决策略
- 👀 **预览功能**: 显示冲突内容和解决后的预览效果
- 💾 **自动备份**: 解决冲突前自动备份原文件（时间戳+.backup扩展名）
- 📋 **会话记录**: 完整记录解决过程，支持回溯和审计
- 🎯 **多种策略**: 支持本地优先、远程优先、智能推荐三种策略

### 智能特性
- ✅ 跳过不必要的目录（node_modules、.git、build等）
- ✅ 支持多种代码文件格式（30+种编程语言）
- ✅ 智能过滤大文件和二进制文件
- ✅ 自动跳过脚本自身，避免误处理
- ✅ 错误处理和恢复机制

## 使用方法

### 基本用法

```bash
# 交互模式，默认保留本地版本
python smart_conflict_resolver.py

# 交互模式，默认保留远程版本
python smart_conflict_resolver.py --strategy remote

# 智能推荐模式
python smart_conflict_resolver.py --strategy smart

# 自动模式（不询问确认）
python smart_conflict_resolver.py --auto

# 指定扫描路径
python smart_conflict_resolver.py --path ../

# 指定备份目录
python smart_conflict_resolver.py --backup-dir ./backups
```

### 参数说明

| 参数 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--path` | `-p` | `../../` | 扫描路径 |
| `--backup-dir` | `-b` | `../../tmp/git_merge` | 备份目录 |
| `--strategy` | `-s` | `local` | 冲突解决策略 |
| `--auto` | `-a` | `False` | 自动模式 |
| `--version` | `-v` | - | 显示版本信息 |

### 策略选项

- **local**: 默认保留本地版本
- **remote**: 默认保留远程版本  
- **smart**: 智能分析推荐最佳版本

## 交互模式操作

在交互模式下，工具会显示每个冲突的详细信息：

```
🔥 冲突 1/3 - example.py
📍 行号: 15 - 25
🌿 本地分支: HEAD
🌐 远程分支: origin/main
🤖 智能推荐: 保留local版本

📝 本地版本 (HEAD):
────────────────────────────────────────
function hello() {
    console.log("Hello from local");
}

📝 远程版本 (origin/main):
────────────────────────────────────────
function hello() {
    console.log("Hello from remote");
}
```

### 操作选项

- `Y/y` - 应用当前解决方案
- `N/n` - 跳过此文件
- `L/l` - 切换到本地版本策略
- `R/r` - 切换到远程版本策略
- `S/s` - 使用智能推荐策略

## 文件结构

```
scripts/git/
├── smart_conflict_resolver.py    # 主程序
├── README_smart_conflict_resolver.md  # 使用说明
└── resolve_conflicts.py         # 旧版本（保留）

../../tmp/git_merge/              # 备份目录
├── example.py.20250110_143022.backup
├── session_20250110_143022.json
└── backup_log.txt
```

## 备份和恢复

### 备份文件命名规则
```
原文件名.时间戳.backup
例如: main.py.20250110_143022.backup
```

### 会话记录
每次运行都会创建会话记录文件，包含：
- 处理的文件列表
- 使用的策略
- 备份文件路径
- 统计信息

### 恢复备份
如果需要恢复某个文件：
```bash
# 查看备份文件
ls ../../tmp/git_merge/*.backup

# 恢复文件
cp ../../tmp/git_merge/main.py.20250110_143022.backup ./main.py
```

## 支持的文件类型

### 编程语言
- Python (.py)
- JavaScript/TypeScript (.js, .ts, .jsx, .tsx)
- Java (.java)
- C/C++ (.c, .cpp, .h, .hpp)
- C# (.cs)
- PHP (.php)
- Ruby (.rb)
- Go (.go)
- Rust (.rs)
- Swift (.swift)
- Kotlin (.kt)
- Scala (.scala)
- Dart (.dart)
- 等30+种语言

### 配置和文档
- JSON (.json)
- YAML (.yaml, .yml)
- XML (.xml)
- Markdown (.md)
- HTML/CSS (.html, .css, .scss)
- 配置文件 (.ini, .cfg, .conf)

## 安全特性

- ✅ 自动备份，防止数据丢失
- ✅ 跳过脚本自身，避免递归处理
- ✅ 错误处理，遇到问题不会中断整个流程
- ✅ 会话记录，支持操作审计
- ✅ 大文件过滤，避免处理二进制文件

## 故障排除

### 常见问题

1. **权限错误**
   ```bash
   chmod +x smart_conflict_resolver.py
   ```

2. **编码错误**
   - 工具会自动处理编码问题，使用 `errors='ignore'` 模式

3. **备份目录不存在**
   - 工具会自动创建备份目录

4. **文件被占用**
   - 确保文件没有被其他程序打开

### 调试模式
如果遇到问题，可以查看详细的错误信息和会话记录文件。

## 版本历史

- **v2.0** (2025-01-10): 全新智能版本
  - 智能冲突分析
  - 改进的用户界面
  - 会话记录功能
  - 更好的错误处理

- **v1.0**: 基础版本（resolve_conflicts.py）

## 贡献

欢迎提交问题和改进建议！
