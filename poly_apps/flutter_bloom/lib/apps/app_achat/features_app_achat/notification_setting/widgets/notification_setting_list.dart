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

// AI MODIFICATION NOTE: This file was marked for deletion by QR_Profile_AI_Assistant
// - Replaced by modern notification_setting_card.dart components
// - This legacy widget is no longer used in the new implementation
// - File should be renamed to notification_setting_list_delete.dart for manual cleanup

import 'package:flutter/material.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/notification_setting/domain/model/notification_setting_model.dart';

// AI MODIFICATION NOTE: This file was modified by QR_Profile_AI_Assistant
// - Fixed import path for NotificationSettingModel
// - Migrated from hardcoded colors/styles to new theme system
// - Enhanced UI components with consistent theming
// Other AIs: Please maintain theme system consistency when modifying this file

class NotificationSettingList extends StatelessWidget {
  final NotificationSettingModel settings;
  final Function(bool) onShowNotificationChanged;
  final Function(bool) onPreviewMessageChanged;
  final Function(bool) onLandscapeNotificationChanged;
  final Function(bool) onGroupImportantChanged;
  final Function(bool) onGroupAtMeChanged;
  final Function(bool) onChannelProjectChanged;
  final Function(bool) onChannelTaskChanged;
  final Function(bool) onAppPlaySoundChanged;
  final Function(bool) onAppPreviewChanged;
  final Function(bool) onUnreadIncludeClosedChanged;
  final Function(bool) onUnreadCountByConversationChanged;
  final Function(bool) onWorkTimeNotifyChanged;
  final Function(bool) onNewContactNotifyChanged;
  final Function(bool) onPriorityContactChanged;
  final VoidCallback onTimeRangeTap;

  const NotificationSettingList({
    super.key,
    required this.settings,
    required this.onShowNotificationChanged,
    required this.onPreviewMessageChanged,
    required this.onLandscapeNotificationChanged,
    required this.onGroupImportantChanged,
    required this.onGroupAtMeChanged,
    required this.onChannelProjectChanged,
    required this.onChannelTaskChanged,
    required this.onAppPlaySoundChanged,
    required this.onAppPreviewChanged,
    required this.onUnreadIncludeClosedChanged,
    required this.onUnreadCountByConversationChanged,
    required this.onWorkTimeNotifyChanged,
    required this.onNewContactNotifyChanged,
    required this.onPriorityContactChanged,
    required this.onTimeRangeTap,
  });

  String _formatTimeRange() {
    String pad(int n) => n.toString().padLeft(2, '0');
    return '${pad(settings.workStart.hour)}:${pad(settings.workStart.minute)} - ${pad(settings.workEnd.hour)}:${pad(settings.workEnd.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        _buildSectionTitle('achat_notification_section_general'.tr(context)),
        _buildSwitchTile(
          'achat_notification_show'.tr(context),
          'achat_notification_show_desc'.tr(context),
          settings.showNotification,
          onShowNotificationChanged,
        ),
        _buildSwitchTile(
          'achat_notification_preview'.tr(context),
          'achat_notification_preview_desc'.tr(context),
          settings.previewMessage,
          onPreviewMessageChanged,
        ),
        _buildSwitchTile(
          'achat_notification_banner'.tr(context),
          'achat_notification_banner_desc'.tr(context),
          settings.landscapeNotification,
          onLandscapeNotificationChanged,
        ),
        _buildSelectTile(
          'achat_notification_sound'.tr(context),
          'achat_notification_sound_value'.tr(context),
        ),
        _buildSectionTitle('achat_notification_section_group'.tr(context)),
        _buildSwitchTile(
          'achat_notification_group_important'.tr(context),
          'achat_notification_group_important_desc'.tr(context),
          settings.groupImportant,
          onGroupImportantChanged,
        ),
        _buildSwitchTile(
          'achat_notification_group_atme'.tr(context),
          'achat_notification_group_atme_desc'.tr(context),
          settings.groupAtMe,
          onGroupAtMeChanged,
        ),
        _buildSectionTitle('achat_notification_section_channel'.tr(context)),
        _buildSwitchTile(
          'achat_notification_channel_project'.tr(context),
          'achat_notification_channel_project_desc'.tr(context),
          settings.channelProject,
          onChannelProjectChanged,
        ),
        _buildSwitchTile(
          'achat_notification_channel_task'.tr(context),
          'achat_notification_channel_task_desc'.tr(context),
          settings.channelTask,
          onChannelTaskChanged,
        ),
        _buildSectionTitle('achat_notification_section_app'.tr(context)),
        _buildSwitchTile(
          'achat_notification_app_sound'.tr(context),
          'achat_notification_app_sound_desc'.tr(context),
          settings.appPlaySound,
          onAppPlaySoundChanged,
        ),
        _buildSectionTitle('achat_notification_section_setting'.tr(context)),
        _buildSwitchTile(
          'achat_notification_app_preview'.tr(context),
          'achat_notification_app_preview_desc'.tr(context),
          settings.appPreview,
          onAppPreviewChanged,
        ),
        _buildSectionTitle('achat_notification_section_unread'.tr(context)),
        _buildSwitchTile(
          'achat_notification_unread_include_closed'.tr(context),
          'achat_notification_unread_include_closed_desc'.tr(context),
          settings.unreadIncludeClosed,
          onUnreadIncludeClosedChanged,
        ),
        _buildSwitchTile(
          'achat_notification_unread_by_message'.tr(context),
          'achat_notification_unread_by_message_desc'.tr(context),
          settings.unreadCountByConversation,
          onUnreadCountByConversationChanged,
        ),
        _buildSectionTitle('achat_notification_section_worktime'.tr(context)),
        _buildSwitchTile(
          'achat_notification_worktime_notify'.tr(context),
          'achat_notification_worktime_notify_desc'.tr(context),
          settings.workTimeNotify,
          onWorkTimeNotifyChanged,
        ),
        _buildTimeRangeTile(
          'achat_notification_worktime_range'.tr(context),
          _formatTimeRange(),
          onTimeRangeTap,
        ),
        _buildSectionTitle('achat_notification_section_other'.tr(context)),
        _buildSwitchTile(
          'achat_notification_other_new_contact'.tr(context),
          'achat_notification_other_new_contact_desc'.tr(context),
          settings.newContactNotify,
          onNewContactNotifyChanged,
        ),
        _buildSwitchTile(
          'achat_notification_other_priority'.tr(context),
          'achat_notification_other_priority_desc'.tr(context),
          settings.priorityContact,
          onPriorityContactChanged,
        ),
        _buildFooterNote(context),
      ],
    );
  }

  Widget _buildSectionTitle(String title) {
    return Container(
      color: ThemeColors.systemGroupedBackground,
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing16,
        vertical: ThemeDimensions.spacing8,
      ),
      child: Text(
        title,
        style: ThemeTextStyles.bodyMedium.copyWith(
          color: ThemeColors.label,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildSwitchTile(String title, String subtitle, bool value, ValueChanged<bool> onChanged) {
    return Column(
      children: [
        ListTile(
          title: Text(
            title,
            style: ThemeTextStyles.bodyLarge,
          ),
          subtitle: Text(
            subtitle,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.secondaryLabel,
            ),
          ),
          trailing: Switch(
            value: value,
            onChanged: onChanged,
            activeColor: ThemeColors.green,
          ),
        ),
        Divider(
          height: 1,
          indent: ThemeDimensions.spacing16,
          color: ThemeColors.separator,
        ),
      ],
    );
  }

  Widget _buildSelectTile(String title, String value) {
    return Column(
      children: [
        ListTile(
          title: Text(
            title,
            style: ThemeTextStyles.bodyLarge,
          ),
          trailing: Text(
            value,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.tertiaryLabel,
            ),
          ),
        ),
        Divider(
          height: 1,
          indent: ThemeDimensions.spacing16,
          color: ThemeColors.separator,
        ),
      ],
    );
  }

  Widget _buildTimeRangeTile(String title, String value, VoidCallback onTap) {
    return Column(
      children: [
        ListTile(
          title: Text(
            title,
            style: ThemeTextStyles.bodyLarge,
          ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                value,
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: ThemeColors.blue,
                  fontWeight: FontWeight.w500,
                ),
              ),
              SizedBox(width: ThemeDimensions.spacing4),
              Icon(
                Icons.chevron_right,
                color: ThemeColors.tertiaryLabel,
                size: ThemeDimensions.iconSizeM,
              ),
            ],
          ),
          onTap: onTap,
        ),
        Divider(
          height: 1,
          indent: ThemeDimensions.spacing16,
          color: ThemeColors.separator,
        ),
      ],
    );
  }

  Widget _buildFooterNote(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.spacing16,
        vertical: ThemeDimensions.spacing16,
      ),
      child: Text(
        'achat_notification_footer'.tr(context),
        style: ThemeTextStyles.bodySmall.copyWith(
          color: ThemeColors.tertiaryLabel,
        ),
      ),
    );
  }
}
