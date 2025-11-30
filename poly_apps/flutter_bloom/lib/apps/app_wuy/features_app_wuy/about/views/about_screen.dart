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
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../widgets_app_wuy/wuy_common_background.dart';

/// About Screen for Wuy App
/// 
/// This screen displays app information, features, and version details.
/// 
/// Localization Usage:
/// - All user-facing text uses LocalizationKeysAppWuy constants with .tr(context) method
/// - Text keys are defined in localization_keys_app_wuy.dart
/// - Translations are provided in en_app_wuy.dart and zh_app_wuy.dart
/// - Example: LocalizationKeysAppWuy.wuyAboutTitle.tr(context)
class WuyAboutScreen extends StatelessWidget {
  const WuyAboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return WuyCommonBackground(
      child: Scaffold(
        backgroundColor: ThemeColors.transparent,
        appBar: AppBar(
          title: Text(
            LocalizationKeysAppWuy.wuyAboutTitle.tr(context),
            style: ThemeTextStyles.displayMedium.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 22,
              letterSpacing: -0.5,
            ),
          ),
          backgroundColor: ThemeColors.primary,
          elevation: 0,
          centerTitle: true,
          flexibleSpace: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  ThemeColors.primary,
                  ThemeColors.primary.withOpacity(0.9),
                ],
              ),
            ),
          ),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: ThemeColors.white),
            onPressed: () => context.go(WuyAppRouter.routeProfile),
          ),
        ),
        body: SingleChildScrollView(
          child: Column(
            children: [
              _buildHeaderSection(context),
              _buildContentSection(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderSection(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 300,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            ThemeColors.blue40,
            ThemeColors.blue60,
          ],
        ),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: ThemeColors.white,
                borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusLarge),
                boxShadow: [
                  BoxShadow(
                    color: ThemeColors.black.withOpacity(0.2),
                    blurRadius: 10,
                    offset: Offset(0, 5),
                  ),
                ],
              ),
              child: Icon(
                Icons.apps,
                size: 60,
                color: ThemeColors.blue60,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingLarge),
            Text(
              LocalizationKeysAppWuy.wuyAboutAppName.tr(context),
              style: ThemeTextStyles.largeTitle.copyWith(
                color: ThemeColors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              LocalizationKeysAppWuy.wuyAboutAppNameEn.tr(context),
              style: ThemeTextStyles.bodyLarge.copyWith(
                color: ThemeColors.white.withOpacity(0.9),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContentSection(BuildContext context) {
    return Container(
      margin: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        children: [
          _buildMenuCard(context),
          SizedBox(height: ThemeDimensions.spacingLarge),
          _buildAppInfoCard(context),
        ],
      ),
    );
  }

  Widget _buildMenuCard(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
            spreadRadius: 0,
          ),
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
            spreadRadius: 0,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: Column(
        children: [
          _buildMenuItem(
            icon: Icons.info_outline,
            title: LocalizationKeysAppWuy.wuyAboutFeatures.tr(context),
            subtitle: LocalizationKeysAppWuy.wuyAboutFeatureInfo.tr(context),
            onTap: () {
              _showFeatureDialog(context);
            },
          ),
          Divider(height: 1),
          _buildMenuItem(
            icon: Icons.update,
            title: LocalizationKeysAppWuy.wuyAboutVersion.tr(context),
            subtitle: LocalizationKeysAppWuy.wuyAboutVersionInfo.tr(context),
            onTap: () {
              _showVersionDialog(context);
            },
          ),
        ],
        ),
      ),
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(icon, color: ThemeColors.primary),
      title: Text(
        title,
        style: ThemeTextStyles.bodyLarge.copyWith(
          fontWeight: FontWeight.w500,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: ThemeTextStyles.bodyMedium.copyWith(
          color: ThemeColors.textSecondary,
        ),
      ),
      trailing: Icon(Icons.arrow_forward_ios, size: 16, color: ThemeColors.textSecondary),
      onTap: onTap,
    );
  }

  Widget _buildAppInfoCard(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
            spreadRadius: 0,
          ),
          BoxShadow(
            color: ThemeColors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
            spreadRadius: 0,
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              LocalizationKeysAppWuy.wuyAboutAppInfo.tr(context),
              style: ThemeTextStyles.title3,
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            _buildInfoRow(LocalizationKeysAppWuy.wuyAboutVersion.tr(context), LocalizationKeysAppWuy.wuyAboutVersionValue.tr(context)),
            _buildInfoRow(LocalizationKeysAppWuy.wuyAboutBuild.tr(context), LocalizationKeysAppWuy.wuyAboutBuildValue.tr(context)),
            _buildInfoRow(LocalizationKeysAppWuy.wuyAboutDeveloper.tr(context), LocalizationKeysAppWuy.wuyAboutDeveloperValue.tr(context)),
            _buildInfoRow(LocalizationKeysAppWuy.wuyAboutPlatform.tr(context), LocalizationKeysAppWuy.wuyAboutPlatformValue.tr(context)),
            _buildInfoRow(LocalizationKeysAppWuy.wuyAboutLicense.tr(context), LocalizationKeysAppWuy.wuyAboutLicenseValue.tr(context)),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: ThemeDimensions.spacingSmall),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          Text(
            value,
            style: ThemeTextStyles.bodyMedium.copyWith(
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  void _showFeatureDialog(BuildContext context) {
    // This would show a dialog with feature information
    // For now, just show a snackbar
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(LocalizationKeysAppWuy.wuyMessageFeatureComingSoon.tr(context))),
    );
  }

  void _showVersionDialog(BuildContext context) {
    // This would show a dialog with version information
    // For now, just show a snackbar
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(LocalizationKeysAppWuy.wuyMessageVersionComingSoon.tr(context))),
    );
  }
}
