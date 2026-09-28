# pyfoundations.app_launcher - Application Launcher

## Overview

The `app_launcher.py` module provides a comprehensive application discovery and launching system for the pycore framework. It is responsible for scanning the `pyapps/` directory, finding available applications, performing fuzzy matching on app names, and dynamically loading and executing Python applications.

## Module Location

```
pycore/pyfoundations/app_launcher.py
```

## Dependencies

- Python Standard Library Only:
  - `sys` - System-specific parameters
  - `os` - Operating system interface
  - `importlib` - Import system
  - `importlib.util` - Import utilities
  - `pathlib.Path` - Object-oriented filesystem paths
  - `typing` - Type hints

## Core Class: AppLauncher

### Class Definition

```python
class AppLauncher:
    """
    Application Launcher
    
    Handles discovery, selection, and launching of Python applications
    in the pyapps/ directory.
    """
```

### Constructor

```python
def __init__(self, project_root: Optional[Path] = None):
    """
    Initialize App Launcher
    
    Args:
        project_root: Project root directory (auto-detected if not provided)
    """
```

**Attributes:**
- `project_root` - Root directory of the project
- `pyapps_dir` - Directory containing Python applications
- `app` - Current application instance
- `app_name` - Name of the selected application
- `app_dir` - Directory of the selected application
- `app_entry` - Entry point file path
- `context_loaded` - Boolean flag indicating if context is loaded

### Methods

#### get_available_apps(debug: bool = False) -> List[str]

Scans the `pyapps/` directory and returns a list of available applications.

**Entry Point Patterns Supported:**
1. Standard Pattern (recommended): `{appname}/{appname}_main.py`
2. Fallback Pattern: `{appname}/main.py`

**Implementation Details:**
- Iterates through all directories in `pyapps/`
- Skips hidden directories (starting with `.`) and system directories (starting with `__`)
- Checks for the presence of standard or fallback entry points
- Returns sorted list of application names
- Debug mode provides detailed scanning information

**Example:**
```python
launcher = AppLauncher()
apps = launcher.get_available_apps()
# Returns: ['mcp', 'okx_price_monitor', 'translator', ...]

# With debug output
apps = launcher.get_available_apps(debug=True)
# Prints detailed scan information for each directory
```

#### get_app_name_from_args() -> Optional[str]

Extracts the application name from command line arguments.

**Supported Formats:**
- `--app=appname`
- `-app=appname`
- `app=appname`
- `--app appname`
- `-app appname`

**Environment Variable Fallbacks:**
- `APP`
- `APPNAME`
- `APP_NAME`

**Implementation:**
```python
def get_app_name_from_args(self) -> Optional[str]:
    args = sys.argv[1:]
    
    for i, arg in enumerate(args):
        # Format: --app=name, -app=name, app=name
        if '=' in arg:
            if arg.startswith('--app=') or arg.startswith('-app=') or arg.startswith('app='):
                return arg.split('=', 1)[1].strip()
        
        # Format: --app name, -app name
        elif arg in ['--app', '-app']:
            if i + 1 < len(args):
                return args[i + 1].strip()
    
    # Check environment variables
    return os.environ.get('APP') or os.environ.get('APPNAME') or os.environ.get('APP_NAME')
```

#### find_matching_apps(query: str) -> List[str]

Performs fuzzy matching to find applications matching a query string.

**Matching Priority:**
1. Exact match (case-insensitive)
2. Prefix match
3. Contains match

**Example:**
```python
launcher = AppLauncher()
matches = launcher.find_matching_apps('okx')
# Returns: ['okx_price_monitor']

matches = launcher.find_matching_apps('mcp')
# Returns: ['mcp', 'mcpserver'] if both exist
```

#### prompt_for_app_selection(apps: List[str] = None) -> Optional[str]

Displays an interactive menu for the user to select an application.

**Features:**
- Numbered list of available applications
- Supports selection by number or by name
- Fuzzy matching for name input
- Handles multiple matches with sub-selection

**Example Output:**
```
Available Python applications:
  [1] mcp
  [2] okx_price_monitor
  [3] translator

Select an application by number or name: 
```

#### inject_app_to_environment(app_name: str)

Injects the selected application name into the runtime environment.

**Actions:**
1. Adds `--app={app_name}` to `sys.argv` if not present
2. Sets environment variables: `APP`, `APPNAME`, `APP_NAME`

#### resolve_app() -> bool

Main resolution logic that determines which application to launch.

**Resolution Flow:**
1. Check if context already loaded
2. Get app name from command line arguments
3. Perform fuzzy matching
4. Handle single match, multiple matches, or no matches
5. Prompt for selection if needed
6. Set application paths and entry point

**Error Handling:**
- Shows debug scan information on failure
- Provides helpful tips for creating new applications
- Lists available applications when no match found

#### start() -> bool

Starts the resolved application.

**Execution Flow:**
1. Resolve application (calls `resolve_app()`)
2. Display startup banner (suppressed in MCP mode)
3. Load module dynamically using `importlib`
4. Execute `main()` or `start()` function if present

**MCP Mode Detection:**
```python
is_mcp_mode = os.environ.get('PYCORE_MCP_MODE', '').lower() in ('1', 'true', 'yes')
```

**Dynamic Module Loading:**
```python
module_name = f"pyapps.{self.app_name}.{self.app_name}_main"
spec = importlib.util.spec_from_file_location(module_name, self.app_entry)
app_module = importlib.util.module_from_spec(spec)
sys.modules[module_name] = app_module
spec.loader.exec_module(app_module)
```

#### stop()

Stops the running application by calling its `stop()` method if available.

## Module-Level Functions

### main()

Entry point for command-line execution:

```python
def main():
    """Main entry point for AppLauncher"""
    launcher = AppLauncher()
    success = launcher.start()
    sys.exit(0 if success else 1)
```

## Usage Examples

### Basic Usage

```python
from pycore.pyfoundations.app_launcher import AppLauncher

# Create launcher
launcher = AppLauncher()

# Start application (interactive selection if no args)
launcher.start()
```

### With Explicit Project Root

```python
from pathlib import Path
from pycore.pyfoundations.app_launcher import AppLauncher

launcher = AppLauncher(project_root=Path('/www/programing/core_node'))
launcher.start()
```

### Programmatic App Selection

```python
launcher = AppLauncher()

# Get available apps
apps = launcher.get_available_apps()
print(f"Available: {apps}")

# Find specific app
matches = launcher.find_matching_apps('okx')
if matches:
    launcher.inject_app_to_environment(matches[0])
    launcher.start()
```

### Command Line Usage

```bash
# Direct specification
python pymain.py app=okx_price_monitor

# With equals sign
python pymain.py --app=mcp

# With space
python pymain.py --app translator

# Fuzzy matching
python pymain.py app=okx  # Matches okx_price_monitor
```

## Integration with pymain.py

The `AppLauncher` is the core component used by `pymain.py` to launch applications:

```python
# In pymain.py
from pycore.pyfoundations.app_launcher import AppLauncher

if __name__ == '__main__':
    launcher = AppLauncher()
    launcher.start()
```

## Error Messages and Troubleshooting

### No Application Found

```
Error: No application found matching 'xyz'

[DEBUG] Scanning pyapps directory: /www/programing/core_node/pyapps
[DEBUG] Found 5 app(s): mcp, okx_price_monitor, ...

Available applications:
  - mcp
  - okx_price_monitor
  - translator

Tip: Use keyword matching (e.g., 'mcp' matches 'mcpserver')
Tip: Create a new app in pyapps/xyz/ with main.py entry point
```

### No Entry Point Found

```
Error: No valid entry point found for app: myapp
Expected one of:
  - /path/to/pyapps/myapp/myapp_main.py (standard pattern)
  - /path/to/pyapps/myapp/main.py (fallback pattern)
```

## Best Practices

1. **Use Standard Entry Point Pattern**: Prefer `{appname}_main.py` over `main.py`
2. **Implement Both main() and start()**: Provide both functions for flexibility
3. **Keep Entry Points Simple**: Entry points should initialize and delegate to main application logic
4. **Use Environment Variables**: For CI/CD, use `APP` environment variable instead of command line

## Related Modules

- `pycore.pylauncher` - Service launcher with singleton detection
- `pycore.pyfoundations.pygvar` - Global variables and paths
- `pycore.pyfoundations.color_print` - Colored console output

## Version History

- v1.0.0 - Initial implementation
- v1.1.0 - Added MCP mode detection
- v1.2.0 - Added fuzzy matching and interactive selection

