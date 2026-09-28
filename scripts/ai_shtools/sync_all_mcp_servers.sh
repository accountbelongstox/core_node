#!/usr/bin/env bash

# Sync MCP config to ALL AI tools (Linux). Delegates to the shared engine.
MCP_WRAP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=mcp_sync_engine.sh
. "$MCP_WRAP_DIR/mcp_sync_engine.sh"
mcp_sync_all
