#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Frontend Command Helpers

Pure stateless helpers for resolving the command lists used by the frontend
launcher thread. Extracted from frontend_thread.py so the thread stays focused
on lifecycle/dispatch.

- resolve_command_for_platform: Windows .cmd suffix for npm/pnpm/npx/yarn/node.
- resolve_dev_command: framework-specific dev-server command (nuxt/next/vite/...).
- resolve_build_command: framework-specific production build command.
"""

from typing import List

import platform

from .frontend_config import FrontendConfig


# Package managers / runtimes that need a .cmd shim on Windows
_NPM_TOOLS = ("npm", "pnpm", "npx", "yarn", "node")


def resolve_command_for_platform(command: List[str]) -> List[str]:
    """
    Resolve a command list for the current platform.

    On Windows, npm/pnpm/npx/yarn/node require a ``.cmd`` extension to be
    invokable from subprocess. On other platforms the command is returned
    unchanged.

    Note: commander.exec_realtime has its own platform handling for detached
    subprocess creation; this helper only normalizes the executable name and is
    intentionally kept separate (do not force-merge).
    """
    if platform.system() != "Windows":
        return command

    if command and command[0] in _NPM_TOOLS:
        command = command.copy()
        command[0] = f"{command[0]}.cmd"

    return command


def resolve_dev_command(config: FrontendConfig) -> List[str]:
    """
    Resolve the dev-server command for the configured framework.

    Honors an explicit ``config.dev_command`` override; otherwise maps the
    framework to its default dev invocation (host/port bound).
    """
    if config.dev_command:
        return config.dev_command

    framework = config.framework
    host = config.host
    port = str(config.port)

    if framework == "nuxt":
        return ["npx", "nuxi", "dev", "--hostname", host, "--port", port]
    if framework == "next":
        return ["npx", "next", "dev", "-H", host, "-p", port]
    if framework == "nexus":
        return ["npx", "nexus", "dev", "--host", host, "--port", port]
    if framework == "vue":
        # Vue CLI or Vite
        return ["npm", "run", "serve", "--", "--host", host, "--port", port]
    if framework == "react-native":
        # React Native Web via Expo
        return ["npx", "expo", "start", "--web", "--port", port]
    if framework == "react":
        # Create React App doesn't support --host/--port via CLI
        return ["npm", "run", "start"]
    if framework == "vite":
        # npm run dev for better compatibility (works with local vite)
        return ["npm", "run", "dev", "--", "--host", host, "--port", port]

    # Fallback - try npm run dev
    return ["npm", "run", "dev", "--", "--host", host, "--port", port]


def resolve_build_command(config: FrontendConfig) -> List[str]:
    """
    Resolve the production build command for the configured framework.

    Honors an explicit ``config.build_command`` override; otherwise maps the
    framework to its default build invocation.
    """
    if config.build_command:
        return config.build_command

    framework = config.framework

    if framework == "nuxt":
        return ["npx", "nuxi", "build"]
    if framework == "next":
        return ["npx", "next", "build"]
    if framework == "nexus":
        return ["npx", "nexus", "build"]
    if framework == "vue":
        return ["npm", "run", "build"]
    if framework == "react-native":
        return ["npx", "expo", "export:web"]
    if framework == "react":
        return ["npm", "run", "build"]
    if framework == "vite":
        return ["npx", "vite", "build"]

    # Fallback
    return ["npm", "run", "build"]
