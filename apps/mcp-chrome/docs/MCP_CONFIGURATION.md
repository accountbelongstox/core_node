# MCP Client Configuration Guide

This guide explains how to configure various MCP clients (Claude Desktop, Cursor, CherryStudio, etc.) to connect to Chrome MCP Server.

## 📋 Prerequisites

Before configuring MCP clients, ensure:

1. ✅ Chrome MCP Server is built (`.\scripts\start.ps1` or `./scripts/start.sh`)
2. ✅ Chrome extension is loaded in browser
3. ✅ Extension is connected (click "Connect" in extension popup)
4. ✅ HTTP server is running on `http://127.0.0.1:12306`

## 🔌 Connection Methods

Chrome MCP Server supports **two connection methods**:

### Method 1: Streamable HTTP (Recommended) ⭐

**Best for:** Claude Desktop, CherryStudio, and modern MCP clients

**Advantages:**
- Direct HTTP connection
- Better performance
- Easier to debug
- Native MCP protocol support

**Configuration:**
```json
{
  "mcpServers": {
    "chrome-mcp-server": {
      "type": "streamableHttp",
      "url": "http://127.0.0.1:12306/mcp"
    }
  }
}
```

### Method 2: STDIO (Alternative)

**Best for:** Cursor, older MCP clients, or when HTTP is not supported

**How it works:**
- STDIO server acts as a proxy
- Connects to HTTP server internally
- Translates STDIO ↔ HTTP requests

**Important Files:**
- **Server:** `app/native-server/dist/mcp/mcp-server-stdio.js`
- **Config:** `app/native-server/dist/mcp/stdio-config.json`

**Configuration:**
```json
{
  "mcpServers": {
    "chrome-mcp-server": {
      "command": "node",
      "args": ["D:/programing/core_node/apps/mcp-chrome/app/native-server/dist/mcp/mcp-server-stdio.js"]
    }
  }
}
```

**⚠️ Important:** Replace the path with your actual absolute path to `mcp-server-stdio.js`

## 📱 Client-Specific Configuration

### Claude Desktop

**Config File Location:**
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

**Recommended Configuration:**
```json
{
  "mcpServers": {
    "chrome-mcp-server": {
      "type": "streamableHttp",
      "url": "http://127.0.0.1:12306/mcp"
    }
  }
}
```

**Steps:**
1. Close Claude Desktop completely
2. Edit `claude_desktop_config.json`
3. Add the configuration above
4. Save and restart Claude Desktop
5. Verify connection in Claude Desktop's MCP panel

### Cursor

**Config File Location:**
- **Windows:** `%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
- **macOS:** `~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Linux:** `~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

**Recommended Configuration (STDIO):**
```json
{
  "mcpServers": {
    "chrome-mcp-server": {
      "command": "node",
      "args": ["D:/programing/core_node/apps/mcp-chrome/app/native-server/dist/mcp/mcp-server-stdio.js"]
    }
  }
}
```

**Alternative (HTTP, if supported):**
```json
{
  "mcpServers": {
    "chrome-mcp-server": {
      "type": "streamableHttp",
      "url": "http://127.0.0.1:12306/mcp"
    }
  }
}
```

### CherryStudio

**Config File Location:**
- Check CherryStudio settings UI or documentation

**Recommended Configuration:**
```json
{
  "mcpServers": {
    "chrome-mcp-server": {
      "type": "streamableHttp",
      "url": "http://127.0.0.1:12306/mcp"
    }
  }
}
```

## 🏗️ Architecture Overview

### Streamable HTTP Architecture
```
┌─────────────────┐
│  MCP Client     │
│ (Claude/Cherry) │
└────────┬────────┘
         │ HTTP/SSE
         ↓
┌─────────────────────────┐
│  Fastify HTTP Server    │
│  http://127.0.0.1:12306 │
└────────┬────────────────┘
         │ Native Messaging
         ↓
┌─────────────────────┐
│ Chrome Extension    │
│ (Background Script) │
└────────┬────────────┘
         │ Chrome APIs
         ↓
┌─────────────────┐
│ Browser Tabs    │
│ & Web Content   │
└─────────────────┘
```

### STDIO Architecture
```
┌─────────────────┐
│  MCP Client     │
│    (Cursor)     │
└────────┬────────┘
         │ STDIO
         ↓
┌─────────────────────────┐
│  STDIO MCP Server       │
│  (mcp-server-stdio.js)  │
└────────┬────────────────┘
         │ HTTP (internal)
         ↓
┌─────────────────────────┐
│  Fastify HTTP Server    │
│  http://127.0.0.1:12306 │
└────────┬────────────────┘
         │ Native Messaging
         ↓
┌─────────────────────┐
│ Chrome Extension    │
└─────────────────────┘
```

## 🔧 Configuration Files

### 1. STDIO Config (`stdio-config.json`)

**Location:** `app/native-server/dist/mcp/stdio-config.json`

**Content:**
```json
{
  "url": "http://127.0.0.1:12306/mcp"
}
```

**Purpose:** Tells STDIO server where to connect internally

### 2. Native Messaging Manifest

**Location (Windows):**
```
%APPDATA%\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost.json
```

**Location (macOS):**
```
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.chromemcp.nativehost.json
```

**Location (Linux):**
```
~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json
```

**Content Example:**
```json
{
  "name": "com.chromemcp.nativehost",
  "description": "Node.js Host for Browser Bridge Extension",
  "path": "D:\\programing\\core_node\\apps\\mcp-chrome\\app\\native-server\\dist\\run_host.bat",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://hbdgbgagpkpjffpklnamcljpakneikee/"
  ]
}
```

## 🛠️ Available Tools

Once connected, your MCP client will have access to 20+ browser automation tools:

### Browser Management
- `get_windows_and_tabs` - List all windows and tabs
- `chrome_navigate` - Navigate to URLs
- `chrome_switch_tab` - Switch active tab
- `chrome_close_tabs` - Close tabs/windows
- `chrome_go_back_or_forward` - Browser navigation

### Content & Analysis
- `search_tabs_content` - AI semantic search across tabs
- `chrome_get_web_content` - Extract page content
- `chrome_get_interactive_elements` - Find clickable elements
- `chrome_console` - Capture console output

### Interaction
- `chrome_click_element` - Click elements
- `chrome_fill_or_select` - Fill forms
- `chrome_keyboard` - Keyboard input

### Network & Screenshots
- `chrome_screenshot` - Capture screenshots
- `chrome_network_capture_start/stop` - Monitor network
- `chrome_network_request` - Send HTTP requests

### Data Management
- `chrome_history` - Search browser history
- `chrome_bookmark_search/add/delete` - Manage bookmarks

**Full API Reference:** See [TOOLS.md](../docs/TOOLS.md)

## 🐛 Troubleshooting

### Connection Failed

**Check these in order:**

1. **Is Chrome extension loaded?**
   - Go to `chrome://extensions/`
   - Verify extension is enabled

2. **Is extension connected?**
   - Click extension icon
   - Should show "Connected" status
   - If not, click "Connect" button

3. **Is HTTP server running?**
   - Test: `curl http://127.0.0.1:12306/ask-extension`
   - Should return JSON (not error)

4. **Check Native Messaging Host registration:**
   ```powershell
   # Windows
   Get-Content "$env:APPDATA\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost.json"

   # macOS/Linux
   cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.chromemcp.nativehost.json
   ```

### STDIO Server Not Working

1. **Verify STDIO server exists:**
   ```bash
   node app/native-server/dist/mcp/mcp-server-stdio.js
   # Should not error immediately
   ```

2. **Check stdio-config.json:**
   ```bash
   cat app/native-server/dist/mcp/stdio-config.json
   # Should show: {"url": "http://127.0.0.1:12306/mcp"}
   ```

3. **Test HTTP endpoint manually:**
   ```bash
   curl http://127.0.0.1:12306/mcp
   ```

### Port Already in Use

If port 12306 is occupied:

1. **Find the process:**
   ```powershell
   # Windows
   netstat -ano | findstr :12306

   # macOS/Linux
   lsof -i :12306
   ```

2. **Change port (advanced):**
   - Modify `app/native-server/src/constant/index.ts`
   - Update `NATIVE_SERVER_PORT`
   - Rebuild: `pnpm run build:native`
   - Update `stdio-config.json` with new port

## 📚 Additional Resources

- [Main README](../README.md) - Project overview
- [Architecture Documentation](../docs/ARCHITECTURE.md) - Technical details
- [Tools API Reference](../docs/TOOLS.md) - All available tools
- [Troubleshooting Guide](../docs/TROUBLESHOOTING.md) - Common issues

## 🔄 Development Mode

When actively developing, use:

```bash
# Terminal 1: Watch native server
pnpm run dev:native

# Terminal 2: Watch extension
pnpm run dev:extension
```

MCP clients will auto-reconnect when server restarts.

---

**Need Help?** Check [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md) or open an issue on GitHub.
