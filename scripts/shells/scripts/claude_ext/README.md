# Claude Code Extension - Auto Setup

Automatically finds Claude installation, beautifies CLI, injects monitoring, and creates extended launcher.

## Quick Start

```powershell
cd "D:\.dev_win11\node\node_modules\@anthropic-ai\claude-code\claude-ext"
.\setup-claude-ext.ps1
```

## What It Does

1. **Finds Claude globally** - Searches common locations for `claude.ps1`
2. **Parses installation** - Extracts `cli.js` path from the script
3. **Beautifies code** - Creates `cli.beautified.js` if not exists
4. **Creates capture library** - Sets up `input-capture.cjs` for logging
5. **Injects monitoring** - Adds hooks to capture submit and change events
6. **Creates launcher** - Generates `claudeMore.ps1` to use extended version

## Architecture

```
claude.ps1 (original)
  └─> cli.js (minified)

claudeMore.ps1 (extended)
  └─> cli.beautified.js (beautified + injected)
       └─> claude-ext/input-capture.cjs
            └─> claude-ext/input-logs/*.log
```

## Injection Points

### Submit Hook
```javascript
// Injected after: if (uA.suggestions.length > 0
try {
  __inputCapture.captureSubmit(x2, { source: "submit" });
} catch(e) {}
```

### Change Hook
```javascript
// Injected after: if (K !== F0)
try {
  __inputCapture.captureChange(F0, { source: "onchange" });
} catch(e) {}
```

## Usage

### Original Claude (unmodified)
```powershell
claude
```

### Extended Claude (with monitoring)
```powershell
claudeMore
```

## Log Files

Logs are saved with unique session IDs:

```
claude-ext/input-logs/input-2025-10-23-14-30-52.log
```

### Log Format

```
============================================================
Session started: 2025-10-23T14:30:52.123Z
============================================================

[2025-10-23T14:30:55.000Z] CHANGE
Input: Hello
Length: 5 characters

[2025-10-23T14:31:00.000Z] SUBMIT
Input: Hello, how are you?
Length: 18 characters
------------------------------------------------------------
```

## Options

```powershell
# Auto setup
.\setup-claude-ext.ps1

# Force re-setup (re-inject, re-create)
.\setup-claude-ext.ps1 -Force

# Show help
.\setup-claude-ext.ps1 -Help
```

## Files Created

- `cli.beautified.js` - Beautified and injected CLI
- `claude-ext/input-capture.cjs` - Input capture library
- `claudeMore.ps1` - Extended launcher
- `cli.beautified.js.backup` - Backup of original beautified file

## Advanced

### Manual Beautification

If you need to manually beautify:

```powershell
npx js-beautify `
    --indent-size 2 `
    --file cli.js `
    --outfile cli.beautified.js
```

### View Logs in Real-Time

```powershell
Get-Content claude-ext\input-logs\*.log -Wait -Tail 20
```

### Restore Original

```powershell
# Just use original launcher
claude

# Or delete extended files
Remove-Item claudeMore.ps1
Remove-Item cli.beautified.js
```

## Troubleshooting

### "claude.ps1 not found"

Make sure Claude Code is installed globally:

```powershell
npm install -g @anthropic-ai/claude-code
```

### "Multiple claude.ps1 found"

The script will prompt you to select which installation to use.

### "Beautification failed"

Install js-beautify:

```powershell
npm install -g js-beautify
```

### "Injection points not found"

This may happen if the CLI code structure has changed. Check the log output for details.

## Version

- Script Version: 1.0.0
- Compatible with: @anthropic-ai/claude-code v2.0.25+

## Notes

- The script is non-invasive - it never modifies `cli.js`
- Original `claude` launcher remains unchanged
- All modifications are in separate files
- Backups are created automatically
- Safe to run multiple times (idempotent)
