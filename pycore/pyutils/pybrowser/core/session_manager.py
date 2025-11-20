#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Session Manager

Manages browser sessions and their lifecycle
"""

import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.pybrowser.factories.browser_factory import BrowserFactory


class Session:
    """Browser session with pages and plugins"""

    def __init__(self, session_id: str, config: Dict[str, Any] = None):
        self.id = session_id
        self.config = config or {}
        self.browser = None
        self.pages: Dict[str, Any] = {}
        self.active_page = None
        self.is_initialized = False
        self.created_at = datetime.now().isoformat()
        self.last_activity = datetime.now().isoformat()
        self.plugins: Dict[str, Any] = {}
        self.metrics = {
            'pages_created': 0,
            'pages_closed': 0,
            'requests': 0,
            'errors': 0
        }

    def initialize(self):
        """Initialize session with browser"""
        ColorPrint.info(f"Initializing session: {self.id}")

        browser_type = self.config.get('browser', 'edge')
        browser_config = self.config.get('browser_options', {})

        # Create and start browser (ThreadedBrowser)
        self.browser = BrowserFactory.create(browser_type, config=browser_config, auto_start=True)

        # Wait for browser to be ready
        if not self.browser.wait_until_ready(timeout=30):
            raise RuntimeError("Browser failed to start within timeout")

        self.is_initialized = True
        self.last_activity = datetime.now().isoformat()

        ColorPrint.info(f"Session initialized: {self.id}")
        return self

    def new_page(self, options: Dict[str, Any] = None) -> Any:
        """
        Create new page in session

        Args:
            options: Page options

        Returns:
            Page instance
        """
        # Use IBrowser interface to create page
        page = self.browser.new_page(options or {})

        page_id = str(uuid.uuid4())
        self.pages[page_id] = page
        self.active_page = page
        self.metrics['pages_created'] += 1
        self.last_activity = datetime.now().isoformat()

        ColorPrint.info(f"Page created in session {self.id}: {page_id}")
        return page

    def close_page(self, page_id: str):
        """
        Close a page

        Args:
            page_id: Page identifier
        """
        page = self.pages.get(page_id)
        if page:
            page.close()
            del self.pages[page_id]
            self.metrics['pages_closed'] += 1
            self.last_activity = datetime.now().isoformat()

            if self.active_page == page:
                self.active_page = next(iter(self.pages.values()), None)

            ColorPrint.info(f"Page closed in session {self.id}: {page_id}")

    def get_page(self, page_id: str = None) -> Optional[Any]:
        """
        Get page by ID or active page

        Args:
            page_id: Page ID (None for active page)

        Returns:
            Page instance or None
        """
        if page_id:
            return self.pages.get(page_id)
        return self.active_page

    def get_all_pages(self) -> List[Any]:
        """
        Get all pages in session

        Returns:
            List of page instances
        """
        return list(self.pages.values())

    def load_plugin(self, plugin: Any):
        """
        Load plugin into session

        Args:
            plugin: Plugin instance
        """
        plugin.initialize(self)
        self.plugins[plugin.name] = plugin
        ColorPrint.info(f"Plugin {plugin.name} loaded in session {self.id}")

    def unload_plugin(self, plugin_name: str):
        """
        Unload plugin from session

        Args:
            plugin_name: Plugin name
        """
        plugin = self.plugins.get(plugin_name)
        if plugin:
            plugin.cleanup()
            del self.plugins[plugin_name]
            ColorPrint.info(f"Plugin {plugin_name} unloaded from session {self.id}")

    def get_plugin(self, plugin_name: str) -> Optional[Any]:
        """
        Get plugin by name

        Args:
            plugin_name: Plugin name

        Returns:
            Plugin instance or None
        """
        return self.plugins.get(plugin_name)

    def close(self):
        """Close session and cleanup resources"""
        ColorPrint.info(f"Closing session: {self.id}")

        # Close all pages
        for page_id, page in list(self.pages.items()):
            page.close()

        # Cleanup all plugins
        for plugin_name, plugin in list(self.plugins.items()):
            plugin.cleanup()

        # Close browser using IBrowser interface
        if self.browser:
            self.browser.close()

        self.is_initialized = False
        ColorPrint.info(f"Session closed: {self.id}")

    def get_browser(self) -> Any:
        """
        Get browser instance

        Returns:
            Browser instance
        """
        return self.browser

    def get_info(self) -> Dict[str, Any]:
        """
        Get session information

        Returns:
            Dictionary with session info
        """
        return {
            'id': self.id,
            'is_initialized': self.is_initialized,
            'created_at': self.created_at,
            'last_activity': self.last_activity,
            'config': self.config,
            'pages': len(self.pages),
            'active_page': 'active' if self.active_page else 'none',
            'plugins': list(self.plugins.keys()),
            'metrics': self.metrics
        }


class SessionManager:
    """Manager for browser sessions"""

    def __init__(self):
        self.sessions: Dict[str, Session] = {}
        self.session_counter = 0
        self.max_sessions = 10

    def create(self, config: Dict[str, Any] = None) -> Session:
        """
        Create new session

        Args:
            config: Session configuration

        Returns:
            Session instance
        """
        if len(self.sessions) >= self.max_sessions:
            raise RuntimeError(f"Maximum number of sessions ({self.max_sessions}) reached")

        session_id = self.generate_session_id()
        session = Session(session_id, config or {})

        session.initialize()
        self.sessions[session_id] = session

        return session

    def get(self, session_id: str) -> Optional[Session]:
        """
        Get session by ID

        Args:
            session_id: Session identifier

        Returns:
            Session instance or None
        """
        return self.sessions.get(session_id)

    def get_all(self) -> List[Session]:
        """
        Get all sessions

        Returns:
            List of session instances
        """
        return list(self.sessions.values())

    def close(self, session_id: str) -> Optional[Session]:
        """
        Close a session

        Args:
            session_id: Session identifier

        Returns:
            Closed session instance or None
        """
        session = self.sessions.get(session_id)
        if session:
            session.close()
            del self.sessions[session_id]
            return session
        return None

    def close_all(self):
        """Close all sessions"""
        for session_id in list(self.sessions.keys()):
            self.close(session_id)

        ColorPrint.info('All sessions closed')

    def generate_session_id(self) -> str:
        """
        Generate unique session ID

        Returns:
            Session ID string
        """
        self.session_counter += 1
        import time
        return f"session_{self.session_counter}_{int(time.time() * 1000)}"

    def get_info(self) -> Dict[str, Any]:
        """
        Get session manager information

        Returns:
            Dictionary with manager info
        """
        return {
            'total_sessions': len(self.sessions),
            'max_sessions': self.max_sessions,
            'session_ids': list(self.sessions.keys())
        }
