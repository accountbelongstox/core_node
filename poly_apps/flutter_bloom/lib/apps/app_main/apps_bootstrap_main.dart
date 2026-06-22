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
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/settings/models/setting_item.dart';

// Import AChat app components
import '../app_achat/localization_app_achat/en_app_achat.dart';
import '../app_achat/localization_app_achat/zh_app_achat.dart';
import '../app_achat/settings_app_achat/settings_app_achat.dart';
import '../app_achat/router_app_achat/router_app_achat.dart';

// Import Example app components
import '../app_example/localization_app_example/en_app_example.dart';
import '../app_example/localization_app_example/zh_app_example.dart';
import '../app_example/settings_app_example/settings_app_example.dart';
import '../app_example/router_app_example/router_app_example.dart';

// TEMPORARILY DISABLED: Other apps
// import 'package:qyflutter/apps/app_qy/partition_locals_app_qy/en_app_qy.dart';
// import 'package:qyflutter/apps/app_qy/partition_locals_app_qy/zh_app_qy.dart';
// import 'package:qyflutter/apps/app_qy/settings/qy_app_settings.dart';
// Common assets
import 'package:qyflutter/common/assets/common_assets_icons.dart';
import 'package:qyflutter/common/assets/common_assets_images.dart';
// import 'package:qyflutter/common/assets/common_assets_launch.dart';
// App-specific assets
// import 'package:qyflutter/apps/app_example/resources_app_example/assets_manager_app_example.dart';

/// App assets provider interface
abstract class AppAssetsProvider {
  Map<String, String> getIcons();
  Map<String, String> getImages();
  Map<String, String> getLaunchAssets();
}

class AppMeta {
  final String appId;
  final String displayName;
  final String description;
  final String routePrefix;
  final List<Map<String, dynamic>> enLocales;
  final List<Map<String, dynamic>> zhLocales;
  final List<SettingItem> Function() settingsProvider;
  final List<RouteBase> Function() routesProvider;
  final AppAssetsProvider? assetsProvider;

  const AppMeta({
    required this.appId,
    required this.displayName,
    required this.description,
    required this.routePrefix,
    required this.enLocales,
    required this.zhLocales,
    required this.settingsProvider,
    required this.routesProvider,
    this.assetsProvider,
  });
}

/// Single-source-of-truth registry for all apps' settings and locales.
class AppRegistry {
  static final Map<String, AppMeta> _apps = <String, AppMeta>{
    'achat': AppMeta(
      appId: 'achat',
      displayName: 'AChat',
      description: 'AI Chat messaging application',
      routePrefix: '/achat',
      enLocales: [AChatLocalizationEN.values],
      zhLocales: [AChatLocalizationZH.values],
      settingsProvider: AChatAppSettings.getAChatSettings,
      routesProvider: () => RouterAppAChat.getRoutes().cast<RouteBase>(),
    ),

    'example': AppMeta(
      appId: 'example',
      displayName: 'Example App',
      description: 'Example application for demonstration',
      routePrefix: '/example',
      enLocales: [EnAppExample.values],
      zhLocales: [ZhAppExample.values],
      settingsProvider: ExampleAppSettings.getExampleAppSettings,
      routesProvider: () => RouterAppExample.getRoutes().cast<RouteBase>(),
    ),

    // TEMPORARILY DISABLED: Other apps
    // 'qy': AppMeta(
    //   appId: 'qy',
    //   displayName: 'QY App',
    //   description: 'QY application',
    //   routePrefix: '/qy',
    //   enLocales: [QYAppLocalizationEN.values],
    //   zhLocales: [QYAppLocalizationZH.values],
    //   settingsProvider: QYAppSettings.getQYAppSettings,
    //   routesProvider: QYAppRoutesProvider.getQYAppRoutes,
    // ),
  };



  // Aggregated (main entry)
  static List<SettingItem> aggregatedSettings() => _apps.values
      .expand((meta) => meta.settingsProvider())
      .toList(growable: false);

  static List<Map<String, dynamic>> aggregatedEnLocales() => _apps.values
      .expand((meta) => meta.enLocales)
      .toList(growable: false);

  static List<Map<String, dynamic>> aggregatedZhLocales() => _apps.values
      .expand((meta) => meta.zhLocales)
      .toList(growable: false);

  // Per-app (independent entry)
  static List<SettingItem> settingsFor(String appId) =>
      _apps[appId]?.settingsProvider() ?? const <SettingItem>[];

  static List<Map<String, dynamic>> enLocalesFor(String appId) =>
      _apps[appId]?.enLocales ?? const <Map<String, dynamic>>[];

  static List<Map<String, dynamic>> zhLocalesFor(String appId) =>
      _apps[appId]?.zhLocales ?? const <Map<String, dynamic>>[];

  // Route management
  static List<RouteBase> aggregatedRoutes() => _apps.values
      .expand((meta) => meta.routesProvider())
      .toList(growable: false);

  static List<RouteBase> routesFor(String appId) =>
      _apps[appId]?.routesProvider() ?? const <RouteBase>[];

  // App metadata
  static String displayNameFor(String appId) =>
      _apps[appId]?.displayName ?? 'Unknown App';

  static String descriptionFor(String appId) =>
      _apps[appId]?.description ?? 'No description available';

  static String routePrefixFor(String appId) =>
      _apps[appId]?.routePrefix ?? '/$appId';

  static List<String> getAllAppIds() => _apps.keys.toList();

  static bool isValidAppId(String appId) => _apps.containsKey(appId);

  static Map<String, dynamic> getAppInfo(String appId) {
    final meta = _apps[appId];
    if (meta == null) {
      return {
        'id': appId,
        'displayName': 'Unknown App',
        'description': 'No description available',
        'routePrefix': '/$appId',
        'isValid': false,
      };
    }

    return {
      'id': meta.appId,
      'displayName': meta.displayName,
      'description': meta.description,
      'routePrefix': meta.routePrefix,
      'isValid': true,
    };
  }

  static List<Map<String, dynamic>> getAllAppsInfo() =>
      getAllAppIds().map((appId) => getAppInfo(appId)).toList();
}

/// Backwards-compatible facade used by existing code
class AppSettingsAggregate {
  static List<SettingItem> all() => AppRegistry.aggregatedSettings();
  static List<SettingItem> forApp(String appId) => AppRegistry.settingsFor(appId);
}

class AppLocales {
  static List<Map<String, dynamic>> mainEn() => AppRegistry.aggregatedEnLocales();
  static List<Map<String, dynamic>> mainZh() => AppRegistry.aggregatedZhLocales();
  static List<Map<String, dynamic>> forAppEn(String appId) => AppRegistry.enLocalesFor(appId);
  static List<Map<String, dynamic>> forAppZh(String appId) => AppRegistry.zhLocalesFor(appId);
}

/// Routes management facade
class AppRoutes {
  /// Get all routes for main entry (aggregated from all apps)
  static List<RouteBase> allRoutes() => AppRegistry.aggregatedRoutes();

  /// Get routes for a specific app
  static List<RouteBase> forApp(String appId) => AppRegistry.routesFor(appId);

  /// Get app route prefix
  static String routePrefixFor(String appId) => AppRegistry.routePrefixFor(appId);

  /// Check if a route path belongs to a specific app
  static bool isAppRoute(String path, String appId) {
    final prefix = routePrefixFor(appId);
    return path.startsWith(prefix);
  }

  /// Get app ID from route path
  static String? getAppIdFromPath(String path) {
    for (final appId in AppRegistry.getAllAppIds()) {
      if (isAppRoute(path, appId)) {
        return appId;
      }
    }
    return null;
  }
}

/// Apps information facade
class AppsInfo {
  /// Get all available app IDs
  static List<String> getAllAppIds() => AppRegistry.getAllAppIds();

  /// Check if an app ID is valid
  static bool isValidAppId(String appId) => AppRegistry.isValidAppId(appId);

  /// Get app display name
  static String getDisplayName(String appId) => AppRegistry.displayNameFor(appId);

  /// Get app description
  static String getDescription(String appId) => AppRegistry.descriptionFor(appId);

  /// Get app info
  static Map<String, dynamic> getAppInfo(String appId) => AppRegistry.getAppInfo(appId);

  /// Get all apps info
  static List<Map<String, dynamic>> getAllAppsInfo() => AppRegistry.getAllAppsInfo();
}

/// Common assets provider for shared resources
class CommonAssetsProvider implements AppAssetsProvider {
  @override
  Map<String, String> getIcons() {
    return {
      'logo': CommonAssetsIcons.logo,
      'logoWhite': CommonAssetsIcons.logoWhite,
      'logoDark': CommonAssetsIcons.logo,
      'placeholder': CommonAssetsIcons.placeholder,
      'empty': CommonAssetsIcons.emptyBox,
      'error': CommonAssetsIcons.placeholder,
      'noInternet': CommonAssetsIcons.placeholder,
      'loading': CommonAssetsIcons.placeholder,
      'search': CommonAssetsIcons.placeholder,
      'settings': CommonAssetsIcons.setting,
      'help': CommonAssetsIcons.placeholder,
      'info': CommonAssetsIcons.info,
      'back': CommonAssetsIcons.back,
      'next': CommonAssetsIcons.placeholder,
      'close': CommonAssetsIcons.placeholder,
      'check': CommonAssetsIcons.placeholder,
      'warning': CommonAssetsIcons.placeholder,
      'facebook': CommonAssetsIcons.facebook,
      'google': CommonAssetsIcons.google,
      'twitter': CommonAssetsIcons.twitter,
      'github': CommonAssetsIcons.github,
    };
  }

  @override
  Map<String, String> getImages() {
    return {
      'backgroundLight': CommonAssetsImages.backgroundLight,
      'backgroundDark': CommonAssetsImages.backgroundDark,
      'avatarPlaceholder': CommonAssetsImages.avatarPlaceholder,
      'coverPlaceholder': CommonAssetsImages.coverPlaceholder,
      'splash': CommonAssetsImages.splash,
    };
  }



  @override
  Map<String, String> getLaunchAssets() {
    return {
      'darkLaunch': 'assets/common_launch/dark_launch.jpg',
      'lightLaunch': 'assets/common_launch/light_launch.jpg',
    };
  }
}

/// Assets aggregation system for dual entry mode
class AppAssetsAggregate {
  static final CommonAssetsProvider _commonAssets = CommonAssetsProvider();

  /// Get all assets for main entry (common + all apps)
  static Map<String, dynamic> all() {
    final Map<String, dynamic> allAssets = {
      'common': {
        'icons': _commonAssets.getIcons(),
        'images': _commonAssets.getImages(),
        'launch': _commonAssets.getLaunchAssets(),
      },
    };

    // Add all app-specific assets
    for (final appId in AppRegistry.getAllAppIds()) {
      final appMeta = AppRegistry._apps[appId];
      if (appMeta?.assetsProvider != null) {
        allAssets[appId] = {
          'icons': appMeta!.assetsProvider!.getIcons(),
          'images': appMeta.assetsProvider!.getImages(),
          'launch': appMeta.assetsProvider!.getLaunchAssets(),
        };
      }
    }

    return allAssets;
  }

  /// Get assets for specific app (common + single app)
  static Map<String, dynamic> forApp(String appId) {
    final Map<String, dynamic> appAssets = {
      'common': {
        'icons': _commonAssets.getIcons(),
        'images': _commonAssets.getImages(),
        'launch': _commonAssets.getLaunchAssets(),
      },
    };

    // Add specific app assets
    final appMeta = AppRegistry._apps[appId];
    if (appMeta?.assetsProvider != null) {
      appAssets[appId] = {
        'icons': appMeta!.assetsProvider!.getIcons(),
        'images': appMeta.assetsProvider!.getImages(),
        'launch': appMeta.assetsProvider!.getLaunchAssets(),
      };
    }

    return appAssets;
  }

  /// Get flattened assets map for easy access
  static Map<String, String> getFlattenedAssets(Map<String, dynamic> assets) {
    final Map<String, String> flattened = {};

    assets.forEach((appId, appAssets) {
      if (appAssets is Map<String, dynamic>) {
        appAssets.forEach((assetType, assetMap) {
          if (assetMap is Map<String, String>) {
            assetMap.forEach((key, path) {
              // Create namespaced keys: common_logo, example_homeIcon, etc.
              final namespacedKey = '${appId}_$key';
              flattened[namespacedKey] = path;
            });
          }
        });
      }
    });

    return flattened;
  }
}

/// Widget to display available apps in the main app
class AppsBootstrapMain extends StatelessWidget {
  const AppsBootstrapMain({super.key});

  @override
  Widget build(BuildContext context) {
    final allApps = AppsInfo.getAllAppsInfo();

    return Column(
      children: [
        const Text(
          'Available Apps:',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        for (final appInfo in allApps) Card(
          margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 16),
          child: ListTile(
            title: Text(appInfo['displayName'] ?? 'Unknown'),
            subtitle: Text(appInfo['description'] ?? 'No description'),
            trailing: ElevatedButton(
              onPressed: () {
                // TODO: Navigate to the app
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Opening ${appInfo['displayName']}...'),
                  ),
                );
              },
              child: const Text('Open'),
            ),
          ),
        ),
      ],
    );
  }
}