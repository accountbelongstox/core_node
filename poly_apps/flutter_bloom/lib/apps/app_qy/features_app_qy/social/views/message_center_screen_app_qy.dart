// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// Message Center Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class MessageCenterScreenAppQy extends StatefulWidget {
  const MessageCenterScreenAppQy({super.key});

  @override
  State<MessageCenterScreenAppQy> createState() => _MessageCenterScreenAppQyState();
}

class _MessageCenterScreenAppQyState extends State<MessageCenterScreenAppQy>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final List<String> _tabs;
  final List<Map<String, dynamic>> _systemMessages;
  final List<Map<String, dynamic>> _socialMessages;

  _MessageCenterScreenAppQyState()
      : _tabs = ['系统消息', '社交消息', '学习动态'],
        _systemMessages = [],
        _socialMessages = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
    _loadMockData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _loadMockData() {
    // Mock data for demonstration
    _systemMessages.addAll([
      {
        'title': '学习提醒',
        'content': '您今天还没有完成学习任务，快来打卡吧！',
        'time': '2 小时前',
        'isRead': false,
        'icon': Icons.notifications,
      },
      {
        'title': '系统更新',
        'content': '新版本已发布，包含多项功能优化和性能提升',
        'time': '1 天前',
        'isRead': true,
        'icon': Icons.system_update,
      },
    ]);
  }

  void _handleMarkAllAsRead() {
    setState(() {
      for (var message in _systemMessages) {
        message['isRead'] = true;
      }
      for (var message in _socialMessages) {
        message['isRead'] = true;
      }
    });
  }

  void _handleMessageTap(Map<String, dynamic> message) {
    setState(() {
      message['isRead'] = true;
    });
    // TODO: Navigate to message detail
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyMessageCenter.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        actions: [
          TextButton(
            onPressed: _handleMarkAllAsRead,
            child: Text(
              QyAppLocalizationKeys.qyMarkAllAsRead.tr(context),
              style: TextStyles.button.copyWith(color: ThemeColors.primary),
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: ThemeColors.primary,
          labelColor: ThemeColors.primary,
          unselectedLabelColor: ThemeColors.textSecondary,
          labelStyle: TextStyles.button,
          tabs: _tabs.map((tab) => Tab(text: tab)).toList(),
        ),
      ),
      body: SafeArea(
        child: TabBarView(
          controller: _tabController,
          children: [
            _buildMessageList(_systemMessages),
            _buildMessageList(_socialMessages),
            _buildEmptyState(),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageList(List<Map<String, dynamic>> messages) {
    if (messages.isEmpty) {
      return _buildEmptyState();
    }

    return ListView.builder(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      itemCount: messages.length,
      itemBuilder: (context, index) {
        final message = messages[index];
        return _buildMessageItem(message);
      },
    );
  }

  Widget _buildMessageItem(Map<String, dynamic> message) {
    final bool isRead = message['isRead'] ?? false;

    return InkWell(
      onTap: () => _handleMessageTap(message),
      child: Container(
        margin: EdgeInsets.only(bottom: Dimensions.spacingSmall),
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        decoration: BoxDecoration(
          color: isRead ? ThemeColors.surface : ThemeColors.primary.withOpacity(0.05),
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          border: Border.all(
            color: isRead ? ThemeColors.border : ThemeColors.primary.withOpacity(0.2),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: EdgeInsets.all(Dimensions.paddingSmall),
              decoration: BoxDecoration(
                color: ThemeColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
              ),
              child: Icon(
                message['icon'] ?? Icons.message,
                color: ThemeColors.primary,
                size: 24,
              ),
            ),
            SizedBox(width: Dimensions.spacingMedium),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          message['title'] ?? '',
                          style: TextStyles.body1.copyWith(
                            color: ThemeColors.textPrimary,
                            fontWeight: isRead ? FontWeight.normal : FontWeight.w600,
                          ),
                        ),
                      ),
                      if (!isRead)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: ThemeColors.error,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  SizedBox(height: Dimensions.spacingXSmall),
                  Text(
                    message['content'] ?? '',
                    style: TextStyles.body2.copyWith(
                      color: ThemeColors.textSecondary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  SizedBox(height: Dimensions.spacingXSmall),
                  Text(
                    message['time'] ?? '',
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.textTertiary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.inbox,
            size: 64,
            color: ThemeColors.textTertiary.withOpacity(0.5),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            QyAppLocalizationKeys.qyNoMessages.tr(context),
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
