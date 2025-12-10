# Build Scripts - Quick Reference Card

## Directory Structure at a Glance

```
build_scripts/
├── main.py                    👈 START HERE (Entry Point)
├── build_versions_config.json ⚙️  Version config
├── README.md                  📖 Full documentation
│
├── core/                      🧠 Business logic
│   └── build_controller.py
│
├── managers/                  📦 Resource managers
│   ├── capacitor_resource_manager.py
│   ├── resource_replacer.py
│   └── resource_scanner.py
│
├── utils/                     🔧 Utilities
│   ├── file_var_system_new.py
│   ├── init_build_config.py
│   ├── key_center.py
│   └── web_preview_server.py
│
├── shell/                     💻 Shell scripts
│   ├── execute_commands_windows_new.ps1
│   └── execute_commands_linux_new.sh
│
└── docs/                      📚 Documentation
    ├── PRE_BUILD_CHECKLIST.md  ⭐ For frontend devs
    └── ... (other docs)
```

## Quick Commands

### Run Build System
```bash
# Windows
.\poly_apps\cmg-corporate-portal\scripts\start.ps1

# Linux/Mac
./poly_apps/cmg-corporate-portal/scripts/start.sh
```

### Direct Python Entry
```bash
cd build_scripts
python main.py /path/to/project
```

## File Locations Quick Map

| What | Old Location | New Location |
|------|--------------|--------------|
| Entry point | `main_controller.py` | `main.py` ⭐ |
| Main logic | `main_controller.py` | `core/build_controller.py` |
| File vars | `file_var_system_new.py` | `utils/file_var_system_new.py` |
| Keys/config | `key_center.py` | `utils/key_center.py` |
| Shell PS1 | `execute_commands_windows_new.ps1` | `shell/execute_commands_windows_new.ps1` |
| Shell bash | `execute_commands_linux_new.sh` | `shell/execute_commands_linux_new.sh` |
| Docs | Root (20+ files) | `docs/` (organized) |

## Import Changes

### Old Style (Deprecated)
```python
from main_controller import BuildController
from key_center import VERSION_CONFIG
```

### New Style (Use This)
```python
from core.build_controller import BuildController
from utils.key_center import VERSION_CONFIG
```

## Frontend Developer Checklist

🎯 **Read First:** `docs/PRE_BUILD_CHECKLIST.md`

Quick checklist:
1. ✅ Install: `pnpm add @capacitor/status-bar`
2. ✅ Configure StatusBar in App.tsx
3. ✅ Add `viewport-fit=cover` to index.html
4. ✅ Setup safe area insets (Tailwind/CSS)
5. ✅ Update header: `h-[60px]` → `min-h-[60px] pt-safe-top`
6. ✅ Update main padding: `calc(env(safe-area-inset-top) + 60px)`
7. ✅ Set `overlaysWebView: false` in capacitor.config.ts
8. ✅ Place logo.png (1024x1024) in assets/
9. ✅ Place splash.png (2732x2732) in assets/
10. ✅ Run `pnpm run build` before build script

## Build System Developer Reference

### Key Files
- **main.py** (120 lines) - Entry point
- **core/build_controller.py** (1690+ lines) - Main logic
- **utils/key_center.py** - Configuration loader
- **utils/file_var_system_new.py** - Python↔Shell communication

### Architecture Principles
1. 🔒 **Separation:** Python logic ≠ Shell execution
2. 📁 **File Variables:** No direct parameters to shell
3. ❌ **No Exit Codes:** Shell doesn't check exit codes
4. 📊 **Pre-validation:** Check before, not after execution

### Menu Options
```
1. Install Capacitor (with automatic backup)
2. Development Server (Debug)
3. Build for Web
4. Build for Android
Q. Quit
```

## Common Tasks

### Add New Command
```python
# In core/build_controller.py
self.var_system.add_command(
    "my_command",
    "Description",
    "/path"
)
```

```powershell
# In shell/execute_commands_windows_new.ps1
"my_command" {
    $var = Get-VarValue -Key $KEY_VAR -Prefix $Prefix
    # Execute
}
```

### Update Versions
Edit `build_versions_config.json`:
```json
{
  "android_build_tools": {
    "agp_version": "8.13.0",
    "gradle_version": "8.14.3"
  }
}
```

### Check Configuration
```python
from utils.key_center import VERSION_CONFIG
print(VERSION_CONFIG)
```

## Documentation Quick Links

| Document | Purpose |
|----------|---------|
| `README.md` | 📖 Full architecture docs |
| `MIGRATION_GUIDE_FILE_STRUCTURE.md` | 🔄 Migration guide |
| `REFACTORING_COMPLETE_2025_12_11.md` | ✅ Completion summary |
| `docs/PRE_BUILD_CHECKLIST.md` | ⭐ Frontend checklist |
| `docs/BUILD_FLOW_CONFIRMED.md` | 🔄 Build flow |
| `docs/CAPACITOR_INTEGRATION_COMPLETE.md` | 📱 Capacitor guide |

## Troubleshooting

### Import Error
```
ModuleNotFoundError: No module named 'file_var_system_new'
```
**Fix:** Update imports to include directory prefix:
```python
from utils.file_var_system_new import FileVarSystem
```

### Shell Script Not Found
```
execute_commands_windows_new.ps1 not found
```
**Fix:** Update path in start script:
```powershell
& "$BUILD_SCRIPTS_DIR\shell\execute_commands_windows_new.ps1"
```

### Build Fails - Missing StatusBar
**Fix:** Read `docs/PRE_BUILD_CHECKLIST.md` and install:
```bash
pnpm add @capacitor/status-bar
```

## Version Info

- **Capacitor:** 8.0.0
- **AGP:** 8.13.0
- **Gradle:** 8.14.3
- **Android SDK:** 36 (compile & target)
- **Min SDK:** 24
- **Kotlin:** 2.2.20
- **Java:** 17+ (recommended: 21)

## Support

1. Check `README.md` for architecture
2. Check `docs/PRE_BUILD_CHECKLIST.md` for frontend
3. Check `MIGRATION_GUIDE_FILE_STRUCTURE.md` for migration
4. Contact build system maintainer

---

**Last Updated:** 2025-12-11
**Structure Version:** 2.0 (Organized)
