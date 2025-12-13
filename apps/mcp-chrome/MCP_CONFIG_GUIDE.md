# Chrome MCP Server - Configuration Guide

> **Note**: This project is based on [hangwin/mcp-chrome](https://github.com/hangwin/mcp-chrome), enhanced with additional features and optimizations.

---

## Quick Setup

This Chrome MCP Server provides two connection methods: **Streamable HTTP** (recommended) and **STDIO** (alternative).

---

## Method 1: Streamable HTTP (Recommended)

### Advantages
- ✅ Easier setup, no path configuration needed
- ✅ Works with Claude Desktop, CherryStudio, and other modern MCP clients
- ✅ Better performance and reliability
- ✅ Supports hot-reload and dynamic updates

### Configuration

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

### Setup Steps

1. **Load the Chrome Extension**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked" and select: `D:\programing\core_node\apps\mcp-chrome\app\chrome-extension`

2. **Start the Service**
   - Click the extension icon in Chrome toolbar
   - Click "Connect" button
   - Service starts on `http://127.0.0.1:12306`

3. **Configure Your MCP Client**

   **For Claude Desktop:**
   - Location: `%APPDATA%\Claude\claude_desktop_config.json`
   - Full path: `C:\Users\[YourUsername]\AppData\Roaming\Claude\claude_desktop_config.json`
   - Add the configuration above to the file

   **For CherryStudio:**
   - Open Settings → MCP Servers
   - Add new server with the configuration above

   **For Other Clients:**
   - Add to your MCP client's configuration file
   - Restart the client to load the new configuration

4. **Verify Connection**
   - Chrome extension shows "Connected" status
   - MCP client recognizes the chrome-mcp-server
   - You can test by asking: "What tabs are currently open in Chrome?"

---

## Method 2: STDIO (Alternative)

### When to Use
- Your MCP client only supports STDIO connection
- You're using Cursor or older MCP clients
- You prefer process-based communication

### Configuration

```json
{
  "mcpServers": {
    "chrome-mcp-stdio": {
      "command": "node",
      "args": [
        "D:\\programing\\core_node\\apps\\mcp-chrome\\app\\native-server\\dist\\mcp\\mcp-server-stdio.js"
      ]
    }
  }
}
```

### Important Notes for Windows Users

1. **Path Format**: Use double backslashes (`\\`) in Windows paths
   - ✅ Correct: `"D:\\programing\\core_node\\apps\\mcp-chrome\\..."`
   - ❌ Wrong: `"D:\programing\core_node\apps\mcp-chrome\..."`

2. **Build First**: Ensure the project is built
   ```bash
   cd D:\programing\core_node\apps\mcp-chrome
   pnpm run build
   ```

3. **Verify File Exists**: Check that the STDIO server file is present
   ```bash
   dir "D:\programing\core_node\apps\mcp-chrome\app\native-server\dist\mcp\mcp-server-stdio.js"
   ```

### Setup Steps

1. **Build the Project** (if not already built)
   ```bash
   cd D:\programing\core_node\apps\mcp-chrome
   pnpm install
   pnpm run build
   ```

2. **Configure Your MCP Client**
   - Add the configuration above to your MCP client config file
   - Make sure to use the exact path with double backslashes

3. **Restart MCP Client**
   - Completely close and reopen your MCP client
   - The chrome-mcp-stdio server should appear in the server list

---

## Configuration Examples for Different Clients

### Claude Desktop (`claude_desktop_config.json`)

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

### Cursor (`.cursor/config.json`)

```json
{
  "mcpServers": {
    "chrome-mcp-stdio": {
      "command": "node",
      "args": [
        "D:\\programing\\core_node\\apps\\mcp-chrome\\app\\native-server\\dist\\mcp\\mcp-server-stdio.js"
      ]
    }
  }
}
```

### CherryStudio (MCP Settings UI)

Use the Streamable HTTP configuration via the settings interface:
- Server Name: `chrome-mcp-server`
- Type: `Streamable HTTP`
- URL: `http://127.0.0.1:12306/mcp`

---

## Troubleshooting

### Streamable HTTP Issues

1. **Connection Refused**
   - Check Chrome extension is loaded and shows "Connected"
   - Verify service is running: `http://127.0.0.1:12306` in browser
   - Check firewall settings

2. **Extension Not Connecting**
   - Reload extension in `chrome://extensions/`
   - Check browser console for errors
   - Try clicking "Connect" button again

### STDIO Issues

1. **File Not Found**
   - Run `pnpm run build` in the project directory
   - Verify the file exists at the specified path
   - Check for build errors in the terminal

2. **Permission Denied**
   - Run your MCP client as administrator
   - Check file permissions on the STDIO server file

3. **Node Version**
   - Ensure Node.js >= 18.19.0 is installed
   - Check version: `node --version`

---

## Features Overview

This Chrome MCP Server provides 20+ tools for browser automation:

- **Browser Management**: Navigate, switch tabs, close tabs, inject scripts
- **Screenshots**: Capture full page or specific elements
- **Network Monitoring**: Capture requests, inspect responses
- **Content Analysis**: Semantic search, extract content, console logs
- **Interaction**: Click elements, fill forms, keyboard input
- **Data Management**: History search, bookmark management

For complete tool documentation, see [TOOLS.md](./README.md#-available-tools)

---

## Quick Reference

| Configuration Type | Recommended For | Key Advantage |
|-------------------|----------------|---------------|
| **Streamable HTTP** | Claude Desktop, CherryStudio | Easy setup, no path config |
| **STDIO** | Cursor, older clients | Process isolation |

**Default Port**: `12306` (Streamable HTTP)

**Extension Location**: `D:\programing\core_node\apps\mcp-chrome\app\chrome-extension`

**STDIO Server**: `D:\programing\core_node\apps\mcp-chrome\app\native-server\dist\mcp\mcp-server-stdio.js`

---

## Getting Help

- Original Project: https://github.com/hangwin/mcp-chrome
- Report Issues: Check project documentation or GitHub issues
- Documentation: See README.md for usage examples and API documentation
