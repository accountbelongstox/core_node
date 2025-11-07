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

    return Container(
      decoration: WuyAppThemeConfig.wuyBackgroundDecoration,
      child: Scaffold(
        backgroundColor: ThemeColors.transparent,
        appBar: AppBar(
          title: Text(
            LocalizationKeysAppWuy.wuySettingsTitle.tr(context),
            style: WuyAppThemeConfig.wuyAppBarTitle.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 22,
              letterSpacing: -0.5,
            ),
          ),
          backgroundColor: WuyAppThemeConfig.wuyPrimaryColor,
          foregroundColor: ThemeColors.white,
          elevation: 0,
          centerTitle: true,
          flexibleSpace: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  WuyAppThemeConfig.wuyPrimaryColor,
                  WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.9),
                ],
              ),
            ),
          ),
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
        Container(
          padding: EdgeInsets.symmetric(
            horizontal: ThemeDimensions.defaultPadding,
            vertical: ThemeDimensions.spacingSmall,
          ),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.12),
                WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.04),
              ],
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  icon,
                  color: WuyAppThemeConfig.wuyPrimaryColor,
                  size: 20,
                ),
              ),
              SizedBox(width: ThemeDimensions.spacingSmall),
              Text(
                title,
                style: ThemeTextStyles.titleLarge.copyWith(
                  color: WuyAppThemeConfig.wuyPrimaryColor,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: ThemeDimensions.spacingSmall),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 14,
                offset: const Offset(0, 4),
                spreadRadius: 0,
              ),
              BoxShadow(
                color: Colors.black.withOpacity(0.02),
                blurRadius: 6,
                offset: const Offset(0, 2),
                spreadRadius: 0,
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: Column(
              children: settings.asMap().entries.map((entry) {
                final index = entry.key;
                final setting = entry.value;
                return Column(
                  children: [
                    _buildSettingItem(context, controller, setting),
                    if (index < settings.length - 1)
                      Divider(
                        height: 1,
                        indent: ThemeDimensions.defaultPadding,
                        endIndent: ThemeDimensions.defaultPadding,
                        color: Colors.grey.withOpacity(0.15),
                      ),
                  ],
                );
              }).toList(),
            ),
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

    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.defaultPadding,
        vertical: ThemeDimensions.spacingSmall,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  setting.name,
                  style: ThemeTextStyles.titleMedium.copyWith(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
                if (setting.description != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    setting.description!,
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: ThemeColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            decoration: BoxDecoration(
              color: value
                  ? WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.1)
                  : Colors.grey.withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Switch(
              value: value,
              onChanged: (newValue) async {
                await controller.setSetting(setting.key, newValue);
              },
              activeColor: WuyAppThemeConfig.wuyPrimaryColor,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSelectItem(
    BuildContext context,
    SettingsController controller,
    SettingItem setting,
  ) {
    final value = controller.getSetting<String>(setting.key, setting.defaultValue as String) ?? setting.defaultValue as String;

    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.defaultPadding,
        vertical: ThemeDimensions.spacingSmall,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            setting.name,
            style: ThemeTextStyles.titleMedium.copyWith(
              fontWeight: FontWeight.w600,
              fontSize: 15,
            ),
          ),
          if (setting.description != null) ...[
            const SizedBox(height: 4),
            Text(
              setting.description!,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ThemeColors.textSecondary,
                fontSize: 13,
              ),
            ),
          ],
          const SizedBox(height: 8),
          InkWell(
            onTap: () async {
              final selectedValue = await showModalBottomSheet<String>(
                context: context,
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                ),
                builder: (context) {
                  return Container(
                    padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 40,
                          height: 4,
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            color: Colors.grey.withOpacity(0.3),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        ...setting.options!.map((option) {
                          final optionStr = option.toString();
                          final isSelected = optionStr == value;
                          return ListTile(
                            title: Text(
                              setting.labels?[optionStr] ?? optionStr,
                              style: TextStyle(
                                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                                color: isSelected
                                    ? WuyAppThemeConfig.wuyPrimaryColor
                                    : Colors.black87,
                              ),
                            ),
                            trailing: isSelected
                                ? Icon(Icons.check, color: WuyAppThemeConfig.wuyPrimaryColor)
                                : null,
                            onTap: () {
                              Navigator.pop(context, optionStr);
                            },
                          );
                        }),
                      ],
                    ),
                  );
                },
              );
              if (selectedValue != null) {
                await controller.setSetting(setting.key, selectedValue);
              }
            },
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.2),
                  width: 1,
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    setting.labels?[value] ?? value,
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: WuyAppThemeConfig.wuyPrimaryColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Icon(
                    Icons.arrow_drop_down,
                    color: WuyAppThemeConfig.wuyPrimaryColor,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSliderItem(
    BuildContext context,
    SettingsController controller,
    SettingItem setting,
  ) {
    final value = controller.getSetting<double>(setting.key, setting.defaultValue as double) ?? setting.defaultValue as double;

    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.defaultPadding,
        vertical: ThemeDimensions.spacingSmall,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      setting.name,
                      style: ThemeTextStyles.titleMedium.copyWith(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    if (setting.description != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        setting.description!,
                        style: ThemeTextStyles.bodySmall.copyWith(
                          color: ThemeColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  value.toStringAsFixed(0),
                  style: ThemeTextStyles.titleMedium.copyWith(
                    color: WuyAppThemeConfig.wuyPrimaryColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: WuyAppThemeConfig.wuyPrimaryColor,
              inactiveTrackColor: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.2),
              thumbColor: WuyAppThemeConfig.wuyPrimaryColor,
              overlayColor: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.2),
              trackHeight: 4,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 8),
            ),
            child: Slider(
              value: value,
              min: setting.minValue!,
              max: setting.maxValue!,
              divisions: ((setting.maxValue! - setting.minValue!) ~/ 1),
              onChanged: (newValue) async {
                await controller.setSetting(setting.key, newValue);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNumberItem(
    BuildContext context,
    SettingsController controller,
    SettingItem setting,
  ) {
    final value = controller.getSetting<int>(setting.key, setting.defaultValue as int) ?? setting.defaultValue as int;

    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.defaultPadding,
        vertical: ThemeDimensions.spacingSmall,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  setting.name,
                  style: ThemeTextStyles.titleMedium.copyWith(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
                if (setting.description != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    setting.description!,
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: ThemeColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: 100,
            decoration: BoxDecoration(
              color: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: WuyAppThemeConfig.wuyPrimaryColor.withOpacity(0.2),
                width: 1,
              ),
            ),
            child: TextFormField(
              initialValue: value.toString(),
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              style: ThemeTextStyles.titleMedium.copyWith(
                color: WuyAppThemeConfig.wuyPrimaryColor,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
              decoration: InputDecoration(
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
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
        ],
      ),
    );
  }

  Widget _buildResetButton(BuildContext context, SettingsController controller) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultPadding),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: ThemeColors.error.withOpacity(0.25),
              blurRadius: 16,
              offset: const Offset(0, 6),
              spreadRadius: 0,
            ),
            BoxShadow(
              color: ThemeColors.error.withOpacity(0.12),
              blurRadius: 24,
              offset: const Offset(0, 10),
              spreadRadius: -4,
            ),
          ],
        ),
        child: ElevatedButton.icon(
          onPressed: () async {
            final confirmed = await showDialog<bool>(
              context: context,
              builder: (context) => AlertDialog(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                title: Row(
                  children: [
                    Icon(Icons.warning_amber_rounded, color: ThemeColors.error, size: 28),
                    const SizedBox(width: 12),
                    Text(LocalizationKeysAppWuy.wuySettingsResetTitle.tr(context)),
                  ],
                ),
                content: Text(LocalizationKeysAppWuy.wuySettingsResetConfirm.tr(context)),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context, false),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    ),
                    child: Text(LocalizationKeysAppWuy.wuyButtonCancel.tr(context)),
                  ),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(context, true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ThemeColors.error,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
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
                    content: Row(
                      children: [
                        const Icon(Icons.check_circle, color: Colors.white),
                        const SizedBox(width: 12),
                        Text(LocalizationKeysAppWuy.wuySettingsResetSuccess.tr(context)),
                      ],
                    ),
                    backgroundColor: WuyAppThemeConfig.wuyPrimaryColor,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                );
              }
            }
          },
          icon: const Icon(Icons.restore, size: 22),
          label: Text(
            LocalizationKeysAppWuy.wuySettingsResetToDefaults.tr(context),
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.2,
            ),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: ThemeColors.error,
            foregroundColor: ThemeColors.white,
            minimumSize: const Size(double.infinity, 54),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(28),
            ),
            elevation: 0,
          ),
        ),
      ),
    );
  }
}
