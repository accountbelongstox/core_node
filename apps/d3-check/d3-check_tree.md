# Directory Tree: d3-check

**Path:** `D:\programing\core_node\apps\d3-check`

```
d3-check/
├── config/
│   ├── datasets/
│   │   └── d3_ui/
│   │       └── data.yaml
│   ├── training/
│   │   └── d3_ui_training.yaml
│   ├── __init__.py
│   ├── grid_config.py
│   └── unified_config.py
├── controller/
│   ├── ctl_func/
│   │   ├── __init__.py
│   │   └── blacksmith_handler.py
│   ├── _obsolete_battlenet_controller.py
│   ├── _obsolete_bot_state_manager.py
│   ├── _obsolete_game_management_controller.py
│   ├── _obsolete_main_controller.py
│   ├── _obsolete_monitoring_controller.py
│   ├── d3_macro_controller.py
│   ├── d3_macro_controller_optimized.py
│   ├── game_assistant_controller.py
│   ├── game_interface_controller.py
│   └── pathfinding_controller.py
├── d3utils/
│   ├── collectors/
│   │   ├── collect_tools/
│   │   │   ├── bag_layout_detector.py
│   │   │   └── button_put_material_detector.py
│   │   ├── __init__.py
│   │   ├── bag_info_collector.py
│   │   ├── grid_screenshot_collector.py
│   │   ├── ui_region_collector_anchor.py
│   │   ├── ui_region_collector_optimized.py
│   │   └── ui_region_collector_ultralytics.py
│   ├── d3u_common/
│   │   ├── __init__.py
│   │   └── image_annotator_helper.py
│   ├── share/
│   │   ├── __init__.py
│   │   └── game_interface_data.py
│   ├── _obsolete___init__.py
│   ├── _obsolete_bag_item_detector.py
│   ├── _obsolete_interface_property_detector.py
│   ├── _obsolete_resolution_scaler.py
│   ├── game_window_detector.py
│   ├── global_hotkey_manager.py
│   ├── i18n_manager.py
│   ├── interface_manager.py
│   ├── scaled_template_matcher.py
│   ├── screenshot_provider.py
│   ├── state_aware_click_handler.py
│   └── system_initializer.py
├── images/
│   ├── bag_border.png
│   ├── bag_buttom.png
│   ├── bag_left.png
│   ├── bag_right.png
│   ├── blacksmith_indicator_1.png
│   ├── blacksmith_indicator_2.png
│   ├── blacksmith_salvage_button.png
│   ├── blacksmith_sidebar_tab_1.png
│   ├── blacksmith_sidebar_tab_2.png
│   ├── button_convert_disabled.png
│   ├── button_convert_enabled.png
│   ├── button_put_material_alt.png
│   ├── game_anchor_bottom_left_1.png
│   ├── game_anchor_bottom_left_2.png
│   ├── game_anchor_bottom_left_3.png
│   ├── game_anchor_bottom_right.png
│   ├── item_ancient_set.png
│   ├── item_legendary.png
│   ├── item_primal_ancient.png
│   ├── item_rare_blue.png
│   ├── item_rare_yellow.png
│   ├── kanai_next_page_icon.png
│   ├── kanai_right_panel_opened_indicator.png
│   ├── kanai_right_panel_toggle_icon.png
│   ├── quality_yellow_colors.jpg
│   ├── reforge_interface_indicator.png
│   ├── slot_empty.png
│   ├── slot_interference_colors.png
│   └── weox_20251005072400.png
├── providor/
│   ├── i18n/
│   │   ├── README.md
│   │   ├── i18n_auxiliary_panel_en.json
│   │   ├── i18n_auxiliary_panel_zh.json
│   │   ├── i18n_base.json
│   │   ├── i18n_common_en.json
│   │   ├── i18n_common_zh.json
│   │   ├── i18n_errors_en.json
│   │   ├── i18n_errors_zh.json
│   │   ├── i18n_log_panel_en.json
│   │   ├── i18n_log_panel_zh.json
│   │   ├── i18n_main_window_en.json
│   │   ├── i18n_main_window_zh.json
│   │   ├── i18n_rosbot_panel_en.json
│   │   ├── i18n_rosbot_panel_zh.json
│   │   ├── i18n_skill_config_en.json
│   │   └── i18n_skill_config_zh.json
│   ├── _obsolete_game_state.py
│   ├── _obsolete_window_mapping_provider.py
│   ├── common_imports.py
│   ├── i18n_config.json
│   ├── i18n_config.json.backup
│   ├── providor_index.py
│   └── template_config.json
├── scripts/
│   ├── _obsolete_multi_scale_image_matcher.py
│   └── d3planner_tooltip_test.py
├── state/
│   ├── _obsolete_comprehensive_state_manager.py
│   └── _obsolete_game_state_manager.py
├── ui/
│   ├── components/
│   │   ├── __init__.py
│   │   ├── bottom_bar.py
│   │   ├── macro_controls.py
│   │   ├── menu_bar.py
│   │   ├── status_bar.py
│   │   ├── system_tray.py
│   │   └── title_bar.py
│   ├── panels/
│   │   ├── auxiliary_functions_panel.py
│   │   ├── log_panel.py
│   │   ├── main_functions_panel.py
│   │   └── rosbot_extension_panel.py
│   ├── theme/
│   │   ├── __init__.py
│   │   └── theme.py
│   ├── utils/
│   │   └── config_binding.py
│   ├── widgets/
│   │   ├── __init__.py
│   │   ├── basic.py
│   │   └── combobox.py
│   ├── diablo3_macro_ui.py
│   └── unified_styles.py
├── utils/
│   ├── _obsolete_analyzer_log.py
│   ├── _obsolete_app_launcher.py
│   ├── _obsolete_automation_controller.py
│   ├── _obsolete_battlenet_manager.py
│   ├── _obsolete_bot_scanner.py
│   ├── _obsolete_click_handler.py
│   ├── _obsolete_color_print.py
│   ├── _obsolete_comprehensive_state_manager.py
│   ├── _obsolete_coordinate_monitor.py
│   ├── _obsolete_d3_inventory_analyzer.py
│   ├── _obsolete_d3keyhelper.ahk
│   ├── _obsolete_daily_schedule.py
│   ├── _obsolete_dependency_checker.py
│   ├── _obsolete_diablo_button_clicker.py
│   ├── _obsolete_ftool.py
│   ├── _obsolete_game_process_detector.py
│   ├── _obsolete_game_state_manager.py
│   ├── _obsolete_integrated_automation_controller.py
│   ├── _obsolete_integrated_diablo_clicker.py
│   ├── _obsolete_integrated_window_analyzer.py
│   ├── _obsolete_log_monitor.py
│   ├── _obsolete_parse_history.py
│   ├── _obsolete_play_button_clicker.py
│   ├── _obsolete_process_manager.py
│   ├── _obsolete_program_manager.py
│   ├── _obsolete_random_utils.py
│   ├── _obsolete_rosbot_manager.py
│   ├── _obsolete_time_tool.py
│   ├── _obsolete_tray_clicker.py
│   ├── _obsolete_ui_analyzer.py
│   ├── _obsolete_ui_automation_controller.py
│   ├── _obsolete_window_activator.py
│   ├── _obsolete_window_analyzer.py
│   └── _obsolete_window_ops.py
├── CODE_OPTIMIZATION_COMPARISON.md
├── CONFIG_CONSOLIDATION_SUMMARY.md
├── STATUS_BAR_IMPLEMENTATION_SUMMARY.md
├── UI_CLEANUP_SUMMARY.md
├── UI_OPTIMIZATION_SUMMARY.md
├── analyzer-log.bat
├── analyzer-log.ps1
├── d3-check_tree.md
├── initServer.ps1
├── log.txt
├── main.py
├── main_optimized.py
├── task.txt
├── train.py
├── ui_demo_optimized.py
├── ui_demo_simple.py
├── watch-log.ps1
└── watch.bat
```

---
*Generated by Directory Tree Generator*