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
import 'package:flutter/material.dart';

// Import Wuy App feature screens
import '../features_app_wuy/home/views/home_screen.dart';
import '../features_app_wuy/profile/views/profile_screen.dart';
import '../features_app_wuy/settings/views/settings_screen.dart';
import '../features_app_wuy/authentication/views/login_screen.dart';
import '../features_app_wuy/splash/views/splash_screen.dart';
import '../features_app_wuy/dashboard/views/dashboard_screen.dart';

/// Wuy App Router Configuration
/// Route keys are defined directly in this file to avoid separate constant files
class WuyAppRouter {
  // Route constants with /wuy namespace
  static const String routeHome = '/wuy/home';
  static const String routeSplash = '/wuy/splash';
  static const String routeInitial = '/wuy/initial';
  static const String routeLogin = '/wuy/login';
  static const String routeProfile = '/wuy/profile';
  static const String routeSettings = '/wuy/settings';
  static const String routeDashboard = '/wuy/dashboard';
  
  /// Create router for Wuy app - required by development guidelines
  static GoRouter createRouter() {
    return GoRouter(
      initialLocation: routeHome,
      routes: [
        // Splash route
        GoRoute(
          path: routeSplash,
          name: 'wuy_splash',
          builder: (context, state) => const WuySplashScreen(),
        ),
        
        // Home route
        GoRoute(
          path: routeHome,
          name: 'wuy_home',
          builder: (context, state) => const WuyHomeScreen(),
        ),
        
        // Authentication route
        GoRoute(
          path: routeLogin,
          name: 'wuy_login',
          builder: (context, state) => const WuyLoginScreen(),
        ),
        
        // Dashboard route
        GoRoute(
          path: routeDashboard,
          name: 'wuy_dashboard',
          builder: (context, state) => const WuyDashboardScreen(),
        ),

        // Profile route
        GoRoute(
          path: routeProfile,
          name: 'wuy_profile',
          builder: (context, state) => const WuyProfileScreen(),
        ),

        // Settings route
        GoRoute(
          path: routeSettings,
          name: 'wuy_settings',
          builder: (context, state) => const WuySettingsScreen(),
        ),
        
        // Initial route (redirect to home)
        GoRoute(
          path: routeInitial,
          name: 'wuy_initial',
          redirect: (context, state) => routeHome,
        ),
      ],
      errorBuilder: (context, state) => Scaffold(
        appBar: AppBar(
          title: const Text('Page Not Found'),
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                size: 64,
                color: Colors.grey,
              ),
              const SizedBox(height: 16),
              Text(
                'Page not found: ${state.uri.toString()}',
                style: const TextStyle(fontSize: 18),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.go(routeHome),
                child: const Text('Go Home'),
              ),
            ],
          ),
        ),
      ),
    );
  }
  
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
  
  /// Get all route paths
  static List<String> getAllRoutes() {
    return [
      routeHome,
      routeSplash,
      routeInitial,
      routeLogin,
      routeProfile,
      routeSettings,
      routeDashboard,
    ];
  }
}
