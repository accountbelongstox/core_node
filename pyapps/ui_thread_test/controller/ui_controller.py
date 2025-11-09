#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI Controller

Creates custom UI content for the NativeUIThread test application
"""

import tkinter as tk
import time
from typing import Optional
from pycore import ColorPrint


class UIController:
    """
    UI Controller

    Manages custom UI content creation and interaction
    """

    def __init__(self):
        """Initialize UI controller"""
        self.content_frame: Optional[tk.Frame] = None
        self.counter = 0
        self.status_label: Optional[tk.Label] = None
        self.counter_label: Optional[tk.Label] = None

    def create_ui_content(self, content_frame: tk.Frame):
        """
        Create custom UI content

        This method is called by NativeUIThread to create the UI content

        Args:
            content_frame: Parent frame to create content in
        """
        self.content_frame = content_frame

        ColorPrint.blue("[UIController] Creating custom UI content...")

        # Configure frame
        content_frame.configure(bg="#1e1e1e")

        # Create title section
        self._create_title_section(content_frame)

        # Create info section
        self._create_info_section(content_frame)

        # Create counter section
        self._create_counter_section(content_frame)

        # Create button section
        self._create_button_section(content_frame)

        # Create status section
        self._create_status_section(content_frame)

        ColorPrint.green("[UIController] UI content created successfully")

    def _create_title_section(self, parent):
        """Create title section"""
        title_frame = tk.Frame(parent, bg="#1e1e1e")
        title_frame.pack(pady=20)

        title_label = tk.Label(
            title_frame,
            text="UI Thread Test Application",
            font=("Arial", 24, "bold"),
            bg="#1e1e1e",
            fg="white"
        )
        title_label.pack()

        subtitle_label = tk.Label(
            title_frame,
            text="Demonstrating NativeUIThread via pylauncher",
            font=("Arial", 12),
            bg="#1e1e1e",
            fg="gray"
        )
        subtitle_label.pack()

    def _create_info_section(self, parent):
        """Create information section"""
        info_frame = tk.Frame(parent, bg="#2d2d2d", relief=tk.FLAT, bd=1)
        info_frame.pack(pady=10, padx=40, fill=tk.X)

        info_text = [
            "This application demonstrates:",
            "  - Configuration file-based launcher (JSON)",
            "  - NativeUIThread integration",
            "  - Custom UI content creation",
            "  - Independent thread execution"
        ]

        for text in info_text:
            label = tk.Label(
                info_frame,
                text=text,
                font=("Courier New", 10),
                bg="#2d2d2d",
                fg="#00ff00",
                anchor="w",
                justify=tk.LEFT
            )
            label.pack(padx=15, pady=2, fill=tk.X)

    def _create_counter_section(self, parent):
        """Create counter section"""
        counter_frame = tk.Frame(parent, bg="#1e1e1e")
        counter_frame.pack(pady=20)

        counter_title = tk.Label(
            counter_frame,
            text="Counter:",
            font=("Arial", 14),
            bg="#1e1e1e",
            fg="white"
        )
        counter_title.pack()

        self.counter_label = tk.Label(
            counter_frame,
            text=str(self.counter),
            font=("Arial", 32, "bold"),
            bg="#1e1e1e",
            fg="#00ff00"
        )
        self.counter_label.pack()

    def _create_button_section(self, parent):
        """Create button section"""
        button_frame = tk.Frame(parent, bg="#1e1e1e")
        button_frame.pack(pady=10)

        # Increment button
        increment_btn = tk.Button(
            button_frame,
            text="+ Increment",
            command=self._increment_counter,
            font=("Arial", 12, "bold"),
            bg="#0078d4",
            fg="white",
            activebackground="#005a9e",
            activeforeground="white",
            relief=tk.FLAT,
            padx=20,
            pady=10,
            cursor="hand2"
        )
        increment_btn.pack(side=tk.LEFT, padx=5)

        # Decrement button
        decrement_btn = tk.Button(
            button_frame,
            text="- Decrement",
            command=self._decrement_counter,
            font=("Arial", 12, "bold"),
            bg="#d41300",
            fg="white",
            activebackground="#9e0f00",
            activeforeground="white",
            relief=tk.FLAT,
            padx=20,
            pady=10,
            cursor="hand2"
        )
        decrement_btn.pack(side=tk.LEFT, padx=5)

        # Reset button
        reset_btn = tk.Button(
            button_frame,
            text="Reset",
            command=self._reset_counter,
            font=("Arial", 12),
            bg="#555555",
            fg="white",
            activebackground="#333333",
            activeforeground="white",
            relief=tk.FLAT,
            padx=20,
            pady=10,
            cursor="hand2"
        )
        reset_btn.pack(side=tk.LEFT, padx=5)

    def _create_status_section(self, parent):
        """Create status section"""
        status_frame = tk.Frame(parent, bg="#1e1e1e")
        status_frame.pack(side=tk.BOTTOM, fill=tk.X, pady=10)

        self.status_label = tk.Label(
            status_frame,
            text="Status: Ready",
            font=("Arial", 10),
            bg="#1e1e1e",
            fg="gray"
        )
        self.status_label.pack()

    def _increment_counter(self):
        """Increment counter"""
        self.counter += 1
        self._update_counter_display()
        self._update_status("Counter incremented")
        ColorPrint.print_info(f"[UIController] Counter incremented: {self.counter}")

    def _decrement_counter(self):
        """Decrement counter"""
        self.counter -= 1
        self._update_counter_display()
        self._update_status("Counter decremented")
        ColorPrint.print_info(f"[UIController] Counter decremented: {self.counter}")

    def _reset_counter(self):
        """Reset counter"""
        self.counter = 0
        self._update_counter_display()
        self._update_status("Counter reset")
        ColorPrint.print_info(f"[UIController] Counter reset")

    def _update_counter_display(self):
        """Update counter display"""
        if self.counter_label:
            self.counter_label.config(text=str(self.counter))

            # Change color based on value
            if self.counter > 0:
                self.counter_label.config(fg="#00ff00")  # Green
            elif self.counter < 0:
                self.counter_label.config(fg="#ff0000")  # Red
            else:
                self.counter_label.config(fg="white")    # White

    def _update_status(self, message: str):
        """
        Update status message

        Args:
            message: Status message to display
        """
        if self.status_label:
            timestamp = time.strftime("%H:%M:%S")
            self.status_label.config(text=f"Status: {message} [{timestamp}]")
