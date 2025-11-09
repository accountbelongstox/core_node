# Flutter I18n Automation Tools

Comprehensive toolset for automating Flutter app internationalization (i18n).

## Overview

This toolkit provides automated scripts to:
1. Extract hardcoded Chinese strings from Dart files
2. Generate i18n key constants and translation files
3. Replace hardcoded strings with i18n keys
4. Run the complete workflow with a single command

## Tools

### 1. Extract Chinese Strings (`extract_chinese_strings.py`)

Scans Dart files and extracts all Chinese text strings.

**Usage:**
```bash
python extract_chinese_strings.py <directory> [output_json]
```

**Example:**
```bash
python extract_chinese_strings.py D:/project/flutter_app chinese_report.json
```

**Output:**
- JSON report with all extracted strings
- Statistics by file and directory
- List of unique strings

### 2. Generate I18n Keys (`generate_i18n_keys.py`)

Generates i18n key constants and translation files from extracted strings.

**Usage:**
```bash
python generate_i18n_keys.py <json_report> [output_dir] [prefix] [existing_keys_file]
```

**Example:**
```bash
python generate_i18n_keys.py chinese_report.json output/ qy existing_keys.dart
```

**Output:**
- `generated_keys.dart`: Dart constant definitions
- `generated_zh.dart`: Chinese translation map
- `generated_en.dart`: English translation template
- `key_mapping.json`: Complete key-to-text mapping

### 3. Replace Hardcoded Strings (`replace_hardcoded_strings.py`)

Replaces hardcoded Chinese strings with i18n key references.

**Usage:**
```bash
# Dry run (preview changes without modifying files)
python replace_hardcoded_strings.py <mapping_json> <directory> --dry-run

# Live run (modify files)
python replace_hardcoded_strings.py <mapping_json> <directory>
```

**Example:**
```bash
# Preview changes
python replace_hardcoded_strings.py key_mapping.json D:/project/flutter_app --dry-run

# Apply changes
python replace_hardcoded_strings.py key_mapping.json D:/project/flutter_app
```

**Features:**
- Automatic backup before modification
- Import statement injection
- Detailed replacement report

### 4. Complete Workflow (`run_i18n_workflow.py`)

Runs all steps automatically in sequence.

**Usage:**
```bash
python run_i18n_workflow.py <directory> [options]

Options:
  --output DIR         Output directory (default: i18n_output)
  --dry-run           Run without making actual file changes
  --existing-keys FILE Path to existing keys file
```

**Example:**
```bash
# Full workflow with dry run
python run_i18n_workflow.py D:/project/flutter_app --dry-run

# Full workflow with actual changes
python run_i18n_workflow.py D:/project/flutter_app --output my_output

# Include existing keys to avoid duplicates
python run_i18n_workflow.py D:/project/flutter_app \
  --existing-keys D:/project/flutter_app/lib/localization_keys.dart
```

## Workflow Steps

### Step 1: Extract
Scans all Dart files and extracts Chinese strings.

### Step 2: Generate
Creates i18n keys and translation files:
- Categorizes strings (auth, profile, settings, etc.)
- Generates unique key names
- Creates translation files

### Step 3: Dry Run
Preview what will be changed without modifying files.

### Step 4: Replace (Optional)
Apply actual changes to source files:
- Creates backups
- Adds necessary imports
- Replaces strings with i18n keys

## File Structure

```
i18n_output/
└── workflow_20250105_143022/
    ├── chinese_strings_report.json
    ├── generated_i18n/
    │   ├── generated_keys.dart
    │   ├── generated_zh.dart
    │   ├── generated_en.dart
    │   └── key_mapping.json
    └── replacement_report_20250105_143025.json
```

## Integration Steps

After running the workflow:

1. **Review Generated Keys**
   ```dart
   // Copy constants from generated_keys.dart to your localization_keys.dart
   ```

2. **Add Chinese Translations**
   ```dart
   // Merge generated_zh.dart into your zh.dart file
   ```

3. **Translate to English**
   ```dart
   // Use generated_en.dart as template and add proper translations
   ```

4. **Verify Changes**
   ```bash
   # Check modified files in your version control
   git diff
   ```

5. **Test Application**
   - Run app and verify all text displays correctly
   - Switch languages to test both zh and en

## Safety Features

1. **Automatic Backups**: Original files backed up before modification
2. **Dry Run Mode**: Preview changes without touching files
3. **Exclude Patterns**: Skips generated and localization files
4. **Error Handling**: Continues on errors, reports at end

## Best Practices

1. **Always run dry-run first**
   ```bash
   python run_i18n_workflow.py <dir> --dry-run
   ```

2. **Commit before live run**
   ```bash
   git commit -am "Before i18n automation"
   ```

3. **Review generated keys**
   - Check for duplicates
   - Verify key names make sense
   - Adjust categories if needed

4. **Manual translation review**
   - Auto-generated keys may need refinement
   - English translations are templates only
   - Context-specific translations may differ

5. **Test thoroughly**
   - Run app in both languages
   - Check all modified screens
   - Verify special characters display correctly

## Troubleshooting

### Import errors
If imports are not added correctly:
```dart
// Manually add at top of file:
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../../../../common/i18n/i18n_service.dart';
```

### Key conflicts
If keys already exist, use `--existing-keys` option:
```bash
python run_i18n_workflow.py <dir> --existing-keys path/to/keys.dart
```

### Encoding issues
Ensure all files use UTF-8 encoding:
```bash
# On Windows, check file encoding in VS Code or editor
```

## Requirements

- Python 3.7+
- UTF-8 file encoding
- Flutter project structure

## License

Part of the core_node project.
