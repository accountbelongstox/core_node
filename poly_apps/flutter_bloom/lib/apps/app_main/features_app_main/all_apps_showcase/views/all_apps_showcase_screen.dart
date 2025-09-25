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
import 'package:go_router/go_router.dart';
import '../controllers/all_apps_showcase_controller.dart';
import '../models/all_apps_showcase_model.dart';

/// All Apps Showcase Screen
/// The special page for debugging all apps as specified in the documentation
/// Displays all registered apps in a multi-title -> list format
/// Allows navigation to any app page for total debugging
class AllAppsShowcaseScreen extends StatefulWidget {
  const AllAppsShowcaseScreen({super.key});

  @override
  State<AllAppsShowcaseScreen> createState() => _AllAppsShowcaseScreenState();
}

class _AllAppsShowcaseScreenState extends State<AllAppsShowcaseScreen> {
  late AllAppsShowcaseController _controller;
  AllAppsShowcaseModel? _model;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller = AllAppsShowcaseController();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      final model = await _controller.loadAllAppsData();
      
      setState(() {
        _model = model;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('All Apps Showcase'),
        backgroundColor: theme.appBarTheme.backgroundColor,
        actions: [
          IconButton(
            icon: const Icon(Icons.view_module),
            onPressed: _showViewOptions,
            tooltip: 'View Options',
          ),
          IconButton(
            icon: const Icon(Icons.info_outline),
            onPressed: _showRouteInfo,
            tooltip: 'Route Information',
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _buildBody(theme),
    );
  }

  Widget _buildBody(ThemeData theme) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: theme.colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(
              'Error loading apps',
              style: theme.textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              _error!,
              style: theme.textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadData,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_model == null || _model!.registeredApps.isEmpty) {
      return _buildEmptyState(theme);
    }

    return Column(
      children: [
        _buildStatsHeader(theme),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _loadData,
            child: _buildAppsList(theme),
          ),
        ),
      ],
    );
  }

  Widget _buildStatsHeader(ThemeData theme) {
    if (_model == null) return const SizedBox.shrink();
    
    return Container(
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: theme.shadowColor.withValues(alpha: 0.1),
            spreadRadius: 0,
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildStatItem('Total Routes', _model!.totalRoutes.toString(), Icons.route, theme),
          _buildStatItem('Main Routes', _model!.mainRoutes.toString(), Icons.home, theme),
          _buildStatItem('Other Apps', _model!.otherAppRoutes.toString(), Icons.apps, theme),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon, ThemeData theme) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: theme.colorScheme.primary, size: 24),
        const SizedBox(height: 4),
        Text(
          value,
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
            color: theme.colorScheme.primary,
          ),
        ),
        Text(
          label,
          style: theme.textTheme.bodySmall,
        ),
      ],
    );
  }

  Widget _buildAppsList(ThemeData theme) {
    if (_model == null) return const SizedBox.shrink();
    
    final sortedApps = _controller.sortApps(_model!.registeredApps, _model!.sortBy);
    
    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: sortedApps.length,
      itemBuilder: (context, index) {
        final appInfo = sortedApps[index];
        return _buildAppSection(appInfo, index, theme);
      },
    );
  }

  Widget _buildAppSection(RegisteredAppInfo appInfo, int index, ThemeData theme) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ExpansionTile(
        initiallyExpanded: _model?.expandedSections[index] ?? true,
        onExpansionChanged: (expanded) {
          _controller.toggleSection(index, expanded);
          setState(() {
            _model?.expandedSections[index] = expanded;
          });
        },
        leading: CircleAvatar(
          backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.1),
          child: Icon(
            Icons.apps,
            color: theme.colorScheme.primary,
          ),
        ),
        title: Text(
          appInfo.displayName,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('App ID: ${appInfo.appId}'),
            Text('Routes: ${appInfo.routes.length}'),
            if (_model!.showDescriptions && appInfo.description.isNotEmpty)
              Text(
                appInfo.description,
                style: theme.textTheme.bodySmall?.copyWith(
                  fontStyle: FontStyle.italic,
                ),
              ),
          ],
        ),
        children: [
          if (appInfo.routes.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('No routes available for this app'),
            )
          else
            _buildRoutesList(appInfo.routes, theme),
        ],
      ),
    );
  }

  Widget _buildRoutesList(List<RouteInfo> routes, ThemeData theme) {
    switch (_model!.viewMode) {
      case ViewMode.grid:
        return _buildRoutesGrid(routes, theme);
      case ViewMode.list:
        return _buildRoutesListView(routes, theme);
      case ViewMode.compact:
        return _buildRoutesCompact(routes, theme);
    }
  }

  Widget _buildRoutesGrid(List<RouteInfo> routes, ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: _model!.gridColumns,
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          childAspectRatio: 2.5,
        ),
        itemCount: routes.length,
        itemBuilder: (context, index) {
          final route = routes[index];
          return _buildRouteCard(route, theme);
        },
      ),
    );
  }

  Widget _buildRoutesListView(List<RouteInfo> routes, ThemeData theme) {
    return Column(
      children: routes.map((route) => _buildRouteListTile(route, theme)).toList(),
    );
  }

  Widget _buildRoutesCompact(List<RouteInfo> routes, ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: routes.map((route) => _buildRouteChip(route, theme)).toList(),
      ),
    );
  }

  Widget _buildRouteCard(RouteInfo route, ThemeData theme) {
    return Card(
      child: InkWell(
        onTap: () => _navigateToRoute(route.path),
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                route.name,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (_model!.showRoutePaths) ...[
                const SizedBox(height: 4),
                Text(
                  route.path,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.primary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRouteListTile(RouteInfo route, ThemeData theme) {
    return ListTile(
      leading: const Icon(Icons.route),
      title: Text(route.name),
      subtitle: _model!.showRoutePaths ? Text(route.path) : null,
      trailing: const Icon(Icons.chevron_right),
      onTap: () => _navigateToRoute(route.path),
    );
  }

  Widget _buildRouteChip(RouteInfo route, ThemeData theme) {
    return ActionChip(
      label: Text(route.name),
      onPressed: () => _navigateToRoute(route.path),
    );
  }

  Widget _buildEmptyState(ThemeData theme) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.apps_outlined,
            size: 64,
            color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 16),
          Text(
            'No Apps Registered',
            style: theme.textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'No applications are currently registered in the system.',
            style: theme.textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  void _navigateToRoute(String path) {
    try {
      context.push(path);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to navigate to $path: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _showViewOptions() {
    _controller.showViewOptions(context, _model!, (updatedModel) {
      setState(() {
        _model = updatedModel;
      });
    });
  }

  void _showRouteInfo() {
    _controller.showRouteInfo(context, _model!);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}
