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

// Import Wuy App feature screens
import '../features_app_wuy/home/views/home_screen.dart';
import '../features_app_wuy/profile/views/profile_screen.dart';
import '../features_app_wuy/settings/views/settings_screen.dart';
import '../features_app_wuy/authentication/views/login_screen.dart';
import '../features_app_wuy/splash/views/splash_screen.dart';
import '../features_app_wuy/dashboard/views/dashboard_screen.dart';

/// Wuy App Routes Provider
/// Provides routes for the Wuy app following the dual-entry architecture
/// Route keys are defined directly in this file to avoid separate constant files
class WuyAppRoutesProvider {
  // Route constants with /wuy namespace
  static const String routeHome = '/wuy/home';
  static const String routeSplash = '/wuy/splash';
  static const String routeInitial = '/wuy/initial';
  static const String routeLogin = '/wuy/login';
  static const String routeProfile = '/wuy/profile';
  static const String routeSettings = '/wuy/settings';
  static const String routeDashboard = '/wuy/dashboard';
  
  // Route getter methods for external access
  static String getInitialRoute() => routeInitial;
  static String getSplashRoute() => routeSplash;
  static String getHomeRoute() => routeHome;
  static String getLoginRoute() => routeLogin;
  static String getProfileRoute() => routeProfile;
  static String getSettingsRoute() => routeSettings;
  static String getDashboardRoute() => routeDashboard;

  /// Get default route for the Wuy app
  static String getDefaultRoute() => routeHome;

  /// Get all Wuy app routes
  static List<RouteBase> getWuyAppRoutes() {
    return [
      // Main routes
      GoRoute(
        path: routeHome,
        name: 'wuy_home',
        builder: (context, state) => const WuyHomeScreen(),
      ),

      GoRoute(
        path: routeSplash,
        name: 'wuy_splash',
        builder: (context, state) => const WuySplashScreen(),
      ),

      GoRoute(
        path: routeInitial,
        name: 'wuy_initial',
        builder: (context, state) => const WuySplashScreen(),
      ),

      GoRoute(
        path: routeDashboard,
        name: 'wuy_dashboard',
        builder: (context, state) => const WuyDashboardScreen(),
      ),

      // Authentication routes
      GoRoute(
        path: routeLogin,
        name: 'wuy_login',
        builder: (context, state) => const WuyLoginScreen(),
      ),

      // Profile and User routes
      GoRoute(
        path: routeProfile,
        name: 'wuy_profile',
        builder: (context, state) => const WuyProfileScreen(),
      ),

      // Settings routes
      GoRoute(
        path: routeSettings,
        name: 'wuy_settings',
        builder: (context, state) => const WuySettingsScreen(),
      ),
    ];
  }

  /// Get route information for debugging
  static Map<String, dynamic> getRouteInfo() {
    final routes = getWuyAppRoutes();
    return {
      'appId': 'wuy',
      'routePrefix': '/wuy',
      'totalRoutes': routes.length,
      'defaultRoute': getDefaultRoute(),
      'availableRoutes': routes.map((route) {
        if (route is GoRoute) {
          return {
            'path': route.path,
            'name': route.name,
          };
        }
        return {'type': route.runtimeType.toString()};
      }).toList(),
    };
  }

  /// Check if a route path belongs to Wuy app
  static bool isWuyRoute(String path) {
    return path.startsWith('/wuy/');
  }

  /// Get route name from path
  static String? getRouteNameFromPath(String path) {
    final routes = getWuyAppRoutes();
    for (final route in routes) {
      if (route is GoRoute && route.path == path) {
        return route.name;
      }
    }
    return null;
  }

  /// Get all route paths
  static List<String> getAllRoutePaths() {
    final routes = getWuyAppRoutes();
    return routes.whereType<GoRoute>().map((route) => route.path).toList();
  }

  /// Get all route names
  static List<String> getAllRouteNames() {
    final routes = getWuyAppRoutes();
    return routes.whereType<GoRoute>()
        .map((route) => route.name)
        .where((name) => name != null)
        .cast<String>()
        .toList();
  }
}