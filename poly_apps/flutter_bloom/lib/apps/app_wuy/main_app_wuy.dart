// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:qyflutter/common/app/main_common.dart';
import 'config_app_wuy/app_config_app_wuy.dart';
import 'router_app_wuy/router_app_wuy.dart';
import 'settings_app_wuy/settings_app_wuy.dart';
import 'localization_app_wuy/locales_provider_app_wuy.dart';
import 'utils_app_wuy/app_info_app_wuy.dart';

/// Wuy App specific widget
/// This can be customized for Wuy app specific needs
class WuyApp extends StatelessWidget {
  const WuyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // For now, use the common app structure
    // Later this can be customized for Wuy app specific needs
    return FlutterBloomMainApp(
      routerConfig: WuyAppRouter.createRouter(),
    );
  }
}

/// Wuy App specific main entry point
/// This entry point can be used to launch only the Wuy app
/// with specific configurations and customizations
Future<void> main() async {
  // Initialize Wuy app-specific configurations
  WuyAppInfo.initializeApp();

  await runCommonApp(
    appName: AppConfigAppWuy.appName,
    appId: AppConfigAppWuy.appId, // Specific app ID for app-specific routing
    appSettings: WuyAppSettings.getWuySettings(), // Wuy specific settings
    enAppLocales: WuyAppLocales.getEnLocales(),
    zhAppLocales: WuyAppLocales.getZhLocales(),
    routerConfig: WuyAppRouter.createRouter(), // Use createRouter method as per guidelines
    initialRoute: WuyAppRouter.getDefaultRoute(),
    homeRoute: WuyAppRouter.getHomeRoute(),
    appConfig: AppConfigAppWuy.appInfo,
    customApp: const WuyApp(),
  );
}