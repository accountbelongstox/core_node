#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Session Manager

Manages browser sessions and their lifecycle
"""

import asyncio
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
from pycore.pyfoundations.color_print import ColorPrint


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

    async def initialize(self):
        """Initialize session with browser"""
        try:
            ColorPrint.info(f"Initializing session: {self.id}")

            from pycore.pyutils.pybrowser.factories.browser_factory import BrowserFactory

            browser_type = self.config.get('browser', 'edge')
            self.browser = await BrowserFactory.create(browser_type)

            browser_options = self.config.get('browser_options', {})
            await self.browser.launch(browser_options)

            self.is_initialized = True
            self.last_activity = datetime.now().isoformat()

            ColorPrint.info(f"Session initialized: {self.id}")
            return self
        except Exception as error:
            ColorPrint.red(f"Failed to initialize session {self.id}: {error}")
            raise

    async def new_page(self, options: Dict[str, Any] = None) -> Any:
        """
        Create new page in session

        Args:
            options: Page options

        Returns:
            Page instance
        """
        try:
            pages = await self.browser.get_pages()
            blank_page = None

            for page in pages:
                try:
                    page_url = await page.get_url()
                    blank_urls = ['about:blank', 'chrome://newtab/', 'edge://newtab/', 'about:newtab', '']
                    if page_url in blank_urls:
                        blank_page = page
                        break
                except Exception:
                    continue

            if blank_page:
                wrapped_page = blank_page
                ColorPrint.info(f"Reusing blank page in session {self.id}")
            else:
                wrapped_page = await self.browser.new_page(options or {})
                ColorPrint.info(f"Created new page in session {self.id}")

            page_id = str(uuid.uuid4())
            self.pages[page_id] = wrapped_page
            self.active_page = wrapped_page
            self.metrics['pages_created'] += 1
            self.last_activity = datetime.now().isoformat()

            ColorPrint.info(f"Page created in session {self.id}: {page_id}")
            return wrapped_page
        except Exception as error:
            self.metrics['errors'] += 1
            ColorPrint.red(f"Failed to create page in session {self.id}: {error}")
            raise

    async def close_page(self, page_id: str):
        """
        Close a page

        Args:
            page_id: Page identifier
        """
        try:
            page = self.pages.get(page_id)
            if page:
                await page.close()
                del self.pages[page_id]
                self.metrics['pages_closed'] += 1
                self.last_activity = datetime.now().isoformat()

                if self.active_page == page:
                    self.active_page = next(iter(self.pages.values()), None)

                ColorPrint.info(f"Page closed in session {self.id}: {page_id}")
        except Exception as error:
            self.metrics['errors'] += 1
            ColorPrint.red(f"Failed to close page {page_id} in session {self.id}: {error}")
            raise

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

    async def load_plugin(self, plugin: Any):
        """
        Load plugin into session

        Args:
            plugin: Plugin instance
        """
        try:
            await plugin.initialize(self)
            self.plugins[plugin.name] = plugin
            ColorPrint.info(f"Plugin {plugin.name} loaded in session {self.id}")
        except Exception as error:
            ColorPrint.red(f"Failed to load plugin {plugin.name} in session {self.id}: {error}")
            raise

    async def unload_plugin(self, plugin_name: str):
        """
        Unload plugin from session

        Args:
            plugin_name: Plugin name
        """
        try:
            plugin = self.plugins.get(plugin_name)
            if plugin:
                await plugin.cleanup()
                del self.plugins[plugin_name]
                ColorPrint.info(f"Plugin {plugin_name} unloaded from session {self.id}")
        except Exception as error:
            ColorPrint.red(f"Failed to unload plugin {plugin_name} from session {self.id}: {error}")
            raise

    def get_plugin(self, plugin_name: str) -> Optional[Any]:
        """
        Get plugin by name

        Args:
            plugin_name: Plugin name

        Returns:
            Plugin instance or None
        """
        return self.plugins.get(plugin_name)

    async def close(self):
        """Close session and cleanup resources"""
        try:
            ColorPrint.info(f"Closing session: {self.id}")

            for page_id, page in list(self.pages.items()):
                try:
                    await page.close()
                except Exception as error:
                    ColorPrint.warn(f"Failed to close page {page_id}: {error}")

            for plugin_name, plugin in list(self.plugins.items()):
                try:
                    await plugin.cleanup()
                except Exception as error:
                    ColorPrint.warn(f"Failed to cleanup plugin {plugin_name}: {error}")

            if self.browser:
                await self.browser.close()

            self.is_initialized = False
            ColorPrint.info(f"Session closed: {self.id}")
        except Exception as error:
            ColorPrint.red(f"Failed to close session {self.id}: {error}")
            raise

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

    async def create(self, config: Dict[str, Any] = None) -> Session:
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

        await session.initialize()
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

    async def close(self, session_id: str) -> Optional[Session]:
        """
        Close a session

        Args:
            session_id: Session identifier

        Returns:
            Closed session instance or None
        """
        session = self.sessions.get(session_id)
        if session:
            await session.close()
            del self.sessions[session_id]
            return session
        return None

    async def close_all(self):
        """Close all sessions"""
        close_tasks = [
            self.close(session_id)
            for session_id in list(self.sessions.keys())
        ]

        await asyncio.gather(*close_tasks, return_exceptions=True)
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
