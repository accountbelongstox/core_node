# Prompt Mapping System - Implementation Summary

## Overview

A comprehensive prompt mapping system has been implemented to transform task content before it's added to the queue. The system supports prefix injection, suffix injection, and text replacement rules.

## Key Features

### 1. Translation-First Workflow
- Frontend must submit **translated content** to the queue
- Original translated content is preserved in `original_content` field
- Mappings are applied to create the final `content` field

### 2. Three Transformation Types

#### Prefix
Text automatically added before task content
```
Example: "[MCP Development Context]\n"
```

#### Suffix
Text automatically added after task content
```
Example: "\n[Follow Laravel 12.x MCP specifications]"
```

#### Replace Map
Key-value pairs for text replacement
```json
{
  "API": "MCP API",
  "service": "MCP service",
  "interface": "MCP interface"
}
```

### 3. Transformation Order
1. Replace map is applied first
2. Prefix is added to the beginning
3. Suffix is added to the end

### 4. Default Category Mappings

Each category has predefined mappings optimized for its context:

- **global**: No transformations (empty prefix/suffix/map)
- **mcp-dev**: MCP development context with Laravel 12.x references
- **ncore-dev**: Node.js NCORE development context
- **pycore-dev**: Python development context
- **laravel-main-dev**: Laravel framework development context
- **nuxt-dev**: Vue.js and NUXT development context

## Implementation Details

### New Service
- **PromptMappingService**: Manages mapping configurations
  - Location: `app/Apps/McpV1/McpV1Utils/PromptMappingService.php`
  - Storage: `/www/shared-data/task-dispatch/prompt-mappings.json`

### Updated Service
- **TaskQueueService**: Now applies mappings when adding tasks
  - New parameter: `applyMapping` (default: true)
  - Preserves both original and processed content

### New Controller Methods (5)
1. `getAllMappings()` - Get all category mappings
2. `getCategoryMapping()` - Get specific category mapping
3. `updateCategoryMapping()` - Update mapping configuration
4. `resetCategoryMapping()` - Reset to default preset
5. `deleteCategoryMapping()` - Delete custom mapping

### New Routes (5)
```
GET    /api/mcp/v1/task-dispatch/mappings
GET    /api/mcp/v1/task-dispatch/mappings/{categoryId}
PUT    /api/mcp/v1/task-dispatch/mappings/{categoryId}
POST   /api/mcp/v1/task-dispatch/mappings/{categoryId}/reset
DELETE /api/mcp/v1/task-dispatch/mappings/{categoryId}
```

## Frontend Requirements

### Task Submission Workflow

```javascript
// 1. Translate content first
const translatedContent = await translatePrompt(originalContent);

// 2. Submit translated content to queue
const response = await fetch('/api/mcp/v1/task-dispatch/queue/add-file', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    category_id: 'mcp-dev',
    file_path: '_prompts/mcp-dev/task.md',
    content: translatedContent  // Already translated!
  })
});
```

### Mapping Management UI

The frontend UI should provide:

1. **View Mappings**
   - Display current prefix/suffix/replace_map for each category
   - Show default vs custom mappings

2. **Edit Mappings**
   - Text input for prefix
   - Text input for suffix
   - Key-value editor for replace map
   - Add/remove replacement rules

3. **Actions**
   - Save custom mapping
   - Reset to default
   - Delete mapping

4. **Preview**
   - Show how content will be transformed
   - Before/after comparison

## Example Transformation

**Input (translated content)**:
```
Create new API endpoint for user service
```

**Category**: mcp-dev

**Applied Mapping**:
- Prefix: `[MCP Development Context]\n`
- Suffix: `\n[Follow Laravel 12.x MCP specifications]`
- Replace: `API` → `MCP API`, `service` → `MCP service`

**Output (stored in task)**:
```
[MCP Development Context]
Create new MCP API endpoint for user MCP service
[Follow Laravel 12.x MCP specifications]
```

## Testing

All functionality has been tested:
```bash
php test_prompt_mappings.php
```

Tests verify:
- ✅ Get all mappings
- ✅ Get category-specific mapping
- ✅ Update mapping
- ✅ Add file with mapping applied
- ✅ Verify transformed content
- ✅ Reset to default
- ✅ External storage

## Total API Endpoints

The task dispatch system now has **15 total endpoints**:
- 3 Category management
- 7 Queue management
- 5 Mapping management (NEW)

## Storage Structure

```
/www/shared-data/task-dispatch/
├── categories.json          # Category configurations
├── prompt-mappings.json     # Mapping configurations (NEW)
└── queues/
    ├── global.json
    ├── mcp-dev.json
    ├── ncore-dev.json
    ├── pycore-dev.json
    ├── laravel-main-dev.json
    └── nuxt-dev.json
```

## Documentation

Complete API documentation available at:
`app/Apps/McpV1/TASK_DISPATCH_API.md`

Includes:
- All 15 endpoint specifications
- Request/response examples
- Mapping system explanation
- Default mapping presets
- Usage examples with curl
