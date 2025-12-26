# Prompt File Merge Analysis Report

## 1. Flutter Build Related (Strongly Recommended to Merge)

### Files to Merge:
1. `build_by_flutter.txt` - Flutter build basic tasks
2. `bloom-flutterbuildv2.txt` - Flutter build v2 version
3. `bloom-flutterbuildv3.txt` - Flutter build v3 version (includes v2 content)
4. `flutter_bloombuild.txt` - Flutter build tasks (duplicates v2/v3 content)

### Merge Reasons:
- **Highly Duplicate Content**: v2, v3, and flutter_bloombuild.txt all contain the same Flutter build task descriptions
- **Version Evolution**: v3 is an improved version of v2, but v2 content is still retained in v3
- **Maintenance Difficulty**: Multiple files describe the same functionality, requiring synchronization when updating
- **Recommendation**: Merge into `flutter_build_system_guide.md`, preserve version history comments

---

## 2. Task Management Related (Recommended to Merge)

### Files to Merge:
1. `task.txt` - Task-related prompts
2. `任务.txt` - Task-related prompts (Chinese name)
3. `.task.prompt` - Task prompts
4. `aug_task2.txt` - Task-related (contains task descriptions)

### Merge Reasons:
- **Functional Overlap**: All involve task system and task management related content
- **Naming Confusion**: Mixed Chinese and English, `.task.prompt` and `task.txt` have similar functionality
- **Recommendation**: Merge into `task_management_system_guide.md`, unify task-related prompts

---

## 3. MCP/Chrome Bridging Related (Recommended to Merge)

### Files to Merge:
1. `MCP客户端.txt` - MCP client development
2. `CHROME桥接MCP开发.md` - Chrome and MCP bridging development
3. `MCPCHROME服务端开发.md` - MCP Chrome server development

### Merge Reasons:
- **Unified Technology Stack**: All about MCP and Chrome integration development
- **Functional Relationship**: Client, bridge, and server are different parts of the same system
- **Maintenance Convenience**: After merging, easier to manage MCP-Chrome related development specifications
- **Recommendation**: Merge into `mcp_chrome_integration_guide.md`, describe client, bridge, and server in separate chapters

---

## 4. IT Tools/Nuxt Design Related (Recommended to Merge)

### Files to Merge:
1. `nust_ittool设计.txt` - IT tools design (Nuxt related)
2. `ITTOOLE工具设计.md` - IT tools design document

### Merge Reasons:
- **Consistent Theme**: Both are IT Tools design documents
- **Naming Error**: `nust_ittool设计.txt` should be `nuxt_ittool设计.txt` (typo)
- **Complementary Content**: May contain design ideas from different stages
- **Recommendation**: Merge into `ittools_design_guide.md`, unify IT Tools design specifications

---

## 5. Flutter Bank Application Related (Consider Merging)

### Related Files:
1. `bloom-flutter-bank.txt` - Flutter Bloom bank application build
2. `.bank.txt` - Bank related (possibly Laravel backend)

### Merge Reasons (Partial):
- **Functional Relationship**: Frontend Flutter bank application and backend Laravel bank API are the same project
- **But Note**: `.bank.txt` may be backend API design, different from Flutter build logic
- **Recommendation**: If `.bank.txt` is indeed the backend part of the bank project, consider merging into `bank_app_fullstack.md`

---

## 6. Laravel Related (Recommended to Categorize and Organize)

### Related Files:
1. `LARAVEL-WEB-功能模块文档.md`
2. `LARAVEL-WEB-菜单功能详细描述.md`
3. `LARAVEL-WEB-静态资源管理.md`
4. `LARAVEL远程任务系统调用.md`
5. `cerbot_by_laravel.txt`

### Recommendations:
- **Keep Independent**: Although these files are all Laravel-related, they have different themes (functional modules, menus, static resources, remote tasks, certificates)
- **Can Create Index**: Recommend creating `laravel_documentation_index.md` as an index file

---

## 7. Other Recommendations

### Common Prompts:
- `common_development_guidelines.md` - Should be kept independent as common specifications for all projects

### Configuration Files:
- `mcp.json`, `mcp*.json`, `mcp*.toml` - These are configuration files, not prompts, should be moved to configuration directory

### Log Files:
- `log.txt`, `log2.txt`, `his.txt` - These are log files, not prompts, should be cleaned or moved to log directory

---

## Merge Priority

### High Priority (Merge Immediately):
1. ✅ **Completed** Flutter build related (4 files → `flutter_build_system_guide.md`)
2. ✅ **Completed** Task management related (4 files → `task_management_system_guide.md`)
3. ✅ **Completed** MCP/Chrome related (3 files → `mcp_chrome_integration_guide.md`)

### Medium Priority (Consider Merging):
4. ✅ **Completed** IT Tools design related (2 files → `ittools_design_guide.md`)
5. ⚠️ Bank application related (decide after confirming content)

### Low Priority (Keep Independent or Create Index):
6. ✅ **Completed** Laravel related documents (created index file `laravel_documentation_index.md`)

---

## File Cleanup Recommendations

### Already Cleaned:
- ✅ `AI 工具系统设计.txt` (only title, deleted)

### Recommended to Clean or Move Out of `_prompt` Directory:
- ⚠️ **Configuration Files**: `mcp*.json`, `mcp*.toml` (these are MCP configuration file templates, recommend moving to configuration directory)
  - `mcp.json`
  - `mcpLinuxTemplate.json`
  - `mcpUbuntoDesktopTemplate.json`
  - `mcpWindowsTemplate.json`
  - `mcpWSLTemplate.json`
  - `mcpCodexLinuxTemplate.toml`
  - `mcpCodexUbuntoDesktopTemplate.toml`
  - `mcpCodexWindowsTemplate.toml`
  - `mcpCodexWSLTemplate.toml`

- ✅ **Log Files**: Deleted (these are script execution logs, not prompts)
  - ✅ `log.txt` (deleted)
  - ✅ `log2.txt` (deleted)
  - ✅ `his.txt` (deleted)

- ℹ️ **Configuration Files**: Kept as template reference (MCP configuration templates, may be referenced by prompts)
  - `mcp.json` and `mcp*.json`, `mcp*.toml` template files (9 files)

### Should Rename:
- `nust_ittool设计.txt` → `nuxt_ittool_design.txt` (fix typo)

---

## Summary

**Number of Files to Merge**: Approximately 13-15 files can be merged into 4-5 files

**Main Index File**: Created `README.md` as main index for all prompt documents, categorized by theme and technology stack

**Completed Merges**:
- ✅ Flutter build related: 4 files → `flutter_build_system_guide.md`
- ✅ Task management related: 4 files → `task_management_system_guide.md`
- ✅ MCP/Chrome related: 3 files → `mcp_chrome_integration_guide.md`
- ✅ IT Tools design related: 2 files → `ittools_design_guide.md`

**Merge Effects**:
- ✅ Reduced file count by 13
- ✅ Improved maintenance efficiency (unified documents, avoid duplication)
- ✅ Avoid content duplication and version confusion
- ✅ Easy to find and use (structured documents)

**Merged Files**:
1. `flutter_build_system_guide.md` - Complete Flutter build system guide
2. `task_management_system_guide.md` - Task management system development guide
3. `mcp_chrome_integration_guide.md` - MCP Chrome integration development guide
4. `ittools_design_guide.md` - IT Tools design document
5. `laravel_documentation_index.md` - Laravel related documentation index (new)

**Cleaned Files**:
- ✅ `AI 工具系统设计.txt` (empty file, deleted)

**Already Cleaned Files**:
- ✅ Log files: `log.txt`, `log2.txt`, `his.txt` (3 files, deleted)

**Retained Files** (as template reference):
- ℹ️ Configuration files: `mcp*.json`, `mcp*.toml` (9 files, kept as MCP configuration reference templates)

