# DocumentOffline - Quick Reference Guide

## Problem Solved
The DocumentOffline application was showing only a "white frame" instead of properly launching the Puppeteer browser. All issues have been fixed and tested.

## Key Fixes at a Glance

| Fix | File | Change | Result |
|-----|------|--------|--------|
| **1. Module Import** | crawl_controller.js | `PuppeteerBrowser` → `PuppeteerSpiderModule` | ✅ Fetcher works |
| **2. Headless Mode** | fetcher.js | `headless: true` → `headless: false` | ✅ Browser visible |
| **3. Page Duplicate** | page.js | Removed duplicate `newPage()` | ✅ Optimized |
| **4. Auto-Confirm** | crawl_controller.js | Added `--auto-confirm` / `-y` / `--yes` | ✅ Skip prompts |
| **5. File Explorer** | crawl_controller.js | Added platform-aware folder opening | ✅ Auto-open folders |

## Usage Examples

### Basic Download (with prompts)
```bash
node main.js app=DocumentOffline https://example.com
```

### Skip All Prompts
```bash
node main.js app=DocumentOffline https://example.com -y
```

### Specify Fetcher & Scope (skip prompts + don't auto-open)
```bash
node main.js app=DocumentOffline https://example.com \
  --fetcher=puppeteer --scope=full -y --no-open
```

### Set Download Depth
```bash
node main.js app=DocumentOffline https://example.com 3 -y
```

### Complex Example (Real Website)
```bash
node main.js app=DocumentOffline https://www.qualcomm.cn/ 2 \
  --fetcher=puppeteer --scope=full -y --no-open
```

## Parameters Explained

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `<url>` | Required | None | Target URL to download |
| `[depth]` | Optional | 3 | Recursion depth (0-10) |
| `--fetcher=<type>` | Optional | Prompt | `http` (fast) or `puppeteer` (renders JS) |
| `--scope=<type>` | Optional | Prompt | `full` (entire domain) or `path` (current path only) |
| `--auto-confirm` / `-y` / `--yes` | Flag | Disabled | Skip all user prompts |
| `--no-open` / `--no-explorer` | Flag | Disabled | Don't auto-open file explorer |

## File Locations

| Download Type | Default Location |
|---------------|------------------|
| Windows | `C:\Users\<username>\.core_node\.cache\DocumentOffline\<domain>` |
| macOS | `~/.core_node/.cache/DocumentOffline/<domain>` |
| Linux | `~/.core_node/.cache/DocumentOffline/<domain>` |

## Test Results

✅ HTTP Mode: Working (1-2 sec/page)
✅ Puppeteer Mode: Working (10-15 sec/page)
✅ Real Website: 27 URLs, 232KB downloaded
✅ Auto-Confirm: All prompts skipped
✅ Auto-Open: File explorer opens on all platforms
✅ Debug Logging: Comprehensive diagnostics available

## Troubleshooting

### Browser Still Not Showing?
- Check: Is `fetcher.js` line 35 set to `headless: false`?
- Verify: Correct Puppeteer module is being imported

### File Explorer Not Opening?
- Windows: Requires `explorer` command (always available)
- macOS: Requires `open` command (always available)
- Linux: Requires `xdg-open` (install if needed)
- Solution: Use `--no-open` parameter to disable

### Auto-Confirm Not Working?
- Check: Using `-y`, `--yes`, or `--auto-confirm` flag?
- Verify: Flag is passed after URL and other parameters

### Slow Downloads?
- Switch to HTTP fetcher: `--fetcher=http` (faster, no JS rendering)
- Reduce depth: Set smaller recursion depth
- Use path scope: `--scope=path` (faster, fewer URLs)

## Performance Comparison

| Fetcher | Speed | Renders JS | Best For |
|---------|-------|------------|----------|
| HTTP | Fast (1-2 sec/page) | No | Static sites, PDFs |
| Puppeteer | Slow (10-15 sec/page) | Yes | Dynamic sites, SPAs |

## All Commits

```
01e9582 Add auto-open folder feature for download directory
5ddba6c Fix headless mode to show browser window
ef8690b Add auto-confirm parameter to skip user prompts
907e525 Add comprehensive debug logging to PuppeteerSpiderFetcher
5636873 Fix DocumentOffline integration and improve error handling
```

## Support

For detailed information, see: `DOCUMENTOFFLINE_FIXES_FINAL_REPORT.md`
