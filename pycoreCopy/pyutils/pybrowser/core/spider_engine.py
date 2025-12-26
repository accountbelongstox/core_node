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

    def initialize(self):
        """Initialize spider engine"""
        ColorPrint.info('Initializing SpiderEngine...')
        self.metrics['start_time'] = time.time()

        self.config.load()
        self.resource_pool.initialize()
        self.plugin_manager.load_plugins()

        self.is_initialized = True
        self.event_bus.emit('engine:initialized', self.get_info())

        ColorPrint.info('SpiderEngine initialized successfully')
        return self

    def create_session(self, options: Dict[str, Any] = None) -> Session:
        """
        Create new browser session

        Args:
            options: Session options

        Returns:
            Session instance
        """
        if not self.is_initialized:
            raise RuntimeError('SpiderEngine must be initialized before creating sessions')

        session_config = self.config.merge_session_config(options or {})
        session = self.session_manager.create(session_config)

        self.plugin_manager.initialize_session(session)
        self.metrics['sessions_created'] += 1

        self.event_bus.emit('session:created', session.get_info())
        ColorPrint.info(f"Session created: {session.id}")

        return session

    def close_session(self, session_id: str) -> Optional[Session]:
        """
        Close a session

        Args:
            session_id: Session identifier

        Returns:
            Closed session or None
        """
        session = self.session_manager.close(session_id)
        if session:
            self.metrics['sessions_closed'] += 1
            self.event_bus.emit('session:closed', session.get_info())
            ColorPrint.info(f"Session closed: {session_id}")
        return session

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

    def load_plugin(self, plugin: Any):
        """
        Load a plugin

        Args:
            plugin: Plugin instance
        """
        self.plugin_manager.load_plugin(plugin)
        self.metrics['plugins_loaded'] += 1
        self.event_bus.emit('plugin:loaded', plugin.get_info())
        ColorPrint.info(f"Plugin loaded: {plugin.name}")

    def unload_plugin(self, plugin_name: str):
        """
        Unload a plugin

        Args:
            plugin_name: Plugin name
        """
        self.plugin_manager.unload_plugin(plugin_name)
        self.event_bus.emit('plugin:unloaded', {'name': plugin_name})
        ColorPrint.info(f"Plugin unloaded: {plugin_name}")

    def shutdown(self):
        """Shutdown spider engine"""
        ColorPrint.info('Shutting down SpiderEngine...')

        self.session_manager.close_all()
        self.plugin_manager.cleanup()
        self.resource_pool.cleanup()

        self.is_initialized = False
        self.event_bus.emit('engine:shutdown', self.get_metrics())

        ColorPrint.info('SpiderEngine shutdown completed')

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
