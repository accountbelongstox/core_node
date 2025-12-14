# Quick Reference Card - Variable KEY System

## 🎯 Core Concept

**All variables managed through centralized KEY system with `mcpchrome_` prefix**

## 📁 Key Files

| File | What It Does |
|------|--------------|
| `build_vars.py` | ⭐ **EDIT THIS** to add new variables |
| `generate_var_keys.py` | **RUN THIS** after editing build_vars.py |
| `VarKeys.ps1` | 🔄 Auto-generated (PowerShell) |
| `var_keys.sh` | 🔄 Auto-generated (Bash) |

## 🔨 Common Tasks

### Run Build

```powershell
# Windows
.\scripts\start.ps1
```

```bash
# Linux/macOS
./scripts/start.sh
```

### Add New Variable

1. Edit `build_vars.py`:
```python
MY_VAR = f"{PREFIX}my_var"
```

2. Regenerate:
```bash
python scripts/generate_var_keys.py
```

### Use Variable

```python
# Python
from build_vars import BuildVars
vm.set(BuildVars.MY_VAR, "value")
```

```powershell
# PowerShell
Set-Var -Key ([VarKeys]::MY_VAR) -Value "value"
$val = Get-Var -Key ([VarKeys]::MY_VAR)
```

```bash
# Bash
set_var "$VAR_KEY_MY_VAR" "value"
val=$(get_var "$VAR_KEY_MY_VAR")
```

## 📍 Variable Storage

```
Windows:  C:\Users\<user>\.core_node\.build_global_vars\
Linux:    /var/_core_node/_build_global_vars/
macOS:    ~/.core_node/.build_global_vars/
```

## 🐛 Debug

```powershell
# View all variables (PowerShell)
Import-Module .\scripts\VarManager.ps1
Get-AllVars

# Clear all (PowerShell)
Clear-AllVars
```

```bash
# View all variables (Bash)
source ./scripts/var_manager.sh
list_all_vars

# Clear all (Bash)
clear_all_vars
```

## ✅ Rules

1. ✅ **DO** use KEY constants
2. ✅ **DO** regenerate after editing build_vars.py
3. ✅ **DO** prefix all keys with `mcpchrome_`
4. ❌ **DON'T** hardcode variable names
5. ❌ **DON'T** manually edit VarKeys.ps1 or var_keys.sh

## 📖 Documentation

- **START HERE**: `BUILD_SYSTEM_KEYS.md` - Complete guide
- **SUMMARY**: `COMPLETION_SUMMARY.md` - What was built
- **ARCHITECTURE**: `BUILD_SYSTEM.md` - How it works

## 🔑 Sample Variables

```python
BuildVars.PROJECT_ROOT      # Project root path
BuildVars.PLATFORM          # windows/linux/darwin
BuildVars.EXTENSION_PATH    # Chrome extension path
BuildVars.CMD_BUILD_SHARED  # Build shared command
BuildVars.ERROR             # Error message
```

---

**Need help?** Read `BUILD_SYSTEM_KEYS.md`
