# Core Node Backup Manager

This Python script provides backup and restore functionality for the core_node project.

## Features

- **Backup**: Creates timestamped backups of the core_node project
- **Restore**: Restores files from backups (only files that don't exist in target)
- **Smart Filtering**: Skips unnecessary files and directories
- **Safety**: Never overwrites existing files during restore

## Usage

### From PowerShell Menu
1. Run `dd.ps1` from the core_node directory
2. Select "Backup this project"
3. Choose from the backup menu options

### Direct Python Execution
```bash
python scripts/pytools/backup_core_node_script/backup_manager.py
```

## Menu Options

1. **Start Backup**: Creates a new backup with timestamp
2. **Restore Backup**: Restores files from an existing backup
3. **List Available Backups**: Shows all available backups
4. **Exit**: Exit the backup manager

## Backup Configuration

### Skipped Directories
- `node_modules`, `vendor` (dependency directories)
- `build`, `dist`, `target`, `bin`, `obj`, `out` (compilation outputs)
- `.dart_tool`, `.flutter-plugins` (Dart/Flutter)
- `.nuxt`, `.next` (Nuxt/Next.js)
- `tmp`, `temp`, `cache`, `.cache` (temporary files)
- `coverage`, `.coverage` (test coverage)
- `logs`, `.logs` (log files)
- `.idea`, `.vscode`, `.vs` (IDE files)
- `venv`, `env`, `.venv` (Python virtual environments)

### Skipped File Extensions
- `.pyc`, `.pyo`, `.pyd` (Python compiled files)
- `.log`, `.tmp`, `.temp`, `.cache` (temporary files)
- `.swp`, `.swo` (Vim swap files)
- `.class`, `.jar` (Java compiled files)
- `.o`, `.obj`, `.a`, `.lib` (C/C++ compiled files)
- `.map`, `.min.js`, `.min.css` (minified files)

### Always Included
- `.git` directory (Git repository)
- `.gitignore`, `.gitattributes` (Git configuration files)
- Source code files
- Configuration files

## Backup Location

Backups are stored in the parent directory of core_node:
- Source: `D:\programing\core_node`
- Backup: `D:\programing\core_node_YYYYMMDD_HHMMSS`

## Safety Features

- **No Overwrite**: Restore never overwrites existing files
- **Metadata**: Each backup includes metadata with creation time and file counts
- **Verification**: Backup process verifies file copying
- **Cleanup**: Failed backups are automatically cleaned up

## Example Usage

```python
# Test the backup manager
python scripts/pytools/backup_core_node_script/test_backup.py
```
