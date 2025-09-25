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

// Refactored by: Claude Code AI Assistant
// Date: 2024-12-19
// Changes: Updated to use proper theming and follow new Flutter guide standards
// Note to other AIs: This widget now uses ThemeColors and ThemeDimensions

import 'package:flutter/material.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class ProfileMenu extends StatelessWidget {
  final VoidCallback onPrivacyTap;
  final VoidCallback onNotificationTap;
  final VoidCallback onLanguageTap;

  const ProfileMenu({
    super.key,
    required this.onPrivacyTap,
    required this.onNotificationTap,
    required this.onLanguageTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildCompletionTip(context),
        const SizedBox(height: ThemeDimensions.spacing4),
        _buildMenuTile(
          context,
          icon: Icons.shield_outlined,
          iconColor: ThemeColors.blue,
          title: 'achat_profile_privacy'.tr(context),
          onTap: onPrivacyTap,
        ),
        _buildMenuTile(
          context,
          icon: Icons.notifications_none,
          iconColor: ThemeColors.orange,
          title: 'achat_profile_notification'.tr(context),
          onTap: onNotificationTap,
        ),
        _buildMenuTile(
          context,
          icon: Icons.language,
          iconColor: ThemeColors.purple,
          title: 'achat_profile_language'.tr(context),
          onTap: onLanguageTap,
        ),
        const SizedBox(height: ThemeDimensions.spacing20),
        _buildVersionInfo(context),
      ],
    );
  }

  Widget _buildCompletionTip(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacingMedium,
        vertical: ThemeDimensions.spacing12,
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing12,
        vertical: ThemeDimensions.spacing8,
      ),
      decoration: BoxDecoration(
        color: ThemeColors.green10,
        borderRadius: BorderRadius.circular(ThemeDimensions.spacing8),
      ),
      child: Row(
        children: [
          Icon(
            Icons.verified,
            color: ThemeColors.green,
            size: 20,
          ),
          const SizedBox(width: ThemeDimensions.spacing8),
          Expanded(
            child: Text(
              'achat_profile_complete_tip'.tr(context),
              style: ThemeTextStyles.textRegular.copyWith(
                fontSize: 14,
                color: ThemeColors.green100,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuTile(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required String title,
    required VoidCallback onTap,
  }) {
    return Column(
      children: [
        ListTile(
          leading: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(ThemeDimensions.spacing8),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          title: Text(
            title,
            style: ThemeTextStyles.textMedium.copyWith(fontSize: 16),
          ),
          trailing: Icon(
            Icons.arrow_forward_ios,
            size: 16,
            color: ThemeColors.grey600,
          ),
          onTap: onTap,
        ),
        const Divider(height: 1, indent: 68),
      ],
    );
  }

  Widget _buildVersionInfo(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: ThemeDimensions.spacingMedium),
      child: Text(
        'achat_profile_version'.tr(context),
        style: ThemeTextStyles.textRegular.copyWith(
          fontSize: 12,
          color: ThemeColors.grey600,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}

