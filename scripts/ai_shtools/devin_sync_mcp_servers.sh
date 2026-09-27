#!/usr/bin/env bash

# devin MCP sync (thin wrapper). All logic lives in mcp_sync_engine.sh, which
# reuses the cross-platform _json_sync_helper.py so schemas match Windows exactly.
MCP_WRAP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=mcp_sync_engine.sh
. "$MCP_WRAP_DIR/mcp_sync_engine.sh"
mcp_sync_tool devin
