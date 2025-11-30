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
import 'providers_app_wuy/friends_provider_app_wuy.dart';
import 'services_app_wuy/wuy_unified_service.dart';
import 'services_app_wuy/wuy_auth_state_manager.dart';
import 'models_app_wuy/user_model_app_wuy.dart';

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
  // Initialize Flutter binding first
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Wuy app-specific configurations
  WuyAppInfo.initializeApp();

  // Initialize app-specific SharedPreferences
  final AppPrefsAppWuy appPrefs = AppPrefsAppWuy.instance;
  await appPrefs.initSharedPreferences();

  // Create app-specific user provider first
  final WuUserProvider userProvider = WuUserProvider();

  // Create friends provider
  final FriendsProviderAppWuy friendsProvider = FriendsProviderAppWuy();

  // Initialize unified data manager
  final WuyUnifiedService dataManager = WuyUnifiedService();

  // Initialize auth state manager BEFORE runCommonApp
  final WuyAuthStateManager authStateManager = WuyAuthStateManager.instance;
  await authStateManager.initialize();

  // Note: Test user creation moved to after runCommonApp to ensure UnifiedStorage is initialized

  await runCommonApp(
    appName: AppConfigAppWuy.appName,
    appId: AppConfigAppWuy.appId, // Specific app ID for app-specific routing
    appSettings: WuyAppSettings.getWuySettings(), // Wuy specific settings
    enAppLocales: [EnAppWuy.locales],
    zhAppLocales: [ZhAppWuy.locales],
    routerConfig: WuyAppRouter
        .createRouter(), // Use createRouter method as per guidelines
    initialRoute: WuyAppRouter
        .getDefaultRoute(), // This will be overridden by GoRouter's initialLocation
    homeRoute: WuyAppRouter.getHomeRoute(),
    appConfig: AppConfigAppWuy.appInfo,
    customApp: const WuyApp(),
    appPrefs: appPrefs, // Provide app-specific SharedPreferences
    customUserProvider: userProvider, // Provide app-specific user provider
    additionalProviders: [
      // Register WuUserProvider as a specific type for AuthGuard access
      ChangeNotifierProvider<WuUserProvider>.value(value: userProvider),
      // Register FriendsProviderAppWuy for friends list management
      ChangeNotifierProvider<FriendsProviderAppWuy>.value(value: friendsProvider),
    ],
    initializeUnifiedStorage: true, // Use v1 storage (UnifiedStorage + SQLite)
  );

  // Initialize data manager after runCommonApp has initialized UnifiedStorage
  await dataManager.initialize();
  dataManager.initializeWithUserProvider(userProvider: userProvider);

  // For testing: Create a test user if no user is authenticated (after UnifiedStorage is initialized)
  if (!authStateManager.isAuthenticated) {
    debugPrint(
        'No authenticated user found, creating test user for development');
    // Create a test user for development
    final testUser = UserModelAppWuy(
      id: 1,
      name: 'Test User',
      username: 'test_user_001',
      email: 'test@example.com',
      phoneNumber: '+1234567890',
      isActive: true,
      isVerified: true,
      preferences: {},
    );
    await authStateManager.setAuthenticatedUser(testUser);
    debugPrint('Test user created and authenticated');
  }
}
