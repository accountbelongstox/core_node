// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// Settings Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class SettingsScreenAppQy extends StatefulWidget {
  const SettingsScreenAppQy({super.key});

  @override
  State<SettingsScreenAppQy> createState() => _SettingsScreenAppQyState();
}

class _SettingsScreenAppQyState extends State<SettingsScreenAppQy> {
  bool _notificationsEnabled;
  bool _soundEnabled;

  _SettingsScreenAppQyState()
      : _notificationsEnabled = true,
        _soundEnabled = true;

  void _handleAccountSettings() {
    // TODO: Navigate to account settings
  }

  void _handleDisplayMode() {
    // TODO: Navigate to display mode settings
  }

  void _handleReminder() {
    // TODO: Navigate to reminder settings
  }

  void _handleRecommend() {
    // TODO: Navigate to recommend settings
  }

  void _handleAbout() {
    // TODO: Navigate to about page
  }

  void _handleLogout() {
    // TODO: Implement logout
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qySettings.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(Dimensions.paddingMedium),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildSectionTitle(QyAppLocalizationKeys.qyGeneralSettings.tr(context)),
              _buildSettingsGroup([
                _buildSettingItem(
                  Icons.person,
                  QyAppLocalizationKeys.qyAccountSettings.tr(context),
                  QyAppLocalizationKeys.qyAccountSettingsDesc.tr(context),
                  onTap: _handleAccountSettings,
                ),
                _buildSettingItem(
                  Icons.brightness_6,
                  QyAppLocalizationKeys.qyDisplayMode.tr(context),
                  QyAppLocalizationKeys.qyDisplayModeDesc.tr(context),
                  onTap: _handleDisplayMode,
                ),
                _buildToggleSettingItem(
                  Icons.notifications,
                  QyAppLocalizationKeys.qyNotifications.tr(context),
                  QyAppLocalizationKeys.qyNotificationsDesc.tr(context),
                  _notificationsEnabled,
                  (value) {
                    setState(() {
                      _notificationsEnabled = value;
                    });
                  },
                ),
                _buildToggleSettingItem(
                  Icons.volume_up,
                  QyAppLocalizationKeys.qySound.tr(context),
                  QyAppLocalizationKeys.qySoundDesc.tr(context),
                  _soundEnabled,
                  (value) {
                    setState(() {
                      _soundEnabled = value;
                    });
                  },
                ),
              ]),
              SizedBox(height: Dimensions.spacingLarge),
              _buildSectionTitle(QyAppLocalizationKeys.qyLearningSettings.tr(context)),
              _buildSettingsGroup([
                _buildSettingItem(
                  Icons.alarm,
                  QyAppLocalizationKeys.qyReminderSettings.tr(context),
                  QyAppLocalizationKeys.qyReminderSettingsDesc.tr(context),
                  onTap: _handleReminder,
                ),
                _buildSettingItem(
                  Icons.recommend,
                  QyAppLocalizationKeys.qyRecommendSettings.tr(context),
                  QyAppLocalizationKeys.qyRecommendSettingsDesc.tr(context),
                  onTap: _handleRecommend,
                ),
              ]),
              SizedBox(height: Dimensions.spacingLarge),
              _buildSectionTitle(QyAppLocalizationKeys.qyOtherSettings.tr(context)),
              _buildSettingsGroup([
                _buildSettingItem(
                  Icons.info,
                  QyAppLocalizationKeys.qyAbout.tr(context),
                  QyAppLocalizationKeys.qyAppVersion.tr(context),
                  onTap: _handleAbout,
                ),
                _buildSettingItem(
                  Icons.logout,
                  QyAppLocalizationKeys.qyLogout.tr(context),
                  QyAppLocalizationKeys.qyLogoutDesc.tr(context),
                  onTap: _handleLogout,
                  iconColor: ThemeColors.error,
                  textColor: ThemeColors.error,
                ),
              ]),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: EdgeInsets.only(
        left: Dimensions.paddingSmall,
        bottom: Dimensions.spacingSmall,
      ),
      child: Text(
        title,
        style: TextStyles.caption.copyWith(
          color: ThemeColors.textSecondary,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildSettingsGroup(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: children,
      ),
    );
  }

  Widget _buildSettingItem(
    IconData icon,
    String title,
    String subtitle, {
    VoidCallback? onTap,
    Color? iconColor,
    Color? textColor,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: ThemeColors.border.withOpacity(0.5),
              width: 0.5,
            ),
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: EdgeInsets.all(Dimensions.paddingSmall),
              decoration: BoxDecoration(
                color: (iconColor ?? ThemeColors.primary).withOpacity(0.1),
                borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
              ),
              child: Icon(
                icon,
                color: iconColor ?? ThemeColors.primary,
                size: 24,
              ),
            ),
            SizedBox(width: Dimensions.spacingMedium),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyles.body1.copyWith(
                      color: textColor ?? ThemeColors.textPrimary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  SizedBox(height: Dimensions.spacingXSmall),
                  Text(
                    subtitle,
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.arrow_forward_ios,
              color: ThemeColors.textTertiary,
              size: 16,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildToggleSettingItem(
    IconData icon,
    String title,
    String subtitle,
    bool value,
    ValueChanged<bool> onChanged,
  ) {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: ThemeColors.border.withOpacity(0.5),
            width: 0.5,
          ),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(Dimensions.paddingSmall),
            decoration: BoxDecoration(
              color: ThemeColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
            ),
            child: Icon(
              icon,
              color: ThemeColors.primary,
              size: 24,
            ),
          ),
          SizedBox(width: Dimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyles.body1.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                SizedBox(height: Dimensions.spacingXSmall),
                Text(
                  subtitle,
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: ThemeColors.primary,
          ),
        ],
      ),
    );
  }
}
