=================================================================================
Claude Code Tools - Upgrade and MCP Configuration Sync
=================================================================================

Purpose:
--------
This toolset provides automated upgrade and MCP (Model Context Protocol) server
configuration synchronization for Claude Code.

Files:
------
1. sync_mcp_servers.py      - Main Python script for MCP config synchronization
2. sync_claude_mcp.bat      - Batch wrapper for MCP sync (deprecated, use mcp_sync_only.bat)
3. sync_claude_mcp.ps1      - PowerShell wrapper for MCP sync (for manual use)
4. upgrade_claude_code.bat  - Standalone Claude Code upgrade script (separate window)
5. mcp_sync_only.bat        - Standalone MCP sync script (separate window)
6. sync_and_upgrade.bat     - Launcher script that opens both windows
7. README.txt               - This file

Usage:
------
1. Upgrade + MCP Sync (Recommended - opens 2 windows):
   Double-click: sync_and_upgrade.bat
   This launches both upgrade and MCP sync in separate windows

2. MCP Sync Only (opens new window):
   Double-click: mcp_sync_only.bat
   Or manually: python sync_mcp_servers.py

3. Upgrade Only (opens new window):
   Double-click: upgrade_claude_code.bat

4. Automatic execution (RECOMMENDED):
   When you run a Claude command created through dd.ps1:

   Step 1: Prompt for upgrade
   - Asks: "Do you want to upgrade Claude Code? (y/N): "
   - If you press 'y': Opens upgrade in a SEPARATE WINDOW
   - If you press 'N' or Enter: Skips upgrade

   Step 2: MCP Sync (runs in main thread)
   - Automatically syncs MCP configurations
   - Runs directly in the current window
   - Shows real-time progress

   Step 3: Start Claude Code
   - Prompts: "Press Enter to continue..."
   - Starts Claude Code after you press Enter

What it does:
-------------
1. Reads MCP server configurations from:
   D:\programing\core_node\.prompt\mcpWindowsTemplate.json

2. Scans your user configuration:
   C:\Users\{YOUR_USERNAME}\.claude.json

3. Recursively finds all 'mcpServers' objects in your config

4. Adds any missing MCP servers from the template

5. Creates a backup before making changes

6. Preserves your existing MCP server configurations

MCP Servers in Template:
------------------------
- promptx                    - PromptX MCP server
- context7-mcp               - Upstash Context7 documentation
- McpAlchemy                 - Database operations MCP
- FeedbackEnhanced           - Enhanced feedback system
- PlaceholderImageGenerator  - Image placeholder generation
- DocumentParser             - Document parsing and conversion
- CodebaseScanner            - Codebase analysis and scanning

Notes:
------
- Always creates a backup with timestamp before updating
- Only adds missing servers, never overwrites existing ones
- Requires Python 3.6 or higher
- After sync, restart Claude Code to apply changes
- Upgrade runs in separate window using 'start' command (non-blocking)
- npm upgrade warnings are normal if Claude Code is running
- The separate window prevents npm from interrupting your main session

Troubleshooting:
----------------
If the script fails:
1. Check Python is installed: python --version
2. Check file permissions on C:\Users\{USERNAME}\.claude.json
3. Verify template exists: D:\programing\core_node\.prompt\mcpWindowsTemplate.json
4. Check Python script output for detailed error messages

Manual execution:
-----------------
Upgrade + Sync (runs in new window):
  start "" "D:\programing\core_node\scripts\pytools\claude_tools\sync_and_upgrade.bat"

MCP Sync only:
  python "D:\programing\core_node\scripts\pytools\claude_tools\sync_mcp_servers.py"

Upgrade only (runs in new window):
  start "" "D:\programing\core_node\scripts\pytools\claude_tools\upgrade_claude_code.bat"

Why this design?
----------------
1. Upgrade in Separate Window:
   When npm upgrades @anthropic-ai/claude-code, it may cause the current cmd
   window to exit unexpectedly due to file locking. Running in a separate window
   prevents this from interrupting your session.

   User control: You choose whether to upgrade by pressing 'y'

2. MCP Sync in Main Thread:
   MCP sync is safe to run in the main thread and completes quickly (1-2 seconds).
   You can see the real-time progress and results directly.

3. User Confirmation Before Launch:
   The "Press Enter to continue" prompt gives you a chance to:
   - Review the MCP sync results
   - Check if upgrade window opened correctly
   - Start Claude Code when you're ready

Execution Flow:
---------------
Main Window (claude1.bat)
    |
    +-- Set environment variables (ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN)
    |
    +-- Prompt: "Do you want to upgrade Claude Code? (y/N): "
    |       |
    |       +-- If 'y': start "Claude Code Upgrade" upgrade_claude_code.bat
    |       |              |
    |       |              +-- npm install -g @anthropic-ai/claude-code (separate window)
    |       |
    |       +-- If 'N' or Enter: Skip upgrade
    |
    +-- Run: python sync_mcp_servers.py (in main thread)
    |       |
    |       +-- Shows real-time sync progress
    |       +-- Displays results
    |
    +-- Prompt: "Press Enter to continue..."
    |
    +-- Start: claude (after user presses Enter)

=================================================================================
Last Updated: 2025-10-18
=================================================================================
