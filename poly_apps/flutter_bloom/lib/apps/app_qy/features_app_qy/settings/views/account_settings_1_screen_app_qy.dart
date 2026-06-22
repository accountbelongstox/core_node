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

/// Account Settings 1 Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../config_app_qy/app_config_app_qy.dart';

class AccountSettings1ScreenAppQy extends StatefulWidget {
  const AccountSettings1ScreenAppQy({super.key});

  @override
  State<AccountSettings1ScreenAppQy> createState() =>
      _AccountSettings1ScreenAppQyState();
}

class _AccountSettings1ScreenAppQyState
    extends State<AccountSettings1ScreenAppQy> {
  final List<Map<String, dynamic>> _quickSections;
  final List<Map<String, dynamic>> _otherOptions;
  bool _isNightModeEnabled;

  _AccountSettings1ScreenAppQyState()
      : _quickSections = [],
        _otherOptions = [],
        _isNightModeEnabled = false;

  @override
  void initState() {
    super.initState();
    _initializeSections();
  }

  void _initializeSections() {
    _quickSections.addAll([
      {
        'title': QyAppLocalizationKeys.qyReminderSettings,
        'description': QyAppLocalizationKeys.qyReminderSettingsDesc,
        'icon': Icons.notifications_active_outlined,
        'color': ThemeColors.primary,
      },
      {
        'title': QyAppLocalizationKeys.qyAccountSettings,
        'description': QyAppLocalizationKeys.qyAccountSettings,
        'icon': Icons.person_outline,
        'color': ThemeColors.secondaryColor,
      },
      {
        'title': QyAppLocalizationKeys.qyRecommendSettings,
        'description': QyAppLocalizationKeys.qyRecommendSettingsDesc,
        'icon': Icons.auto_awesome,
        'color': ThemeColors.warning,
      },
      {
        'title': QyAppLocalizationKeys.qyOtherSettings,
        'description': QyAppLocalizationKeys.qyOtherSettings,
        'icon': Icons.widgets_outlined,
        'color': ThemeColors.info,
      },
    ]);

    _otherOptions.addAll([
      {
        'title': QyAppLocalizationKeys.qyDisplayMode,
        'subtitle': QyAppLocalizationKeys.qySettingsStandardMode,
        'icon': Icons.dark_mode_outlined,
      },
      {
        'title': QyAppLocalizationKeys.qyAboutUs,
        'subtitle':
            '${QyAppLocalizationKeys.qyAboutVersion.tr(context)} ${QyAppConfig.appVersion}',
        'icon': Icons.info_outline,
      },
      {
        'title': QyAppLocalizationKeys.qyCheckForUpdate,
        'subtitle': QyAppLocalizationKeys.qyLatestVersion.tr(context),
        'icon': Icons.system_update_alt,
      },
      {
        'title': QyAppLocalizationKeys.qyNetworkDiagnostics,
        'subtitle': QyAppLocalizationKeys.qyNetworkStable.tr(context),
        'icon': Icons.wifi_tethering,
      },
    ]);
  }

  void _handleSectionTap(Map<String, dynamic> section) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
            '${section['title'].tr(context)} ${QyAppLocalizationKeys.qyFeatureComingSoon.tr(context)}'),
      ),
    );
  }

  void _handleLogout() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyLogoutConfirm.tr(context)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyAccountSettings.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildQuickGrid(),
              SizedBox(height: ThemeDimensions.spacingMedium),
              _buildNightModeCard(),
              SizedBox(height: ThemeDimensions.spacingMedium),
              _buildOtherOptions(),
              SizedBox(height: ThemeDimensions.spacingMedium),
              _buildIcpInfo(),
              SizedBox(height: ThemeDimensions.spacingMedium),
              _buildLogoutButton(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickGrid() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qySettingsCenter.tr(context),
          style: ThemeTextStyles.subtitle1
              .copyWith(color: ThemeColors.textSecondary),
        ),
        SizedBox(height: ThemeDimensions.spacingSmall),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _quickSections.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            childAspectRatio: 1.4,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
          ),
          itemBuilder: (context, index) {
            final section = _quickSections[index];
            return InkWell(
              onTap: () => _handleSectionTap(section),
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
              child: Container(
                padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
                decoration: BoxDecoration(
                  color: ThemeColors.surface,
                  borderRadius:
                      BorderRadius.circular(ThemeDimensions.radiusLarge),
                  border: Border.all(color: ThemeColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: EdgeInsets.all(ThemeDimensions.paddingSmall),
                      decoration: BoxDecoration(
                        color: (section['color'] as Color).withOpacity(0.1),
                        borderRadius:
                            BorderRadius.circular(ThemeDimensions.radiusSmall),
                      ),
                      child: Icon(
                        section['icon'] as IconData,
                        color: section['color'] as Color,
                      ),
                    ),
                    SizedBox(height: ThemeDimensions.spacingSmall),
                    Text(
                      (section['title'] as String).tr(context),
                      style: ThemeTextStyles.body1.copyWith(
                        color: ThemeColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    SizedBox(height: ThemeDimensions.spacingXSmall),
                    Text(
                      section['description'] as String,
                      style: ThemeTextStyles.caption
                          .copyWith(color: ThemeColors.textSecondary),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildNightModeCard() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      QyAppLocalizationKeys.qyDisplayMode.tr(context),
                      style: ThemeTextStyles.body1.copyWith(
                        color: ThemeColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    SizedBox(height: ThemeDimensions.spacingXSmall),
                    Text(
                      _isNightModeEnabled
                          ? QyAppLocalizationKeys.qyNightModeEnabled.tr(context)
                          : QyAppLocalizationKeys.qyNormalModeProtectEyes
                              .tr(context),
                      style: ThemeTextStyles.caption
                          .copyWith(color: ThemeColors.textSecondary),
                    ),
                  ],
                ),
              ),
              Switch(
                value: _isNightModeEnabled,
                activeColor: ThemeColors.primary,
                onChanged: (value) {
                  setState(() {
                    _isNightModeEnabled = value;
                  });
                },
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Container(
            padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
            decoration: BoxDecoration(
              color: ThemeColors.primary.withOpacity(0.05),
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
            ),
            child: Row(
              children: [
                Icon(Icons.visibility_outlined, color: ThemeColors.primary),
                SizedBox(width: ThemeDimensions.spacingSmall),
                Expanded(
                  child: Text(
                    QyAppLocalizationKeys.qyNightModeTip.tr(context),
                    style: ThemeTextStyles.caption
                        .copyWith(color: ThemeColors.primary),
                  ),
                ),
                Text(
                  QyAppLocalizationKeys.qyNormalMode.tr(context),
                  style: ThemeTextStyles.caption
                      .copyWith(color: ThemeColors.primary),
                ),
                Icon(Icons.chevron_right, color: ColorsAppQy.qyTextTertiary),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOtherOptions() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: List.generate(_otherOptions.length, (index) {
          final option = _otherOptions[index];
          return Column(
            children: [
              Row(
                children: [
                  Icon(option['icon'] as IconData, color: ThemeColors.primary),
                  SizedBox(width: ThemeDimensions.spacingMedium),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          (option['title'] as String).tr(context),
                          style: ThemeTextStyles.body1.copyWith(
                            color: ThemeColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        SizedBox(height: ThemeDimensions.spacingXSmall),
                        Text(
                          option['subtitle'] as String,
                          style: ThemeTextStyles.caption
                              .copyWith(color: ThemeColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: ThemeColors.textTertiary),
                ],
              ),
              if (index != _otherOptions.length - 1)
                Padding(
                  padding: EdgeInsets.symmetric(
                      vertical: ThemeDimensions.spacingSmall),
                  child: Divider(color: ThemeColors.border),
                ),
            ],
          );
        }),
      ),
    );
  }

  Widget _buildIcpInfo() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyAboutLicense.tr(context),
            style: ThemeTextStyles.caption
                .copyWith(color: ThemeColors.textSecondary),
          ),
          SizedBox(height: ThemeDimensions.spacingXSmall),
          Text(
            QyAppConfig.appIcpLicense,
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLogoutButton() {
    return OutlinedButton.icon(
      style: OutlinedButton.styleFrom(
        foregroundColor: ThemeColors.error,
        padding: EdgeInsets.symmetric(vertical: ThemeDimensions.paddingSmall),
        side: BorderSide(color: ThemeColors.error),
      ),
      onPressed: _handleLogout,
      icon: const Icon(Icons.logout),
      label: Text(QyAppLocalizationKeys.qyLogout.tr(context)),
    );
  }
}
