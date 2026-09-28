# Chrome MCP Server 🚀
@ ../../development-guides/MCP_CHROME_GUIDE.md

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

```json
{
  "mcpServers": {
    "chrome-mcp-stdio": {
      "command": "npx",
      "args": [
        "node",
        "${project-dir}/apps/mcp-chrome/.output/${relate_dir}/mcp-server-stdio.js"
      ]
    }
  }
}
```
