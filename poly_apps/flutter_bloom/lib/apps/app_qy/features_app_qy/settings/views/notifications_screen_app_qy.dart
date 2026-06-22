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

library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/settings_controller_app_qy.dart';

class NotificationsScreenRefactoredAppQy extends StatefulWidget {
  const NotificationsScreenRefactoredAppQy({super.key});

  @override
  State<NotificationsScreenRefactoredAppQy> createState() =>
      _NotificationsScreenRefactoredAppQyState();
}

class _NotificationsScreenRefactoredAppQyState
    extends State<NotificationsScreenRefactoredAppQy> {
  bool _pushNotifications = true;
  bool _emailNotifications = false;
  bool _studyReminders = true;
  bool _courseUpdates = true;
  bool _achievementAlerts = true;
  bool _socialNotifications = false;
  bool _weeklyReports = true;
  TimeOfDay _reminderTime = const TimeOfDay(hour: 9, minute: 0);
  List<bool> _selectedDays = [true, true, true, true, true, false, false];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyNotifications.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
      ),
      body: ListView(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        children: [
          _buildSectionTitle(QyAppLocalizationKeys.qyGeneral.tr(context)),
          _buildGeneralSection(),
          SizedBox(height: ThemeDimensions.spacingLarge),
          _buildSectionTitle(QyAppLocalizationKeys.qyContentTypes.tr(context)),
          _buildContentTypesSection(),
          SizedBox(height: ThemeDimensions.spacingLarge),
          _buildSectionTitle(QyAppLocalizationKeys.qyStudyReminders.tr(context)),
          _buildStudyRemindersSection(),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: EdgeInsets.only(bottom: ThemeDimensions.paddingMedium),
      child: Text(
        title,
        style: ThemeTextStyles.h4.copyWith(
          color: ThemeColors.textPrimary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildGeneralSection() {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          _buildSwitchTile(
            Icons.notifications_active,
            QyAppLocalizationKeys.qyPushNotifications.tr(context),
            QyAppLocalizationKeys.qyPushNotificationsDescription.tr(context),
            _pushNotifications,
            (value) => setState(() => _pushNotifications = value),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildSwitchTile(
            Icons.email,
            QyAppLocalizationKeys.qyEmailNotifications.tr(context),
            QyAppLocalizationKeys.qyEmailNotificationsDescription.tr(context),
            _emailNotifications,
            (value) => setState(() => _emailNotifications = value),
          ),
        ],
      ),
    );
  }

  Widget _buildContentTypesSection() {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          _buildSwitchTile(
            Icons.school,
            QyAppLocalizationKeys.qyCourseUpdates.tr(context),
            QyAppLocalizationKeys.qyCourseUpdatesDescription.tr(context),
            _courseUpdates,
            (value) => setState(() => _courseUpdates = value),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildSwitchTile(
            Icons.emoji_events,
            QyAppLocalizationKeys.qyAchievements.tr(context),
            QyAppLocalizationKeys.qyAchievementsDescription.tr(context),
            _achievementAlerts,
            (value) => setState(() => _achievementAlerts = value),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildSwitchTile(
            Icons.people,
            QyAppLocalizationKeys.qySocial.tr(context),
            QyAppLocalizationKeys.qySocialDescription.tr(context),
            _socialNotifications,
            (value) => setState(() => _socialNotifications = value),
          ),
          Divider(height: 1, color: ThemeColors.border),
          _buildSwitchTile(
            Icons.assessment,
            QyAppLocalizationKeys.qyWeeklyReports.tr(context),
            QyAppLocalizationKeys.qyWeeklyReportsDescription.tr(context),
            _weeklyReports,
            (value) => setState(() => _weeklyReports = value),
          ),
        ],
      ),
    );
  }

  Widget _buildStudyRemindersSection() {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          _buildSwitchTile(
            Icons.alarm,
            QyAppLocalizationKeys.qyDailyReminder.tr(context),
            QyAppLocalizationKeys.qyDailyReminderDescription.tr(context),
            _studyReminders,
            (value) => setState(() => _studyReminders = value),
          ),
          if (_studyReminders) ...{
            Divider(height: 1, color: ThemeColors.border),
            Padding(
              padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        QyAppLocalizationKeys.qyReminderTime.tr(context),
                        style: ThemeTextStyles.body1.copyWith(
                          color: ThemeColors.textPrimary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      InkWell(
                        onTap: _selectTime,
                        child: Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: ThemeDimensions.paddingMedium,
                            vertical: ThemeDimensions.paddingSmall,
                          ),
                          decoration: BoxDecoration(
                            color: ThemeColors.primary.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
                            border: Border.all(color: ThemeColors.primary),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.access_time,
                                size: 18,
                                color: ThemeColors.primary,
                              ),
                              SizedBox(width: ThemeDimensions.spacingSmall),
                              Text(
                                _reminderTime.format(context),
                                style: ThemeTextStyles.body1.copyWith(
                                  color: ThemeColors.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: ThemeDimensions.spacingLarge),
                  Text(
                    QyAppLocalizationKeys.qyReminderDays.tr(context),
                    style: ThemeTextStyles.body1.copyWith(
                      color: ThemeColors.textPrimary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.spacingMedium),
                  _buildDaySelector(),
                ],
              ),
            ),
          },
        ],
      ),
    );
  }

  Widget _buildSwitchTile(
    IconData icon,
    String title,
    String subtitle,
    bool value,
    Function(bool) onChanged,
  ) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(ThemeDimensions.paddingSmall),
            decoration: BoxDecoration(
              color: ThemeColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
            ),
            child: Icon(icon, size: 20, color: ThemeColors.primary),
          ),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: ThemeTextStyles.body1.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacingXSmall),
                Text(
                  subtitle,
                  style: ThemeTextStyles.caption.copyWith(
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

  Widget _buildDaySelector() {
    final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: List.generate(7, (index) {
        final isSelected = _selectedDays[index];
        return InkWell(
          onTap: () {
            setState(() {
              _selectedDays[index] = !_selectedDays[index];
            });
          },
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: isSelected
                  ? ThemeColors.primary
                  : ThemeColors.background,
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
              border: Border.all(
                color: isSelected ? ThemeColors.primary : ThemeColors.border,
              ),
            ),
            child: Center(
              child: Text(
                days[index][0],
                style: ThemeTextStyles.body2.copyWith(
                  color: isSelected ? ThemeColors.surface : ThemeColors.textSecondary,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Future<void> _selectTime() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _reminderTime,
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

    if (picked != null && picked != _reminderTime) {
      setState(() {
        _reminderTime = picked;
      });
    }
  }
}
