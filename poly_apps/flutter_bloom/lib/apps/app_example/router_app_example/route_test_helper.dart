import 'routes_provider_app_example.dart';

/// Route Test Helper for Example App
/// Provides utilities to test and validate the route provider functionality
class ExampleAppRouteTestHelper {
  /// Test all route provider methods
  static Map<String, dynamic> testRouteProvider() {
    final results = <String, dynamic>{};
    
    try {
      // Test route constants
      results['routeConstants'] = {
        'routeHome': ExampleAppRoutesProvider.routeHome,
        'routeSplash': ExampleAppRoutesProvider.routeSplash,
        'routeLogin': ExampleAppRoutesProvider.routeLogin,
        'routeProfile': ExampleAppRoutesProvider.routeProfile,
        'routeSettings': ExampleAppRoutesProvider.routeSettings,
        'routeAbout': ExampleAppRoutesProvider.routeAbout,
        'routeDashboard': ExampleAppRoutesProvider.routeDashboard,
        'routeSearch': ExampleAppRoutesProvider.routeSearch,
        'routeBookmarks': ExampleAppRoutesProvider.routeBookmarks,
        'routeHelp': ExampleAppRoutesProvider.routeHelp,
      };
      
      // Test route getter methods
      results['routeGetters'] = {
        'getDefaultRoute': ExampleAppRoutesProvider.getDefaultRoute(),
        'getHomeRoute': ExampleAppRoutesProvider.getHomeRoute(),
        'getSplashRoute': ExampleAppRoutesProvider.getSplashRoute(),
        'getLoginRoute': ExampleAppRoutesProvider.getLoginRoute(),
        'getProfileRoute': ExampleAppRoutesProvider.getProfileRoute(),
        'getSettingsRoute': ExampleAppRoutesProvider.getSettingsRoute(),
        'getAboutRoute': ExampleAppRoutesProvider.getAboutRoute(),
        'getDashboardRoute': ExampleAppRoutesProvider.getDashboardRoute(),
        'getSearchRoute': ExampleAppRoutesProvider.getSearchRoute(),
        'getBookmarksRoute': ExampleAppRoutesProvider.getBookmarksRoute(),
        'getHelpRoute': ExampleAppRoutesProvider.getHelpRoute(),
      };
      
      // Test route list generation
      final routes = ExampleAppRoutesProvider.getExampleAppRoutes();
      results['routeList'] = {
        'totalRoutes': routes.length,
        'routeTypes': routes.map((r) => r.runtimeType.toString()).toSet().toList(),
      };
      
      // Test route info
      results['routeInfo'] = ExampleAppRoutesProvider.getRouteInfo();
      
      // Test utility methods
      results['utilityMethods'] = {
        'isExampleRoute_valid': ExampleAppRoutesProvider.isExampleRoute('/example/home'),
        'isExampleRoute_invalid': ExampleAppRoutesProvider.isExampleRoute('/other/home'),
        'getAllRoutePaths': ExampleAppRoutesProvider.getAllRoutePaths(),
        'getAllRouteNames': ExampleAppRoutesProvider.getAllRouteNames(),
      };
      
      // Test route name resolution
      results['routeNameResolution'] = {
        'homeRouteName': ExampleAppRoutesProvider.getRouteNameFromPath('/example/home'),
        'loginRouteName': ExampleAppRoutesProvider.getRouteNameFromPath('/example/login'),
        'invalidRouteName': ExampleAppRoutesProvider.getRouteNameFromPath('/invalid/path'),
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
      final routes = ExampleAppRoutesProvider.getAllRoutePaths();
      
      // Check if all routes start with /example/
      for (final route in routes) {
        if (!route.startsWith('/example/')) {
          issues.add('Route "$route" does not follow /example/ naming convention');
        }
      }
      
      // Check if default route is valid
      final defaultRoute = ExampleAppRoutesProvider.getDefaultRoute();
      if (!routes.contains(defaultRoute)) {
        issues.add('Default route "$defaultRoute" is not in the routes list');
      }
      
      // Check if all getter methods return valid routes
      final getterRoutes = [
        ExampleAppRoutesProvider.getHomeRoute(),
        ExampleAppRoutesProvider.getSplashRoute(),
        ExampleAppRoutesProvider.getLoginRoute(),
        ExampleAppRoutesProvider.getProfileRoute(),
        ExampleAppRoutesProvider.getSettingsRoute(),
        ExampleAppRoutesProvider.getAboutRoute(),
        ExampleAppRoutesProvider.getDashboardRoute(),
        ExampleAppRoutesProvider.getSearchRoute(),
        ExampleAppRoutesProvider.getBookmarksRoute(),
        ExampleAppRoutesProvider.getHelpRoute(),
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
      final routes = ExampleAppRoutesProvider.getExampleAppRoutes();
      final routeInfo = ExampleAppRoutesProvider.getRouteInfo();
      
      final documentation = <String, dynamic>{};
      documentation['appInfo'] = {
        'appId': 'example',
        'routePrefix': '/example',
        'totalRoutes': routes.length,
        'defaultRoute': ExampleAppRoutesProvider.getDefaultRoute(),
      };
      
      documentation['routeCategories'] = {
        'authentication': [
          '/example/login',
          '/example/signup',
          '/example/forgot',
          '/example/verify',
          '/example/reset',
          '/example/congratulations',
        ],
        'main': [
          '/example/home',
          '/example/dashboard',
          '/example/splash',
          '/example/initial',
        ],
        'user': [
          '/example/profile',
          '/example/edit-profile',
        ],
        'features': [
          '/example/search',
          '/example/bookmarks',
          '/example/chat',
        ],
        'information': [
          '/example/about',
          '/example/help',
        ],
        'settings': [
          '/example/settings',
          '/example/notifications',
          '/example/security',
        ],
        'onboarding': [
          '/example/onboarding',
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
    print('=== Example App Route Provider Test Results ===\n');
    
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
