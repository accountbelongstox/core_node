"""
Unified Combobox widget for consistent theming and behavior
"""
import tkinter as tk
from tkinter import ttk
from typing import List, Dict, Any, Optional, Callable
import sys
import os

# Add project root to path for absolute imports
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
sys.path.insert(0, project_root)

from ui.theme.theme import UITheme
from ui.utils.tk_variables import var_str
from d3utils.i18n_manager import I18nManager
i18n_manager = I18nManager()
from providor.providor_index import CONFIG, save_config


class ThemedCombobox:
    """Unified themed combobox widget with config integration"""
    
    def __init__(self, parent, values: List[str], default_value: str = "", 
                 on_change: Optional[Callable[[str], None]] = None,
                 width: int = 10, **kwargs):
        """
        Initialize themed combobox
        
        Args:
            parent: Parent widget
            values: List of available values
            default_value: Default selected value
            on_change: Callback function when value changes
            width: Width of the combobox
            **kwargs: Additional ttk.Combobox arguments
        """
        self.parent = parent
        self.values = values
        self.on_change = on_change
        
        # Create the combobox (use factory so master is always set)
        self.var = var_str(parent, default_value)
        self.combobox = ttk.Combobox(
            parent,
            textvariable=self.var,
            values=values,
            width=width,
            state='readonly',
            **kwargs
        )
        
        # Set default value
        if default_value and default_value in values:
            self.combobox.set(default_value)
        elif values:
            self.combobox.set(values[0])
        
        # Apply theme
        self._apply_theme()
        
        # Bind change event
        if on_change:
            self.combobox.bind('<<ComboboxSelected>>', 
                             lambda e: self._on_value_changed())
    
    def _apply_theme(self):
        """Apply consistent theme to combobox"""
        style = ttk.Style()
        
        # Configure theme for combobox
        style.configure('Themed.TCombobox',
                       fieldbackground=UITheme.get_color('combobox_bg'),
                       background=UITheme.get_color('combobox_bg'),
                       foreground=UITheme.get_color('combobox_fg'),
                       borderwidth=1,
                       relief='solid',
                       arrowcolor=UITheme.get_color('combobox_arrow'))
        
        # Map states for consistent theming
        style.map('Themed.TCombobox',
                 fieldbackground=[('readonly', UITheme.get_color('combobox_bg')),
                                ('active', UITheme.get_color('combobox_bg')),
                                ('focus', UITheme.get_color('combobox_bg'))],
                 background=[('readonly', UITheme.get_color('combobox_bg')),
                           ('active', UITheme.get_color('combobox_bg')),
                           ('focus', UITheme.get_color('combobox_bg'))],
                 foreground=[('readonly', UITheme.get_color('combobox_fg')),
                           ('active', UITheme.get_color('combobox_fg')),
                           ('focus', UITheme.get_color('combobox_fg'))])
        
        # Apply the style
        self.combobox.configure(style='Themed.TCombobox')
    
    def _on_value_changed(self):
        """Handle value change event"""
        if self.on_change:
            self.on_change(self.get_value())
    
    def get_value(self) -> str:
        """Get current selected value"""
        return self.var.get()
    
    def set_value(self, value: str):
        """Set selected value"""
        if value in self.values:
            self.var.set(value)
            self.combobox.set(value)
    
    def update_values(self, values: List[str]):
        """Update available values"""
        self.values = values
        self.combobox['values'] = values
        
        # If current value is not in new values, set to first value
        current = self.get_value()
        if current not in values and values:
            self.set_value(values[0])
    
    def pack(self, **kwargs):
        """Pack the combobox"""
        return self.combobox.pack(**kwargs)
    
    def grid(self, **kwargs):
        """Grid the combobox"""
        return self.combobox.grid(**kwargs)
    
    def place(self, **kwargs):
        """Place the combobox"""
        return self.combobox.place(**kwargs)


# LanguageCombobox is now replaced by ConfigBinding.create_combobox_binding()
# This avoids conflicts and provides better integration with the configuration system
