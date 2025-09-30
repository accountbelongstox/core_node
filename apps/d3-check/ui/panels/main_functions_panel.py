#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Main Functions Panel (TABLE1)
Contains skill configuration and basic info
"""

import tkinter as tk
from tkinter import ttk
import sys
import os
from typing import Optional, Callable

# Add ncore path for color_print
ncore_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "ncore")
sys.path.insert(0, ncore_path)
from pytools.pyfoundations.color_print import ColorPrint


class MainFunctionsPanel:
    """Main functions panel for TABLE1"""
    
    def __init__(self, parent, initial_config='config1'):
        self.parent = parent
        self.current_config = initial_config
        
        # Callbacks
        self.on_config_change: Optional[Callable] = None
        self.on_skill_config_switch: Optional[Callable] = None
        
        self._create_panel()
    
    def _create_panel(self):
        """Create the main functions panel"""
        # Main content frame with better spacing
        main_content_frame = ttk.Frame(self.parent)
        main_content_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Left panel (skill configuration)
        self._create_skill_panel(main_content_frame)
        
        # Right panel (basic info)
        self._create_basic_info_panel(main_content_frame)
    
    def _create_skill_panel(self, parent):
        """Create skill configuration panel"""
        skill_frame = ttk.LabelFrame(parent, text="按键宏设置", padding=15)
        skill_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        # Configuration tabs (moved inside panel)
        self._create_config_tabs(skill_frame)
        
        # Separator
        separator1 = ttk.Separator(skill_frame, orient='horizontal')
        separator1.pack(fill=tk.X, pady=(10, 15))
        
        # Skill settings table
        self._create_skill_table(skill_frame)
        
        # Separator
        separator2 = ttk.Separator(skill_frame, orient='horizontal')
        separator2.pack(fill=tk.X, pady=(15, 10))
        
        # Additional settings
        self._create_additional_settings(skill_frame)
    
    def _create_config_tabs(self, parent):
        """Create configuration tabs inside the panel"""
        # Config tabs frame with better styling
        config_frame = ttk.Frame(parent)
        config_frame.pack(fill=tk.X, pady=(0, 5))
        
        # Title with better styling
        title_label = ttk.Label(config_frame, text="配置选择", font=('Arial', 11, 'bold'))
        title_label.pack(side=tk.LEFT, padx=(0, 15))
        
        # Config buttons with better spacing and styling
        self.tab_buttons = {}
        for i in range(1, 5):
            btn = ttk.Button(config_frame, text=f"配置{i}", width=8,
                           command=lambda c=f'config{i}': self._switch_config(c))
            btn.pack(side=tk.LEFT, padx=(0, 8))
            self.tab_buttons[f'config{i}'] = btn
        
        # Highlight current config
        self._update_tab_highlight()
    
    def _create_skill_table(self, parent):
        """Create skill settings table"""
        # Table headers with better styling
        header_frame = ttk.Frame(parent)
        header_frame.pack(fill=tk.X, pady=(0, 8))
        
        headers = ["技能", "按键", "策略", "间隔(ms)", "延迟(ms)", "随机延迟(ms)"]
        for i, header in enumerate(headers):
            label = ttk.Label(header_frame, text=header, font=('Arial', 9, 'bold'))
            label.grid(row=0, column=i, padx=3, pady=3, sticky='ew')
        
        # Configure column weights
        for i in range(len(headers)):
            header_frame.columnconfigure(i, weight=1)
        
        # Skill rows
        self.skill_vars = {}
        self.strategy_vars = {}
        self.interval_vars = {}
        self.delay_vars = {}
        self.random_delay_vars = {}
        
        skills = ["技能1", "技能2", "技能3", "技能4", "左键", "右键"]
        for i, skill in enumerate(skills):
            row_frame = ttk.Frame(parent)
            row_frame.pack(fill=tk.X, pady=2)
            
            # Skill name with better styling
            skill_label = ttk.Label(row_frame, text=skill, font=('Arial', 9))
            skill_label.grid(row=0, column=0, padx=3, pady=2, sticky='w')
            
            # Key binding
            key_var = tk.StringVar()
            key_combo = ttk.Combobox(row_frame, textvariable=key_var, width=8, 
                                    values=['1', '2', '3', '4', 'Q', 'W', 'E', 'R'])
            key_combo.grid(row=0, column=1, padx=3, pady=2, sticky='ew')
            self.skill_vars[skill] = key_var
            
            # Strategy
            strategy_var = tk.StringVar(value="连续")
            strategy_combo = ttk.Combobox(row_frame, textvariable=strategy_var, width=8, 
                                        values=['连续', '单次', '按住'])
            strategy_combo.grid(row=0, column=2, padx=3, pady=2, sticky='ew')
            self.strategy_vars[skill] = strategy_var
            
            # Interval
            interval_var = tk.StringVar(value="100")
            interval_spin = ttk.Spinbox(row_frame, from_=50, to=2000, textvariable=interval_var, width=8)
            interval_spin.grid(row=0, column=3, padx=3, pady=2, sticky='ew')
            self.interval_vars[skill] = interval_var
            
            # Delay
            delay_var = tk.StringVar(value="0")
            delay_spin = ttk.Spinbox(row_frame, from_=0, to=1000, textvariable=delay_var, width=8)
            delay_spin.grid(row=0, column=4, padx=3, pady=2, sticky='ew')
            self.delay_vars[skill] = delay_var
            
            # Random delay
            random_delay_var = tk.StringVar(value="0")
            random_delay_spin = ttk.Spinbox(row_frame, from_=0, to=500, textvariable=random_delay_var, width=8)
            random_delay_spin.grid(row=0, column=5, padx=3, pady=2, sticky='ew')
            self.random_delay_vars[skill] = random_delay_var
            
            # Configure column weights
            for j in range(6):
                row_frame.columnconfigure(j, weight=1)
    
    def _create_additional_settings(self, parent):
        """Create additional settings"""
        settings_frame = ttk.LabelFrame(parent, text="其他设置", padding=10)
        settings_frame.pack(fill=tk.X, pady=(5, 0))
        
        # Quick switch
        switch_frame = ttk.Frame(settings_frame)
        switch_frame.pack(fill=tk.X, pady=3)
        
        ttk.Label(switch_frame, text="快速切换:", font=('Arial', 9)).pack(side=tk.LEFT)
        self.quick_switch_var = tk.StringVar(value="F1")
        switch_combo = ttk.Combobox(switch_frame, textvariable=self.quick_switch_var, 
                                   values=['F1', 'F2', 'F3', 'F4'], width=8)
        switch_combo.pack(side=tk.LEFT, padx=(10, 0))
        
        # Movement
        movement_frame = ttk.Frame(settings_frame)
        movement_frame.pack(fill=tk.X, pady=3)
        
        ttk.Label(movement_frame, text="移动键:", font=('Arial', 9)).pack(side=tk.LEFT)
        self.movement_var = tk.StringVar(value="空格")
        movement_combo = ttk.Combobox(movement_frame, textvariable=self.movement_var, 
                                     values=['空格', 'Shift', 'Ctrl'], width=8)
        movement_combo.pack(side=tk.LEFT, padx=(10, 0))
        
        # Potion
        potion_frame = ttk.Frame(settings_frame)
        potion_frame.pack(fill=tk.X, pady=3)
        
        ttk.Label(potion_frame, text="药水键:", font=('Arial', 9)).pack(side=tk.LEFT)
        self.potion_var = tk.StringVar(value="Q")
        potion_combo = ttk.Combobox(potion_frame, textvariable=self.potion_var, 
                                   values=['Q', 'W', 'E', 'R'], width=8)
        potion_combo.pack(side=tk.LEFT, padx=(10, 0))
        
        ttk.Label(potion_frame, text="间隔:", font=('Arial', 9)).pack(side=tk.LEFT, padx=(20, 0))
        self.potion_interval_var = tk.StringVar(value="500")
        potion_interval_spin = ttk.Spinbox(potion_frame, from_=100, to=2000, 
                                         textvariable=self.potion_interval_var, width=8)
        potion_interval_spin.pack(side=tk.LEFT, padx=(10, 0))
    
    def _create_basic_info_panel(self, parent):
        """Create basic info panel"""
        info_frame = ttk.LabelFrame(parent, text="基本信息", padding=15)
        info_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=(10, 0))
        
        # Add basic information display with better styling
        title_label = ttk.Label(info_frame, text="当前配置信息", font=('Arial', 11, 'bold'))
        title_label.pack(anchor=tk.W, pady=(0, 10))
        
        # Configuration info with better styling
        self.config_info_text = tk.Text(info_frame, height=15, width=35, wrap=tk.WORD,
                                       font=('Consolas', 9), bg='#f8f8f8', fg='#333333')
        self.config_info_text.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        # Update config info
        self._update_config_info()
    
    def _update_config_info(self):
        """Update configuration info display"""
        try:
            if hasattr(self, 'config_info_text'):
                from providor.providor_index import CONFIG_USER_PATH
                from pathlib import Path
                
                config_file = Path(CONFIG_USER_PATH)
                info_text = f"""当前配置信息:
配置文件: {CONFIG_USER_PATH}
文件存在: {'是' if config_file.exists() else '否'}
文件大小: {config_file.stat().st_size if config_file.exists() else 0} 字节
可用配置: config1, config2, config3, config4

当前技能配置: {self.current_config}
"""
                self.config_info_text.delete(1.0, tk.END)
                self.config_info_text.insert(1.0, info_text)
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to update config info: {e}")
    
    def _switch_config(self, config_name):
        """Switch to different configuration"""
        try:
            self.current_config = config_name
            self._update_tab_highlight()
            
            # Load configuration data
            from providor.providor_index import CONFIG
            skill_config = CONFIG.get('macro_configs', {}).get('skill_configs', {}).get(config_name, {})
            if skill_config:
                self._load_skill_config(skill_config)
            
            # Call callback
            if self.on_skill_config_switch:
                self.on_skill_config_switch(config_name)
            
            ColorPrint.blue(f"[UI] Switched to configuration: {config_name}")
            
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to switch configuration: {e}")
    
    def _load_skill_config(self, config_data):
        """Load skill configuration data"""
        try:
            skills = config_data.get('skills', {})
            
            for skill_name, skill_data in skills.items():
                if skill_name in self.skill_vars:
                    self.skill_vars[skill_name].set(skill_data.get('key', ''))
                    self.strategy_vars[skill_name].set(skill_data.get('strategy', '连续'))
                    self.interval_vars[skill_name].set(str(skill_data.get('interval', 100)))
                    self.delay_vars[skill_name].set(str(skill_data.get('delay', 0)))
                    self.random_delay_vars[skill_name].set(str(skill_data.get('random_delay', 0)))
            
            # Load additional settings
            self.quick_switch_var.set(config_data.get('quick_switch', 'F1'))
            self.movement_var.set(config_data.get('movement', '空格'))
            self.potion_var.set(config_data.get('potion', 'Q'))
            self.potion_interval_var.set(str(config_data.get('potion_interval', 500)))
            
        except Exception as e:
            ColorPrint.red(f"[UI] Failed to load skill configuration: {e}")
    
    def _update_tab_highlight(self):
        """Update tab button highlighting"""
        for config_name, button in self.tab_buttons.items():
            if config_name == self.current_config:
                button.configure(style='Accent.TButton')
            else:
                button.configure(style='TButton')
    
    def get_current_config(self):
        """Get current configuration name"""
        return self.current_config
    
    def set_config_change_callback(self, callback):
        """Set configuration change callback"""
        self.on_config_change = callback
    
    def set_skill_config_switch_callback(self, callback):
        """Set skill config switch callback"""
        self.on_skill_config_switch = callback
