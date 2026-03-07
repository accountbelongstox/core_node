# -*- coding: utf-8 -*-
"""
Unified Tray Menu - System tray UI for Device Sync (Unified Architecture)

Architecture:
- HTTP server always runs (never stops)
- Mode switching only changes global_config flags
- No server restart needed
- Network scanning runs automatically in SECONDARY mode
"""

import os
import sys
import time
import webbrowser
import tkinter as tk
from tkinter import messagebox
from typing import Optional

from pycore.pyfoundations.third_party import get_third_package_pystray, get_third_package_PIL_Image, get_third_package_PIL_ImageDraw

pystray = get_third_package_pystray()
Image = get_third_package_PIL_Image()
ImageDraw = get_third_package_PIL_ImageDraw()

from ..core.config import get_global_config
from ..server.unified import UnifiedHTTPServer
from ..core.scanner import SimpleDeviceScanner
from ..core.logging import setup_logging

logger = setup_logging(__name__)


class SimpleTrayMenu:
    """
    Unified tray menu - UI for mode switching

    HTTP server always runs, mode switching only changes flags.
    Network scanning runs automatically in SECONDARY mode.
    """

    # Network scan interval (seconds) - increased to reduce CPU usage
    SCAN_INTERVAL = 60.0

    def __init__(self, server: UnifiedHTTPServer, scanner: SimpleDeviceScanner):
        """
        Initialize unified tray menu

        Args:
            server: Unified HTTP server instance (already running)
            scanner: Network scanner instance
        """
        self.config = get_global_config()
        self.server = server
        self.scanner = scanner

        # Tray icon
        self.icon: Optional[pystray.Icon] = None

        # Running flag (don't rely on icon.visible which may be False during setup)
        self.running = False

        # Last scan time
        self.last_scan_time = time.time()

    def start(self):
        """Start tray menu with periodic network scanning"""
        logger.info("=" * 70)
        logger.info("STARTING TRAY MENU")
        logger.info("=" * 70)

        # Set running flag BEFORE creating icon
        self.running = True
        logger.info(f"  self.running = {self.running}")

        # Create tray icon
        logger.info("[1/5] Creating tray icon image...")
        logger.info(f"  Calling _create_icon_image()...")
        icon_image = self._create_icon_image()
        logger.info(f"  ✓ Icon image created: size={icon_image.size} mode={icon_image.mode}")

        logger.info("[2/5] Creating tray menu...")
        logger.info(f"  Calling _create_menu()...")
        menu = self._create_menu()
        logger.info(f"  ✓ Menu created: {menu}")

        logger.info("[3/5] Getting icon title...")
        logger.info(f"  Calling _get_title()...")
        title = self._get_title()
        logger.info(f"  ✓ Title: '{title}'")

        logger.info("[4/5] Creating pystray.Icon instance...")
        logger.info(f"  name='DeviceSync'")
        logger.info(f"  icon={icon_image}")
        logger.info(f"  title='{title}'")
        logger.info(f"  menu={menu}")
        self.icon = pystray.Icon(
            name="DeviceSync",
            icon=icon_image,
            title=title,
            menu=menu
        )
        logger.info(f"  ✓ pystray.Icon instance created: {self.icon}")

        # Setup periodic network scanning
        logger.info("[5/5] Starting tray icon event loop (BLOCKING CALL)...")
        logger.info("  >> IMPORTANT: Starting WITHOUT setup callback to test")
        logger.info("  >> Will start periodic scan thread manually after icon.run_detached()")

        # Start icon in detached mode (non-blocking)
        logger.info("  Calling icon.run_detached()...")
        self.icon.run_detached()
        logger.info("  ✓ icon.run_detached() returned")

        # Now manually start periodic scan thread
        logger.info("  Calling _setup_periodic_scan manually...")
        self._setup_periodic_scan(self.icon)
        logger.info("  ✓ _setup_periodic_scan completed")

        logger.info("  >> Check system tray for icon!")
        logger.info("  >> Main thread will now block indefinitely...")

        # Keep main thread alive (no except block per user request)
        logger.info("  Entering infinite loop to keep main thread alive...")
        logger.info("  (Use Exit menu item to quit)")
        while self.running:
            time.sleep(1)

        logger.info("!!! Tray icon main loop ENDED (self.running=False) !!!")

    def stop(self):
        """Stop tray menu"""
        logger.info("Stopping tray menu...")

        # Clear running flag to stop periodic scan thread
        self.running = False
        logger.info(f"  self.running = {self.running}")

        # Stop tray icon
        if self.icon:
            logger.info("  Stopping tray icon...")
            self.icon.stop()
            logger.info("  Tray icon stopped")

        logger.info("Tray menu stopped")

    def _setup_periodic_scan(self, icon):
        """
        Setup periodic network scanning (called after tray icon is ready)

        This runs in the tray icon thread and schedules periodic scans.

        NOTE: icon.visible may be False during setup callback, so we use
        self.running flag instead of relying on icon.visible.
        """
        logger.info("=" * 70)
        logger.info("SETUP CALLBACK INVOKED")
        logger.info("=" * 70)
        logger.info(f"  icon parameter: {icon}")
        logger.info(f"  icon type: {type(icon)}")
        logger.info(f"  icon.visible: {icon.visible}  <<< May be False during setup!")
        logger.info(f"  icon.name: {icon.name}")
        logger.info(f"  self.running: {self.running}  <<< Using this flag instead")

        def periodic_scan():
            logger.info(">>> Periodic scan thread STARTED")
            logger.info(f"    Initial: self.running={self.running}, icon.visible={icon.visible}")
            counter = 0

            # Use self.running instead of icon.visible (which may be False during setup)
            while self.running:
                counter += 1
                logger.debug(f"Periodic scan tick #{counter} (running={self.running})")

                # Scan if in SECONDARY mode
                self.scanner.scan_if_needed(interval=self.SCAN_INTERVAL)

                # Update icon title
                icon.title = self._get_title()

                # Sleep for a bit (increased to reduce CPU usage)
                time.sleep(10)

            logger.info(f"<<< Periodic scan thread ENDED after {counter} ticks")
            logger.info(f"    Final: self.running={self.running}, icon.visible={icon.visible}")

        # Run periodic scan in a separate thread
        logger.info("Creating periodic scan thread...")
        import threading
        scan_thread = threading.Thread(target=periodic_scan, daemon=True)
        logger.info(f"  Thread created: {scan_thread}")
        logger.info(f"  Thread name: {scan_thread.name}")
        logger.info(f"  Thread daemon: {scan_thread.daemon}")

        logger.info("Starting scan thread...")
        scan_thread.start()
        logger.info(f"  ✓ Thread started, is_alive={scan_thread.is_alive()}")

        logger.info("=" * 70)
        logger.info("SETUP CALLBACK COMPLETED")
        logger.info("=" * 70)

    def _get_title(self) -> str:
        """Get tray icon title based on current mode"""
        mode = "PRIMARY" if self.config.isPrimaryServer else "SECONDARY"
        sync_status = ""

        if not self.config.isPrimaryServer:
            if self.config.sync_enabled:
                sync_status = " (Sync ON)"
            else:
                primary_count = len(self.config.primary_servers)
                if primary_count == 1:
                    sync_status = " (Sync OFF)"
                elif primary_count > 1:
                    sync_status = f" ({primary_count} PRIMARY servers!)"
                else:
                    sync_status = " (No PRIMARY)"

        return f"Device Sync - {mode}{sync_status}"

    def _create_menu(self):
        """Create tray menu (unified architecture)"""
        logger.info("  >> _create_menu() called")
        logger.info("  >> Using method references instead of lambda")

        # Create Mode submenu
        logger.info("  [a] Creating 'Set as PRIMARY' menu item...")
        item_primary = pystray.MenuItem(
            "Set as PRIMARY",
            self._on_set_primary,
            checked=self._is_primary_checked
        )
        logger.info(f"      ✓ Created: {item_primary}")

        logger.info("  [b] Creating 'Set as SECONDARY' menu item...")
        item_secondary = pystray.MenuItem(
            "Set as SECONDARY",
            self._on_set_secondary,
            checked=self._is_secondary_checked
        )
        logger.info(f"      ✓ Created: {item_secondary}")

        logger.info("  [c] Creating Mode submenu...")
        mode_menu = pystray.Menu(item_primary, item_secondary)
        logger.info(f"      ✓ Mode submenu: {mode_menu}")

        # Create other menu items
        logger.info("  [d] Creating 'Enable API Access' item...")
        item_api = pystray.MenuItem(
            "Enable API Access",
            self._on_toggle_api,
            checked=self._is_api_enabled_checked,
            enabled=self._is_primary_mode_enabled
        )
        logger.info(f"      ✓ Created: {item_api}")

        logger.info("  [e] Creating 'Scan node_modules' item...")
        item_scan_nm = pystray.MenuItem(
            "Scan node_modules",
            self._on_toggle_scan_node_modules,
            checked=self._is_scan_nm_checked,
            enabled=self._is_primary_mode_enabled
        )
        logger.info(f"      ✓ Created: {item_scan_nm}")

        logger.info("  [f] Creating 'Enable Sync' item...")
        item_sync = pystray.MenuItem(
            "Enable Sync",
            self._on_toggle_sync,
            checked=self._is_sync_enabled_checked,
            enabled=self._is_secondary_mode_enabled
        )
        logger.info(f"      ✓ Created: {item_sync}")

        logger.info("  [g] Creating 'Scan Network' item...")
        item_scan_net = pystray.MenuItem(
            "Scan Network",
            self._on_scan_network,
            enabled=self._is_secondary_mode_enabled
        )
        logger.info(f"      ✓ Created: {item_scan_net}")

        logger.info("  [h] Creating 'Open Web UI' item...")
        item_web = pystray.MenuItem("Open Web UI", self._on_open_web)
        logger.info(f"      ✓ Created: {item_web}")

        logger.info("  [i] Creating 'Status' item...")
        item_status = pystray.MenuItem("Status", self._on_show_status)
        logger.info(f"      ✓ Created: {item_status}")

        logger.info("  [j] Creating 'Exit' item...")
        item_exit = pystray.MenuItem("Exit", self._on_exit)
        logger.info(f"      ✓ Created: {item_exit}")

        # Assemble main menu
        logger.info("  [k] Assembling main menu...")
        menu = pystray.Menu(
            pystray.MenuItem("Mode", mode_menu),
            pystray.Menu.SEPARATOR,
            item_api,
            item_scan_nm,
            pystray.Menu.SEPARATOR,
            item_sync,
            item_scan_net,
            pystray.Menu.SEPARATOR,
            item_web,
            item_status,
            pystray.Menu.SEPARATOR,
            item_exit
        )
        logger.info(f"      ✓ Main menu assembled: {menu}")

        logger.info("  << _create_menu() returning")
        return menu

    # ========== Menu State Check Methods (replace lambda) ==========

    def _is_primary_checked(self, item):
        """Check if PRIMARY mode is active"""
        return self.config.isPrimaryServer

    def _is_secondary_checked(self, item):
        """Check if SECONDARY mode is active"""
        return not self.config.isPrimaryServer

    def _is_api_enabled_checked(self, item):
        """Check if API access is enabled"""
        return self.config.api_enabled

    def _is_scan_nm_checked(self, item):
        """Check if node_modules scanning is enabled"""
        return self.config.scan_node_modules

    def _is_sync_enabled_checked(self, item):
        """Check if sync is enabled"""
        return self.config.sync_enabled

    def _is_primary_mode_enabled(self, item):
        """Check if menu item should be enabled in PRIMARY mode"""
        return self.config.isPrimaryServer

    def _is_secondary_mode_enabled(self, item):
        """Check if menu item should be enabled in SECONDARY mode"""
        return not self.config.isPrimaryServer

    # ========== Icon Creation ==========

    def _create_icon_image(self):
        """Create tray icon image"""
        # Create simple icon with geometric shapes (no text/font required)
        image = Image.new('RGB', (64, 64), color=(73, 109, 137))
        dc = ImageDraw.Draw(image)

        # Draw sync symbol using arrows
        # Top arrow pointing right
        dc.polygon([(20, 20), (30, 15), (30, 25)], fill=(255, 255, 255))
        dc.rectangle([20, 18, 30, 22], fill=(255, 255, 255))

        # Bottom arrow pointing left
        dc.polygon([(44, 44), (34, 39), (34, 49)], fill=(255, 255, 255))
        dc.rectangle([34, 42, 44, 46], fill=(255, 255, 255))

        # Circle in center
        dc.ellipse([28, 28, 36, 36], fill=(255, 200, 0))

        return image

    def _on_set_primary(self):
        """Handle 'Set as PRIMARY' menu click (unified architecture)"""
        logger.info("User clicked: Set as PRIMARY")
        logger.info(f"  BEFORE: isPrimaryServer={self.config.isPrimaryServer}, api_enabled={self.config.api_enabled}")

        # Update config (HTTP server continues running)
        self.config.set_as_primary()

        logger.info(f"  AFTER: isPrimaryServer={self.config.isPrimaryServer}, api_enabled={self.config.api_enabled}")

        # Disable sync if it was enabled
        if self.config.sync_enabled:
            self.config.disable_sync()

        # Update icon title
        if self.icon:
            self.icon.title = self._get_title()

        logger.info("✓ Set as PRIMARY server (HTTP server continues running)")
        logger.info(f"  GlobalConfig id: {id(self.config)}")
        logger.info(f"  Config device_id: {self.config.device_id}")

    def _on_set_secondary(self):
        """Handle 'Set as SECONDARY' menu click (unified architecture)"""
        logger.info("User clicked: Set as SECONDARY")

        # Update config (HTTP server continues running)
        self.config.set_as_secondary()

        # Trigger immediate network scan
        self.scanner.scan_if_needed(force=True)

        # Update icon title
        if self.icon:
            self.icon.title = self._get_title()

        logger.info("✓ Set as SECONDARY (HTTP server continues running, sync disabled by default)")

    def _on_toggle_api(self):
        """Handle 'Enable API Access' menu toggle"""
        if self.config.api_enabled:
            logger.info("User clicked: Disable API access")
            self.config.disable_api()
            logger.info("✓ API access disabled - /api/status is still accessible")
        else:
            logger.info("User clicked: Enable API access")
            self.config.enable_api()
            logger.info("✓ API access enabled - Clients can now sync files")

        # Update icon title
        if self.icon:
            self.icon.title = self._get_title()

    def _on_toggle_scan_node_modules(self):
        """Handle 'Scan node_modules' menu toggle"""
        if self.config.scan_node_modules:
            logger.info("User clicked: Disable node_modules scanning")
            self.config.scan_node_modules = False
            # Clear cache to force rebuild
            self.config.file_cache = []
            logger.info("✓ node_modules scanning disabled")
        else:
            logger.info("User clicked: Enable node_modules scanning")
            self.config.scan_node_modules = True
            # Clear cache to force rebuild
            self.config.file_cache = []
            logger.info("✓ node_modules scanning enabled")

    def _on_toggle_sync(self):
        """Handle 'Enable Sync' menu toggle (unified architecture)"""
        if self.config.sync_enabled:
            logger.info("User clicked: Disable sync")
            self.config.disable_sync()
            logger.info("✓ Sync disabled")
        else:
            logger.info("User clicked: Enable sync")

            # Check if sync can be enabled
            if self.config.isPrimaryServer:
                logger.warning("Cannot enable sync: This is PRIMARY server")
                self._show_message("Cannot Enable Sync", "PRIMARY servers cannot sync")
                return

            # Check PRIMARY server availability
            if len(self.config.primary_servers) == 0:
                logger.warning("Cannot enable sync: No PRIMARY servers found")
                self._show_message("Cannot Enable Sync", "No PRIMARY servers found on network")
                return

            if len(self.config.primary_servers) > 1:
                logger.warning(f"Cannot enable sync: Multiple PRIMARY servers found ({len(self.config.primary_servers)})")
                self._show_message("Cannot Enable Sync", f"Multiple PRIMARY servers found ({len(self.config.primary_servers)}). Only one allowed.")
                return

            # Check if trying to connect to self
            primary = self.config.primary_servers[0]
            if primary['ip'] == self.config.local_ip:
                logger.warning("Cannot enable sync: Cannot connect to self")
                self._show_message("Cannot Enable Sync", "Cannot sync to self")
                return

            # Enable sync
            self.config.enable_sync()
            self.config.primary_server_ip = primary['ip']
            logger.info(f"✓ Sync enabled - Connected to {primary['ip']}")

        # Update icon title
        if self.icon:
            self.icon.title = self._get_title()

    def _on_scan_network(self):
        """Handle 'Scan Network' menu click"""
        logger.info("User clicked: Scan Network")

        # Force immediate scan
        self.scanner.scan_if_needed(force=True)

        # Show result
        primary_count = len(self.config.primary_servers)
        if primary_count == 0:
            msg = "No PRIMARY servers found on network"
        elif primary_count == 1:
            primary = self.config.primary_servers[0]
            msg = f"Found 1 PRIMARY server:\n{primary['hostname']} ({primary['ip']})"
        else:
            msg = f"Found {primary_count} PRIMARY servers (multiple servers detected!)"

        self._show_message("Network Scan Complete", msg)

        # Update icon title
        if self.icon:
            self.icon.title = self._get_title()

    def _on_open_web(self):
        """Handle 'Open Web UI' menu click"""
        logger.info("User clicked: Open Web UI")

        # Build URL
        url = f"http://{self.config.local_ip or 'localhost'}:{self.config.http_port}/"
        logger.info(f"Opening Web UI: {url}")

        webbrowser.open(url)

    def _on_show_status(self):
        """Handle 'Status' menu click (unified architecture)"""
        logger.info("User clicked: Status")

        status = self.config.get_status()

        # Build status message
        mode = "PRIMARY" if status['isPrimaryServer'] else "SECONDARY"
        sync = "Enabled" if status['sync_enabled'] else "Disabled"
        api = "Enabled" if status['api_enabled'] else "Disabled"
        scan_nm = "Yes" if status['scan_node_modules'] else "No"

        msg = f"""Device Sync Status (Unified Architecture)

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
Online Devices: {status['online_devices_count']}"""

        if not status['isPrimaryServer']:
            primary_count = len(self.config.primary_servers)
            msg += f"\nPrimary Servers: {primary_count}"
            if status['primary_server_ip']:
                msg += f"\nConnected To: {status['primary_server_ip']}"

        if status['file_cache_count'] > 0:
            msg += f"\n\nFile Cache: {status['file_cache_count']} files"

        if status['total_scans'] > 0:
            msg += f"\nTotal Scans: {status['total_scans']}"
            if status['last_scan_time']:
                msg += f"\nLast Scan: {status['last_scan_time']}"

        if status['connected_clients_count'] > 0:
            msg += f"\nConnected Clients: {status['connected_clients_count']}"

        self._show_message("Device Sync - Status", msg)

    def _on_exit(self):
        """Handle 'Exit' menu click"""
        logger.info("User clicked: Exit")
        logger.info("Exiting Device Sync...")
        self.stop()

    def _show_message(self, title: str, message: str):
        """Show message dialog"""
        root = tk.Tk()
        root.withdraw()
        root.lift()
        root.attributes('-topmost', True)
        messagebox.showinfo(title, message, parent=root)
        root.destroy()

        if self.icon:
            self.icon.title = self._get_title()
