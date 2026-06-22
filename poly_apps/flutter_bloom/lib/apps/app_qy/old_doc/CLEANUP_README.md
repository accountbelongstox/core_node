# Code Cleanup Tools

Automated tools for cleaning duplicate files and backup files in the Flutter project.

## 📁 Files

- `cleanup_analysis_en.py` - Analysis script (English version)
- `cleanup_execute_en.py` - Execution script (English version)
- `CLEANUP_REPORT.json` - Analysis report (generated)
- `CLEANUP_RESULTS_*.json` - Execution results (generated)

## 🚀 Quick Start

### Step 1: Analyze

Run the analysis script to scan for duplicate and backup files:

```bash
cd /path/to/app_qy
python cleanup_analysis_en.py
```

This will generate `CLEANUP_REPORT.json` with detailed analysis.

### Step 2: Preview (Dry Run)

Preview what will be cleaned without making changes:

```bash
python cleanup_execute_en.py
```

### Step 3: Execute

Execute the actual cleanup:

```bash
python cleanup_execute_en.py --execute
```

## 📊 What Gets Cleaned

### 1. Refactored Files

Files with `*_refactored_app_qy.dart` naming:
- **With original**: Deletes old original file, renames refactored version
- **Without original**: Simply renames to standard naming

### 2. Backup Files

Files with `*.backup.*` pattern:
- Deletes backup files when original exists
- Warns about orphaned backups

## 🎯 Cleanup Strategy

```
Before:
├── home_screen_app_qy.dart              (old version)
├── home_screen_refactored_app_qy.dart   (new version)
└── logo.backup.png                      (backup)

After:
└── home_screen_app_qy.dart              (new version, renamed)
```

## 📈 Example Output

```
Starting code cleanup analysis...

Scanning for refactored files...
Found 49 refactored files
Scanning for backup files...
Found 19 backup files

Generating cleanup recommendations...

Statistics:
   - Refactored files: 49
     • With original: 26
     • Without original: 23
   - Backup files: 19
     • With original: 19
     • Without original: 0

Report saved to: CLEANUP_REPORT.json

================================================================================
Cleanup Recommendations Summary
================================================================================

[refactored_with_original]
  Count: 26 files
  Action: Delete old original files, rename refactored versions to original names
  Reason: Refactored versions are the new improved versions

[refactored_without_original]
  Count: 23 files
  Action: Rename refactored files to standard names (remove _refactored suffix)
  Reason: These files have no corresponding old version

[backup_with_original]
  Count: 19 files
  Action: Delete backup files (original files exist)
  Reason: Original files exist, backup files can be safely deleted

================================================================================

Analysis complete!
```

## 🔧 Advanced Usage

### Customize Analysis

Edit `cleanup_analysis_en.py` to customize:

```python
# Change base path
base_path = Path("/custom/path")

# Change file patterns
for file in base_path.rglob("*_old.dart"):  # Custom pattern
    # ...
```

### Batch Processing

Process multiple apps:

```bash
for app in app_qy app_example app_travel; do
    cd /path/to/$app
    python cleanup_analysis_en.py
    python cleanup_execute_en.py --execute
done
```

## ⚠️ Safety Features

1. **Dry Run by Default**: Always runs in preview mode unless `--execute` is specified
2. **Detailed Logging**: All operations logged to JSON files
3. **Error Handling**: Continues on errors, reports at end
4. **Verification**: Can verify results after execution

## 📝 File Structure

```
app_qy/
├── cleanup_analysis_en.py          # Analysis script
├── cleanup_execute_en.py           # Execution script
├── CLEANUP_REPORT.json            # Analysis results
├── CLEANUP_RESULTS_DRY_RUN.json   # Dry run results
├── CLEANUP_RESULTS_ACTUAL.json    # Actual execution results
└── CLEANUP_README.md              # This file
```

## 🎨 Output Files

### CLEANUP_REPORT.json

```json
{
  "timestamp": "2025-11-07T21:24:52",
  "refactored_files": [
    {
      "refactored": "features/word/views/word_book_screen_refactored_app_qy.dart",
      "original": "features/word/views/word_book_screen_app_qy.dart",
      "has_original": true,
      "size_kb": 11.66
    }
  ],
  "recommendations": [...]
}
```

### CLEANUP_RESULTS_ACTUAL.json

```json
{
  "timestamp": "2025-11-07T21:30:00",
  "dry_run": false,
  "actions": [...],
  "summary": {
    "refactored_renamed": 49,
    "originals_deleted": 26,
    "backups_deleted": 19,
    "errors": 0
  }
}
```

## 💡 Best Practices

1. **Always run analysis first**: Understand what will be changed
2. **Review dry run output**: Check the preview before executing
3. **Use version control**: Commit before cleanup (safety net)
4. **Keep scripts**: Save for future cleanups in other directories
5. **Document changes**: Update project documentation after cleanup

## 🔍 Verification

After cleanup, verify results:

```bash
# Check for remaining refactored files
find . -name "*_refactored_app_qy.dart"

# Check for remaining backup files
find . -name "*.backup.*"

# Both should return 0 files
```

## 📦 Requirements

- Python 3.6+
- No external dependencies (uses standard library only)

## 🤝 Contributing

To extend these scripts:

1. Add new file patterns to scan
2. Implement new cleanup strategies
3. Add more detailed reporting
4. Improve error handling

## 📄 License

These scripts are part of the Flutter Bloom project.

---

**Status**: Production Ready ✅
**Last Updated**: 2025-11-07
**Maintained By**: Development Team
