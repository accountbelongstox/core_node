<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# Flutter Multi-App Routing Standards

## Overview

This document defines the routing standards for the Flutter multi-app aggregation project. All apps must follow these standards to ensure consistency, maintainability, and proper navigation between different application modules.

## Core Principles

### 1. App-Namespaced Routing
- Each app has its own route namespace: `/{app_id}/{feature}`
- No route conflicts between different apps
- Clear separation of concerns

### 2. Consistent Route Structure
```
/{app_id}/{feature}[/{sub_feature}][/{parameter}]
```

Examples:
- `/achat/home` - AChat app home page
- `/achat/chat_details/123` - Chat details with ID parameter
- `/example/profile/settings` - Example app profile settings

### 3. Mandatory Routes
Every app MUST implement these core routes:

#### Required Routes:
- **Home Route**: `/{app_id}/home` - Main entry point
- **Profile Route**: `/{app_id}/profile` - User profile/settings
- **Settings Route**: `/{app_id}/settings` - App-specific settings

#### Optional Common Routes:
- **Dashboard**: `/{app_id}/dashboard` - Main dashboard view
- **About**: `/{app_id}/about` - About page
- **Help**: `/{app_id}/help` - Help/support page

## App Implementation Standards

### 1. Router Class Structure

Each app must have a single router class following this template:

```dart
// File: lib/apps/app_{name}/router_app_{name}/router_app_{name}.dart

class RouterApp{Name} {
  // Route constants with app namespace
  static const String home = '/{app_id}/home';
  static const String profile = '/{app_id}/profile';
  static const String settings = '/{app_id}/settings';
  
  // Feature-specific routes
  static const String featureName = '/{app_id}/feature_name';
  
  /// Create router configuration - NO PROVIDER WRAPPER
  static List<RouteBase> getRoutes() {
    return [
      // Required: Home route (MANDATORY)
      GoRoute(
        path: home,
        name: '{app_id}_home',
        builder: (context, state) => const {Name}HomeScreen(),
      ),
      
      // Required: Profile route (MANDATORY) 
      GoRoute(
        path: profile,
        name: '{app_id}_profile',
        builder: (context, state) => const {Name}ProfileScreen(),
      ),
      
      // Feature routes...
    ];
  }
  
  // Navigation helper methods
  static void goToHome(BuildContext context) => context.go(home);
  static void goToProfile(BuildContext context) => context.go(profile);
  
  // Extended functionality for debugging and validation
  static List<String> getAllRoutePaths() => [home, profile, settings, /*...*/];
  static Map<String, String> getRouteDisplayNames() => {home: 'Home', /*...*/};
  static Map<String, dynamic> getRouterInfo() => {'appId': '{app_id}', /*...*/};
  static bool isValidRoute(String path) => getAllRoutePaths().contains(path);
  static String getDefaultRoute() => home;
  static String getHomeRoute() => home;
}
```

### 2. App Entry Point Integration

Each app's main file must reference the router directly:

```dart
// File: lib/apps/app_{name}/main_app_{name}.dart

import 'router_app_{name}/router_app_{name}.dart';

Future<void> main() async {
  await runCommonApp(
    appName: {Name}AppConfig.appName,
    appId: {Name}AppConfig.appId,
    initialRoute: RouterApp{Name}.home,
    homeRoute: RouterApp{Name}.home,
    // ... other config
  );
}
```

And the RouteManager provides fallback defaults:

```dart
// In route_manager.dart  
static String _getDefaultRouteForApp(String appId) {
  switch (appId) {
    case 'achat':
      return '/achat/home';
    case 'example': 
      return '/example/home';
    default:
      return '/${appId}/home';
  }
}
```

### 3. Home Screen Implementation

Every app must have a home screen that serves as the main entry point:

```dart
// File: lib/apps/app_{name}/features_app_{name}/home/view/home_screen.dart

class {Name}HomeScreen extends StatefulWidget {
  const {Name}HomeScreen({super.key});

  @override
  State<{Name}HomeScreen> createState() => _{Name}HomeScreenState();
}

class _{Name}HomeScreenState extends State<{Name}HomeScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('{app_id}_home_title'.tr(context)),
      ),
      body: // Your home content
    );
  }
}
```

## Navigation Standards

### 1. Navigation Methods

Use these standardized navigation methods:

#### Direct Navigation (Replace current route):
```dart
// Using route constants
RouterApp{Name}.goToHome(context);

// Using context.go()
context.go('/{app_id}/feature');

// Using named routes
context.goNamed('{app_id}_feature_name');
```

#### Stack Navigation (Push new route):
```dart
// Using helper methods
RouterApp{Name}.pushToFeature(context);

// Using context.push()
context.push('/{app_id}/feature');

// Using named routes
context.pushNamed('{app_id}_feature_name');
```

### 2. Cross-App Navigation

When navigating between different apps:

```dart
// Navigate to different app's home
context.go('/other_app/home');

// Navigate to specific feature in different app
context.go('/other_app/specific_feature');
```

### 3. Parameter Passing

#### Path Parameters:
```dart
// Route definition
GoRoute(
  path: '/achat/chat_details/:chatId',
  builder: (context, state) {
    final chatId = state.pathParameters['chatId'] ?? '';
    return ChatDetailsScreen(chatId: chatId);
  },
),

// Navigation
context.go('/achat/chat_details/123');
```

#### Query Parameters:
```dart
// Navigation with query parameters
context.go('/achat/search?query=hello&filter=recent');

// Reading query parameters
final query = state.uri.queryParameters['query'] ?? '';
```

#### Extra Data:
```dart
// Pass complex objects
context.pushNamed(
  'achat_chat_details',
  pathParameters: {'chatId': '123'},
  extra: chatObject,
);
```

## Error Handling

### 1. Route Not Found
Apps should handle missing routes gracefully:

```dart
// In router configuration
static List<RouteBase> getRoutes() {
  return [
    // ... your routes
    
    // Catch-all route for app namespace
    GoRoute(
      path: '/{app_id}/:path(.*)',
      builder: (context, state) => {Name}NotFoundScreen(
        requestedPath: state.fullPath,
      ),
    ),
  ];
}
```

### 2. Error Page Implementation
```dart
class {Name}NotFoundScreen extends StatelessWidget {
  final String? requestedPath;
  
  const {Name}NotFoundScreen({
    super.key,
    this.requestedPath,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Page Not Found')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64),
            SizedBox(height: 16),
            Text('Route Not Found'),
            if (requestedPath != null) Text('Path: $requestedPath'),
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => RouterApp{Name}.goToHome(context),
              child: Text('Go Home'),
            ),
          ],
        ),
      ),
    );
  }
}
```

## Deep Linking Support

### 1. URL Structure for Web
```
https://your-domain.com/{app_id}/{feature}[/{params}]
```

Examples:
- `https://your-domain.com/achat/home`
- `https://your-domain.com/achat/chat_details/123`
- `https://your-domain.com/example/profile/settings`

### 2. Mobile Deep Links
```
scheme://{app_id}/{feature}[/{params}]
```

Examples:
- `myapp://achat/home`
- `myapp://achat/chat_details/123`

## Route Security & Authentication

### 1. Protected Routes
```dart
GoRoute(
  path: '/achat/private_feature',
  builder: (context, state) => const PrivateFeatureScreen(),
  redirect: (context, state) {
    // Check authentication
    if (!AuthService.isAuthenticated()) {
      return '/achat/login';
    }
    return null;
  },
),
```

### 2. Role-Based Access
```dart
redirect: (context, state) {
  if (!AuthService.hasPermission('admin')) {
    return '/achat/unauthorized';
  }
  return null;
},
```

## Testing Routes

### 1. Route Testing Template
```dart
testWidgets('should navigate to home screen', (tester) async {
  final router = GoRouter(
    routes: RouterApp{Name}.getRoutes(),
    initialLocation: '/{app_id}/home',
  );
  
  await tester.pumpWidget(
    MaterialApp.router(
      routerConfig: router,
    ),
  );
  
  expect(find.byType({Name}HomeScreen), findsOneWidget);
});
```

## Best Practices

### 1. Route Organization
- Keep route constants organized by feature
- Use descriptive route names  
- Group related routes together
- **NO PROVIDER WRAPPERS** - Direct router class only

### 2. Performance
- Lazy load route screens when possible
- Use const constructors for stateless screens
- Avoid heavy computations in route builders

### 3. Maintenance
- Document route purposes and parameters
- Use typed route parameters where possible
- Keep route helper methods updated
- Single router file per app - no provider abstractions

### 4. Localization
- Use localization keys for route titles
- Support multiple languages in error messages
- Consider RTL layout for route-based UI

## Migration Guidelines

When updating routing:

1. **Backward Compatibility**: Maintain old routes during transition
2. **Redirect Rules**: Set up redirects from old to new routes
3. **Documentation**: Update all route documentation
4. **Testing**: Verify all navigation flows work

## Router Extension Features

Modern router classes should include these extended methods for debugging and validation:

```dart
class RouterApp{Name} {
  // Core router methods...
  
  /// Extended functionality
  static List<String> getAllRoutePaths() {
    return [home, profile, settings, /* all routes */];
  }
  
  static Map<String, String> getRouteDisplayNames() {
    return {
      home: '{App} Home',
      profile: 'Profile',
      // Display names for debugging/showcase
    };
  }
  
  static Map<String, dynamic> getRouterInfo() {
    return {
      'appId': '{app_id}',
      'appName': '{App Name}',
      'namespace': '/{app_id}',
      'defaultRoute': home,
      'totalRoutes': getAllRoutePaths().length,
      'routePaths': getAllRoutePaths(),
    };
  }
  
  static bool isValidRoute(String path) {
    return getAllRoutePaths().contains(path);
  }
  
  static String getDefaultRoute() => home;
  static String getHomeRoute() => home;
}
```

## Compliance Checklist

For each app, ensure:

- [ ] Home route implemented: `/{app_id}/home`
- [ ] Profile route implemented: `/{app_id}/profile`
- [ ] Router class follows naming convention
- [ ] Navigation helper methods provided
- [ ] Extended router methods implemented
- [ ] Error handling implemented
- [ ] Route constants properly namespaced
- [ ] Deep linking supported
- [ ] Authentication checks where needed
- [ ] Tests cover main navigation flows
- [ ] Documentation updated
- [ ] No provider wrapper files

## Examples

See `lib/apps/app_example/` for a complete reference implementation following these standards.

## Support

For questions about routing standards, refer to:
- Example app implementation
- Route manager documentation
- Flutter go_router documentation