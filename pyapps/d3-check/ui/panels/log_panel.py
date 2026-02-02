#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Log Panel (TABLE4) - Unified Style Version
Contains log display and control functions with unified styling
"""

import tkinter as tk
from tkinter import ttk, scrolledtext
import sys
import os
from typing import Optional, Callable

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.color_print import ColorPrint
from d3utils.shutdown_manager import is_shutdown_requested

# Import unified styles
from ..unified_styles import UnifiedStyles

# Import i18n manager (global singleton instance)
from d3utils.i18n_manager import i18n_manager
from ui.utils.config_binding import ConfigBinding

class LogPanel:
    """
    Log Panel for TABLE4
    Unified styling and layout
    """
    
    def __init__(self, parent):
        """Initialize log panel"""
        self.parent = parent
        self.log_buffer = []
        self.max_log_lines = 1000
        
        # Configure TTK styles
        self.style = UnifiedStyles.configure_ttk_styles()
        
        # Create main container
        self.container = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        self.container.pack(fill=tk.BOTH, expand=True, 
                           padx=UnifiedStyles.SPACING['md'], 
                           pady=UnifiedStyles.SPACING['md'])
        
        # Configure grid
        self.container.grid_columnconfigure(0, weight=1)
        self.container.grid_rowconfigure(2, weight=1)
        
        # Create content
        self.create_content()

        # Register as ColorPrint callback
        ColorPrint.register_callback(self.add_log_message)

        # Note: Language change is handled by main UI, not individual panels

    def _create_test_panel(self):
        """Create test functions panel"""
        test_frame = ttk.LabelFrame(self.container, text=i18n_manager.get_ui_text("log_panel.test_functions"), style='TLabelframe')
        test_frame.grid(row=0, column=0, sticky="ew",
                       padx=UnifiedStyles.SPACING['sm'],
                       pady=(UnifiedStyles.SPACING['sm'], 0))
        test_frame.grid_columnconfigure(4, weight=1)

        # Test buttons
        test_buttons = [
            ("log_panel.bag_test", self._test_bag),
            ("log_panel.yellow_upgrade", self._test_yellow_upgrade),
            ("log_panel.item_reforge", self._test_item_reforge),
            ("log_panel.test_pathfinding", self._test_pathfinding)
        ]

        for i, (text_key, command) in enumerate(test_buttons):
            btn = tk.Button(test_frame, text=i18n_manager.get_ui_text(text_key),
                           bg=UnifiedStyles.COLORS['btn_primary'],
                           fg=UnifiedStyles.COLORS['text_primary'],
                           font=UnifiedStyles.FONTS['button'],
                           command=command)
            btn.grid(row=0, column=i, padx=UnifiedStyles.SPACING['xs'],
                    pady=UnifiedStyles.SPACING['sm'])

    def create_content(self):
        """Create panel content"""
        # Test functions panel
        self._create_test_panel()

        # Control panel
        self._create_control_panel()

        # Log display
        self._create_log_display()

    def _create_control_panel(self):
        """Create log control panel"""
        control_frame = tk.Frame(self.container, bg=UnifiedStyles.COLORS['bg_secondary'])
        control_frame.grid(row=1, column=0, sticky="ew",
                          padx=UnifiedStyles.SPACING['sm'],
                          pady=(UnifiedStyles.SPACING['sm'], 0))
        control_frame.grid_columnconfigure(2, weight=1)
        
        # Clear button
        clear_btn = tk.Button(control_frame, text=i18n_manager.get_ui_text("log_panel.clear_logs"),
                             bg=UnifiedStyles.COLORS['btn_warning'],
                             fg=UnifiedStyles.COLORS['text_primary'],
                             font=UnifiedStyles.FONTS['button'],
                             command=self.clear_logs)
        clear_btn.grid(row=0, column=0, padx=(UnifiedStyles.SPACING['sm'], UnifiedStyles.SPACING['xs']))
        
        # Save button
        save_btn = tk.Button(control_frame, text=i18n_manager.get_ui_text("log_panel.save_log"),
                            bg=UnifiedStyles.COLORS['btn_primary'],
                            fg=UnifiedStyles.COLORS['text_primary'],
                            font=UnifiedStyles.FONTS['button'],
                            command=self.save_logs)
        save_btn.grid(row=0, column=1, padx=UnifiedStyles.SPACING['xs'])
        
        # Auto-scroll checkbox using ConfigBinding
        auto_scroll_check = ConfigBinding.create_checkbox_binding(
            control_frame, "log_settings.auto_scroll",
            text=i18n_manager.get_ui_text("log_panel.auto_scroll"), default_value=True,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            selectcolor=UnifiedStyles.COLORS['bg_tertiary'],
            activebackground=UnifiedStyles.COLORS['bg_secondary'],
            activeforeground=UnifiedStyles.COLORS['text_primary']
        )
        auto_scroll_check.grid(row=0, column=3, padx=UnifiedStyles.SPACING['sm'], sticky="e")

        # Log level filter
        level_label = tk.Label(control_frame, text=i18n_manager.get_ui_text("log_panel.log_level") + ":",
                              bg=UnifiedStyles.COLORS['bg_secondary'],
                              fg=UnifiedStyles.COLORS['text_primary'],
                              font=UnifiedStyles.FONTS['label'])
        level_label.grid(row=0, column=4, padx=(UnifiedStyles.SPACING['md'], UnifiedStyles.SPACING['xs']), sticky="e")

        # Log level using ConfigBinding
        level_combo = ConfigBinding.create_combobox_binding(
            control_frame, "log_settings.log_level",
            values=['ALL', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
            default_value="INFO", width=8
        )
        level_combo.grid(row=0, column=5, padx=(0, UnifiedStyles.SPACING['sm']), sticky="e")
        level_combo.bind('<<ComboboxSelected>>', self._filter_logs)

        # Store reference to the combobox for getting current value
        self.level_combo = level_combo

    def _create_log_display(self):
        """Create log display area"""
        log_frame = ttk.LabelFrame(self.container, text=i18n_manager.get_ui_text("log_panel.log_output"), style='TLabelframe')
        log_frame.grid(row=2, column=0, sticky="nsew",
                      padx=UnifiedStyles.SPACING['sm'],
                      pady=UnifiedStyles.SPACING['sm'])
        log_frame.grid_columnconfigure(0, weight=1)
        log_frame.grid_rowconfigure(0, weight=1)
        
        # Create text widget with scrollbar
        self.log_text = tk.Text(log_frame,
                               bg=UnifiedStyles.COLORS['bg_primary'],
                               fg=UnifiedStyles.COLORS['text_primary'],
                               font=UnifiedStyles.FONTS['code'],
                               wrap=tk.WORD,
                               state=tk.DISABLED)
        
        # Scrollbar
        scrollbar = tk.Scrollbar(log_frame, orient=tk.VERTICAL, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scrollbar.set)
        
        # Grid layout
        self.log_text.grid(row=0, column=0, sticky="nsew", 
                          padx=(UnifiedStyles.SPACING['sm'], 0), 
                          pady=UnifiedStyles.SPACING['sm'])
        scrollbar.grid(row=0, column=1, sticky="ns", 
                      padx=(0, UnifiedStyles.SPACING['sm']), 
                      pady=UnifiedStyles.SPACING['sm'])
        
        # Configure text tags for different log levels
        self._configure_log_tags()

        # Right-click context menu: Copy (reuse same pattern as ROSBOT log)
        self.log_text.bind("<Button-3>", self._show_log_context_menu)

    def _show_log_context_menu(self, event):
        """Show right-click context menu for log area (Copy)."""
        menu = tk.Menu(self.log_text, tearoff=0)
        menu.add_command(label=i18n_manager.get_ui_text("log_panel.copy"), command=self._copy_log_to_clipboard)
        try:
            menu.tk_popup(event.x_root, event.y_root)
        finally:
            menu.grab_release()

    def _copy_log_to_clipboard(self):
        """Copy log content to clipboard (selection if any, else all)."""
        try:
            if self.log_text.tag_ranges(tk.SEL):
                text = self.log_text.get(tk.SEL_FIRST, tk.SEL_LAST)
            else:
                text = self.log_text.get("1.0", tk.END)
            if text.strip():
                self.container.clipboard_clear()
                self.container.clipboard_append(text)
        except tk.TclError:
            pass

    def _configure_log_tags(self):
        """Configure text tags for different log levels"""
        self.log_text.tag_configure("DEBUG", foreground=UnifiedStyles.COLORS['text_muted'])
        self.log_text.tag_configure("INFO", foreground=UnifiedStyles.COLORS['text_primary'])
        self.log_text.tag_configure("WARNING", foreground=UnifiedStyles.COLORS['warning'])
        self.log_text.tag_configure("ERROR", foreground=UnifiedStyles.COLORS['error'])
        self.log_text.tag_configure("SUCCESS", foreground=UnifiedStyles.COLORS['success'])
        self.log_text.tag_configure("CYAN", foreground=UnifiedStyles.COLORS['accent'])

    def add_log_message(self, message, level="INFO", color=None):
        """Add a log message to the display. ColorPrint calls (message, color_type, log_level); schedule UI update on main thread via after(0)."""
        if is_shutdown_requested():
            return
        # ColorPrint.notify passes (message, color_type, log_level) -> our (message, level, color) receive (message, color_type, log_level)
        color_type = level if level in ("red", "green", "yellow", "blue", "gray", "cyan", "white") else None
        log_level_raw = color if isinstance(color, str) and color in ("DEBUG", "INFO", "WARNING", "ERROR", "SUCCESS") else (level if not color_type else "INFO")
        # Filter combo uses DEBUG/INFO/WARNING/ERROR/ALL; map SUCCESS to INFO
        log_level = (log_level_raw or "INFO").upper()
        if log_level not in ("DEBUG", "INFO", "WARNING", "ERROR"):
            log_level = "INFO"
        log_entry = {
            'message': message,
            'level': log_level,
            'color': color_type
        }

        def _append():
            try:
                if not self.container.winfo_exists():
                    return
                self.log_buffer.append(log_entry)
                if len(self.log_buffer) > self.max_log_lines:
                    self.log_buffer = self.log_buffer[-self.max_log_lines:]
                if self._should_display_message(log_entry):
                    self._display_message(log_entry)
            except (tk.TclError, RuntimeError, Exception):
                pass
        try:
            if self.container.winfo_exists():
                self.container.after(0, _append)
        except (tk.TclError, RuntimeError):
            pass

    def _should_display_message(self, log_entry):
        """Check if message should be displayed based on current filter"""
        try:
            current_filter = ConfigBinding.get_config_value("log_settings.log_level", "ALL")
            if current_filter == "ALL":
                return True
            return log_entry['level'] == current_filter
        except Exception:
            return True

    def _display_message(self, log_entry):
        """Display a single log message. Auto-scroll only when option is on and user was at bottom before insert (reuse: same as ROSBOT; no scroll steal when mid-log copy)."""
        try:
            self.log_text.configure(state=tk.NORMAL)
            # Check at-bottom before insert (after insert content grows and yview may no longer be 0.99)
            at_bottom = False
            try:
                auto_on = ConfigBinding.get_config_value("log_settings.auto_scroll", True)
                if auto_on:
                    yview = self.log_text.yview()
                    if yview and len(yview) >= 2:
                        at_bottom = float(yview[1]) >= 0.99
            except Exception:
                pass

            # Determine tag based on level or color
            tag = log_entry['level']
            if log_entry['color']:
                color_map = {
                    'red': 'ERROR',
                    'yellow': 'WARNING',
                    'green': 'SUCCESS',
                    'cyan': 'CYAN',
                    'blue': 'INFO'
                }
                tag = color_map.get(log_entry['color'], log_entry['level'])

            # Insert message with tag
            self.log_text.insert(tk.END, f"{log_entry['message']}\n", tag)

            if at_bottom:
                self.log_text.see(tk.END)

            self.log_text.configure(state=tk.DISABLED)

        except Exception as e:
            print(f"Error displaying log message: {e}")

    def _filter_logs(self, event=None):
        """Filter logs based on selected level"""
        try:
            # Clear current display
            self.log_text.configure(state=tk.NORMAL)
            self.log_text.delete(1.0, tk.END)
            
            # Redisplay filtered messages
            for log_entry in self.log_buffer:
                if self._should_display_message(log_entry):
                    self._display_message_without_scroll(log_entry)
            
            self.log_text.configure(state=tk.DISABLED)
            
        except Exception as e:
            print(f"Error filtering logs: {e}")

    def _display_message_without_scroll(self, log_entry):
        """Display message without auto-scroll"""
        try:
            # Determine tag
            tag = log_entry['level']
            if log_entry['color']:
                color_map = {
                    'red': 'ERROR',
                    'yellow': 'WARNING',
                    'green': 'SUCCESS',
                    'cyan': 'CYAN',
                    'blue': 'INFO'
                }
                tag = color_map.get(log_entry['color'], log_entry['level'])
            
            # Insert message
            self.log_text.insert(tk.END, f"{log_entry['message']}\n", tag)
            
        except Exception as e:
            print(f"Error displaying message: {e}")

    def clear_logs(self):
        """Clear all logs"""
        try:
            self.log_buffer.clear()
            self.log_text.configure(state=tk.NORMAL)
            self.log_text.delete(1.0, tk.END)
            self.log_text.configure(state=tk.DISABLED)
            ColorPrint.blue("[LogPanel] Logs cleared")
        except Exception as e:
            print(f"Error clearing logs: {e}")

    def save_logs(self):
        """Save logs to file"""
        try:
            from tkinter import filedialog
            import datetime
            
            # Get save location
            filename = filedialog.asksaveasfilename(
                defaultextension=".txt",
                filetypes=[("Text files", "*.txt"), ("All files", "*.*")],
                initialname=f"d3check_log_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            )
            
            if filename:
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(f"D3-Check Log Export\n")
                    f.write(f"Generated: {datetime.datetime.now()}\n")
                    f.write("=" * 50 + "\n\n")
                    
                    for log_entry in self.log_buffer:
                        f.write(f"[{log_entry['level']}] {log_entry['message']}\n")
                
                ColorPrint.green(f"[LogPanel] Logs saved to: {filename}")
                
        except Exception as e:
            ColorPrint.red(f"[LogPanel] Error saving logs: {e}")

    def _test_bag(self):
        """Test bag functionality"""
        ColorPrint.blue(f"[{i18n_manager.get_ui_text('log_panel.bag_test')}] {i18n_manager.get_ui_text('log_panel.bag_test_start')}")
        ColorPrint.green(f"[{i18n_manager.get_ui_text('log_panel.bag_test')}] {i18n_manager.get_ui_text('log_panel.bag_test_complete')}")

    def _test_yellow_upgrade(self):
        """Test yellow upgrade functionality"""
        ColorPrint.blue(f"[{i18n_manager.get_ui_text('log_panel.yellow_upgrade')}] {i18n_manager.get_ui_text('log_panel.yellow_upgrade_start')}")
        ColorPrint.green(f"[{i18n_manager.get_ui_text('log_panel.yellow_upgrade')}] {i18n_manager.get_ui_text('log_panel.yellow_upgrade_complete')}")

    def _test_item_reforge(self):
        """Test item reforge functionality"""
        ColorPrint.blue(f"[{i18n_manager.get_ui_text('log_panel.item_reforge')}] {i18n_manager.get_ui_text('log_panel.item_reforge_start')}")
        ColorPrint.green(f"[{i18n_manager.get_ui_text('log_panel.item_reforge')}] {i18n_manager.get_ui_text('log_panel.item_reforge_complete')}")

    def _test_pathfinding(self):
        """Test pathfinding functionality"""
        ColorPrint.blue(f"[{i18n_manager.get_ui_text('log_panel.test_pathfinding')}] {i18n_manager.get_ui_text('log_panel.test_pathfinding_start')}")
        ColorPrint.green(f"[{i18n_manager.get_ui_text('log_panel.test_pathfinding')}] {i18n_manager.get_ui_text('log_panel.test_pathfinding_complete')}")

# Language change is now handled by main UI - no individual panel methods needed
