// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';
import 'package:qyflutter/common/settings/models/setting_item.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../theme_app_wuy/theme_config_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';

/// Settings Screen for Wuy App
///
/// Uses Common SettingsController for unified settings management
/// Settings are stored in UnifiedStorage and available before login
/// All settings changes trigger immediate UI updates via Provider
class WuySettingsScreen extends StatelessWidget {
  const WuySettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final settingsController = context.watch<SettingsController>();

    return Scaffold(
      body: Container(
        decoration: WuyAppThemeConfig.wuyBackgroundDecoration,
        child: Scaffold(
          backgroundColor: ThemeColors.transparent,
          appBar: AppBar(
            title: Text(
              LocalizationKeysAppWuy.wuySettingsTitle.tr(context),
              style: WuyAppThemeConfig.wuyAppBarTitle,
            ),
            backgroundColor: WuyAppThemeConfig.wuyPrimaryColor,
            foregroundColor: ThemeColors.white,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back, color: ThemeColors.white),
              onPressed: () => context.pop(),
            ),
          ),
          body: ListView(
            padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
            children: [
              _buildCategorySection(
                context,
                settingsController,
                'appearance',
                LocalizationKeysAppWuy.wuySettingsAppearance.tr(context),
                Icons.palette,
              ),
              SizedBox(height: ThemeDimensions.spacingMedium),
              _buildCategorySection(
                context,
                settingsController,
                'language',
                LocalizationKeysAppWuy.wuySettingsLanguageSection.tr(context),
                Icons.language,
              ),
              SizedBox(height: ThemeDimensions.spacingMedium),
              _buildCategorySection(
                context,
                settingsController,
                'privacy',
                LocalizationKeysAppWuy.wuySettingsPrivacy.tr(context),
                Icons.privacy_tip,
              ),
              SizedBox(height: ThemeDimensions.spacingMedium),
              _buildCategorySection(
                context,
                settingsController,
                'social',
                LocalizationKeysAppWuy.wuySettingsSocial.tr(context),
                Icons.people,
              ),
              SizedBox(height: ThemeDimensions.spacingMedium),
              _buildCategorySection(
                context,
                settingsController,
                'messaging',
                LocalizationKeysAppWuy.wuySettingsMessaging.tr(context),
                Icons.message,
              ),
              SizedBox(height: ThemeDimensions.spacingMedium),
              _buildCategorySection(
                context,
                settingsController,
                'performance',
                LocalizationKeysAppWuy.wuySettingsPerformance.tr(context),
                Icons.speed,
              ),
              SizedBox(height: ThemeDimensions.spacingMedium),
              _buildCategorySection(
                context,
                settingsController,
                'security',
                LocalizationKeysAppWuy.wuySettingsSecurity.tr(context),
                Icons.security,
              ),
              SizedBox(height: ThemeDimensions.spacingLarge),
              _buildResetButton(context, settingsController),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCategorySection(
    BuildContext context,
    SettingsController controller,
    String category,
    String title,
    IconData icon,
  ) {
    final settingsByCategory = controller.getSettingsByCategory();
    final settings = settingsByCategory[category] ?? [];

    if (settings.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(left: ThemeDimensions.spacingSmall),
          child: Row(
            children: [
              Icon(icon, color: WuyAppThemeConfig.wuyPrimaryColor, size: 20),
              SizedBox(width: ThemeDimensions.spacingSmall),
              Text(
                title,
                style: ThemeTextStyles.titleLarge.copyWith(
                  color: WuyAppThemeConfig.wuyPrimaryColor,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: ThemeDimensions.spacingSmall),
        Card(
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.borderRadiusMedium),
          ),
          child: Column(
            children: settings.map((setting) {
              return _buildSettingItem(context, controller, setting);
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildSettingItem(
    BuildContext context,
    SettingsController controller,
    SettingItem setting,
  ) {
    switch (setting.type) {
      case SettingType.toggle:
        return _buildToggleItem(context, controller, setting);
      case SettingType.select:
        return _buildSelectItem(context, controller, setting);
      case SettingType.slider:
        return _buildSliderItem(context, controller, setting);
      case SettingType.number:
        return _buildNumberItem(context, controller, setting);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildToggleItem(
    BuildContext context,
    SettingsController controller,
    SettingItem setting,
  ) {
    final value = controller.getSetting<bool>(setting.key, setting.defaultValue as bool) ?? false;

    return ListTile(
      title: Text(
        setting.name,
        style: ThemeTextStyles.titleMedium,
      ),
      subtitle: setting.description != null
          ? Text(
              setting.description!,
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ThemeColors.textSecondary,
              ),
            )
          : null,
      trailing: Switch(
        value: value,
        onChanged: (newValue) async {
          await controller.setSetting(setting.key, newValue);
        },
        activeColor: WuyAppThemeConfig.wuyPrimaryColor,
      ),
    );
  }

  Widget _buildSelectItem(
    BuildContext context,
    SettingsController controller,
    SettingItem setting,
  ) {
    final value = controller.getSetting<String>(setting.key, setting.defaultValue as String) ?? setting.defaultValue as String;

    return ListTile(
      title: Text(
        setting.name,
        style: ThemeTextStyles.titleMedium,
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (setting.description != null) ...[
            Text(
              setting.description!,
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ThemeColors.textSecondary,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingSmall),
          ],
          Text(
            setting.labels?[value] ?? value,
            style: ThemeTextStyles.bodySmall.copyWith(
              color: WuyAppThemeConfig.wuyPrimaryColor,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
      trailing: PopupMenuButton<String>(
        icon: Icon(Icons.arrow_drop_down, color: WuyAppThemeConfig.wuyPrimaryColor),
        initialValue: value,
        onSelected: (newValue) async {
          await controller.setSetting(setting.key, newValue);
        },
        itemBuilder: (context) {
          return setting.options!.map((option) {
            final optionStr = option.toString();
            return PopupMenuItem<String>(
              value: optionStr,
              child: Text(setting.labels?[optionStr] ?? optionStr),
            );
          }).toList();
        },
      ),
    );
  }

  Widget _buildSliderItem(
    BuildContext context,
    SettingsController controller,
    SettingItem setting,
  ) {
    final value = controller.getSetting<double>(setting.key, setting.defaultValue as double) ?? setting.defaultValue as double;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ListTile(
          title: Text(
            setting.name,
            style: ThemeTextStyles.titleMedium,
          ),
          subtitle: setting.description != null
              ? Text(
                  setting.description!,
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                )
              : null,
          trailing: Text(
            value.toStringAsFixed(0),
            style: ThemeTextStyles.titleMedium.copyWith(
              color: WuyAppThemeConfig.wuyPrimaryColor,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultPadding),
          child: Slider(
            value: value,
            min: setting.minValue!,
            max: setting.maxValue!,
            divisions: ((setting.maxValue! - setting.minValue!) ~/ 1),
            activeColor: WuyAppThemeConfig.wuyPrimaryColor,
            onChanged: (newValue) async {
              await controller.setSetting(setting.key, newValue);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildNumberItem(
    BuildContext context,
    SettingsController controller,
    SettingItem setting,
  ) {
    final value = controller.getSetting<int>(setting.key, setting.defaultValue as int) ?? setting.defaultValue as int;

    return ListTile(
      title: Text(
        setting.name,
        style: ThemeTextStyles.titleMedium,
      ),
      subtitle: setting.description != null
          ? Text(
              setting.description!,
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ThemeColors.textSecondary,
              ),
            )
          : null,
      trailing: Container(
        constraints: const BoxConstraints(minWidth: 100),
        child: TextFormField(
          initialValue: value.toString(),
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          style: ThemeTextStyles.titleMedium.copyWith(
            color: WuyAppThemeConfig.wuyPrimaryColor,
            fontWeight: FontWeight.bold,
          ),
          decoration: InputDecoration(
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          ),
          onFieldSubmitted: (newValue) async {
            final intValue = int.tryParse(newValue);
            if (intValue != null) {
              if (setting.minIntValue != null && intValue < setting.minIntValue!) return;
              if (setting.maxIntValue != null && intValue > setting.maxIntValue!) return;
              await controller.setSetting(setting.key, intValue);
            }
          },
        ),
      ),
    );
  }

  Widget _buildResetButton(BuildContext context, SettingsController controller) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.spacingLarge),
      child: ElevatedButton.icon(
        onPressed: () async {
          final confirmed = await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: Text(LocalizationKeysAppWuy.wuySettingsResetTitle.tr(context)),
              content: Text(LocalizationKeysAppWuy.wuySettingsResetConfirm.tr(context)),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: Text(LocalizationKeysAppWuy.wuyButtonCancel.tr(context)),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context, true),
                  style: TextButton.styleFrom(
                    foregroundColor: ThemeColors.error,
                  ),
                  child: Text(LocalizationKeysAppWuy.wuyButtonReset.tr(context)),
                ),
              ],
            ),
          );

          if (confirmed == true) {
            await controller.resetAllSettings();
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(LocalizationKeysAppWuy.wuySettingsResetSuccess.tr(context)),
                ),
              );
            }
          }
        },
        icon: const Icon(Icons.restore),
        label: Text(LocalizationKeysAppWuy.wuySettingsResetToDefaults.tr(context)),
        style: ElevatedButton.styleFrom(
          backgroundColor: ThemeColors.error,
          foregroundColor: ThemeColors.white,
          padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        ),
      ),
    );
  }
}
