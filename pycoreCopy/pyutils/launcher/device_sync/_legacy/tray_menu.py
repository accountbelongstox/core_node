# -*- coding: utf-8 -*-
"""
Device Sync Tray Menu - Tkinter System Tray Application

Provides system tray UI for device synchronization.

Features:
- System tray icon with menu
- Set as primary/secondary device
- Enable/disable sync
- Restart service
- Status display

Platform: Windows (pystray for system tray)
"""

import sys
import socket
import webbrowser
import threading
import tkinter as tk
from tkinter import messagebox
from typing import Optional, Callable, Dict
from pathlib import Path

# Import device sync components
from .ipc_server import IPCServer, DEFAULT_IPC_PORT
from .device_manager import DeviceManager, DEFAULT_HTTP_PORT
from .logging_config import setup_logging, open_log_directory

# Set up logger
logger = setup_logging(__name__)

# Try to import pystray (for system tray)
try:
    import pystray
    from pystray import MenuItem as TrayMenuItem
    from PIL import Image, ImageDraw
    HAS_PYSTRAY = True
except ImportError:
    HAS_PYSTRAY = False
    logger.warning("pystray not installed, tray icon disabled")


class DeviceSyncTrayMenu:
    """
    Device sync tray menu application.

    This provides a system tray interface for managing device synchronization.

    Features:
    - Single instance enforcement
    - Primary/Secondary mode switching
    - Sync enable/disable
    - Status monitoring
    - Restart/Shutdown controls

    Usage:
        menu = DeviceSyncTrayMenu(root_dir='D:/programing/core_node')
        menu.run()
    """

    def __init__(self, root_dir: str):
        """
        Initialize tray menu application.

        Args:
            root_dir: Root directory for file synchronization
        """
        self.root_dir = Path(root_dir)

        # IPC server for single instance
        self.ipc_server = IPCServer(port=DEFAULT_IPC_PORT)

        # Device manager (centralized control)
        self.device_manager = DeviceManager(
            root_dir=str(root_dir),
            http_port=DEFAULT_HTTP_PORT
        )

        # Tray icon
        self.tray_icon: Optional[pystray.Icon] = None

        # Running state
        self.running = False

        # Register IPC handlers
        self._register_ipc_handlers()

        # Setup device manager callbacks
        self._setup_device_manager_callbacks()

    def run(self):
        """Run tray menu application."""
        # Check single instance
        if self.ipc_server.is_already_running():
            logger.info("Application already running")
            # Don't show dialog in background mode, just exit silently
            return

        # Start IPC server
        if not self.ipc_server.start():
            logger.error("Failed to start IPC server")
            return

        self.running = True

        # Start device manager
        self.device_manager.start()

        # Create and run tray icon directly (no dialog)
        if HAS_PYSTRAY:
            logger.info("Starting in tray mode")
            logger.info("Right-click tray icon to select mode")
            self._create_tray_icon()
            self.tray_icon.run()
        else:
            # Fallback: Run without tray icon
            logger.warning("Running without tray icon (pystray not available)")
            self._run_without_tray()

    def set_as_primary(self, data=None):
        """Set device as primary."""
        logger.info("Setting as PRIMARY device")

        # Use device manager to set mode (auto-closes sync)
        self.device_manager.set_mode('primary')

        # Update tray menu
        self._update_tray_menu()
        self._show_notification("Device Sync", "Set as PRIMARY device\nSync auto-closed. Re-enable if needed.")

    def set_as_secondary(self, data=None):
        """Set device as secondary."""
        logger.info("Setting as SECONDARY device")

        # Use device manager to set mode (auto-closes sync)
        self.device_manager.set_mode('secondary')

        # Update tray menu
        self._update_tray_menu()
        self._show_notification(
            "Device Sync",
            "Set as SECONDARY device\nSync auto-closed. Re-enable if needed."
        )

    def enable_sync(self, data=None):
        """Enable file synchronization."""
        logger.info("Enabling sync...")

        # Use device manager to enable sync (validates primary uniqueness)
        success = self.device_manager.enable_sync()

        if success:
            self._update_tray_menu()
            self._show_notification("Device Sync", "File synchronization ENABLED\nValidated single primary device")
        else:
            self._update_tray_menu()
            self._show_notification(
                "Device Sync - Sync Failed",
                "Cannot enable sync!\nEnsure exactly ONE primary device exists on network.",
                icon_type='error'
            )

    def disable_sync(self, data=None):
        """Disable file synchronization."""
        logger.info("Disabling sync...")

        # Use device manager to disable sync
        self.device_manager.disable_sync()

        self._update_tray_menu()
        self._show_notification("Device Sync", "File synchronization DISABLED")

    def is_sync_enabled(self) -> bool:
        """Check if sync is enabled."""
        return self.device_manager.sync_enabled

    def restart_service(self):
        """Restart synchronization service."""
        logger.info("Restarting service...")

        # Device manager will handle restart
        # For now, just log
        logger.info("Service restart requested")

    def shutdown(self):
        """Shutdown application."""
        logger.info("Shutting down...")

        self.running = False

        # Stop device manager
        self.device_manager.stop()

        # Stop IPC server
        self.ipc_server.stop()

        # Stop tray icon
        if self.tray_icon:
            self.tray_icon.stop()

        logger.info("Shutdown complete")

    def _create_tray_icon(self):
        """Create system tray icon."""
        # Create icon image
        icon_image = self._create_icon_image()

        # Create tray icon
        self.tray_icon = pystray.Icon(
            name="DeviceSync",
            icon=icon_image,
            title="Device Sync",
            menu=self._create_tray_menu()
        )

    def _create_icon_image(self):
        """
        Create tray icon image.

        Returns:
            PIL Image
        """
        # Create simple icon (32x32)
        img = Image.new('RGB', (32, 32), color='white')
        draw = ImageDraw.Draw(img)

        # Draw colored circle based on mode
        mode = self.device_manager.mode
        color = 'blue' if mode == 'primary' else 'green' if mode == 'secondary' else 'gray'
        draw.ellipse([4, 4, 28, 28], fill=color, outline='black')

        return img

    def _create_tray_menu(self):
        """
        Create tray menu.

        Returns:
            pystray.Menu
        """
        # Get status from device manager
        mode = self.device_manager.mode
        sync_enabled = self.device_manager.sync_enabled

        mode_text = mode.upper() if mode else 'NOT SET'
        sync_status = ''
        if mode:
            sync_status = ' (Sync: ON)' if sync_enabled else ' (Sync: OFF)'

        # Check for primary device conflict
        conflict_detected = False
        conflict_count = self.device_manager.get_primary_count()
        if conflict_count > 1:
            conflict_detected = True

        # Build menu items
        menu_items = []

        # Conflict warning (if detected)
        if conflict_detected:
            menu_items.extend([
                TrayMenuItem(
                    f"⚠ CONFLICT: {conflict_count} Primary Devices!",
                    lambda: None,
                    enabled=False
                ),
                TrayMenuItem(
                    "Sync DISABLED - Data Corruption Risk",
                    lambda: None,
                    enabled=False
                ),
                pystray.Menu.SEPARATOR,
            ])

        # Status section
        menu_items.extend([
            TrayMenuItem(
                f"Device Sync - {mode_text}{sync_status}",
                lambda: None,
                enabled=False
            ),
            pystray.Menu.SEPARATOR,
        ])

        # Mode selection (with checkmarks)
        menu_items.extend([
            TrayMenuItem(
                "Set as Primary Device",
                lambda: self._menu_action(self.set_as_primary),
                checked=lambda item: self.device_manager.mode == 'primary'
            ),
            TrayMenuItem(
                "Set as Secondary Device",
                lambda: self._menu_action(self.set_as_secondary),
                checked=lambda item: self.device_manager.mode == 'secondary'
            ),
            pystray.Menu.SEPARATOR,
        ])

        # Show IP and Port (always show, server always running)
        local_ip = self.device_manager.device_discovery.local_ip
        http_port = self.device_manager.http_port

        menu_items.extend([
            TrayMenuItem(
                f"HTTP Server: {local_ip}:{http_port}",
                lambda: None,
                enabled=False
            ),
            TrayMenuItem(
                f"Web UI: http://{local_ip}:{http_port}",
                lambda: self._menu_action(lambda: self._open_web_ui(f"http://{local_ip}:{http_port}")),
                enabled=True
            ),
            pystray.Menu.SEPARATOR,
        ])

        # Sync control (only for secondary mode)
        if mode == 'secondary':
            menu_items.extend([
                TrayMenuItem(
                    "Enable Sync",
                    lambda: self._menu_action(self.enable_sync),
                    enabled=not sync_enabled
                ),
                TrayMenuItem(
                    "Disable Sync",
                    lambda: self._menu_action(self.disable_sync),
                    enabled=sync_enabled
                ),
                pystray.Menu.SEPARATOR,
            ])

        # Service control
        menu_items.extend([
            TrayMenuItem(
                "Restart Service",
                lambda: self._menu_action(self.restart_service),
                enabled=mode is not None
            ),
            TrayMenuItem(
                "Show Status",
                lambda: self._menu_action(self._show_status_window)
            ),
            TrayMenuItem(
                "Show Logs",
                lambda: self._menu_action(self._open_logs)
            ),
            TrayMenuItem(
                "Show Sync History",
                lambda: self._menu_action(self._show_sync_history)
            ),
            pystray.Menu.SEPARATOR,
            TrayMenuItem(
                "Exit",
                lambda: self._menu_action(self.shutdown)
            )
        ])

        return pystray.Menu(*menu_items)

    def _menu_action(self, action: Callable):
        """
        Execute menu action in separate thread.

        Args:
            action: Action callable
        """
        threading.Thread(target=action, daemon=True).start()

    def _update_tray_menu(self):
        """Update tray menu."""
        if self.tray_icon:
            self.tray_icon.menu = self._create_tray_menu()
            self.tray_icon.icon = self._create_icon_image()

    def _show_notification(self, title: str, message: str, icon_type: str = 'info'):
        """
        Show system notification via tray icon.

        Args:
            title: Notification title
            message: Notification message
            icon_type: Icon type ('info', 'warning', 'error')
        """
        if not HAS_PYSTRAY or not self.tray_icon:
            logger.info(f"[Notification] {title}: {message}")
            return

        # Map icon type to pystray icon
        if icon_type == 'warning':
            icon = pystray.Icon.NOTIFY_WARNING if hasattr(pystray.Icon, 'NOTIFY_WARNING') else None
        elif icon_type == 'error':
            icon = pystray.Icon.NOTIFY_ERROR if hasattr(pystray.Icon, 'NOTIFY_ERROR') else None
        else:
            icon = None

        # Show notification
        try:
            self.tray_icon.notify(title, message)
        except Exception as e:
            logger.warning(f"Failed to show notification: {e}")
            logger.info(f"[Notification] {title}: {message}")

    def _on_conflict_detected(self, conflict_info: Dict):
        """
        Callback when conflict is detected.

        Args:
            conflict_info: Conflict information
        """
        count = conflict_info.get('count', 0)
        hosts = conflict_info.get('conflict_hosts', [])

        logger.error(f"CONFLICT: {count} primary devices detected")
        logger.error(f"Conflicting hosts: {', '.join(hosts)}")

        # Update tray menu to show warning
        self._update_tray_menu()

        # Show notification
        self._show_notification(
            "Device Sync - CONFLICT DETECTED",
            f"Multiple primary devices found: {count}\n\nSync has been DISABLED to prevent data corruption\n\nHosts: {', '.join(hosts[:3])}",
            icon_type='error'
        )

    def _show_status_window(self, data=None):
        """Show status window with current statistics."""
        # Build status text
        status_lines = ["Device Sync - Status", "=" * 50, ""]

        mode = self.device_manager.mode
        if mode == 'primary':
            stats = self.device_manager.unified_server.get_cache_stats() if self.device_manager.unified_server else {}
            status_lines.extend([
                "Device Mode: PRIMARY",
                f"Files Cached: {stats.get('file_count', 0)}",
                f"Total Size: {stats.get('total_size_mb', 0)} MB",
                f"Server Port: {DEFAULT_HTTP_PORT}",
                "",
                "Serving files to secondary devices on network"
            ])
        elif mode == 'secondary':
            stats = self.device_manager.http_client.get_sync_stats() if self.device_manager.http_client else {}
            status_lines.extend([
                "Device Mode: SECONDARY",
                f"Primary Host: {stats.get('primary_host', 'Unknown')}",
                f"Sync Enabled: {'YES' if stats.get('enabled', False) else 'NO'}",
                f"Files Synced: {stats.get('total_synced', 0)}",
                f"Downloaded: {stats.get('total_downloaded_mb', 0)} MB",
            ])

            # Show conflict warning if detected
            if stats.get('conflict_detected', False):
                conflict_info = stats.get('conflict_info', {})
                conflict_count = conflict_info.get('count', 0)
                conflict_hosts = conflict_info.get('hosts', [])
                status_lines.extend([
                    "",
                    "⚠ WARNING: CONFLICT DETECTED ⚠",
                    f"Multiple Primary Devices Found: {conflict_count}",
                    f"Conflicting Hosts: {', '.join(conflict_hosts)}",
                    "",
                    "Sync has been DISABLED to prevent data corruption!",
                    "Please ensure only ONE primary device is running."
                ])
            else:
                status_lines.extend([
                    "",
                    "Syncing from primary device" if stats.get('enabled') else "Sync is disabled"
                ])
        else:
            status_lines.extend([
                "Device Mode: NOT SET",
                "",
                "Right-click tray icon to:",
                "- Set as Primary Device (serve files)",
                "- Set as Secondary Device (sync files)"
            ])

        status_text = "\n".join(status_lines)

        # Show in dialog
        root = tk.Tk()
        root.withdraw()
        messagebox.showinfo("Device Sync - Status", status_text)
        root.destroy()

    def _run_without_tray(self):
        """Run without tray icon (fallback mode)."""
        print("\n" + "=" * 60)
        print("Device Sync - Console Mode")
        print("=" * 60)
        print("Warning: pystray not installed, running in console mode")
        print("Install pystray for system tray support:")
        print("  pip install pystray pillow")
        print("=" * 60)

        self._print_menu()

        while self.running:
            try:
                cmd = input("\n> ").strip().lower()

                if cmd == '1':
                    self.set_as_primary()
                elif cmd == '2':
                    self.set_as_secondary()
                elif cmd == 'e':
                    self.enable_sync()
                elif cmd == 'd':
                    self.disable_sync()
                elif cmd == 'r':
                    self.restart_service()
                elif cmd == 's':
                    self._print_status()
                elif cmd == 'm':
                    self._print_menu()
                elif cmd == 'q':
                    self.shutdown()
                    break
                else:
                    print("Unknown command. Type 'm' for menu.")
            except KeyboardInterrupt:
                print("\nShutting down...")
                self.shutdown()
                break
            except EOFError:
                print("\nEOF received, shutting down...")
                self.shutdown()
                break

    def _print_menu(self):
        """Print console menu."""
        mode = self.device_manager.mode
        mode_text = mode.upper() if mode else 'NOT SET'
        sync_status = ''
        if mode == 'secondary':
            sync_status = ' (Sync: ON)' if self.device_manager.sync_enabled else ' (Sync: OFF)'

        print(f"\nCurrent Mode: {mode_text}{sync_status}")
        print("\nCommands:")
        print("  1 - Set as Primary Device")
        print("  2 - Set as Secondary Device")
        if mode == 'secondary':
            print("  e - Enable Sync")
            print("  d - Disable Sync")
        print("  r - Restart Service")
        print("  s - Show Status")
        print("  m - Show Menu")
        print("  q - Quit")

    def _print_status(self):
        """Print status to console."""
        print("\n" + "=" * 60)
        print("Device Sync Status")
        print("=" * 60)

        mode = self.device_manager.mode
        if mode == 'primary':
            stats = self.device_manager.unified_server.get_cache_stats() if self.device_manager.unified_server else {}
            print(f"Mode: PRIMARY")
            print(f"Files Cached: {stats.get('file_count', 0)}")
            print(f"Total Size: {stats.get('total_size_mb', 0)} MB")
            print(f"Server Port: {DEFAULT_HTTP_PORT}")
        elif mode == 'secondary':
            stats = self.device_manager.http_client.get_sync_stats() if self.device_manager.http_client else {}
            print(f"Mode: SECONDARY")
            print(f"Primary Host: {stats.get('primary_host', 'Unknown')}")
            print(f"Sync Enabled: {stats.get('enabled', False)}")
            print(f"Files Synced: {stats.get('total_synced', 0)}")
            print(f"Downloaded: {stats.get('total_downloaded_mb', 0)} MB")

            # Show conflict warning if detected
            if stats.get('conflict_detected', False):
                conflict_info = stats.get('conflict_info', {})
                conflict_count = conflict_info.get('count', 0)
                conflict_hosts = conflict_info.get('hosts', [])
                print("")
                print("⚠ WARNING: CONFLICT DETECTED ⚠")
                print(f"Multiple Primary Devices: {conflict_count}")
                print(f"Hosts: {', '.join(conflict_hosts)}")
                print("Sync DISABLED to prevent data corruption!")
        else:
            print("Mode: NONE")

        print("=" * 60)

    def _get_local_ip(self) -> str:
        """Get local IP address."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(1)
            s.connect(('8.8.8.8', 80))
            local_ip = s.getsockname()[0]
            s.close()
            return local_ip
        except Exception:
            try:
                hostname = socket.gethostname()
                return socket.gethostbyname(hostname)
            except Exception:
                return '127.0.0.1'

    def _open_web_ui(self, url: str):
        """Open Web UI in browser."""
        logger.info(f"Opening Web UI: {url}")
        webbrowser.open(url)

    def _open_logs(self):
        """Open log directory in file explorer."""
        logger.info("Opening log directory")
        try:
            open_log_directory()
        except Exception as e:
            logger.error(f"Failed to open log directory: {e}", exc_info=True)

    def _show_sync_history(self):
        """Show sync history window."""
        logger.info("Showing sync history")
        try:
            # Get history from tracker
            history = self.device_manager.history_tracker.get_recent_history(limit=50)
            stats = self.device_manager.history_tracker.get_statistics()

            # Build history text
            history_lines = ["=" * 80, "Device Sync - History", "=" * 80, ""]

            # Statistics
            history_lines.extend([
                "Statistics:",
                f"  Total Events: {stats.get('total_events', 0)}",
                f"  Last 24 Hours: {stats.get('last_24h', 0)}",
                f"  Retention: {stats.get('retention_days', 3)} days",
                ""
            ])

            # Events by type
            events_by_type = stats.get('events_by_type', {})
            if events_by_type:
                history_lines.append("Events by Type:")
                for event_type, count in events_by_type.items():
                    history_lines.append(f"  {event_type}: {count}")
                history_lines.append("")

            # Latest event
            latest = stats.get('latest_event')
            if latest:
                history_lines.extend([
                    f"Latest Event: {latest.get('message')}",
                    f"  Time: {latest.get('timestamp')}",
                    ""
                ])

            history_lines.extend(["=" * 80, "Recent History (50 entries)", "=" * 80, ""])

            # History entries
            for entry in history:
                timestamp = entry.get('timestamp', '')
                event_type = entry.get('event_type', '').upper()
                status = entry.get('status', '')
                message = entry.get('message', '')
                device_name = entry.get('device_name', '')

                # Status symbol
                status_symbol = {
                    'success': '✓',
                    'failed': '✗',
                    'warning': '⚠'
                }.get(status, '•')

                history_lines.append(f"[{timestamp}] {status_symbol} {event_type}")
                history_lines.append(f"  {message}")
                if device_name:
                    history_lines.append(f"  Device: {device_name}")
                history_lines.append("")

            if not history:
                history_lines.append("No history entries found.")

            history_text = "\n".join(history_lines)

            # Create window to display history
            self._show_text_window("Sync History", history_text)

        except Exception as e:
            logger.error(f"Failed to show sync history: {e}", exc_info=True)
            self._show_notification(
                "Device Sync - Error",
                f"Failed to show sync history: {e}",
                icon_type='error'
            )

    def _show_text_window(self, title: str, text: str):
        """Show text in a tkinter window."""
        try:
            import tkinter as tk
            from tkinter import scrolledtext

            # Create window
            window = tk.Tk()
            window.title(title)
            window.geometry("800x600")

            # Create scrolled text widget
            text_widget = scrolledtext.ScrolledText(
                window,
                wrap=tk.WORD,
                font=("Courier New", 9)
            )
            text_widget.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

            # Insert text
            text_widget.insert(tk.END, text)
            text_widget.config(state=tk.DISABLED)  # Make read-only

            # Add button frame
            button_frame = tk.Frame(window)
            button_frame.pack(fill=tk.X, padx=5, pady=5)

            # Export button
            def export_history():
                try:
                    output_path = self.device_manager.history_tracker.export_to_text()
                    if output_path:
                        self._show_notification(
                            "Device Sync",
                            f"History exported to:\n{output_path}"
                        )
                except Exception as e:
                    logger.error(f"Export failed: {e}", exc_info=True)

            export_btn = tk.Button(
                button_frame,
                text="Export to File",
                command=export_history
            )
            export_btn.pack(side=tk.LEFT, padx=5)

            # Close button
            close_btn = tk.Button(
                button_frame,
                text="Close",
                command=window.destroy
            )
            close_btn.pack(side=tk.RIGHT, padx=5)

            # Run window
            window.mainloop()

        except Exception as e:
            logger.error(f"Failed to create text window: {e}", exc_info=True)

    def _register_ipc_handlers(self):
        """Register IPC command handlers."""
        self.ipc_server.register_handler('restart', lambda data: self.restart_service(data))
        self.ipc_server.register_handler('shutdown', lambda data: self.shutdown())
        self.ipc_server.register_handler('set_primary', self.set_as_primary)
        self.ipc_server.register_handler('set_secondary', self.set_as_secondary)
        self.ipc_server.register_handler('enable_sync', self.enable_sync)
        self.ipc_server.register_handler('disable_sync', self.disable_sync)

    def _setup_device_manager_callbacks(self):
        """Setup device manager event callbacks."""
        def on_mode_changed(old_mode, new_mode):
            logger.info(f"Mode changed: {old_mode} → {new_mode}")
            self._update_tray_menu()

        def on_sync_changed(enabled):
            logger.info(f"Sync changed: {enabled}")
            self._update_tray_menu()

        def on_device_list_changed():
            logger.debug("Device list changed")
            # Could update tray menu submenu showing devices

        def on_conflict_detected(conflict_info):
            count = conflict_info.get('count', 0)
            logger.error(f"Conflict detected: {count} primary devices")
            self._update_tray_menu()
            self._show_notification(
                "Device Sync - CONFLICT",
                f"Multiple primary devices detected: {count}\nSync has been disabled!",
                icon_type='error'
            )

        self.device_manager.on_mode_changed = on_mode_changed
        self.device_manager.on_sync_changed = on_sync_changed
        self.device_manager.on_device_list_changed = on_device_list_changed
        self.device_manager.on_conflict_detected = on_conflict_detected


# Main entry point
def main():
    """Main entry point."""
    # Get root directory from command line or use default
    if len(sys.argv) > 1:
        root_dir = sys.argv[1]
    else:
        root_dir = 'D:/programing/core_node'

    # Create and run tray menu
    menu = DeviceSyncTrayMenu(root_dir=root_dir)
    menu.run()


if __name__ == '__main__':
    main()
