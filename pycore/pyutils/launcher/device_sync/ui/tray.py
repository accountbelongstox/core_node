# -*- coding: utf-8 -*-
"""
Simple Tray Menu - System tray UI for Device Sync

Only handles menu display and user interaction.
Business logic is handled by global_config, simple_primary_server, and simple_client.
"""

import os
import sys
import webbrowser
import tkinter as tk
from tkinter import messagebox
import pystray
from PIL import Image, ImageDraw
from typing import Optional

from ..core.config import get_global_config
from ..server.primary import SimplePrimaryServer
from ..client.secondary import SimpleClient
from ..core.logging import setup_logging

logger = setup_logging(__name__)


class SimpleTrayMenu:
    """
    Simple tray menu - Only handles UI

    Business logic is delegated to:
    - global_config: Shared configuration
    - simple_primary_server: PRIMARY server
    - simple_client: SECONDARY client
    """

    def __init__(self):
        """Initialize simple tray menu"""
        self.config = get_global_config()

        # Components (created but not started yet)
        self.primary_server: Optional[SimplePrimaryServer] = None
        self.client: Optional[SimpleClient] = None

        # Tray icon
        self.icon: Optional[pystray.Icon] = None

    def start(self):
        """Start tray menu"""
        logger.info("Starting tray menu...")

        # Create tray icon
        icon_image = self._create_icon_image()
        menu = self._create_menu()

        self.icon = pystray.Icon(
            name="DeviceSync",
            icon=icon_image,
            title="Device Sync",
            menu=menu
        )

        # Run tray icon (blocking)
        logger.info("Tray menu started")
        self.icon.run()

    def stop(self):
        """Stop tray menu"""
        logger.info("Stopping tray menu...")

        # Stop components
        if self.client:
            self.client.stop()

        if self.primary_server:
            self.primary_server.stop()

        # Stop tray icon
        if self.icon:
            self.icon.stop()

        logger.info("Tray menu stopped")

    def _create_menu(self):
        """Create tray menu"""
        return pystray.Menu(
            pystray.MenuItem(
                "Mode",
                pystray.Menu(
                    pystray.MenuItem(
                        "Set as PRIMARY",
                        self._on_set_primary,
                        checked=lambda item: self.config.isPrimaryServer
                    ),
                    pystray.MenuItem(
                        "Set as SECONDARY",
                        self._on_set_secondary,
                        checked=lambda item: not self.config.isPrimaryServer
                    )
                )
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "Enable API Access",
                self._on_toggle_api,
                checked=lambda item: self.config.api_enabled,
                enabled=lambda item: self.config.isPrimaryServer and self.config.server_running
            ),
            pystray.MenuItem(
                "Scan node_modules",
                self._on_toggle_scan_node_modules,
                checked=lambda item: self.config.scan_node_modules,
                enabled=lambda item: self.config.isPrimaryServer
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "Enable Sync",
                self._on_enable_sync,
                checked=lambda item: self.config.sync_enabled,
                enabled=lambda item: not self.config.isPrimaryServer
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "Open Web UI",
                self._on_open_web,
                enabled=lambda item: self.config.isPrimaryServer and self.config.server_running
            ),
            pystray.MenuItem(
                "Status",
                self._on_show_status
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "Restart",
                self._on_restart
            ),
            pystray.MenuItem(
                "Exit",
                self._on_exit
            )
        )

    def _create_icon_image(self):
        """Create tray icon image"""
        # Create simple icon
        image = Image.new('RGB', (64, 64), color=(73, 109, 137))
        dc = ImageDraw.Draw(image)

        # Draw a simple "S" for Sync
        dc.rectangle([16, 16, 48, 48], fill=(255, 255, 255), outline=(73, 109, 137))
        dc.text((22, 20), "S", fill=(73, 109, 137))

        return image

    def _on_set_primary(self):
        """Handle 'Set as PRIMARY' menu click"""
        logger.info("User clicked: Set as PRIMARY")

        # Stop client if running
        if self.client and self.client.is_running():
            self.client.stop()

        # Stop server if running
        if self.primary_server and self.primary_server.is_running():
            self.primary_server.stop()

        # Update config
        self.config.set_as_primary()

        # Start PRIMARY server
        try:
            if not self.primary_server:
                self.primary_server = SimplePrimaryServer()

            self.primary_server.start()

            self._update_icon_title()
            logger.info("Set as PRIMARY server - Server started successfully!")

        except Exception as e:
            logger.error(f"Failed to start PRIMARY server: {e}", exc_info=True)

    def _on_set_secondary(self):
        """Handle 'Set as SECONDARY' menu click"""
        logger.info("User clicked: Set as SECONDARY")

        # Stop client if running
        if self.client and self.client.is_running():
            self.client.stop()

        # Stop server if running
        if self.primary_server and self.primary_server.is_running():
            self.primary_server.stop()

        # Update config
        self.config.set_as_secondary()

        self._update_icon_title()
        logger.info("Set as SECONDARY - Sync is disabled by default")

    def _on_toggle_api(self):
        """Handle 'Enable API Access' menu toggle"""
        if self.config.api_enabled:
            # Disable API
            logger.info("User clicked: Disable API access")
            self.config.disable_api()
            self._update_icon_title()
            logger.info("API access disabled - /api/status is still accessible")
        else:
            # Enable API
            logger.info("User clicked: Enable API access")
            self.config.enable_api()
            self._update_icon_title()
            logger.info("API access enabled - Clients can now sync files")

    def _on_toggle_scan_node_modules(self):
        """Handle 'Scan node_modules' menu toggle"""
        if self.config.scan_node_modules:
            # Disable scanning node_modules
            logger.info("User clicked: Disable node_modules scanning")
            self.config.scan_node_modules = False
            # Clear cache to force rebuild on next sync request
            self.config.file_cache = []
            logger.info("node_modules scanning disabled - Cache will be rebuilt on next sync request")
        else:
            # Enable scanning node_modules
            logger.info("User clicked: Enable node_modules scanning")
            self.config.scan_node_modules = True
            # Clear cache to force rebuild on next sync request
            self.config.file_cache = []
            logger.info("node_modules scanning enabled - Cache will be rebuilt on next sync request")

    def _on_enable_sync(self):
        """Handle 'Enable Sync' menu toggle"""
        if self.config.sync_enabled:
            # Disable sync
            logger.info("User clicked: Disable sync")
            self.config.disable_sync()

            if self.client and self.client.is_running():
                self.client.stop()

            self._update_icon_title()
            logger.info("Sync disabled")

        else:
            # Enable sync
            logger.info("User clicked: Enable sync")

            if self.config.isPrimaryServer:
                logger.warning("Cannot enable sync: This is PRIMARY server")
                return

            if not self.config.enable_sync():
                return

            # Start client
            try:
                if not self.client:
                    self.client = SimpleClient()

                self.client.start()

                self._update_icon_title()
                logger.info("Sync enabled - Client started successfully!")

            except Exception as e:
                logger.error(f"Failed to start client: {e}", exc_info=True)
                self.config.disable_sync()

    def _on_open_web(self):
        """Handle 'Open Web UI' menu click"""
        logger.info("User clicked: Open Web UI")

        if not self.config.isPrimaryServer or not self.config.server_running:
            logger.warning("Cannot open Web UI: Server not running")
            return

        # Build URL
        url = f"http://{self.config.local_ip or 'localhost'}:{self.config.http_port}/"
        logger.info(f"Opening Web UI: {url}")

        try:
            webbrowser.open(url)
        except Exception as e:
            logger.error(f"Failed to open Web UI: {e}")

    def _on_show_status(self):
        """Handle 'Status' menu click"""
        logger.info("User clicked: Status")

        status = self.config.get_status()

        # Build status message
        mode = "PRIMARY" if status['isPrimaryServer'] else "SECONDARY"
        sync = "Enabled" if status['sync_enabled'] else "Disabled"
        api = "Enabled" if status['api_enabled'] else "Disabled"
        scan_nm = "Yes" if status['scan_node_modules'] else "No"

        msg = f"""Device Sync Status

Mode: {mode}
Sync: {sync}"""

        if status['isPrimaryServer']:
            msg += f"\nAPI Access: {api}"
            msg += f"\nScan node_modules: {scan_nm}"

        msg += f"""
Port: {status['http_port']}
IP: {status['local_ip'] or 'Unknown'}

Hostname: {status['hostname']}
Device ID: {status['device_id'][:8]}...

Server Running: {status['server_running']}
Client Running: {status['client_running']}"""

        if status['primary_server_ip']:
            msg += f"\n\nPrimary Server: {status['primary_server_ip']}"

        if status['isPrimaryServer'] and status['file_cache_count'] > 0:
            msg += f"\n\nFile Cache: {status['file_cache_count']} files"

        # Additional info from database
        if status['total_scans'] > 0:
            msg += f"\n\nTotal Scans: {status['total_scans']}"
            if status['last_scan_time']:
                msg += f"\nLast Scan: {status['last_scan_time']}"

        if status['connected_clients_count'] > 0:
            msg += f"\n\nConnected Clients: {status['connected_clients_count']}"

        # Show status in message box with proper Tkinter handling
        root = tk.Tk()
        root.withdraw()  # Hide the root window
        root.lift()  # Bring to front
        root.attributes('-topmost', True)  # Make sure it's on top
        root.after(100, lambda: root.attributes('-topmost', False))  # Remove topmost after showing
        messagebox.showinfo("Device Sync - Status", msg, parent=root)
        root.quit()  # Properly quit the mainloop
        root.destroy()  # Destroy the window

    def _on_restart(self):
        """Handle 'Restart' menu click"""
        logger.info("User clicked: Restart")
        logger.info("Restarting Device Sync...")

        # Stop all services first (HTTP server, client, etc.)
        logger.info("Stopping all services...")
        if self.client and self.client.is_running():
            self.client.stop()

        if self.primary_server and self.primary_server.is_running():
            self.primary_server.stop()

        # Stop tray icon
        if self.icon:
            self.icon.stop()

        # Restart the program
        logger.info("Restarting program...")
        python = sys.executable
        os.execl(python, python, *sys.argv)

    def _on_exit(self):
        """Handle 'Exit' menu click"""
        logger.info("User clicked: Exit")
        logger.info("Exiting Device Sync...")
        # stop() already handles stopping services in correct order
        self.stop()

    def _update_icon_title(self):
        """Update tray icon title"""
        mode = "PRIMARY" if self.config.isPrimaryServer else "SECONDARY"
        sync = " [SYNC]" if self.config.sync_enabled else ""

        title = f"Device Sync - {mode}{sync}"

        if self.icon:
            self.icon.title = title
