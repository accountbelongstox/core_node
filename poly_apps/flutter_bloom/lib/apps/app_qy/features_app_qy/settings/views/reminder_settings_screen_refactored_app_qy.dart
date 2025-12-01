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

class ReminderSettingsScreenRefactoredAppQy extends StatefulWidget {
  const ReminderSettingsScreenRefactoredAppQy({super.key});

  @override
  State<ReminderSettingsScreenRefactoredAppQy> createState() =>
      _ReminderSettingsScreenRefactoredAppQyState();
}

class _ReminderSettingsScreenRefactoredAppQyState
    extends State<ReminderSettingsScreenRefactoredAppQy> {
  final List<String> _weekdays = [];

  @override
  void initState() {
    super.initState();
    _initWeekdays();
  }

  void _initWeekdays() {
    _weekdays.addAll([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
  }

  Future<void> _selectTime(SettingsControllerAppQy controller) async {
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
      await controller.updateReminderTime(time.hour, time.minute);
    }
  }

  String _formatTime(int hour, int minute) {
    final hourStr = hour.toString().padLeft(2, '0');
    final minuteStr = minute.toString().padLeft(2, '0');
    return '$hourStr:$minuteStr';
  }

  String _getTimeOfDay(int hour) {
    if (hour >= 5 && hour < 12) {
      return QyAppLocalizationKeys.qySettingsReminderMorning.tr(context);
    } else if (hour >= 12 && hour < 17) {
      return QyAppLocalizationKeys.qySettingsReminderAfternoon.tr(context);
    } else if (hour >= 17 && hour < 21) {
      return QyAppLocalizationKeys.qySettingsReminderEvening.tr(context);
    } else {
      return QyAppLocalizationKeys.qySettingsReminderNight.tr(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qySettingsReminder.tr(context),
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
          return ListView(
            padding: EdgeInsets.all(Dimensions.paddingMedium),
            children: [
              _buildTimeCard(controller),
              SizedBox(height: Dimensions.spacingLarge),
              _buildWeekendReminderCard(controller),
              SizedBox(height: Dimensions.spacingLarge),
              _buildQuickTimeOptions(controller),
              SizedBox(height: Dimensions.spacingLarge),
              _buildInfoCard(),
            ],
          );
        },
      ),
    );
  }

  Widget _buildTimeCard(SettingsControllerAppQy controller) {
    final hour = controller.settings.reminderHour;
    final minute = controller.settings.reminderMinute;
    final timeOfDay = _getTimeOfDay(hour);

    return Container(
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            ThemeColors.primary,
            ThemeColors.primary.withOpacity(0.8),
          ],
        ),
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.primary.withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            QyAppLocalizationKeys.qySettingsReminderTime.tr(context),
            style: TextStyles.body1.copyWith(
              color: ThemeColors.surface,
              fontWeight: FontWeight.w500,
            ),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          InkWell(
            onTap: () => _selectTime(controller),
            child: Text(
              _formatTime(hour, minute),
              style: TextStyle(
                fontSize: 56,
                fontWeight: FontWeight.bold,
                color: ThemeColors.surface,
                height: 1.0,
              ),
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            timeOfDay,
            style: TextStyles.body2.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
          SizedBox(height: Dimensions.spacingLarge),
          ElevatedButton.icon(
            onPressed: () => _selectTime(controller),
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.surface,
              foregroundColor: ThemeColors.primary,
              padding: EdgeInsets.symmetric(
                horizontal: Dimensions.paddingLarge,
                vertical: Dimensions.paddingMedium,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
              ),
            ),
            icon: Icon(Icons.access_time),
            label: Text(
              QyAppLocalizationKeys.qySettingsReminderChangeTime.tr(context),
              style: TextStyles.button.copyWith(
                color: ThemeColors.primary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWeekendReminderCard(SettingsControllerAppQy controller) {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(Dimensions.paddingMedium),
            decoration: BoxDecoration(
              color: ThemeColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
            ),
            child: Icon(
              Icons.weekend,
              color: ThemeColors.primary,
              size: 32,
            ),
          ),
          SizedBox(width: Dimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  QyAppLocalizationKeys.qySettingsWeekendReminder.tr(context),
                  style: TextStyles.body1.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: Dimensions.spacingXSmall),
                Text(
                  QyAppLocalizationKeys.qySettingsWeekendReminderDescription.tr(context),
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(width: Dimensions.spacingSmall),
          Switch(
            value: controller.settings.weekendReminder,
            onChanged: controller.toggleWeekendReminder,
            activeColor: ThemeColors.primary,
          ),
        ],
      ),
    );
  }

  Widget _buildQuickTimeOptions(SettingsControllerAppQy controller) {
    final quickTimes = [
      {'hour': 7, 'minute': 0, 'label': '07:00'},
      {'hour': 9, 'minute': 0, 'label': '09:00'},
      {'hour': 12, 'minute': 0, 'label': '12:00'},
      {'hour': 18, 'minute': 0, 'label': '18:00'},
      {'hour': 20, 'minute': 0, 'label': '20:00'},
      {'hour': 21, 'minute': 0, 'label': '21:00'},
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qySettingsReminderQuickSelect.tr(context),
          style: TextStyles.h4.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        Wrap(
          spacing: Dimensions.spacingSmall,
          runSpacing: Dimensions.spacingSmall,
          children: quickTimes.map((timeData) {
            final hour = timeData['hour'] as int;
            final minute = timeData['minute'] as int;
            final label = timeData['label'] as String;
            final isSelected = controller.settings.reminderHour == hour &&
                controller.settings.reminderMinute == minute;

            return InkWell(
              onTap: () => controller.updateReminderTime(hour, minute),
              child: Container(
                padding: EdgeInsets.symmetric(
                  horizontal: Dimensions.paddingMedium,
                  vertical: Dimensions.paddingSmall,
                ),
                decoration: BoxDecoration(
                  color: isSelected ? ThemeColors.primary : ThemeColors.surface,
                  borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                  border: Border.all(
                    color: isSelected ? ThemeColors.primary : ThemeColors.border,
                  ),
                ),
                child: Text(
                  label,
                  style: TextStyles.body1.copyWith(
                    color: isSelected ? ThemeColors.surface : ThemeColors.textPrimary,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildInfoCard() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.primary.withOpacity(0.1),
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(
          color: ThemeColors.primary.withOpacity(0.3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.info_outline,
            color: ThemeColors.primary,
            size: 20,
          ),
          SizedBox(width: Dimensions.spacingSmall),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  QyAppLocalizationKeys.qySettingsReminderInfo.tr(context),
                  style: TextStyles.body2.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
                SizedBox(height: Dimensions.spacingSmall),
                Text(
                  QyAppLocalizationKeys.qySettingsReminderInfoDetails.tr(context),
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textTertiary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
