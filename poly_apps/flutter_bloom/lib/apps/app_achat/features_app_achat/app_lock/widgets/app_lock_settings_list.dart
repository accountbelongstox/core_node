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
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/settings/models/setting_item.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/app_lock/controllers/app_lock_controller.dart';

class AppLockSettingsList extends StatelessWidget {
  final AppLockController controller;

  const AppLockSettingsList({
    super.key,
    required this.controller,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
      itemCount: controller.appLockSettings.length,
      separatorBuilder: (context, index) => const SizedBox(height: ThemeDimensions.paddingSizeSmall),
      itemBuilder: (context, index) {
        final setting = controller.appLockSettings[index];
        return _buildSettingItem(context, setting);
      },
    );
  }

  Widget _buildSettingItem(BuildContext context, SettingItem setting) {
    switch (setting.type) {
      case SettingType.toggle:
        return _buildToggleItem(context, setting);
      case SettingType.select:
        return _buildSelectItem(context, setting);
      case SettingType.slider:
        return _buildSliderItem(context, setting);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildToggleItem(BuildContext context, SettingItem setting) {
    final currentValue = controller.getSetting<bool>(setting.key, setting.defaultValue as bool?) ?? false;
    
    return Card(
      elevation: 2,
      child: ListTile(
        title: Text(
          setting.name,
          style: ThemeTextStyles.textSemiBold.copyWith(
            fontSize: ThemeDimensions.fontSizeMedium,
          ),
        ),
        subtitle: setting.description != null
            ? Text(
                setting.description!,
                style: ThemeTextStyles.textRegular.copyWith(
                  fontSize: ThemeDimensions.fontSizeSmall,
                  color: Theme.of(context).hintColor,
                ),
              )
            : null,
        trailing: Switch(
          value: currentValue,
          onChanged: (value) => controller.updateSetting(setting.key, value),
        ),
      ),
    );
  }

  Widget _buildSelectItem(BuildContext context, SettingItem setting) {
    final currentValue = controller.getSetting<String>(setting.key, setting.defaultValue as String?) ?? '';
    final displayValue = setting.labels?[currentValue] ?? currentValue;
    
    return Card(
      elevation: 2,
      child: ListTile(
        title: Text(
          setting.name,
          style: ThemeTextStyles.textSemiBold.copyWith(
            fontSize: ThemeDimensions.fontSizeMedium,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (setting.description != null)
              Text(
                setting.description!,
                style: ThemeTextStyles.textRegular.copyWith(
                  fontSize: ThemeDimensions.fontSizeSmall,
                  color: Theme.of(context).hintColor,
                ),
              ),
            const SizedBox(height: 4),
            Text(
              displayValue,
              style: ThemeTextStyles.textMedium.copyWith(
                fontSize: ThemeDimensions.fontSizeSmall,
                color: Theme.of(context).primaryColor,
              ),
            ),
          ],
        ),
        trailing: const Icon(Icons.arrow_forward_ios, size: 16),
        onTap: () => _showSelectDialog(context, setting, currentValue),
      ),
    );
  }

  Widget _buildSliderItem(BuildContext context, SettingItem setting) {
    final currentValue = controller.getSetting<double>(setting.key, setting.defaultValue as double?) ?? 0.0;
    
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(ThemeDimensions.paddingSizeDefault),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              setting.name,
              style: ThemeTextStyles.textSemiBold.copyWith(
                fontSize: ThemeDimensions.fontSizeMedium,
              ),
            ),
            if (setting.description != null) ...[
              const SizedBox(height: 4),
              Text(
                setting.description!,
                style: ThemeTextStyles.textRegular.copyWith(
                  fontSize: ThemeDimensions.fontSizeSmall,
                  color: Theme.of(context).hintColor,
                ),
              ),
            ],
            const SizedBox(height: 8),
            Slider(
              value: currentValue,
              min: setting.minValue ?? 0.0,
              max: setting.maxValue ?? 1.0,
              divisions: ((setting.maxValue ?? 1.0) - (setting.minValue ?? 0.0)).round(),
              label: currentValue.toString(),
              onChanged: (value) => controller.updateSetting(setting.key, value),
            ),
          ],
        ),
      ),
    );
  }

  void _showSelectDialog(BuildContext context, SettingItem setting, String currentValue) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(setting.name),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: setting.options?.map((option) {
            final label = setting.labels?[option] ?? option;
            return RadioListTile<String>(
              title: Text(label),
              value: option,
              groupValue: currentValue,
              onChanged: (value) {
                if (value != null) {
                  controller.updateSetting(setting.key, value);
                  Navigator.of(context).pop();
                }
              },
            );
          }).toList() ?? [],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
        ],
      ),
    );
  }
}
