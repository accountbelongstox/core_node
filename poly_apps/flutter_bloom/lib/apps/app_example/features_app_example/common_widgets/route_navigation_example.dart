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

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_example/router_app_example/routes_provider_app_example.dart';

// AI MODIFICATION NOTE: This widget was enhanced by QR_Profile_AI_Assistant
// - Added proper theme system integration
// - Enhanced with consistent theming
// - This is a good example of route navigation patterns
// Other AIs: Please maintain the theme system consistency

/// Route Navigation Example
/// Demonstrates how route keys are defined directly in route providers
/// No need to maintain separate constant files
class RouteNavigationExample extends StatelessWidget {
  const RouteNavigationExample({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Route Navigation Example',
          style: ThemeTextStyles.titleLarge,
        ),
        backgroundColor: ThemeColors.systemBackground,
        foregroundColor: ThemeColors.label,
      ),
      body: Padding(
        padding: EdgeInsets.all(ThemeDimensions.spacing16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Route Keys Management',
              style: ThemeTextStyles.titleLarge,
            ),
            SizedBox(height: ThemeDimensions.spacing16),
            Text(
              'Route keys are defined directly in the route provider files, '
              'eliminating the need to maintain separate constant files. '
              'This approach ensures that route definitions and their keys '
              'are always in sync.',
              style: ThemeTextStyles.bodyMedium,
            ),
            SizedBox(height: ThemeDimensions.spacing24),
            Text(
              'Example App Routes',
              style: ThemeTextStyles.titleLarge,
            ),
            SizedBox(height: ThemeDimensions.spacing16),
            _buildRouteCard(
              context,
              'Home',
              ExampleAppRoutesProvider.routeHome,
              'Main landing page of the Example app',
            ),
            _buildRouteCard(
              context,
              'Profile',
              ExampleAppRoutesProvider.routeProfile,
              'User profile management page',
            ),
            _buildRouteCard(
              context,
              'Settings',
              ExampleAppRoutesProvider.routeSettings,
              'Application settings and preferences',
            ),
            _buildRouteCard(
              context,
              'Dashboard',
              ExampleAppRoutesProvider.routeDashboard,
              'Analytics and overview dashboard',
            ),
            const SizedBox(height: 24),
            Text(
              'Benefits of This Approach',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            const Text(
              '• Route keys and definitions are in the same file\n'
              '• No need to maintain separate constant files\n'
              '• Easier to modify routes without opening multiple files\n'
              '• Reduced chance of inconsistencies\n'
              '• Better code organization and maintainability',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRouteCard(
    BuildContext context,
    String title,
    String routePath,
    String description,
  ) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8.0),
      child: ListTile(
        title: Text(title),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Path: $routePath',
              style: const TextStyle(fontFamily: 'monospace'),
            ),
            Text(description),
          ],
        ),
        trailing: ElevatedButton(
          onPressed: () => Navigator.pushNamed(context, routePath),
          child: const Text('Go'),
        ),
      ),
    );
  }
}
