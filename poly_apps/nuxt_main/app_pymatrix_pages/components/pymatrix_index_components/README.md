# PyMatrix Index Components

This directory contains core layout components used by the main PyMatrix app component.

## Purpose

Following the architecture pattern: `{namespace}_index_components/`

These are the primary structural components that compose the PyMatrix application layout:
- Top navigation bar
- Left panel (device tree, filters)
- Right panel (controls, settings)
- Other core UI elements

## Recommended Components to Move Here

Based on the current structure, the following components should be relocated here:

### Layout Components
- `PyMatrixTopBar.vue` - Main navigation and controls
- `PyMatrixLeftPanel.vue` - Device tree and filters sidebar
- `PyMatrixRightPanel.vue` - Control panels sidebar

### Core Dialogs
- `PyMatrixConnectDialog.vue` - Device connection dialog
- `PyMatrixSettingsDialog.vue` - App settings
- `PyMatrixFullscreenPlayer.vue` - Video fullscreen mode

### Core Empty States
- `PyMatrixEmptyState.vue` - No devices connected state

## Component Organization Pattern

```
pymatrix_index_components/
├── README.md (this file)
├── PyMatrixTopBar.vue           # Top navigation
├── PyMatrixLeftPanel.vue         # Left sidebar
├── PyMatrixRightPanel.vue        # Right sidebar
├── PyMatrixConnectDialog.vue     # Connection dialog
├── PyMatrixSettingsDialog.vue    # Settings dialog
├── PyMatrixFullscreenPlayer.vue  # Fullscreen video
└── PyMatrixEmptyState.vue        # Empty state
```

## Usage Example

```vue
<!-- In PyMatrixApp.vue -->
<script setup>
import PyMatrixTopBar from './pymatrix_index_components/PyMatrixTopBar.vue';
import PyMatrixLeftPanel from './pymatrix_index_components/PyMatrixLeftPanel.vue';
import PyMatrixRightPanel from './pymatrix_index_components/PyMatrixRightPanel.vue';
</script>

<template>
  <div class="pymatrix-layout">
    <PyMatrixTopBar />
    <div class="pymatrix-main">
      <PyMatrixLeftPanel />
      <div class="pymatrix-content">
        <!-- Main content area -->
      </div>
      <PyMatrixRightPanel />
    </div>
  </div>
</template>
```

## Feature-Specific Components

Components organized by feature should remain in their respective directories:

```
components_app_pymatrix/
├── pymatrix_index/              # Main app component
├── pymatrix_index_components/   # Core layout (this directory)
├── device/                      # Device management
│   ├── PyMatrixDeviceGrid.vue
│   ├── DeviceInfoPanel.vue
│   └── DeviceSearchBar.vue
├── group/                       # Group control
│   ├── GroupControlPanel.vue
│   └── GroupTreeView.vue
├── recording/                   # Recording features
│   ├── RecordingControlPanel.vue
│   └── VideoPlayer.vue
└── file/                        # File operations
    ├── FilePushPanel.vue
    └── ApkInstallPanel.vue
```

## Migration Steps (Optional)

1. Move core layout components to this directory
2. Update import paths in `PyMatrixApp.vue`
3. Test application functionality
4. Update component documentation

**Note:** This reorganization is optional but recommended for better code organization and maintainability.

## Architecture Reference

See: `development-guides/NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md`
- Section: Component Naming Examples (Line 204-207)
- Pattern: `{namespace}_index_components/` for sub-components
