# Large Files Scanner - 使用说明

## 功能说明

这个脚本用于扫描项目中的大文件，帮助分析项目体积过大的原因。

**重要提示：此脚本仅进行扫描和分析，不会修改任何文件或 Git 仓库。**

## 主要功能

1. **扫描所有文件** - 遍历整个项目目录
2. **识别大文件** - 标记超过阈值的文件（默认 1 MB）
3. **统计分析** - 提供详细的项目体积分析
4. **导出报告** - 可选导出 CSV 格式报告

## 使用方法

### 运行脚本

```powershell
# 方法 1: 直接运行
.\scripts\scan-large-files.ps1

# 方法 2: 使用 PowerShell
powershell -ExecutionPolicy Bypass -File ".\scripts\scan-large-files.ps1"

# 方法 3: 从脚本目录运行
cd scripts
.\scan-large-files.ps1
```

## 配置选项

在脚本开头可以修改以下配置：

```powershell
$PROJECT_ROOT = "D:\programing\core_node"  # 项目根目录
$SIZE_THRESHOLD_MB = 1                      # 大文件阈值（MB）
$TOP_FILES_COUNT = 50                       # 显示前 N 个最大文件
```

### 阈值建议

- **1 MB** - 适合识别一般大文件
- **5 MB** - 适合识别较大文件
- **10 MB** - 适合识别超大文件

## 输出内容

### 1. 项目概览

```
Total Project Size : 125.34 MB
Total Files        : 1,234
Large Files (>1 MB): 23
```

### 2. 目录占用排行

显示占用空间最大的前 10 个目录：

```
Top Directories by Size
========================================

  45.23 MB    234 files      (36.08%) poly_apps
  32.10 MB    156 files      (25.61%) node_modules
  15.67 MB    89 files       (12.50%) dist
```

### 3. 文件类型统计

按文件数量排序的文件类型：

```
Top File Types by Count
========================================

  12.34 MB    345 files      .js
  8.90 MB     234 files      .ts
  5.67 MB     123 files      .json
```

### 4. 最大文件列表

显示前 50 个最大的文件：

```
Top 50 Largest Files
========================================

   1. 15.23 MB  poly_apps/app1/dist/bundle.js
   2. 12.45 MB  poly_apps/app2/node_modules/electron/electron.exe
   3. 8.90 MB   poly_apps/app3/assets/video.mp4
```

### 5. 统计摘要

```
Summary Statistics
========================================

Large Files Total  : 78.90 MB
Percentage of Total: 62.96%

[WARN] Large files (>1 MB) account for 62.96% of total project size
```

## 导出选项

扫描完成后，可以选择导出以下报告：

### 1. 大文件列表 (large-files-report.csv)

包含所有超过阈值的文件：

```csv
Size,Size (MB),Path,Name,Extension,LastWriteTime
15967232,15.23,poly_apps/app1/dist/bundle.js,bundle.js,.js,2025-12-19 10:30:00
```

### 2. 所有文件列表 (all-files-report.csv)

包含项目中的所有文件（排除 node_modules 等）：

```csv
Size,Size (MB),Path,Name,Extension,LastWriteTime
1024,0.00,package.json,package.json,.json,2025-12-19 09:00:00
```

### 3. 目录汇总 (directory-summary-report.csv)

按目录汇总的统计数据：

```csv
Directory,Size,Size (MB),FileCount
poly_apps,47456789,45.23,234
scripts,3456789,3.30,12
```

## 排除的目录

以下目录会被自动排除，不参与扫描：

- `node_modules` - Node.js 依赖包
- `.git` - Git 仓库数据
- `dist` - 构建输出目录
- `dist-electron` - Electron 构建输出
- `build` - 构建目录
- `out` - 输出目录
- `.next` - Next.js 缓存
- `coverage` - 测试覆盖率报告
- `.turbo` - Turbo 缓存
- `.cache` - 缓存目录
- `.dart_tool` - Dart/Flutter 工具缓存

**注意：** 如果需要扫描这些目录，可以在脚本中修改 `$excludeDirs` 数组。

## 典型使用场景

### 场景 1: 找出占用空间最大的文件

1. 运行脚本
2. 查看 "Top Largest Files" 部分
3. 识别不需要的大文件（如测试数据、临时文件）

### 场景 2: 分析某个目录为什么这么大

1. 运行脚本
2. 查看 "Top Directories by Size"
3. 如果发现某个目录异常大，可以调整阈值重新扫描

### 场景 3: 准备提交前检查

1. 设置阈值为 1 MB
2. 运行脚本
3. 导出大文件列表
4. 检查是否有不应提交的大文件

### 场景 4: 项目瘦身

1. 运行脚本并导出所有文件列表
2. 在 Excel 中分析数据
3. 识别可以删除或移动到外部存储的文件
4. 识别可以压缩的文件类型

## 性能说明

- **小型项目** (< 1000 文件): 通常 1-2 秒
- **中型项目** (1000-10000 文件): 通常 5-10 秒
- **大型项目** (> 10000 文件): 可能需要 30 秒以上

## 安全性

✅ **只读操作** - 脚本仅读取文件信息，不修改任何文件
✅ **不操作 Git** - 不会运行任何 Git 命令
✅ **不删除文件** - 不会删除任何文件
✅ **不移动文件** - 不会移动任何文件

## 常见问题

### Q: 扫描会修改文件吗？
**A:** 不会。脚本只读取文件的元数据（大小、路径、修改时间），不会修改任何文件内容或属性。

### Q: 为什么扫描这么慢？
**A:** 如果项目有大量文件，扫描需要遍历所有文件。可以通过排除更多目录来加速。

### Q: node_modules 被排除了，如何扫描它？
**A:** 在脚本中找到 `$excludeDirs` 数组，删除或注释掉 `"node_modules"` 这一行。

### Q: 导出的 CSV 文件在哪里？
**A:** 默认导出到项目根目录：
- `D:\programing\core_node\large-files-report.csv`
- `D:\programing\core_node\all-files-report.csv`
- `D:\programing\core_node\directory-summary-report.csv`

### Q: 如何分析不同类型的大文件？
**A:** 导出大文件列表到 CSV，然后在 Excel 中按 Extension 列排序或筛选。

## 示例输出

```
================================================

        Large Files Scanner
        Project Size Analysis Tool

================================================

[INFO] Project Root: D:\programing\core_node
[INFO] Size Threshold: 1 MB

[INFO] Scanning files... (This may take a while)

[OK] Scanned 3,456 files in 5.23s

========================================
  Project Overview
========================================

Total Project Size : 245.67 MB
Total Files        : 3,456
Large Files (>1 MB): 45

========================================
  Top Directories by Size
========================================

  123.45 MB   1,234 files    (50.25%) poly_apps
  67.89 MB    456 files      (27.63%) node_modules
  23.45 MB    234 files      ( 9.54%) scripts

========================================
  Top File Types by Count
========================================

  45.67 MB    1,234 files    .js
  34.56 MB    678 files      .ts
  23.45 MB    345 files      .json

========================================
  Top 50 Largest Files
========================================

   1. 25.67 MB  poly_apps/escrcpy/dist/bundle.js
   2. 18.90 MB  poly_apps/app1/assets/video.mp4
   3. 12.34 MB  poly_apps/app2/dist/main.js

========================================
  Summary Statistics
========================================

Large Files Total  : 156.78 MB
Percentage of Total: 63.84%

[WARN] Large files (>1 MB) account for 63.84% of total project size

========================================
  Export Options
========================================

  1. Export large files list to CSV
  2. Export all files list to CSV
  3. Export directory summary to CSV
  0. Skip export

Select export option (0-3):
```

## 技术细节

- **语言**: PowerShell 5.1+
- **依赖**: 无（使用 PowerShell 内置 cmdlet）
- **兼容性**: Windows 7+ (PowerShell 5.1+)
- **编码**: UTF-8

## 文件说明

- **scan-large-files.ps1** - 主脚本（约 300 行）
- **SCAN_LARGE_FILES_README.md** - 本说明文档

---

**版本**: 1.0
**日期**: 2025-12-19
**状态**: ✅ 可用
