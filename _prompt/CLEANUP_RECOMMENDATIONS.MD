# Prompt Directory Cleanup Recommendations

> **Generated**: 2025-01-XX
> **Description**: This document lists files in the `_prompt` directory recommended for cleanup or moving

## Completed Cleanup

### Deleted
- ✅ `AI 工具系统设计.txt` - Empty file (only title)
- ✅ `log.txt` - Script execution log
- ✅ `log2.txt` - Script execution log (duplicate content)
- ✅ `his.txt` - Error log

### Merged
- ✅ Flutter build related: 4 files → `flutter_build_system_guide.md`
- ✅ Task management related: 4 files → `task_management_system_guide.md`
- ✅ MCP/Chrome related: 3 files → `mcp_chrome_integration_guide.md`
- ✅ IT Tools design related: 2 files → `ittools_design_guide.md`

---

## Recommended Files for Cleanup

### 1. Configuration Files (Keep as Template Reference)

These are MCP configuration file templates. Although not ideal for prompt directory, kept as development reference templates:

- `mcp.json` - Actual MCP server configuration (contains specific server configuration)
- `mcpLinuxTemplate.json` - Linux template
- `mcpUbuntoDesktopTemplate.json` - Ubuntu desktop template
- `mcpWindowsTemplate.json` - Windows template
- `mcpWSLTemplate.json` - WSL template
- `mcpCodexLinuxTemplate.toml` - Codex Linux template
- `mcpCodexUbuntoDesktopTemplate.toml` - Codex Ubuntu desktop template
- `mcpCodexWindowsTemplate.toml` - Codex Windows template
- `mcpCodexWSLTemplate.toml` - Codex WSL template

**Current Status**: Kept in `_prompt` directory as MCP configuration reference templates
**Note**: These files contain MCP server configuration examples and may be referenced by prompts, temporarily retained

---

### 2. Log Files (Deleted)

These are script execution logs, not prompts, already cleaned:

- ✅ `log.txt` - Script execution log (deleted)
- ✅ `log2.txt` - Script execution log (deleted)
- ✅ `his.txt` - Error log (deleted)

---

## Other Recommendations

### File Naming Conventions

Recommend using the following naming conventions:
- Use `.md` extension (Markdown format)
- Use underscores or hyphens to separate words
- Avoid mixing Chinese and English in file names

### File Classification

Recommend organizing by theme:
- `flutter_*.md` - Flutter related
- `laravel_*.md` - Laravel related
- `mcp_*.md` - MCP related
- `task_*.md` - Task related
- `*_index.md` - Index files

---

## Cleanup Steps

1. **Backup** (Optional): Backup entire `_prompt` directory before cleanup
2. **Move Configuration Files**: Move `mcp*.json` and `mcp*.toml` to configuration directory
3. **Handle Log Files**: Move log files to log directory or delete
4. **Verify**: Confirm all prompt documents are still accessible

---

## Recommended Directory Structure After Cleanup

```
_prompt/
├── flutter_build_system_guide.md
├── task_management_system_guide.md
├── mcp_chrome_integration_guide.md
├── ittools_design_guide.md
├── laravel_documentation_index.md
├── prompt_merge_analysis_report.md
├── cleanup_recommendations.md
├── common_development_guidelines.md
└── [Other prompt documents...]
```

---

## Important Notes

1. **Do NOT Delete**: Actual prompt documents (`.md` and `.txt` format prompt content)
2. **Delete with Caution**: If unsure about file purpose, move to backup directory first
3. **Maintain Index**: Update related index files (e.g., `laravel_documentation_index.md`)

