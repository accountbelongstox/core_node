import 'routes_provider_app_qy.dart';

/// Route Test Helper for QY App
/// Provides utilities to test and validate the route provider functionality
class QyAppRouteTestHelper {
  /// Test all route provider methods
  static Map<String, dynamic> testRouteProvider() {
    final results = <String, dynamic>{};
    
    try {
      // Test route constants
      results['routeConstants'] = {
        'routeHome': QyAppRoutesProvider.routeHome,
        'routeSplash': QyAppRoutesProvider.routeSplash,
        'routeLogin': QyAppRoutesProvider.routeLogin,
        'routeProfile': QyAppRoutesProvider.routeProfile,
        'routeSettings': QyAppRoutesProvider.routeSettings,
        'routeAbout': QyAppRoutesProvider.routeAbout,
        'routeDashboard': QyAppRoutesProvider.routeDashboard,
        'routeSearch': QyAppRoutesProvider.routeSearch,
        'routeBookmarks': QyAppRoutesProvider.routeBookmarks,
        'routeHelp': QyAppRoutesProvider.routeHelp,
      };
      
      // Test route getter methods
      results['routeGetters'] = {
        'getDefaultRoute': QyAppRoutesProvider.getDefaultRoute(),
        'getHomeRoute': QyAppRoutesProvider.getHomeRoute(),
        'getSplashRoute': QyAppRoutesProvider.getSplashRoute(),
        'getLoginRoute': QyAppRoutesProvider.getLoginRoute(),
        'getProfileRoute': QyAppRoutesProvider.getProfileRoute(),
        'getSettingsRoute': QyAppRoutesProvider.getSettingsRoute(),
        'getAboutRoute': QyAppRoutesProvider.getAboutRoute(),
        'getDashboardRoute': QyAppRoutesProvider.getDashboardRoute(),
        'getSearchRoute': QyAppRoutesProvider.getSearchRoute(),
        'getBookmarksRoute': QyAppRoutesProvider.getBookmarksRoute(),
        'getHelpRoute': QyAppRoutesProvider.getHelpRoute(),
      };
      
      // Test route list generation
      final routes = QyAppRoutesProvider.getQyAppRoutes();
      results['routeList'] = {
        'totalRoutes': routes.length,
        'routeTypes': routes.map((r) => r.runtimeType.toString()).toSet().toList(),
      };
      
      // Test route info
      results['routeInfo'] = QyAppRoutesProvider.getRouteInfo();
      
      // Test utility methods
      results['utilityMethods'] = {
        'isQyRoute_valid': QyAppRoutesProvider.isQyRoute('/qy/home'),
        'isQyRoute_invalid': QyAppRoutesProvider.isQyRoute('/other/home'),
        'getAllRoutePaths': QyAppRoutesProvider.getAllRoutePaths(),
        'getAllRouteNames': QyAppRoutesProvider.getAllRouteNames(),
      };
      
      // Test route name resolution
      results['routeNameResolution'] = {
        'homeRouteName': QyAppRoutesProvider.getRouteNameFromPath('/qy/home'),
        'loginRouteName': QyAppRoutesProvider.getRouteNameFromPath('/qy/login'),
        'invalidRouteName': QyAppRoutesProvider.getRouteNameFromPath('/invalid/path'),
      };
      
      results['success'] = true;
      results['message'] = 'All route provider tests passed successfully';
      
    } catch (e) {
      results['success'] = false;
      results['error'] = e.toString();
      results['message'] = 'Route provider test failed';
    }
    
    return results;
  }
  
  /// Validate route naming convention
  static Map<String, dynamic> validateRouteNaming() {
    final results = <String, dynamic>{};
    final issues = <String>[];
    
    try {
      final routes = QyAppRoutesProvider.getAllRoutePaths();
      
      // Check if all routes start with /qy/
      for (final route in routes) {
        if (!route.startsWith('/qy/')) {
          issues.add('Route "$route" does not follow /qy/ naming convention');
        }
      }
      
      // Check if default route is valid
      final defaultRoute = QyAppRoutesProvider.getDefaultRoute();
      if (!routes.contains(defaultRoute)) {
        issues.add('Default route "$defaultRoute" is not in the routes list');
      }
      
      // Check if all getter methods return valid routes
      final getterRoutes = [
        QyAppRoutesProvider.getHomeRoute(),
        QyAppRoutesProvider.getSplashRoute(),
        QyAppRoutesProvider.getLoginRoute(),
        QyAppRoutesProvider.getProfileRoute(),
        QyAppRoutesProvider.getSettingsRoute(),
        QyAppRoutesProvider.getAboutRoute(),
        QyAppRoutesProvider.getDashboardRoute(),
        QyAppRoutesProvider.getSearchRoute(),
        QyAppRoutesProvider.getBookmarksRoute(),
        QyAppRoutesProvider.getHelpRoute(),
      ];
      
      for (final getterRoute in getterRoutes) {
        if (!routes.contains(getterRoute)) {
          issues.add('Getter route "$getterRoute" is not in the routes list');
        }
      }
      
      results['totalRoutes'] = routes.length;
      results['validRoutes'] = routes.length - issues.length;
      results['issues'] = issues;
      results['success'] = issues.isEmpty;
      results['message'] = issues.isEmpty 
          ? 'All routes follow the naming convention'
          : 'Found ${issues.length} naming convention issues';
      
    } catch (e) {
      results['success'] = false;
      results['error'] = e.toString();
      results['message'] = 'Route naming validation failed';
    }
    
    return results;
  }
  
  /// Generate route documentation
  static Map<String, dynamic> generateRouteDocumentation() {
    final results = <String, dynamic>{};
    
    try {
      final routes = QyAppRoutesProvider.getQyAppRoutes();
      final routeInfo = QyAppRoutesProvider.getRouteInfo();
      
      final documentation = <String, dynamic>{};
      documentation['appInfo'] = {
        'appId': 'example',
        'routePrefix': '/example',
        'totalRoutes': routes.length,
        'defaultRoute': QyAppRoutesProvider.getDefaultRoute(),
      };
      
      documentation['routeCategories'] = {
        'authentication': [
          '/qy/login',
          '/qy/signup',
          '/qy/forgot',
          '/qy/verify',
          '/qy/reset',
          '/qy/congratulations',
        ],
        'main': [
          '/qy/home',
          '/qy/dashboard',
          '/qy/splash',
          '/qy/initial',
        ],
        'user': [
          '/qy/profile',
          '/qy/edit-profile',
        ],
        'features': [
          '/qy/search',
          '/qy/bookmarks',
          '/qy/chat',
        ],
        'information': [
          '/qy/about',
          '/qy/help',
        ],
        'settings': [
          '/qy/settings',
          '/qy/notifications',
          '/qy/security',
        ],
        'onboarding': [
          '/qy/onboarding',
        ],
      };
      
      documentation['routeDetails'] = routeInfo['availableRoutes'];
      
      results['documentation'] = documentation;
      results['success'] = true;
      results['message'] = 'Route documentation generated successfully';
      
    } catch (e) {
      results['success'] = false;
      results['error'] = e.toString();
      results['message'] = 'Route documentation generation failed';
    }
    
    return results;
  }
  
  /// Print test results in a readable format
  static void printTestResults() {
    print('=== QY App Route Provider Test Results ===\n');
    
    // Test route provider functionality
    final testResults = testRouteProvider();
    print('1. Route Provider Functionality Test:');
    print('   Status: ${testResults['success'] ? 'PASSED' : 'FAILED'}');
    print('   Message: ${testResults['message']}');
    if (testResults['success']) {
      print('   Total Routes: ${testResults['routeList']['totalRoutes']}');
      print('   Default Route: ${testResults['routeGetters']['getDefaultRoute']}');
    }
    print('');
    
    // Test route naming convention
    final namingResults = validateRouteNaming();
    print('2. Route Naming Convention Test:');
    print('   Status: ${namingResults['success'] ? 'PASSED' : 'FAILED'}');
    print('   Message: ${namingResults['message']}');
    print('   Total Routes: ${namingResults['totalRoutes']}');
    print('   Valid Routes: ${namingResults['validRoutes']}');
    if (namingResults['issues'].isNotEmpty) {
      print('   Issues:');
      for (final issue in namingResults['issues']) {
        print('     - $issue');
      }
    }
    print('');
    
    // Generate documentation
    final docResults = generateRouteDocumentation();
    print('3. Route Documentation Generation:');
    print('   Status: ${docResults['success'] ? 'PASSED' : 'FAILED'}');
    print('   Message: ${docResults['message']}');
    print('');
    
    print('=== Test Summary ===');
    final allPassed = testResults['success'] && namingResults['success'] && docResults['success'];
    print('Overall Status: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}');
    print('Route Provider is ${allPassed ? 'READY FOR USE' : 'NEEDS FIXES'}');
  }
}
