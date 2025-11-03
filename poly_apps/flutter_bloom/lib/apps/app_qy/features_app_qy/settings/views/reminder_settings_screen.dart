/// Reminder settings screen
library reminder_settings_screen;

import 'package:flutter/material.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import 'widgets/settings_section.dart';
import 'widgets/settings_tile.dart';

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
  List<String> _selectedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
              'settings.reminder'.tr,
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
      title: '每日提醒',
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.notifications_active_outlined,
              color: AppTheme.primaryGreen,
            ),
            title: '开启每日提醒',
            subtitle: '每天固定时间提醒学习',
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
              title: '提醒时间',
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
      title: '通知设置',
      child: Column(
        children: [
          SettingsTile(
            leading: Icon(
              Icons.vibration_outlined,
              color: AppTheme.accentGreen,
            ),
            title: '震动提醒',
            subtitle: '学习提醒时震动',
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
            title: '声音提醒',
            subtitle: '学习提醒时播放声音',
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
    final days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    return SettingsSection(
      title: '提醒日期',
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
            '每天提醒',
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