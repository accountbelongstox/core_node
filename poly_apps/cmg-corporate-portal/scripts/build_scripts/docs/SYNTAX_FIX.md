# Syntax Fix: PowerShell and Bash Documentation Strings

## Issue

**Error Message:**
```
param : The term 'param' is not recognized as the name of a cmdlet, function, script file...
At execute_commands_windows_new.ps1:112 char:5
+     param(
+     ~~~~~
```

## Root Cause

Used Python-style documentation strings `"""..."""` in PowerShell and Bash functions:

```powershell
# ❌ WRONG - Python syntax
function Get-VarValue {
    """Read a variable value from file"""  # ← PowerShell doesn't support this!
    param(
        [string]$Key,
        [string]$Prefix
    )
}
```

In PowerShell, the `param()` block must be the **first statement** in the function body. Comments must use `#` or `<# #>` syntax.

## Fix Applied

Changed all `"""..."""` documentation strings to proper shell comments:

```powershell
# ✅ CORRECT - PowerShell syntax
function Get-VarValue {
    # Read a variable value from file
    param(
        [string]$Key,
        [string]$Prefix
    )
}
```

```bash
# ✅ CORRECT - Bash syntax
get_var_value() {
    # Read a variable value from file
    local key="$1"
}
```

## Files Fixed

### Windows: `execute_commands_windows_new.ps1`
- ✅ `Find-AppPrefix` - Line 83
- ✅ `Get-VarValue` - Line 111
- ✅ `Get-VarAsList` - Line 133
- ✅ `Get-CommandCount` - Line 151
- ✅ `Get-Command` - Line 168
- ✅ `Print-Command` - Line 196

### Linux: `execute_commands_linux_new.sh`
- ✅ `get_var_value` - Line 116
- ✅ `get_var_as_list` - Line 129
- ✅ `get_command_count` - Line 142
- ✅ `get_command` - Line 154
- ✅ `print_command` - Line 186

## Total Fixes: 11 functions

---

## Status: ✅ FIXED

The build system should now run without syntax errors.

**Test command:**
```powershell
cd poly_apps\cmg-corporate-portal\scripts
.\start.ps1
```

Expected: No more `param` errors!
