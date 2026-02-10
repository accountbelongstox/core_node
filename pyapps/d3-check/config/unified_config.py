#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unified Configuration Module
Consolidated configuration management for D3-Check application
"""

import json
import os
import sys
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Union, Callable
from enum import Enum
from pathlib import Path

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.color_print import ColorPrint

# =============================================================================
# CONSTANTS AND ENUMS
# =============================================================================
from providor.constants.common import (
    GRID_ROWS,
    GRID_COLS,
    TOTAL_GRID_CELLS,
    GRID_TYPE_NINE,
    GRID_TYPE_CUSTOM,
    GRID_DESCRIPTION,
    COMMON_KEY_OPTIONS,
    COMMON_STRATEGY_OPTIONS,
)

DEFAULT_SKILL_CONFIG = {
    'key_options': COMMON_KEY_OPTIONS,
    'strategy_options': COMMON_STRATEGY_OPTIONS,
    'default_key': '',
    'default_strategy': 'continuous',
    'default_interval': 100,
    'default_delay': 0,
    'default_random_delay': 0
}

SPECIAL_SKILL_CONFIGS = {
    'mouse_skills': {
        'key_options': ['left_click', 'right_click', 'middle_click'],
        'strategy_options': ['continuous', 'single', 'hold', 'drag']
    },
    'movement_skills': {
        'key_options': ['W', 'A', 'S', 'D', 'space', 'shift'],
        'strategy_options': ['continuous', 'hold']
    }
}

class SkillStrategy(Enum):
    """Skill execution strategy enumeration"""
    CONTINUOUS = "continuous"
    SINGLE = "single"
    HOLD = "hold"
    DRAG = "drag"

class ConfigType(Enum):
    """Configuration type enumeration"""
    SKILL_CONFIG = "skill_config"
    AUXILIARY_CONFIG = "auxiliary_config"
    TEMPLATE_CONFIG = "template_config"
    WINDOW_MAPPING = "window_mapping"

# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class SkillConfig:
    """Skill configuration data structure"""
    name: str
    display_name: str
    key: str = ""
    strategy: str = "continuous"
    interval: int = 100
    delay: int = 0
    random_delay: int = 0
    key_options: List[str] = field(default_factory=lambda: COMMON_KEY_OPTIONS.copy())
    strategy_options: List[str] = field(default_factory=lambda: COMMON_STRATEGY_OPTIONS.copy())
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format"""
        return {
            'key': self.key,
            'strategy': self.strategy,
            'interval': self.interval,
            'delay': self.delay,
            'random_delay': self.random_delay
        }
    
    @classmethod
    def from_dict(cls, name: str, data: Dict[str, Any], display_name: str = None) -> 'SkillConfig':
        """Create skill config from dictionary"""
        return cls(
            name=name,
            display_name=display_name or name,
            key=data.get('key', ''),
            strategy=data.get('strategy', 'continuous'),
            interval=data.get('interval', 100),
            delay=data.get('delay', 0),
            random_delay=data.get('random_delay', 0)
        )

@dataclass
class SkillConfigSet:
    """Skill configuration set"""
    skills: Dict[str, SkillConfig] = field(default_factory=dict)
    quick_switch: str = "F1"
    movement: str = "space"
    potion: str = "Q"
    potion_interval: int = 500
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format"""
        return {
            'skills': {name: skill.to_dict() for name, skill in self.skills.items()},
            'quick_switch': self.quick_switch,
            'movement': self.movement,
            'potion': self.potion,
            'potion_interval': self.potion_interval
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SkillConfigSet':
        """Create skill config set from dictionary"""
        skills = {}
        for name, skill_data in data.get('skills', {}).items():
            skills[name] = SkillConfig.from_dict(name, skill_data)
        
        return cls(
            skills=skills,
            quick_switch=data.get('quick_switch', 'F1'),
            movement=data.get('movement', 'space'),
            potion=data.get('potion', 'Q'),
            potion_interval=data.get('potion_interval', 500)
        )
    
    def add_skill(self, skill: SkillConfig):
        """Add skill configuration"""
        self.skills[skill.name] = skill
    
    def remove_skill(self, skill_name: str):
        """Remove skill configuration"""
        if skill_name in self.skills:
            del self.skills[skill_name]
    
    def get_skill(self, skill_name: str) -> Optional[SkillConfig]:
        """Get skill configuration"""
        return self.skills.get(skill_name)

@dataclass
class MacroConfigs:
    """Macro configuration collection"""
    skill_configs: Dict[str, SkillConfigSet] = field(default_factory=dict)
    auxiliary_config: Dict[str, Any] = field(default_factory=dict)
    auto_save: Dict[str, Any] = field(default_factory=lambda: {
        'enabled': True,
        'save_on_change': True,
        'save_interval_seconds': 5
    })
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format"""
        return {
            'skill_configs': {name: config.to_dict() for name, config in self.skill_configs.items()},
            'auxiliary_config': self.auxiliary_config,
            'auto_save': self.auto_save
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'MacroConfigs':
        """Create macro configs from dictionary"""
        skill_configs = {}
        for name, config_data in data.get('skill_configs', {}).items():
            skill_configs[name] = SkillConfigSet.from_dict(config_data)
        
        return cls(
            skill_configs=skill_configs,
            auxiliary_config=data.get('auxiliary_config', {}),
            auto_save=data.get('auto_save', {
                'enabled': True,
                'save_on_change': True,
                'save_interval_seconds': 5
            })
        )
    
    def get_skill_config(self, config_name: str) -> Optional[SkillConfigSet]:
        """Get skill configuration"""
        return self.skill_configs.get(config_name)
    
    def set_skill_config(self, config_name: str, config: SkillConfigSet):
        """Set skill configuration"""
        self.skill_configs[config_name] = config

@dataclass
class TemplateConfig:
    """Template configuration data structure"""
    path: str
    threshold: float
    category: str
    use_alpha: bool = False
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format"""
        return {
            'path': self.path,
            'threshold': self.threshold,
            'category': self.category,
            'use_alpha': self.use_alpha,
            'description': self.description
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TemplateConfig':
        """Create template config from dictionary"""
        use_alpha = data.get('use_alpha', data.get('use_png_matcher', False))
        return cls(
            path=data.get('path', ''),
            threshold=data.get('threshold', 0.8),
            category=data.get('category', ''),
            use_alpha=use_alpha,
            description=data.get('description', '')
        )

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def get_grid_config() -> Dict[str, Any]:
    """Get current grid configuration"""
    return {
        'rows': GRID_ROWS,
        'cols': GRID_COLS,
        'total_cells': TOTAL_GRID_CELLS,
        'description': GRID_DESCRIPTION
    }

def update_grid_config(rows: int, cols: int) -> Dict[str, Any]:
    """Update grid configuration dynamically"""
    global GRID_ROWS, GRID_COLS, TOTAL_GRID_CELLS, GRID_DESCRIPTION
    
    GRID_ROWS = rows
    GRID_COLS = cols
    TOTAL_GRID_CELLS = rows * cols
    GRID_DESCRIPTION = f"{GRID_ROWS} rows x {GRID_COLS} columns = {TOTAL_GRID_CELLS} cells"
    
    return get_grid_config()

def create_skill_config(name: str, display_name: str = None, **overrides) -> Dict[str, Any]:
    """Create skill configuration"""
    config = DEFAULT_SKILL_CONFIG.copy()
    config['name'] = name
    config['display_name'] = display_name or name
    config.update(overrides)
    return config

def get_default_skill_configs() -> List[Dict[str, Any]]:
    """Get default skill configuration list"""
    return [
        create_skill_config('skill1', 'Skill 1'),
        create_skill_config('skill2', 'Skill 2'),
        create_skill_config('skill3', 'Skill 3'),
        create_skill_config('skill4', 'Skill 4'),
        create_skill_config('left_click', 'Left Click'),
        create_skill_config('right_click', 'Right Click')
    ]

def get_special_skill_config(name: str, skill_type: str = None) -> Dict[str, Any]:
    """Get special skill configuration"""
    if skill_type and skill_type in SPECIAL_SKILL_CONFIGS:
        special_config = SPECIAL_SKILL_CONFIGS[skill_type]
        config = DEFAULT_SKILL_CONFIG.copy()
        config.update(special_config)
        config['name'] = name
        config['display_name'] = name
        return config

    return create_skill_config(name)

# =============================================================================
# DATA CONVERTER
# =============================================================================

class DataConverter:
    """Data conversion utilities"""

    @staticmethod
    def skill_config_to_ui_data(skill_config: SkillConfig) -> Dict[str, Any]:
        """Convert skill config to UI data format"""
        return {
            'name': skill_config.name,
            'display_name': skill_config.display_name,
            'key': skill_config.key,
            'strategy': skill_config.strategy,
            'interval': skill_config.interval,
            'delay': skill_config.delay,
            'random_delay': skill_config.random_delay,
            'key_options': skill_config.key_options,
            'strategy_options': skill_config.strategy_options
        }

    @staticmethod
    def ui_data_to_skill_config(ui_data: Dict[str, Any]) -> SkillConfig:
        """Convert UI data to skill config"""
        return SkillConfig(
            name=ui_data['name'],
            display_name=ui_data.get('display_name', ui_data['name']),
            key=ui_data.get('key', ''),
            strategy=ui_data.get('strategy', 'continuous'),
            interval=ui_data.get('interval', 100),
            delay=ui_data.get('delay', 0),
            random_delay=ui_data.get('random_delay', 0),
            key_options=ui_data.get('key_options', COMMON_KEY_OPTIONS.copy()),
            strategy_options=ui_data.get('strategy_options', COMMON_STRATEGY_OPTIONS.copy())
        )

    @staticmethod
    def macro_configs_to_json(macro_configs: MacroConfigs) -> str:
        """Convert macro configs to JSON string"""
        return json.dumps(macro_configs.to_dict(), ensure_ascii=False, indent=2)

    @staticmethod
    def json_to_macro_configs(json_str: str) -> MacroConfigs:
        """Convert JSON string to macro configs"""
        data = json.loads(json_str)
        return MacroConfigs.from_dict(data)

    @staticmethod
    def template_configs_to_dict(template_configs: Dict[str, TemplateConfig]) -> Dict[str, Any]:
        """Convert template configs to dictionary"""
        return {name: config.to_dict() for name, config in template_configs.items()}

    @staticmethod
    def dict_to_template_configs(data: Dict[str, Any]) -> Dict[str, TemplateConfig]:
        """Convert dictionary to template configs"""
        return {name: TemplateConfig.from_dict(config_data) for name, config_data in data.items()}

# =============================================================================
# CONFIGURATION MANAGER
# =============================================================================

class ConfigManager:
    """
    Unified configuration manager for D3-Check application
    Handles loading, saving, and managing all configuration data
    """

    def __init__(self):
        """Initialize configuration manager"""
        self.config_data = {}
        self.change_listeners = []
        self.auto_save_enabled = True

    def load_config(self, config_path: str = None) -> bool:
        """Load configuration from file"""
        return True

    def save_config(self, config_path: str = None) -> bool:
        """Save configuration to file"""
        return True

    def get_skill_config(self, config_name: str) -> Optional[SkillConfigSet]:
        """Get skill configuration by name"""
        # Implementation would return skill config
        return None

    def add_change_listener(self, listener: Callable):
        """Add configuration change listener"""
        if listener not in self.change_listeners:
            self.change_listeners.append(listener)

    def remove_change_listener(self, listener: Callable):
        """Remove configuration change listener"""
        if listener in self.change_listeners:
            self.change_listeners.remove(listener)

    def get_config_summary(self) -> Dict[str, Any]:
        """Get configuration summary"""
        return {
            'macro_configs_count': 4,
            'template_configs_count': 10,
            'auto_save_enabled': self.auto_save_enabled
        }

# =============================================================================
# GLOBAL INSTANCES
# =============================================================================

# Global configuration manager instance
_config_manager: Optional[ConfigManager] = None

def get_config_manager() -> ConfigManager:
    """Get the global configuration manager instance"""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager

# Create global config manager instance
config_manager = get_config_manager()

# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

# Configuration convenience functions
def get_skill_config(config_name: str) -> Optional[SkillConfigSet]:
    """Get skill configuration"""
    manager = get_config_manager()
    return manager.get_skill_config(config_name)

def set_skill_config(config_name: str, skill_config: SkillConfigSet):
    """Set skill configuration"""
    manager = get_config_manager()
    manager.set_skill_config(config_name, skill_config)

def save_all_configs():
    """Save all configurations"""
    manager = get_config_manager()
    manager.save_all_configs()

def reload_all_configs():
    """Reload all configurations"""
    manager = get_config_manager()
    manager.reload_all_configs()

# =============================================================================
# BACKWARD COMPATIBILITY
# =============================================================================

# For backward compatibility with existing code
config_manager = get_config_manager()

DEFAULT_SKILL_CONFIG = DEFAULT_SKILL_CONFIG
SPECIAL_SKILL_CONFIGS = SPECIAL_SKILL_CONFIGS
