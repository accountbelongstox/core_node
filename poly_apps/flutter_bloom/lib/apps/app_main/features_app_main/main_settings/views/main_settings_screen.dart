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

/// Main Settings Screen
/// Settings page for the main app
class MainSettingsScreen extends StatefulWidget {
  const MainSettingsScreen({super.key});

  @override
  State<MainSettingsScreen> createState() => _MainSettingsScreenState();
}

class _MainSettingsScreenState extends State<MainSettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Main Settings'),
        backgroundColor: theme.appBarTheme.backgroundColor,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildSectionHeader('General Settings', theme),
          _buildSettingsCard([
            _buildSwitchTile(
              'Show All Apps',
              'Display all registered apps on showcase screen',
              true,
              (value) {},
              Icons.apps,
              theme,
            ),
            _buildSwitchTile(
              'Auto Expand Sections',
              'Automatically expand app sections in showcase',
              true,
              (value) {},
              Icons.expand_more,
              theme,
            ),
          ], theme),
          
          const SizedBox(height: 24),
          _buildSectionHeader('Display Settings', theme),
          _buildSettingsCard([
            _buildSwitchTile(
              'Show Route Paths',
              'Display route paths in app showcase',
              false,
              (value) {},
              Icons.route,
              theme,
            ),
            _buildSwitchTile(
              'Show App Descriptions',
              'Display app descriptions in showcase',
              true,
              (value) {},
              Icons.description,
              theme,
            ),
            _buildSliderTile(
              'Grid Columns',
              'Number of columns in grid view',
              2.0,
              1.0,
              4.0,
              (value) {},
              Icons.grid_view,
              theme,
            ),
          ], theme),
          
          const SizedBox(height: 24),
          _buildSectionHeader('Debug Settings', theme),
          _buildSettingsCard([
            _buildSwitchTile(
              'Show Debug Info',
              'Display debug information in main app',
              false,
              (value) {},
              Icons.bug_report,
              theme,
            ),
            _buildSwitchTile(
              'Show Route Validation',
              'Display route validation results',
              false,
              (value) {},
              Icons.verified,
              theme,
            ),
            _buildSwitchTile(
              'Performance Overlay',
              'Show Flutter performance overlay',
              false,
              (value) {},
              Icons.speed,
              theme,
            ),
          ], theme),
          
          const SizedBox(height: 24),
          _buildSectionHeader('Developer Settings', theme),
          _buildSettingsCard([
            _buildSwitchTile(
              'Developer Mode',
              'Enable developer features and tools',
              false,
              (value) {},
              Icons.developer_mode,
              theme,
            ),
            _buildSwitchTile(
              'Widget Inspector',
              'Enable Flutter widget inspector',
              false,
              (value) {},
              Icons.widgets,
              theme,
            ),
          ], theme),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        title,
        style: theme.textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.bold,
          color: theme.colorScheme.primary,
        ),
      ),
    );
  }

  Widget _buildSettingsCard(List<Widget> children, ThemeData theme) {
    return Card(
      elevation: 2,
      child: Column(
        children: children,
      ),
    );
  }

  Widget _buildSwitchTile(
    String title,
    String subtitle,
    bool value,
    ValueChanged<bool> onChanged,
    IconData icon,
    ThemeData theme,
  ) {
    return ListTile(
      leading: Icon(icon, color: theme.colorScheme.primary),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: Switch(
        value: value,
        onChanged: onChanged,
      ),
    );
  }

  Widget _buildSliderTile(
    String title,
    String subtitle,
    double value,
    double min,
    double max,
    ValueChanged<double> onChanged,
    IconData icon,
    ThemeData theme,
  ) {
    return ListTile(
      leading: Icon(icon, color: theme.colorScheme.primary),
      title: Text(title),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(subtitle),
          const SizedBox(height: 8),
          Slider(
            value: value,
            min: min,
            max: max,
            divisions: (max - min).round(),
            label: value.round().toString(),
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}
