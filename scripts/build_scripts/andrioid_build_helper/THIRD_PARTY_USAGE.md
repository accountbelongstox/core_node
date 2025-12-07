# Third-Party Package Management System

## Overview

The `third_party.py` module provides a unified interface for importing third-party packages with automatic dependency checking and installation.

**Design Pattern**: Based on `pycore/pyfoundations/third_party.py`

## Features

- ✅ **Automatic Dependency Checking**: Checks for required packages on first import
- ✅ **Auto-Installation**: Automatically installs missing packages via pip
- ✅ **Lazy Loading**: Packages are loaded only when first accessed
- ✅ **Package Caching**: Avoids repeated imports of the same package
- ✅ **Cross-Platform**: Works on Windows, Linux, and macOS
- ✅ **Platform-Aware Installation**: Uses correct pip flags for each platform

## Supported Packages

### Required Packages
- **PIL/Pillow** - Image processing (Image, ImageOps, ImageDraw, ImageFont)
- **pyyaml** - YAML configuration file parsing

### Optional Packages
- **opencv-python** - Computer vision (cv2)
- **numpy** - Numerical computing

## Usage

### Method 1: Direct Import (Recommended)

```python
# Import specific packages
from third_party import Image, ImageOps, yaml

# Use them directly
img = Image.open("path/to/image.png")
config = yaml.safe_load(open("config.yaml"))
```

### Method 2: Getter Functions

```python
# Import getter functions
from third_party import get_third_package_PIL_Image, get_third_package_yaml

# Get packages
Image = get_third_package_PIL_Image()
yaml = get_third_package_yaml()

# Use them
img = Image.open("path/to/image.png")
```

### Method 3: Module Access

```python
# Import the module
import third_party

# Access packages via module
img = third_party.Image.open("path/to/image.png")
yaml_data = third_party.yaml.safe_load(open("config.yaml"))
```

## Examples

### Image Processing

```python
from third_party import Image, ImageOps

# Open and process image
img = Image.open("input.png")
img_resized = img.resize((800, 600))
img_grayscale = ImageOps.grayscale(img)
img_resized.save("output.png")
```

### YAML Configuration

```python
from third_party import yaml

# Load YAML config
with open("config.yaml", "r") as f:
    config = yaml.safe_load(f)

# Save YAML config
with open("output.yaml", "w") as f:
    yaml.dump(config, f)
```

### Optional Packages (cv2, numpy)

```python
from third_party import cv2, numpy

# These will auto-install if missing
img_array = cv2.imread("image.png")
processed = numpy.array(img_array)
```

## Updated Files

All files in `build_scripts` that use third-party packages have been updated to use `third_party`:

1. ✅ `utils/image_processor.py` - Changed from `from PIL import Image, ImageOps` to `from third_party import Image, ImageOps`
2. ✅ `utils/platform_image_scanner.py` - Changed from `from PIL import Image` to `from third_party import Image`
3. ✅ `utils/smart_image_resizer.py` - Changed from `from PIL import Image, ImageOps` to `from third_party import Image, ImageOps`
4. ✅ `utils/source_scanner.py` - Changed from `from PIL import Image` to `from third_party import Image`

## Adding New Third-Party Packages

To add a new third-party package:

1. **Add to DEPENDENCY_MAP** in `third_party.py`:

```python
DEPENDENCY_MAP = {
    # ... existing packages ...
    "requests": "requests",  # import_name: package_name
}
```

2. **Create getter function**:

```python
def get_third_package_requests():
    """Get requests package (lazy load)"""
    return _lazy_import('requests', 'import requests')
```

3. **Add to module wrapper** in `_ThirdPartyModule.__getattr__`:

```python
elif name == 'requests':
    return get_third_package_requests()
```

4. **Update __dir__** method:

```python
def __dir__(self):
    return list(self._original_attrs.keys()) + [
        'PIL', 'Image', 'ImageOps', 'ImageDraw', 'ImageFont',
        'yaml', 'cv2', 'numpy', 'requests'  # Add here
    ]
```

## Environment Variables

### BUILD_SCRIPTS_SKIP_DEP_CHECK

Skip automatic dependency checking on import:

```bash
export BUILD_SCRIPTS_SKIP_DEP_CHECK=1
python main.py
```

Use this when you're sure all dependencies are installed.

## Architecture

```
third_party.py
├── DEPENDENCY_MAP - Maps import names to PyPI packages
├── check_and_install_dependencies() - Auto-check and install
├── _lazy_import() - Lazy loading with auto-install
├── get_third_package_XXX() - Getter functions
└── _ThirdPartyModule - Module wrapper for direct access
```

### Execution Flow

1. **Module Import**: When you import `third_party`, dependencies are checked
2. **Auto-Check**: `check_and_install_dependencies()` runs automatically
3. **Package Installation**: Missing packages are installed via pip
4. **Lazy Loading**: Packages are imported only when first accessed
5. **Caching**: Imported packages are cached to avoid re-imports

### Platform-Specific Installation

**Windows**:
```bash
python -m pip install --no-user <package>
```

**Linux/macOS**:
```bash
python3 -m pip install --break-system-packages --ignore-installed <package>
```

## Benefits

### 1. Centralized Package Management
- All third-party packages in one place
- Easy to track dependencies
- Consistent import patterns

### 2. Automatic Installation
- No manual `pip install` needed
- Packages install on first use
- Reduces setup friction

### 3. Lazy Loading
- Faster startup time
- Load packages only when needed
- Reduces memory footprint

### 4. Cross-Platform Compatibility
- Works on Windows, Linux, macOS
- Platform-aware pip commands
- Consistent behavior everywhere

### 5. Error Handling
- Clear error messages
- Auto-retry on installation failure
- Graceful degradation for optional packages

## Troubleshooting

### Package Not Installing

If a package fails to install:

1. **Check pip**: `python -m pip --version`
2. **Manual install**: `pip install <package-name>`
3. **Check logs**: Installation output is printed to console

### Import Errors

If imports fail:

1. **Check DEPENDENCY_MAP**: Ensure package is listed
2. **Verify import name**: Some packages have different import names (e.g., `PIL` for `Pillow`)
3. **Clear cache**: Restart Python to clear import cache

### Permission Errors

On Linux/macOS, you may need:

```bash
# Use --break-system-packages (already handled by third_party.py)
# Or use a virtual environment
python3 -m venv venv
source venv/bin/activate
```

## Comparison with pycore/pyfoundations/third_party.py

| Feature | pycore third_party | build_scripts third_party |
|---------|-------------------|---------------------------|
| Auto-check dependencies | ✅ | ✅ |
| Auto-install | ✅ | ✅ |
| Lazy loading | ✅ | ✅ |
| Module wrapper | ✅ | ✅ |
| Getter functions | ✅ | ✅ |
| Platform awareness | ✅ | ✅ |
| Packages | 50+ | 4 (targeted) |

**Key Differences**:
- `pycore`: General-purpose, extensive package support
- `build_scripts`: Focused on build system needs (PIL, yaml)

## Best Practices

### DO ✅

- Import from `third_party` for all third-party packages
- Use direct imports: `from third_party import Image`
- Add new packages to DEPENDENCY_MAP
- Test imports after adding new packages

### DON'T ❌

- Don't import directly: `from PIL import Image` ❌
- Don't bypass third_party system
- Don't mix import styles in same file
- Don't add packages without updating module wrapper

## Migration Guide

### Before (Old Style)

```python
from PIL import Image, ImageOps
import yaml

# Use packages
img = Image.open("file.png")
config = yaml.safe_load(...)
```

### After (New Style)

```python
from third_party import Image, ImageOps, yaml

# Use packages (same code)
img = Image.open("file.png")
config = yaml.safe_load(...)
```

**Change**: Only the import line changes, usage stays the same!

## Future Enhancements

1. **Version Pinning**: Add version constraints to DEPENDENCY_MAP
2. **Dependency Resolution**: Check for version conflicts
3. **Update Detection**: Notify when packages are outdated
4. **Virtual Environment**: Auto-create venv if needed
5. **Requirements Export**: Generate requirements.txt automatically

---

**Created**: 2025-01-XX
**Author**: Flutter Bloom Build System
**Reference**: `pycore/pyfoundations/third_party.py`
