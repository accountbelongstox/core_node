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

import 'dart:developer';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:qyflutter/common/utils/utils.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';
import 'package:qyflutter/common/settings/models/setting_item.dart';
import 'package:qyflutter/common/settings/storage/settings_storage_manager.dart';
import 'package:qyflutter/common/storage/storage_manager.dart';

import 'package:qyflutter/common/theme/compatibility/theme_compatibility.dart';
import 'package:qyflutter/common/theme/compatibility/gradient_compatibility.dart';
import 'package:qyflutter/common/iframe/iframe_listner.dart' as iframe;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_localization/flutter_localization.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/localization/language_change_notifier.dart';
import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_strategy/url_strategy.dart';
import 'package:qyflutter/common/localization/map_locales.dart';
import 'package:qyflutter/common/provider_status/user_provider.dart';
import 'package:qyflutter/common/provider_status/screen_size_provider.dart';
import 'package:qyflutter/common/storage/unified_storage.dart';
import 'package:qyflutter/common/storage/storage_migration_tool.dart';
import 'package:qyflutter/common/storage/app_prefs_base.dart';

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

// Global flag to track if the app has been initialized
bool _appInitialized = false;

void initializeWebFeatures() {
  final webTools = getWebTools();
  if (webTools.isInIframe()) {
    iframe.initIframeListenerIfWeb();
  }
}

/// Safely set URL strategy to prevent multiple calls
void _safeSetPathUrlStrategy() {
  if (kIsWeb) {
    try {
      setPathUrlStrategy();
    } catch (e) {
      // URL strategy already set or cannot be set, ignore silently
      // This prevents the "Cannot set URL strategy a second time" error
    }
  }
}

/// Common main entry point for all apps
/// This is a universal method that can be used by any app (achat, wuy, example, main, etc.)
/// It provides shared initialization logic and handles common app setup
///
/// IMPORTANT: This method is designed to be generic and reusable across different apps.
/// It is NOT specific to any single app like achat - it serves as a common foundation
/// for all apps in the Flutter Bloom project.
///
/// The method handles:
/// - Flutter binding initialization
/// - SharedPreferences setup (either from parameter or internal initialization)
/// - Storage system initialization
/// - Settings and localization setup
/// - App routing configuration
/// - Provider setup for state management
Future<void> runCommonApp({
  String? appName,
  String? appId, // App ID for routing configuration
  Widget? customApp,
  Map<String, dynamic>? appConfig,
  List<SettingItem>? appSettings, // Hardcoded app settings passed from entry
  // Hardcoded localization maps injection from entry points
  List<Map<String, dynamic>> enAppLocales = const [],
  List<Map<String, dynamic>> zhAppLocales = const [],
  // App-specific SharedPreferences class - can be provided or null for internal initialization
  AppPrefsBase? appPrefs, // App-specific SharedPreferences class (optional)
  // Custom UserProvider - if provided, will be used instead of default EnhancedUserProvider
  BaseUserProvider?
      customUserProvider, // Optional: App-specific user provider (e.g., ExampleUserProvider, WuUserProvider)
  // Route configuration - provided by app
  GoRouter? routerConfig, // App-specific router configuration
  String? initialRoute,
  String? homeRoute,
  String? splashRoute,
  List<dynamic>? additionalProviders, // Additional app-specific providers
  List<SingleChildWidget> Function(SettingsController commonSettingsController)?
      scopedProvidersBuilder,
  // Storage configuration - control whether to initialize UnifiedStorage
  bool initializeUnifiedStorage =
      true, // Default to true for backward compatibility
  ThemeData? lightTheme,
  ThemeData? darkTheme,
  List<ThemeExtension<dynamic>>? lightThemeExtensions,
  List<ThemeExtension<dynamic>>? darkThemeExtensions,
}) async {
  // Prevent multiple initializations
  if (_appInitialized) {
    debugPrint('App already initialized, skipping initialization');
    return;
  }

  WidgetsBinding widgetsBinding = WidgetsFlutterBinding.ensureInitialized();

  // Safely preserve native splash
  try {
    NativeSplashHelper.preserve(widgetsBinding: widgetsBinding);
  } catch (e) {
    // Native splash already preserved or cannot be preserved, ignore
    debugPrint('Native splash already preserved: $e');
  }

  // Safely initialize FlutterLocalization
  try {
    await FlutterLocalization.instance.ensureInitialized();
  } catch (e) {
    // FlutterLocalization already initialized, ignore
    debugPrint('FlutterLocalization already initialized: $e');
  }

  if (PlatformUtil.isMobile) {
    HttpOverrides.global = FlutterBloomHttpOverrides();
  }
  _safeSetPathUrlStrategy();

  if (kIsWeb) {
    initializeWebFeatures();
  }

  // Initialize unified storage system (optional)
  if (initializeUnifiedStorage) {
    await UnifiedStorage.init(appName: appName);

    // Check and perform data migration if needed
    if (await StorageMigrationTool.isMigrationNeeded()) {
      try {
        final migrationResult =
            await StorageMigrationTool.performCommonMigration();
        if (migrationResult.success) {
          log('Storage migration completed successfully: ${migrationResult.migratedItems} items migrated');
        } else {
          log('Storage migration failed: ${migrationResult.message}');
        }
      } catch (e) {
        log('Storage migration error: $e');
      }
    }
  } else {
    log('Skipping UnifiedStorage initialization - using app-specific storage');
  }

  // Inject localization maps based on the entry point
  AppLocale.setAppTranslations(
    enTranslations: enAppLocales,
    zhTranslations: zhAppLocales,
  );

  // Initialize language cache from FlutterLocalization
  final initialLanguage =
      FlutterLocalization.instance.currentLocale?.languageCode ?? 'en';
  AppLocale.updateCurrentLanguage(initialLanguage);

  // Handle SharedPreferences initialization
  // If appPrefs is provided, let it initialize SharedPreferences automatically
  // This allows apps to handle their own SharedPreferences initialization
  SharedPreferences prefs;

  if (appPrefs != null) {
    // Initialize the app-specific SharedPreferences class and get the prefs instance
    prefs = await appPrefs.initSharedPreferences();
    // The appPrefs now has the prefs instance and is ready to use
  } else {
    // Fallback: initialize SharedPreferences internally if no appPrefs provided
    prefs = await SharedPreferences.getInstance();
  }

  // Notify app-specific SharedPreferences classes about the initialized instance
  // This ensures they can use the SharedPreferences instance initialized after Flutter binding
  // This is a generic approach that works with any app-specific SharedPreferences class
  _notifyAppSpecificPrefs(prefs);

  // Initialize storage manager and settings storage
  final storageManager = StorageManager.instance;
  final settingsStorageManager = SettingsStorageManager(storageManager);

  // Initialize settings controller with storage
  final settingsController = SettingsController(
    prefs,
    settingsStorageManager,
    appSettings: appSettings,
  );

  // Initialize settings controller
  await settingsController.initialize();

  // Use custom user provider if provided, otherwise use default EnhancedUserProvider
  final userProvider = customUserProvider ?? EnhancedUserProvider();
  final screenSizeProvider = ScreenSizeProvider();

  // Safely remove splash screen after initialization
  try {
    NativeSplashHelper.remove();
  } catch (e) {
    // Native splash already removed or cannot be removed, ignore
    debugPrint('Native splash already removed: $e');
  }

  // Mark app as initialized
  _appInitialized = true;

  final languageChangeNotifier = LanguageChangeNotifier();

  final List<SingleChildWidget> providerList = [
    ChangeNotifierProvider.value(value: userProvider),
    Provider.value(value: prefs),
    ChangeNotifierProvider.value(value: settingsController),
    ChangeNotifierProvider.value(value: screenSizeProvider),
    ChangeNotifierProvider.value(value: languageChangeNotifier),
  ];

  if (appPrefs != null) {
    providerList.add(Provider.value(value: appPrefs));
  }

  if (scopedProvidersBuilder != null) {
    final scopedProviders = scopedProvidersBuilder(settingsController);
    if (scopedProviders.isNotEmpty) {
      providerList.addAll(scopedProviders);
    }
  }

  if (additionalProviders != null) {
    providerList.addAll(additionalProviders.cast<SingleChildWidget>());
  }

  runApp(
    MultiProvider(
      providers: providerList,
      child: customApp ??
          FlutterBloomMainApp(
            routerConfig: routerConfig,
            lightTheme: lightTheme,
            darkTheme: darkTheme,
            lightThemeExtensions: lightThemeExtensions,
            darkThemeExtensions: darkThemeExtensions,
          ),
    ),
  );

  if (PlatformUtil.isMobile) {
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        log('Initializing notifications with Android icon: notification_icon');
        await Future.delayed(const Duration(milliseconds: 500));
        await NotificationHelper.initialize(flutterLocalNotificationsPlugin);
        log('Notifications initialized successfully');
      } catch (e) {
        log('Failed to initialize notifications: $e');
        try {
          log('Trying fallback notification initialization with default icon');
          await NotificationHelper.initializeWithFallbackIcon(
            flutterLocalNotificationsPlugin,
          );
          log('Fallback notification initialization successful');
        } catch (e2) {
          log('All notification initialization attempts failed: $e2');
        }
      }
    });
  }
}

class FlutterBloomMainApp extends StatefulWidget {
  final GoRouter? routerConfig;

  final ThemeData? lightTheme;
  final ThemeData? darkTheme;
  final List<ThemeExtension<dynamic>>? lightThemeExtensions;
  final List<ThemeExtension<dynamic>>? darkThemeExtensions;

  const FlutterBloomMainApp({
    super.key,
    this.routerConfig,
    this.lightTheme,
    this.darkTheme,
    this.lightThemeExtensions,
    this.darkThemeExtensions,
  });

  @override
  State<FlutterBloomMainApp> createState() => _FlutterBloomMainAppState();
}

class _FlutterBloomMainAppState extends State<FlutterBloomMainApp> {
  final FlutterLocalization _localization = FlutterLocalization.instance;

  @override
  void initState() {
    super.initState();
    _localization.init(
      mapLocales: MapLocales.getMapLocales(),
      initLanguageCode: MapLocales.getDefaultLocale(),
    );
    _localization.onTranslatedLanguage = _onTranslatedLanguage;
  }

  void _onTranslatedLanguage(Locale? locale) {
    // Update AppLocale cache when language changes
    if (locale != null) {
      AppLocale.updateCurrentLanguage(locale.languageCode);
    }
    // Notify global language change notifier
    LanguageChangeNotifier().forceNotify();
    // Rebuild MaterialApp to update locale
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final settingsController = context.watch<SettingsController>();
    final screenSizeProvider = context.watch<ScreenSizeProvider>();
    // Listen to language changes to rebuild MaterialApp when locale changes
    // This ensures MaterialApp rebuilds when LanguageChangeNotifier notifies
    context.watch<LanguageChangeNotifier>();
    final appName = "app_name".tr(context);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      screenSizeProvider.updateScreenSize(context);
    });

    final ThemeData resolvedLightTheme = _mergeThemeExtensions(
      widget.lightTheme ?? getAppLightTheme(),
      widget.lightThemeExtensions ??
          const <ThemeExtension<dynamic>>[GradientLight()],
    );

    final ThemeData resolvedDarkTheme = _mergeThemeExtensions(
      widget.darkTheme ?? getAppDarkTheme(),
      widget.darkThemeExtensions ??
          const <ThemeExtension<dynamic>>[GradientDark()],
    );

    // Use languageNotifier to ensure MaterialApp rebuilds when language changes
    // The locale parameter will trigger Localizations widget to update,
    // which will cause all widgets using .tr(context) to rebuild
    // Using languageNotifier in the build method ensures MaterialApp rebuilds
    // when language changes, and Localizations.of(context) in .tr() ensures
    // all widgets using translations rebuild automatically
    return MaterialApp.router(
      title: appName,
      debugShowCheckedModeBanner: false,
      theme: resolvedLightTheme,
      darkTheme: resolvedDarkTheme,
      themeMode: settingsController.themeMode,
      locale: _localization.currentLocale,
      supportedLocales: _localization.supportedLocales,
      localizationsDelegates: _localization.localizationsDelegates,
      routerConfig: widget.routerConfig,
    );
  }
}

ThemeData _mergeThemeExtensions(
  ThemeData baseTheme,
  List<ThemeExtension<dynamic>> extensions,
) {
  final mergedExtensions = [
    ...baseTheme.extensions.values.cast<ThemeExtension<dynamic>>(),
    ...extensions,
  ];
  return baseTheme.copyWith(extensions: mergedExtensions);
}

class FlutterBloomHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context)
      ..badCertificateCallback =
          (X509Certificate cert, String host, int port) => true;
  }
}

/// Notify app-specific SharedPreferences classes about the initialized instance
/// This ensures they can use the SharedPreferences instance initialized after Flutter binding
/// This function handles the communication between the common app system and app-specific SharedPreferences classes
///
/// DESIGN: This is a generic approach that works with any app-specific SharedPreferences class
/// It dynamically checks for setInstance methods and calls them appropriately
///
/// NOTE: This function is now simplified since appPrefs.setInstance() is called directly
/// in the main flow when appPrefs is provided
void _notifyAppSpecificPrefs(SharedPreferences prefs) {
  try {
    // Log the SharedPreferences initialization for debugging purposes
    debugPrint('SharedPreferences initialized successfully and ready for use');

    // Future: Add additional notification logic if needed for other systems
    // This function can be extended to notify other components that need SharedPreferences
  } catch (e) {
    // Ignore errors if notification fails
    debugPrint('Could not complete SharedPreferences notification: $e');
  }
}
