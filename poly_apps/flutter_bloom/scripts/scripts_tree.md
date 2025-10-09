# Directory Tree: scripts

**Path:** `D:\programing\core_node\poly_apps\flutter_bloom\scripts`

```
scripts/
├── build_debug_scripts/
│   ├── controllers/
│   │   ├── step1_project_copy_controller.py
│   │   ├── step2_asset_controller.py
│   │   ├── step3_platform_controller.py
│   │   └── step4_image_replacement_controller.py
│   ├── core/
│   │   ├── constants/
│   │   │   ├── __init__.py
│   │   │   └── build_constants.py
│   │   ├── debugging/
│   │   │   └── debug_provider.py
│   │   ├── gvar/
│   │   │   └── __init__.py
│   │   ├── __init__.py
│   │   ├── build_system.py
│   │   └── temp_build_dir.txt
│   ├── shared/
│   │   ├── data_exchange/
│   │   │   └── unified_variable_system.py
│   │   ├── __init__.py
│   │   ├── image_patterns.py
│   │   └── standard_image_data.py
│   ├── utils/
│   │   ├── platform_specs/
│   │   │   ├── __init__.py
│   │   │   ├── android_specs.py
│   │   │   ├── ios_specs.py
│   │   │   ├── macos_specs.py
│   │   │   ├── platform_specs_manager.py
│   │   │   ├── web_specs.py
│   │   │   └── windows_specs.py
│   │   ├── __init__.py
│   │   ├── asset_scanner.py
│   │   ├── commander.py
│   │   ├── enhanced_viewer.js
│   │   ├── factory_analyzer.py
│   │   ├── file_operations.py
│   │   ├── image_classifier.py
│   │   ├── image_processor.py
│   │   ├── menu_helper.py
│   │   ├── platform_image_scanner.py
│   │   ├── platform_specs_map.py
│   │   ├── print_helper.py
│   │   ├── smart_image_resizer.py
│   │   ├── smart_image_selector.py
│   │   ├── source_scanner.py
│   │   └── source_viewer_server.py
│   ├── web_static/
│   │   └── build_monitor.js
│   ├── web_templates/
│   │   └── build_monitor.html
│   ├── TREE.md
│   ├── build_app.ps1
│   ├── build_coordinator.py
│   ├── build_main.ps1
│   ├── main.py
│   ├── pre_compilation_assets.py
│   ├── prebuild_app.ps1
│   ├── print.py
│   └── source_viewer.py
├── build_scripts/
│   ├── controllers/
│   │   ├── step19_view_effects_controller.py
│   │   ├── step1_project_copy_controller.py
│   │   ├── step20_compilation_controller.py
│   │   ├── step2_asset_controller.py
│   │   ├── step3_platform_controller.py
│   │   ├── step4_image_replacement_controller.py
│   │   ├── step5_multiplatform_controller.py
│   │   ├── step7_android_config_controller.py
│   │   └── step8_pubspec_controller.py
│   ├── core/
│   │   ├── constants/
│   │   │   ├── __init__.py
│   │   │   └── build_constants.py
│   │   ├── debug/
│   │   │   ├── __init__.py
│   │   │   └── debug_system.py
│   │   ├── debugging/
│   │   │   └── debug_provider.py
│   │   ├── gvar/
│   │   │   └── __init__.py
│   │   ├── __init__.py
│   │   ├── app_scanner.py
│   │   ├── app_selector.py
│   │   ├── build_entry.py
│   │   ├── compilation_menu.py
│   │   ├── debug_entry.py
│   │   ├── decision_engine.py
│   │   ├── flutter_launcher.py
│   │   ├── modern_build_system.py
│   │   └── unified_launcher.py
│   ├── platforms/
│   │   ├── __init__.py
│   │   ├── android_debug.py
│   │   ├── base_debugger.py
│   │   ├── ios_debug.py
│   │   ├── web_debug.py
│   │   └── windows_debug.py
│   ├── shared/
│   │   ├── data_exchange/
│   │   │   └── unified_variable_system.py
│   │   ├── __init__.py
│   │   ├── directory_manager.py
│   │   ├── image_patterns.py
│   │   ├── resource_directory_collector.py
│   │   └── standard_image_data.py
│   ├── utils/
│   │   ├── platform_specs/
│   │   │   ├── __init__.py
│   │   │   ├── android_specs.py
│   │   │   ├── ios_specs.py
│   │   │   ├── macos_specs.py
│   │   │   ├── platform_specs_manager.py
│   │   │   ├── web_specs.py
│   │   │   └── windows_specs.py
│   │   ├── __init__.py
│   │   ├── app_config_reader.py
│   │   ├── backup_manager.py
│   │   ├── commander.py
│   │   ├── enhanced_viewer.js
│   │   ├── factory_analyzer.py
│   │   ├── file_operations.py
│   │   ├── flutter_to_android_asset_scanner.py
│   │   ├── image_classifier.py
│   │   ├── image_processor.py
│   │   ├── menu_helper.py
│   │   ├── platform_image_scanner.py
│   │   ├── print_helper.py
│   │   ├── smart_image_resizer.py
│   │   ├── smart_image_selector.py
│   │   ├── source_scanner.py
│   │   ├── source_viewer.py
│   │   └── source_viewer_server.py
│   ├── web_static/
│   │   └── build_monitor.js
│   ├── web_templates/
│   │   └── build_monitor.html
│   ├── TREE.md
│   ├── build_app.ps1
│   ├── build_main.ps1
│   ├── main.py
│   └── print.py
├── dev_debug/
│   ├── SplashManager.ps1
│   ├── startDebugByIOS.ps1
│   ├── startDebugByPhone.ps1
│   ├── startDebugByWeb.ps1
│   └── startDebugByWindows.ps1
├── devpy_debug/
│   ├── core/
│   │   ├── __init__.py
│   │   ├── app_manager.py
│   │   ├── config.py
│   │   └── file_manager.py
│   ├── platforms/
│   │   ├── __init__.py
│   │   ├── android.py
│   │   ├── ios.py
│   │   ├── web.py
│   │   └── windows.py
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── adb.py
│   │   ├── flutter.py
│   │   ├── logger.py
│   │   └── network.py
│   └── main.py
├── flutter_icon_reduction/
│   ├── README.md
│   ├── android_asset_generator.py
│   ├── asset_generator.py
│   ├── base_asset_generator.py
│   └── ios_asset_generator.py
├── flutter_icons_view/
│   ├── web_static/
│   │   └── app.js
│   ├── web_templates/
│   │   └── index.html
│   ├── FINAL_IMPLEMENTATION.md
│   ├── README.md
│   ├── check_dependencies.bat
│   ├── image_analyzer.py
│   ├── main.py
│   ├── quick_test.py
│   ├── run_icons_viewer.bat
│   ├── run_web_viewer.bat
│   ├── test_compress_fix.html
│   ├── test_final_fixes.py
│   ├── test_integration.py
│   └── web_main.py
├── flutter_icons_view_ui/
│   ├── README.md
│   ├── check_dependencies.bat
│   ├── image_analyzer.py
│   ├── main.py
│   ├── run_icons_viewer.bat
│   └── test_integration.py
├── utils/
│   └── platform_specs_map.py
├── win_common/
│   ├── python_package_installer/
│   │   ├── package_detector.py
│   │   └── package_installer.ps1
│   ├── BCommon.ps1
│   ├── CommonUtilities.ps1
│   ├── FlutterBackupManager.ps1
│   ├── FlutterBuildExecutor.ps1
│   ├── FlutterGlobalVar.ps1
│   ├── FlutterLogManager.ps1
│   └── FlutterMenuSystem.ps1
├── start.bat
├── start.ps1
├── start.sh
└── test_logging.ps1
```

---
*Generated by Directory Tree Generator*