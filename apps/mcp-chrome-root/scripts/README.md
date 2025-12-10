# Chrome MCP Server - Startup Scripts

This directory contains startup scripts for quickly setting up and running the Chrome MCP Server project locally.

## 📋 Prerequisites

- **Node.js** >= 18.19.0
- **pnpm** (will be installed automatically if not present)
- **Chrome/Chromium** browser

## 🚀 Quick Start

### Windows

Run the PowerShell script:

```powershell
.\scripts\start.ps1
```

### Linux / macOS

Run the shell script:

```bash
chmod +x ./scripts/start.sh
./scripts/start.sh
```

## 📝 What the Scripts Do

The startup scripts perform the following steps automatically:

1. **Check Dependencies** - Verify Node.js and pnpm are installed
2. **Build Native Server First** - Build the native-server early to fix postinstall dependency issues
3. **Install Dependencies** - Run `pnpm install` for all packages
4. **Build All Components** - Build shared package, native-server, and chrome-extension
5. **Register Native Messaging Host** - Register the local native messaging host with Chrome

## 📂 Build Order

The scripts follow this specific build order to avoid dependency issues:

```
1. packages/shared (built first, with --ignore-scripts)
2. app/native-server (built second, with --ignore-scripts)
3. pnpm install (runs postinstall scripts now that dist exists)
4. Full rebuild of all components
```

This order ensures that the `postinstall` script in `native-server` can find the required `dist/scripts/postinstall.js` file.

## 🎯 After Running the Script

The script will display important file locations and configuration examples. Here's what you need to do next:

### Important Files Created

After successful build, you'll see paths to:

1. **Chrome Extension (built):** `app/chrome-extension/.output/chrome-mv3`
2. **Native Messaging Host:** `app/native-server/dist`
3. **MCP STDIO Server:** `app/native-server/dist/mcp/mcp-server-stdio.js`
4. **MCP STDIO Config:** `app/native-server/dist/mcp/stdio-config.json`
5. **Native Host Manifest:** (Platform-specific location shown in output)

### Setup Steps

#### 1. Load Chrome Extension

1. Open Chrome browser: `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select: `app/chrome-extension/.output/chrome-mv3`

#### 2. Start MCP Service

1. Click the Chrome extension icon
2. Click "Connect" button to connect to Native Host
3. Service will start on: `http://127.0.0.1:12306`

#### 3. Configure MCP Client

**Two connection methods available:**

##### Method 1: Streamable HTTP (Recommended) ⭐

Best for: Claude Desktop, CherryStudio, modern MCP clients

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

##### Method 2: STDIO (Alternative)

Best for: Cursor, older MCP clients

```json
{
  "mcpServers": {
    "chrome-mcp-server": {
      "command": "node",
      "args": ["<ABSOLUTE_PATH_TO>/mcp-server-stdio.js"]
    }
  }
}
```

**Note:** The script output shows the exact path for your system.

**For detailed client-specific configuration**, see [MCP_CONFIGURATION.md](../docs/MCP_CONFIGURATION.md)

## 🛠️ Development Mode

For active development, use these commands:

```bash
# Start all components in watch mode
pnpm run dev

# Start only Native Server in watch mode
pnpm run dev:native

# Start only Extension in watch mode
pnpm run dev:extension
```

## ❗ Troubleshooting

### Script Fails on postinstall

If you see errors related to `postinstall.js` not found:

1. The startup scripts handle this automatically by building native-server first
2. If issues persist, manually run:
   ```bash
   cd app/native-server
   pnpm install --ignore-scripts
   pnpm run build
   cd ../..
   pnpm install
   ```

### Native Messaging Host Registration Fails

If registration fails:

1. **Windows**: Try running PowerShell as Administrator
2. **Linux/macOS**: Check file permissions with `chmod +x`
3. Manually register:
   ```bash
   cd app/native-server
   node dist/cli.js register
   ```

### Extension Not Loading

1. Make sure the extension is built: check `app/chrome-extension/.output/chrome-mv3` exists
2. Rebuild extension: `pnpm run build:extension`
3. Check Chrome developer console for errors

## 📚 Documentation

- [Main README](../README.md)
- [Architecture Documentation](../docs/ARCHITECTURE.md)
- [Tools API Reference](../docs/TOOLS.md)
- [Troubleshooting Guide](../docs/TROUBLESHOOTING.md)

## 🔄 Manual Build Commands

If you prefer to build manually:

```bash
# Build shared package
pnpm run build:shared

# Build native server
pnpm run build:native

# Build chrome extension
pnpm run build:extension

# Build everything
pnpm run build
```

## 📦 Project Structure

```
apps/mcp-chrome/
├── app/
│   ├── chrome-extension/     # Chrome extension code
│   │   └── .output/          # Built extension (after build)
│   └── native-server/        # Native messaging host
│       └── dist/             # Built server (after build)
├── packages/
│   ├── shared/               # Shared types and utilities
│   └── wasm-simd/            # WebAssembly SIMD optimizations
└── scripts/
    ├── start.ps1             # Windows startup script
    ├── start.sh              # Linux/macOS startup script
    └── README.md             # This file
```

## 🤝 Contributing

For development workflow and contribution guidelines, see [CONTRIBUTING.md](../docs/CONTRIBUTING.md).
