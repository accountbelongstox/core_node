# Backup before PySide6 migration

This folder is a copy of the code that will be modified for the TK -> PySide6 upgrade.
Created so that functionality and visual style can be preserved during migration.

Contents:
- main.py
- controller/d3_macro_controller.py
- ui/ (entire directory: panels, components, widgets, utils, theme)
- share/: game_interface_data.py, asia_credentials.py, ui_registry.py, coordinate_helper.py
- share/values/: config_change_hub.py
- d3utils/: yolo_train_flow.py, rosbot_update_manager.py, screenshot_provider.py, shutdown_manager.py, window_resizer.py
- utils/: _obsolete_coordinate_monitor.py

Do not delete until PySide6 migration is verified.
