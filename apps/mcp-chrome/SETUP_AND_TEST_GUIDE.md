# Chrome MCP Server - Complete Setup & Testing Guide

## 📋 Current Status

✅ Build completed successfully
✅ Chrome Extension built → `/www/programing/_build_dir/chrome-mv3`
✅ Native Server built → `app/native-server/dist/`
⚠️  Need to verify native messaging connection

## 🔧 Step-by-Step Testing

### Step 1: Verify Native Host Registration

Check if the native host is registered with Chrome:

```bash
# Check Chrome's native messaging host manifest location
cat ~/.config/google-chrome/NativeMessagingHosts/com.chrome.mcp.bridge.json
# or for Chromium:
cat ~/.config/chromium/NativeMessagingHosts/com.chrome.mcp.bridge.json
```

Expected output:
```json
{
  "name": "com.chrome.mcp.bridge",
  "description": "Chrome MCP Bridge Native Messaging Host",
  "path": "/path/to/dist/run_host.sh",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://..."
  ]
}
```

### Step 2: Manual Server Start (For Testing)

While the extension should start the server automatically, you can test manually:

```bash
cd /www/programing/core_node/apps/mcp-chrome/app/native-server

# Test 1: Check if dist files exist
ls -la dist/

# Test 2: Start native host manually (will wait for extension messages)
node dist/index.js
# This will log: "Native Messaging Host started, waiting for messages from Chrome Extension"
# Leave this running and proceed to Step 3 in another terminal
```

### Step 3: Test Chrome Extension Connection

1. **Open Chrome** and go to `chrome://extensions/`
2. **Enable Developer Mode** (toggle in top-right)
3. **Load the extension**:
   - Click "Load unpacked"
   - Select `/www/programing/_build_dir/chrome-mv3`
4. **Click the extension icon** in the toolbar
5. **Check the popup** - you should see:
   - Connection status
   - Port number (12306)
   - MCP server stats

### Step 4: View Extension Logs

**In Chrome:**
1. Right-click the extension icon → "Inspect popup"
2. Open Console tab to see logs
3. Look for:
   ```
   Server started successfully on port 12306
   MCP endpoint: http://127.0.0.1:12306/mcp
   ```

**In Terminal (where you ran `node dist/index.js`):**
Look for:
```
[INFO] Native Messaging Host started
[INFO] START message received, port: 12306
[INFO] Starting Fastify HTTP server on port 12306...
[SUCCESS] Fastify HTTP server started successfully on port 12306
```

### Step 5: Test MCP Server HTTP Endpoint

Once the server is running:

```bash
# Test 1: Check if port is listening
lsof -i :12306
# Should show: node process listening on port 12306

# Test 2: Test MCP endpoint
curl -X POST http://127.0.0.1:12306/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

Expected response:
```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"ChromeMcpServer","version":"1.0.0"}}}
```

## 🧪 Advanced Testing with MCP Inspector

MCP Inspector provides a UI to test all tools:

```bash
# Install MCP Inspector globally
npm install -g @modelcontextprotocol/inspector

# Connect to the server via streamable HTTP
# (Server must be running first - see Step 3)
```

Then configure MCP Inspector to connect to:
- Type: `streamableHttp`
- URL: `http://127.0.0.1:12306/mcp`

## 🔌 Integrate with Claude Desktop

Add to `~/.config/Claude/claude_desktop_config.json`:

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

Then:
1. Make sure Chrome is running with the extension loaded
2. Make sure the MCP server started (check extension popup)
3. Restart Claude Desktop
4. You should see "chrome-mcp-server" in the MCP servers list

## 🐛 Troubleshooting

### Problem: "Could not establish connection. Receiving end does not exist"

**Cause**: Native messaging host not registered or extension can't find it

**Solution**:
```bash
cd /www/programing/core_node/apps/mcp-chrome/app/native-server
node dist/cli.js register --force
```

### Problem: Port 12306 not listening

**Cause**: Native host didn't receive START message from extension

**Solution**:
1. Check extension logs (Inspect popup → Console)
2. Manually start native host: `node dist/index.js`
3. Click extension icon to trigger START message
4. Check terminal for server start logs

### Problem: "Another instance is already running"

**Cause**: Previous server instance didn't shutdown cleanly

**Solution**:
```bash
# Find and kill the process
lsof -ti :12306 | xargs kill -9

# Or restart Chrome completely
```

## ✨ Quick Test Checklist

- [ ] Native host manifest exists at `~/.config/google-chrome/NativeMessagingHosts/com.chrome.mcp.bridge.json`
- [ ] Extension loaded in Chrome at `chrome://extensions/`
- [ ] Extension icon shows in toolbar
- [ ] Clicking extension icon shows popup with connection status
- [ ] Port 12306 is listening (`lsof -i :12306`)
- [ ] HTTP endpoint responds to curl test
- [ ] Extension console shows no errors
- [ ] Native host logs show server started

## 📚 Available MCP Tools (38 total)

Once connected, you'll have access to:

**Browser Control** (13 tools):
- `get_windows_and_tabs` - List all browser windows/tabs
- `chrome_navigate` - Navigate to URL
- `chrome_switch_tab` - Switch active tab
- `chrome_close_tabs` - Close tabs/windows
- `chrome_go_back_or_forward` - History navigation
- `chrome_screenshot` - Take screenshots
- `chrome_click_element` - Click elements by selector
- `chrome_fill_or_select` - Fill forms
- `chrome_keyboard` - Keyboard input
- `chrome_inject_script` - Inject JavaScript
- `chrome_get_interactive_elements` - Find clickable elements
- `chrome_get_web_content` - Extract page content
- `chrome_console` - Capture console logs

**Network** (5 tools):
- `chrome_network_capture_start/stop` - Monitor network requests
- `chrome_network_debugger_start/stop` - Detailed network capture
- `chrome_network_request` - Custom HTTP requests

**Data Management** (4 tools):
- `chrome_history` - Search browsing history
- `chrome_bookmark_search/add/delete` - Bookmark management

**AI Features** (6 tools):
- `search_tabs_content` - Semantic search across tabs
- `chrome_bing_dictionary` - Translation
- `deepseek_send_prompt` - DeepSeek AI integration
- `deepseek_get_result/status/list/cancel` - Task management

**Audio** (4 tools):
- `chrome_audio_start/stop/status/duration` - Audio capture

**File Operations** (1 tool):
- `chrome_file_upload` - File uploads

## 🎯 Next Steps

1. Follow Steps 1-5 above to verify the complete setup
2. Test a few basic tools via curl or MCP Inspector
3. Integrate with Claude Desktop for AI-powered browser control
4. Browse some websites to populate the semantic search index
5. Try asking Claude to search your tabs or automate browser tasks!
