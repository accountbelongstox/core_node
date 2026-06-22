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
import '../models/all_apps_showcase_model.dart';

/// All Apps Showcase Controller
/// Handles business logic for the all apps showcase screen
class AllAppsShowcaseController {
  
  /// Load all apps data from route provider
  Future<AllAppsShowcaseModel> loadAllAppsData() async {
    try {
      // Get route information
      final routeInfo = MainRoutesProvider.getRouteInfo();
      final appsInfo = MainRoutesProvider.getRegisteredAppsInfo();
      
      // Convert to model format
      final registeredApps = appsInfo.map((appInfo) {
        final routes = (appInfo['routes'] as List<Map<String, dynamic>>)
            .map((routeData) => RouteInfo(
                  path: routeData['path'] ?? '',
                  name: routeData['name'] ?? 'Unnamed Route',
                ))
            .toList();
        
        return RegisteredAppInfo(
          appId: appInfo['appId'] ?? '',
          displayName: appInfo['displayName'] ?? 'Unknown App',
          description: appInfo['description'] ?? '',
          routePrefix: appInfo['routePrefix'] ?? '',
          routes: routes,
        );
      }).toList();
      
      return AllAppsShowcaseModel(
        registeredApps: registeredApps,
        totalRoutes: routeInfo['totalRoutes'] ?? 0,
        mainRoutes: routeInfo['mainRoutes'] ?? 0,
        otherAppRoutes: routeInfo['otherAppRoutes'] ?? 0,
        expandedSections: List.generate(registeredApps.length, (index) => true),
        viewMode: ViewMode.grid,
        sortBy: SortBy.name,
        showRoutePaths: false,
        showDescriptions: true,
        gridColumns: 2,
      );
    } catch (e) {
      throw Exception('Failed to load apps data: $e');
    }
  }
  
  /// Sort apps based on sort criteria
  List<RegisteredAppInfo> sortApps(List<RegisteredAppInfo> apps, SortBy sortBy) {
    final sortedApps = List<RegisteredAppInfo>.from(apps);
    
    switch (sortBy) {
      case SortBy.name:
        sortedApps.sort((a, b) => a.displayName.compareTo(b.displayName));
        break;
      case SortBy.id:
        sortedApps.sort((a, b) => a.appId.compareTo(b.appId));
        break;
      case SortBy.routesCount:
        sortedApps.sort((a, b) => b.routes.length.compareTo(a.routes.length));
        break;
    }
    
    return sortedApps;
  }
  
  /// Toggle section expansion
  void toggleSection(int index, bool expanded) {
    // This is handled in the view state, but could be extended for persistence
  }
  
  /// Show view options dialog
  void showViewOptions(BuildContext context, AllAppsShowcaseModel model, Function(AllAppsShowcaseModel) onUpdate) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('View Options', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            
            const Text('View Mode:'),
            RadioListTile<ViewMode>(
              title: const Text('Grid'),
              value: ViewMode.grid,
              groupValue: model.viewMode,
              onChanged: (value) {
                if (value != null) {
                  final updatedModel = model.copyWith(viewMode: value);
                  onUpdate(updatedModel);
                  Navigator.pop(context);
                }
              },
            ),
            RadioListTile<ViewMode>(
              title: const Text('List'),
              value: ViewMode.list,
              groupValue: model.viewMode,
              onChanged: (value) {
                if (value != null) {
                  final updatedModel = model.copyWith(viewMode: value);
                  onUpdate(updatedModel);
                  Navigator.pop(context);
                }
              },
            ),
            RadioListTile<ViewMode>(
              title: const Text('Compact'),
              value: ViewMode.compact,
              groupValue: model.viewMode,
              onChanged: (value) {
                if (value != null) {
                  final updatedModel = model.copyWith(viewMode: value);
                  onUpdate(updatedModel);
                  Navigator.pop(context);
                }
              },
            ),
            
            const Divider(),
            
            const Text('Sort By:'),
            RadioListTile<SortBy>(
              title: const Text('App Name'),
              value: SortBy.name,
              groupValue: model.sortBy,
              onChanged: (value) {
                if (value != null) {
                  final updatedModel = model.copyWith(sortBy: value);
                  onUpdate(updatedModel);
                  Navigator.pop(context);
                }
              },
            ),
            RadioListTile<SortBy>(
              title: const Text('App ID'),
              value: SortBy.id,
              groupValue: model.sortBy,
              onChanged: (value) {
                if (value != null) {
                  final updatedModel = model.copyWith(sortBy: value);
                  onUpdate(updatedModel);
                  Navigator.pop(context);
                }
              },
            ),
            RadioListTile<SortBy>(
              title: const Text('Routes Count'),
              value: SortBy.routesCount,
              groupValue: model.sortBy,
              onChanged: (value) {
                if (value != null) {
                  final updatedModel = model.copyWith(sortBy: value);
                  onUpdate(updatedModel);
                  Navigator.pop(context);
                }
              },
            ),
            
            const Divider(),
            
            SwitchListTile(
              title: const Text('Show Route Paths'),
              value: model.showRoutePaths,
              onChanged: (value) {
                final updatedModel = model.copyWith(showRoutePaths: value);
                onUpdate(updatedModel);
              },
            ),
            SwitchListTile(
              title: const Text('Show Descriptions'),
              value: model.showDescriptions,
              onChanged: (value) {
                final updatedModel = model.copyWith(showDescriptions: value);
                onUpdate(updatedModel);
              },
            ),
            
            if (model.viewMode == ViewMode.grid) ...[
              const Divider(),
              const Text('Grid Columns:'),
              Slider(
                value: model.gridColumns.toDouble(),
                min: 1,
                max: 4,
                divisions: 3,
                label: model.gridColumns.toString(),
                onChanged: (value) {
                  final updatedModel = model.copyWith(gridColumns: value.round());
                  onUpdate(updatedModel);
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
  
  /// Show route information dialog
  void showRouteInfo(BuildContext context, AllAppsShowcaseModel model) {
    final routeValidation = MainRoutesProvider.validateRoutes();
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Route Information'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Total Routes: ${model.totalRoutes}'),
              Text('Main Routes: ${model.mainRoutes}'),
              Text('Other App Routes: ${model.otherAppRoutes}'),
              Text('Registered Apps: ${model.registeredApps.length}'),
              const SizedBox(height: 16),
              const Text('Route Validation:'),
              Text('Status: ${routeValidation['success'] ? 'PASSED' : 'FAILED'}'),
              if (routeValidation['issues'].isNotEmpty) ...[
                const SizedBox(height: 8),
                const Text('Issues:'),
                ...routeValidation['issues'].map<Widget>((issue) => Text('• $issue')),
              ],
              if (routeValidation['warnings'].isNotEmpty) ...[
                const SizedBox(height: 8),
                const Text('Warnings:'),
                ...routeValidation['warnings'].map<Widget>((warning) => Text('• $warning')),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
  
  /// Dispose resources
  void dispose() {
    // Clean up any resources if needed
  }
}
