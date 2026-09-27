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
