import 'package:go_router/go_router.dart';
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';

/// Router for QY App
/// Provides routing functionality for the QY app
class RouterAppQy {
  /// Get all routes for the QY app
  static List<RouteBase> getRoutes() {
    return QyAppRoutesProvider.getQyAppRoutes();
  }
  
  /// Get default route for the QY app
  static String getDefaultRoute() {
    return QyAppRoutesProvider.getDefaultRoute();
  }
  
  /// Get home route for the QY app
  static String getHomeRoute() {
    return QyAppRoutesProvider.getHomeRoute();
  }
  
  /// Check if a route belongs to the QY app
  static bool isQyRoute(String path) {
    return QyAppRoutesProvider.isQyRoute(path);
  }
  
  /// Get route information for debugging
  static Map<String, dynamic> getRouteInfo() {
    return QyAppRoutesProvider.getRouteInfo();
  }
}
