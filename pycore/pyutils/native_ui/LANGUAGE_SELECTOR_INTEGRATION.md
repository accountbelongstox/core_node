# Language Selector Integration - Completion Report

**Date**: 2025-11-10
**Status**: ✅ Completed

---

## Overview

Integrated multi-language selector with radio buttons into the startup window, following the user's requirement:
- **Default first option**: "Follow System" (跟随系统)
- **Language changes take effect immediately** (redraw window)
- **Extensible design** based on i18n language packs

---

## Files Modified

### 1. `startup_window.py`
**Changes**:
- Added `enable_language_selector` parameter (default: `True`)
- Added `i18n_manager` parameter for i18n integration
- Created `_create_language_selector()` method with radio buttons
- Implemented `_on_language_change()` for immediate language switching
- Language selector UI positioned between log display and status bar

**Key Features**:
```python
# Radio button options (dynamically generated)
1. 🌐 Follow System / 跟随系统 / システムに従う (default)
2. 🇬🇧 English
3. 🇨🇳 简体中文
4. 🇯🇵 日本語

# Immediate effect on language change
- Window title updates immediately
- Logs language change event
- Uses i18n keys: "language.name.{lang}"
```

### 2. `launcher_with_startup.py`
**Changes**:
- Added `enable_language_selector` parameter
- Added `i18n_manager` parameter
- Updated docstring with new parameters
- Passes parameters to `StartupWindow` constructor

### 3. `matrix_main.py`
**Changes**:
- Initializes `I18nManager` before calling `launch_app_with_startup()`
- Checks for Matrix-specific i18n directory (`pyapps/matrix/i18n`)
- Falls back to native_ui i18n if Matrix i18n not found
- Passes `i18n_manager` to launcher
- Enables language selector by default

**Initialization Flow**:
```python
# 1. Initialize i18n
i18n_manager = I18nManager()
i18n_manager.initialize(config_dir=str(matrix_i18n_dir), use_system_language=True)

# 2. Pass to launcher
launch_app_with_startup(
    app_name="星灿传媒科技-云矩阵",
    i18n_manager=i18n_manager,
    enable_language_selector=True
)
```

---

## i18n Directory Structure

### Matrix Application i18n
```
pyapps/matrix/i18n/
├── i18n_base.json             # Base config (default: zh, supported: en/zh/ja)
├── translations_en.json        # English translations
├── translations_zh.json        # Chinese translations
└── translations_ja.json        # Japanese translations
```

### Native UI i18n (Fallback)
```
pycore/pyutils/native_ui/i18n/translations/
├── i18n_base.json             # Base config
├── translations_en.json        # English translations
├── translations_zh.json        # Chinese translations
└── translations_ja.json        # Japanese translations
```

---

## Language Selector Behavior

### Radio Button Flow
1. **"Follow System" (auto)**:
   - Detects system language using `locale.getdefaultlocale()`
   - Applies if supported, otherwise falls back to default

2. **Direct Language Selection**:
   - Immediately calls `i18n_manager.set_language(lang)`
   - Updates window title from i18n keys
   - Logs language change event

### UI Update Flow
```
User clicks radio button
    ↓
_on_language_change() triggered
    ↓
i18n_manager.set_language(selected_lang)
    ↓
Window title updated: i18n.get("window.title.initializing")
    ↓
Log message: "Language changed to: {language_name}"
```

---

## Testing

### Syntax Validation
```bash
✓ startup_window.py syntax OK
✓ launcher_with_startup.py syntax OK
✓ matrix_main.py syntax OK
```

### Test Command
```bash
python pymain.py app=matrix
```

**Expected Behavior**:
1. Startup window appears with Matrix logo
2. Language selector displayed with radio buttons
3. Default: "🌐 Follow System" selected
4. System language auto-detected and applied
5. Clicking any language radio button → immediate title change
6. Dependencies checked/installed with progress display
7. Startup window closes → PySide6 main UI launches

---

## Key Implementation Details

### 1. Radio Button UI (startup_window.py:_create_language_selector)
```python
# Dynamic language options from i18n
for lang in self.i18n_manager.get_supported_languages():
    flag = lang_flags.get(lang, "🌐")
    display_name = self.i18n_manager.get(f"language.name.{lang}", default=lang.upper())
    text = f"{flag} {display_name}"

    radio = tk.Radiobutton(
        radio_container,
        text=text,
        variable=self.language_var,
        value=lang,
        command=self._on_language_change
    )
```

### 2. Immediate Language Change (startup_window.py:_on_language_change)
```python
def _on_language_change(self):
    selected = self.language_var.get()

    if selected == "auto":
        # Follow system language
        system_lang = self.i18n_manager._detect_system_language()
        if system_lang in supported:
            self.i18n_manager.set_language(system_lang)
    else:
        # Direct language selection
        self.i18n_manager.set_language(selected)

    # Update window title immediately
    new_app_name = self.i18n_manager.get("app.name", default=self.app_name)
    title_text = self.i18n_manager.get("window.title.initializing",
                                      default=f"{new_app_name} - Initializing...")
    self.root.title(title_text)

    # Log the change
    current_lang = self.i18n_manager.get_current_language()
    lang_name = self.i18n_manager.get(f"language.name.{current_lang}")
    self.log(f"Language changed to: {lang_name}", level="info")
```

### 3. i18n Initialization (matrix_main.py:start)
```python
# Initialize i18n manager for Matrix application
from pycore.pyutils.native_ui.i18n import I18nManager
i18n_manager = I18nManager()

# Try Matrix i18n first
matrix_i18n_dir = PROJECT_ROOT / "pyapps" / "matrix" / "i18n"
if matrix_i18n_dir.exists():
    i18n_manager.initialize(
        config_dir=str(matrix_i18n_dir),
        use_system_language=True  # Auto-detect system language
    )
else:
    # Fallback to native_ui i18n
    native_ui_i18n_dir = PROJECT_ROOT / "pycore" / "pyutils" / "native_ui" / "i18n" / "translations"
    i18n_manager.initialize(config_dir=str(native_ui_i18n_dir), use_system_language=True)
```

---

## i18n Keys Used

### Startup Window
- `window.title.initializing`: Window title during initialization
- `language.select`: Language selector label
- `language.name.en`: English language name
- `language.name.zh`: Chinese language name
- `language.name.ja`: Japanese language name

### Matrix Application (Optional)
- `app.name`: Application name (e.g., "星灿传媒科技-云矩阵")
- `app.short_name`: Short name (e.g., "云矩阵")

---

## Architecture Benefits

1. **Zero External Dependencies**: Startup window uses Python native tkinter
2. **Extensible**: Add new languages by creating `translations_{lang}.json`
3. **Immediate Feedback**: Language changes apply instantly
4. **System Integration**: Auto-detects system language
5. **Fallback Support**: Multiple i18n directories for flexibility
6. **Singleton Pattern**: I18nManager shared across entire application

---

## Next Steps (Optional Enhancements)

1. **PySide6 Title Bar Language Dropdown**: Add language selector in main UI title bar
2. **Persistent Language Preference**: Save user's language choice to config file
3. **More Language Packs**: Add support for more languages (fr, de, es, etc.)
4. **Language Change Listeners**: Notify PySide6 UI components when language changes

---

**Status**: ✅ Ready for testing
**Command**: `python pymain.py app=matrix`
