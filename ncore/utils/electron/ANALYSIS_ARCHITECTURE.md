# Electron Integration - Deep Architecture Analysis

**Date**: 2025-11-23
**Scope**: ncore/utils/electron + pycore/pyutils/native_ui
**Purpose**: Extension design for parameterized tray/window launching

---

## 1. Current Architecture Analysis

### 1.1 ncore/utils/electron (Node.js + Electron)

**Files**:
- `index.js` (814 lines) - ElectronManager class
- `preload.js` (44 lines) - Context bridge for renderer process

**Current Features**:

| Feature | Status | Implementation |
|---------|--------|---------------|
| Tray-only mode | ✅ Supported | `mode.trayOnly` |
| Window control | ✅ Supported | `window.enabled`, `window.showOnStart` |
| Frameless window | ✅ Supported | `window.frame: false` |
| Web content loading | ✅ Supported | `loadURL()`, `loadFile()`, `loadHTML()` |
| Tray menu | ✅ Supported | `updateTrayMenu()` |
| Service monitoring | ✅ Supported | WebSocket/HTTP health checks |

**Configuration Schema**:
```javascript
{
  mode: {
    trayOnly: boolean,          // Only start tray (no window)
    hideOnClose: boolean,       // Hide to tray on close
    minimizeToTray: boolean     // Minimize to tray
  },
  window: {
    enabled: boolean,           // Enable window creation
    showOnStart: boolean,       // Show window on startup
    frame: boolean,             // Native title bar (false = frameless)
    transparent: boolean,       // Transparent window
    width: 1200,
    height: 800,
    content: {
      type: "url" | "file" | "html",
      source: string
    }
  },
  tray: {
    enabled: boolean,
    icon: string,
    tooltip: string,
    doubleClickAction: "openFrontend" | "openWindow" | "openBackend",
    contextMenu: { items: {...} }
  }
}
```

**Strengths**:
- ✅ Already supports tray-only mode
- ✅ Already supports frameless windows
- ✅ Already supports Web loading
- ✅ Flexible configuration system
- ✅ Service health monitoring
- ✅ Cross-platform (Windows/Mac/Linux)

**Gaps**:
- ❌ No custom title bar implementation (relies on OS or frameless)
- ❌ No Python-style WebView wrapper
- ❌ No built-in loading animations (must provide HTML)

---

### 1.2 pycore/pyutils/native_ui (Python + PySide6)

**Directory Structure**:
```
pycore/pyutils/native_ui/
├── step0_i18n/          # Internationalization
├── step1_config/        # Configuration models
├── step2_port_url/      # Port allocation + URL handling
├── step3_launcher/      # Application launcher
├── step4_startup/       # Startup window
├── step5_main_ui/       # Main window framework
│   └── pyside6/
│       ├── main_window.py    # Frameless window
│       ├── title_bar.py      # Custom title bar
│       ├── webview.py        # QWebEngineView wrapper
│       └── system_tray.py    # System tray
├── step6_tray/          # Standalone tray (tkinter)
├── step7_managers/      # Lifecycle managers
└── step8_utils/         # Utilities
```

**Key Components**:

1. **PySide6MainWindow** (main_window.py):
   - Frameless window (`Qt.FramelessWindowHint`)
   - Custom resize handles
   - Window state caching
   - Event-driven architecture (THREAD_BUS)

2. **PySide6TitleBar** (title_bar.py):
   - Custom title bar widget
   - Min/Max/Close buttons
   - Window dragging
   - Theming system

3. **PySide6WebView** (webview.py):
   - QWebEngineView wrapper
   - Loading animations (14 styles)
   - JavaScript execution
   - Navigation controls

4. **Launch System** (launch_native_app.py):
   - Singleton detection
   - Auto port allocation
   - Callback management
   - Lifecycle hooks

**Strengths**:
- ✅ Beautiful frameless window implementation
- ✅ Rich custom title bar with theming
- ✅ Built-in loading animations
- ✅ Comprehensive launcher framework
- ✅ Singleton detection
- ✅ Event-driven architecture

**Gaps**:
- ❌ Python-only (no Node.js integration)
- ❌ No tray-only mode (always creates window)
- ❌ Requires PySide6 (heavy dependency)

---

## 2. Comparison Matrix

| Feature | ncore/utils/electron | pycore/pyutils/native_ui |
|---------|---------------------|-------------------------|
| **Language** | JavaScript (Node.js) | Python |
| **UI Framework** | Electron (Chromium) | PySide6 (Qt) |
| **Tray-only mode** | ✅ Supported | ❌ Not supported |
| **Frameless window** | ✅ Supported | ✅ Supported |
| **Custom title bar** | ❌ No implementation | ✅ Full implementation |
| **Web loading** | ✅ loadURL/File/HTML | ✅ QWebEngineView |
| **Loading animations** | ❌ Manual HTML | ✅ 14 built-in styles |
| **Singleton detection** | ❌ Not implemented | ✅ Implemented |
| **Service monitoring** | ✅ WebSocket/HTTP | ❌ Not implemented |
| **Configuration** | Flexible object | NativeUIConfig class |
| **Size (installed)** | ~200MB (Electron) | ~100MB (PySide6) |

---

## 3. Extension Requirements

User wants to extend `ncore/utils/electron` with:

1. **Parameter-based launch modes**:
   ```javascript
   // Tray only
   electron.launch({ mode: "tray" })

   // Window only (no tray)
   electron.launch({ mode: "window" })

   // Both (default)
   electron.launch({ mode: "both" })
   ```

2. **Frameless window with custom title bar** (like pycore/pyutils/native_ui):
   - No native OS title bar
   - Custom drag region
   - Custom min/max/close buttons
   - Modern styling

3. **Web content loading**:
   - Load URL (like http://localhost:59000)
   - Built-in loading animation
   - Error handling

---

## 4. Design Proposal

### 4.1 Enhanced Configuration

```javascript
// ncore/utils/electron/config_schema.js
{
  // Launch mode (NEW)
  launch_mode: "tray" | "window" | "both",  // Simple mode selector

  // OR detailed mode config (EXISTING)
  mode: {
    trayOnly: boolean,
    windowOnly: boolean,  // NEW
    hideOnClose: boolean,
    minimizeToTray: boolean
  },

  // Window config with custom title bar support
  window: {
    enabled: boolean,
    showOnStart: boolean,

    // Title bar configuration (NEW)
    titleBar: {
      enabled: boolean,           // Use custom title bar
      height: 40,
      style: "modern" | "classic" | "minimal",
      showAppName: boolean,
      showLogo: boolean,
      buttons: {
        minimize: boolean,
        maximize: boolean,
        close: boolean
      },
      customStyles: {
        backgroundColor: "#2c3e50",
        textColor: "#ecf0f1",
        buttonHoverColor: "#34495e"
      }
    },

    // Frame configuration
    frame: boolean,              // false = frameless
    transparent: boolean,

    // Content
    content: {
      type: "url" | "file" | "html",
      source: string,
      loadingAnimation: {
        enabled: boolean,
        style: 1-14,             // Match pycore styles
        text: "Loading...",
        backgroundColor: "#1e1e1e"
      }
    }
  }
}
```

### 4.2 New Files Structure

```
ncore/utils/electron/
├── index.js              # Main ElectronManager (existing)
├── preload.js            # Context bridge (existing)
├── config_schema.js      # Configuration schema (NEW)
├── components/           # (NEW)
│   ├── custom_title_bar.js    # Custom title bar renderer
│   ├── loading_animations.js  # Loading animation templates
│   └── tray_manager.js        # Separated tray logic
├── templates/            # (NEW)
│   ├── title_bar.html         # Title bar HTML template
│   └── loading/               # Loading animation HTMLs
│       ├── style1.html
│       ├── style2.html
│       └── ...
└── utils/                # (NEW)
    ├── mode_resolver.js       # Resolve launch mode
    └── window_factory.js      # Create windows with config
```

### 4.3 Implementation Plan

**Phase 1: Mode Resolver** (1-2 hours)
```javascript
// utils/mode_resolver.js
function resolveLaunchMode(config) {
  // Priority: launch_mode > mode.trayOnly/windowOnly > defaults
  if (config.launch_mode) {
    return {
      enableTray: ["tray", "both"].includes(config.launch_mode),
      enableWindow: ["window", "both"].includes(config.launch_mode)
    };
  }

  if (config.mode?.trayOnly) {
    return { enableTray: true, enableWindow: false };
  }

  if (config.mode?.windowOnly) {
    return { enableTray: false, enableWindow: true };
  }

  // Default: both
  return { enableTray: true, enableWindow: true };
}
```

**Phase 2: Custom Title Bar** (4-6 hours)
```javascript
// components/custom_title_bar.js
class CustomTitleBar {
  constructor(window, config) {
    this.window = window;
    this.config = config;
    this.height = config.height || 40;
  }

  injectTitleBar() {
    // Inject HTML + CSS + JS into renderer process
    const titleBarHTML = this.generateHTML();
    const titleBarCSS = this.generateCSS();
    const titleBarJS = this.generateJS();

    this.window.webContents.executeJavaScript(`
      // Create title bar container
      const titleBar = document.createElement('div');
      titleBar.id = 'custom-title-bar';
      titleBar.innerHTML = \`${titleBarHTML}\`;

      // Inject styles
      const style = document.createElement('style');
      style.textContent = \`${titleBarCSS}\`;
      document.head.appendChild(style);

      // Prepend to body
      document.body.insertBefore(titleBar, document.body.firstChild);

      // Add event listeners
      ${titleBarJS}
    `);
  }

  generateHTML() {
    const { showAppName, showLogo, buttons } = this.config;
    return `
      <div class="title-bar-drag-region">
        ${showLogo ? '<img class="title-bar-logo" src="icon.png">' : ''}
        ${showAppName ? '<span class="title-bar-title">App Name</span>' : ''}
      </div>
      <div class="title-bar-buttons">
        ${buttons.minimize ? '<button class="title-bar-btn minimize">−</button>' : ''}
        ${buttons.maximize ? '<button class="title-bar-btn maximize">□</button>' : ''}
        ${buttons.close ? '<button class="title-bar-btn close">×</button>' : ''}
      </div>
    `;
  }

  generateCSS() {
    // Generate styles based on config.customStyles
  }

  generateJS() {
    return `
      // Minimize
      document.querySelector('.minimize')?.addEventListener('click', () => {
        window.electronAPI.minimizeWindow();
      });

      // Maximize
      document.querySelector('.maximize')?.addEventListener('click', () => {
        window.electronAPI.maximizeWindow();
      });

      // Close
      document.querySelector('.close')?.addEventListener('click', () => {
        window.electronAPI.closeWindow();
      });

      // Drag
      const dragRegion = document.querySelector('.title-bar-drag-region');
      dragRegion.style.webkitAppRegion = 'drag';
    `;
  }
}
```

**Phase 3: Loading Animations** (2-3 hours)
```javascript
// components/loading_animations.js
class LoadingAnimations {
  static getAnimation(style = 1) {
    // Return HTML for loading animation (styles 1-14)
    // Port from pycore/pyutils/native_ui/resource/loadin*.html
  }

  static show(window, style, text, backgroundColor) {
    const html = this.getAnimation(style);
    window.loadURL(`data:text/html,${encodeURIComponent(html)}`);
  }
}
```

**Phase 4: Integration** (2-3 hours)
- Update `index.js` to use new components
- Add IPC handlers for window controls
- Update `preload.js` with new APIs

---

## 5. Usage Examples

### Example 1: Tray Only
```javascript
const { getInstance } = require('./electron');
const manager = getInstance();

await manager.initialize({
  launch_mode: "tray",  // Only tray, no window
  tray: {
    enabled: true,
    icon: "./icon.png",
    contextMenu: {
      items: {
        openFrontend: true,
        quit: true
      }
    }
  }
});
```

### Example 2: Frameless Window with Custom Title Bar
```javascript
await manager.initialize({
  launch_mode: "window",
  window: {
    enabled: true,
    showOnStart: true,
    frame: false,  // Frameless
    titleBar: {
      enabled: true,
      height: 40,
      style: "modern",
      showAppName: true,
      customStyles: {
        backgroundColor: "#2c3e50",
        textColor: "#ecf0f1"
      }
    },
    content: {
      type: "url",
      source: "http://localhost:59000",
      loadingAnimation: {
        enabled: true,
        style: 3,
        text: "Loading application..."
      }
    }
  }
});
```

### Example 3: Both Tray + Window
```javascript
await manager.initialize({
  launch_mode: "both",  // Default
  window: {
    showOnStart: false,  // Start minimized to tray
    frame: false,
    titleBar: { enabled: true, style: "minimal" },
    content: { type: "url", source: "http://localhost:59000" }
  },
  tray: {
    enabled: true,
    doubleClickAction: "openWindow"
  }
});
```

---

## 6. Migration from pycore/pyutils/native_ui

**Title Bar Styles**:
Port from `pycore/pyutils/native_ui/step5_main_ui/pyside6/title_bar_styles.py`:
- Default style (dark)
- Light style
- Minimal style

**Loading Animations**:
Port HTML templates from `pycore/pyutils/native_ui/resource/loadin*.html` (14 styles)

**Window State Caching**:
Optional enhancement - save/restore window position/size

---

## 7. Estimated Effort

| Task | Complexity | Time |
|------|-----------|------|
| Mode resolver | Low | 1-2h |
| Custom title bar HTML/CSS | Medium | 3-4h |
| Custom title bar JS integration | Medium | 2-3h |
| Loading animations (port 14 styles) | Low | 2-3h |
| IPC handlers for window controls | Low | 1h |
| Integration + testing | Medium | 2-3h |
| Documentation | Low | 1h |
| **Total** | | **12-17h** |

---

## 8. Compatibility Matrix

| Platform | Frameless | Custom Title Bar | Tray | Notes |
|----------|-----------|-----------------|------|-------|
| Windows | ✅ | ✅ | ✅ | Full support |
| macOS | ✅ | ⚠️ Need native controls | ✅ | macOS prefers native |
| Linux | ✅ | ✅ | ✅ | Depends on DE |

---

## 9. Recommendations

1. **Start with simple mode resolver** - Quick win, enables tray-only/window-only
2. **Port loading animations** - Copy HTML from pycore, easy integration
3. **Custom title bar** - Most complex, but adds value
4. **Test on multiple platforms** - Ensure cross-platform compatibility
5. **Keep backward compatibility** - Existing configs should still work

---

## 10. Alternative: Python Bridge

Instead of rebuilding in JavaScript, consider:

**Option A: Electron + Python Bridge**
```javascript
// Launch Python PySide6 UI from Electron
const { spawn } = require('child_process');
const python = spawn('python', ['-m', 'pycore.pyutils.native_ui', ...]);
```

**Option B: Use Existing Python Launcher**
```bash
# Direct Python usage
python -m pycore.callmodule --tray  # Tray only
python -m pycore.callmodule --window  # Window only
```

**Pros**: Reuse existing Python implementation
**Cons**: Requires Python runtime, harder to package

---

## Conclusion

The Electron implementation already has **80% of required features**. Main additions needed:

1. ✅ **Mode resolver** (simple parameter → tray/window/both)
2. ✅ **Custom title bar component** (port from pycore design)
3. ✅ **Loading animations** (port 14 HTML templates)

Estimated **12-17 hours** for full implementation.
