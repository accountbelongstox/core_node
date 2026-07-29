#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Framework - Resize Handles Module

Provides edge and corner resize handles for frameless windows.
Allows users to resize windows by dragging edges and corners.

Features:
- Edge resizing (left, right, bottom)
- Corner resizing (bottom-left, bottom-right)
- Visual feedback on hover
- Smooth resize operation
- Minimum window size constraints

Usage:
    from pycore.pyutils.native_ui.step8_utils.resize_handles import ResizeHandles

    # In your window setup
    resize_handles = ResizeHandles(root_window, min_width=400, min_height=300)
    resize_handles.attach()
"""

from typing import Optional, Tuple
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_tkinter

# Get tkinter via third_party manager (auto-installs python3-tk on Linux)
tk = get_third_package_tkinter()


class ResizeHandle:
    """
    Individual resize handle for window edge or corner

    Handles mouse events for dragging and provides visual feedback.
    """

    def __init__(
        self,
        parent: tk.Widget,
        parent_window: tk.Tk,
        position: str,
        size: int = 8,
        color: str = '#0078d4',
        hover_color: str = '#005a9e'
    ):
        """
        Initialize resize handle

        Args:
            parent: Parent widget to attach handle to
            parent_window: Root window to resize
            position: Handle position ('left', 'right', 'bottom', 'bottom_left', 'bottom_right')
            size: Handle size in pixels
            color: Handle color
            hover_color: Color when hovering
        """
        self.parent = parent
        self.parent_window = parent_window
        self.position = position
        self.size = size
        self.color = color
        self.hover_color = hover_color

        # Drag state
        self._dragging = False
        self._drag_start_x = 0
        self._drag_start_y = 0
        self._start_width = 0
        self._start_height = 0
        self._start_x = 0
        self._start_y = 0

        # Create handle widget
        self.handle = None
        self._create_handle()

    def _create_handle(self):
        """Create handle widget based on position"""
        if self.position == 'left':
            self.handle = tk.Frame(
                self.parent,
                width=self.size,
                bg='#1e1e1e',
                cursor='sb_h_double_arrow'
            )
            self.handle.pack(side=tk.LEFT, fill=tk.Y)

        elif self.position == 'right':
            self.handle = tk.Frame(
                self.parent,
                width=self.size,
                bg='#1e1e1e',
                cursor='sb_h_double_arrow'
            )
            self.handle.pack(side=tk.RIGHT, fill=tk.Y)

        elif self.position == 'bottom':
            self.handle = tk.Frame(
                self.parent,
                height=self.size,
                bg='#1e1e1e',
                cursor='sb_v_double_arrow'
            )
            self.handle.pack(side=tk.BOTTOM, fill=tk.X)

        elif self.position == 'bottom_left':
            self.handle = tk.Frame(
                self.parent,
                width=self.size,
                height=self.size,
                bg='#1e1e1e',
                cursor='bottom_left_corner'
            )
            self.handle.place(relx=0.0, rely=1.0, anchor='sw')

        elif self.position == 'bottom_right':
            self.handle = tk.Frame(
                self.parent,
                width=self.size,
                height=self.size,
                bg='#1e1e1e',
                cursor='bottom_right_corner'
            )
            self.handle.place(relx=1.0, rely=1.0, anchor='se')

        # Bind events
        self._bind_events()

    def _bind_events(self):
        """Bind mouse events"""
        self.handle.bind('<Button-1>', self._start_drag)
        self.handle.bind('<B1-Motion>', self._on_drag)
        self.handle.bind('<ButtonRelease-1>', self._stop_drag)
        self.handle.bind('<Enter>', self._on_enter)
        self.handle.bind('<Leave>', self._on_leave)

    def _on_enter(self, event):
        """Handle mouse enter - show hover effect"""
        self.handle.config(bg=self.hover_color)

    def _on_leave(self, event):
        """Handle mouse leave - remove hover effect"""
        if not self._dragging:
            self.handle.config(bg='#1e1e1e')

    def _start_drag(self, event):
        """Start dragging"""
        self._dragging = True
        self._drag_start_x = event.x_root
        self._drag_start_y = event.y_root

        # Store current window geometry
        self._start_width = self.parent_window.winfo_width()
        self._start_height = self.parent_window.winfo_height()
        self._start_x = self.parent_window.winfo_x()
        self._start_y = self.parent_window.winfo_y()

        self.handle.config(bg=self.hover_color)

    def _on_drag(self, event):
        """Handle dragging"""
        if not self._dragging:
            return

        # Calculate delta
        delta_x = event.x_root - self._drag_start_x
        delta_y = event.y_root - self._drag_start_y

        # Apply resize based on position
        if self.position == 'left':
            self._resize_left(delta_x)
        elif self.position == 'right':
            self._resize_right(delta_x)
        elif self.position == 'bottom':
            self._resize_bottom(delta_y)
        elif self.position == 'bottom_left':
            self._resize_left(delta_x)
            self._resize_bottom(delta_y)
        elif self.position == 'bottom_right':
            self._resize_right(delta_x)
            self._resize_bottom(delta_y)

    def _stop_drag(self, event):
        """Stop dragging"""
        self._dragging = False
        self.handle.config(bg='#1e1e1e')

    def _resize_left(self, delta_x: int):
        """Resize from left edge"""
        new_width = self._start_width - delta_x
        new_x = self._start_x + delta_x

        # Apply constraints
        if new_width >= 400:  # Minimum width
            self.parent_window.geometry(f"{new_width}x{self._start_height}+{new_x}+{self._start_y}")

    def _resize_right(self, delta_x: int):
        """Resize from right edge"""
        new_width = self._start_width + delta_x

        # Apply constraints
        if new_width >= 400:  # Minimum width
            self.parent_window.geometry(f"{new_width}x{self._start_height}+{self._start_x}+{self._start_y}")

    def _resize_bottom(self, delta_y: int):
        """Resize from bottom edge"""
        new_height = self._start_height + delta_y

        # Apply constraints
        if new_height >= 300:  # Minimum height
            self.parent_window.geometry(f"{self._start_width}x{new_height}+{self._start_x}+{self._start_y}")


class ResizeHandles:
    """
    Resize handles manager for frameless windows

    Creates and manages all resize handles (edges and corners).
    Provides unified interface for attaching resize functionality to windows.

    Example:
        resize_handles = ResizeHandles(root, min_width=600, min_height=400)
        resize_handles.attach()
    """

    def __init__(
        self,
        parent_window: tk.Tk,
        min_width: int = 400,
        min_height: int = 300,
        handle_size: int = 8,
        color: str = '#0078d4',
        hover_color: str = '#005a9e',
        debug: bool = False
    ):
        """
        Initialize resize handles manager

        Args:
            parent_window: Root window to attach handles to
            min_width: Minimum window width
            min_height: Minimum window height
            handle_size: Size of resize handles in pixels
            color: Handle color
            hover_color: Handle hover color
            debug: Enable debug logging
        """
        self.parent_window = parent_window
        self.min_width = min_width
        self.min_height = min_height
        self.handle_size = handle_size
        self.color = color
        self.hover_color = hover_color
        self.debug = debug

        # Handle widgets
        self.handles = {}

        # Container frame
        self.container = None

        ColorPrint.blue(f"[ResizeHandles] Initialized (min: {min_width}x{min_height})")

    def attach(self):
        """
        Attach resize handles to window

        Creates handle widgets for:
        - Left edge
        - Right edge
        - Bottom edge
        - Bottom-left corner
        - Bottom-right corner
        """
        # Create container frame
        self.container = tk.Frame(self.parent_window, bg='#1e1e1e')
        self.container.pack(side=tk.BOTTOM, fill=tk.BOTH)

        # Create handles
        self.handles['left'] = ResizeHandle(
            self.container,
            self.parent_window,
            'left',
            size=self.handle_size,
            color=self.color,
            hover_color=self.hover_color
        )

        self.handles['right'] = ResizeHandle(
            self.container,
            self.parent_window,
            'right',
            size=self.handle_size,
            color=self.color,
            hover_color=self.hover_color
        )

        self.handles['bottom'] = ResizeHandle(
            self.container,
            self.parent_window,
            'bottom',
            size=self.handle_size,
            color=self.color,
            hover_color=self.hover_color
        )

        self.handles['bottom_left'] = ResizeHandle(
            self.container,
            self.parent_window,
            'bottom_left',
            size=self.handle_size * 2,  # Corners are larger
            color=self.color,
            hover_color=self.hover_color
        )

        self.handles['bottom_right'] = ResizeHandle(
            self.container,
            self.parent_window,
            'bottom_right',
            size=self.handle_size * 2,  # Corners are larger
            color=self.color,
            hover_color=self.hover_color
        )

        ColorPrint.green("[ResizeHandles] Attached all resize handles")

    def detach(self):
        """Remove resize handles"""
        if self.container:
            self.container.destroy()
            self.container = None
            self.handles.clear()
            ColorPrint.yellow("[ResizeHandles] Detached all resize handles")

    def set_min_size(self, width: int, height: int):
        """
        Set minimum window size

        Args:
            width: Minimum width
            height: Minimum height
        """
        self.min_width = width
        self.min_height = height

        ColorPrint.blue(f"[ResizeHandles] Min size updated: {width}x{height}")


__all__ = [
    'ResizeHandle',
    'ResizeHandles',
]
