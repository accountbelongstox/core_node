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
