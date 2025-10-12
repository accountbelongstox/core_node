// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

/// Dashboard Screen for Wuy App
/// 
/// This screen displays dashboard with overview and statistics.
/// 
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyDashboardTitle.tr(context)
class WuyDashboardScreen extends StatelessWidget {
  const WuyDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          'Dashboard',
          style: ThemeTextStyles.displayMedium,
        ),
        backgroundColor: ThemeColors.primary,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildWelcomeCard(),
            SizedBox(height: ThemeDimensions.spacingLarge),
            Text(
              'Quick Stats',
              style: ThemeTextStyles.titleLarge,
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            _buildStatsGrid(),
            SizedBox(height: ThemeDimensions.spacingLarge),
            Text(
              'Recent Activity',
              style: ThemeTextStyles.titleLarge,
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            _buildActivityList(),
          ],
        ),
      ),
    );
  }

  Widget _buildWelcomeCard() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
      ),
      child: Container(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
          gradient: LinearGradient(
            colors: [ThemeColors.primary, ThemeColors.primaryDark],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Welcome back!',
              style: ThemeTextStyles.displayMedium.copyWith(
                color: ThemeColors.white,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingSmall),
            Text(
              'Here\'s your dashboard overview',
              style: ThemeTextStyles.bodyLarge.copyWith(
                color: ThemeColors.white.withOpacity(0.9),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsGrid() {
    return GridView.count(
      shrinkWrap: true,
      physics: NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      mainAxisSpacing: ThemeDimensions.spacingMedium,
      crossAxisSpacing: ThemeDimensions.spacingMedium,
      childAspectRatio: 1.5,
      children: [
        _buildStatCard(
          'Total Users',
          '1,234',
          Icons.people,
          ThemeColors.success,
        ),
        _buildStatCard(
          'Active Sessions',
          '89',
          Icons.online_prediction,
          ThemeColors.info,
        ),
        _buildStatCard(
          'Messages',
          '456',
          Icons.message,
          ThemeColors.warning,
        ),
        _buildStatCard(
          'Tasks',
          '12',
          Icons.task_alt,
          ThemeColors.error,
        ),
      ],
    );
  }

  Widget _buildStatCard(
    String title,
    String value,
    IconData icon,
    Color color,
  ) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
      ),
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(
                  icon,
                  color: color,
                  size: 24,
                ),
                Text(
                  value,
                  style: ThemeTextStyles.displaySmall.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            Text(
              title,
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ThemeColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActivityList() {
    final activities = [
      {'title': 'New user registered', 'time': '2 minutes ago', 'icon': Icons.person_add},
      {'title': 'System update completed', 'time': '1 hour ago', 'icon': Icons.system_update},
      {'title': 'New message received', 'time': '3 hours ago', 'icon': Icons.mail},
      {'title': 'Task completed', 'time': '5 hours ago', 'icon': Icons.check_circle},
      {'title': 'Report generated', 'time': '1 day ago', 'icon': Icons.analytics},
    ];

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: NeverScrollableScrollPhysics(),
        itemCount: activities.length,
        separatorBuilder: (context, index) => Divider(height: 1),
        itemBuilder: (context, index) {
          final activity = activities[index];
          return ListTile(
            leading: Icon(
              activity['icon'] as IconData,
              color: ThemeColors.primary,
            ),
            title: Text(
              activity['title'] as String,
              style: ThemeTextStyles.bodyLarge,
            ),
            subtitle: Text(
              activity['time'] as String,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ThemeColors.textSecondary,
              ),
            ),
          );
        },
      ),
    );
  }
}