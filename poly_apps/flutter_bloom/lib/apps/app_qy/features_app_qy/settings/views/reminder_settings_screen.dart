/// Reminder settings screen
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../widgets/settings_section.dart';
import '../widgets/settings_tile.dart';

class ReminderSettingsScreen extends StatefulWidget {
  const ReminderSettingsScreen({super.key});

  @override
  State<ReminderSettingsScreen> createState() => _ReminderSettingsScreenState();
}

class _ReminderSettingsScreenState extends State<ReminderSettingsScreen> {
  bool _dailyReminder = true;
  TimeOfDay _reminderTime = const TimeOfDay(hour: 19, minute: 0);
  bool _vibrationEnabled = true;
  bool _soundEnabled = true;
  final List<String> _selectedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.primaryGreen.withOpacity(0.1),
              Colors.white,
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _buildDailyReminderSection(),
                    const SizedBox(height: 24),
                    _buildNotificationSettings(),
                    const SizedBox(height: 24),
                    _buildReminderDays(),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: AppTheme.textPrimary),
            onPressed: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: Text(
              'settings.reminder'.tr(context),
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDailyReminderSection() {
    return SettingsSection(
      title: QyAppLocalizationKeys.qySettingsDailyReminder.tr(context),
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.notifications_active_outlined,
              color: AppTheme.primaryGreen,
            ),
            title: QyAppLocalizationKeys.qySettingsEnableDailyReminder.tr(context),
            subtitle: QyAppLocalizationKeys.qySettingsEnableDailyReminderSubtitle.tr(context),
            trailing: Switch(
              value: _dailyReminder,
              onChanged: (value) {
                setState(() {
                  _dailyReminder = value;
                });
              },
              activeColor: AppTheme.primaryGreen,
            ),
          ),
          if (_dailyReminder) ...[
            const Divider(height: 1, indent: 72),
            SettingsTile(
              leading: Icon(
                Icons.schedule_outlined,
                color: AppTheme.secondaryGreen,
              ),
              title: QyAppLocalizationKeys.qySettingsReminderTime.tr(context),
              subtitle: '${_reminderTime.hour.toString().padLeft(2, '0')}:${_reminderTime.minute.toString().padLeft(2, '0')}',
              trailing: const Icon(Icons.chevron_right),
              onTap: _selectTime,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildNotificationSettings() {
    return SettingsSection(
      title: QyAppLocalizationKeys.qyNotificationSettings.tr(context),
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.vibration_outlined,
              color: AppTheme.accentGreen,
            ),
            title: QyAppLocalizationKeys.qySettingsVibrationReminder.tr(context),
            subtitle: QyAppLocalizationKeys.qySettingsVibrationReminderSubtitle.tr(context),
            trailing: Switch(
              value: _vibrationEnabled,
              onChanged: (value) {
                setState(() {
                  _vibrationEnabled = value;
                });
              },
              activeColor: AppTheme.primaryGreen,
            ),
          ),
          const Divider(height: 1, indent: 72),
          SettingsTile(
            leading: Icon(
              Icons.volume_up_outlined,
              color: Colors.orange,
            ),
            title: QyAppLocalizationKeys.qySettingsSoundReminder.tr(context),
            subtitle: QyAppLocalizationKeys.qySettingsSoundReminderSubtitle.tr(context),
            trailing: Switch(
              value: _soundEnabled,
              onChanged: (value) {
                setState(() {
                  _soundEnabled = value;
                });
              },
              activeColor: AppTheme.primaryGreen,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReminderDays() {
    final days = [
      QyAppLocalizationKeys.qySettingsWeekdayMonday.tr(context),
      QyAppLocalizationKeys.qySettingsWeekdayTuesday.tr(context),
      QyAppLocalizationKeys.qySettingsWeekdayWednesday.tr(context),
      QyAppLocalizationKeys.qySettingsWeekdayThursday.tr(context),
      QyAppLocalizationKeys.qySettingsWeekdayFriday.tr(context),
      QyAppLocalizationKeys.qySettingsWeekdaySaturday.tr(context),
      QyAppLocalizationKeys.qySettingsWeekdaySunday.tr(context),
    ];

    return SettingsSection(
      title: QyAppLocalizationKeys.qySettingsReminderDate.tr(context),
      child: Column(
        children: [
          Wrap(
            spacing: 8,
            children: days.asMap().entries.map((entry) {
              final index = entry.key;
              final day = entry.value;
              final isSelected = _selectedDays.length == 7; // For simplicity, all days selected

              return FilterChip(
                label: Text(day),
                selected: isSelected,
                onSelected: (selected) {
                  setState(() {
                    if (selected) {
                      // Add day logic here
                    } else {
                      // Remove day logic here
                    }
                  });
                },
                selectedColor: AppTheme.primaryGreen.withOpacity(0.2),
                checkmarkColor: AppTheme.primaryGreen,
              );
            }).toList(),
          ),
          const SizedBox(height: 8),
          Text(
            QyAppLocalizationKeys.qySettingsRemindEveryday.tr(context),
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _selectTime() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _reminderTime,
      builder: (context, child) {
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
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