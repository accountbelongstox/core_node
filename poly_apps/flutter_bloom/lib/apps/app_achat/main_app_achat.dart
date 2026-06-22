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
import 'config_app_achat/app_config.dart';
import 'config_app_achat/provider_app_achat.dart';
import 'router_app_achat/router_app_achat.dart';
import 'settings_app_achat/settings_app_achat.dart';
import 'localization_app_achat/en_app_achat.dart';
import 'localization_app_achat/zh_app_achat.dart';
import 'services_app_achat/achat_service.dart';

/// AChat App specific widget
/// This can be customized for AChat app specific needs
class AChatApp extends StatelessWidget {
  const AChatApp({super.key});

  @override
  Widget build(BuildContext context) {
    // For now, use the common app structure
    // Later this can be customized for AChat app specific needs
    return const FlutterBloomMainApp();
  }
}

/// AChat App specific main entry point
/// This entry point can be used to launch only the AChat app
/// with specific configurations and customizations
/// 
/// NOTE: We pass the AChat SharedPreferences class to runCommonApp
/// which will properly initialize it after Flutter binding is ready
Future<void> main() async {
  // Initialize AChat service for BankV1 backend integration
  try {
    await AChatService.instance.initialize();
    print('AChat service initialized successfully');
  } catch (e) {
    print('Failed to initialize AChat service: $e');
  }

  await runCommonApp(
    appName: AChatAppConfig.appName,
    appId: AChatAppConfig.appId, // Specific app ID for app-specific routing
    appSettings: AChatAppSettings.getAChatSettings(), // AChat specific settings
    enAppLocales: [AChatLocalizationEN.values],
    zhAppLocales: [AChatLocalizationZH.values],
    initialRoute: RouterAppAChat.home,
    homeRoute: RouterAppAChat.home,
    appConfig: AChatAppConfig.getConfig(),
    appPrefs: prefsAppAChat, // Pass AChat SharedPreferences instance from provider
    routerConfig: RouterAppAChat.createRouter(), // Pass the router configuration
    initializeUnifiedStorage: true, // Use v1 storage (UnifiedStorage + Hive)
  );
}
