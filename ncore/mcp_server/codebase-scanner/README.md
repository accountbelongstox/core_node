# CodebaseScanner MCP Server

A powerful Model Context Protocol (MCP) server for scanning and analyzing codebase structures, with specialized support for Flutter projects.

## Features

### Core Functionality

1. **Directory Tree Generation**
   - Multiple output formats: JSON, text (with box-drawing characters), markdown
   - Configurable depth traversal
   - Intelligent file and directory filtering

2. **File Search**
   - Find files by name (exact or fuzzy matching)
   - Fast scanning with configurable result limits
   - Metadata included (size, modification time)

3. **Content Search**
   - Full-text search across all files
   - Case-sensitive/insensitive options
   - File pattern filtering (regex support)
   - Line number and context display

4. **Codebase Statistics**
   - File counts and sizes
   - File type distribution
   - Directory counts

### Flutter Support

5. **Flutter App Scanning**
   - Auto-detect all Flutter apps in `poly_apps/flutter_bloom`
   - List available apps with metadata

6. **Flutter Structure Printing**
   - Three modes: `code`, `code_assets`, `all`
   - Specialized formatting for AI understanding
   - Includes lib, assets, and pubspec.yaml paths
   - Header with generation metadata

## Configuration

### Environment Variables

- `PROJECT_ROOT`: Root directory of the project (default: `D:/programing/core_node`)
- `ENABLE_GLOBAL_ACCESS`: Allow access to paths outside project root (default: `true`)

### Ignore Patterns

The scanner automatically skips:

**Directories:**
- `node_modules`, `.git`, `__pycache__`, `build`, `dist`
- `.idea`, `.vscode`, `venv`, `cache`, `logs`, `tmp`
- `.dart_tool`, `.pub`, `.flutter-plugins`
- And 60+ more common patterns

**File Extensions:**
- `.pyc`, `.log`, `.tmp`, `.db`, `.lock`
- `.zip`, `.rar`, `.exe`, `.dll`, `.so`
- `.min.js`, `.min.css`, `.map`
- And 60+ more patterns

## MCP Tools

### 1. `generate_directory_tree`

Generate directory tree structure with multiple output formats.

**Parameters:**
- `target_path` (optional): Path to scan (defaults to project root)
- `max_depth` (default: 5, max: 10): Maximum depth to traverse
- `output_format` (default: "both"): Output format - "json", "text", "markdown", or "both"

**Returns:**
```json
{
  "success": true,
  "root": "D:/programing/core_node",
  "root_name": "core_node",
  "tree_json": { /* hierarchical structure */ },
  "tree_text": "core_node/\n├── apps/\n│   ├── app1/\n...",
  "tree_markdown": "# Directory Tree: core_node\n..."
}
```

### 2. `find_file_by_name`

Find files by filename pattern.

**Parameters:**
- `filename`: Filename or pattern to search
- `search_path` (optional): Path to search in
- `exact_match` (default: false): Exact vs. partial match
- `max_results` (default: 100): Maximum results to return

**Returns:**
```json
{
  "success": true,
  "count": 5,
  "results": [
    {
      "filename": "config.py",
      "path": "D:/programing/core_node/config.py",
      "size": 1024,
      "modified": "2025-01-18T10:30:00"
    }
  ]
}
```

### 3. `search_content_in_files`

Search for text content within files.

**Parameters:**
- `search_text`: Text to search for
- `search_path` (optional): Path to search in
- `file_pattern` (optional): Regex pattern to filter files (e.g., `".*\\.py$"`)
- `case_sensitive` (default: false): Case-sensitive search
- `max_results` (default: 100): Maximum files to return

**Returns:**
```json
{
  "success": true,
  "count": 3,
  "results": [
    {
      "file": "D:/programing/core_node/app.py",
      "matches": [
        {"line": 10, "content": "import flask"},
        {"line": 25, "content": "from flask import Flask"}
      ]
    }
  ]
}
```

### 4. `get_codebase_stats`

Get codebase statistics.

**Parameters:**
- `target_path` (optional): Path to analyze

**Returns:**
```json
{
  "success": true,
  "statistics": {
    "total_files": 1234,
    "total_size": 52428800,
    "total_size_mb": 50.0,
    "total_dirs": 256,
    "file_types": {
      ".py": {"count": 345, "size": 12345678},
      ".js": {"count": 123, "size": 4567890}
    }
  }
}
```

### 5. `scan_flutter_apps`

Scan and list all available Flutter apps.

**Returns:**
```json
{
  "success": true,
  "flutter_root": "D:/programing/core_node/poly_apps/flutter_bloom",
  "apps_count": 12,
  "apps": ["app_achat", "app_wuy", ...],
  "modes": ["code", "code_assets", "all"],
  "tip": "Use 'flutter' or 'flutter_bloom' as app_name to scan entire Flutter project"
}
```

### 6. `print_flutter_app_structure`

Generate Flutter app directory structure.

**Parameters:**
- `app_name`: App name (e.g., "app_achat") or "flutter"/"flutter_bloom"
- `mode` (default: "code_assets"):
  - `"code"`: lib only
  - `"code_assets"`: lib + assets
  - `"all"`: everything including pubspec.yaml
- `max_depth` (default: 10): Maximum depth

**Returns:**
```json
{
  "success": true,
  "app_name": "app_achat",
  "mode": "code_assets",
  "flutter_root": "D:/programing/core_node/poly_apps/flutter_bloom",
  "header": ["=====", "Flutter App Directory Tree", ...],
  "tree_text": "app_achat [code_assets]\n├── lib/apps/app_achat/\n...",
  "tree_markdown": "# Flutter App Directory Tree\n..."
}
```

### 7. `health_check`

Check server health and configuration.

**Returns:**
```json
{
  "success": true,
  "health": {
    "server_status": "healthy",
    "timestamp": "2025-01-18T10:30:00",
    "configuration": { /* server config */ },
    "system": { /* system info */ },
    "capabilities": [ /* list of available tools */ ],
    "flutter": { /* Flutter scanner info if available */ }
  }
}
```

## Usage Examples

### For AI Assistants

**Understanding project structure:**
```
Use generate_directory_tree with output_format="text" to get a visual tree
```

**Finding configuration files:**
```
Use find_file_by_name with filename="config" and exact_match=false
```

**Searching for imports:**
```
Use search_content_in_files with search_text="import flask" and file_pattern=".*\\.py$"
```

**Analyzing Flutter app:**
```
1. Call scan_flutter_apps to list available apps
2. Call print_flutter_app_structure with app_name="app_achat" and mode="code_assets"
```

**Scanning entire Flutter project:**
```
Use print_flutter_app_structure with app_name="flutter" and mode="all"
```

## Installation

The server automatically installs its only dependency (`mcp` package) on first run.

### Windows MCP Configuration

Add to Claude Code MCP settings:

```json
{
  "CodebaseScanner": {
    "command": "cmd",
    "args": ["/c", "python", "D:\\programing\\core_node\\ncore\\mcp_server\\codebase-scanner\\main.py"],
    "env": {
      "PROJECT_ROOT": "D:\\programing\\core_node",
      "ENABLE_GLOBAL_ACCESS": "true"
    }
  }
}
```

### Linux MCP Configuration

```json
{
  "CodebaseScanner": {
    "command": "python3",
    "args": ["/path/to/core_node/ncore/mcp_server/codebase-scanner/main.py"],
    "env": {
      "PROJECT_ROOT": "/path/to/core_node",
      "ENABLE_GLOBAL_ACCESS": "true"
    }
  }
}
```

## Architecture

- **PackageManager**: Auto-installs required packages
- **IgnorePatterns**: Manages file/directory exclusion rules
- **FlutterScanner**: Specialized Flutter project scanner
- **CodebaseScanner**: Main scanner with general-purpose tools
- **FastMCP Integration**: Uses MCP's FastMCP framework for tool registration

## Output Formats

### Text Format (Box-Drawing)
```
core_node/
├── apps/
│   ├── app1/
│   │   ├── controller.js (15.2KB)
│   │   └── model.js (8.5KB)
│   └── app2/
└── config.py (2.3KB)
```

### JSON Format
```json
{
  "name": "core_node",
  "type": "directory",
  "children": [
    {
      "name": "apps",
      "type": "directory",
      "children": [...]
    }
  ]
}
```

### Markdown Format
```markdown
# Directory Tree: core_node

**Path:** `D:/programing/core_node`

\`\`\`
core_node/
├── apps/
...
\`\`\`

---
*Generated by CodebaseScanner MCP*
```

## License

Part of the core_node project.
