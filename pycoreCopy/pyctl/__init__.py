#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pyctl - High-level Control Layer

Provides high-level abstractions that combine multiple pyutils modules.
Orchestrates pyutils functionality for complex operations.

Modules:
- speech: Speech management (TTS + STT + RPC + AI)
  - speech.rpc: Speech API endpoints (TTS, STT, multi-language)
  - speech.ai: AI features (chat, parse, expand, translate)
- pybrowserauto: Offline web downloader / automation utilities
- mcp_launcher: MCP proxy service launcher with singleton detection

Usage:
    # Speech - Manual initialization required
    from pycore.pyctl.speech import get_speech_manager
    speech_manager = get_speech_manager()

    # RPC - Manual initialization required
    from pycore.pyctl.speech.rpc import get_rpc_manager
    rpc_manager = get_rpc_manager(auto_start=True)

    # PyBrowserAuto (offline website downloader)
    from pycore.pyctl.pybrowserauto.controller import CLIController
    cli = CLIController()

    # MCP Proxy Launcher
    from pycore.pyctl.mcp_launcher import launch_mcp_proxy
    launch_mcp_proxy()
"""

# DO NOT import instances here - let applications initialize themselves
# This prevents auto-loading unnecessary modules

__all__ = ['mcp_launcher']
