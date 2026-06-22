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

library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/settings_controller_app_qy.dart';

class DisplayModeScreenRefactoredAppQy extends StatefulWidget {
  const DisplayModeScreenRefactoredAppQy({super.key});

  @override
  State<DisplayModeScreenRefactoredAppQy> createState() =>
      _DisplayModeScreenRefactoredAppQyState();
}

class _DisplayModeScreenRefactoredAppQyState
    extends State<DisplayModeScreenRefactoredAppQy> {
  final List<Map<String, dynamic>> _themeOptions = [];

  @override
  void initState() {
    super.initState();
    _initThemeOptions();
  }

  void _initThemeOptions() {
    _themeOptions.addAll([
      {
        'value': 'auto',
        'icon': Icons.brightness_auto,
        'description': 'Follow system settings',
      },
      {
        'value': 'light',
        'icon': Icons.light_mode,
        'description': 'Always use light theme',
      },
      {
        'value': 'dark',
        'icon': Icons.dark_mode,
        'description': 'Always use dark theme',
      },
    ]);
  }

  String _getThemeTitle(String theme) {
    switch (theme) {
      case 'auto':
        return QyAppLocalizationKeys.qySettingsThemeAuto.tr(context);
      case 'light':
        return QyAppLocalizationKeys.qySettingsThemeLight.tr(context);
      case 'dark':
        return QyAppLocalizationKeys.qySettingsThemeDark.tr(context);
      default:
        return theme;
    }
  }

  void _handleThemeChange(String theme) {
    context.read<SettingsControllerAppQy>().changeTheme(theme);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qySettingsTheme.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
      ),
      body: Consumer<SettingsControllerAppQy>(
        builder: (context, controller, child) {
          final currentTheme = controller.settings.theme;

          return ListView(
            padding: EdgeInsets.all(Dimensions.paddingMedium),
            children: [
              Container(
                padding: EdgeInsets.all(Dimensions.paddingMedium),
                decoration: BoxDecoration(
                  color: ThemeColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                  border: Border.all(
                    color: ThemeColors.primary.withOpacity(0.3),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.info_outline,
                      color: ThemeColors.primary,
                      size: 20,
                    ),
                    SizedBox(width: Dimensions.spacingSmall),
                    Expanded(
                      child: Text(
                        QyAppLocalizationKeys.qySettingsThemeDescription.tr(context),
                        style: TextStyles.body2.copyWith(
                          color: ThemeColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: Dimensions.spacingLarge),
              ..._themeOptions.map((option) {
                final theme = option['value'] as String;
                final icon = option['icon'] as IconData;
                final description = option['description'] as String;
                final isSelected = theme == currentTheme;

                return Padding(
                  padding: EdgeInsets.only(bottom: Dimensions.spacingMedium),
                  child: _buildThemeCard(
                    theme: theme,
                    icon: icon,
                    description: description,
                    isSelected: isSelected,
                  ),
                );
              }).toList(),
              SizedBox(height: Dimensions.spacingMedium),
              _buildPreviewSection(currentTheme),
            ],
          );
        },
      ),
    );
  }

  Widget _buildThemeCard({
    required String theme,
    required IconData icon,
    required String description,
    required bool isSelected,
  }) {
    return InkWell(
      onTap: () => _handleThemeChange(theme),
      child: Container(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        decoration: BoxDecoration(
          color: ThemeColors.surface,
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          border: Border.all(
            color: isSelected ? ThemeColors.primary : ThemeColors.border,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            if (isSelected)
              BoxShadow(
                color: ThemeColors.primary.withOpacity(0.2),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: EdgeInsets.all(Dimensions.paddingMedium),
              decoration: BoxDecoration(
                color: (isSelected ? ThemeColors.primary : ThemeColors.textSecondary)
                    .withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 32,
                color: isSelected ? ThemeColors.primary : ThemeColors.textSecondary,
              ),
            ),
            SizedBox(width: Dimensions.spacingMedium),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _getThemeTitle(theme),
                    style: TextStyles.body1.copyWith(
                      color: isSelected ? ThemeColors.primary : ThemeColors.textPrimary,
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                  SizedBox(height: Dimensions.spacingXSmall),
                  Text(
                    description,
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            if (isSelected)
              Container(
                padding: EdgeInsets.all(Dimensions.paddingXSmall),
                decoration: BoxDecoration(
                  color: ThemeColors.primary,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.check,
                  size: 16,
                  color: ThemeColors.surface,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildPreviewSection(String currentTheme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qySettingsThemePreview.tr(context),
          style: TextStyles.h4.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        Container(
          padding: EdgeInsets.all(Dimensions.paddingMedium),
          decoration: BoxDecoration(
            color: ThemeColors.surface,
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
            border: Border.all(color: ThemeColors.border),
          ),
          child: Column(
            children: [
              _buildPreviewItem(
                Icons.text_fields,
                QyAppLocalizationKeys.qySettingsThemePreviewText.tr(context),
              ),
              Divider(color: ThemeColors.border),
              _buildPreviewItem(
                Icons.format_color_fill,
                QyAppLocalizationKeys.qySettingsThemePreviewBackground.tr(context),
              ),
              Divider(color: ThemeColors.border),
              _buildPreviewButton(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPreviewItem(IconData icon, String text) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: Dimensions.paddingSmall),
      child: Row(
        children: [
          Icon(icon, color: ThemeColors.primary),
          SizedBox(width: Dimensions.spacingMedium),
          Text(
            text,
            style: TextStyles.body1.copyWith(color: ThemeColors.textPrimary),
          ),
        ],
      ),
    );
  }

  Widget _buildPreviewButton() {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: Dimensions.paddingSmall),
      child: ElevatedButton(
        onPressed: () {},
        style: ElevatedButton.styleFrom(
          backgroundColor: ThemeColors.primary,
          padding: EdgeInsets.symmetric(
            horizontal: Dimensions.paddingLarge,
            vertical: Dimensions.paddingMedium,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          ),
        ),
        child: Text(
          QyAppLocalizationKeys.qySettingsThemePreviewButton.tr(context),
          style: TextStyles.button.copyWith(
            color: ThemeColors.surface,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
