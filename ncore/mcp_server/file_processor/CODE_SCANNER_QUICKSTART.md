# Code Scanner - Quick Start Guide

## 🚀 Quick Installation

The Code Scanner is already integrated into the File Processor MCP Server. No additional installation required!

## 📝 Basic Usage

### 1. Scan Entire Project

```python
# Scan all code files in a directory
scan_code_for_chinese("/path/to/project")
```

**Output:**
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

File: /path/to/project/src/utils/messages.py
Encoding: utf-8
Occurrences: 5
--------------------------------------------------------------------------------
  Line 10, Column 15
  Chinese: 欢迎使用
  Content: def welcome_message(): return "欢迎使用我们的系统"
```

### 2. Scan Specific File Types

```python
# Scan only Python files
scan_code_for_chinese("/path/to/project", extensions=["py"])

# Scan Python and JavaScript
scan_code_for_chinese("/path/to/project", extensions=["py", "js", "jsx"])

# Scan Dart files (Flutter project)
scan_code_for_chinese("/path/to/flutter_project", extensions=["dart"])
```

### 3. Get JSON Output

```python
# Get structured JSON for programmatic processing
result = scan_code_for_chinese("/path/to/project", output_format="json")

# Access results programmatically
print(f"Files with Chinese: {result['stats']['files_with_chinese']}")
for file in result['files']:
    print(f"File: {file['file_path']}")
    print(f"Occurrences: {file['occurrences']}")
```

### 4. Limit Scan Depth

```python
# Only scan 3 levels deep
scan_code_for_chinese("/path/to/project", max_depth=3)

# Only scan immediate directory
scan_code_for_chinese("/path/to/project", max_depth=1)
```

## 🎯 Common Use Cases

### Find All Chinese Strings in Python Project
```python
scan_code_for_chinese("/path/to/python_project", extensions=["py"])
```

### Audit Flutter App for Chinese Text
```python
scan_code_for_chinese(
    "/path/to/flutter_app",
    extensions=["dart"],
    max_depth=10
)
```

### Check JavaScript/React Project
```python
scan_code_for_chinese(
    "/path/to/react_app",
    extensions=["js", "jsx", "ts", "tsx"]
)
```

### Quick Top-Level Scan
```python
scan_code_for_chinese("/path/to/project", max_depth=1)
```

## 📦 Supported File Types

**60+ extensions across 20+ languages:**

- **JavaScript/TypeScript**: .js, .jsx, .ts, .tsx
- **Python**: .py, .pyw, .pyi
- **Dart**: .dart
- **Vue**: .vue
- **Java/Kotlin**: .java, .kt
- **Go**: .go
- **Shell/PowerShell**: .sh, .ps1
- **C/C++**: .c, .cpp, .h
- **And many more...**

See full list: `list_code_extensions()`

## 🚫 Auto-Excluded Directories

Automatically skips:
- `node_modules`
- `.git`, `.svn`
- `dist`, `build`, `target`
- `__pycache__`, `venv`
- And more...

## 💡 Tips

1. **Use extension filtering** for faster scans
2. **Limit depth** for large projects
3. **JSON output** for CI/CD integration
4. **Check health**: `health_check()` to verify scanner availability

## 🔍 List Available Extensions

```python
# See all supported extensions
list_code_extensions()
```

**Output:**
```json
{
  "success": true,
  "total_extensions": 60,
  "categories": {
    "JavaScript/TypeScript": [".js", ".jsx", ".ts", ".tsx"],
    "Python": [".py", ".pyw", ".pyi"],
    ...
  }
}
```

## 📊 Example Output (JSON)

```json
{
  "success": true,
  "directory": "/path/to/project",
  "extensions": ["py"],
  "stats": {
    "total_files_scanned": 50,
    "files_with_chinese": 3,
    "total_chinese_chars": 45,
    "skipped_directories": 2,
    "errors": 0
  },
  "files": [
    {
      "file_path": "/path/to/file.py",
      "encoding": "utf-8",
      "occurrences": 2,
      "matches": [
        {
          "line_number": 10,
          "column": 15,
          "text": "欢迎",
          "line_content": "message = \"欢迎使用\""
        }
      ]
    }
  ]
}
```

## 🧪 Test Installation

```bash
cd D:\programing\core_node\ncore\mcp_server\file_processor
python test_scanner.py
```

## 📚 More Information

- **Full Documentation**: `CODE_SCANNER_GUIDE.md`
- **Update Notes**: `CODE_SCANNER_UPDATE.md`
- **Health Check**: `health_check()` MCP tool

## ⚡ Performance

- Scans ~1000 files/second
- Multi-encoding support (UTF-8, GBK, GB2312, etc.)
- Memory efficient
- Smart exclusions

## 🎯 Perfect For

- Code cleanup
- i18n audits
- Quality assurance
- CI/CD integration
- Legacy code analysis

---

**Ready to use!** Just call `scan_code_for_chinese()` in your MCP client.
