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
import 'package:qyflutter/apps/app_example/router_app_example/routes_provider_app_example.dart';

/// Router for Example App
/// Provides routing functionality for the Example app
class RouterAppExample {
  /// Get all routes for the Example app
  static List<RouteBase> getRoutes() {
    return ExampleAppRoutesProvider.getExampleAppRoutes();
  }
  
  /// Get default route for the Example app
  static String getDefaultRoute() {
    return ExampleAppRoutesProvider.getDefaultRoute();
  }
  
  /// Get home route for the Example app
  static String getHomeRoute() {
    return ExampleAppRoutesProvider.getHomeRoute();
  }
  
  /// Check if a route belongs to the Example app
  static bool isExampleRoute(String path) {
    return ExampleAppRoutesProvider.isExampleRoute(path);
  }
  
  /// Get route information for debugging
  static Map<String, dynamic> getRouteInfo() {
    return ExampleAppRoutesProvider.getRouteInfo();
  }
}
