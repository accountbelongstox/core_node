#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Plugin Manager

Manages plugin lifecycle and hooks
"""

from typing import Dict, List, Any, Callable
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.pybrowser.interfaces.iplugin import IPlugin


class PluginManager:
    """Plugin manager for extensible functionality"""

    def __init__(self):
        self.plugins: Dict[str, IPlugin] = {}
        self.hooks: Dict[str, List[Callable]] = {}
        self.is_initialized = False
        self.metrics = {
            'plugins_loaded': 0,
            'plugins_unloaded': 0,
            'hooks_executed': 0,
            'hook_errors': 0
        }

    async def load_plugins(self):
        """Load built-in plugins"""
        try:
            ColorPrint.info('Loading built-in plugins...')

            from pycore.pyutils.pybrowser.plugins.core.content_plugin import ContentPlugin
            from pycore.pyutils.pybrowser.plugins.core.automation_plugin import AutomationPlugin

            await self.load_plugin(ContentPlugin())
            await self.load_plugin(AutomationPlugin())

            self.is_initialized = True
            ColorPrint.info('Built-in plugins loaded successfully')
        except Exception as error:
            ColorPrint.red(f'Failed to load plugins: {error}')
            raise

    async def load_plugin(self, plugin: IPlugin):
        """
        Load a plugin

        Args:
            plugin: Plugin instance
        """
        if not isinstance(plugin, IPlugin):
            raise TypeError('Plugin must extend IPlugin class')

        if plugin.name in self.plugins:
            ColorPrint.warn(f"Plugin {plugin.name} is already loaded")
            return

        try:
            await plugin.initialize(self)
            self.plugins[plugin.name] = plugin
            self.metrics['plugins_loaded'] += 1

            ColorPrint.info(f"Plugin loaded: {plugin.name} v{plugin.version}")
        except Exception as error:
            ColorPrint.red(f"Failed to load plugin {plugin.name}: {error}")
            raise

    async def unload_plugin(self, plugin_name: str):
        """
        Unload a plugin

        Args:
            plugin_name: Name of plugin to unload
        """
        plugin = self.plugins.get(plugin_name)
        if not plugin:
            ColorPrint.warn(f"Plugin {plugin_name} not found")
            return

        try:
            await plugin.cleanup()
            del self.plugins[plugin_name]
            self.metrics['plugins_unloaded'] += 1

            ColorPrint.info(f"Plugin unloaded: {plugin_name}")
        except Exception as error:
            ColorPrint.red(f"Failed to unload plugin {plugin_name}: {error}")
            raise

    def get_plugin(self, plugin_name: str) -> IPlugin:
        """
        Get plugin by name

        Args:
            plugin_name: Plugin name

        Returns:
            Plugin instance or None
        """
        return self.plugins.get(plugin_name)

    def get_all_plugins(self) -> List[IPlugin]:
        """
        Get all loaded plugins

        Returns:
            List of plugin instances
        """
        return list(self.plugins.values())

    async def initialize_session(self, session: Any):
        """
        Initialize all plugins for a session

        Args:
            session: Session instance
        """
        for plugin_name, plugin in self.plugins.items():
            try:
                await session.load_plugin(plugin)
                ColorPrint.debug(f"Plugin {plugin_name} initialized for session {session.id}")
            except Exception as error:
                ColorPrint.red(f"Failed to initialize plugin {plugin_name} for session {session.id}: {error}")

    async def execute_hook(self, hook_name: str, *args) -> List[Any]:
        """
        Execute hook with all registered handlers

        Args:
            hook_name: Hook name
            *args: Arguments to pass to handlers

        Returns:
            List of results from handlers
        """
        hooks = self.hooks.get(hook_name, [])
        results = []

        ColorPrint.debug(f"Executing hook: {hook_name} with {len(hooks)} handlers")

        for hook in hooks:
            try:
                result = await hook(*args)
                results.append(result)
                self.metrics['hooks_executed'] += 1
            except Exception as error:
                self.metrics['hook_errors'] += 1
                ColorPrint.red(f"Hook {hook_name} failed: {error}")

        return results

    def register_hook(self, hook_name: str, callback: Callable):
        """
        Register hook handler

        Args:
            hook_name: Hook name
            callback: Callback function
        """
        if hook_name not in self.hooks:
            self.hooks[hook_name] = []

        self.hooks[hook_name].append(callback)
        ColorPrint.debug(f"Hook registered: {hook_name}")

    def unregister_hook(self, hook_name: str, callback: Callable):
        """
        Unregister hook handler

        Args:
            hook_name: Hook name
            callback: Callback function
        """
        if hook_name not in self.hooks:
            return

        hooks = self.hooks[hook_name]
        if callback in hooks:
            hooks.remove(callback)
            ColorPrint.debug(f"Hook unregistered: {hook_name}")

    async def cleanup(self):
        """Cleanup all plugins"""
        try:
            ColorPrint.info('Cleaning up PluginManager...')

            for plugin_name, plugin in list(self.plugins.items()):
                try:
                    await plugin.cleanup()
                except Exception as error:
                    ColorPrint.warn(f"Failed to cleanup plugin {plugin_name}: {error}")

            self.plugins.clear()
            self.hooks.clear()
            self.is_initialized = False

            ColorPrint.info('PluginManager cleanup completed')
        except Exception as error:
            ColorPrint.red(f'Failed to cleanup PluginManager: {error}')
            raise

    def get_info(self) -> Dict[str, Any]:
        """
        Get plugin manager information

        Returns:
            Dictionary with manager info
        """
        plugin_info = {
            name: {
                'version': plugin.version,
                'is_initialized': plugin.is_initialized
            }
            for name, plugin in self.plugins.items()
        }

        return {
            'is_initialized': self.is_initialized,
            'total_plugins': len(self.plugins),
            'plugins': plugin_info,
            'hooks': list(self.hooks.keys()),
            'metrics': self.metrics
        }
