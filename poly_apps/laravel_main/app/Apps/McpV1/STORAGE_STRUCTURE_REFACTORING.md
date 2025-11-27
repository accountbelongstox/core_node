# Storage Structure Refactoring

## Overview

Refactored task dispatch system to use `_prompts/` directory for both configuration and data storage, making configuration files git-friendly while keeping runtime data separate.

## New Directory Structure

```
_prompts/
├── .categories.json          # ✓ Configuration (committed to git)
├── .prompt-mappings.json     # ✓ Configuration (committed to git)
├── .gitignore                # ✓ Ignore rules (committed to git)
├── README.md                 # ✓ Documentation (committed to git)
│
├── task-data/                # ✗ Runtime data (NOT committed)
│   └── queues/               #   Task queue JSON files
│       ├── global.json
│       ├── mcp-dev.json
│       ├── ncore-dev.json
│       ├── pycore-dev.json
│       ├── laravel-main-dev.json
│       └── nuxt-dev.json
│
├── mcp-dev/                  # Category directories
├── ncore-dev/
├── pycore-dev/
├── laravel-main-dev/
├── nuxt-dev/
└── *.md                      # Prompt files
```

## Changes Made

### 1. Backend Services

#### TaskCategoryService
**Before**: `/www/shared-data/task-dispatch/categories.json`
**After**: `_prompts/.categories.json`

```php
// Old
$this->categoriesConfigFile = $sharedDataDir . '/task-dispatch/categories.json';

// New
$this->categoriesConfigFile = $this->promptsDirectory . '/.categories.json';
```

#### TaskQueueService
**Before**: `/www/shared-data/task-dispatch/queues/`
**After**: `_prompts/task-data/queues/`

```php
// Old
$this->queueDirectory = $sharedDataDir . '/task-dispatch/queues';

// New
$this->queueDirectory = $promptsDir . '/task-data/queues';
```

#### PromptMappingService
**Before**: `/www/shared-data/task-dispatch/prompt-mappings.json`
**After**: `_prompts/.prompt-mappings.json`

```php
// Old
$this->mappingConfigFile = $taskDispatchDir . '/prompt-mappings.json';

// New
$this->mappingConfigFile = $promptsDir . '/.prompt-mappings.json';
```

### 2. Configuration Files

#### .categories.json
```json
{
    "version": "1.0",
    "categories": [
        {
            "id": "global",
            "name": "全局任务",
            "path": "",
            "default": true,
            "auto_create": false
        },
        ...
    ]
}
```

#### .prompt-mappings.json
```json
{
    "version": "1.0",
    "mappings": {
        "global": {
            "prefix": "",
            "suffix": "",
            "replace_map": {}
        },
        "mcp-dev": {
            "prefix": "[MCP Development Context]\n",
            "suffix": "\n[Follow Laravel 12.x MCP specifications]",
            "replace_map": {
                "API": "MCP API",
                "interface": "MCP interface",
                "service": "MCP service"
            }
        },
        ...
    }
}
```

#### .gitignore
```gitignore
# Task data directory - contains runtime queue data, not committed
task-data/

# Backup files
*.bak*
```

### 3. Design Philosophy

**Separation of Concerns**:
- **Configuration** (`.categories.json`, `.prompt-mappings.json`):
  - Contains default settings
  - Can be committed to git
  - Provides consistent setup for new clones

- **Runtime Data** (`task-data/`):
  - Contains queue files with task data
  - Excluded from git via `.gitignore`
  - Generated dynamically during runtime

**Benefits**:
1. ✓ Configuration is portable and versioned
2. ✓ Runtime data doesn't pollute repository
3. ✓ Clear separation between static config and dynamic data
4. ✓ `/www/shared-data/` still available for static file mapping if needed

## Migration Path

### From Old Structure
```
/www/shared-data/task-dispatch/
├── categories.json
├── prompt-mappings.json
└── queues/
    ├── global.json
    └── ...
```

### To New Structure
```
_prompts/
├── .categories.json          (config - commit)
├── .prompt-mappings.json     (config - commit)
└── task-data/                (data - ignore)
    └── queues/
        ├── global.json
        └── ...
```

## Testing

Run the test script to verify the new structure:

```bash
php test_new_structure.php
```

Expected output:
```
=== Testing New Structure ===

1. Testing TaskCategoryService
   - Found 6 categories
   - Categories: global, mcp-dev, ncore-dev, pycore-dev, laravel-main-dev, nuxt-dev

2. Testing PromptMappingService
   - MCP-dev prefix: [MCP Development Context]...
   - MCP-dev suffix: [Follow Laravel 12.x MCP speci...

3. Testing TaskQueueService
   - Added tasks: 3
   - Total tasks in queue: 3

4. Checking file locations
   ✓ .categories.json
   ✓ .prompt-mappings.json
   ✓ task-data/queues/global.json
   ✓ .gitignore
   ✓ README.md

=== Test Complete ===
```

## API Compatibility

All existing API endpoints remain unchanged:
- `GET /api/mcp/v1/task-dispatch/categories`
- `GET /api/mcp/v1/task-dispatch/categories/{id}/files`
- `POST /api/mcp/v1/task-dispatch/queue/add-file`
- `GET /api/mcp/v1/task-dispatch/queue/{id}/tasks`
- `GET /api/mcp/v1/task-dispatch/mappings`
- etc.

Frontend code requires no changes.

## Rollback

If needed, revert the following files:
1. `app/Apps/McpV1/McpV1Utils/TaskCategoryService.php`
2. `app/Apps/McpV1/McpV1Utils/TaskQueueService.php`
3. `app/Apps/McpV1/McpV1Utils/PromptMappingService.php`

And restore configuration to `/www/shared-data/task-dispatch/`.

## Summary

✅ Configuration files can now be committed to git
✅ Runtime data is properly excluded from version control
✅ Clear separation between static config and dynamic data
✅ All existing functionality preserved
✅ `/www/shared-data/` still available for other uses
✅ Tested and verified working
