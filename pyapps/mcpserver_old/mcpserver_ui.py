#!/usr/bin/env python3
"""
MCP Server UI - Window and Tray Interface

Global MCP Server with native UI:
- Shows server status in a window
- System tray icon for quick access
- Real-time status monitoring
- Start/Stop controls

Usage:
    python mcpserver_ui.py
    python pymain.py app=mcpserver_ui
"""

import sys
import os
import threading
import time
from pathlib import Path
from typing import Optional

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint, THREAD_BUS
from pycore.pyutils.native_ui.launcher_with_startup import launch_app_with_startup

# Import PySide6 components
from PySide6.QtWidgets import QApplication, QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QTextEdit, QFrame
from PySide6.QtCore import Qt, QTimer, Signal, QObject, Slot
from PySide6.QtGui import QFont, QIcon

# Import MCP server
from pyapps.mcpserver.mcpserver_main import UnifiedMCPServer


class MCPServerStatusWidget(QWidget):
    """
    MCP Server Status Widget

    Displays server status, statistics, and logs
    """

    def __init__(self, server_instance: UnifiedMCPServer, parent=None):
        super().__init__(parent)

        self.server = server_instance
        self.init_ui()

        # Setup update timer
        self.update_timer = QTimer(self)
        self.update_timer.timeout.connect(self.update_status)
        self.update_timer.start(1000)  # Update every second

    def init_ui(self):
        """Initialize UI components"""
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)

        # Title
        title = QLabel("MCP Server - Global Backend")
        title.setStyleSheet("""
            QLabel {
                font-size: 24px;
                font-weight: bold;
                color: #2c3e50;
                margin-bottom: 10px;
            }
        """)
        layout.addWidget(title)

        # Status section
        status_frame = self._create_status_section()
        layout.addWidget(status_frame)

        # Statistics section
        stats_frame = self._create_stats_section()
        layout.addWidget(stats_frame)

        # Log section
        log_frame = self._create_log_section()
        layout.addWidget(log_frame, stretch=1)

        # Control buttons
        controls = self._create_controls()
        layout.addLayout(controls)

        self.setLayout(layout)

    def _create_status_section(self):
        """Create status display section"""
        frame = QFrame()
        frame.setFrameStyle(QFrame.Box | QFrame.Raised)
        frame.setStyleSheet("""
            QFrame {
                background-color: #ecf0f1;
                border-radius: 5px;
                padding: 15px;
            }
        """)

        layout = QVBoxLayout()

        # Status indicator
        status_layout = QHBoxLayout()
        status_layout.addWidget(QLabel("Status:"))
        self.status_label = QLabel("RUNNING")
        self.status_label.setStyleSheet("""
            QLabel {
                font-weight: bold;
                color: #27ae60;
                font-size: 16px;
            }
        """)
        status_layout.addWidget(self.status_label)
        status_layout.addStretch()
        layout.addLayout(status_layout)

        # Role
        role_layout = QHBoxLayout()
        role_layout.addWidget(QLabel("Role:"))
        self.role_label = QLabel("PRIMARY")
        self.role_label.setStyleSheet("font-weight: bold;")
        role_layout.addWidget(self.role_label)
        role_layout.addStretch()
        layout.addLayout(role_layout)

        # Ports
        ports_layout = QHBoxLayout()
        ports_layout.addWidget(QLabel("RPC Port:"))
        self.rpc_port_label = QLabel("8767")
        ports_layout.addWidget(self.rpc_port_label)
        ports_layout.addWidget(QLabel("  |  Singleton Port:"))
        self.singleton_port_label = QLabel("19997")
        ports_layout.addWidget(self.singleton_port_label)
        ports_layout.addStretch()
        layout.addLayout(ports_layout)

        frame.setLayout(layout)
        return frame

    def _create_stats_section(self):
        """Create statistics display section"""
        frame = QFrame()
        frame.setFrameStyle(QFrame.Box | QFrame.Raised)
        frame.setStyleSheet("""
            QFrame {
                background-color: #e8f5e9;
                border-radius: 5px;
                padding: 15px;
            }
        """)

        layout = QVBoxLayout()

        # Statistics title
        title = QLabel("Statistics")
        title.setStyleSheet("font-weight: bold; font-size: 14px;")
        layout.addWidget(title)

        # Stats grid
        stats_layout = QHBoxLayout()

        # Uptime
        uptime_layout = QVBoxLayout()
        uptime_layout.addWidget(QLabel("Uptime:"))
        self.uptime_label = QLabel("0s")
        self.uptime_label.setStyleSheet("font-weight: bold; color: #2c3e50;")
        uptime_layout.addWidget(self.uptime_label)
        stats_layout.addLayout(uptime_layout)

        # Services loaded
        services_layout = QVBoxLayout()
        services_layout.addWidget(QLabel("Services:"))
        self.services_label = QLabel("0")
        self.services_label.setStyleSheet("font-weight: bold; color: #2c3e50;")
        services_layout.addWidget(self.services_label)
        stats_layout.addLayout(services_layout)

        # Requests
        requests_layout = QVBoxLayout()
        requests_layout.addWidget(QLabel("Requests:"))
        self.requests_label = QLabel("0")
        self.requests_label.setStyleSheet("font-weight: bold; color: #2c3e50;")
        requests_layout.addWidget(self.requests_label)
        stats_layout.addLayout(requests_layout)

        # Clients
        clients_layout = QVBoxLayout()
        clients_layout.addWidget(QLabel("Clients:"))
        self.clients_label = QLabel("0")
        self.clients_label.setStyleSheet("font-weight: bold; color: #2c3e50;")
        clients_layout.addWidget(self.clients_label)
        stats_layout.addLayout(clients_layout)

        stats_layout.addStretch()
        layout.addLayout(stats_layout)

        frame.setLayout(layout)
        return frame

    def _create_log_section(self):
        """Create log display section"""
        frame = QFrame()
        frame.setFrameStyle(QFrame.Box | QFrame.Raised)

        layout = QVBoxLayout()

        # Log title
        title = QLabel("Server Log")
        title.setStyleSheet("font-weight: bold; font-size: 14px;")
        layout.addWidget(title)

        # Log text area
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setStyleSheet("""
            QTextEdit {
                background-color: #2c3e50;
                color: #ecf0f1;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                border: none;
            }
        """)
        layout.addWidget(self.log_text)

        frame.setLayout(layout)
        return frame

    def _create_controls(self):
        """Create control buttons"""
        layout = QHBoxLayout()

        # Refresh button
        refresh_btn = QPushButton("Refresh Status")
        refresh_btn.clicked.connect(self.update_status)
        refresh_btn.setStyleSheet("""
            QPushButton {
                background-color: #3498db;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #2980b9;
            }
        """)
        layout.addWidget(refresh_btn)

        # Clear log button
        clear_btn = QPushButton("Clear Log")
        clear_btn.clicked.connect(lambda: self.log_text.clear())
        clear_btn.setStyleSheet("""
            QPushButton {
                background-color: #95a5a6;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #7f8c8d;
            }
        """)
        layout.addWidget(clear_btn)

        layout.addStretch()

        # Minimize to tray button
        minimize_btn = QPushButton("Minimize to Tray")
        minimize_btn.clicked.connect(self.hide_window)
        minimize_btn.setStyleSheet("""
            QPushButton {
                background-color: #f39c12;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #e67e22;
            }
        """)
        layout.addWidget(minimize_btn)

        return layout

    def update_status(self):
        """Update status display"""
        if not self.server or not self.server.is_running():
            self.status_label.setText("STOPPED")
            self.status_label.setStyleSheet("font-weight: bold; color: #e74c3c; font-size: 16px;")
            return

        # Update role
        role = "PRIMARY" if self.server.is_primary_instance() else "SECONDARY"
        self.role_label.setText(role)

        # Update statistics
        stats = self.server.service_stats
        uptime = int(time.time() - stats['start_time'])

        hours = uptime // 3600
        minutes = (uptime % 3600) // 60
        seconds = uptime % 60

        if hours > 0:
            uptime_str = f"{hours}h {minutes}m {seconds}s"
        elif minutes > 0:
            uptime_str = f"{minutes}m {seconds}s"
        else:
            uptime_str = f"{seconds}s"

        self.uptime_label.setText(uptime_str)
        self.services_label.setText(str(len(stats['services_loaded'])))
        self.requests_label.setText(str(stats['total_requests']))

        # Update clients count
        if hasattr(self.server, 'rpc_server') and self.server.rpc_server:
            clients = len(self.server.rpc_server.clients)
            self.clients_label.setText(str(clients))

    def add_log(self, message: str, level: str = "info"):
        """Add log message"""
        colors = {
            'info': '#3498db',
            'success': '#27ae60',
            'warning': '#f39c12',
            'error': '#e74c3c',
            'debug': '#95a5a6'
        }

        color = colors.get(level, '#ecf0f1')
        timestamp = time.strftime('%H:%M:%S')

        html = f'<span style="color: #95a5a6;">[{timestamp}]</span> <span style="color: {color};">{message}</span><br>'
        self.log_text.moveCursor(self.log_text.textCursor().End)
        self.log_text.insertHtml(html)
        self.log_text.moveCursor(self.log_text.textCursor().End)

    def hide_window(self):
        """Hide window to tray"""
        self.window().hide()


class MCPServerThread(threading.Thread):
    """
    MCP Server background thread

    Runs the MCP server in a separate thread
    """

    def __init__(self):
        super().__init__()
        self.daemon = False
        self.server: Optional[UnifiedMCPServer] = None
        self._stop_event = threading.Event()

    def run(self):
        """Run MCP server"""
        ColorPrint.blue("[MCPServerThread] Starting MCP server...")

        # Set thread state
        THREAD_BUS.set_thread_state('MCPServerThread', 'starting')

        # Create server
        self.server = UnifiedMCPServer(
            singleton_host='localhost',
            singleton_port=19997,
            rpc_host='localhost',
            rpc_port=8767,
            debug=True
        )

        # Set callbacks
        self.server.on_primary_started(
            lambda: ColorPrint.green("[MCPServerThread] Started as PRIMARY instance")
        )
        self.server.on_secondary_started(
            lambda: ColorPrint.green("[MCPServerThread] Started as SECONDARY instance")
        )

        # Start server
        if self.server.start():
            THREAD_BUS.set_thread_state('MCPServerThread', 'running')
            THREAD_BUS.signal('mcp_server_ready', {
                'is_primary': self.server.is_primary_instance(),
                'rpc_port': 8767,
                'singleton_port': 19997
            })

            ColorPrint.green("[MCPServerThread] MCP server is running")

            # Keep running until stop requested
            while not self._stop_event.is_set() and self.server.is_running():
                time.sleep(0.5)

        else:
            ColorPrint.red("[MCPServerThread] Failed to start MCP server")
            THREAD_BUS.signal('mcp_server_error', {'error': 'Failed to start'})

        # Cleanup
        THREAD_BUS.set_thread_state('MCPServerThread', 'stopped')
        ColorPrint.blue("[MCPServerThread] MCP server thread stopped")

    def stop(self):
        """Stop server thread"""
        ColorPrint.yellow("[MCPServerThread] Stopping MCP server...")
        self._stop_event.set()

        if self.server:
            self.server.stop()


def create_main_window(server_thread: MCPServerThread):
    """Create main window with server status"""
    from PySide6.QtWidgets import QMainWindow, QSystemTrayIcon, QMenu
    from PySide6.QtGui import QIcon, QAction

    class MCPServerMainWindow(QMainWindow):
        """Main window for MCP server"""

        def __init__(self, server_thread: MCPServerThread):
            super().__init__()

            self.server_thread = server_thread
            self.setWindowTitle("MCP Server - Global Backend")
            self.setGeometry(100, 100, 900, 700)

            # Create central widget
            self.status_widget = MCPServerStatusWidget(server_thread.server, self)
            self.setCentralWidget(self.status_widget)

            # Create system tray
            self.create_tray_icon()

            # Setup ColorPrint callback
            ColorPrint.register_callback(self.on_colorprint)

        def create_tray_icon(self):
            """Create system tray icon and menu"""
            self.tray_icon = QSystemTrayIcon(self)

            # Set icon
            icon_path = PROJECT_ROOT / "pyapps" / "mcpserver" / "icon.png"
            if icon_path.exists():
                self.tray_icon.setIcon(QIcon(str(icon_path)))
            else:
                # Fallback to default icon
                self.tray_icon.setIcon(self.style().standardIcon(self.style().SP_ComputerIcon))

            # Create menu
            tray_menu = QMenu()

            # Show action
            show_action = QAction("Show Window", self)
            show_action.triggered.connect(self.show_window)
            tray_menu.addAction(show_action)

            # Hide action
            hide_action = QAction("Hide Window", self)
            hide_action.triggered.connect(self.hide)
            tray_menu.addAction(hide_action)

            tray_menu.addSeparator()

            # Status action
            status_action = QAction("Server Status", self)
            status_action.triggered.connect(self.show_status)
            tray_menu.addAction(status_action)

            tray_menu.addSeparator()

            # Quit action
            quit_action = QAction("Quit MCP Server", self)
            quit_action.triggered.connect(self.quit_application)
            tray_menu.addAction(quit_action)

            self.tray_icon.setContextMenu(tray_menu)
            self.tray_icon.setToolTip("MCP Server - Global Backend")

            # Double-click to show window
            self.tray_icon.activated.connect(self.on_tray_activated)

            # Show tray icon
            self.tray_icon.show()

        def on_tray_activated(self, reason):
            """Handle tray icon activation"""
            if reason == QSystemTrayIcon.DoubleClick:
                self.show_window()

        def show_window(self):
            """Show and activate window"""
            self.show()
            self.activateWindow()
            self.raise_()

        def show_status(self):
            """Show status notification"""
            if self.server_thread.server:
                stats = self.server_thread.server.service_stats
                uptime = int(time.time() - stats['start_time'])
                role = "PRIMARY" if self.server_thread.server.is_primary_instance() else "SECONDARY"

                self.tray_icon.showMessage(
                    "MCP Server Status",
                    f"Role: {role}\nUptime: {uptime}s\nRequests: {stats['total_requests']}",
                    QSystemTrayIcon.Information,
                    3000
                )
            else:
                self.tray_icon.showMessage(
                    "MCP Server Status",
                    "Server not running",
                    QSystemTrayIcon.Warning,
                    3000
                )

        def on_colorprint(self, message: str, level: str):
            """Handle ColorPrint messages"""
            if self.status_widget:
                self.status_widget.add_log(message, level)

        def quit_application(self):
            """Quit application"""
            ColorPrint.yellow("Shutting down MCP Server UI...")

            # Stop server thread
            self.server_thread.stop()

            # Hide tray
            self.tray_icon.hide()

            # Unregister ColorPrint
            ColorPrint.unregister_callback(self.on_colorprint)

            # Close window
            self.close()

            # Quit application
            QApplication.instance().quit()

        def closeEvent(self, event):
            """Handle window close event"""
            # Just hide instead of closing
            event.ignore()
            self.hide()

            self.tray_icon.showMessage(
                "MCP Server",
                "Server is still running in the background",
                QSystemTrayIcon.Information,
                2000
            )

    return MCPServerMainWindow(server_thread)


def main_app_entry():
    """Main application entry point"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("MCP Server UI - Main Application")
    ColorPrint.blue("=" * 70)

    # Step 1: Create Qt application FIRST (UI priority)
    ColorPrint.blue("\n[1/3] Initializing Qt Application (Native UI)...")
    app = QApplication.instance()
    if not app:
        app = QApplication(sys.argv)

    # Set application icon
    icon_path = PROJECT_ROOT / "pyapps" / "mcpserver" / "icon.png"
    if icon_path.exists():
        app.setWindowIcon(QIcon(str(icon_path)))
        ColorPrint.green("✓ Application icon loaded")

    ColorPrint.green("✓ Qt Application initialized")

    # Step 2: Create main window (UI ready)
    ColorPrint.blue("\n[2/3] Creating main window...")

    # Create server thread but don't start yet
    server_thread = MCPServerThread()

    # Create main window
    main_window = create_main_window(server_thread)
    main_window.show()

    ColorPrint.green("✓ Main window displayed")
    ColorPrint.blue("\nWindow controls:")
    ColorPrint.blue("  • Close window = Minimize to tray")
    ColorPrint.blue("  • Tray menu = Right-click tray icon")
    ColorPrint.blue("  • Double-click tray = Show window")

    # Step 3: Start MCP server backend (after UI is ready)
    ColorPrint.blue("\n[3/3] Starting MCP server backend...")
    server_thread.start()

    # Update UI status
    main_window.status_widget.add_log("MCP Server backend starting...", "info")

    # Wait for server to be ready (non-blocking for UI)
    def check_server_ready():
        """Check if server is ready in background"""
        server_ready = THREAD_BUS.wait_signal('mcp_server_ready', timeout=15.0)

        if server_ready:
            ColorPrint.green("✓ MCP server backend is ready")
            main_window.status_widget.add_log("MCP Server is ready", "success")
            main_window.status_widget.update_status()
        else:
            ColorPrint.red("ERROR: MCP server failed to start!")
            main_window.status_widget.add_log("ERROR: MCP Server failed to start", "error")

    # Check server status in separate thread (UI remains responsive)
    import threading
    status_thread = threading.Thread(target=check_server_ready, daemon=True)
    status_thread.start()

    ColorPrint.green("\n✓ MCP Server UI is running")
    ColorPrint.blue("UI is responsive, server starting in background...")
    ColorPrint.blue("")

    # Run Qt event loop
    sys.exit(app.exec())


def main():
    """Main entry point with startup window"""
    launch_app_with_startup(
        app_name="MCP Server",
        main_entry=main_app_entry,
        startup_width=600,
        startup_height=500,
        min_display_time=2.0,
        enable_language_selector=False
    )


def start():
    """Alternative entry point (for compatibility)"""
    main()


if __name__ == '__main__':
    main()
