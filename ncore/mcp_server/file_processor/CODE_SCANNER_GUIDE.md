# Code Chinese Character Scanner Guide

## Overview

The Code Scanner extension for the File Processor MCP Server provides powerful tools to scan code files for Chinese characters. This is useful for:

- **Code cleanup**: Finding hardcoded Chinese strings
- **Internationalization audits**: Identifying text that needs translation
- **Code review**: Ensuring proper use of i18n resources
- **Quality assurance**: Detecting unintended Chinese characters in code

## Features

✅ **Recursive Directory Scanning** - Scan entire project trees
✅ **Smart File Filtering** - Automatic detection of code files
✅ **Multi-Language Support** - 60+ file extensions across 20+ languages
✅ **Intelligent Exclusions** - Skips node_modules, .git, build directories, etc.
✅ **Multi-Encoding Support** - Handles UTF-8, GBK, GB2312, GB18030, Big5
✅ **Detailed Reports** - Line numbers, column positions, and context
✅ **Flexible Output** - Text or JSON format
✅ **Depth Control** - Limit scanning depth for large projects

## Available Tools

### 1. `scan_code_for_chinese`

Scan code files for Chinese characters in a directory.

**Parameters:**

- `directory` (string, required): Root directory to scan
- `extensions` (list, optional): File extensions to scan (e.g., `["py", "js"]`)
  - If not specified, scans all default code file types
- `max_depth` (int, optional): Maximum directory depth (-1 for unlimited, default: -1)
- `output_format` (string, optional): Output format - "text" or "json" (default: "text")

**Example Usage:**

```python
# Scan all code files in a project
scan_code_for_chinese("/path/to/project")

# Scan only Python files
scan_code_for_chinese("/path/to/project", extensions=["py"])

# Scan only Python and JavaScript files
scan_code_for_chinese("/path/to/project", extensions=["py", "js", "jsx"])

# Scan with depth limit (only 3 levels deep)
scan_code_for_chinese("/path/to/project", max_depth=3)

# Get JSON output for programmatic processing
scan_code_for_chinese("/path/to/project", output_format="json")

# Complex example: Scan Flutter project for Dart files
scan_code_for_chinese(
    "/path/to/flutter_project",
    extensions=["dart"],
    max_depth=10,
    output_format="text"
)
```

**Text Output Example:**

```
================================================================================
CODE CHINESE CHARACTER SCAN RESULTS
================================================================================
Directory: /path/to/project
Extensions: ['py', 'js']

Statistics:
  Total files scanned: 150
  Files with Chinese: 12
  Total Chinese characters: 245
  Skipped directories: 5
  Errors: 0

================================================================================
FILES WITH CHINESE CHARACTERS
================================================================================

File: /path/to/project/src/utils/messages.py
Encoding: utf-8
Occurrences: 5
--------------------------------------------------------------------------------
  Line 10, Column 15
  Chinese: 欢迎使用
  Content: def welcome_message(): return "欢迎使用我们的系统"

  Line 25, Column 20
  Chinese: 错误
  Content:     raise Exception("错误: 无效的输入")

File: /path/to/project/src/components/Header.jsx
Encoding: utf-8
Occurrences: 3
--------------------------------------------------------------------------------
  Line 15, Column 25
  Chinese: 首页
  Content:     <h1>首页</h1>

================================================================================
```

**JSON Output Structure:**

```json
{
  "success": true,
  "directory": "/path/to/project",
  "extensions": ["py", "js"],
  "stats": {
    "total_files_scanned": 150,
    "files_with_chinese": 12,
    "total_chinese_chars": 245,
    "skipped_directories": 5,
    "errors": 0
  },
  "files": [
    {
      "file_path": "/path/to/project/src/utils/messages.py",
      "encoding": "utf-8",
      "occurrences": 5,
      "matches": [
        {
          "line_number": 10,
          "column": 15,
          "text": "欢迎使用",
          "line_content": "def welcome_message(): return \"欢迎使用我们的系统\""
        }
      ]
    }
  ]
}
```

### 2. `list_code_extensions`

List all supported code file extensions and configuration.

**Example Usage:**

```python
list_code_extensions()
```

**Output:**

```json
{
  "success": true,
  "total_extensions": 60,
  "categories": {
    "JavaScript/TypeScript": [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"],
    "Python": [".py", ".pyw", ".pyi"],
    "Dart": [".dart"],
    "Vue": [".vue"],
    "Java/Kotlin": [".java", ".kt", ".kts"],
    "Go": [".go"],
    "Shell Scripts": [".sh", ".bash", ".zsh", ".fish"],
    "PowerShell": [".ps1", ".psm1", ".psd1"],
    "...": ["..."]
  },
  "excluded_directories": [
    "node_modules", ".git", "dist", "build",
    "__pycache__", "venv", "target", "vendor"
  ],
  "excluded_files": [
    "package-lock.json", "yarn.lock", "*.lock"
  ]
}
```

## Supported Languages & Extensions

### Programming Languages

- **JavaScript/TypeScript**: .js, .jsx, .ts, .tsx, .mjs, .cjs
- **Python**: .py, .pyw, .pyi
- **Dart**: .dart
- **Vue**: .vue
- **Java/Kotlin**: .java, .kt, .kts
- **Go**: .go
- **C/C++**: .c, .cpp, .cc, .cxx, .h, .hpp, .hxx
- **C#**: .cs
- **Ruby**: .rb
- **PHP**: .php
- **Rust**: .rs
- **Swift**: .swift
- **Scala**: .scala
- **R**: .r, .R
- **Perl**: .pl, .pm
- **Lua**: .lua

### Scripts & Configuration

- **Shell Scripts**: .sh, .bash, .zsh, .fish
- **PowerShell**: .ps1, .psm1, .psd1
- **SQL**: .sql
- **HTML/CSS**: .html, .htm, .css, .scss, .sass, .less
- **Config Files**: .json, .yaml, .yml, .toml, .ini, .conf, .config
- **Markdown**: .md, .markdown
- **XML**: .xml

## Excluded Directories

The scanner automatically skips these directories to improve performance:

- **Dependencies**: `node_modules`, `vendor`, `packages`, `bower_components`
- **Version Control**: `.git`, `.svn`, `.hg`
- **Build Outputs**: `dist`, `build`, `out`, `target`, `bin`, `obj`
- **Python Cache**: `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.tox`
- **Virtual Environments**: `venv`, `env`, `.venv`, `virtualenv`
- **IDE Files**: `.idea`, `.vscode`, `.vs`
- **Coverage**: `coverage`, `.nyc_output`
- **Dart/Flutter**: `.dart_tool`, `.pub-cache`
- **Gradle**: `.gradle`, `gradle`

## Excluded Files

- **Lock Files**: `package-lock.json`, `yarn.lock`, `Cargo.lock`, etc.
- **System Files**: `.DS_Store`, `Thumbs.db`

## Use Cases

### 1. Find All Hardcoded Chinese Strings

```python
# Scan entire project
result = scan_code_for_chinese("/path/to/project")
```

### 2. Internationalization Audit

```python
# Scan for Chinese in source files only
result = scan_code_for_chinese(
    "/path/to/project",
    extensions=["js", "jsx", "ts", "tsx", "vue"],
    output_format="json"
)
```

### 3. Python Project Analysis

```python
# Focus on Python files
result = scan_code_for_chinese(
    "/path/to/python_project",
    extensions=["py"],
    max_depth=5
)
```

### 4. Quick Top-Level Scan

```python
# Only scan immediate directory
result = scan_code_for_chinese(
    "/path/to/project",
    max_depth=1
)
```

### 5. Multi-Language Project

```python
# Scan specific file types in a polyglot codebase
result = scan_code_for_chinese(
    "/path/to/project",
    extensions=["dart", "java", "kt", "xml"]
)
```

## Performance Tips

1. **Use Extension Filtering**: Specify `extensions` parameter to scan only relevant files
2. **Limit Depth**: Use `max_depth` for large projects to avoid deep recursion
3. **Exclude Unnecessary Directories**: The scanner automatically excludes common directories
4. **JSON Output**: Use JSON output for programmatic processing and better performance

## Integration Examples

### With CI/CD Pipeline

```python
# Fail build if Chinese characters found in production code
result = scan_code_for_chinese(
    "./src",
    extensions=["js", "ts", "jsx", "tsx"],
    output_format="json"
)

if result["success"] and result["stats"]["files_with_chinese"] > 0:
    print(f"Found {result['stats']['files_with_chinese']} files with Chinese characters")
    exit(1)
```

### Generate Report File

```python
import json

# Scan and save report
result = scan_code_for_chinese(
    "/path/to/project",
    output_format="json"
)

with open("chinese_scan_report.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
```

## Troubleshooting

### Issue: Permission Denied

**Solution**: Ensure you have read permissions for the directory and files.

### Issue: Too Many Files

**Solution**: Use `extensions` parameter to filter file types or `max_depth` to limit scanning depth.

### Issue: Encoding Errors

**Solution**: The scanner tries multiple encodings (UTF-8, GBK, GB2312, GB18030, Big5) automatically. Check the error count in statistics.

### Issue: False Positives

**Solution**: Review the matched lines - some files may legitimately contain Chinese comments or documentation.

## API Reference

### Return Structure (Text Format)

```
================================================================================
CODE CHINESE CHARACTER SCAN RESULTS
================================================================================
Directory: <path>
Extensions: <list>

Statistics:
  Total files scanned: <count>
  Files with Chinese: <count>
  Total Chinese characters: <count>
  Skipped directories: <count>
  Errors: <count>

[Detailed file listings...]
```

### Return Structure (JSON Format)

```typescript
interface ScanResult {
  success: boolean;
  directory: string;
  extensions: string[] | "all";
  stats: {
    total_files_scanned: number;
    files_with_chinese: number;
    total_chinese_chars: number;
    skipped_directories: number;
    errors: number;
  };
  files: FileMatch[];
}

interface FileMatch {
  file_path: string;
  encoding: string;
  occurrences: number;
  matches: Match[];
}

interface Match {
  line_number: number;
  column: number;
  text: string;
  line_content: string;
}
```

## Version History

- **v1.0.0** (2025-01-05): Initial release
  - Chinese character detection
  - Recursive directory scanning
  - 60+ file extensions support
  - Smart exclusions
  - Text and JSON output formats

## Support

For issues or feature requests, please refer to the main File Processor MCP Server documentation.
