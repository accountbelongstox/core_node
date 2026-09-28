import 'package:go_router/go_router.dart';
import 'routes_provider_app_travel.dart';

class RouterAppTravel {
  static List<RouteBase> getRoutes() {
    return TravelAppRoutesProvider.getTravelAppRoutes();
  }

  static String getDefaultRoute() {
    return TravelAppRoutesProvider.getDefaultRoute();
  }

  static String getHomeRoute() {
    return TravelAppRoutesProvider.getHomeRoute();
  }

  static bool isTravelRoute(String path) {
    return TravelAppRoutesProvider.isTravelRoute(path);
  }

  static Map<String, dynamic> getRouteInfo() {
    return TravelAppRoutesProvider.getRouteInfo();
  }

  static GoRouter createRouter() {
    return GoRouter(
      initialLocation: getDefaultRoute(),
      routes: getRoutes(),
    );
  }
}
