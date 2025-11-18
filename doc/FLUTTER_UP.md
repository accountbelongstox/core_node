# Flutter Development Updates

## 2025-11-19 - PageView Map v2.0 with Auto Image Analysis

### Major Refactoring: Single pageview_map.json
- **Before**: One pageview_map.json per page directory (`3_page_designs_detailed/{page_name}/pageview_map.json`)
- **After**: Single file at root (`design_docs_and_progress/pageview_map.json`) mapping ALL pages

### Auto Image Analysis System
- **Color Palette Extraction**: Top 10 colors with ratios `[["#FFFFFF", 0.35], ...]`
- **OCR Text Recognition**: Automatic text extraction with positions `{"text": "Welcome", "position": [x,y,w,h], "confidence": 0.95}`
- **Incremental Updates**: Only analyzes new/changed images, skips already-analyzed
- **Orphan Cleanup**: Auto-removes entries for deleted images

### Backend Implementation
- **Image Analyzer**: `utils/image_analyzer.py` (PIL color analysis + pycore OCR integration)
- **PageView Updater**: `utils/pageview_updater.py` (scan layers, update JSON, cleanup)
- **API Endpoints**:
  - `POST /api/apps/{app}/pageview/update` - Update with analysis (params: layer, force)
  - `GET /api/apps/{app}/pageview/stats` - Get current statistics

### Frontend UI Buttons
- **Update All Layers**: Analyze all images in rough + detailed layers
- **Update Rough Layer**: Only analyze 2_page_designs_rough images
- **Update Detailed Layer**: Only analyze 3_page_designs_detailed images
- **Force Re-analyze**: Re-process all images even if already analyzed
- **Live Stats Display**: Shows pages/images count and analysis completion %

### Template Files Now Empty
- All auto-generated files (architecture.md, user_flows.md, etc.) created empty
- No example content, developers fill with actual design info

### Deprecated File Cleanup
- Auto-removes old page-level `pageview_map.json` files from 3_page_designs_detailed subdirectories
- Keeps only single root-level pageview_map.json

**Files Created**:
- `utils/image_analyzer.py` - Color + OCR analysis utility
- `utils/pageview_updater.py` - PageView map update logic
- `api/pageview_updater_api.py` - API endpoints
- `static/js/pageview-updater.js` - Frontend component

**Files Modified**:
- `utils/design_structure_auto_expand.py` - Empty templates, root pageview_map.json
- `main.py` - Added pageview update endpoints
- `static/index.html` - Added pageview-updater.js
- `static/js/app.js` - Initialize PageViewUpdater
- `static/js/app-panel.js` - Render update buttons
- `development-guides/FLUTTER_GUIDE.md` - Updated pageview_map.json v2.0 schema

---

## 2025-11-19 - Dynamic AI Prompts Panel

### New Three-Column Layout
- **Left**: File tree (design files browser)
- **Middle**: File viewer (reserved for future use)
- **Right**: Dynamic prompts panel (context-aware AI commands)

### Dynamic Prompts System
- Context-aware prompt generation based on currently selected app
- Dynamic path replacement (paths update when switching apps)
- One-click copy to clipboard with visual feedback
- Expandable details sections for complex prompts
- Extensible architecture (add new prompts by uncommenting or adding templates)

### First Prompt: Pageview Migration
- Scans `{app}/doc/pageviews/` directory for design images
- Generates instructions to copy images to `3_page_designs_detailed/`
- Updates `pageview_map.json` following FLUTTER_GUIDE.md specifications
- All paths dynamically updated based on selected app tab

### Technical Implementation
- **Frontend**: `static/js/prompts-panel.js` (PromptsPanel class)
- **Styles**: `static/css/prompts.css` (gradient headers, card design)
- **Layout**: Updated `layout.css` for three-column responsive layout
- **Integration**: `app.js` and `app-panel.js` updated to sync prompts on tab switch

### Extensibility Features
- 3+ commented prompt templates ready to uncomment
- Template structure documented in code comments
- Easy to add custom prompts following existing pattern
- Prompt categories: Migration, Validation, Reporting, Structure

**Files Modified**:
- `static/index.html` - Added prompts panel HTML
- `static/css/layout.css` - Three-column layout
- `static/css/base.css` - Added CSS variables
- `static/css/prompts.css` - New prompts styling
- `static/js/prompts-panel.js` - New prompts logic
- `static/js/app.js` - Integration
- `static/js/app-panel.js` - Update prompts on tab switch

---

## 2025-11-19 - FLUTTER_GUIDE.md Documentation Sync

### Design & Development Documentation Section Updated
- Updated to reflect **three-layer design system** (not old concept_notes/wireframes structure)
- Layer 1: `1_concept_designs/` - Architecture, flows, data models
- Layer 2: `2_page_designs_rough/` - Page wireframes (rough designs)
- Layer 3: `3_page_designs_detailed/` - Detailed specs with pageview_map.json
- Added auto-expansion mechanism description
- Added smart example images feature (context-aware placeholders)
- Removed outdated references to old directory names and progress_logs structure
- Added workflow: Layer 1 → Layer 2 → Layer 3 → Development
- References: `doc/DESIGN_DOCS_STRUCTURE.md`, `doc/DESIGN_IMAGES_PLACEMENT.md`

**File**: `development-guides/FLUTTER_GUIDE.md`

---

## 2025-11-19 - Design Tool Enhancement

### Design Documentation Tool Tree View
- Added tree structure visualization for missing files/folders
- Missing items now display as hierarchical tree with folder/file icons
- Improved visual clarity for understanding documentation structure

### Safe File Creation
- Create missing items NEVER overwrites existing files
- All file checks performed before writing
- Directories use `exist_ok=True` to prevent errors
- Critical safety comments added in code

### Interactive Menu Integration
- Design tool added to main launcher menu as toggleable option
- Launch/Restart state toggle with left arrow key
- Generates fixed .bat file `design_tool.bat` (overwrites previous)
- Auto-opens browser at http://127.0.0.1:5757
- Menu continues running after launch (non-blocking)

### App Scanning Fix
- Fixed: Only scan directories starting with `app_` prefix
- Excluded: `.prompts` and other non-app directories
- Applied to both launcher and design tool scanners

## 2025-11-19 - Multi-File Architecture Refactor

### Backend Modular Structure
- Split into API modules: app_checker, file_tree, file_reader, folder_opener
- Utils module for path operations with security checks
- main.py as HTTP server with REST API endpoints

### Frontend Component Architecture
- Separated HTML/CSS/JS into multiple files
- TreeView component for expandable file browser
- FileViewer component for content display
- App.js coordinates all components

### New Features
- Left sidebar with collapsible file tree
- Click files to view content in main panel
- Click folders to expand/collapse
- Open folder in Explorer/Finder via API
- Cross-platform support (Windows/Linux/macOS)

### Auto-Initialization & Specifications
- Startup auto-creates missing files for all apps
- pageview_map.json includes Flutter 2025 specifications
- Descriptions field with MVVM architecture guidelines
- Step-by-step file updates (skips existing files)
- Auto-updates descriptions in existing map files

### Bug Fixes (API & Frontend)
- Fixed: POST responses now return JSON instead of HTML
- Fixed: File tree path resolution for Windows backslashes
- Added: Console debug logging for troubleshooting
- Improved: Error handling in folder open API

### Port Management & Auto-Cleanup
- Startup auto-kills old server instances on port 5757
- Two-stage shutdown: HTTP API first, force kill as fallback
- HTTP endpoint: POST to /api/shutdown for graceful exit
- Multi-layer safety: validates process name, script path, directory/port
- Cross-platform: Windows (netstat/taskkill), Linux (lsof/kill)
- Never kills other applications - only our own server

## 2025-11-19 - LocalStorage State Management & File Editing

### LocalStorage Persistence
- Remembers last selected app tab across refreshes
- Saves file tree expanded/collapsed folder states per app
- Default: All folders expanded on first visit, then uses cached state
- Restores last viewed file when switching apps
- Extensible storage manager for future state additions

### File Editor with JSON Validation
- In-browser file editing with Edit/View toggle
- Save button with real-time content tracking (modified indicator)
- Automatic JSON validation for .json files before saving
- POST /api/file/save endpoint with security path checks
- Textarea editor with monospace font and resize support

### Architecture Components
- storage-manager.js: Centralized localStorage API
- file_writer.py: Backend file save with JSON validation
- Enhanced FileViewer: Edit mode, dirty state, save handler
- TreeView: Persists expanded folders using storageManager

### UI Improvements
- Design folder path now includes inline "Open in Explorer" button
- Quick access to design directory from main panel
- Hover effect with scale animation for better UX
- Non-blocking subprocess call (works on Windows/Linux/macOS)

### File Tree Folder Selection
- Click folders in tree view to show current path in sidebar
- "Current:" path display appears below Design Files header
- Quick open button for currently selected folder
- Auto-calculates absolute path from relative tree path
- Distinguishes Windows/Linux path separators automatically
- Folder selection persists with visual highlight

### Modular Architecture Refactor
**CSS Modules** (7 files):
- base.css: Variables, resets, typography
- layout.css: Main container, tabs, content area
- buttons.css: All button variations
- sidebar.css: File tree panel styles
- panel.css: Main panel styles
- tree.css: Tree view component
- file-viewer.css: File editor and viewer

**JS Modules** (6 files):
- storage-manager.js: LocalStorage persistence
- tree-view.js: File tree component
- file-viewer.js: File display/editing
- folder-manager.js: Folder operations
- app-panel.js: UI rendering (tabs, panels)
- app.js: Core initialization

Benefits: Better maintainability, easier to extend, clearer separation of concerns
