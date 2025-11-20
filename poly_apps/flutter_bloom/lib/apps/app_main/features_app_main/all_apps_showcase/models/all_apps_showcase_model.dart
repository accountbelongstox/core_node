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

/// All Apps Showcase Data Model
/// Contains all data structures for the all apps showcase feature
library;


/// Main model for all apps showcase screen
class AllAppsShowcaseModel {
  final List<RegisteredAppInfo> registeredApps;
  final int totalRoutes;
  final int mainRoutes;
  final int otherAppRoutes;
  final List<bool> expandedSections;
  final ViewMode viewMode;
  final SortBy sortBy;
  final bool showRoutePaths;
  final bool showDescriptions;
  final int gridColumns;

  const AllAppsShowcaseModel({
    required this.registeredApps,
    required this.totalRoutes,
    required this.mainRoutes,
    required this.otherAppRoutes,
    required this.expandedSections,
    required this.viewMode,
    required this.sortBy,
    required this.showRoutePaths,
    required this.showDescriptions,
    required this.gridColumns,
  });

  AllAppsShowcaseModel copyWith({
    List<RegisteredAppInfo>? registeredApps,
    int? totalRoutes,
    int? mainRoutes,
    int? otherAppRoutes,
    List<bool>? expandedSections,
    ViewMode? viewMode,
    SortBy? sortBy,
    bool? showRoutePaths,
    bool? showDescriptions,
    int? gridColumns,
  }) {
    return AllAppsShowcaseModel(
      registeredApps: registeredApps ?? this.registeredApps,
      totalRoutes: totalRoutes ?? this.totalRoutes,
      mainRoutes: mainRoutes ?? this.mainRoutes,
      otherAppRoutes: otherAppRoutes ?? this.otherAppRoutes,
      expandedSections: expandedSections ?? this.expandedSections,
      viewMode: viewMode ?? this.viewMode,
      sortBy: sortBy ?? this.sortBy,
      showRoutePaths: showRoutePaths ?? this.showRoutePaths,
      showDescriptions: showDescriptions ?? this.showDescriptions,
      gridColumns: gridColumns ?? this.gridColumns,
    );
  }

  @override
  String toString() {
    return 'AllAppsShowcaseModel('
        'registeredApps: ${registeredApps.length}, '
        'totalRoutes: $totalRoutes, '
        'mainRoutes: $mainRoutes, '
        'otherAppRoutes: $otherAppRoutes, '
        'viewMode: $viewMode, '
        'sortBy: $sortBy, '
        'showRoutePaths: $showRoutePaths, '
        'showDescriptions: $showDescriptions, '
        'gridColumns: $gridColumns'
        ')';
  }
}

/// Information about a registered app
class RegisteredAppInfo {
  final String appId;
  final String displayName;
  final String description;
  final String routePrefix;
  final List<RouteInfo> routes;

  const RegisteredAppInfo({
    required this.appId,
    required this.displayName,
    required this.description,
    required this.routePrefix,
    required this.routes,
  });

  RegisteredAppInfo copyWith({
    String? appId,
    String? displayName,
    String? description,
    String? routePrefix,
    List<RouteInfo>? routes,
  }) {
    return RegisteredAppInfo(
      appId: appId ?? this.appId,
      displayName: displayName ?? this.displayName,
      description: description ?? this.description,
      routePrefix: routePrefix ?? this.routePrefix,
      routes: routes ?? this.routes,
    );
  }

  @override
  String toString() {
    return 'RegisteredAppInfo('
        'appId: $appId, '
        'displayName: $displayName, '
        'description: $description, '
        'routePrefix: $routePrefix, '
        'routes: ${routes.length}'
        ')';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is RegisteredAppInfo &&
        other.appId == appId &&
        other.displayName == displayName &&
        other.description == description &&
        other.routePrefix == routePrefix;
  }

  @override
  int get hashCode {
    return appId.hashCode ^
        displayName.hashCode ^
        description.hashCode ^
        routePrefix.hashCode;
  }
}

/// Information about a route
class RouteInfo {
  final String path;
  final String name;

  const RouteInfo({
    required this.path,
    required this.name,
  });

  RouteInfo copyWith({
    String? path,
    String? name,
  }) {
    return RouteInfo(
      path: path ?? this.path,
      name: name ?? this.name,
    );
  }

  @override
  String toString() {
    return 'RouteInfo(path: $path, name: $name)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is RouteInfo &&
        other.path == path &&
        other.name == name;
  }

  @override
  int get hashCode {
    return path.hashCode ^ name.hashCode;
  }
}

/// View mode options for displaying apps
enum ViewMode {
  grid,
  list,
  compact,
}

extension ViewModeExtension on ViewMode {
  String get displayName {
    switch (this) {
      case ViewMode.grid:
        return 'Grid View';
      case ViewMode.list:
        return 'List View';
      case ViewMode.compact:
        return 'Compact View';
    }
  }

  String get description {
    switch (this) {
      case ViewMode.grid:
        return 'Display routes in a grid layout';
      case ViewMode.list:
        return 'Display routes in a list layout';
      case ViewMode.compact:
        return 'Display routes as compact chips';
    }
  }
}

/// Sort options for apps
enum SortBy {
  name,
  id,
  routesCount,
}

extension SortByExtension on SortBy {
  String get displayName {
    switch (this) {
      case SortBy.name:
        return 'App Name';
      case SortBy.id:
        return 'App ID';
      case SortBy.routesCount:
        return 'Routes Count';
    }
  }

  String get description {
    switch (this) {
      case SortBy.name:
        return 'Sort apps alphabetically by display name';
      case SortBy.id:
        return 'Sort apps alphabetically by app ID';
      case SortBy.routesCount:
        return 'Sort apps by number of routes (descending)';
    }
  }
}

/// Statistics model for the showcase
class ShowcaseStatistics {
  final int totalApps;
  final int totalRoutes;
  final int mainRoutes;
  final int otherAppRoutes;
  final Map<String, int> routesByApp;
  final DateTime lastUpdated;

  const ShowcaseStatistics({
    required this.totalApps,
    required this.totalRoutes,
    required this.mainRoutes,
    required this.otherAppRoutes,
    required this.routesByApp,
    required this.lastUpdated,
  });

  ShowcaseStatistics copyWith({
    int? totalApps,
    int? totalRoutes,
    int? mainRoutes,
    int? otherAppRoutes,
    Map<String, int>? routesByApp,
    DateTime? lastUpdated,
  }) {
    return ShowcaseStatistics(
      totalApps: totalApps ?? this.totalApps,
      totalRoutes: totalRoutes ?? this.totalRoutes,
      mainRoutes: mainRoutes ?? this.mainRoutes,
      otherAppRoutes: otherAppRoutes ?? this.otherAppRoutes,
      routesByApp: routesByApp ?? this.routesByApp,
      lastUpdated: lastUpdated ?? this.lastUpdated,
    );
  }

  @override
  String toString() {
    return 'ShowcaseStatistics('
        'totalApps: $totalApps, '
        'totalRoutes: $totalRoutes, '
        'mainRoutes: $mainRoutes, '
        'otherAppRoutes: $otherAppRoutes, '
        'lastUpdated: $lastUpdated'
        ')';
  }
}

/// Filter options for the showcase
class ShowcaseFilters {
  final String searchQuery;
  final List<String> selectedAppIds;
  final bool showMainRoutes;
  final bool showOtherAppRoutes;
  final int minRoutesCount;
  final int maxRoutesCount;

  const ShowcaseFilters({
    this.searchQuery = '',
    this.selectedAppIds = const [],
    this.showMainRoutes = true,
    this.showOtherAppRoutes = true,
    this.minRoutesCount = 0,
    this.maxRoutesCount = 999,
  });

  ShowcaseFilters copyWith({
    String? searchQuery,
    List<String>? selectedAppIds,
    bool? showMainRoutes,
    bool? showOtherAppRoutes,
    int? minRoutesCount,
    int? maxRoutesCount,
  }) {
    return ShowcaseFilters(
      searchQuery: searchQuery ?? this.searchQuery,
      selectedAppIds: selectedAppIds ?? this.selectedAppIds,
      showMainRoutes: showMainRoutes ?? this.showMainRoutes,
      showOtherAppRoutes: showOtherAppRoutes ?? this.showOtherAppRoutes,
      minRoutesCount: minRoutesCount ?? this.minRoutesCount,
      maxRoutesCount: maxRoutesCount ?? this.maxRoutesCount,
    );
  }

  bool get hasActiveFilters {
    return searchQuery.isNotEmpty ||
        selectedAppIds.isNotEmpty ||
        !showMainRoutes ||
        !showOtherAppRoutes ||
        minRoutesCount > 0 ||
        maxRoutesCount < 999;
  }

  @override
  String toString() {
    return 'ShowcaseFilters('
        'searchQuery: $searchQuery, '
        'selectedAppIds: $selectedAppIds, '
        'showMainRoutes: $showMainRoutes, '
        'showOtherAppRoutes: $showOtherAppRoutes, '
        'minRoutesCount: $minRoutesCount, '
        'maxRoutesCount: $maxRoutesCount'
        ')';
  }
}
