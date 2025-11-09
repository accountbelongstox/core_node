# PyCore - Python Core Library

**Version**: 1.0.0
**Python Foundation Library for core_node Project**

## Core Modules

### PyFoundations (`pyfoundations/`)
Core foundation utilities library providing cross-project common functionality.

#### Main Features

**🎨 ColorPrint** - Colored terminal output
Supports multiple log levels (INFO/WARNING/ERROR/SUCCESS), cross-platform compatible.

**📚 Encyclopedia** - Global cache system
Thread-safe key-value storage supporting data sharing between applications.

**📡 EventBus** - Event bus
Publish/subscribe pattern for decoupled communication between modules.

**🌐 GlobalVarManager** - Global variable management
Unified management of project-level configuration and runtime state.

**📱 Device** - Device abstraction layer
Supports Android/Scrcpy device management, provides resolution, encoder and other configurations.

**🔐 SecretManager** (New)
- **AES-256-GCM Encryption** - Using Node.js disguise.js tool
- **Automatic Key Management** - Unified management of `.secret_keys/` directory
- **Cross-Language Compatibility** - Interoperable with PowerShell SecretManager
- **Batch Decryption Optimization** - Session-level caching, reducing duplicate decryption
- **Key Functions**:
  - `get_secret_key()` - Get single key (auto-decrypt)
  - `set_secret_key()` - Encrypt and save key
  - `get_all_secret_keys()` - Batch get all keys
  - `encrypt_all_secrets()` - Batch encrypt
  - `decrypt_all_secrets()` - Batch decrypt

## Usage Examples

```python
# Import foundation utilities
from pyfoundations import ColorPrint, Encyclopedia, EventBus

# Use encryption management
from pyfoundations import get_secret_key, set_secret_key

# Save encrypted key
set_secret_key('api_key_1', 'secret_value_123')

# Get key (auto-decrypt)
api_key = get_secret_key('api_key_1')

# Colored output
ColorPrint.success("Operation completed!")

# Event communication
EventBus.publish("app.started", {"timestamp": time.time()})
```

## Directory Structure

```
pycore/
├── pyfoundations/          # Foundation utilities library
│   ├── color_print.py      # Colored output
│   ├── encyclopedia.py     # Global cache
│   ├── event_bus.py        # Event bus
│   ├── secret_manager.py   # Key management (new)
│   ├── gvar/              # Global variables
│   └── device/            # Device abstraction
└── README.md              # This file
```

## Installation and Integration

```python
import sys
from pathlib import Path

# Add pycore to path
pycore_path = Path('D:/programing/core_node/pycore')
sys.path.insert(0, str(pycore_path))

# Import and use
from pyfoundations import get_secret_key
```

## Encrypted Storage

Keys are stored in project root directory:
- `.secret_keys/already_encrypted/` - Encrypted files (*.js)
- `.secret_keys/.secret_ignore/` - Decryption cache (gitignored)

**Security Features**:
- Password derivation (PBKDF2)
- Automatic gitignore for plaintext keys
- Memory safety (clear password after use)

## Version Compatibility

- Python: 3.6+
- Dependencies: Standard library (encryption requires Node.js)
- Platform: Windows / Linux / WSL / macOS

## License

Internal use only - core_node project
