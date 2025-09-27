# Directory Tree Generator

A Python script to generate directory tree structures with filtering capabilities.

## Features

- **Cross-platform path handling**: Works on Windows and Linux
- **Smart filtering**: Automatically skips common build/cache directories and files
- **Show all files**: Displays all individual files instead of grouping
- **Simple usage**: Only one optional parameter for path

## Usage

### Basic Usage

```bash
# Generate tree for ../../ directory (default)
python directory_tree.py

# Generate tree for specific directory
python directory_tree.py ./apps
```

### Examples

```bash
# Generate tree for current project root
python directory_tree.py

# Generate tree for apps directory
python directory_tree.py ./apps

# Generate tree for poly_apps directory
python directory_tree.py ./poly_apps
```

## Filtered Items

### Directories
- `node_modules`, `__pycache__`, `.git`, `.svn`, `.hg`
- `dist`, `build`, `tmp`, `temp`
- `.vscode`, `.idea`, `.cache`, `logs`
- `vendor`, `venv`, `.venv`, `env`, `.env`
- `site-packages`, `.pub-cache`, `flutter`, `.flutter`
- `.dart_tool`, `coverage`, `.nyc_output`

### File Extensions
- `.log`, `.tmp`, `.temp`, `.cache`, `.lock`
- `.pid`, `.swp`, `.swo`, `.DS_Store`
- `.Thumbs.db`, `.desktop`, `.lnk`, `.url`

### Hidden Files
- All files starting with `.` (except `.env` and `.gitignore`)

## Output Format

The script generates markdown-formatted directory trees with:
- Clear hierarchy using tree characters
- File grouping for better readability
- Path information and generation timestamp
- Proper encoding for cross-platform compatibility

## Path Resolution

- **Relative paths**: Resolved relative to `../../` (project root)
- **Absolute paths**: Used as-is
- **No path**: Defaults to `../../` directory
