#!/bin/bash
# context7 MCP is retired: this template is intentionally a no-op kept only until the
# file is removed from the repo. It also purges any stale context7 entry.
claude mcp remove context7 2>/dev/null || true
