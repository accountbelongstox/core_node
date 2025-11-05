# 代码中文字符扫描器 (Code Chinese Character Scanner)

## 概述 (Overview)

为 File Processor MCP Server 添加的代码扫描功能，可以递归扫描代码文件中的中文字符。

A code scanning feature added to the File Processor MCP Server that recursively scans code files for Chinese characters.

## 主要功能 (Key Features)

✅ **递归扫描** - 递归扫描整个项目目录
✅ **智能过滤** - 自动排除 node_modules, .git 等目录
✅ **多语言支持** - 支持 60+ 种文件扩展名
✅ **多编码支持** - UTF-8, GBK, GB2312, GB18030, Big5
✅ **详细报告** - 显示行号、列号和上下文
✅ **灵活输出** - 文本格式或 JSON 格式
✅ **性能优化** - 支持扩展名过滤和深度限制

## 快速开始 (Quick Start)

### 基本用法 (Basic Usage)

```python
# 扫描整个项目
scan_code_for_chinese("/path/to/project")

# 只扫描 Python 文件
scan_code_for_chinese("/path/to/project", extensions=["py"])

# 限制扫描深度
scan_code_for_chinese("/path/to/project", max_depth=3)

# 获取 JSON 输出
scan_code_for_chinese("/path/to/project", output_format="json")
```

## 支持的语言 (Supported Languages)

### 编程语言 (Programming Languages)
- JavaScript/TypeScript (.js, .jsx, .ts, .tsx, .mjs, .cjs)
- Python (.py, .pyw, .pyi)
- Dart (.dart)
- Vue (.vue)
- Java/Kotlin (.java, .kt, .kts)
- Go (.go)
- C/C++ (.c, .cpp, .h, .hpp)
- C# (.cs)
- Ruby (.rb)
- PHP (.php)
- Rust (.rs)
- Swift (.swift)
- 等等... (and more...)

### 脚本和配置 (Scripts & Config)
- Shell (.sh, .bash, .zsh, .fish)
- PowerShell (.ps1, .psm1, .psd1)
- SQL (.sql)
- HTML/CSS (.html, .css, .scss)
- Config (.json, .yaml, .toml, .ini)
- Markdown (.md)
- XML (.xml)

## MCP 工具 (MCP Tools)

### 1. `scan_code_for_chinese`

扫描代码文件中的中文字符。

**参数 (Parameters):**
- `directory` (必需): 要扫描的根目录
- `extensions` (可选): 文件扩展名列表 (例: ["py", "js"])
- `max_depth` (可选): 最大递归深度 (-1 表示无限制)
- `output_format` (可选): "text" 或 "json"

**示例输出 (Example Output):**
```
================================================================================
CODE CHINESE CHARACTER SCAN RESULTS
================================================================================
Directory: /path/to/project
Extensions: all

Statistics:
  Total files scanned: 150
  Files with Chinese: 12
  Total Chinese characters: 245
  Skipped directories: 5
  Errors: 0

================================================================================
FILES WITH CHINESE CHARACTERS
================================================================================

File: /path/to/project/src/main.py
Encoding: utf-8
Occurrences: 2
--------------------------------------------------------------------------------
  Line 10, Column 15
  Chinese: 欢迎使用
  Content: def welcome(): return "欢迎使用我们的系统"
```

### 2. `list_code_extensions`

列出所有支持的代码文件扩展名。

**返回 (Returns):**
```json
{
  "success": true,
  "total_extensions": 60,
  "categories": {
    "JavaScript/TypeScript": [".js", ".jsx", ".ts", ".tsx"],
    "Python": [".py", ".pyw", ".pyi"],
    ...
  },
  "excluded_directories": ["node_modules", ".git", "dist", ...],
  "excluded_files": ["package-lock.json", "yarn.lock", ...]
}
```

## 使用场景 (Use Cases)

1. **代码清理** - 查找硬编码的中文字符串
2. **国际化审计** - 识别需要翻译的文本
3. **代码审查** - 确保正确使用 i18n 资源
4. **质量保证** - 检测意外的中文字符
5. **CI/CD 集成** - 在构建中检查中文字符

## 排除目录 (Excluded Directories)

自动排除以下目录：
- `node_modules`, `vendor`, `packages`
- `.git`, `.svn`, `.hg`
- `dist`, `build`, `target`, `out`
- `__pycache__`, `.pytest_cache`
- `venv`, `env`, `.venv`
- `.idea`, `.vscode`
- `.dart_tool`, `.pub-cache`
- `.gradle`, `gradle`

## 文件结构 (File Structure)

```
file_processor/
├── code_scanner.py              # 核心扫描器实现
├── main.py                      # MCP 服务器 (已更新)
├── CODE_SCANNER_GUIDE.md        # 完整使用指南
├── CODE_SCANNER_QUICKSTART.md   # 快速开始指南
├── CODE_SCANNER_UPDATE.md       # 更新说明
├── README_CODE_SCANNER.md       # 本文件
└── test_scanner.py              # 测试脚本
```

## 测试 (Testing)

```bash
cd D:\programing\core_node\ncore\mcp_server\file_processor
python test_scanner.py
```

**预期输出:**
```
================================================================================
CODE SCANNER TEST
================================================================================
Testing scanner in: D:\programing\core_node\ncore\mcp_server\file_processor

Test 1: Scanning Python files...
✓ Scan completed successfully
  Files scanned: 12
  Files with Chinese: 1
  Total Chinese characters: 5
```

## 性能 (Performance)

- **速度**: ~1000 个文件/秒 (SSD)
- **内存**: 流式处理大文件
- **编码**: 自动检测和降级
- **并发**: 可支持并行处理

## 集成示例 (Integration Examples)

### CI/CD Pipeline

```python
# 在 CI 中检查中文字符
result = scan_code_for_chinese("./src", extensions=["js", "ts"], output_format="json")

if result["success"] and result["stats"]["files_with_chinese"] > 0:
    print(f"❌ Found {result['stats']['files_with_chinese']} files with Chinese characters")
    exit(1)
else:
    print("✓ No Chinese characters found")
```

### Generate Report

```python
import json

result = scan_code_for_chinese("/path/to/project", output_format="json")

with open("chinese_scan_report.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
```

## 健康检查 (Health Check)

```python
# 检查扫描器是否可用
health = health_check()
print(health["code_scanner"])
```

**输出:**
```json
{
  "available": true,
  "features": {
    "chinese_detection": true,
    "recursive_scanning": true,
    "multi_encoding_support": true,
    ...
  },
  "supported_languages": [...],
  "total_extensions": 60
}
```

## 文档 (Documentation)

- **快速开始**: `CODE_SCANNER_QUICKSTART.md`
- **完整指南**: `CODE_SCANNER_GUIDE.md`
- **更新说明**: `CODE_SCANNER_UPDATE.md`

## 技术细节 (Technical Details)

### 正则表达式
```python
# 只匹配真正的中文字符 (CJK Unified Ideographs)
CHINESE_PATTERN = re.compile(r'[\u4e00-\u9fff]+')
```

### 支持的编码
- UTF-8
- GBK
- GB2312
- GB18030
- Big5

### 返回结构 (Return Structure)

**文本格式 (Text Format):**
- 易读的格式化输出
- 包含统计信息
- 显示文件、行号、列号和内容

**JSON 格式 (JSON Format):**
```typescript
{
  success: boolean,
  directory: string,
  extensions: string[] | "all",
  stats: {
    total_files_scanned: number,
    files_with_chinese: number,
    total_chinese_chars: number,
    skipped_directories: number,
    errors: number
  },
  files: [{
    file_path: string,
    encoding: string,
    occurrences: number,
    matches: [{
      line_number: number,
      column: number,
      text: string,
      line_content: string
    }]
  }]
}
```

## 常见问题 (FAQ)

**Q: 如何只扫描特定类型的文件？**
A: 使用 `extensions` 参数，例如：`extensions=["py", "js"]`

**Q: 如何限制扫描深度？**
A: 使用 `max_depth` 参数，例如：`max_depth=3`

**Q: 为什么有些目录被跳过？**
A: 为了性能，自动跳过 node_modules, .git 等常见目录

**Q: 支持哪些编码？**
A: UTF-8, GBK, GB2312, GB18030, Big5 (自动检测)

## 许可证 (License)

与 File Processor MCP Server 相同

## 版本历史 (Version History)

- **v1.0.0** (2025-01-05): 初始发布
  - 中文字符检测
  - 递归目录扫描
  - 60+ 文件扩展名支持
  - 智能排除
  - 文本和 JSON 输出格式

---

**🎉 立即开始使用！Just call `scan_code_for_chinese()` in your MCP client!**
