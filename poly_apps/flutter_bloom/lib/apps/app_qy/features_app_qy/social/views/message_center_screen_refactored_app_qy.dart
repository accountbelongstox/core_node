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
import 'package:intl/intl.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../controllers/social_controller_app_qy.dart';
import '../domain/model/social_model.dart';

class MessageCenterScreenRefactoredAppQy extends StatefulWidget {
  const MessageCenterScreenRefactoredAppQy({super.key});

  @override
  State<MessageCenterScreenRefactoredAppQy> createState() =>
      _MessageCenterScreenRefactoredAppQyState();
}

class _MessageCenterScreenRefactoredAppQyState
    extends State<MessageCenterScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final controller = context.read<SocialControllerAppQy>();
      controller.loadMessages();
      controller.loadNotifications();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyMessageCenter.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
        actions: [
          IconButton(
            onPressed: () => _showMarkAllAsReadDialog(),
            icon: Icon(Icons.done_all, color: ThemeColors.textPrimary),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: ThemeColors.primary,
          labelColor: ThemeColors.primary,
          unselectedLabelColor: ThemeColors.textSecondary,
          labelStyle: ThemeTextStyles.body1.copyWith(fontWeight: FontWeight.w600),
          unselectedLabelStyle: ThemeTextStyles.body1,
          tabs: [
            Tab(
              child: Consumer<SocialControllerAppQy>(
                builder: (context, controller, child) {
                  final count = controller.unreadMessageCount;
                  return Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(QyAppLocalizationKeys.qyMessages.tr(context)),
                      if (count > 0) ...[
                        SizedBox(width: ThemeDimensions.spacingSmall),
                        _buildBadge(count),
                      ],
                    ],
                  );
                },
              ),
            ),
            Tab(
              child: Consumer<SocialControllerAppQy>(
                builder: (context, controller, child) {
                  final count = controller.unreadNotificationCount;
                  return Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(QyAppLocalizationKeys.qyNotifications.tr(context)),
                      if (count > 0) ...[
                        SizedBox(width: ThemeDimensions.spacingSmall),
                        _buildBadge(count),
                      ],
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
      body: Consumer<SocialControllerAppQy>(
        builder: (context, controller, child) {
          if (controller.isLoading && controller.messages.isEmpty && controller.notifications.isEmpty) {
            return Center(
              child: CircularProgressIndicator(color: ThemeColors.primary),
            );
          }

          return TabBarView(
            controller: _tabController,
            children: [
              _buildMessagesTab(controller),
              _buildNotificationsTab(controller),
            ],
          );
        },
      ),
    );
  }

  Widget _buildBadge(int count) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.paddingXSmall,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: ThemeColors.error,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
      ),
      child: Text(
        count > 99 ? '99+' : count.toString(),
        style: ThemeTextStyles.caption.copyWith(
          color: ThemeColors.surface,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  void _showMarkAllAsReadDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeColors.surface,
        title: Text(
          QyAppLocalizationKeys.qyMarkAllAsRead.tr(context),
          style: ThemeTextStyles.h4.copyWith(color: ThemeColors.textPrimary),
        ),
        content: Text(
          QyAppLocalizationKeys.qyMarkAllAsReadConfirm.tr(context),
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
            onPressed: () {
              Navigator.pop(context);
              final currentTab = _tabController.index;
              final controller = context.read<SocialControllerAppQy>();
              if (currentTab == 0) {
                controller.markAllMessagesAsRead();
              } else {
                controller.markAllNotificationsAsRead();
              }
            },
            child: Text(
              QyAppLocalizationKeys.qyCommonOk.tr(context),
              style: ThemeTextStyles.button.copyWith(color: ThemeColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessagesTab(SocialControllerAppQy controller) {
    final messages = controller.messages;

    if (messages.isEmpty) {
      return _buildEmptyState(
        Icons.message_outlined,
        QyAppLocalizationKeys.qyNoMessages.tr(context),
      );
    }

    return RefreshIndicator(
      onRefresh: controller.loadMessages,
      color: ThemeColors.primary,
      child: ListView.builder(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        itemCount: messages.length,
        itemBuilder: (context, index) {
          return _buildMessageCard(messages[index], controller);
        },
      ),
    );
  }

  Widget _buildMessageCard(MessageModel message, SocialControllerAppQy controller) {
    final dateFormat = DateFormat('MM-dd HH:mm');
    final isUnread = !message.isRead;

    return Container(
      margin: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
      decoration: BoxDecoration(
        color: isUnread ? ThemeColors.primary.withOpacity(0.05) : ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(
          color: isUnread ? ThemeColors.primary.withOpacity(0.3) : ThemeColors.border,
        ),
      ),
      child: InkWell(
        onTap: () {
          if (isUnread) {
            controller.markMessageAsRead(message.id);
          }
        },
        child: Padding(
          padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: _getMessageTypeColor(message.type).withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _getMessageTypeIcon(message.type),
                  color: _getMessageTypeColor(message.type),
                  size: 24,
                ),
              ),
              SizedBox(width: ThemeDimensions.spacingMedium),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          message.senderName,
                          style: ThemeTextStyles.body1.copyWith(
                            color: ThemeColors.textPrimary,
                            fontWeight: isUnread ? FontWeight.bold : FontWeight.w600,
                          ),
                        ),
                        Text(
                          dateFormat.format(message.createdAt),
                          style: ThemeTextStyles.caption.copyWith(
                            color: ThemeColors.textTertiary,
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: ThemeDimensions.spacingXSmall),
                    Text(
                      message.content,
                      style: ThemeTextStyles.body2.copyWith(
                        color: ThemeColors.textSecondary,
                        fontWeight: isUnread ? FontWeight.w500 : FontWeight.normal,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              if (isUnread)
                Container(
                  width: 8,
                  height: 8,
                  margin: EdgeInsets.only(left: ThemeDimensions.spacingSmall, top: 4),
                  decoration: BoxDecoration(
                    color: ThemeColors.primary,
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNotificationsTab(SocialControllerAppQy controller) {
    final notifications = controller.notifications;

    if (notifications.isEmpty) {
      return _buildEmptyState(
        Icons.notifications_none,
        QyAppLocalizationKeys.qyNoNotifications.tr(context),
      );
    }

    return RefreshIndicator(
      onRefresh: controller.loadNotifications,
      color: ThemeColors.primary,
      child: ListView.builder(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        itemCount: notifications.length,
        itemBuilder: (context, index) {
          return _buildNotificationCard(notifications[index], controller);
        },
      ),
    );
  }

  Widget _buildNotificationCard(NotificationModel notification, SocialControllerAppQy controller) {
    final dateFormat = DateFormat('MM-dd HH:mm');
    final isUnread = !notification.isRead;

    return Container(
      margin: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
      decoration: BoxDecoration(
        color: isUnread ? ThemeColors.primary.withOpacity(0.05) : ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(
          color: isUnread ? ThemeColors.primary.withOpacity(0.3) : ThemeColors.border,
        ),
      ),
      child: InkWell(
        onTap: () {
          if (isUnread) {
            controller.markNotificationAsRead(notification.id);
          }
        },
        child: Padding(
          padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: EdgeInsets.all(ThemeDimensions.paddingSmall),
                decoration: BoxDecoration(
                  color: _getNotificationTypeColor(notification.type).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
                ),
                child: Icon(
                  _getNotificationTypeIcon(notification.type),
                  color: _getNotificationTypeColor(notification.type),
                  size: 20,
                ),
              ),
              SizedBox(width: ThemeDimensions.spacingMedium),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            notification.title,
                            style: ThemeTextStyles.body1.copyWith(
                              color: ThemeColors.textPrimary,
                              fontWeight: isUnread ? FontWeight.bold : FontWeight.w600,
                            ),
                          ),
                        ),
                        Text(
                          dateFormat.format(notification.createdAt),
                          style: ThemeTextStyles.caption.copyWith(
                            color: ThemeColors.textTertiary,
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: ThemeDimensions.spacingXSmall),
                    Text(
                      notification.content,
                      style: ThemeTextStyles.body2.copyWith(
                        color: ThemeColors.textSecondary,
                      ),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              if (isUnread)
                Container(
                  width: 8,
                  height: 8,
                  margin: EdgeInsets.only(left: ThemeDimensions.spacingSmall, top: 4),
                  decoration: BoxDecoration(
                    color: ThemeColors.primary,
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(IconData icon, String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            size: 80,
            color: ThemeColors.textTertiary.withOpacity(0.5),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            message,
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  IconData _getMessageTypeIcon(String type) {
    switch (type) {
      case 'system':
        return Icons.info_outline;
      case 'announcement':
        return Icons.campaign;
      case 'achievement':
        return Icons.emoji_events;
      default:
        return Icons.message;
    }
  }

  Color _getMessageTypeColor(String type) {
    switch (type) {
      case 'system':
        return ColorsAppQy.qyInfo;
      case 'announcement':
        return Colors.orange;
      case 'achievement':
        return Colors.amber;
      default:
        return ThemeColors.primary;
    }
  }

  IconData _getNotificationTypeIcon(String type) {
    switch (type) {
      case 'reminder':
        return Icons.alarm;
      case 'achievement':
        return Icons.emoji_events;
      case 'course':
        return Icons.school;
      default:
        return Icons.notifications;
    }
  }

  Color _getNotificationTypeColor(String type) {
    switch (type) {
      case 'reminder':
        return ColorsAppQy.qySuccess;
      case 'achievement':
        return Colors.amber;
      case 'course':
        return Colors.purple;
      default:
        return ThemeColors.primary;
    }
  }
}
