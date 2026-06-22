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
import 'package:provider/provider.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/custom_app_bar.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';
import 'package:qyflutter/common/settings/models/setting_item.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/notification_setting/controllers/notification_setting_controller.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/notification_setting/widgets/notification_setting_card.dart';

// AI MODIFICATION NOTE: This file was modified by QR_Profile_AI_Assistant
// - Migrated from hardcoded colors/styles to new theme system
// - Added proper theme imports and usage
// - Enhanced UI components with consistent theming
// - Refactored to use modern card-based UI components
// Other AIs: Please maintain theme system consistency when modifying this file

class NotificationSettingScreen extends StatefulWidget {
  const NotificationSettingScreen({super.key});

  @override
  State<NotificationSettingScreen> createState() => _NotificationSettingScreenState();
}

class _NotificationSettingScreenState extends State<NotificationSettingScreen> {
  late final NotificationSettingController _controller;

  @override
  void initState() {
    super.initState();
    final settingsController = Provider.of<SettingsController>(context, listen: false);
    _controller = NotificationSettingController(settingsController);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: _controller,
      child: Scaffold(
        backgroundColor: ThemeColors.systemBackground,
        appBar: CustomAppBar(
          title: 'achat_notification_title'.tr(context),
          showBackButton: true,
        ),
        body: Consumer<NotificationSettingController>(
          builder: (context, controller, child) {
            final settingsByCategory = controller.notificationSettingsByCategory;
            final categoryNames = controller.getCategoryDisplayNames();
            final isGloballyEnabled = controller.areNotificationsEnabled;

            return ListView(
              children: [
                // Global notification toggle
                NotificationSectionHeader(
                  title: 'achat_notification_section_general'.tr(context),
                  subtitle: 'Control all notification settings',
                ),
                NotificationToggleCard(
                  title: 'Enable Notifications',
                  description: 'Master switch for all notifications',
                  value: isGloballyEnabled,
                  onChanged: (value) => controller.updateSetting('notification_enabled', value),
                ),

                // Category-based settings
                ...settingsByCategory.entries.map((entry) {
                  final category = entry.key;
                  final settings = entry.value;
                  final categoryName = categoryNames[category] ?? category;

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      NotificationSectionHeader(title: categoryName),
                      ...settings.map((setting) => _buildSettingCard(context, setting, controller, isGloballyEnabled)),
                    ],
                  );
                }),

                // Footer note
                NotificationFooterNote(
                  text: 'achat_notification_footer'.tr(context),
                ),

                // Reset button
                Padding(
                  padding: EdgeInsets.all(ThemeDimensions.spacing16),
                  child: OutlinedButton(
                    onPressed: () => _showResetDialog(context, controller),
                    child: Text('Reset to Defaults'),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildSettingCard(BuildContext context, SettingItem setting, NotificationSettingController controller, bool isGloballyEnabled) {
    switch (setting.type) {
      case SettingType.toggle:
        return NotificationToggleCard(
          title: setting.name,
          description: setting.description,
          value: controller.getValue<bool>(setting.key, setting.defaultValue as bool? ?? false),
          onChanged: (value) => controller.updateSetting(setting.key, value),
          isEnabled: isGloballyEnabled,
        );
      case SettingType.select:
        final currentValue = controller.getValue<String>(setting.key, setting.defaultValue as String? ?? '');
        final displayValue = setting.labels?[currentValue] ?? currentValue;

        return NotificationSelectCard(
          title: setting.name,
          description: setting.description,
          currentValue: displayValue,
          onTap: () => _showSelectDialog(context, setting, controller),
          isEnabled: isGloballyEnabled,
        );
      default:
        return const SizedBox.shrink();
    }
  }

  void _showResetDialog(BuildContext context, NotificationSettingController controller) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusL),
        ),
        title: Text(
          'Reset Settings',
          style: ThemeTextStyles.titleLarge.copyWith(fontWeight: FontWeight.bold),
        ),
        content: Text(
          'Are you sure you want to reset all notification settings to their default values?',
          style: ThemeTextStyles.bodyMedium.copyWith(color: ThemeColors.secondaryLabel),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'achat_cancel'.tr(context),
              style: ThemeTextStyles.bodyMedium.copyWith(color: ThemeColors.tertiaryLabel),
            ),
          ),
          TextButton(
            onPressed: () async {
              await controller.resetToDefaults();
              if (context.mounted) {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Settings reset to defaults'),
                    backgroundColor: ThemeColors.green,
                  ),
                );
              }
            },
            child: Text(
              'Reset',
              style: ThemeTextStyles.bodyMedium.copyWith(color: ThemeColors.red),
            ),
          ),
        ],
      ),
    );
  }



  void _showSelectDialog(BuildContext context, SettingItem setting, NotificationSettingController controller) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusL),
        ),
        title: Text(
          setting.name,
          style: ThemeTextStyles.titleLarge.copyWith(fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: setting.options!.map((option) {
            final label = setting.labels?[option.toString()] ?? option.toString();
            final isSelected = controller.getValue<String>(setting.key, setting.defaultValue as String? ?? '') == option.toString();

            return RadioListTile<String>(
              title: Text(
                label,
                style: ThemeTextStyles.bodyMedium,
              ),
              value: option.toString(),
              groupValue: controller.getValue<String>(setting.key, setting.defaultValue as String? ?? ''),
              activeColor: ThemeColors.blue,
              onChanged: (value) {
                if (value != null) {
                  controller.updateSetting(setting.key, value);
                  Navigator.pop(context);
                }
              },
            );
          }).toList(),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'achat_cancel'.tr(context),
              style: ThemeTextStyles.bodyMedium.copyWith(color: ThemeColors.blue),
            ),
          ),
        ],
      ),
    );
  }
}
