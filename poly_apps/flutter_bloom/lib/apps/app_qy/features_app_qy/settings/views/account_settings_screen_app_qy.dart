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

/// Account Settings Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class AccountSettingsScreenAppQy extends StatefulWidget {
  const AccountSettingsScreenAppQy({super.key});

  @override
  State<AccountSettingsScreenAppQy> createState() => _AccountSettingsScreenAppQyState();
}

class _AccountSettingsScreenAppQyState extends State<AccountSettingsScreenAppQy> {
  final List<Map<String, String>> _accountInfo;
  final List<Map<String, dynamic>> _bindingOptions;
  final List<String> _deletionWarnings;

  _AccountSettingsScreenAppQyState()
      : _accountInfo = [
          {
            'label': QyAppLocalizationKeys.qyUsername,
            'value': 'Phone_b426ae24afe51855',
            'action': QyAppLocalizationKeys.qySettingsModify,
          },
          {
            'label': QyAppLocalizationKeys.qyPassword,
            'value': '••••••••',
            'action': QyAppLocalizationKeys.qySettingsChangePasswordTitle,
          },
        ],
        _bindingOptions = [
          {
            'label': QyAppLocalizationKeys.qySettingsPhone,
            'value': '181****7523',
            'action': QyAppLocalizationKeys.qySettingsRebind,
            'isBound': true,
            'icon': Icons.phone_android,
            'localizedValue': false,
          },
          {
            'label': QyAppLocalizationKeys.qySettingsWechat,
            'value': '蓦然回首',
            'action': QyAppLocalizationKeys.qySettingsRebind,
            'isBound': true,
            'icon': Icons.wechat,
            'localizedValue': false,
          },
          {
            'label': QyAppLocalizationKeys.qySettingsWeibo,
            'value': QyAppLocalizationKeys.qySettingsNotBound,
            'action': QyAppLocalizationKeys.qySettingsBind,
            'isBound': false,
            'icon': Icons.alternate_email,
            'localizedValue': true,
          },
          {
            'label': QyAppLocalizationKeys.qySettingsQQ,
            'value': QyAppLocalizationKeys.qySettingsNotBound,
            'action': QyAppLocalizationKeys.qySettingsBind,
            'isBound': false,
            'icon': Icons.chat_bubble_outline,
            'localizedValue': true,
          },
        ],
        _deletionWarnings = [
          QyAppLocalizationKeys.qySettingsDeletionDataLoss,
          QyAppLocalizationKeys.qySettingsDeletionCourseLoss,
          QyAppLocalizationKeys.qySettingsDeletionAccountClear,
        ];

  void _handleAccountAction(Map<String, String> field) {
    final String labelKey = field['label']!;
    final String actionKey = field['action']!;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${labelKey.tr(context)} ${actionKey.tr(context)}'),
      ),
    );
  }

  void _handleBindingAction(Map<String, dynamic> binding) {
    final String labelKey = binding['label'] as String;
    final String actionKey = binding['action'] as String;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${labelKey.tr(context)} ${actionKey.tr(context)}'),
      ),
    );
  }

  Future<void> _handleDeleteAccount() async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(QyAppLocalizationKeys.qySettingsFinalConfirmation.tr(context)),
          content: Text(QyAppLocalizationKeys.qySettingsFinalConfirmationMessage.tr(context)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(QyAppLocalizationKeys.qySettingsLetMeThink.tr(context)),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: FilledButton.styleFrom(
                backgroundColor: ThemeColors.error,
              ),
              child: Text(QyAppLocalizationKeys.qySettingsDeleteAccount.tr(context)),
            ),
          ],
        );
      },
    );

    if (confirmed == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(QyAppLocalizationKeys.qySettingsAccountDeletionInProgress.tr(context)),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyAccountSettings.tr(context),
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
              _buildAccountInfoSection(),
              SizedBox(height: Dimensions.spacingMedium),
              _buildBindingSection(),
              SizedBox(height: Dimensions.spacingMedium),
              _buildDeletionSection(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAccountInfoSection() {
    return _buildSectionCard(
      title: QyAppLocalizationKeys.qyPersonalInfo.tr(context),
      subtitle: QyAppLocalizationKeys.qyAccountSettings.tr(context),
      child: Column(
        children: List.generate(_accountInfo.length, (index) {
          final field = _accountInfo[index];
          return Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          field['label']!.tr(context),
                          style: TextStyles.caption.copyWith(color: ThemeColors.textSecondary),
                        ),
                        SizedBox(height: Dimensions.spacingXSmall),
                        Text(
                          field['value']!,
                          style: TextStyles.body1.copyWith(
                            color: ThemeColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () => _handleAccountAction(field),
                    child: Text(
                      field['action']!.tr(context),
                      style: TextStyles.button.copyWith(color: ThemeColors.primary),
                    ),
                  ),
                ],
              ),
              if (index != _accountInfo.length - 1)
                Padding(
                  padding: EdgeInsets.symmetric(vertical: Dimensions.spacingSmall),
                  child: Divider(color: ThemeColors.border),
                ),
            ],
          );
        }),
      ),
    );
  }

  Widget _buildBindingSection() {
    return _buildSectionCard(
      title: QyAppLocalizationKeys.qySettingsAccountBinding.tr(context),
      subtitle: QyAppLocalizationKeys.qySettingsPhoneBindingInProgress.tr(context),
      child: Column(
        children: List.generate(_bindingOptions.length, (index) {
          final binding = _bindingOptions[index];
          final bool isBound = binding['isBound'] as bool;
          return Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: EdgeInsets.all(Dimensions.paddingSmall),
                    decoration: BoxDecoration(
                      color: ThemeColors.primary.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                    ),
                    child: Icon(
                      binding['icon'] as IconData,
                      color: ThemeColors.primary,
                    ),
                  ),
                  SizedBox(width: Dimensions.spacingMedium),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                (binding['label'] as String).tr(context),
                                style: TextStyles.body1.copyWith(
                                  color: ThemeColors.textPrimary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            Container(
                              padding: EdgeInsets.symmetric(
                                horizontal: Dimensions.paddingSmall,
                                vertical: Dimensions.paddingSizeExtraSmall,
                              ),
                              decoration: BoxDecoration(
                                color: isBound
                                    ? ThemeColors.primary.withOpacity(0.1)
                                    : ThemeColors.surface,
                                borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
                                border: Border.all(
                                  color: isBound ? ThemeColors.primary : ThemeColors.border,
                                ),
                              ),
                              child: Text(
                                isBound ? '已绑定' : QyAppLocalizationKeys.qySettingsNotBound.tr(context),
                                style: TextStyles.caption.copyWith(
                                  color: isBound ? ThemeColors.primary : ThemeColors.textSecondary,
                                ),
                              ),
                            ),
                          ],
                        ),
                        SizedBox(height: Dimensions.spacingXSmall),
                        Text(
                          ((binding['localizedValue'] as bool?) ?? false)
                              ? (binding['value'] as String).tr(context)
                              : binding['value'] as String,
                          style: TextStyles.body2.copyWith(color: ThemeColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () => _handleBindingAction(binding),
                    child: Text(
                      (binding['action'] as String).tr(context),
                      style: TextStyles.button.copyWith(color: ThemeColors.primary),
                    ),
                  ),
                ],
              ),
              if (index != _bindingOptions.length - 1)
                Padding(
                  padding: EdgeInsets.symmetric(vertical: Dimensions.spacingSmall),
                  child: Divider(color: ThemeColors.border),
                ),
            ],
          );
        }),
      ),
    );
  }

  Widget _buildDeletionSection() {
    return _buildSectionCard(
      title: QyAppLocalizationKeys.qySettingsAccountDeletion.tr(context),
      subtitle: QyAppLocalizationKeys.qySettingsAccountDeletionSubtitle.tr(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ..._deletionWarnings.map(
            (warning) => Padding(
              padding: EdgeInsets.only(bottom: Dimensions.spacingXSmall),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.warning_amber_outlined, size: 20, color: ThemeColors.warning),
                  SizedBox(width: Dimensions.spacingSmall),
                  Expanded(
                    child: Text(
                      warning.tr(context),
                      style: TextStyles.body2.copyWith(color: ThemeColors.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Container(
            padding: EdgeInsets.all(Dimensions.paddingMedium),
            decoration: BoxDecoration(
              color: ThemeColors.error.withOpacity(0.05),
              borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
              border: Border.all(color: ThemeColors.error.withOpacity(0.4)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  QyAppLocalizationKeys.qySettingsDeletionWarning.tr(context),
                  style: TextStyles.body1.copyWith(
                    color: ThemeColors.error,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: Dimensions.spacingSmall),
                Text(
                  QyAppLocalizationKeys.qySettingsConfirmDeletion.tr(context),
                  style: TextStyles.body2.copyWith(color: ThemeColors.textSecondary),
                ),
              ],
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(QyAppLocalizationKeys.qySettingsLetMeThink.tr(context)),
                    ),
                  ),
                  child: Text(QyAppLocalizationKeys.qySettingsLetMeThink.tr(context)),
                ),
              ),
              SizedBox(width: Dimensions.spacingSmall),
              Expanded(
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: ThemeColors.error),
                  onPressed: _handleDeleteAccount,
                  child: Text(QyAppLocalizationKeys.qySettingsDeleteAccount.tr(context)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    String? subtitle,
    required Widget child,
  }) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyles.subtitle1.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (subtitle != null) ...[
            SizedBox(height: Dimensions.spacingXSmall),
            Text(
              subtitle,
              style: TextStyles.caption.copyWith(color: ThemeColors.textSecondary),
            ),
          ],
          SizedBox(height: Dimensions.spacingMedium),
          child,
        ],
      ),
    );
  }
}
