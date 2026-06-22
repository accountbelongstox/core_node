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
import '../domain/model/settings_model.dart';

class SettingsScreenRefactoredAppQy extends StatefulWidget {
  const SettingsScreenRefactoredAppQy({super.key});

  @override
  State<SettingsScreenRefactoredAppQy> createState() =>
      _SettingsScreenRefactoredAppQyState();
}

class _SettingsScreenRefactoredAppQyState
    extends State<SettingsScreenRefactoredAppQy> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SettingsControllerAppQy>().loadSettings();
    });
  }

  void _showLanguageDialog() {
    final controller = context.read<SettingsControllerAppQy>();
    final currentLanguage = controller.settings.language;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeColors.surface,
        title: Text(
          QyAppLocalizationKeys.qySettingsLanguage.tr(context),
          style: ThemeTextStyles.h4.copyWith(color: ThemeColors.textPrimary),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildLanguageOption(QyAppLocalizationKeys.qyLanguageCodeZh, currentLanguage),
            _buildLanguageOption(QyAppLocalizationKeys.qyLanguageCodeEn, currentLanguage),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              QyAppLocalizationKeys.qyCommonCancel.tr(context),
              style: ThemeTextStyles.button.copyWith(color: ThemeColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLanguageOption(String language, String currentLanguage) {
    final isSelected = language == currentLanguage;
    final displayName = language == QyAppLocalizationKeys.qyLanguageCodeZh 
        ? QyAppLocalizationKeys.qyLanguageChinese.tr(context)
        : QyAppLocalizationKeys.qyLanguageEnglish.tr(context);

    return ListTile(
      title: Text(
        displayName,
        style: ThemeTextStyles.body1.copyWith(
          color: isSelected ? ThemeColors.primary : ThemeColors.textPrimary,
          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
        ),
      ),
      trailing: isSelected
          ? Icon(Icons.check, color: ThemeColors.primary)
          : null,
      onTap: () {
        context.read<SettingsControllerAppQy>().changeLanguage(language);
        Navigator.pop(context);
      },
    );
  }

  void _showThemeDialog() {
    final controller = context.read<SettingsControllerAppQy>();
    final currentTheme = controller.settings.theme;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeColors.surface,
        title: Text(
          QyAppLocalizationKeys.qySettingsTheme.tr(context),
          style: ThemeTextStyles.h4.copyWith(color: ThemeColors.textPrimary),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildThemeOption('auto', currentTheme),
            _buildThemeOption('light', currentTheme),
            _buildThemeOption('dark', currentTheme),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              QyAppLocalizationKeys.qyCommonCancel.tr(context),
              style: ThemeTextStyles.button.copyWith(color: ThemeColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildThemeOption(String theme, String currentTheme) {
    final isSelected = theme == currentTheme;
    String displayName;
    switch (theme) {
      case 'auto':
        displayName = QyAppLocalizationKeys.qySettingsThemeAuto.tr(context);
        break;
      case 'light':
        displayName = QyAppLocalizationKeys.qySettingsThemeLight.tr(context);
        break;
      case 'dark':
        displayName = QyAppLocalizationKeys.qySettingsThemeDark.tr(context);
        break;
      default:
        displayName = theme;
    }

    return ListTile(
      title: Text(
        displayName,
        style: ThemeTextStyles.body1.copyWith(
          color: isSelected ? ThemeColors.primary : ThemeColors.textPrimary,
          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
        ),
      ),
      trailing: isSelected
          ? Icon(Icons.check, color: ThemeColors.primary)
          : null,
      onTap: () {
        context.read<SettingsControllerAppQy>().changeTheme(theme);
        Navigator.pop(context);
      },
    );
  }

  void _showDailyGoalDialog() {
    final controller = context.read<SettingsControllerAppQy>();
    int selectedGoal = controller.settings.dailyGoal;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          backgroundColor: ThemeColors.surface,
          title: Text(
            QyAppLocalizationKeys.qySettingsDailyGoal.tr(context),
            style: ThemeTextStyles.h4.copyWith(color: ThemeColors.textPrimary),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '$selectedGoal ${QyAppLocalizationKeys.qyWords.tr(context)}',
                style: ThemeTextStyles.h2.copyWith(
                  color: ThemeColors.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacingMedium),
              Slider(
                value: selectedGoal.toDouble(),
                min: 50,
                max: 500,
                divisions: 45,
                activeColor: ThemeColors.primary,
                inactiveColor: ThemeColors.border,
                onChanged: (value) {
                  setState(() {
                    selectedGoal = value.toInt();
                  });
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                QyAppLocalizationKeys.qyCommonCancel.tr(context),
                style: ThemeTextStyles.button.copyWith(color: ThemeColors.textSecondary),
              ),
            ),
            TextButton(
              onPressed: () {
                context.read<SettingsControllerAppQy>().updateDailyGoal(selectedGoal);
                Navigator.pop(context);
              },
              child: Text(
                QyAppLocalizationKeys.qyCommonOk.tr(context),
                style: ThemeTextStyles.button.copyWith(color: ThemeColors.primary),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qySettings.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
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
          if (controller.isLoading && controller.settings == AppSettingsModel.defaultSettings()) {
            return Center(
              child: CircularProgressIndicator(color: ThemeColors.primary),
            );
          }

          return ListView(
            padding: EdgeInsets.zero,
            children: [
              _buildSectionHeader(QyAppLocalizationKeys.qySettingsGeneral.tr(context)),
              _buildSettingsGroup([
                _buildSettingsTile(
                  icon: Icons.language,
                  title: QyAppLocalizationKeys.qySettingsLanguage.tr(context),
                  subtitle: controller.settings.language == QyAppLocalizationKeys.qyLanguageCodeZh 
                      ? QyAppLocalizationKeys.qyLanguageChinese.tr(context)
                      : QyAppLocalizationKeys.qyLanguageEnglish.tr(context),
                  onTap: _showLanguageDialog,
                ),
                _buildSettingsTile(
                  icon: Icons.brightness_6,
                  title: QyAppLocalizationKeys.qySettingsTheme.tr(context),
                  subtitle: _getThemeDisplayName(controller.settings.theme),
                  onTap: _showThemeDialog,
                ),
              ]),

              _buildSectionHeader(QyAppLocalizationKeys.qySettingsLearning.tr(context)),
              _buildSettingsGroup([
                _buildSettingsTile(
                  icon: Icons.flag,
                  title: QyAppLocalizationKeys.qySettingsDailyGoal.tr(context),
                  subtitle: '${controller.settings.dailyGoal} ${QyAppLocalizationKeys.qyWords.tr(context)}',
                  onTap: _showDailyGoalDialog,
                ),
                _buildSwitchTile(
                  icon: Icons.play_circle,
                  title: QyAppLocalizationKeys.qySettingsAutoPlayAudio.tr(context),
                  value: controller.settings.autoPlayAudio,
                  onChanged: controller.toggleAutoPlayAudio,
                ),
                _buildSwitchTile(
                  icon: Icons.translate,
                  title: QyAppLocalizationKeys.qySettingsShowTranslation.tr(context),
                  value: controller.settings.showTranslation,
                  onChanged: controller.toggleShowTranslation,
                ),
              ]),

              _buildSectionHeader(QyAppLocalizationKeys.qySettingsNotifications.tr(context)),
              _buildSettingsGroup([
                _buildSwitchTile(
                  icon: Icons.notifications,
                  title: QyAppLocalizationKeys.qySettingsEnableNotifications.tr(context),
                  value: controller.settings.notificationsEnabled,
                  onChanged: controller.toggleNotifications,
                ),
                _buildSwitchTile(
                  icon: Icons.volume_up,
                  title: QyAppLocalizationKeys.qySettingsSound.tr(context),
                  value: controller.settings.soundEnabled,
                  onChanged: controller.toggleSound,
                  enabled: controller.settings.notificationsEnabled,
                ),
                _buildSwitchTile(
                  icon: Icons.vibration,
                  title: QyAppLocalizationKeys.qySettingsVibration.tr(context),
                  value: controller.settings.vibrationEnabled,
                  onChanged: controller.toggleVibration,
                  enabled: controller.settings.notificationsEnabled,
                ),
              ]),

              _buildSectionHeader(QyAppLocalizationKeys.qySettingsReminder.tr(context)),
              _buildSettingsGroup([
                _buildSettingsTile(
                  icon: Icons.access_time,
                  title: QyAppLocalizationKeys.qySettingsReminderTime.tr(context),
                  subtitle: _formatTime(controller.settings.reminderHour, controller.settings.reminderMinute),
                  onTap: () => _showTimePicker(controller),
                ),
                _buildSwitchTile(
                  icon: Icons.weekend,
                  title: QyAppLocalizationKeys.qySettingsWeekendReminder.tr(context),
                  value: controller.settings.weekendReminder,
                  onChanged: controller.toggleWeekendReminder,
                ),
              ]),

              _buildSectionHeader(QyAppLocalizationKeys.qySettingsOther.tr(context)),
              _buildSettingsGroup([
                _buildSettingsTile(
                  icon: Icons.info,
                  title: QyAppLocalizationKeys.qySettingsAbout.tr(context),
                  onTap: () {},
                ),
                _buildSettingsTile(
                  icon: Icons.privacy_tip,
                  title: QyAppLocalizationKeys.qySettingsPrivacy.tr(context),
                  onTap: () {},
                ),
                _buildSettingsTile(
                  icon: Icons.refresh,
                  title: QyAppLocalizationKeys.qySettingsReset.tr(context),
                  onTap: () => _showResetDialog(controller),
                  textColor: ThemeColors.error,
                ),
              ]),

              SizedBox(height: ThemeDimensions.spacingLarge),
            ],
          );
        },
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        ThemeDimensions.paddingMedium,
        ThemeDimensions.paddingLarge,
        ThemeDimensions.paddingMedium,
        ThemeDimensions.paddingSmall,
      ),
      child: Text(
        title,
        style: ThemeTextStyles.caption.copyWith(
          color: ThemeColors.textSecondary,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildSettingsGroup(List<Widget> children) {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: children,
      ),
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
    Color? textColor,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(color: ThemeColors.border.withOpacity(0.3)),
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: EdgeInsets.all(ThemeDimensions.paddingSmall),
              decoration: BoxDecoration(
                color: ThemeColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
              ),
              child: Icon(
                icon,
                size: 20,
                color: textColor ?? ThemeColors.primary,
              ),
            ),
            SizedBox(width: ThemeDimensions.spacingMedium),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: ThemeTextStyles.body1.copyWith(
                      color: textColor ?? ThemeColors.textPrimary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  if (subtitle != null) ...[
                    SizedBox(height: ThemeDimensions.spacingXSmall),
                    Text(
                      subtitle,
                      style: ThemeTextStyles.caption.copyWith(
                        color: ThemeColors.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: ThemeColors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSwitchTile({
    required IconData icon,
    required String title,
    required bool value,
    required Function(bool) onChanged,
    bool enabled = true,
  }) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: ThemeColors.border.withOpacity(0.3)),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(ThemeDimensions.paddingSmall),
            decoration: BoxDecoration(
              color: ThemeColors.primary.withOpacity(enabled ? 0.1 : 0.05),
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
            ),
            child: Icon(
              icon,
              size: 20,
              color: enabled ? ThemeColors.primary : ThemeColors.textTertiary,
            ),
          ),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: Text(
              title,
              style: ThemeTextStyles.body1.copyWith(
                color: enabled ? ThemeColors.textPrimary : ThemeColors.textTertiary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Switch(
            value: value,
            onChanged: enabled ? onChanged : null,
            activeColor: ThemeColors.primary,
            inactiveThumbColor: ThemeColors.textTertiary,
            inactiveTrackColor: ThemeColors.border,
          ),
        ],
      ),
    );
  }

  String _getThemeDisplayName(String theme) {
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

  String _formatTime(int hour, int minute) {
    final hourStr = hour.toString().padLeft(2, '0');
    final minuteStr = minute.toString().padLeft(2, '0');
    return '$hourStr:$minuteStr';
  }

  Future<void> _showTimePicker(SettingsControllerAppQy controller) async {
    final TimeOfDay? time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: controller.settings.reminderHour,
        minute: controller.settings.reminderMinute,
      ),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.light(
              primary: ThemeColors.primary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (time != null) {
      controller.updateReminderTime(time.hour, time.minute);
    }
  }

  void _showResetDialog(SettingsControllerAppQy controller) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeColors.surface,
        title: Text(
          QyAppLocalizationKeys.qySettingsReset.tr(context),
          style: ThemeTextStyles.h4.copyWith(color: ThemeColors.textPrimary),
        ),
        content: Text(
          QyAppLocalizationKeys.qySettingsResetConfirm.tr(context),
          style: ThemeTextStyles.body1.copyWith(color: ThemeColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              QyAppLocalizationKeys.qyCommonCancel.tr(context),
              style: ThemeTextStyles.button.copyWith(color: ThemeColors.textSecondary),
            ),
          ),
          TextButton(
            onPressed: () async {
              final success = await controller.resetToDefaults();
              if (context.mounted) {
                Navigator.pop(context);
                if (success) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        QyAppLocalizationKeys.qySettingsResetSuccess.tr(context),
                      ),
                    ),
                  );
                }
              }
            },
            child: Text(
              QyAppLocalizationKeys.qyCommonOk.tr(context),
              style: ThemeTextStyles.button.copyWith(color: ThemeColors.error),
            ),
          ),
        ],
      ),
    );
  }
}
