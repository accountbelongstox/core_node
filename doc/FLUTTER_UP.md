# Flutter Development Updates

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
