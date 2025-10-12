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
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';

/// Home Screen for Wuy App
/// 
/// This is the main home screen that displays app features and navigation options.
/// 
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyHomeTitle.tr(context)
class WuyHomeScreen extends StatelessWidget {
  const WuyHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.lightBackground,
      appBar: AppBar(
        title: Text(
          LocalizationKeysAppWuy.wuyHomeTitle.tr(context),
          style: ThemeTextStyles.headline3,
        ),
        backgroundColor: ThemeColors.primaryColor,
        elevation: 0,
      ),
      body: Padding(
        padding: EdgeInsets.all(ThemeDimensions.spacing16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              LocalizationKeysAppWuy.wuyHomeWelcome.tr(context),
              style: ThemeTextStyles.headline2,
            ),
            SizedBox(height: ThemeDimensions.spacing16),
            Text(
              LocalizationKeysAppWuy.wuyHomeDescription.tr(context),
              style: ThemeTextStyles.bodyText1,
            ),
            SizedBox(height: ThemeDimensions.spacing24),
            _buildFeatureCard(
              context,
              LocalizationKeysAppWuy.wuyHomeProfile.tr(context),
              LocalizationKeysAppWuy.wuyHomeViewProfile.tr(context),
              Icons.person,
              () => context.go(WuyAppRouter.routeProfile),
            ),
            SizedBox(height: ThemeDimensions.spacing16),
            _buildFeatureCard(
              context,
              LocalizationKeysAppWuy.wuyHomeSettings.tr(context),
              LocalizationKeysAppWuy.wuyHomeConfigureSettings.tr(context),
              Icons.settings,
              () => context.go(WuyAppRouter.routeSettings),
            ),
            SizedBox(height: ThemeDimensions.spacing16),
            _buildFeatureCard(
              context,
              LocalizationKeysAppWuy.wuyHomeDashboard.tr(context),
              LocalizationKeysAppWuy.wuyHomeViewDashboard.tr(context),
              Icons.dashboard,
              () => context.go(WuyAppRouter.routeDashboard),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureCard(
    BuildContext context,
    String title,
    String subtitle,
    IconData icon,
    VoidCallback onTap,
  ) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadius),
      ),
      child: ListTile(
        leading: Icon(
          icon,
          color: ThemeColors.primaryColor,
          size: 32,
        ),
        title: Text(
          title,
          style: ThemeTextStyles.headline6,
        ),
        subtitle: Text(
          subtitle,
          style: ThemeTextStyles.bodyText2,
        ),
        trailing: Icon(
          Icons.arrow_forward_ios,
          color: ThemeColors.greyColor,
        ),
        onTap: onTap,
      ),
    );
  }
}