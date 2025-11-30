# Code Browser Integration Architecture

## Overview

The Code Browser has been redesigned as a comprehensive development workspace with integrated task management and prompt mapping capabilities.

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                        Code Browser                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┬───────────────────────────────────────┐  │
│  │   File Tree      │     Code Editor                       │  │
│  │   (Left)         │     (Right)                           │  │
│  │  📁 core_node    │  ┌─────────────────────────────────┐  │  │
│  │  ├── _prompts    │  │  File: example.md               │  │  │
│  │  ├── poly_apps   │  │  --------------------------------│  │  │
│  │  └── ...         │  │  [Editor content]               │  │  │
│  │                  │  │                                 │  │  │
│  └──────────────────┴─ └─────────────────────────────────┘  │  │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┬───────────────────────────────────────┐  │
│  │ Tasks/Prompts    │  Prompt Mapping Manager               │  │
│  │ List (Left)      │  (Right)                              │  │
│  │ ┌──────────────┐ │  ┌─────────────────────────────────┐ │  │
│  │ │Category:     │ │  │ Mapping for: [Category]         │ │  │
│  │ │[Selector]    │ │  │ ┌──────────────────────────────┐│ │  │
│  │ ├──────────────┤ │  │ │ Prefix:                      ││ │  │
│  │ │ task1.md     │ │  │ │ [MCP Context...]             ││ │  │
│  │ │ task2.md     │ │  │ ├──────────────────────────────┤│ │  │
│  │ │ task3.md     │ │  │ │ Suffix:                      ││ │  │
│  │ │     [Queue]  │ │  │ │ [Follow Laravel...]          ││ │  │
│  │ └──────────────┘ │  │ ├──────────────────────────────┤│ │  │
│  │                  │  │ │ Replace Map:                 ││ │  │
│  └──────────────────┴─ └─┴──────────────────────────────┴┘ │  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Module Relationships

### 1. Code Browser (code-browser.js)
**Purpose**: File browsing and editing
**Functions**:
- Display file tree
- Open and edit files
- Save files
- File operations (rename, delete, etc.)

### 2. Prompts/Tasks Manager (prompts-tasks-manager.js)
**Purpose**: Manage prompt files and queue tasks
**Functions**:
- Display category selector
- List prompt files by category
- Create new task files
- Add files to task queue
- Integrate with translation service

**Key Features**:
- **Category Selection**: When user selects a category, it:
  1. Loads files from that category
  2. Triggers `PromptMappingManager.switchCategory(categoryId)`

**API Integration**:
```javascript
// Get category files
GET /api/mcp/v1/task-dispatch/categories/{categoryId}/files

// Add file to queue
POST /api/mcp/v1/task-dispatch/queue/add-file
{
  category_id: 'mcp-dev',
  file_path: '_prompts/mcp-dev/task.md',
  content: '[translated content]'
}
```

### 3. Prompt Mapping Manager (prompt-mapping-manager.js)
**Purpose**: Configure prompt transformations
**Modes**:
- **Standalone Mode**: With category list (for dedicated section)
- **Embedded Mode**: Without category list (for Code Browser integration)

**Functions**:
- Display current mapping (prefix, suffix, replace_map)
- Edit mapping configuration
- Save/reset/delete mappings
- Preview transformations

**External Control**:
```javascript
// Switch to a specific category (called by PromptsTasksManager)
PromptMappingManager.switchCategory('mcp-dev');

// Initialize in embedded mode
PromptMappingManager.init('#prompt-mapping-panel-embedded');
```

## Data Flow

### Workflow: Adding Tasks to Queue

```
1. User selects category in PromptsTasksManager
   ↓
2. PromptsTasksManager loads files from API
   PromptsTasksManager.loadCategory('mcp-dev')
   ↓
3. PromptsTasksManager triggers mapping manager
   PromptMappingManager.switchCategory('mcp-dev')
   ↓
4. Mapping manager displays configuration for 'mcp-dev'
   Shows prefix, suffix, replace_map
   ↓
5. User clicks [Queue] button on a file
   ↓
6. PromptsTasksManager reads file content
   GET /code-browser/read-file?path=...
   ↓
7. Content is sent to queue API (with mapping applied on backend)
   POST /api/mcp/v1/task-dispatch/queue/add-file
   {
     category_id: 'mcp-dev',
     file_path: '_prompts/mcp-dev/task.md',
     content: '[content]'  // Should be translated before submission
   }
   ↓
8. Backend applies mapping:
   - Applies replace_map
   - Adds prefix
   - Adds suffix
   ↓
9. Tasks stored in queue with both original and processed content
   /www/shared-data/task-dispatch/queues/mcp-dev.json
```

### Category Synchronization

```
PromptsTasksManager              PromptMappingManager
       │                                  │
       │  Category Changed                │
       │  (User selects from dropdown)    │
       │                                  │
       ├──── switchCategory('mcp-dev') ──→│
       │                                  │
       │                             Load mapping
       │                             Display config
       │                                  │
       │  <── Both panels synchronized ───┤
```

## Backend Integration

### API Endpoints Used

#### Category Management
- `GET /api/mcp/v1/task-dispatch/categories` - Get all categories
- `GET /api/mcp/v1/task-dispatch/categories/{id}/files` - Get files

#### Queue Management
- `POST /api/mcp/v1/task-dispatch/queue/add-file` - Add file to queue
- `GET /api/mcp/v1/task-dispatch/queue/{id}/tasks` - Get tasks
- `GET /api/mcp/v1/task-dispatch/queue/{id}/stats` - Get statistics

#### Mapping Management
- `GET /api/mcp/v1/task-dispatch/mappings` - Get all mappings
- `GET /api/mcp/v1/task-dispatch/mappings/{id}` - Get category mapping
- `PUT /api/mcp/v1/task-dispatch/mappings/{id}` - Update mapping
- `POST /api/mcp/v1/task-dispatch/mappings/{id}/reset` - Reset to default

### Backend Services

```
TaskCategoryService
├── Manages categories configuration
└── /www/shared-data/task-dispatch/categories.json

TaskQueueService
├── Manages task queues
├── Applies PromptMappingService transformations
└── /www/shared-data/task-dispatch/queues/*.json

PromptMappingService
├── Manages mapping configurations
├── Applies prefix/suffix/replace_map
└── /www/shared-data/task-dispatch/prompt-mappings.json

McpV1TaskDispatchCtl
└── API controller for all endpoints
```

## File Structure

```
/www/programing/core_node/poly_apps/laravel_main/
├── app/
│   ├── Apps/
│   │   └── McpV1/
│   │       ├── McpV1Controllers/
│   │       │   └── McpV1TaskDispatchCtl.php
│   │       └── McpV1Utils/
│   │           ├── TaskCategoryService.php
│   │           ├── TaskQueueService.php
│   │           └── PromptMappingService.php
│   └── Http/EnvironmentApiInfo/
│       ├── assets/js/
│       │   ├── code-browser.js            (File browsing & editing)
│       │   ├── prompts-tasks-manager.js   (Task list & queue management)
│       │   └── prompt-mapping-manager.js  (Mapping configuration)
│       └── debug_interface_template.html

External Storage (Not in Git):
/www/shared-data/task-dispatch/
├── categories.json
├── prompt-mappings.json
└── queues/
    ├── global.json
    ├── mcp-dev.json
    ├── ncore-dev.json
    ├── pycore-dev.json
    ├── laravel-main-dev.json
    └── nuxt-dev.json
```

## Usage Flow

### For End Users

1. **Open Code Browser** → Navigate to Code Browser section
2. **Browse Files** → Use upper file tree to explore
3. **Edit Files** → Click file to edit in upper right panel
4. **Select Category** → Choose category from dropdown in lower left
5. **View Mappings** → See current category's mapping rules in lower right
6. **Add to Queue** → Click [Queue] button to add file to task queue
7. **Manage Mappings** → Edit prefix/suffix/replace_map as needed

### For Developers

**To add a new category**:
1. Add entry to `TaskCategoryService::$defaultCategories`
2. Add default mapping to `PromptMappingService::$defaultMappings`
3. Add option to `#prompt-category-selector` in HTML

**To modify transformation logic**:
1. Edit `PromptMappingService::applyMapping()` method
2. Update `TaskQueueService::addFileToQueue()` if needed

**To extend UI**:
1. Modify HTML structure in `debug_interface_template.html`
2. Update JavaScript in respective module files
3. Maintain separation of concerns

## Key Features

✅ **Integrated Workspace**: File editing + task management in one view
✅ **Category-based Organization**: 6 default categories with custom support
✅ **Prompt Transformation**: Automatic prefix/suffix/replace_map application
✅ **External Storage**: Data stored outside git repository
✅ **MCP Compatible**: Follows Laravel 12.x MCP specifications
✅ **Translation Integration**: Submit translated content before queueing
✅ **Real-time Synchronization**: Category changes sync across panels
✅ **Preview System**: Preview transformations before applying
✅ **Modular Architecture**: Multi-file system for maintainability

## Important Notes

1. **Translation First**: Frontend should always translate content before adding to queue
2. **Mapping Application**: Backend automatically applies mappings when adding tasks
3. **Original Preservation**: Both original and processed content are stored
4. **External Storage**: All task/mapping data stored in `/www/shared-data/`
5. **No Git Commits**: External storage prevents accidental commits of task data
