# Multi-language Feature Incremental Migration Plan

**Document Version**: v1.0
**Date**: 2025-10-14
**Project**: Migrating NewQtScrcpy multi-language features to qtscrcpy_tc

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Target State Analysis](#target-state-analysis)
4. [Key Differences](#key-differences)
5. [Incremental Migration Strategy](#incremental-migration-strategy)
6. [Implementation Steps](#implementation-steps)
7. [Testing Plan](#testing-plan)
8. [Risk Management](#risk-management)

---

## Executive Summary

This document provides a detailed plan for incrementally migrating the improved multi-language features from NewQtScrcpy to the qtscrcpy_tc project. The migration adds Japanese language support and adopts a more standardized language code system while preserving all existing TC custom features.

**Key Goals**:
- Add Japanese (ja_JP) language support
- Standardize language code naming convention
- Integrate new translation entries (audio features)
- Maintain backward compatibility
- Minimal disruption to existing features

---

## Current State Analysis

### 2.1 Legacy Version (qtscrcpy_tc)

#### File Structure
```
SmartMatrix/res/i18n/
├── QtScrcpy_zh.ts          # Chinese translations
├── QtScrcpy_zh.qm          # Compiled Chinese
├── QtScrcpy_en.ts          # English translations
├── QtScrcpy_en.qm          # Compiled English
├── myTc_zh_CN.ts           # TC custom Chinese translations
└── myTc_zh_CN.qm           # TC custom compiled
```

#### Language Loading Code
**Location**: `SmartMatrix/main.cpp:120-140`

```cpp
void installTranslator()
{
    static QTranslator translator;
    QLocale locale;
    QLocale::Language language = locale.language();
    //language = QLocale::English;
    QString languagePath = ":/i18n/";
    switch (language) {
    case QLocale::Chinese:
        languagePath += "QtScrcpy_zh.qm";
        break;
    case QLocale::English:
    default:
        languagePath += "QtScrcpy_en.qm";
    }

    if (!translator.load(languagePath)) {
        qWarning() << "Failed to load translation:" << languagePath;
    }
    qApp->installTranslator(&translator);
}
```

#### Supported Languages
| Language | Code | File Name | Status |
|----------|------|-----------|--------|
| Chinese | zh_CN | QtScrcpy_zh.ts | ✅ Supported |
| English | en_US | QtScrcpy_en.ts | ✅ Supported |
| Japanese | ja_JP | N/A | ❌ Not supported |

#### Translation Contexts
```xml
- Device          (device operations)
- Dialog          (main dialog)
- ToolForm        (tool window)
- VideoForm       (video window)
- QObject         (global messages)
- InputConvertGame (keymap related)
- KeyMap          (keymap related)
```

---

## Target State Analysis

### 3.1 New Version (NewQtScrcpy)

#### File Structure
```
QtScrcpy/res/i18n/
├── zh_CN.ts               # Chinese translations (NEW NAMING)
├── zh_CN.qm              # Compiled Chinese
├── en_US.ts              # English translations (NEW NAMING)
├── en_US.qm              # Compiled English
├── ja_JP.ts              # Japanese translations (NEW!)
├── ja_JP.qm              # Compiled Japanese
└── CMakeLists.txt        # CMake translation build
```

#### Language Loading Code
**Location**: `NewQtScrcpy/QtScrcpy/main.cpp:136-169`

```cpp
void installTranslator()
{
    static QTranslator translator;
    QLocale locale;
    QLocale::Language language = locale.language();

    // User can override language via config
    if (Config::getInstance().getLanguage() == "zh_CN") {
        language = QLocale::Chinese;
    } else if (Config::getInstance().getLanguage() == "en_US") {
        language = QLocale::English;
    } else if (Config::getInstance().getLanguage() == "ja_JP") {
        language = QLocale::Japanese;
    }

    QString languagePath = ":/i18n/";
    switch (language) {
    case QLocale::Chinese:
        languagePath += "zh_CN.qm";
        break;
    case QLocale::Japanese:
        languagePath += "ja_JP.qm";
        break;
    case QLocale::English:
    default:
        languagePath += "en_US.qm";
        break;
    }

    auto loaded = translator.load(languagePath);
    if (!loaded) {
        qWarning() << "Failed to load translation file:" << languagePath;
    }
    qApp->installTranslator(&translator);
}
```

#### Supported Languages
| Language | Code | File Name | Status |
|----------|------|-----------|--------|
| Chinese | zh_CN | zh_CN.ts | ✅ Supported |
| English | en_US | en_US.ts | ✅ Supported |
| Japanese | ja_JP | ja_JP.ts | ✅ Supported (NEW!) |

#### New Translation Contexts
```xml
- Dialog          (enhanced with audio features)
- QObject         (enhanced messages)
- ToolForm        (group control added)
- VideoForm       (unchanged)
- Widget          (main widget translations)
```

#### New Translation Entries (Audio Features)
```xml
<message>
    <source>install sndcpy</source>
    <translation>安装sndcpy / Sndcpyをインストール</translation>
</message>
<message>
    <source>start audio</source>
    <translation>开始音频 / オーディオを開始</translation>
</message>
<message>
    <source>stop audio</source>
    <translation>停止音频 / オーディオを停止</translation>
</message>
<message>
    <source>auto update</source>
    <translation>自动更新 / 自動更新</translation>
</message>
<message>
    <source>show toolbar</source>
    <translation>显示工具栏 / ツールバーを表示</translation>
</message>
```

---

## Key Differences

### 4.1 Comparison Table

| Aspect | Legacy (qtscrcpy_tc) | New (NewQtScrcpy) | Migration Impact |
|--------|---------------------|-------------------|------------------|
| **File Naming** | QtScrcpy_{lang}.ts | {lang_code}.ts | Need file renaming |
| **Language Code** | Inconsistent (zh, en) | Standard (zh_CN, en_US, ja_JP) | Need code updates |
| **Japanese Support** | ❌ No | ✅ Yes | Need to add |
| **Config-based Language** | ❌ No | ✅ Yes | Need to add |
| **Audio Translations** | ❌ No | ✅ Yes (5+ new entries) | Need to add |
| **Context Count** | 7 contexts | 5 contexts | Need to merge |
| **Translation Tool** | Qt Linguist | Qt Linguist | No change |

### 4.2 Detailed Differences

#### A. Naming Convention Changes
```
Legacy:               New:
QtScrcpy_zh.ts   →   zh_CN.ts
QtScrcpy_en.ts   →   en_US.ts
N/A              →   ja_JP.ts (NEW)
```

#### B. Language Detection Improvements
**Legacy**: Simple locale detection
```cpp
QLocale::Language language = locale.language();
```

**New**: Config-based override + locale fallback
```cpp
// Check config first
if (Config::getInstance().getLanguage() == "zh_CN") {
    language = QLocale::Chinese;
}
// Then fallback to system locale
```

#### C. New Translation Entries Count
- **Legacy**: ~120 translation entries
- **New**: ~130 translation entries (+10 audio-related)

---

## Incremental Migration Strategy

### 5.1 Migration Principles

1. **Non-Breaking**: Existing functionality must continue to work
2. **Incremental**: Add new features without removing old ones
3. **Backward Compatible**: Support both old and new file names during transition
4. **Testable**: Each step can be tested independently
5. **Rollback-able**: Easy to revert if issues occur

### 5.2 Migration Phases

```
Phase 1: Preparation (Day 1)
├── Backup existing translation files
├── Analyze custom TC translations
└── Create migration branch

Phase 2: File Structure Update (Day 1-2)
├── Add new language files (ja_JP.ts)
├── Rename existing files (optional, keep both)
└── Update resource file (res.qrc)

Phase 3: Code Update (Day 2-3)
├── Update main.cpp translator loading
├── Add config-based language selection
├── Add Japanese language support
└── Update Config class

Phase 4: Translation Merge (Day 3-4)
├── Merge new translation entries
├── Translate Japanese content
├── Update TC custom translations
└── Compile all .qm files

Phase 5: Testing & Validation (Day 4-5)
├── Test each language
├── Test language switching
├── Test TC custom features
└── User acceptance testing

Phase 6: Cleanup & Documentation (Day 5)
├── Remove deprecated code (if any)
├── Update documentation
└── Create user guide
```

---

## Implementation Steps

### Step 1: Preparation

#### 1.1 Backup Existing Files
```bash
# Create backup directory
cd D:/programing/core_node/poly_apps/qtscrcpy_tc
mkdir -p SmartMatrix/res/i18n/backup_$(date +%Y%m%d)

# Backup all translation files
cp SmartMatrix/res/i18n/*.ts SmartMatrix/res/i18n/backup_$(date +%Y%m%d)/
cp SmartMatrix/res/i18n/*.qm SmartMatrix/res/i18n/backup_$(date +%Y%m%d)/
```

#### 1.2 Create Migration Branch
```bash
git checkout -b feature/i18n-migration
git add -A
git commit -m "Backup before i18n migration"
```

---

### Step 2: File Structure Update

#### 2.1 Copy Japanese Translation File
```bash
# Copy Japanese translation from NewQtScrcpy
cp D:/programing/core_node/poly_apps/NewQtScrcpy/QtScrcpy/res/i18n/ja_JP.ts \
   D:/programing/core_node/poly_apps/qtscrcpy_tc/SmartMatrix/res/i18n/

# Copy compiled version if exists
cp D:/programing/core_node/poly_apps/NewQtScrcpy/QtScrcpy/res/i18n/ja_JP.qm \
   D:/programing/core_node/poly_apps/qtscrcpy_tc/SmartMatrix/res/i18n/
```

#### 2.2 Create Standardized File Names (Symlinks or Copies)

**Option A: Keep Both (Recommended for Transition)**
```bash
cd SmartMatrix/res/i18n/

# Create new standard-named files as copies
cp QtScrcpy_zh.ts zh_CN.ts
cp QtScrcpy_en.ts en_US.ts
# ja_JP.ts already copied

# Keep old files for backward compatibility
# Will remove in Step 6 after confirming everything works
```

**Option B: Rename Directly (Riskier)**
```bash
cd SmartMatrix/res/i18n/

# Rename to new standard
mv QtScrcpy_zh.ts zh_CN.ts
mv QtScrcpy_en.ts en_US.ts
mv QtScrcpy_zh.qm zh_CN.qm
mv QtScrcpy_en.qm en_US.qm
```

#### 2.3 Update Resource File (res.qrc)

**File**: `SmartMatrix/res/res.qrc`

**Add**:
```xml
<qresource prefix="/i18n">
    <!-- New standard names -->
    <file>i18n/zh_CN.qm</file>
    <file>i18n/en_US.qm</file>
    <file>i18n/ja_JP.qm</file>

    <!-- Keep old names during transition (optional) -->
    <file>i18n/QtScrcpy_zh.qm</file>
    <file>i18n/QtScrcpy_en.qm</file>

    <!-- TC custom -->
    <file>i18n/myTc_zh_CN.qm</file>
</qresource>
```

---

### Step 3: Code Update

#### 3.1 Update Config Class

**File**: `SmartMatrix/util/config.h`

**Add** language configuration support:
```cpp
class Config {
public:
    // ... existing methods ...

    // Add language configuration
    QString getLanguage();
    void setLanguage(const QString& language);

private:
    QString m_language = "auto";  // Default: auto-detect
};
```

**File**: `SmartMatrix/util/config.cpp`

**Add** implementation:
```cpp
QString Config::getLanguage() {
    return getValue("language", "auto").toString();
}

void Config::setLanguage(const QString& language) {
    setValue("language", language);
}
```

#### 3.2 Update main.cpp Translator Loading

**File**: `SmartMatrix/main.cpp`

**Replace** the existing `installTranslator()` function:

```cpp
void installTranslator()
{
    static QTranslator translator;
    QLocale locale;
    QLocale::Language language = locale.language();

    // Check if user has configured a specific language
    QString configLang = Config::getInstance().getLanguage();
    if (configLang != "auto") {
        if (configLang == "zh_CN") {
            language = QLocale::Chinese;
        } else if (configLang == "en_US") {
            language = QLocale::English;
        } else if (configLang == "ja_JP") {
            language = QLocale::Japanese;
        }
    }
    // Otherwise use system locale (already set above)

    QString languagePath = ":/i18n/";
    switch (language) {
    case QLocale::Chinese:
        languagePath += "zh_CN.qm";
        break;
    case QLocale::Japanese:
        languagePath += "ja_JP.qm";
        break;
    case QLocale::English:
    default:
        languagePath += "en_US.qm";
        break;
    }

    bool loaded = translator.load(languagePath);
    if (!loaded) {
        qWarning() << "Failed to load translation file:" << languagePath;

        // Fallback to old naming convention (during transition)
        if (language == QLocale::Chinese) {
            loaded = translator.load(":/i18n/QtScrcpy_zh.qm");
        } else if (language == QLocale::English) {
            loaded = translator.load(":/i18n/QtScrcpy_en.qm");
        }

        if (!loaded) {
            qWarning() << "Fallback translation also failed";
        }
    }

    qApp->installTranslator(&translator);
}
```

#### 3.3 Add Language Selection UI (Optional but Recommended)

**File**: `SmartMatrix/dialog.ui` or create a settings dialog

**Add** a QComboBox for language selection:
```xml
<widget class="QComboBox" name="languageComboBox">
    <item>
        <property name="text">
            <string>Auto Detect</string>
        </property>
    </item>
    <item>
        <property name="text">
            <string>简体中文 (Chinese)</string>
        </property>
    </item>
    <item>
        <property name="text">
            <string>English</string>
        </property>
    </item>
    <item>
        <property name="text">
            <string>日本語 (Japanese)</string>
        </property>
    </item>
</widget>
```

**File**: `SmartMatrix/dialog.cpp`

**Add** slot handler:
```cpp
void Dialog::on_languageComboBox_currentIndexChanged(int index) {
    QString language = "auto";
    switch (index) {
        case 0: language = "auto"; break;
        case 1: language = "zh_CN"; break;
        case 2: language = "en_US"; break;
        case 3: language = "ja_JP"; break;
    }

    Config::getInstance().setLanguage(language);

    // Prompt user to restart application
    QMessageBox::information(this,
        tr("Language Changed"),
        tr("Please restart the application for the language change to take effect."));
}
```

---

### Step 4: Translation Merge

#### 4.1 Update Existing Translation Files

Use Qt Linguist to open each .ts file and:

1. **Merge new entries from NewQtScrcpy**:
   - Open `zh_CN.ts` in Qt Linguist
   - Go to File → Open → Select NewQtScrcpy's `zh_CN.ts`
   - Copy new translation entries (audio-related)
   - Paste into qtscrcpy_tc's `zh_CN.ts`

2. **Add new contexts if needed**:
   ```xml
   <context>
       <name>Widget</name>
       <message>
           <source>install sndcpy</source>
           <translation>安装sndcpy</translation>
       </message>
       <message>
           <source>start audio</source>
           <translation>开始音频</translation>
       </message>
       <message>
           <source>stop audio</source>
           <translation>停止音频</translation>
       </message>
       <message>
           <source>auto update</source>
           <translation>自动更新</translation>
       </message>
       <message>
           <source>show toolbar</source>
           <translation>显示工具栏</translation>
       </message>
   </context>
   ```

#### 4.2 Translate Japanese Content for TC Custom Features

For TC-specific features not in NewQtScrcpy, add Japanese translations:

**Example for TC GroupManage features**:
```xml
<context>
    <name>CustomTreeWidget</name>
    <message>
        <source>Device Group Management</source>
        <translation type="unfinished">デバイスグループ管理</translation>
    </message>
    <message>
        <source>Add Group</source>
        <translation type="unfinished">グループを追加</translation>
    </message>
    <message>
        <source>Delete Group</source>
        <translation type="unfinished">グループを削除</translation>
    </message>
    <message>
        <source>Rename Group</source>
        <translation type="unfinished">グループ名を変更</translation>
    </message>
</context>
```

**Translation Tips**:
- Use professional translator or native speaker for accuracy
- Consider using translation services (Google Translate as draft, then refine)
- Maintain consistent terminology across contexts

#### 4.3 Compile Translation Files

```bash
cd SmartMatrix/res/i18n

# Compile using lrelease (Qt's translation compiler)
lrelease zh_CN.ts -qm zh_CN.qm
lrelease en_US.ts -qm en_US.qm
lrelease ja_JP.ts -qm ja_JP.qm

# Also compile TC custom translations
lrelease myTc_zh_CN.ts -qm myTc_zh_CN.qm
```

**Or use qmake** (if using qmake build system):
```bash
# In SmartMatrix directory
qmake 17_TcUi.pro
make lrelease
```

---

## Testing Plan

### Step 5: Testing & Validation

#### 5.1 Unit Testing

**Test 1: Language File Loading**
```cpp
// Test case: Verify each language file loads correctly
TEST(I18nTest, LoadChineseTranslation) {
    QTranslator translator;
    bool loaded = translator.load(":/i18n/zh_CN.qm");
    ASSERT_TRUE(loaded);
}

TEST(I18nTest, LoadEnglishTranslation) {
    QTranslator translator;
    bool loaded = translator.load(":/i18n/en_US.qm");
    ASSERT_TRUE(loaded);
}

TEST(I18nTest, LoadJapaneseTranslation) {
    QTranslator translator;
    bool loaded = translator.load(":/i18n/ja_JP.qm");
    ASSERT_TRUE(loaded);
}
```

#### 5.2 Integration Testing

**Test Checklist**:
- [ ] Application starts successfully with each language
- [ ] All UI text is translated correctly (no missing translations)
- [ ] Language switching works (if implemented)
- [ ] Config-based language override works
- [ ] System locale detection works
- [ ] Fallback to English works if translation missing
- [ ] TC custom features display correctly in all languages
- [ ] Audio feature translations appear correctly

#### 5.3 Manual Testing Matrix

| Feature | Chinese | English | Japanese | Pass/Fail |
|---------|---------|---------|----------|-----------|
| Main window title | ✅ | ✅ | ✅ | |
| Menu items | ✅ | ✅ | ✅ | |
| Toolbar tooltips | ✅ | ✅ | ✅ | |
| Dialog buttons | ✅ | ✅ | ✅ | |
| Error messages | ✅ | ✅ | ✅ | |
| Status messages | ✅ | ✅ | ✅ | |
| Device connection | ✅ | ✅ | ✅ | |
| Group management (TC) | ✅ | ✅ | ✅ | |
| Audio features (NEW) | ✅ | ✅ | ✅ | |
| Settings dialog | ✅ | ✅ | ✅ | |

#### 5.4 Visual Testing

**Screenshot Comparison**:
1. Take screenshots of main UI in each language
2. Compare with NewQtScrcpy for consistency
3. Verify no text overflow or layout issues
4. Check for proper character encoding (especially Japanese)

#### 5.5 User Acceptance Testing

**UAT Scenarios**:
1. **Scenario 1**: User with Chinese system locale
   - Expected: App starts in Chinese
   - Expected: All features work correctly

2. **Scenario 2**: User with English system locale
   - Expected: App starts in English
   - Expected: All features work correctly

3. **Scenario 3**: User manually selects Japanese
   - Expected: App switches to Japanese after restart
   - Expected: All TC features display in Japanese

4. **Scenario 4**: User with unsupported locale (e.g., French)
   - Expected: App falls back to English
   - Expected: All features work correctly

---

## Risk Management

### 7.1 Identified Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Translation file corruption** | Low | High | Regular backups, version control |
| **Missing translations** | Medium | Medium | Fallback to English, comprehensive testing |
| **Build errors after changes** | Medium | High | Keep old files during transition, rollback plan |
| **UI layout issues with Japanese** | Medium | Medium | Visual testing, flexible layouts |
| **Performance degradation** | Low | Low | Benchmark before/after |
| **Config file corruption** | Low | Medium | Config validation, default values |
| **User confusion with language switch** | Low | Low | Clear UI messaging, documentation |

### 7.2 Rollback Plan

If critical issues occur:

**Step 1**: Revert code changes
```bash
git checkout main
git branch -D feature/i18n-migration
```

**Step 2**: Restore backup files
```bash
cp SmartMatrix/res/i18n/backup_YYYYMMDD/*.ts SmartMatrix/res/i18n/
cp SmartMatrix/res/i18n/backup_YYYYMMDD/*.qm SmartMatrix/res/i18n/
```

**Step 3**: Rebuild application
```bash
qmake 17_TcUi.pro
make clean
make
```

### 7.3 Contingency Plans

**Plan A**: If Japanese translation is incomplete
- Ship with English as fallback for Japanese locale
- Add Japanese translations incrementally in future releases

**Plan B**: If new naming convention causes issues
- Keep using old naming convention (QtScrcpy_*.ts)
- Postpone standardization to future release

**Plan C**: If config-based language selection has bugs
- Remove feature temporarily
- Use only system locale detection

---

## Appendix

### A. Translation File Format (XML Structure)

**Standard .ts file structure**:
```xml
<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE TS>
<TS version="2.1" language="zh_CN">
<context>
    <name>ClassName</name>
    <message>
        <location filename="../../path/file.cpp" line="123"/>
        <source>English text</source>
        <translation>翻译文本</translation>
    </message>
</context>
</TS>
```

### B. Language Code Reference

| Language | ISO 639-1 | ISO 3166-1 | Qt Code | File Name |
|----------|-----------|------------|---------|-----------|
| Chinese (Simplified) | zh | CN | zh_CN | zh_CN.ts |
| English (US) | en | US | en_US | en_US.ts |
| Japanese | ja | JP | ja_JP | ja_JP.ts |
| Korean | ko | KR | ko_KR | ko_KR.ts |
| French | fr | FR | fr_FR | fr_FR.ts |
| German | de | DE | de_DE | de_DE.ts |
| Spanish | es | ES | es_ES | es_ES.ts |

### C. Qt Linguist Commands

**Update translations** (extract new strings from source):
```bash
lupdate 17_TcUi.pro
```

**Compile translations** (generate .qm files):
```bash
lrelease 17_TcUi.pro
```

**Open translation file**:
```bash
linguist SmartMatrix/res/i18n/zh_CN.ts
```

### D. Build System Integration

#### For qmake (.pro file)

**Add to 17_TcUi.pro**:
```qmake
TRANSLATIONS = \
    $$PWD/res/i18n/zh_CN.ts \
    $$PWD/res/i18n/en_US.ts \
    $$PWD/res/i18n/ja_JP.ts \
    $$PWD/res/i18n/myTc_zh_CN.ts

# Compile translations automatically
qtPrepareTool(LRELEASE, lrelease)
for(tsfile, TRANSLATIONS) {
    qmfile = $$replace(tsfile, \\.ts$, .qm)
    system($$LRELEASE $$tsfile -qm $$qmfile)
}
```

#### For CMake (future migration)

**Create res/i18n/CMakeLists.txt**:
```cmake
find_package(Qt6 COMPONENTS LinguistTools REQUIRED)

set(TS_FILES
    zh_CN.ts
    en_US.ts
    ja_JP.ts
    myTc_zh_CN.ts
)

qt6_add_translation(QM_FILES ${TS_FILES})

add_custom_target(translations ALL DEPENDS ${QM_FILES})
```

### E. Configuration File Format

**config.ini** language section:
```ini
[General]
# Language options: auto, zh_CN, en_US, ja_JP
language=auto
```

### F. Useful Resources

**Official Documentation**:
- Qt Internationalization: https://doc.qt.io/qt-6/internationalization.html
- Qt Linguist Manual: https://doc.qt.io/qt-6/qtlinguist-index.html

**Translation Services**:
- Google Translate API: https://cloud.google.com/translate
- DeepL Translator: https://www.deepl.com/translator
- Professional services: Gengo, One Hour Translation

**Community Resources**:
- QtScrcpy GitHub: https://github.com/barry-ran/QtScrcpy
- Qt Forum I18n Section: https://forum.qt.io/category/18/internationalization

---

## Document Change History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0 | 2025-10-14 | Claude | Initial version - Complete migration plan |

---

**END OF DOCUMENT**
