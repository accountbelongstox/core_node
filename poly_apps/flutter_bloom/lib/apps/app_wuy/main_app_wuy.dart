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
import 'package:provider/provider.dart';
import 'package:qyflutter/common/app/main_common.dart';
import 'config_app_wuy/app_config_app_wuy.dart';
import 'router_app_wuy/router_app_wuy.dart';
import 'settings_app_wuy/settings_app_wuy.dart';
import 'localization_app_wuy/en_app_wuy.dart';
import 'localization_app_wuy/zh_app_wuy.dart';
import 'utils_app_wuy/app_info_app_wuy.dart';
import 'providers_app_wuy/app_prefs_app_wuy.dart';
import 'providers_app_wuy/wu_user_provider.dart';
import 'services_app_wuy/wuy_unified_service.dart';
import 'services_app_wuy/wuy_auth_state_manager.dart';

/// Wuy App specific widget
/// This can be customized for Wuy app specific needs
class WuyApp extends StatelessWidget {
  const WuyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Use the common app structure with router config
    // We need to pass routerConfig since we're using customApp
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

  // Initialize app-specific SharedPreferences
  final AppPrefsAppWuy appPrefs = AppPrefsAppWuy.instance;
  await appPrefs.initSharedPreferences();

  // Create app-specific user provider first
  final WuUserProvider userProvider = WuUserProvider();

  // Initialize unified service (without storage initialization)
  final WuyUnifiedService unifiedService = WuyUnifiedService();
  unifiedService.initializeWithUserProvider(userProvider: userProvider);

  // Note: WuyAuthStateManager will be initialized after runCommonApp initializes UnifiedStorage

  await runCommonApp(
    appName: AppConfigAppWuy.appName,
    appId: AppConfigAppWuy.appId, // Specific app ID for app-specific routing
    appSettings: WuyAppSettings.getWuySettings(), // Wuy specific settings
    enAppLocales: [EnAppWuy.locales],
    zhAppLocales: [ZhAppWuy.locales],
    routerConfig: WuyAppRouter.createRouter(), // Use createRouter method as per guidelines
    initialRoute: WuyAppRouter.getDefaultRoute(), // This will be overridden by GoRouter's initialLocation
    homeRoute: WuyAppRouter.getHomeRoute(),
    appConfig: AppConfigAppWuy.appInfo,
    customApp: const WuyApp(),
    appPrefs: appPrefs, // Provide app-specific SharedPreferences
    customUserProvider: userProvider, // Provide app-specific user provider
    additionalProviders: [
      // Register WuUserProvider as a specific type for AuthGuard access
      ChangeNotifierProvider<WuUserProvider>.value(value: userProvider),
    ],
    initializeUnifiedStorage: true, // Use v1 storage (UnifiedStorage + SQLite)
  );

  // Initialize auth state manager after runCommonApp has initialized UnifiedStorage
  final WuyAuthStateManager authStateManager = WuyAuthStateManager.instance;
  await authStateManager.initialize();
}