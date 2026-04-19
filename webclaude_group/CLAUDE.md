# CLAUDE.md - Project Rules for Claude Code

## Development Workflow
- Development happens LOCALLY (Windows or Linux)
- Code syncs to REMOTE servers via sync software (rsync, syncthing, etc.)
- Website, gateway, center_server, host may run on DIFFERENT remote servers
- All remote servers run Debian/Ubuntu Linux
- Debug info comes from REMOTE logs, not local paths
- Local environment is reference only

## Architecture
- webclaude_center_server (Node.js): port 18100
- webclaude_go-gateway (Go): port 18200
- webclaude_website (React+Vite): port 18300
- claude_host (Python): WebSocket client to gateway

## Database
- Default: SQLite (zero-dependency deployment)
- Optional: MySQL + Redis (for production with full features)

## Code Style
- All code in English
- All scripts: no exit codes, no set -e, real-time output
- Shell scripts call Python for config parsing (scripts/pytools/)
- System installs use core_node/scripts/shells/linux/ scripts

## Important Paths
- Project root: core_node/webclaude_group/
- Data dir: webclaude_group/.data/
- Logs: webclaude_group/.data/cache/logs/
- Install scripts: core_node/scripts/shells/linux/debian/install_shells/
