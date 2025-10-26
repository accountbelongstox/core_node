# Auto Context7 MCP Server

Auto fix and run @upstash/context7-mcp service.

## Features

- **Auto Error Detection**: Detect Context7 MCP service errors
- **Auto Fix**: Clear cache, reinstall, fix dependency issues
- **Multi-platform**: Windows (PowerShell) and Linux (Bash) versions
- **Retry Mechanism**: Configurable retry count and delay
- **Silent Operation**: No logging, just check if startup successful

## Files

```
auto-context7-mcp/
├── auto_fix_context7.ps1    # Windows PowerShell script
├── auto_fix_context7.sh     # Linux Bash script
└── README.md               # Documentation
```

## Usage

### Windows

```powershell
# Basic usage
powershell -ExecutionPolicy Bypass -File auto_fix_context7.ps1

# With parameters
powershell -ExecutionPolicy Bypass -File auto_fix_context7.ps1 -MaxRetries 5 -RetryDelay 3 -ForceReinstall
```

### Linux

```bash
# Basic usage
bash auto_fix_context7.sh

# With environment variables
MAX_RETRIES=5 RETRY_DELAY=3 FORCE_REINSTALL=true bash auto_fix_context7.sh
```

## Configuration

| Parameter | Windows | Linux | Default | Description |
|-----------|---------|-------|---------|-------------|
| Max Retries | -MaxRetries | MAX_RETRIES | 3 | Number of retry attempts |
| Retry Delay | -RetryDelay | RETRY_DELAY | 2 | Delay between retries (seconds) |
| Force Reinstall | -ForceReinstall | FORCE_REINSTALL | false | Force reinstall mode |

## MCP Configuration

### Windows Template (mcpWindowsTemplate.json)

```json
"AutoContext7MCP": {
    "command": "powershell",
    "args": [
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "D:/programing/core_node/ncore/mcp_server/auto-context7-mcp/auto_fix_context7.ps1"
    ],
    "env": {
        "MAX_RETRIES": "3",
        "RETRY_DELAY": "2",
        "FORCE_REINSTALL": "false"
    },
    "disabled": false,
    "autoApprove": [],
    "timeout": 120000
}
```

### Linux Template (mcpLinuxTemplate.json)

```json
"AutoContext7MCP": {
    "command": "bash",
    "args": [
        "/www/wwwroot/core_node/ncore/mcp_server/auto-context7-mcp/auto_fix_context7.sh"
    ],
    "env": {
        "MAX_RETRIES": "3",
        "RETRY_DELAY": "2",
        "FORCE_REINSTALL": "false"
    },
    "disabled": false,
    "autoApprove": [],
    "timeout": 120000
}
```

### WSL Template (mcpWSLTemplate.json)

```json
"AutoContext7MCP": {
    "command": "bash",
    "args": [
        "/mnt/d/programing/core_node/ncore/mcp_server/auto-context7-mcp/auto_fix_context7.sh"
    ],
    "env": {
        "MAX_RETRIES": "3",
        "RETRY_DELAY": "2",
        "FORCE_REINSTALL": "false"
    },
    "disabled": false,
    "autoApprove": [],
    "timeout": 120000
}
```

## Workflow

1. **Test**: Check if Context7 MCP service works
2. **Fix**: If test fails, execute fix steps:
   - Clear NPX and NPM cache
   - Reinstall @upstash/context7-mcp@latest
   - Verify installation
3. **Start**: Start the fixed Context7 MCP service
4. **Retry**: If fix fails, wait and retry

## Manual Fix

If auto fix fails, manually execute:

```bash
# Clear cache
npm cache clean --force
rm -rf ~/.npm/_npx

# Reinstall
npx -y @upstash/context7-mcp@latest

# Test run
npx -y @upstash/context7-mcp
```
