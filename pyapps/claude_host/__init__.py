#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Host Agent Application

Multi-user host agent for the WebClaude Group project.
Connects to the central server (webclaude_go-gateway) via reverse
WebSocket tunnel, receives commands from the web frontend, and executes
Claude CLI on behalf of authenticated users.

Note: The "central server" is the relay hub. An independent gateway may also
exist as a separate project, but this host agent connects directly to the
central server.

Origin: webclaude_group/claude_host (migrated to core_node pyapps)

Entry point: pyapps.claude_host.claude_host_main (start / main)
    Loaded directly by app_launcher via file path; not re-exported here
    to avoid circular imports with claude_host_config.
"""

__version__ = "2.0.0"
__app_name__ = "claude_host"
