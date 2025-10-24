# Claude Extension - Complete Usage Guide

## 🚀 Quick Start

### 1. One-Time Setup
```powershell
cd "D:\.dev_win11\node\node_modules\@anthropic-ai\claude-code\claude-ext"
.\setup-claude-ext.ps1
```

### 2. Use Extended Claude
```powershell
# Instead of running: claude
# Run this to use monitored version:
claudeMore

# Or with full path:
D:\.dev_win11\node\claudeMore.ps1
```

### 3. Check Captured Input
```powershell
# Input logs are saved in:
cd "D:\.dev_win11\node\node_modules\@anthropic-ai\claude-code\claude-ext"
ls claude-input-*.json
```

## 📁 File Structure

```
D:\.dev_win11\node\node_modules\@anthropic-ai\claude-code\
├── cli.js                          # Original CLI (unchanged)
├── cli.beautified.js               # Beautified + Injected CLI
└── claude-ext\
    ├── setup-claude-ext.ps1        # Main setup script
    ├── verify-installation.ps1     # Verification script
    ├── input-capture.cjs           # Capture module
    ├── claude-input-*.json         # Captured input logs (created at runtime)
    ├── README.md                   # Quick start guide
    └── USAGE.md                    # This file

D:\.dev_win11\node\
├── claude.ps1                      # Original launcher
└── claudeMore.ps1                  # Extended launcher (uses beautified CLI)
```

## 🔍 How It Works

### 1. **Auto-Discovery**
The setup script automatically:
- Finds `claude` command globally
- Locates `claude.ps1` launcher
- Extracts path to `cli.js`

### 2. **Beautification**
```powershell
# Converts minified cli.js → readable cli.beautified.js
npx js-beautify --indent-size 2 --file cli.js --outfile cli.beautified.js
```

### 3. **Code Injection**
The script injects monitoring code at two key locations:

**Location 1: OnChange Handler** (Line ~386714)
```javascript
if (K !== F0) {
  try { __inputCapture.captureChange(F0, { source: "onchange" }); } catch(e) {}
  K = F0;
  // ... original code
}
```

**Location 2: OnSubmit Handler** (Line ~386761)
```javascript
if (uA.suggestions.length > 0) {
  try { __inputCapture.captureSubmit(x2, { source: "submit" }); } catch(e) {}
  // ... original code
}
```

### 4. **Input Capture Module**
`input-capture.cjs` saves input to JSON files:
```json
{
  "sessionId": "20251023-094618-abc123",
  "events": [
    {
      "type": "change",
      "timestamp": "2025-10-23T09:46:20.123Z",
      "content": "user typing...",
      "metadata": {"source": "onchange"}
    },
    {
      "type": "submit",
      "timestamp": "2025-10-23T09:46:25.456Z",
      "content": "final submitted text",
      "metadata": {"source": "submit"}
    }
  ]
}
```

### 5. **Extended Launcher**
`claudeMore.ps1` runs the modified CLI:
```powershell
# Original:
& "$basedir/node$exe" "$basedir/node_modules/@anthropic-ai/claude-code/cli.js" $args

# Extended:
& "$basedir/node$exe" "$basedir/node_modules/@anthropic-ai/claude-code/cli.beautified.js" $args
```

## 🛠️ Maintenance

### Re-run Setup (if Claude updates)
```powershell
cd "D:\.dev_win11\node\node_modules\@anthropic-ai\claude-code\claude-ext"
.\setup-claude-ext.ps1 -Force
```

### Verify Installation
```powershell
.\verify-installation.ps1
```

### View Captured Logs
```powershell
# Show all session files
ls claude-input-*.json

# Read specific session
cat claude-input-20251023-094618-abc123.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Clean Old Logs
```powershell
# Delete logs older than 7 days
Get-ChildItem claude-input-*.json |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } |
  Remove-Item
```

## 🔧 Troubleshooting

### Issue: "claudeMore not found"
```powershell
# Verify launcher exists
Test-Path "D:\.dev_win11\node\claudeMore.ps1"

# Check PATH includes D:\.dev_win11\node
$env:PATH -split ';' | Select-String "node"
```

### Issue: "No input captured"
```powershell
# Check injection worked
cd "D:\.dev_win11\node\node_modules\@anthropic-ai\claude-code"
grep -n "__inputCapture" cli.beautified.js
```

### Issue: "Claude updated, extension broken"
```powershell
# Re-run setup with force flag
cd claude-ext
.\setup-claude-ext.ps1 -Force
```

## 📊 Advanced Usage

### Custom Capture Location
Edit `input-capture.cjs` line 4:
```javascript
const LOG_DIR = path.join(__dirname); // Change this path
```

### Disable Specific Events
Edit injection points in `cli.beautified.js`:
```javascript
// Comment out to disable onChange capture:
// try { __inputCapture.captureChange(F0, { source: "onchange" }); } catch(e) {}

// Comment out to disable onSubmit capture:
// try { __inputCapture.captureSubmit(x2, { source: "submit" }); } catch(e) {}
```

### Export Captured Data
```powershell
# Merge all session logs into one file
$allData = @()
Get-ChildItem claude-input-*.json | ForEach-Object {
  $data = Get-Content $_ | ConvertFrom-Json
  $allData += $data
}
$allData | ConvertTo-Json -Depth 10 | Out-File "all-sessions.json"
```

## 🎯 Use Cases

1. **Debugging**: Track what users type before submitting
2. **Analytics**: Understand user input patterns
3. **Recovery**: Restore lost work from session logs
4. **Testing**: Replay user interactions for QA
5. **Audit**: Log all commands for compliance

## ⚠️ Privacy Notice

The extension captures ALL user input to Claude. Ensure:
- Users are aware input is logged
- Log files are stored securely
- Sensitive data is handled appropriately
- Compliance with data protection regulations

## 📝 License

This extension is for educational and development purposes. Use responsibly.

---

**Created**: 2025-10-23
**Version**: 1.0.0
**Author**: Auto-generated by Claude Extension Setup
