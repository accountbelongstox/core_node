# XingCan Cloud Matrix (星灿传媒云矩阵)

## Upgrade Summary - 2025-12-19

### Major Updates

**Project**: TcUi → XingCan Cloud Matrix (星灿传媒云矩阵)
**Status**: ✅ Complete

---

## What's New

### 1. scrcpy-server Upgrade: 1.17 → 3.3.3

**Released**: September 27, 2024

#### Key Improvements:
- ✅ **Android 16 Support** - Full compatibility with Android 16 beta
- ✅ **Memory Leak Fixed** - Resolved frame memory leaks on Windows
- ✅ **Virtual Display Enhanced** - Improved virtual display presentation
- ✅ **Better Stability** - Multiple bug fixes and improvements

#### How to Download:

**Windows:**
```cmd
cd scripts
download-scrcpy-server.bat
```

**Linux/macOS:**
```bash
cd scripts
./download-scrcpy-server.sh
```

**Manual Download:**
```
URL: https://github.com/Genymobile/scrcpy/releases/download/v3.3.3/scrcpy-server-v3.3.3
Target: TcUi/third_party/scrcpy-server/scrcpy-server-v3.3.3
```

---

### 2. Application Name: Multi-Language Support

The application now automatically detects and adapts to system language:

#### Chinese System (中文系统):
- Window Title: **星灿传媒云矩阵**
- App Name: **星灿传媒云矩阵**

#### English/Other Systems:
- Window Title: **XingCan Cloud Matrix**
- App Name: **XingCan Cloud Matrix**

---

### 3. Multi-Language Support (i18n)

#### Features:
- ✅ **Auto-Detection** - Automatically detects system language
- ✅ **Runtime Switching** - Switch language without restart
- ✅ **UI Translation** - Full UI translation support
- ✅ **Easy Selection** - Language switcher in top-right corner

#### Supported Languages:
1. **简体中文** (Simplified Chinese)
2. **English** (English)

#### How to Switch Language:

1. **Using UI**:
   - Look for the language dropdown in the top-right corner
   - Select "简体中文" or "English"
   - UI updates immediately

2. **System Auto-Detection**:
   - Application automatically detects system language on startup
   - Chinese systems → Chinese interface
   - English/Other systems → English interface

---

## Technical Details

### Language Manager Implementation

#### New Files Created:
1. **`util/languagemanager.h`** - Language manager header
2. **`util/languagemanager.cpp`** - Language manager implementation
3. **`translations/XingCanMatrix_zh_CN.ts`** - Chinese translation
4. **`translations/XingCanMatrix_en.ts`** - English translation

#### Architecture:
```cpp
LanguageManager (Singleton)
├── Auto-detect system language
├── Load translation files (.qm)
├── Install/Remove translators
├── Emit language change signals
└── Update all UI elements
```

#### Translation Workflow:
```
Source Code (.cpp/.ui)
    ↓
lupdate (extract strings)
    ↓
Translation Files (.ts)
    ↓
Linguist (translate)
    ↓
lrelease (compile)
    ↓
Compiled Translations (.qm)
    ↓
Runtime Loading
```

---

## Building with Translations

### Step 1: Update Translations

```bash
# Extract translatable strings
lupdate 17_TcUi.pro

# This updates:
# - translations/XingCanMatrix_zh_CN.ts
# - translations/XingCanMatrix_en.ts
```

### Step 2: Translate (Optional)

```bash
# Open Qt Linguist
linguist translations/XingCanMatrix_zh_CN.ts
```

### Step 3: Compile Translations

```bash
# Compile .ts to .qm files
lrelease 17_TcUi.pro

# Generates:
# - translations/XingCanMatrix_zh_CN.qm
# - translations/XingCanMatrix_en.qm
```

### Step 4: Build Application

```cmd
# Windows
cd scripts
build-windows.bat release

# Linux
cd scripts
./build-linux.sh release

# macOS
cd scripts
./build-macos.sh release
```

---

## File Structure

```
qtscrcpy_tc/
├── TcUi/
│   ├── translations/          # NEW: Translation files
│   │   ├── XingCanMatrix_zh_CN.ts  # Chinese source
│   │   ├── XingCanMatrix_en.ts     # English source
│   │   ├── XingCanMatrix_zh_CN.qm  # Chinese compiled (auto-generated)
│   │   └── XingCanMatrix_en.qm     # English compiled (auto-generated)
│   ├── util/
│   │   ├── languagemanager.h       # NEW: Language manager
│   │   └── languagemanager.cpp     # NEW: Implementation
│   ├── third_party/
│   │   └── scrcpy-server/
│   │       ├── scrcpy-server-v3.3.3  # NEW: Updated server
│   │       └── version.json           # NEW: Version info
│   └── 17_TcUi.pro            # Updated with translations
├── scripts/
│   ├── download-scrcpy-server.bat    # NEW: Download script (Windows)
│   ├── download-scrcpy-server.sh     # NEW: Download script (Linux/Mac)
│   ├── build-windows.bat
│   ├── deploy-windows.bat
│   ├── build-linux.sh
│   └── build-macos.sh
└── UPGRADE_AND_I18N.md        # This file
```

---

## Usage Examples

### Programmatic Language Switching

```cpp
#include "languagemanager.h"

// Switch to Chinese
LanguageManager::instance().switchLanguage(LanguageManager::Chinese);

// Switch to English
LanguageManager::instance().switchLanguage(LanguageManager::English);

// Get current language
LanguageManager::Language current = LanguageManager::instance().currentLanguage();

// Detect system language
LanguageManager::Language sysLang = LanguageManager::instance().detectSystemLanguage();
```

### Adding New Translatable Strings

**In C++ code:**
```cpp
// Use tr() for translatable strings
QString message = tr("Hello, World!");
ui->label->setText(tr("Device Name"));
```

**In UI files:**
```xml
<string>Translatable Text</string>
```

**Then run:**
```bash
lupdate 17_TcUi.pro  # Extract new strings
# Edit .ts files in Qt Linguist
lrelease 17_TcUi.pro  # Compile translations
```

---

## Configuration

### Language Files Location

The application looks for translation files in:
```
<app_directory>/translations/
```

### Supported Formats
- **Source**: `.ts` (XML-based, human-readable)
- **Compiled**: `.qm` (binary, runtime-loadable)

### Translation File Naming Convention
```
<AppName>_<language>_<country>.ts

Examples:
- XingCanMatrix_zh_CN.ts  (Chinese, China)
- XingCanMatrix_en.ts     (English)
- XingCanMatrix_ja_JP.ts  (Japanese, Japan)
```

---

## Testing

### Test Language Switching

1. **Launch application**
2. **Check auto-detection**:
   - Chinese system → Should show "星灿传媒云矩阵"
   - English system → Should show "XingCan Cloud Matrix"
3. **Test manual switching**:
   - Click language dropdown (top-right)
   - Select different language
   - Verify UI updates immediately
4. **Test persistence** (if implemented):
   - Switch language
   - Restart application
   - Language should persist

### Test Translation Coverage

```bash
# Check for untranslated strings
linguist translations/XingCanMatrix_zh_CN.ts

# Look for:
# - Unfinished translations (yellow)
# - Obsolete translations (gray)
# - Missing translations (red)
```

---

## Troubleshooting

### Language Not Switching

**Symptoms**: UI doesn't update when switching language

**Solutions**:
1. Verify `.qm` files exist in `translations/` directory
2. Check file permissions
3. Run `lrelease` to compile translations
4. Restart application

### Chinese Characters Not Displaying

**Symptoms**: Shows boxes or question marks

**Solutions**:
1. Ensure source file encoding is UTF-8
2. Use `QString::fromUtf8()` for Chinese strings
3. Verify system fonts support Chinese
4. Check Qt codecs are installed

### Translation Files Not Found

**Symptoms**: Console shows "Failed to load translation file"

**Solutions**:
```bash
# Check file paths
ls -la translations/

# Verify qmake copied files
# Add to .pro file if needed:
translations.files = translations/*.qm
translations.path = /path/to/deploy
INSTALLS += translations
```

---

## Adding New Languages

### Step 1: Add Translation File

```bash
# Update .pro file
TRANSLATIONS += \
    $$PWD/translations/XingCanMatrix_zh_CN.ts \
    $$PWD/translations/XingCanMatrix_en.ts \
    $$PWD/translations/XingCanMatrix_ja_JP.ts  # NEW: Japanese
```

### Step 2: Create Translation

```bash
# Extract strings
lupdate 17_TcUi.pro

# Translate in Qt Linguist
linguist translations/XingCanMatrix_ja_JP.ts

# Compile
lrelease 17_TcUi.pro
```

### Step 3: Update LanguageManager

```cpp
// In languagemanager.h
enum Language {
    Chinese,
    English,
    Japanese  // NEW
};

// In languagemanager.cpp
QString LanguageManager::getTranslationFile(Language lang) const
{
    switch (lang) {
    case Chinese:
        return basePath + "/translations/XingCanMatrix_zh_CN.qm";
    case English:
        return basePath + "/translations/XingCanMatrix_en.qm";
    case Japanese:  // NEW
        return basePath + "/translations/XingCanMatrix_ja_JP.qm";
    }
}
```

### Step 4: Update UI

Add new option to language combobox in `mainwindow.ui`.

---

## References

### Official Documentation
- [Qt Internationalization](https://doc.qt.io/qt-6/internationalization.html)
- [Qt Linguist Manual](https://doc.qt.io/qt-6/qtlinguist-index.html)
- [QTranslator Class](https://doc.qt.io/qt-6/qtranslator.html)
- [scrcpy v3.3.3 Release](https://github.com/Genymobile/scrcpy/releases/tag/v3.3.3)

### Tools
- **lupdate** - Extract translatable strings
- **linguist** - Translation editor
- **lrelease** - Compile translations

---

## Changelog

### Version 2.1.0 (2025-12-19)

**Added**:
- ✅ scrcpy-server 3.3.3 support
- ✅ Multi-language support (Chinese/English)
- ✅ Auto system language detection
- ✅ Runtime language switching
- ✅ Language selector in UI
- ✅ Application name localization
- ✅ Download scripts for scrcpy-server

**Changed**:
- Application name: TcUi → XingCan Cloud Matrix (星灿传媒云矩阵)
- Window title adapts to system language
- scrcpy-server path updated to v3.3.3

**Technical**:
- New LanguageManager singleton class
- Translation infrastructure (.ts/.qm files)
- Updated .pro file with TRANSLATIONS
- Added changeEvent handler for dynamic retranslation

---

## Contact & Support

**Issues**: Report bugs via GitHub Issues
**Documentation**: See `scripts/README.md` for build instructions
**Qt Version**: 6.10.0
**scrcpy Version**: 3.3.3

---

**Last Updated**: 2025-12-19
**Status**: ✅ Production Ready
**Languages**: 简体中文 | English
