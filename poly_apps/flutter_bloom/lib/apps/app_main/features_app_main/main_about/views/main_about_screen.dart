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
import '../../../router_app_main/routes_provider_app_main.dart';

/// Main About Screen
/// About page for the main app
class MainAboutScreen extends StatefulWidget {
  const MainAboutScreen({super.key});

  @override
  State<MainAboutScreen> createState() => _MainAboutScreenState();
}

class _MainAboutScreenState extends State<MainAboutScreen> {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('About Main App'),
        backgroundColor: theme.appBarTheme.backgroundColor,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildAppInfoSection(theme),
            const SizedBox(height: 24),
            _buildSystemInfoSection(theme),
            const SizedBox(height: 24),
            _buildRegisteredAppsSection(theme),
            const SizedBox(height: 24),
            _buildDeveloperInfoSection(theme),
          ],
        ),
      ),
    );
  }

  Widget _buildAppInfoSection(ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.flutter_dash,
                  size: 48,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Flutter Bloom - Main',
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Main entry point for all applications',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _buildInfoRow('Version', '1.0.0', Icons.info, theme),
            _buildInfoRow('Build Number', '1', Icons.build, theme),
            _buildInfoRow('App ID', 'main', Icons.fingerprint, theme),
          ],
        ),
      ),
    );
  }

  Widget _buildSystemInfoSection(ThemeData theme) {
    final routeInfo = MainRoutesProvider.getRouteInfo();
    final routeValidation = MainRoutesProvider.validateRoutes();
    
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'System Information',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            _buildInfoRow('Total Routes', '${routeInfo['totalRoutes']}', Icons.route, theme),
            _buildInfoRow('Main Routes', '${routeInfo['mainRoutes']}', Icons.home, theme),
            _buildInfoRow('Other App Routes', '${routeInfo['otherAppRoutes']}', Icons.apps, theme),
            _buildInfoRow(
              'Route Validation',
              routeValidation['success'] ? 'PASSED' : 'FAILED',
              routeValidation['success'] ? Icons.check_circle : Icons.error,
              theme,
              color: routeValidation['success'] 
                  ? theme.colorScheme.primary 
                  : theme.colorScheme.error,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRegisteredAppsSection(ThemeData theme) {
    final appsInfo = MainRoutesProvider.getRegisteredAppsInfo();
    
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Registered Applications',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            if (appsInfo.isEmpty)
              Text(
                'No applications registered',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
                ),
              )
            else
              ...appsInfo.map((appInfo) => _buildAppInfoTile(appInfo, theme)),
          ],
        ),
      ),
    );
  }

  Widget _buildAppInfoTile(Map<String, dynamic> appInfo, ThemeData theme) {
    final routes = appInfo['routes'] as List<Map<String, dynamic>>;
    
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.2),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.apps,
                  size: 20,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    appInfo['displayName'] ?? 'Unknown App',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${routes.length} routes',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.primary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'ID: ${appInfo['appId']}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
            if (appInfo['description'] != null && appInfo['description'].isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                appInfo['description'],
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDeveloperInfoSection(ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Developer Information',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            _buildInfoRow('Framework', 'Flutter', Icons.flutter_dash, theme),
            _buildInfoRow('Architecture', 'Multi-App Framework', Icons.architecture, theme),
            _buildInfoRow('Routing', 'GoRouter', Icons.route, theme),
            _buildInfoRow('State Management', 'StatefulWidget', Icons.widgets, theme),
            _buildInfoRow('Localization', 'flutter_localization', Icons.language, theme),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, IconData icon, ThemeData theme, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Icon(
            icon,
            size: 20,
            color: color ?? theme.colorScheme.primary,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: theme.textTheme.bodyMedium,
            ),
          ),
          Text(
            value,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.bold,
              color: color ?? theme.colorScheme.primary,
            ),
          ),
        ],
      ),
    );
  }
}
