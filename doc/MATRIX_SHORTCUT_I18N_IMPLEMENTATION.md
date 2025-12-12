# Matrix Desktop Shortcut i18n Implementation

## 📋 Overview

Implemented internationalization (i18n) support for Matrix Cloud desktop shortcut. The shortcut name and description are now automatically localized based on system language settings.

**Implementation Date**: 2025-12-12
**Status**: ✅ Complete

---

## 🎯 Features

### Localized Shortcut Names

| Language | Shortcut Name | Description |
|----------|--------------|-------------|
| **English** (en) | Matrix Cloud | Launch Matrix Cloud - Android Device Manager |
| **Chinese** (zh) | 星灿传媒云矩阵 | 启动星灿传媒云矩阵 - 安卓设备管理器 |

### Automatic Language Detection

- System language is automatically detected by i18n manager
- Shortcut name and description are localized accordingly
- Falls back to English if translation not available

---

## 🔧 Implementation Details

### 1. Extended Translation Files

#### `pyapps/matrix/matrix_i18n/translations_en.json`

Added keys:
```json
{
  "matrix.shortcut.name": "Matrix Cloud",
  "matrix.shortcut.description": "Launch Matrix Cloud - Android Device Manager"
}
```

#### `pyapps/matrix/matrix_i18n/translations_zh.json`

Added keys:
```json
{
  "matrix.shortcut.name": "星灿传媒云矩阵",
  "matrix.shortcut.description": "启动星灿传媒云矩阵 - 安卓设备管理器"
}
```

---

### 2. Enhanced ShortcutManager Class

**File**: `pycore/pyutils/shortcut_manager.py`

#### Added i18n Support

```python
class ShortcutManager:
    def __init__(self, i18n_manager=None):
        """
        Initialize shortcut manager with optional i18n support

        Args:
            i18n_manager: Optional I18nManager instance for localized names
                         Auto-imports from pycore.pyutils.native_ui if not provided
        """
        self.icon_generator = DesktopIconGenerator()
        self.i18n = i18n_manager

        # Try to import i18n if not provided
        if self.i18n is None:
            try:
                from pycore.pyutils.native_ui.step0_i18n import i18n
                self.i18n = i18n
            except ImportError:
                pass  # i18n not available, will use provided names directly
```

#### New Parameters

Added to `create_shortcut()` and `ensure_shortcut()`:

- **`i18n_name_key`**: i18n key for shortcut name (e.g., "matrix.shortcut.name")
- **`i18n_description_key`**: i18n key for description (e.g., "matrix.shortcut.description")

#### Localization Logic

```python
def create_shortcut(self, name, ..., i18n_name_key=None, i18n_description_key=None):
    # Resolve localized name
    final_name = name  # Fallback
    if i18n_name_key and self.i18n:
        localized_name = self.i18n.get(i18n_name_key)
        if localized_name and localized_name != i18n_name_key:
            final_name = localized_name
            print(f"Using localized shortcut name: {final_name} (lang: {self.i18n.get_current_language()})")

    # Resolve localized description
    final_description = description  # Fallback
    if i18n_description_key and self.i18n:
        localized_desc = self.i18n.get(i18n_description_key)
        if localized_desc and localized_desc != i18n_description_key:
            final_description = localized_desc

    # Create shortcut with localized name and description
    ...
```

---

### 3. Updated Matrix Application

**File**: `pyapps/matrix/matrix_main.py`

#### Extended i18n Before Shortcut Creation

```python
def start():
    """Unified startup entry point"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" MATRIX APPLICATION - RPC v2 WebSocket Edition")
    ColorPrint.blue("=" * 70)

    # Extend i18n with Matrix app translations BEFORE creating shortcut
    # This ensures the shortcut name is localized based on system language
    ColorPrint.blue("[Matrix] Extending i18n for shortcut localization...")
    app_dir = Path(__file__).parent
    i18n.extend_translations(app_dir=str(app_dir), app_name="matrix")
    current_lang = i18n.get_current_language()
    ColorPrint.green(f"[Matrix] i18n extended successfully (current language: {current_lang})")

    # Ensure desktop shortcut exists (now with localized name)
    ensure_desktop_shortcut()

    # ... rest of startup logic
```

#### Updated ensure_desktop_shortcut()

```python
def ensure_desktop_shortcut():
    """
    Ensure Matrix desktop shortcut exists with localized name

    Shortcut name is automatically localized based on system language:
    - English (en): "Matrix Cloud"
    - Chinese (zh): "星灿传媒云矩阵"
    """
    try:
        ColorPrint.blue("[Matrix] Checking desktop shortcut...")
        manager = ShortcutManager()

        # Get paths
        app_dir = Path(__file__).parent
        resources_dir = app_dir / "resources"

        # Create/update shortcut with i18n support
        manager.ensure_shortcut(
            name="Matrix Cloud",  # Fallback name
            command=f'python "{PROJECT_ROOT / "pymain.py"}" app=matrix',
            icon_search_dir=resources_dir,
            working_dir=PROJECT_ROOT,
            description="Launch Matrix Cloud - Android Device Manager",  # Fallback
            i18n_name_key="matrix.shortcut.name",  # Localized name key
            i18n_description_key="matrix.shortcut.description"  # Localized description key
        )
        ColorPrint.green("[Matrix] ✓ Desktop shortcut ready")
    except Exception as e:
        ColorPrint.yellow(f"[Matrix] Warning: Could not create desktop shortcut: {e}")
```

---

## 🔄 Call Chain

### Shortcut Creation Flow

```
1. python pymain.py app=matrix
   ↓
2. matrix_main.start()
   ↓
3. i18n.extend_translations(app_name="matrix")
   ├─ Detect system language (en/zh/...)
   ├─ Load translations_en.json or translations_zh.json
   └─ Set current language
   ↓
4. ensure_desktop_shortcut()
   ↓
5. ShortcutManager()
   ├─ Auto-import i18n from pycore.pyutils.native_ui
   └─ Store i18n reference
   ↓
6. manager.ensure_shortcut(
       name="Matrix Cloud",  # Fallback
       i18n_name_key="matrix.shortcut.name",  # Localized key
       i18n_description_key="matrix.shortcut.description"
   )
   ↓
7. ShortcutManager.create_shortcut()
   ├─ Get localized name: i18n.get("matrix.shortcut.name")
   │   → Returns: "Matrix Cloud" (en) or "星灿传媒云矩阵" (zh)
   ├─ Get localized description: i18n.get("matrix.shortcut.description")
   │   → Returns localized description
   ├─ Create BAT file: matrix_cloud.bat (using original name)
   └─ Create Windows shortcut with localized name
   ↓
8. Desktop shortcut created:
   English system: "Matrix Cloud.lnk"
   Chinese system: "星灿传媒云矩阵.lnk"
```

---

## 📊 Key Design Decisions

### 1. BAT File Naming

**Decision**: BAT file uses **original English name** (not localized)

**Reason**:
- BAT files are internal implementation details
- Stored in system directory: `D:\.dev_win11\.winenvs\`
- User doesn't interact with BAT files directly
- Avoids file system encoding issues with Chinese characters

**Example**:
```
BAT file:     D:\.dev_win11\.winenvs\matrix_cloud.bat  (always English)
Shortcut:     桌面\星灿传媒云矩阵.lnk  (localized for Chinese system)
```

### 2. Icon Search

**Decision**: Icon search uses **original English name**

**Reason**:
- Icon files are stored in resources directory with English names
- Example: `resources/icon.ico`, `resources/matrix.ico`
- No need to localize resource file names

### 3. Fallback Strategy

**Decision**: Always provide fallback English names

**Reason**:
- If i18n is unavailable, shortcut still works
- If translation key is missing, uses provided name
- Ensures reliability in all scenarios

### 4. i18n Extension Timing

**Decision**: Extend i18n **BEFORE** creating shortcut in `start()` function

**Reason**:
- Shortcut is created early in application startup
- i18n must be initialized before ShortcutManager uses it
- `matrix_main_entry()` is called later (after native_ui initialization)

---

## 🧪 Testing

### Test Scenario 1: English System

**Expected Output**:
```
[Matrix] Extending i18n for shortcut localization...
[Matrix] i18n extended successfully (current language: en)
[Matrix] Checking desktop shortcut...
Using localized shortcut name: Matrix Cloud (lang: en)
Using localized description: Launch Matrix Cloud - Android Device Manager
Created BAT file: D:\.dev_win11\.winenvs\matrix_cloud.bat
Created/updated desktop shortcut: Matrix Cloud
[Matrix] ✓ Desktop shortcut ready
```

**Desktop Shortcut**: `Matrix Cloud.lnk`

### Test Scenario 2: Chinese System

**Expected Output**:
```
[Matrix] Extending i18n for shortcut localization...
[Matrix] i18n extended successfully (current language: zh)
[Matrix] Checking desktop shortcut...
Using localized shortcut name: 星灿传媒云矩阵 (lang: zh)
Using localized description: 启动星灿传媒云矩阵 - 安卓设备管理器
Created BAT file: D:\.dev_win11\.winenvs\matrix_cloud.bat
Created/updated desktop shortcut: 星灿传媒云矩阵
[Matrix] ✓ Desktop shortcut ready
```

**Desktop Shortcut**: `星灿传媒云矩阵.lnk`

### Test Scenario 3: i18n Unavailable

**Expected Output**:
```
[Matrix] Checking desktop shortcut...
Created BAT file: D:\.dev_win11\.winenvs\matrix_cloud.bat
Created/updated desktop shortcut: Matrix Cloud
[Matrix] ✓ Desktop shortcut ready
```

**Desktop Shortcut**: `Matrix Cloud.lnk` (fallback)

---

## 📝 Files Modified

### 1. Translation Files

- ✅ `pyapps/matrix/matrix_i18n/translations_en.json` - Added shortcut translations
- ✅ `pyapps/matrix/matrix_i18n/translations_zh.json` - Added shortcut translations

### 2. Core Library

- ✅ `pycore/pyutils/shortcut_manager.py` - Extended with i18n support
  - Added `i18n_manager` parameter to `__init__()`
  - Added `i18n_name_key` and `i18n_description_key` parameters
  - Implemented localization logic

### 3. Matrix Application

- ✅ `pyapps/matrix/matrix_main.py` - Updated shortcut creation flow
  - Moved i18n extension before shortcut creation
  - Updated `ensure_desktop_shortcut()` with i18n keys
  - Removed duplicate i18n extension in `matrix_main_entry()`

---

## 🚀 Future Enhancements

### 1. Additional Languages

To add more languages (e.g., Japanese, Korean):

1. Add translation file: `pyapps/matrix/matrix_i18n/translations_ja.json`
   ```json
   {
     "matrix.shortcut.name": "マトリックスクラウド",
     "matrix.shortcut.description": "マトリックスクラウドを起動 - Androidデバイスマネージャー"
   }
   ```

2. Update base i18n config: `pyapps/matrix/matrix_i18n/i18n_base.json`
   ```json
   {
     "default_language": "en",
     "supported_languages": ["en", "zh", "ja"]
   }
   ```

### 2. Dynamic Shortcut Update

Currently, shortcut is created once at startup. Future enhancement:

- Monitor language change events
- Recreate shortcut when user changes language
- Implement listener for `I18N_SET_LANGUAGE` event

Example:
```python
def on_language_change(event_data):
    """Recreate shortcut when language changes"""
    ensure_desktop_shortcut()

THREAD_BUS.register_event_handler(BusSignals.I18N_SET_LANGUAGE, on_language_change)
```

### 3. Shortcut Manager CLI

Add CLI tool for managing shortcuts:

```bash
# Create shortcut with current system language
python -m pycore.pyutils.shortcut_manager create matrix

# Create shortcut with specific language
python -m pycore.pyutils.shortcut_manager create matrix --lang zh

# Update all shortcuts
python -m pycore.pyutils.shortcut_manager update --all
```

---

## ✅ Benefits

1. **User-Friendly**: Desktop shortcut name matches system language
2. **Professional**: Proper localization for different markets
3. **Extensible**: Easy to add more languages
4. **Robust**: Fallback to English if translation unavailable
5. **Reusable**: ShortcutManager i18n support available for other apps

---

## 📚 Related Documentation

- `PYTHON_PYCORE.md` - Python development guide
- `MATRIX_STARTUP_FLOW.md` - Matrix startup flow documentation
- `pycore/pyutils/native_ui/step0_i18n/README.md` - i18n system documentation
- `pycore/pyutils/SHORTCUT_MANAGER_README.md` - ShortcutManager documentation

---

**Document Version**: v1.0
**Last Updated**: 2025-12-12
**Author**: Claude Code
**Status**: ✅ Implementation Complete
