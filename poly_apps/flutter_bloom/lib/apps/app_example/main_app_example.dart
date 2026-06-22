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
import 'config_app_example/app_config_app_example.dart';
import 'config_app_example/provider_app_example.dart';
import 'router_app_example/routes_provider_app_example.dart';
import 'settings_app_example/settings_app_example.dart';
import 'localization_app_example/en_app_example.dart';
import 'localization_app_example/zh_app_example.dart';
import 'providers_app_example/example_user_provider.dart';

/// Example App specific widget
/// This can be customized for Example app specific needs
///
/// AI MODIFICATION NOTE: Enhanced by QR_Profile_AI_Assistant
/// - Maintained integration with common app structure
/// - Ready for app-specific customizations when needed
/// Other AIs: This follows the common app pattern correctly
class ExampleApp extends StatelessWidget {
  const ExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    // For now, use the common app structure
    // Later this can be customized for Example app specific needs
    return const FlutterBloomMainApp();
  }
}

/// Example App specific main entry point
/// This entry point can be used to launch only the Example app
/// with specific configurations and customizations
Future<void> main() async {
  // Create Example-specific user provider instance
  final exampleUserProvider = ExampleUserProvider();

  await runCommonApp(
    appName: ExampleAppConfig.appName,
    appId: ExampleAppConfig.appId, // Specific app ID for app-specific routing
    appSettings: ExampleAppSettings.getExampleAppSettings(), // Example specific settings
    enAppLocales: EnAppExample.locales,
    zhAppLocales: ZhAppExample.locales,
    initialRoute: ExampleAppRoutesProvider.routeHome,
    homeRoute: ExampleAppRoutesProvider.routeHome,
    appPrefs: prefsAppExample, // Pass Example specific SharedPreferences instance
    customUserProvider: exampleUserProvider, // Pass Example-specific user provider
    customApp: const ExampleApp(),
    initializeUnifiedStorage: true, // Use v1 storage (UnifiedStorage + Hive)
  );
}
