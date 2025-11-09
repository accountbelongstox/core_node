#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Spider Engine

Main engine that orchestrates browser automation
"""

import time
from typing import Dict, Any, Optional, List
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.pybrowser.config.config_manager import ConfigManager
from pycore.pyutils.pybrowser.core.session_manager import SessionManager, Session
from pycore.pyutils.pybrowser.core.resource_pool import ResourcePool
from pycore.pyutils.pybrowser.core.event_bus import EventBus
from pycore.pyutils.pybrowser.core.plugin_manager import PluginManager


class SpiderEngine:
    """Main spider engine for browser automation"""

    def __init__(self, config: Dict[str, Any] = None):
        self.config = ConfigManager(config or {})
        self.session_manager = SessionManager()
        self.resource_pool = ResourcePool()
        self.event_bus = EventBus()
        self.plugin_manager = PluginManager()
        self.is_initialized = False
        self.metrics = {
            'sessions_created': 0,
            'sessions_closed': 0,
            'plugins_loaded': 0,
            'start_time': None
        }

    async def initialize(self):
        """Initialize spider engine"""
        try:
            ColorPrint.info('Initializing SpiderEngine...')
            self.metrics['start_time'] = time.time()

            await self.config.load()
            await self.resource_pool.initialize()
            await self.plugin_manager.load_plugins()

            self.is_initialized = True
            self.event_bus.emit('engine:initialized', self.get_info())

            ColorPrint.info('SpiderEngine initialized successfully')
            return self
        except Exception as error:
            ColorPrint.red(f'Failed to initialize SpiderEngine: {error}')
            raise

    async def create_session(self, options: Dict[str, Any] = None) -> Session:
        """
        Create new browser session

        Args:
            options: Session options

        Returns:
            Session instance
        """
        if not self.is_initialized:
            raise RuntimeError('SpiderEngine must be initialized before creating sessions')

        try:
            session_config = self.config.merge_session_config(options or {})
            session = await self.session_manager.create(session_config)

            await self.plugin_manager.initialize_session(session)
            self.metrics['sessions_created'] += 1

            self.event_bus.emit('session:created', session.get_info())
            ColorPrint.info(f"Session created: {session.id}")

            return session
        except Exception as error:
            ColorPrint.red(f'Failed to create session: {error}')
            raise

    async def close_session(self, session_id: str) -> Optional[Session]:
        """
        Close a session

        Args:
            session_id: Session identifier

        Returns:
            Closed session or None
        """
        try:
            session = await self.session_manager.close(session_id)
            if session:
                self.metrics['sessions_closed'] += 1
                self.event_bus.emit('session:closed', session.get_info())
                ColorPrint.info(f"Session closed: {session_id}")
            return session
        except Exception as error:
            ColorPrint.red(f"Failed to close session {session_id}: {error}")
            raise

    def get_session(self, session_id: str) -> Optional[Session]:
        """
        Get session by ID

        Args:
            session_id: Session identifier

        Returns:
            Session instance or None
        """
        return self.session_manager.get(session_id)

    def get_all_sessions(self) -> List[Session]:
        """
        Get all active sessions

        Returns:
            List of session instances
        """
        return self.session_manager.get_all()

    async def load_plugin(self, plugin: Any):
        """
        Load a plugin

        Args:
            plugin: Plugin instance
        """
        try:
            await self.plugin_manager.load_plugin(plugin)
            self.metrics['plugins_loaded'] += 1
            self.event_bus.emit('plugin:loaded', plugin.get_info())
            ColorPrint.info(f"Plugin loaded: {plugin.name}")
        except Exception as error:
            ColorPrint.red(f"Failed to load plugin {plugin.name}: {error}")
            raise

    async def unload_plugin(self, plugin_name: str):
        """
        Unload a plugin

        Args:
            plugin_name: Plugin name
        """
        try:
            await self.plugin_manager.unload_plugin(plugin_name)
            self.event_bus.emit('plugin:unloaded', {'name': plugin_name})
            ColorPrint.info(f"Plugin unloaded: {plugin_name}")
        except Exception as error:
            ColorPrint.red(f"Failed to unload plugin {plugin_name}: {error}")
            raise

    async def shutdown(self):
        """Shutdown spider engine"""
        try:
            ColorPrint.info('Shutting down SpiderEngine...')

            await self.session_manager.close_all()
            await self.plugin_manager.cleanup()
            await self.resource_pool.cleanup()

            self.is_initialized = False
            self.event_bus.emit('engine:shutdown', self.get_metrics())

            ColorPrint.info('SpiderEngine shutdown completed')
        except Exception as error:
            ColorPrint.red(f'Failed to shutdown SpiderEngine: {error}')
            raise

    def get_info(self) -> Dict[str, Any]:
        """
        Get engine information

        Returns:
            Dictionary with engine info
        """
        return {
            'is_initialized': self.is_initialized,
            'config': self.config.get_info(),
            'sessions': self.session_manager.get_info(),
            'plugins': self.plugin_manager.get_info(),
            'resources': self.resource_pool.get_info(),
            'metrics': self.get_metrics()
        }

    def get_metrics(self) -> Dict[str, Any]:
        """
        Get engine metrics

        Returns:
            Dictionary with metrics
        """
        uptime = int(time.time() - self.metrics['start_time']) if self.metrics['start_time'] else 0

        return {
            **self.metrics,
            'uptime': uptime,
            'active_sessions': len(self.session_manager.get_all())
        }

    def on(self, event: str, callback):
        """
        Register event listener

        Args:
            event: Event name
            callback: Callback function
        """
        self.event_bus.on(event, callback)

    def off(self, event: str, callback):
        """
        Remove event listener

        Args:
            event: Event name
            callback: Callback function
        """
        self.event_bus.off(event, callback)

    def emit(self, event: str, data: Any = None):
        """
        Emit event

        Args:
            event: Event name
            data: Event data
        """
        self.event_bus.emit(event, data)
