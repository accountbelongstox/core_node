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
import '../../../theme_app_wuy/theme_config_app_wuy.dart';

class WuyAboutScreen extends StatelessWidget {
  const WuyAboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: WuyAppThemeConfig.wuyBackgroundDecoration,
        child: Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            title: Text(
              LocalizationKeysAppWuy.wuyAboutTitle.tr(context),
              style: ThemeTextStyles.displayMedium,
            ),
            backgroundColor: ThemeColors.primary,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back, color: Colors.white),
              onPressed: () => context.go(WuyAppRouter.routeProfile),
            ),
          ),
          body: SingleChildScrollView(
            child: Column(
              children: [
                _buildHeaderSection(),
                _buildContentSection(context),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderSection() {
    return Container(
      width: double.infinity,
      height: 300,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.blue.shade400,
            Colors.blue.shade600,
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
                color: Colors.white,
                borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusLarge),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.2),
                    blurRadius: 10,
                    offset: Offset(0, 5),
                  ),
                ],
              ),
              child: Icon(
                Icons.apps,
                size: 60,
                color: Colors.blue.shade600,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingLarge),
            Text(
              '安无忧',
              style: ThemeTextStyles.largeTitle.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              'An Wu You',
              style: ThemeTextStyles.bodyLarge.copyWith(
                color: Colors.white.withOpacity(0.9),
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
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
      ),
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
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
      ),
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              LocalizationKeysAppWuy.wuyAboutAppInfo.tr(context),
              style: ThemeTextStyles.title3,
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            _buildInfoRow('Version', '1.0.0'),
            _buildInfoRow('Build', '2025.01.08'),
            _buildInfoRow('Developer', 'Wuy Team'),
            _buildInfoRow('Platform', 'Flutter'),
            _buildInfoRow('License', 'MIT'),
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
      SnackBar(content: Text('Feature information coming soon!')),
    );
  }

  void _showVersionDialog(BuildContext context) {
    // This would show a dialog with version information
    // For now, just show a snackbar
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Version information coming soon!')),
    );
  }
}
