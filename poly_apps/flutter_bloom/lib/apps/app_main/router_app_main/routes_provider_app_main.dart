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

import 'package:go_router/go_router.dart';
import '../features_app_main/all_apps_showcase/views/all_apps_showcase_screen.dart';
import '../features_app_main/main_home/views/main_home_screen.dart';
import '../features_app_main/main_settings/views/main_settings_screen.dart';
import '../features_app_main/main_about/views/main_about_screen.dart';

// Import all other app routes for aggregation
import '../../app_example/router_app_example/routes_provider_app_example.dart';
import '../../app_achat/router_app_achat/router_app_achat.dart';
// TODO: Re-enable when other apps are fixed
// import '../../app_qy/router_app_qy/routes_provider_app_qy.dart';

/// Main Routes Provider
/// Provides routes for the main app with namespace 'main'
/// Also aggregates routes from all other apps for total debugging
class MainRoutesProvider {
  static const String appNamespace = 'main';
  
  // Main app specific routes
  static const String routeHome = '/main/home';
  static const String routeAllAppsShowcase = '/main/all_apps_showcase';
  static const String routeSettings = '/main/settings';
  static const String routeAbout = '/main/about';

  /// Get main app specific routes
  static List<GoRoute> getMainRoutes() {
    return [
      // Main Home
      GoRoute(
        path: routeHome,
        name: 'main_home',
        builder: (context, state) => const MainHomeScreen(),
      ),
      
      // All Apps Showcase - the special page for debugging all apps
      GoRoute(
        path: routeAllAppsShowcase,
        name: 'main_all_apps_showcase',
        builder: (context, state) => const AllAppsShowcaseScreen(),
      ),
      
      // Main Settings
      GoRoute(
        path: routeSettings,
        name: 'main_settings',
        builder: (context, state) => const MainSettingsScreen(),
      ),
      
      // Main About
      GoRoute(
        path: routeAbout,
        name: 'main_about',
        builder: (context, state) => const MainAboutScreen(),
      ),
    ];
  }

  /// Get all routes (main + all other apps)
  /// This is used by main.dart to get the complete route collection
  static List<GoRoute> getAllRoutes() {
    final allRoutes = <GoRoute>[];

    // Add main routes
    allRoutes.addAll(getMainRoutes());

    // Add other app routes
    try {
      allRoutes.addAll(ExampleAppRoutesProvider.getExampleAppRoutes().cast<GoRoute>());
    } catch (e) {
      // Continue if example app routes fail
    }
    
    try {
      allRoutes.addAll(RouterAppAChat.getRoutes().cast<GoRoute>());
    } catch (e) {
      // Continue if AChat app routes fail
    }

    // TODO: Re-enable when other apps are fixed
    // allRoutes.addAll(QyAppRoutesProvider.getQyAppRoutes());

    return allRoutes;
  }

  /// Get default route for main app
  static String getDefaultRoute() {
    return routeHome;
  }

  /// Get home route for main app
  static String getHomeRoute() {
    return routeHome;
  }

  /// Get route information for debugging
  static Map<String, dynamic> getRouteInfo() {
    final mainRoutes = getMainRoutes();
    final allRoutes = getAllRoutes();
    final otherAppRoutes = allRoutes.length - mainRoutes.length;
    
    return {
      'appNamespace': appNamespace,
      'mainRoutes': mainRoutes.length,
      'otherAppRoutes': otherAppRoutes,
      'totalRoutes': allRoutes.length,
      'routePaths': allRoutes.map((route) => route.path).toList(),
      'routeNames': allRoutes.map((route) => route.name).toList(),
    };
  }

  /// Get registered app information for showcase
  static List<Map<String, dynamic>> getRegisteredAppsInfo() {
    return [
      // TEMPORARILY DISABLED: Other app registrations
      // These will be enabled once other apps are fixed and follow the new structure

      // TODO: Re-enable when app_example is fixed
      // {
      //   'appId': 'example',
      //   'displayName': 'Example App',
      //   'description': 'Example application for demonstration',
      //   'routePrefix': '/example',
      //   'routes': ExampleAppRoutesProvider.getExampleAppRoutes()
      //       .map((route) => {
      //         'path': route.path,
      //         'name': route.name,
      //       }).toList(),
      // },

      // TODO: Add other apps when available
      // {
      //   'appId': 'qy',
      //   'displayName': 'QY App',
      //   'description': 'QY business application',
      //   'routePrefix': '/qy',
      //   'routes': QyAppRoutesProvider.getQyAppRoutes()...
      // },
    ];
  }

  /// Validate all routes
  static Map<String, dynamic> validateRoutes() {
    final allRoutes = getAllRoutes();
    final issues = <String>[];
    final warnings = <String>[];
    
    // Check for duplicate paths
    final paths = <String>{};
    for (final route in allRoutes) {
      if (paths.contains(route.path)) {
        issues.add('Duplicate route path: ${route.path}');
      } else {
        paths.add(route.path);
      }
    }
    
    // Check for duplicate names
    final names = <String>{};
    for (final route in allRoutes) {
      if (route.name != null) {
        if (names.contains(route.name)) {
          issues.add('Duplicate route name: ${route.name}');
        } else {
          names.add(route.name!);
        }
      } else {
        warnings.add('Route ${route.path} has no name');
      }
    }
    
    // Check namespace consistency for main routes
    final mainRoutes = getMainRoutes();
    for (final route in mainRoutes) {
      if (!route.path.startsWith('/$appNamespace/')) {
        issues.add('Main route ${route.path} does not follow namespace convention');
      }
    }
    
    return {
      'success': issues.isEmpty,
      'totalRoutes': allRoutes.length,
      'issues': issues,
      'warnings': warnings,
      'summary': issues.isEmpty 
          ? 'All routes are valid'
          : 'Found ${issues.length} issues and ${warnings.length} warnings',
    };
  }
}
