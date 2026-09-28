# Flutter Design Tool - Architecture Documentation

## Overview

This is a comprehensive web-based tool for managing Flutter app design documentation, built following pycore standards.

## Directory Structure

```
flutter_dev_tools/
├── config/                      # Configuration management
│   ├── __init__.py
│   ├── app_config.py           # Main configuration (uses Encyclopedia cache)
│   └── routes_config.py        # Route definitions
│
├── routes/                      # HTTP route handlers (modular)
│   ├── __init__.py
│   ├── base_handler.py         # Base handler with common utilities
│   ├── config_routes.py        # /api/config endpoints
│   ├── system_routes.py        # /api/system, /api/shutdown
│   ├── static_routes.py        # / and /static/* serving
│   ├── app_routes.py           # /api/apps/* (TODO: implement)
│   ├── file_routes.py          # /api/file/* (TODO: implement)
│   ├── folder_routes.py        # /api/folder/* (TODO: implement)
│   ├── pageview_routes.py      # /api/apps/*/pageview/* (TODO: implement)
│   └── comparison_routes.py    # /api/apps/*/comparison/* (TODO: implement)
│
├── api/                         # Business logic modules (existing)
│   ├── app_checker.py          # App structure validation
│   ├── file_tree.py            # File tree building
│   ├── file_reader.py          # File content reading
│   ├── file_writer.py          # File saving
│   ├── folder_opener.py        # Open in explorer
│   ├── pageview_updater_api.py # PageView map operations
│   └── comparison_api.py       # Comparison image operations
│
├── utils/                       # Utility modules (existing)
│   ├── path_utils.py           # Path operations & security
│   ├── port_manager.py         # Port management
│   ├── design_structure_auto_expand.py  # Auto-create design structure
│   ├── image_analyzer.py       # Color palette + OCR analysis
│   ├── pageview_updater.py     # PageView map updating
│   └── comparison_manager.py   # Comparison image generation
│
├── static/                      # Frontend assets
│   ├── index.html              # Main HTML with menu bar
│   ├── css/
│   │   ├── base.css            # Variables, resets
│   │   ├── layout.css          # Grid layout
│   │   ├── buttons.css         # Button styles
│   │   ├── sidebar.css         # File tree panel
│   │   ├── panel.css           # Main content panel
│   │   ├── tree.css            # Tree view component
│   │   ├── file-viewer.css     # File viewer & image preview
│   │   ├── prompts.css         # Prompts panel
│   │   └── menu.css            # Menu bar & settings dialog
│   └── js/
│       ├── storage-manager.js  # LocalStorage persistence
│       ├── menu-system.js      # Menu bar with dropdowns
│       ├── settings-manager.js # Settings UI & config editing
│       ├── tree-view.js        # File tree component
│       ├── file-viewer.js      # File display/editing + image preview
│       ├── folder-manager.js   # Folder operations
│       ├── comparison-uploader.js  # Comparison image upload
│       ├── prompts-panel.js    # AI prompts with dynamic variables
│       ├── pageview-updater.js # PageView map update UI
│       ├── app-panel.js        # Tab & panel rendering
│       └── app.js              # Main initialization
│
├── main.py                      # HTTP server (TODO: refactor to use routes)
└── ARCHITECTURE.md             # This file
```

## pycore Integration

### Standards Compliance (PYTHON_PYCORE.md)

**Import Order**:
```python
# Standard library
import json
from pathlib import Path

# Third-party
# (none currently)

# pycore modules
from pycore.pyfoundations import ColorPrint, ENCYCLOPEDIA
from pycore.pyfoundations.pygvar import IS_WINDOWS, PROJECT_ROOT, CACHE_DIR
```

**Global Variables Used**:
- `ENCYCLOPEDIA` - Configuration caching
- `IS_WINDOWS`, `CPU_COUNT` - Platform detection
- `PROJECT_ROOT` - Base directory
- `LOCAL_CORE_NODE_DIR`, `CACHE_DIR` - Storage paths
- `SYSTEM_SCREEN_RESOLUTION`, `SYSTEM_MEMORY_INFO`, `SYSTEM_DISK_INFO` - System info

**No try-except blocks** (AI code rule)
**All imports at file top** (no conditional imports)

## Configuration System

### Storage Location
- File: `~/.core_node/flutter_dev_tools/config.json`
- Cache: `ENCYCLOPEDIA` with key prefix `flutter_dev_tool_config`

### Configuration Structure
```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 5757,
    "auto_kill_old_instances": true
  },
  "paths": {
    "flutter_root": "D:/programing/core_node/poly_apps/flutter_bloom",
    "apps_base_dir": "lib/apps",
    "design_docs_dirname": "design_docs_and_progress"
  },
  "features": {
    "auto_expand_structure": true,
    "auto_initialize_apps": true,
    "image_analysis_enabled": true,
    "comparison_system_enabled": true
  },
  "image_analysis": {
    "color_palette_top_n": 10,
    "ocr_model_type": "scene",
    "auto_analyze_on_upload": true
  },
  "comparison": {
    "external_storage_enabled": true,
    "label_expected": "Expected Design",
    "label_actual": "Actual Implementation",
    "label_height": 80
  },
  "ui": {
    "theme": "light",
    "show_file_tree": true,
    "show_prompts_panel": true
  }
}
```

### API Endpoints

**Configuration**:
- `GET /api/config` - Get current configuration
- `POST /api/config` - Update configuration (body: `{key, value}`)
- `POST /api/config/reset` - Reset to defaults

**System**:
- `POST /api/shutdown` - Graceful server shutdown
- `GET /api/system/info` - Get system information (screen, memory, disk, platform)

## Frontend Architecture

### Three-Column Layout
- **Left**: File tree (collapsible folders, file selection)
- **Middle**: Content viewer (file editing, image preview, current path display)
- **Right**: Dynamic AI prompts (context-aware, one-click copy)

### Menu System
- **File**: Reload, Settings, Shutdown
- **View**: Toggle panels, Expand/Collapse all
- **Tools**: Update PageView maps, System info, Clear cache
- **Help**: Documentation, About

### Settings Dialog
- Real-time configuration editing
- Grouped by section (Server, Paths, Features, etc.)
- Save & Reload or Reset to defaults
- Direct API calls to update backend config

## Image Comparison System

### Workflow
1. Select design image in file tree
2. Click "Upload Comparison" button
3. Upload actual implementation screenshot
4. System generates side-by-side composite image
5. Comparison stored in external directory: `D:\programing\_build_dir\flutter_main\{app}\comparison_images\{page}\`
6. History list shows all past comparisons
7. Click comparison to update AI prompt with download URL

### Composite Image Format
- **Left**: Expected design (from 2_page_designs_rough or 3_page_designs_detailed)
- **Right**: Actual implementation (auto-resized to match height)
- **Top labels**: Blue "Expected Design" vs Red "Actual Implementation"
- **White padding**: Fills width differences
- **Filename**: `{app}_{page}_{description}_{timestamp}_comparison.png`

## Next Steps (TODO)

1. **Refactor main.py**:
   - Use new route handlers instead of inline logic
   - Implement router pattern to match paths to handlers
   - Reduce main.py to < 200 lines

2. **Complete Route Handlers**:
   - Migrate existing API logic to route handler classes
   - `app_routes.py` - App listing, tree, fix
   - `file_routes.py` - File read, save, image serving
   - `folder_routes.py` - Open in explorer
   - `pageview_routes.py` - PageView map operations
   - `comparison_routes.py` - Comparison image creation/download

3. **Testing**:
   - Test all configuration endpoints
   - Verify menu system on all browsers
   - Test settings persistence across sessions

4. **Documentation**:
   - API endpoint documentation with examples
   - Developer guide for adding new routes
   - User guide for web interface features

## Development Standards

- **All code in English** (comments, strings, logs)
- **Follow pycore standards** (import order, no try-except in AI code)
- **Modular architecture** (routes, config, utils separated)
- **Configuration-driven** (behavior controlled via config.json)
- **Cache-optimized** (Encyclopedia for fast access)
- **Extensible design** (easy to add new menus, routes, features)
