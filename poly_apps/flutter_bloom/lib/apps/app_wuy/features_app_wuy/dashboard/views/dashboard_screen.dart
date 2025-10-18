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
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';

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
          LocalizationKeysAppWuy.wuyDashboardTitle.tr(context),
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
              LocalizationKeysAppWuy.wuyDashboardQuickStats.tr(context),
              style: ThemeTextStyles.titleLarge,
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            _buildStatsGrid(context),
            SizedBox(height: ThemeDimensions.spacingLarge),
            Text(
              LocalizationKeysAppWuy.wuyDashboardRecentActivity.tr(context),
              style: ThemeTextStyles.titleLarge,
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            _buildActivityList(context),
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
              LocalizationKeysAppWuy.wuyDashboardWelcome.tr(context),
              style: ThemeTextStyles.displayMedium.copyWith(
                color: ThemeColors.white,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingSmall),
            Text(
              LocalizationKeysAppWuy.wuyDashboardOverviewText.tr(context),
              style: ThemeTextStyles.bodyLarge.copyWith(
                color: ThemeColors.white.withOpacity(0.9),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsGrid(BuildContext context) {
    return GridView.count(
      shrinkWrap: true,
      physics: NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      mainAxisSpacing: ThemeDimensions.spacingMedium,
      crossAxisSpacing: ThemeDimensions.spacingMedium,
      childAspectRatio: 1.5,
      children: [
        _buildStatCard(
          LocalizationKeysAppWuy.wuyDashboardTotalUsers.tr(context),
          '1,234',
          Icons.people,
          ThemeColors.success,
        ),
        _buildStatCard(
          LocalizationKeysAppWuy.wuyDashboardActiveSessions.tr(context),
          '89',
          Icons.online_prediction,
          ThemeColors.info,
        ),
        _buildStatCard(
          LocalizationKeysAppWuy.wuyDashboardMessages.tr(context),
          '456',
          Icons.message,
          ThemeColors.warning,
        ),
        _buildStatCard(
          LocalizationKeysAppWuy.wuyDashboardTasks.tr(context),
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

  Widget _buildActivityList(BuildContext context) {
    final activities = [
      {'title': LocalizationKeysAppWuy.wuyDashboardNewUserRegistered.tr(context), 'time': LocalizationKeysAppWuy.wuyDashboardMinutesAgo.tr(context).replaceAll('{count}', '2'), 'icon': Icons.person_add},
      {'title': LocalizationKeysAppWuy.wuyDashboardSystemUpdateCompleted.tr(context), 'time': LocalizationKeysAppWuy.wuyDashboardHourAgo.tr(context), 'icon': Icons.system_update},
      {'title': LocalizationKeysAppWuy.wuyDashboardNewMessageReceived.tr(context), 'time': LocalizationKeysAppWuy.wuyDashboardHoursAgo.tr(context).replaceAll('{count}', '3'), 'icon': Icons.mail},
      {'title': LocalizationKeysAppWuy.wuyDashboardTaskCompleted.tr(context), 'time': LocalizationKeysAppWuy.wuyDashboardHoursAgo.tr(context).replaceAll('{count}', '5'), 'icon': Icons.check_circle},
      {'title': LocalizationKeysAppWuy.wuyDashboardReportGenerated.tr(context), 'time': LocalizationKeysAppWuy.wuyDashboardDayAgo.tr(context), 'icon': Icons.analytics},
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