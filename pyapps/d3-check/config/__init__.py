#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuration Package
Unified configuration management for D3-Check application.

Prefer direct imports from submodules (no secondary encapsulation):
  from config.unified_config import get_config_manager, get_skill_config, ...
  from config.grid_config import get_grid_config, update_grid_config
  Literal constants (GRID_ROWS, etc.) from providor.constants.common.
"""

# Import from unified config
from .unified_config import (
    # Constants
    GRID_ROWS,
    GRID_COLS,
    TOTAL_GRID_CELLS,
    GRID_TYPE_NINE,
    GRID_TYPE_CUSTOM,
    GRID_DESCRIPTION,
    COMMON_KEY_OPTIONS,
    COMMON_STRATEGY_OPTIONS,
    DEFAULT_SKILL_CONFIG,
    SPECIAL_SKILL_CONFIGS,

    # Enums
    SkillStrategy,
    ConfigType,

    # Data Structures
    SkillConfig,
    SkillConfigSet,
    MacroConfigs,
    TemplateConfig,

    # Utility Classes
    DataConverter,
    ConfigManager,

    # Utility Functions
    get_grid_config,
    update_grid_config,
    create_skill_config,
    get_default_skill_configs,
    get_special_skill_config,

    # Global Instances
    get_config_manager,
    config_manager,

    # Convenience Functions
    get_skill_config,
    set_skill_config,
    save_all_configs,
    reload_all_configs,
)

# Import from grid config (keep separate for now)
from .grid_config import (
    get_grid_config as grid_get_config,
    update_grid_config as grid_update_config
)

# Import i18n manager (project-wide singleton) from d3utils
from providor.i18n_manager import i18n_manager

__all__ = [
    # Constants
    'GRID_ROWS',
    'GRID_COLS',
    'TOTAL_GRID_CELLS',
    'GRID_TYPE_NINE',
    'GRID_TYPE_CUSTOM',
    'GRID_DESCRIPTION',
    'COMMON_KEY_OPTIONS',
    'COMMON_STRATEGY_OPTIONS',
    'DEFAULT_SKILL_CONFIG',
    'SPECIAL_SKILL_CONFIGS',

    # Enums
    'SkillStrategy',
    'ConfigType',

    # Data Structures
    'SkillConfig',
    'SkillConfigSet',
    'MacroConfigs',
    'TemplateConfig',

    # Utility Classes
    'DataConverter',
    'ConfigManager',

    # Utility Functions
    'get_grid_config',
    'update_grid_config',
    'create_skill_config',
    'get_default_skill_configs',
    'get_special_skill_config',

    # Global Instances
    'get_config_manager',
    'config_manager',

    # Convenience Functions
    'get_skill_config',
    'set_skill_config',
    'save_all_configs',
    'reload_all_configs',

    # I18n Manager
    'i18n_manager'
]
