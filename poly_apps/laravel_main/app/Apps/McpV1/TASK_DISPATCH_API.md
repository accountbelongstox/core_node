# McpV1 Task Dispatch System API Documentation

## Overview

The McpV1 Task Dispatch System provides a comprehensive task management solution that supports both MCP (Model Context Protocol) and web query interfaces. The system organizes tasks by categories and manages task queues with JSON-based storage.

Following Laravel 12.x MCP specifications: https://laravel.com/docs/12.x/mcp

## Architecture

### Storage Location
- **Configuration**: `/www/shared-data/task-dispatch/categories.json`
- **Queue Data**: `/www/shared-data/task-dispatch/queues/{categoryId}.json`
- **Prompts Directory**: `/www/programing/core_node/_prompts/`

All task data is stored outside the code repository to prevent git commits.

### Service Layer
- **TaskCategoryService**: Manages task categories based on `_prompts/` subdirectories
- **TaskQueueService**: Manages task queues, parses prompt files into tasks

### Task Parsing Logic
Each prompt file is parsed into individual tasks:
- Paragraphs separated by `\n\n` (double newline) become separate tasks
- Each task is assigned a unique ID
- Content hash prevents duplicate tasks
- Task status: `pending`, `in_progress`, `completed`

### Default Categories
1. **global** - Global Tasks (path: `_prompts/`)
2. **mcp-dev** - MCP Development Tasks (path: `_prompts/mcp-dev/`)
3. **ncore-dev** - NCORE Development Tasks (path: `_prompts/ncore-dev/`)
4. **pycore-dev** - PYCORE Development Tasks (path: `_prompts/pycore-dev/`)
5. **laravel-main-dev** - Laravel Main Development Tasks (path: `_prompts/laravel-main-dev/`)
6. **nuxt-dev** - NUXT Development Tasks (path: `_prompts/nuxt-dev/`)

## API Endpoints

Base URL: `/api/mcp/v1/task-dispatch`

### 1. Get All Categories

**Endpoint**: `GET /api/mcp/v1/task-dispatch/categories`

**Description**: Retrieves all task categories with their configuration.

**Response**:
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "mcp-dev",
        "name": "MCP开发任务",
        "path": "mcp-dev",
        "default": false,
        "auto_create": true
      }
    ],
    "total": 6
  },
  "meta": {
    "mcp_compatible": true,
    "timestamp": "2025-11-27T14:46:00+00:00"
  }
}
```

### 2. Get Category Files

**Endpoint**: `GET /api/mcp/v1/task-dispatch/categories/{categoryId}/files`

**Description**: Retrieves all prompt files in a specific category.

**Parameters**:
- `categoryId` (path) - Category identifier (e.g., `mcp-dev`)

**Response**:
```json
{
  "success": true,
  "data": {
    "category_id": "mcp-dev",
    "files": [
      {
        "name": "test-tasks.md",
        "path": "_prompts/mcp-dev/test-tasks.md",
        "category_id": "mcp-dev",
        "modified": "2025-11-27 14:46:00",
        "size": 1024
      }
    ],
    "total": 1
  },
  "meta": {
    "mcp_compatible": true,
    "timestamp": "2025-11-27T14:46:00+00:00"
  }
}
```

### 3. Create Category

**Endpoint**: `POST /api/mcp/v1/task-dispatch/categories`

**Description**: Creates a new task category.

**Request Body**:
```json
{
  "id": "custom-dev",
  "name": "Custom Development Tasks",
  "path": "custom-dev"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "category": {
      "id": "custom-dev",
      "name": "Custom Development Tasks",
      "path": "custom-dev",
      "default": false,
      "auto_create": false,
      "created_at": "2025-11-27 14:46:00"
    }
  },
  "meta": {
    "mcp_compatible": true,
    "timestamp": "2025-11-27T14:46:00+00:00"
  }
}
```

### 4. Add File to Queue

**Endpoint**: `POST /api/mcp/v1/task-dispatch/queue/add-file`

**Description**: Parses a prompt file and adds its paragraphs as tasks to the queue.

**Request Body**:
```json
{
  "category_id": "mcp-dev",
  "file_path": "_prompts/mcp-dev/test-tasks.md",
  "content": "Task 1: Implement feature A\n\nTask 2: Write tests\n\nTask 3: Update docs"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "category_id": "mcp-dev",
    "file_path": "_prompts/mcp-dev/test-tasks.md",
    "paragraphs_added": 3
  },
  "meta": {
    "mcp_compatible": true,
    "timestamp": "2025-11-27T14:46:00+00:00"
  }
}
```

### 5. Get All Tasks

**Endpoint**: `GET /api/mcp/v1/task-dispatch/queue/{categoryId}/tasks`

**Description**: Retrieves all tasks in a category queue.

**Parameters**:
- `categoryId` (path) - Category identifier
- `status` (query, optional) - Filter by status: `pending`, `in_progress`, `completed`

**Response**:
```json
{
  "success": true,
  "data": {
    "category_id": "mcp-dev",
    "tasks": [
      {
        "id": "task_6927f3ce1a1eb",
        "file": "_prompts/mcp-dev/test-tasks.md",
        "paragraph_index": 1,
        "content": "Task 1: Implement feature A",
        "content_hash": "abc123...",
        "status": "pending",
        "created_at": "2025-11-27 14:46:00",
        "updated_at": "2025-11-27 14:46:00"
      }
    ],
    "total": 3,
    "filtered_count": 3
  },
  "meta": {
    "mcp_compatible": true,
    "timestamp": "2025-11-27T14:46:00+00:00"
  }
}
```

### 6. Get Last Task

**Endpoint**: `GET /api/mcp/v1/task-dispatch/queue/{categoryId}/last-task`

**Description**: Retrieves the most recently added task (highest paragraph index).

**Parameters**:
- `categoryId` (path) - Category identifier

**Response**:
```json
{
  "success": true,
  "data": {
    "category_id": "mcp-dev",
    "task": {
      "id": "task_6927f3ce1a1f6",
      "file": "_prompts/mcp-dev/test-tasks.md",
      "paragraph_index": 3,
      "content": "Task 3: Update docs",
      "status": "pending",
      "created_at": "2025-11-27 14:46:00",
      "updated_at": "2025-11-27 14:46:00"
    }
  },
  "meta": {
    "mcp_compatible": true,
    "timestamp": "2025-11-27T14:46:00+00:00"
  }
}
```

### 7. Check Has Latest Task

**Endpoint**: `GET /api/mcp/v1/task-dispatch/queue/{categoryId}/has-latest`

**Description**: Checks if a specific file/paragraph combination exists as the latest task.

**Parameters**:
- `categoryId` (path) - Category identifier
- `file_path` (query) - File path to check
- `paragraph_index` (query) - Paragraph index to check

**Response**:
```json
{
  "success": true,
  "data": {
    "category_id": "mcp-dev",
    "has_latest": true,
    "task_id": "task_6927f3ce1a1f6"
  },
  "meta": {
    "mcp_compatible": true,
    "timestamp": "2025-11-27T14:46:00+00:00"
  }
}
```

### 8. Search Tasks

**Endpoint**: `GET /api/mcp/v1/task-dispatch/queue/{categoryId}/search`

**Description**: Searches tasks by keyword in content.

**Parameters**:
- `categoryId` (path) - Category identifier
- `keyword` (query) - Search keyword

**Response**:
```json
{
  "success": true,
  "data": {
    "category_id": "mcp-dev",
    "keyword": "feature",
    "tasks": [
      {
        "id": "task_6927f3ce1a1eb",
        "content": "Task 1: Implement feature A",
        "status": "pending"
      }
    ],
    "total": 1
  },
  "meta": {
    "mcp_compatible": true,
    "timestamp": "2025-11-27T14:46:00+00:00"
  }
}
```

### 9. Update Task Status

**Endpoint**: `PUT /api/mcp/v1/task-dispatch/queue/{categoryId}/tasks/{taskId}/status`

**Description**: Updates the status of a specific task.

**Parameters**:
- `categoryId` (path) - Category identifier
- `taskId` (path) - Task identifier

**Request Body**:
```json
{
  "status": "completed"
}
```

**Valid Status Values**:
- `pending` - Task is waiting to be processed
- `in_progress` - Task is currently being worked on
- `completed` - Task has been finished

**Response**:
```json
{
  "success": true,
  "data": {
    "category_id": "mcp-dev",
    "task_id": "task_6927f3ce1a1eb",
    "status": "completed",
    "updated_at": "2025-11-27 14:46:00"
  },
  "meta": {
    "mcp_compatible": true,
    "timestamp": "2025-11-27T14:46:00+00:00"
  }
}
```

### 10. Get Queue Statistics

**Endpoint**: `GET /api/mcp/v1/task-dispatch/queue/{categoryId}/stats`

**Description**: Retrieves statistical information about the task queue.

**Parameters**:
- `categoryId` (path) - Category identifier

**Response**:
```json
{
  "success": true,
  "data": {
    "category_id": "mcp-dev",
    "stats": {
      "total": 6,
      "pending": 4,
      "in_progress": 1,
      "completed": 1
    }
  },
  "meta": {
    "mcp_compatible": true,
    "timestamp": "2025-11-27T14:46:00+00:00"
  }
}
```

## Prompt Mapping Management

### 11. Get All Prompt Mappings

**Endpoint**: `GET /api/mcp/v1/task-dispatch/mappings`

**Description**: Retrieves all prompt mappings for all categories.

**Response**:
```json
{
  "success": true,
  "data": {
    "mappings": {
      "mcp-dev": {
        "prefix": "[MCP Development Context]\n",
        "suffix": "\n[Follow Laravel 12.x MCP specifications]",
        "replace_map": {
          "API": "MCP API",
          "interface": "MCP interface",
          "service": "MCP service"
        }
      },
      "ncore-dev": {
        "prefix": "[NCORE Development Context]\n",
        "suffix": "\n[Ensure Node.js compatibility]",
        "replace_map": {
          "module": "NCORE module",
          "component": "NCORE component"
        }
      }
    },
    "total": 6
  },
  "meta": {
    "mcp_compatible": true,
    "timestamp": "2025-11-27T14:46:00+00:00"
  }
}
```

### 12. Get Category Mapping

**Endpoint**: `GET /api/mcp/v1/task-dispatch/mappings/{categoryId}`

**Description**: Retrieves the prompt mapping for a specific category.

**Parameters**:
- `categoryId` (path) - Category identifier

**Response**:
```json
{
  "success": true,
  "data": {
    "category_id": "mcp-dev",
    "mapping": {
      "prefix": "[MCP Development Context]\n",
      "suffix": "\n[Follow Laravel 12.x MCP specifications]",
      "replace_map": {
        "API": "MCP API",
        "interface": "MCP interface",
        "service": "MCP service"
      }
    }
  },
  "meta": {
    "mcp_compatible": true,
    "timestamp": "2025-11-27T14:46:00+00:00"
  }
}
```

### 13. Update Category Mapping

**Endpoint**: `PUT /api/mcp/v1/task-dispatch/mappings/{categoryId}`

**Description**: Updates the prompt mapping for a specific category.

**Parameters**:
- `categoryId` (path) - Category identifier

**Request Body**:
```json
{
  "prefix": "[Custom Context]\n",
  "suffix": "\n[Custom Footer]",
  "replace_map": {
    "old_text": "new_text",
    "API": "Custom API"
  }
}
```

**Field Descriptions**:
- `prefix` (optional, string) - Text added before task content
- `suffix` (optional, string) - Text added after task content
- `replace_map` (optional, object) - Key-value pairs for text replacement

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "category_id": "mcp-dev",
    "mapping": {
      "prefix": "[Custom Context]\n",
      "suffix": "\n[Custom Footer]",
      "replace_map": {
        "old_text": "new_text",
        "API": "Custom API"
      }
    }
  },
  "meta": {
    "mcp_compatible": true,
    "timestamp": "2025-11-27T14:46:00+00:00"
  }
}
```

### 14. Reset Category Mapping

**Endpoint**: `POST /api/mcp/v1/task-dispatch/mappings/{categoryId}/reset`

**Description**: Resets the category mapping to default preset values.

**Parameters**:
- `categoryId` (path) - Category identifier

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "category_id": "mcp-dev",
    "mapping": {
      "prefix": "[MCP Development Context]\n",
      "suffix": "\n[Follow Laravel 12.x MCP specifications]",
      "replace_map": {
        "API": "MCP API",
        "interface": "MCP interface",
        "service": "MCP service"
      }
    }
  },
  "meta": {
    "mcp_compatible": true,
    "timestamp": "2025-11-27T14:46:00+00:00"
  }
}
```

### 15. Delete Category Mapping

**Endpoint**: `DELETE /api/mcp/v1/task-dispatch/mappings/{categoryId}`

**Description**: Deletes the mapping for a specific category (will use empty mapping).

**Parameters**:
- `categoryId` (path) - Category identifier

**Response**:
```json
{
  "success": true,
  "data": {
    "category_id": "mcp-dev",
    "deleted": true
  },
  "meta": {
    "mcp_compatible": true,
    "timestamp": "2025-11-27T14:46:00+00:00"
  }
}
```

## Prompt Mapping System

### How Mappings Work

When a task file is added to the queue, the system applies the following transformations to each task paragraph:

1. **Replace Map**: Text replacement rules are applied first
   - Example: "API" → "MCP API", "service" → "MCP service"

2. **Prefix**: Added to the beginning of the content
   - Example: `[MCP Development Context]\n`

3. **Suffix**: Added to the end of the content
   - Example: `\n[Follow Laravel 12.x MCP specifications]`

### Example Transformation

**Original Task Content**:
```
Create new API endpoint for user service
```

**Applied Mapping** (mcp-dev):
- Prefix: `[MCP Development Context]\n`
- Suffix: `\n[Follow Laravel 12.x MCP specifications]`
- Replace Map: `{"API": "MCP API", "service": "MCP service"}`

**Transformed Content**:
```
[MCP Development Context]
Create new MCP API endpoint for user MCP service
[Follow Laravel 12.x MCP specifications]
```

### Default Mappings

Each category has preset default mappings:

#### global
- Prefix: (empty)
- Suffix: (empty)
- Replace Map: (empty)

#### mcp-dev
- Prefix: `[MCP Development Context]\n`
- Suffix: `\n[Follow Laravel 12.x MCP specifications]`
- Replace Map:
  - `API` → `MCP API`
  - `interface` → `MCP interface`
  - `service` → `MCP service`

#### ncore-dev
- Prefix: `[NCORE Development Context]\n`
- Suffix: `\n[Ensure Node.js compatibility]`
- Replace Map:
  - `module` → `NCORE module`
  - `component` → `NCORE component`

#### pycore-dev
- Prefix: `[PYCORE Development Context]\n`
- Suffix: `\n[Follow Python best practices]`
- Replace Map:
  - `function` → `Python function`
  - `class` → `Python class`

#### laravel-main-dev
- Prefix: `[Laravel Main Development Context]\n`
- Suffix: `\n[Follow Laravel coding standards]`
- Replace Map:
  - `controller` → `Laravel controller`
  - `model` → `Eloquent model`
  - `middleware` → `Laravel middleware`

#### nuxt-dev
- Prefix: `[NUXT Development Context]\n`
- Suffix: `\n[Follow Vue.js and NUXT conventions]`
- Replace Map:
  - `page` → `NUXT page`
  - `component` → `Vue component`
  - `store` → `Vuex/Pinia store`

### Storage Location

Prompt mappings are stored in:
```
/www/shared-data/task-dispatch/prompt-mappings.json
```

This ensures mappings are not committed to the git repository.

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Error message description",
  "details": "Detailed error information (only in debug mode)"
}
```

**Common HTTP Status Codes**:
- `200 OK` - Request successful
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Category or task not found
- `500 Internal Server Error` - Server-side error

## MCP Compatibility

All responses include `mcp_compatible: true` in the meta section, indicating full compatibility with Laravel 12.x MCP specifications.

### MCP Protocol Support
- Standardized JSON response format
- ISO 8601 timestamp format
- Consistent error handling
- RESTful resource routing

## Usage Examples

### Example 1: Create and Process Tasks

```bash
# 1. Get all categories
curl -X GET "http://localhost/api/mcp/v1/task-dispatch/categories"

# 2. Add tasks from a file
curl -X POST "http://localhost/api/mcp/v1/task-dispatch/queue/add-file" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": "mcp-dev",
    "file_path": "_prompts/mcp-dev/tasks.md",
    "content": "Task 1: Setup\n\nTask 2: Implementation\n\nTask 3: Testing"
  }'

# 3. Get all tasks
curl -X GET "http://localhost/api/mcp/v1/task-dispatch/queue/mcp-dev/tasks"

# 4. Update task status
curl -X PUT "http://localhost/api/mcp/v1/task-dispatch/queue/mcp-dev/tasks/task_123/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'

# 5. Get queue statistics
curl -X GET "http://localhost/api/mcp/v1/task-dispatch/queue/mcp-dev/stats"
```

### Example 2: Search and Filter

```bash
# Search tasks by keyword
curl -X GET "http://localhost/api/mcp/v1/task-dispatch/queue/mcp-dev/search?keyword=feature"

# Filter tasks by status
curl -X GET "http://localhost/api/mcp/v1/task-dispatch/queue/mcp-dev/tasks?status=pending"
```

### Example 3: Manage Prompt Mappings

```bash
# 1. Get all mappings
curl -X GET "http://localhost/api/mcp/v1/task-dispatch/mappings"

# 2. Get specific category mapping
curl -X GET "http://localhost/api/mcp/v1/task-dispatch/mappings/mcp-dev"

# 3. Update mapping
curl -X PUT "http://localhost/api/mcp/v1/task-dispatch/mappings/mcp-dev" \
  -H "Content-Type: application/json" \
  -d '{
    "prefix": "[Custom MCP Context]\n",
    "suffix": "\n[Custom Footer]",
    "replace_map": {
      "API": "Custom API",
      "test": "unit test"
    }
  }'

# 4. Reset mapping to default
curl -X POST "http://localhost/api/mcp/v1/task-dispatch/mappings/mcp-dev/reset"

# 5. Delete mapping
curl -X DELETE "http://localhost/api/mcp/v1/task-dispatch/mappings/mcp-dev"
```

### Example 4: Add Tasks with Translation and Mapping

```javascript
// Frontend workflow (pseudo-code)

// 1. Get translated content from translation service
const translatedContent = await translatePromptContent(originalContent);

// 2. Add to queue (mapping will be applied automatically)
const response = await fetch('/api/mcp/v1/task-dispatch/queue/add-file', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    category_id: 'mcp-dev',
    file_path: '_prompts/mcp-dev/tasks.md',
    content: translatedContent  // Translated content is submitted
  })
});

// Tasks will have:
// - Original translated content
// - Prefix/suffix added
// - Replace map applied
```

## Testing

Test scripts are available in the Laravel root directory:

- `test_mcp_simple.php` - Service layer tests
- `test_mcpv1_task_dispatch.php` - Full integration tests
- `test_prompt_mappings.php` - Prompt mapping system tests

Run tests:
```bash
php test_mcp_simple.php
php test_mcpv1_task_dispatch.php
php test_prompt_mappings.php
```

## Notes

1. All task data is stored in external storage (`/www/shared-data/task-dispatch/`) to prevent git commits
2. Task content is hashed (MD5) to prevent duplicate entries
3. Category directories are automatically created on first use
4. Task IDs are generated using `uniqid()` with `task_` prefix
5. All timestamps use `Y-m-d H:i:s` format (local time)
6. File operations use native PHP functions for standalone compatibility
7. **Frontend should submit translated content** - Content should be translated before being submitted to the queue
8. **Mappings are applied automatically** - When tasks are added, prefix/suffix/replace_map are applied based on category
9. **Original content is preserved** - Tasks store both `original_content` and processed `content` fields
10. **Prompt mappings are customizable** - Each category can have custom prefix, suffix, and text replacement rules
11. **Default mappings** - All 6 default categories have preset mappings suitable for their development context
